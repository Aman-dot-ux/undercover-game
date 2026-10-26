/**
 * Multi-Client Automated Simulation Test for Undercover.
 * Spawns 3 virtual Socket.IO clients, connects to a local test server,
 * executes an end-to-end game loop (Create -> Join -> Ready -> Start -> Roles -> Clues -> Vote -> Eliminate),
 * and verifies all events and assertions.
 */

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

const TEST_PORT = 3099;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runSimulation() {
  console.log('===============================================================');
  console.log('  🎭 UNDERCOVER MULTI-CLIENT MATCH SIMULATION (3 PLAYERS)       ');
  console.log('===============================================================');

  // 1. Create ephemeral server for test simulation
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();
  setupSocketHandlers(io, roomManager);

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`[SIM] Ephemeral test server running at ${SERVER_URL}`);

  try {
    // 2. Connect 3 virtual clients
    const client1 = ClientIO(SERVER_URL, { reconnection: false });
    const client2 = ClientIO(SERVER_URL, { reconnection: false });
    const client3 = ClientIO(SERVER_URL, { reconnection: false });

    await Promise.all([
      new Promise(r => client1.on('connect', r)),
      new Promise(r => client2.on('connect', r)),
      new Promise(r => client3.on('connect', r))
    ]);
    console.log('[SIM] ✓ All 3 virtual socket clients connected.');

    // 3. Player 1 creates room
    let roomCode = null;
    let p1Id = null;
    await new Promise((resolve, reject) => {
      client1.emit('room:create', {
        nickname: 'AliceHost',
        settings: { maxPlayers: 4, category: 'Food', undercoverCount: 1, discussionDuration: 10 }
      }, (res) => {
        if (!res || !res.success) return reject(new Error('P1 create room failed'));
        roomCode = res.roomCode;
        p1Id = res.playerId;
        console.log(`[SIM] ✓ Player 1 created Room: ${roomCode}`);
        resolve();
      });
    });

    // 4. Players 2 & 3 join room
    let p2Id = null;
    let p3Id = null;

    await new Promise((resolve, reject) => {
      client2.emit('room:join', { roomCode, nickname: 'BobPlayer' }, (res) => {
        if (!res || !res.success) return reject(new Error('P2 join failed'));
        p2Id = res.playerId;
        console.log('[SIM] ✓ Player 2 (Bob) joined.');
        resolve();
      });
    });

    await new Promise((resolve, reject) => {
      client3.emit('room:join', { roomCode, nickname: 'CharliePlayer' }, (res) => {
        if (!res || !res.success) return reject(new Error('P3 join failed'));
        p3Id = res.playerId;
        console.log('[SIM] ✓ Player 3 (Charlie) joined.');
        resolve();
      });
    });

    // 5. Players 2 & 3 mark Ready
    client2.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    client3.emit('room:toggle_ready', { roomCode, playerId: p3Id });

    // Wait for lobby update with all ready
    await new Promise(resolve => {
      client1.on('room:lobby_update', (lobby) => {
        if (lobby.players.length === 3 && lobby.players.every(p => p.isReady)) {
          console.log('[SIM] ✓ All 3 players are Ready in lobby.');
          resolve();
        }
      });
    });

    // 6. Set up role tracking promises
    const rolesReceived = {};
    const rolePromises = [
      new Promise(resolve => client1.once('game:private_role', (data) => { rolesReceived[p1Id] = data; resolve(); })),
      new Promise(resolve => client2.once('game:private_role', (data) => { rolesReceived[p2Id] = data; resolve(); })),
      new Promise(resolve => client3.once('game:private_role', (data) => { rolesReceived[p3Id] = data; resolve(); }))
    ];

    // Host starts match
    await new Promise((resolve, reject) => {
      client1.emit('game:start', { roomCode, hostId: p1Id }, (res) => {
        if (!res || !res.success) return reject(new Error('Host start game failed'));
        console.log('[SIM] ✓ Host initiated match start.');
        resolve();
      });
    });

    // 7. Verify all received private roles
    await Promise.all(rolePromises);
    console.log('[SIM] ✓ All 3 clients privately received secret roles & words:');
    Object.entries(rolesReceived).forEach(([pid, roleData]) => {
      console.log(`      - ${roleData.nickname}: [${roleData.role.toUpperCase()}] Word: "${roleData.word}"`);
    });

    const undercoverCount = Object.values(rolesReceived).filter(r => r.role === 'undercover').length;
    const civilianCount = Object.values(rolesReceived).filter(r => r.role === 'civilian').length;
    if (undercoverCount !== 1 || civilianCount !== 2) {
      throw new Error(`Invalid role distribution: ${undercoverCount} Undercovers, ${civilianCount} Civilians`);
    }

    // 8. Players confirm reading their role
    client1.emit('game:player_ready_for_clues', { roomCode, playerId: p1Id });
    client2.emit('game:player_ready_for_clues', { roomCode, playerId: p2Id });
    client3.emit('game:player_ready_for_clues', { roomCode, playerId: p3Id });

    // Wait for Clue Round transition
    const clueRoundState = await new Promise(resolve => {
      const handler = (state) => {
        if (state.phase === 'clue_round') {
          client1.off('game:state_update', handler);
          resolve(state);
        }
      };
      client1.on('game:state_update', handler);
    });
    console.log('[SIM] ✓ Game entered CLUE_ROUND. Turn order established.');

    // 9. Submit clues in order
    const clientsMap = { [p1Id]: client1, [p2Id]: client2, [p3Id]: client3 };
    for (const currentTurnId of clueRoundState.turnOrder) {
      const turnClient = clientsMap[currentTurnId];
      await new Promise((resolve, reject) => {
        turnClient.emit('game:submit_clue', {
          roomCode,
          playerId: currentTurnId,
          clueText: `Simulated clue from ${rolesReceived[currentTurnId].nickname}`
        }, (res) => {
          if (!res || !res.success) return reject(new Error(`Failed clue submission for ${currentTurnId}`));
          resolve();
        });
      });
    }
    console.log('[SIM] ✓ All clues successfully submitted in turn order.');

    // 10. Advance to Voting
    await new Promise(resolve => {
      client1.emit('game:start_voting', { roomCode, hostId: p1Id }, resolve);
    });
    console.log('[SIM] ✓ Advanced to VOTING phase.');

    // Find who the Undercover is and have Civilians vote them out
    const undercoverId = Object.keys(rolesReceived).find(id => rolesReceived[id].role === 'undercover');
    const civilianIds = Object.keys(rolesReceived).filter(id => id !== undercoverId);

    // Votes: Civilians vote for the Undercover; Undercover votes for one of the civilians
    await new Promise(resolve => clientsMap[civilianIds[0]].emit('game:submit_vote', { roomCode, voterId: civilianIds[0], targetId: undercoverId }, resolve));
    await new Promise(resolve => clientsMap[undercoverId].emit('game:submit_vote', { roomCode, voterId: undercoverId, targetId: civilianIds[0] }, resolve));
    await new Promise(resolve => clientsMap[civilianIds[1]].emit('game:submit_vote', { roomCode, voterId: civilianIds[1], targetId: undercoverId }, resolve));

    // Wait for game over resolution
    const finalState = await new Promise(resolve => {
      const handler = (state) => {
        if (state.phase === 'game_over') {
          client1.off('game:state_update', handler);
          resolve(state);
        }
      };
      client1.on('game:state_update', handler);
    });

    console.log('[SIM] ✓ Voting resolved. Game Over reached!');
    console.log(`      - Winner: [${finalState.winnerTeam.toUpperCase()}]`);
    console.log(`      - Civilian Word: "${finalState.revealedWordPair.civilian}"`);
    console.log(`      - Undercover Word: "${finalState.revealedWordPair.undercover}"`);
    console.log(`      - Eliminated: ${finalState.lastElimination.player.nickname}`);

    if (finalState.winnerTeam !== 'civilian') {
      throw new Error(`Expected civilian victory, received: ${finalState.winnerTeam}`);
    }

    console.log('===============================================================');
    console.log('  🎉 3-PLAYER MATCH SIMULATION PASSED WITH 100% SUCCESS!       ');
    console.log('===============================================================');

    client1.disconnect();
    client2.disconnect();
    client3.disconnect();
    clearInterval(roomManager.cleanupInterval);
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('[SIM ERROR]', err);
    clearInterval(roomManager.cleanupInterval);
    server.close();
    process.exit(1);
  }
}

runSimulation();
