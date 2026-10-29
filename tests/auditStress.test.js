import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';
import { PHASES } from '../src/game/engine.js';

test('Audit Phase 3: Repetition, Spam & Race Condition Testing', async (t) => {
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

  await t.test('1. Rapid Ready Toggle Spam (50x rapid toggles)', async () => {
    const hostSocket = await createClient();
    const p2Socket = await createClient();

    let roomCode, p2Id;
    await new Promise((resolve) => {
      hostSocket.emit('room:create', { nickname: 'Host', settings: { maxPlayers: 3 } }, (res) => {
        roomCode = res.roomCode;
        resolve();
      });
    });

    await new Promise((resolve) => {
      p2Socket.emit('room:join', { roomCode, nickname: 'Player2' }, (res) => {
        p2Id = res.playerId;
        resolve();
      });
    });

    // Spam ready toggle 50 times rapidly
    for (let i = 0; i < 50; i++) {
      p2Socket.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    }

    // Allow event loop to process
    await new Promise((r) => setTimeout(r, 100));

    const room = roomManager.getRoom(roomCode);
    const p2 = room.players.find(p => p.id === p2Id);
    assert.strictEqual(typeof p2.isReady, 'boolean', 'isReady must remain a valid boolean');

    hostSocket.close();
    p2Socket.close();
  });

  await t.test('2. Clue Submission Spam (50x parallel submissions on single turn)', async () => {
    const s1 = await createClient();
    const s2 = await createClient();
    const s3 = await createClient();

    let roomCode, p1Id, p2Id, p3Id;
    await new Promise((resolve) => {
      s1.emit('room:create', { nickname: 'Alice', settings: { maxPlayers: 3, discussionDuration: 10 } }, (res) => {
        roomCode = res.roomCode;
        p1Id = res.playerId;
        resolve();
      });
    });

    await new Promise((resolve) => {
      s2.emit('room:join', { roomCode, nickname: 'Bob' }, (res) => {
        p2Id = res.playerId;
        resolve();
      });
    });

    await new Promise((resolve) => {
      s3.emit('room:join', { roomCode, nickname: 'Charlie' }, (res) => {
        p3Id = res.playerId;
        resolve();
      });
    });

    s2.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    s3.emit('room:toggle_ready', { roomCode, playerId: p3Id });

    await new Promise((r) => setTimeout(r, 50));

    // Start match
    await new Promise((resolve) => {
      s1.emit('game:start', { roomCode, hostId: p1Id }, resolve);
    });

    const room = roomManager.getRoom(roomCode);

    // Transition each player through role reveal
    room.engine.playerReadyForClues(p1Id);
    room.engine.playerReadyForClues(p2Id);
    room.engine.playerReadyForClues(p3Id);
    assert.strictEqual(room.engine.phase, PHASES.CLUE_ROUND);

    const activeTurnPlayerId = room.engine.turnOrder[room.engine.currentTurnIndex];
    const activeSocket = activeTurnPlayerId === p1Id ? s1 : activeTurnPlayerId === p2Id ? s2 : s3;

    // Spam 50 clue submissions simultaneously
    const clueSpam = [];
    for (let i = 0; i < 50; i++) {
      clueSpam.push(new Promise((resolve) => {
        activeSocket.emit('game:submit_clue', { roomCode, playerId: activeTurnPlayerId, clueText: `Clue attempt ${i}` }, resolve);
      }));
    }
    const results = await Promise.all(clueSpam);

    // Exactly one submission should succeed, 49 should be rejected because turn advanced
    const successes = results.filter(r => r && r.success).length;
    assert.strictEqual(successes, 1, 'Only exactly 1 clue submission should succeed');
    assert.strictEqual(Object.keys(room.engine.clues).length, 1, 'clues dict must only have 1 entry from active player');

    s1.close();
    s2.close();
    s3.close();
  });

  await t.test('3. Voting Spam & Concurrent Vote Submissions (50x rapid votes)', async () => {
    const s1 = await createClient();
    const s2 = await createClient();
    const s3 = await createClient();

    let roomCode, p1Id, p2Id, p3Id;
    await new Promise((r) => s1.emit('room:create', { nickname: 'P1', settings: { maxPlayers: 3 } }, (res) => {
      roomCode = res.roomCode;
      p1Id = res.playerId;
      r();
    }));
    await new Promise((r) => s2.emit('room:join', { roomCode, nickname: 'P2' }, (res) => {
      p2Id = res.playerId;
      r();
    }));
    await new Promise((r) => s3.emit('room:join', { roomCode, nickname: 'P3' }, (res) => {
      p3Id = res.playerId;
      r();
    }));

    s2.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    s3.emit('room:toggle_ready', { roomCode, playerId: p3Id });
    await new Promise((r) => setTimeout(r, 50));

    await new Promise((r) => s1.emit('game:start', { roomCode, hostId: p1Id }, r));

    // Force engine directly to voting phase
    const room = roomManager.getRoom(roomCode);
    room.engine.beginVoting();

    // Player 1 spams 50 votes for Player 2
    const voteSpam = [];
    for (let i = 0; i < 50; i++) {
      voteSpam.push(new Promise((resolve) => {
        s1.emit('game:submit_vote', { roomCode, voterId: p1Id, targetId: p2Id }, resolve);
      }));
    }
    await Promise.all(voteSpam);

    // Verify P1 has cast only 1 vote
    assert.strictEqual(room.engine.votes[p1Id], p2Id);
    assert.strictEqual(Object.keys(room.engine.votes).length, 1, 'Voting dict must only hold 1 vote for P1');

    // Concurrently submit votes from P2 and P3 at the exact same millisecond
    await Promise.all([
      new Promise((r) => s2.emit('game:submit_vote', { roomCode, voterId: p2Id, targetId: p3Id }, r)),
      new Promise((r) => s3.emit('game:submit_vote', { roomCode, voterId: p3Id, targetId: p2Id }, r))
    ]);

    // All 3 votes submitted -> should resolve voting immediately to ELIMINATION or revote
    assert.ok(
      room.engine.phase === PHASES.ELIMINATION || room.engine.phase === PHASES.GAME_OVER,
      'Phase must advance from VOTING once all living players voted'
    );

    s1.close();
    s2.close();
    s3.close();
  });

  // Clean Teardown
  handlers.clearAllTimers();
  clearInterval(roomManager.cleanupInterval);
  await new Promise((r) => io.close(r));
});
