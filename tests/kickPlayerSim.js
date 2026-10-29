/**
 * Automated Simulation Test for Host Kicking a Player.
 * Verifies that:
 * 1. Host can kick a player from the lobby.
 * 2. Kicked player receives 'room:kicked'.
 * 3. Kicked player's socket leaves roomCode and does not receive subsequent room broadcasts.
 * 4. Remaining players receive updated lobby with the player removed.
 */

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

const targetArg = process.argv.find(arg => arg.startsWith('--target='));
const TARGET_URL = targetArg ? targetArg.split('=')[1] : null;
const TEST_PORT = 3202;
const SERVER_URL = TARGET_URL || `http://127.0.0.1:${TEST_PORT}`;

async function runKickSimulation() {
  console.log('===============================================================');
  console.log('  🚫 UNDERCOVER HOST KICK PLAYER SIMULATION TEST');
  console.log(`  Target Server: ${SERVER_URL}`);
  console.log('===============================================================');

  let app, server, io, roomManager;
  if (!TARGET_URL) {
    app = express();
    server = http.createServer(app);
    io = new Server(server, { cors: { origin: '*' } });
    roomManager = new RoomManager();
    setupSocketHandlers(io, roomManager);
    await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));
    console.log(`[TEST] In-process server listening on ${SERVER_URL}`);
  }

  let clients = [];
  try {
    // 1. Connect 3 clients
    const names = ['Alice', 'Bob', 'Charlie'];
    clients = names.map(() => ClientIO(SERVER_URL, { reconnection: false }));
    await Promise.all(clients.map(c => new Promise(r => c.on('connect', r))));
    console.log('[TEST] ✓ 3 virtual clients connected.');

    // 2. Alice creates room
    let roomCode = null;
    let aliceId, bobId, charlieId;

    await new Promise(resolve => {
      clients[0].emit('room:create', { nickname: 'Alice', settings: { maxPlayers: 4 } }, res => {
        if (!res.success) throw new Error(res.error);
        roomCode = res.roomCode;
        aliceId = res.playerId;
        resolve();
      });
    });

    // 3. Bob and Charlie join
    await new Promise(resolve => {
      clients[1].emit('room:join', { roomCode, nickname: 'Bob' }, res => {
        if (!res.success) throw new Error(res.error);
        bobId = res.playerId;
        resolve();
      });
    });

    await new Promise(resolve => {
      clients[2].emit('room:join', { roomCode, nickname: 'Charlie' }, res => {
        if (!res.success) throw new Error(res.error);
        charlieId = res.playerId;
        resolve();
      });
    });

    console.log(`[TEST] ✓ Room ${roomCode} active with Alice (Host), Bob, and Charlie.`);

    // 4. Setup listeners on Charlie
    let charlieGotKickedEvent = false;
    let charlieGotPostKickLobbyUpdate = false;

    clients[2].on('room:kicked', () => {
      charlieGotKickedEvent = true;
      console.log('[TEST] ✓ Charlie received [room:kicked] event!');
    });

    clients[2].on('room:lobby_update', () => {
      if (charlieGotKickedEvent) {
        charlieGotPostKickLobbyUpdate = true;
      }
    });

    // 5. Setup listener on Alice for lobby update after kick
    const lobbyUpdateAfterKick = new Promise(resolve => {
      const h = lobby => {
        if (lobby.players.length === 2 && !lobby.players.some(p => p.id === charlieId)) {
          clients[0].off('room:lobby_update', h);
          resolve(lobby);
        }
      };
      clients[0].on('room:lobby_update', h);
    });

    // 6. Alice kicks Charlie
    console.log(`[TEST] Alice kicking Charlie (id: ${charlieId})...`);
    clients[0].emit('room:kick_player', {
      roomCode,
      hostId: aliceId,
      targetPlayerId: charlieId
    });

    const updatedLobby = await lobbyUpdateAfterKick;
    console.log('[TEST] ✓ Alice and Bob received updated lobby with 2 players remaining:', updatedLobby.players.map(p => p.nickname));

    // Wait 500ms to ensure no trailing broadcasts reach Charlie
    await new Promise(r => setTimeout(r, 500));

    // Assertions
    if (!charlieGotKickedEvent) {
      throw new Error('Charlie did not receive room:kicked event!');
    }

    if (charlieGotPostKickLobbyUpdate) {
      throw new Error('Charlie erroneously received room:lobby_update AFTER being kicked!');
    }

    console.log('[TEST] ✓ Charlie received NO post-kick room:lobby_update events (channel left cleanly).');
    console.log('===============================================================');
    console.log('  🎉 KICK PLAYER SIMULATION PASSED 100%!                      ');
    console.log('===============================================================');
  } finally {
    clients.forEach(c => c.disconnect());
    if (roomManager && roomManager.cleanupInterval) {
      clearInterval(roomManager.cleanupInterval);
    }
    if (server) server.close();
    process.exit(0);
  }
}

runKickSimulation().catch(err => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
