import { io } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

async function runTest() {
  console.log('--- STARTING LEAVE GAME COMPREHENSIVE SIMULATION ---');

  const app = express();
  const server = http.createServer(app);
  const serverIo = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();
  setupSocketHandlers(serverIo, roomManager);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const SERVER_URL = `http://localhost:${port}`;
  console.log(`Test server running on ${SERVER_URL}`);

  function createClient(nickname) {
    return new Promise((resolve) => {
      const socket = io(SERVER_URL, { reconnection: false, forceNew: true });
      socket.on('connect', () => {
        resolve({ socket, nickname });
      });
    });
  }

  try {
    // =========================================================================
    // TEST 1: 3-PLAYER GAME -> 1 PLAYER LEAVES -> DROPS TO 2 -> 5S TIMER -> NAV LOBBY
    // =========================================================================
    console.log('\n[TEST 1] 3-player game: 1 leaves -> aborts with 5s countdown & returns to lobby');
    const p1 = await createClient('Player1');
    const p2 = await createClient('Player2');
    const p3 = await createClient('Player3');

    let roomCode = null;
    let p1Id, p2Id, p3Id;

    await new Promise((res) => {
      p1.socket.emit('room:create', { nickname: 'Player1', settings: { category: 'Random', undercoverCount: 1 } }, (r) => {
        roomCode = r.roomCode;
        p1Id = r.playerId;
        res();
      });
    });

    await new Promise((res) => { p2.socket.emit('room:join', { roomCode, nickname: 'Player2' }, (r) => { p2Id = r.playerId; res(); }); });
    await new Promise((res) => { p3.socket.emit('room:join', { roomCode, nickname: 'Player3' }, (r) => { p3Id = r.playerId; res(); }); });

    p2.socket.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    p3.socket.emit('room:toggle_ready', { roomCode, playerId: p3Id });
    await new Promise((r) => setTimeout(r, 100));

    await new Promise((res) => {
      p1.socket.emit('game:start', { roomCode, hostId: p1Id }, (r) => { res(); });
    });

    let p3LeftReceived = false;
    let t1CountdownReceived = false;
    let t1CountdownReason = '';
    let t1NavLobbyReceived = false;

    p1.socket.on('game:player_left', (d) => {
      if (d.nickname === 'Player3') p3LeftReceived = true;
    });

    p1.socket.on('game:ending_countdown', (d) => {
      t1CountdownReceived = true;
      t1CountdownReason = d.reason;
    });

    p1.socket.on('game:nav_lobby', () => {
      t1NavLobbyReceived = true;
    });

    // Player 3 leaves 3-player game
    await new Promise((res) => {
      p3.socket.emit('game:leave', { roomCode, playerId: p3Id }, (r) => { res(r); });
    });

    await new Promise((r) => setTimeout(r, 150));
    if (!p3LeftReceived) throw new Error('TEST 1 FAILED: Player3 left notification not received!');
    if (!t1CountdownReceived) throw new Error('TEST 1 FAILED: 5s ending countdown was NOT triggered when dropping below 3 players!');
    console.log(`✓ TEST 1 PASSED: 5s countdown triggered with reason: "${t1CountdownReason}"`);

    console.log('Waiting 5.3s for countdown to finish and return to lobby...');
    await new Promise((r) => setTimeout(r, 5300));
    if (!t1NavLobbyReceived) throw new Error('TEST 1 FAILED: game:nav_lobby was not received!');
    console.log('✓ TEST 1 PASSED: Players successfully navigated to lobby.');

    p1.socket.disconnect();
    p2.socket.disconnect();
    p3.socket.disconnect();

    // =========================================================================
    // TEST 2: 4-PLAYER GAME -> CIVILIAN LEAVES -> 3 REMAIN -> GAME CONTINUES (NO ABORT)
    // =========================================================================
    console.log('\n[TEST 2] 4-player game: Civilian leaves -> 3 remain -> game continues seamlessly');
    const c1 = await createClient('C1');
    const c2 = await createClient('C2');
    const c3 = await createClient('C3');
    const c4 = await createClient('C4');

    let rc2 = null;
    let c1Id, c2Id, c3Id, c4Id;

    await new Promise((res) => {
      c1.socket.emit('room:create', { nickname: 'C1', settings: { category: 'Random', undercoverCount: 1 } }, (r) => {
        rc2 = r.roomCode;
        c1Id = r.playerId;
        res();
      });
    });

    await new Promise((res) => { c2.socket.emit('room:join', { roomCode: rc2, nickname: 'C2' }, (r) => { c2Id = r.playerId; res(); }); });
    await new Promise((res) => { c3.socket.emit('room:join', { roomCode: rc2, nickname: 'C3' }, (r) => { c3Id = r.playerId; res(); }); });
    await new Promise((res) => { c4.socket.emit('room:join', { roomCode: rc2, nickname: 'C4' }, (r) => { c4Id = r.playerId; res(); }); });

    c2.socket.emit('room:toggle_ready', { roomCode: rc2, playerId: c2Id });
    c3.socket.emit('room:toggle_ready', { roomCode: rc2, playerId: c3Id });
    c4.socket.emit('room:toggle_ready', { roomCode: rc2, playerId: c4Id });
    await new Promise((r) => setTimeout(r, 100));

    await new Promise((res) => {
      c1.socket.emit('game:start', { roomCode: rc2, hostId: c1Id }, (r) => { res(); });
    });

    const room2 = roomManager.getRoom(rc2);
    // Find a civilian to leave
    const civilian = room2.engine.players.find(p => p.role === 'civilian');
    const civClient = [
      { id: c1Id, client: c1 },
      { id: c2Id, client: c2 },
      { id: c3Id, client: c3 },
      { id: c4Id, client: c4 }
    ].find(x => x.id === civilian.id);

    // Pick an observer who stays in the room
    const civObserver = [c1, c2, c3, c4].find(c => c !== civClient.client);

    let civLeftNotified = false;
    let civCountdownTriggered = false;

    civObserver.socket.on('game:player_left', (d) => {
      if (d.playerId === civilian.id) civLeftNotified = true;
    });
    civObserver.socket.on('game:ending_countdown', () => {
      civCountdownTriggered = true;
    });

    // Civilian leaves
    await new Promise((res) => {
      civClient.client.socket.emit('game:leave', { roomCode: rc2, playerId: civilian.id }, (r) => { res(r); });
    });

    await new Promise((r) => setTimeout(r, 200));
    if (!civLeftNotified) throw new Error('TEST 2 FAILED: game:player_left was not notified for civilian!');
    if (civCountdownTriggered) throw new Error('TEST 2 FAILED: Ending countdown should NOT trigger when a civilian leaves and 3 players remain!');
    console.log('✓ TEST 2 PASSED: Notification sent, game did NOT abort, 3 players still playing.');

    c1.socket.disconnect();
    c2.socket.disconnect();
    c3.socket.disconnect();
    c4.socket.disconnect();

    // =========================================================================
    // TEST 3: 4-PLAYER GAME -> UNDERCOVER LEAVES -> GAME ENDS & RETURNS TO LOBBY
    // =========================================================================
    console.log('\n[TEST 3] 4-player game: Undercover leaves -> game ends with 5s timer & returns to lobby');
    const u1 = await createClient('U1');
    const u2 = await createClient('U2');
    const u3 = await createClient('U3');
    const u4 = await createClient('U4');

    let rc3 = null;
    let u1Id, u2Id, u3Id, u4Id;

    await new Promise((res) => {
      u1.socket.emit('room:create', { nickname: 'U1', settings: { category: 'Random', undercoverCount: 1 } }, (r) => {
        rc3 = r.roomCode;
        u1Id = r.playerId;
        res();
      });
    });

    await new Promise((res) => { u2.socket.emit('room:join', { roomCode: rc3, nickname: 'U2' }, (r) => { u2Id = r.playerId; res(); }); });
    await new Promise((res) => { u3.socket.emit('room:join', { roomCode: rc3, nickname: 'U3' }, (r) => { u3Id = r.playerId; res(); }); });
    await new Promise((res) => { u4.socket.emit('room:join', { roomCode: rc3, nickname: 'U4' }, (r) => { u4Id = r.playerId; res(); }); });

    u2.socket.emit('room:toggle_ready', { roomCode: rc3, playerId: u2Id });
    u3.socket.emit('room:toggle_ready', { roomCode: rc3, playerId: u3Id });
    u4.socket.emit('room:toggle_ready', { roomCode: rc3, playerId: u4Id });
    await new Promise((r) => setTimeout(r, 100));

    await new Promise((res) => {
      u1.socket.emit('game:start', { roomCode: rc3, hostId: u1Id }, (r) => { res(); });
    });

    const room3 = roomManager.getRoom(rc3);
    // Find the undercover player
    const undercover = room3.engine.players.find(p => p.role === 'undercover');
    const undClient = [
      { id: u1Id, client: u1 },
      { id: u2Id, client: u2 },
      { id: u3Id, client: u3 },
      { id: u4Id, client: u4 }
    ].find(x => x.id === undercover.id);

    const observer = [u1, u2, u3, u4].find(c => c !== undClient.client);

    let undLeftNotified = false;
    let undCountdownReceived = false;
    let undCountdownReason = '';
    let undNavLobbyReceived = false;

    observer.socket.on('game:player_left', (d) => {
      if (d.playerId === undercover.id) undLeftNotified = true;
    });
    observer.socket.on('game:ending_countdown', (d) => {
      undCountdownReceived = true;
      undCountdownReason = d.reason;
    });
    observer.socket.on('game:nav_lobby', () => {
      undNavLobbyReceived = true;
    });

    // Undercover leaves
    console.log(`Undercover player (${undercover.nickname}) is leaving...`);
    await new Promise((res) => {
      undClient.client.socket.emit('game:leave', { roomCode: rc3, playerId: undercover.id }, (r) => { res(r); });
    });

    await new Promise((r) => setTimeout(r, 150));
    if (!undLeftNotified) throw new Error('TEST 3 FAILED: game:player_left was not notified for undercover!');
    if (!undCountdownReceived) throw new Error('TEST 3 FAILED: Ending countdown was NOT triggered when Undercover left!');
    console.log(`✓ TEST 3 PASSED: Undercover departure triggered countdown with reason: "${undCountdownReason}"`);

    console.log('Waiting 5.3s for countdown to finish and return to lobby...');
    await new Promise((r) => setTimeout(r, 5300));
    if (!undNavLobbyReceived) throw new Error('TEST 3 FAILED: game:nav_lobby was not received when Undercover left!');
    console.log('✓ TEST 3 PASSED: All remaining players returned to lobby.');

    u1.socket.disconnect();
    u2.socket.disconnect();
    u3.socket.disconnect();
    u4.socket.disconnect();
    server.close();

    console.log('\n======================================================');
    console.log('🎉 ALL 3 LEAVE GAME SCENARIOS PASSED 100% SUCCESSFULLY!');
    console.log('======================================================');
    process.exit(0);
  } catch (err) {
    console.error('SIMULATION TEST ERROR:', err);
    server.close();
    process.exit(1);
  }
}

runTest();
