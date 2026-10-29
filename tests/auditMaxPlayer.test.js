import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';
import { PHASES } from '../src/game/engine.js';

test('Audit Phase 4 & 5: Game Loop & Max Capacity Multiplayer (1-7 Players)', async (t) => {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();
  const handlers = setupSocketHandlers(io, roomManager);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const SERVER_URL = `http://127.0.0.1:${port}`;

  function createClient() {
    return new Promise((resolve) => {
      const socket = ClientIO(SERVER_URL, { reconnection: false, forceNew: true });
      socket.on('connect', () => resolve(socket));
    });
  }

  await t.test('1. Under-capacity checks: 1 and 2 players cannot start match', async () => {
    const s1 = await createClient();
    let roomCode, p1Id;
    await new Promise((r) => s1.emit('room:create', { nickname: 'HostSolo', settings: { maxPlayers: 6 } }, (res) => {
      roomCode = res.roomCode;
      p1Id = res.playerId;
      r();
    }));

    // Attempt start with 1 player
    const start1Res = await new Promise((r) => s1.emit('game:start', { roomCode, hostId: p1Id }, r));
    assert.strictEqual(start1Res.success, false, '1 player cannot start game');
    assert.ok(start1Res.error.includes('3 players'));

    // Join 2nd player
    const s2 = await createClient();
    let p2Id;
    await new Promise((r) => s2.emit('room:join', { roomCode, nickname: 'Player2' }, (res) => {
      p2Id = res.playerId;
      r();
    }));
    s2.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    await new Promise((r) => setTimeout(r, 50));

    // Attempt start with 2 players
    const start2Res = await new Promise((r) => s1.emit('game:start', { roomCode, hostId: p1Id }, r));
    assert.strictEqual(start2Res.success, false, '2 players cannot start game');
    assert.ok(start2Res.error.includes('3 players'));

    s1.close();
    s2.close();
  });

  await t.test('2. Max-Capacity (6 Players) & Max+1 Rejection (7th Player)', async () => {
    const sockets = [];
    const playerIds = [];
    let roomCode;

    // Client 1 (Host) creates 6-player room
    const hostSocket = await createClient();
    sockets.push(hostSocket);

    await new Promise((r) => hostSocket.emit('room:create', {
      nickname: 'Player1',
      settings: { maxPlayers: 6, undercoverCount: 2, category: 'Food' }
    }, (res) => {
      roomCode = res.roomCode;
      playerIds.push(res.playerId);
      r();
    }));

    // Clients 2 to 6 join room
    for (let i = 2; i <= 6; i++) {
      const s = await createClient();
      sockets.push(s);
      await new Promise((r) => s.emit('room:join', { roomCode, nickname: `Player${i}` }, (res) => {
        assert.strictEqual(res.success, true, `Player${i} should successfully join`);
        playerIds.push(res.playerId);
        r();
      }));
      s.emit('room:toggle_ready', { roomCode, playerId: playerIds[i - 1] });
    }

    const roomObj = roomManager.getRoom(roomCode);
    assert.strictEqual(roomObj.players.length, 6, 'Room must have exactly 6 players');

    // 7th Player (Max + 1) attempts to join full room -> MUST be rejected cleanly
    const s7 = await createClient();
    const join7Res = await new Promise((r) => s7.emit('room:join', { roomCode, nickname: 'Player7' }, r));
    assert.strictEqual(join7Res.success, false, '7th player must be rejected from 6-player room');
    assert.strictEqual(join7Res.error, 'Room is full (max 6 players).', 'Rejection reason must indicate max 6 players');
    assert.strictEqual(roomObj.players.length, 6, 'Room count must remain 6');
    s7.close();

    // Allow ready state updates to propagate
    await new Promise((r) => setTimeout(r, 100));

    // Host starts match with 6 players
    const startRes = await new Promise((r) => hostSocket.emit('game:start', { roomCode, hostId: playerIds[0] }, r));
    assert.strictEqual(startRes.success, true, '6 players must successfully start game');

    // Verify 2 Undercovers assigned per settings
    const undercovers = roomObj.engine.players.filter(p => p.role === 'undercover');
    const civilians = roomObj.engine.players.filter(p => p.role === 'civilian');
    assert.strictEqual(undercovers.length, 2, 'Must have 2 undercovers for 6p with undercoverCount=2');
    assert.strictEqual(civilians.length, 4, 'Must have 4 civilians');

    // All 6 confirm ready for clues
    for (let i = 0; i < 6; i++) {
      roomObj.engine.playerReadyForClues(playerIds[i]);
    }
    assert.strictEqual(roomObj.engine.phase, PHASES.CLUE_ROUND);

    // Complete Clue Round for all 6 players in turn order
    for (let i = 0; i < 6; i++) {
      const activeId = roomObj.engine.turnOrder[roomObj.engine.currentTurnIndex];
      const activeSockIdx = playerIds.indexOf(activeId);
      const res = await new Promise((r) => {
        sockets[activeSockIdx].emit('game:submit_clue', {
          roomCode,
          playerId: activeId,
          clueText: `Clue from ${activeId.slice(0, 4)}`
        }, r);
      });
      assert.strictEqual(res.success, true);
    }

    // Now all 6 clues submitted -> phase should be DISCUSSION
    assert.strictEqual(roomObj.engine.phase, PHASES.DISCUSSION);

    // Host advances discussion early to VOTING
    await new Promise((r) => hostSocket.emit('game:start_voting', { roomCode, hostId: playerIds[0] }, r));
    assert.strictEqual(roomObj.engine.phase, PHASES.VOTING);

    // All vote for an Undercover
    const targetUndercover = undercovers[0];
    for (let i = 0; i < 6; i++) {
      const voterId = playerIds[i];
      // Player cannot vote for themselves
      const targetId = voterId === targetUndercover.id ? undercovers[1].id : targetUndercover.id;
      const vRes = await new Promise((r) => sockets[i].emit('game:submit_vote', {
        roomCode,
        voterId,
        targetId
      }, r));
      assert.strictEqual(vRes.success, true);
    }

    // Voting resolved: Target eliminated
    assert.strictEqual(roomObj.engine.phase, PHASES.ELIMINATION);
    assert.strictEqual(roomObj.engine.lastElimination.player.id, targetUndercover.id);
    assert.strictEqual(roomObj.engine.lastElimination.player.role, 'undercover');

    // Cleanup sockets
    sockets.forEach(s => s.close());
  });

  await t.test('3. Midpoint (4 Players) Full Match Flow', async () => {
    const sockets = [];
    const playerIds = [];
    let roomCode;

    const hostSocket = await createClient();
    sockets.push(hostSocket);

    await new Promise((r) => hostSocket.emit('room:create', {
      nickname: 'MidHost',
      settings: { maxPlayers: 4, undercoverCount: 1, category: 'Objects' }
    }, (res) => {
      roomCode = res.roomCode;
      playerIds.push(res.playerId);
      r();
    }));

    for (let i = 2; i <= 4; i++) {
      const s = await createClient();
      sockets.push(s);
      await new Promise((r) => s.emit('room:join', { roomCode, nickname: `MidP${i}` }, (res) => {
        playerIds.push(res.playerId);
        r();
      }));
      s.emit('room:toggle_ready', { roomCode, playerId: playerIds[i - 1] });
    }

    const roomObj = roomManager.getRoom(roomCode);
    assert.strictEqual(roomObj.players.length, 4);

    await new Promise((r) => setTimeout(r, 80));

    // Start
    const startRes = await new Promise((r) => hostSocket.emit('game:start', { roomCode, hostId: playerIds[0] }, r));
    assert.strictEqual(startRes.success, true);
    assert.strictEqual(roomObj.engine.players.filter(p => p.role === 'undercover').length, 1);
    assert.strictEqual(roomObj.engine.players.filter(p => p.role === 'civilian').length, 3);

    // Readies & Clues
    for (let i = 0; i < 4; i++) {
      roomObj.engine.playerReadyForClues(playerIds[i]);
    }
    assert.strictEqual(roomObj.engine.phase, PHASES.CLUE_ROUND);

    for (let i = 0; i < 4; i++) {
      const activeId = roomObj.engine.turnOrder[roomObj.engine.currentTurnIndex];
      const activeIdx = playerIds.indexOf(activeId);
      await new Promise((r) => sockets[activeIdx].emit('game:submit_clue', {
        roomCode,
        playerId: activeId,
        clueText: `Clue from ${activeId.slice(0, 4)}`
      }, r));
    }
    assert.strictEqual(roomObj.engine.phase, PHASES.DISCUSSION);

    sockets.forEach(s => s.close());
  });

  await t.test('4. Max - 1 (5 Players) Full Match Flow with 2 Undercovers', async () => {
    const sockets = [];
    const playerIds = [];
    let roomCode;

    const hostSocket = await createClient();
    sockets.push(hostSocket);

    await new Promise((r) => hostSocket.emit('room:create', {
      nickname: 'FiveHost',
      settings: { maxPlayers: 5, undercoverCount: 2, category: 'Sports' }
    }, (res) => {
      roomCode = res.roomCode;
      playerIds.push(res.playerId);
      r();
    }));

    for (let i = 2; i <= 5; i++) {
      const s = await createClient();
      sockets.push(s);
      await new Promise((r) => s.emit('room:join', { roomCode, nickname: `FiveP${i}` }, (res) => {
        playerIds.push(res.playerId);
        r();
      }));
      s.emit('room:toggle_ready', { roomCode, playerId: playerIds[i - 1] });
    }

    const roomObj = roomManager.getRoom(roomCode);
    assert.strictEqual(roomObj.players.length, 5);

    await new Promise((r) => setTimeout(r, 80));

    // Start
    const startRes = await new Promise((r) => hostSocket.emit('game:start', { roomCode, hostId: playerIds[0] }, r));
    assert.strictEqual(startRes.success, true);
    assert.strictEqual(roomObj.engine.players.filter(p => p.role === 'undercover').length, 2);
    assert.strictEqual(roomObj.engine.players.filter(p => p.role === 'civilian').length, 3);

    sockets.forEach(s => s.close());
  });

  // Clean Teardown
  handlers.clearAllTimers();
  clearInterval(roomManager.cleanupInterval);
  await new Promise((r) => io.close(r));
});
