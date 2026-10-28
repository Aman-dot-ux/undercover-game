import { io } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

async function runTest() {
  console.log('--- STARTING LEAVE GAME SIMULATION ---');

  // Spin up temporary local server on dynamic port
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
    const alice = await createClient('Alice'); // Host
    const bob = await createClient('Bob');
    const charlie = await createClient('Charlie');
    const dave = await createClient('Dave');

    console.log('All 4 clients connected.');

    // 1. Host creates room
    let roomCode = null;
    let aliceId = null;
    await new Promise((res) => {
      alice.socket.emit('room:create', { nickname: 'Alice', settings: { category: 'Random', undercoverCount: 1 } }, (response) => {
        roomCode = response.roomCode;
        aliceId = response.playerId;
        console.log(`Room created: ${roomCode}`);
        res();
      });
    });

    // 2. Bob, Charlie, Dave join
    let bobId, charlieId, daveId;
    await new Promise((res) => {
      bob.socket.emit('room:join', { roomCode, nickname: 'Bob' }, (r) => { bobId = r.playerId; res(); });
    });
    await new Promise((res) => {
      charlie.socket.emit('room:join', { roomCode, nickname: 'Charlie' }, (r) => { charlieId = r.playerId; res(); });
    });
    await new Promise((res) => {
      dave.socket.emit('room:join', { roomCode, nickname: 'Dave' }, (r) => { daveId = r.playerId; res(); });
    });

    console.log('All 4 players joined room.');

    // 3. Toggle ready
    bob.socket.emit('room:toggle_ready', { roomCode, playerId: bobId });
    charlie.socket.emit('room:toggle_ready', { roomCode, playerId: charlieId });
    dave.socket.emit('room:toggle_ready', { roomCode, playerId: daveId });

    await new Promise((r) => setTimeout(r, 200));

    // 4. Host starts game
    await new Promise((res) => {
      alice.socket.emit('game:start', { roomCode, hostId: aliceId }, (r) => {
        console.log('Game start response:', r);
        if (!r.success) throw new Error(r.error);
        res();
      });
    });

    console.log('Game active. Setting up listeners for player left & countdown...');

    let playerLeftReceived = false;
    let endingCountdownReceived = false;
    let endingCountdownReason = '';
    let navLobbyReceived = false;

    alice.socket.on('game:player_left', (data) => {
      console.log('[Alice received game:player_left]:', data);
      if (data.nickname === 'Dave' && data.playerId === daveId) {
        playerLeftReceived = true;
      }
    });

    alice.socket.on('game:ending_countdown', (data) => {
      console.log('[Alice received game:ending_countdown]:', data);
      endingCountdownReceived = true;
      endingCountdownReason = data.reason;
    });

    alice.socket.on('game:nav_lobby', () => {
      console.log('[Alice received game:nav_lobby]');
      navLobbyReceived = true;
    });

    // 5. Dave leaves game
    console.log('Dave is leaving the game...');
    const leaveRes = await new Promise((res) => {
      dave.socket.emit('game:leave', { roomCode, playerId: daveId }, (r) => {
        res(r);
      });
    });

    console.log('Dave leave response:', leaveRes);
    if (!leaveRes.success) throw new Error('Dave leave failed');

    // Wait a brief moment for socket broadcasts
    await new Promise((r) => setTimeout(r, 200));

    if (!playerLeftReceived) {
      throw new Error('FAILURE: game:player_left was not received by remaining players!');
    }
    console.log('SUCCESS: game:player_left was received correctly.');

    if (!endingCountdownReceived) {
      throw new Error('FAILURE: game:ending_countdown was not received when player count dropped to 3!');
    }
    console.log(`SUCCESS: game:ending_countdown received! Reason: "${endingCountdownReason}"`);

    // Wait for the 5-second countdown to complete and navigate back to lobby
    console.log('Waiting 5.5s for timer to complete...');
    await new Promise((r) => setTimeout(r, 5500));

    if (!navLobbyReceived) {
      throw new Error('FAILURE: game:nav_lobby was not emitted after 5-second countdown!');
    }
    console.log('SUCCESS: game:nav_lobby received and room returned to lobby!');

    // Cleanup
    alice.socket.disconnect();
    bob.socket.disconnect();
    charlie.socket.disconnect();
    dave.socket.disconnect();
    server.close();

    console.log('--- ALL SIMULATION TESTS PASSED SUCCESSFULLY! ---');
    process.exit(0);
  } catch (err) {
    console.error('SIMULATION TEST ERROR:', err);
    server.close();
    process.exit(1);
  }
}

runTest();
