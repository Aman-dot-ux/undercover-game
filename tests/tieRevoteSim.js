/**
 * Automated Multi-Client Simulation Test for Tie Revote & In-Game Match Restart.
 * Verifies that tie detection, revote transitions, vote restrictions, elimination,
 * and in-game match restart work seamlessly across multiple live socket clients.
 */

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

const TEST_PORT = 3199;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runTieSimulation() {
  console.log('===============================================================');
  console.log('  ⚖️ UNDERCOVER TIE REVOTE & MATCH RESTART SIMULATION (4 PLAYERS)');
  console.log('===============================================================');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();
  setupSocketHandlers(io, roomManager);

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`[TIE-SIM] Test server listening on ${SERVER_URL}`);

  try {
    // 1. Connect 4 virtual socket clients
    const c1 = ClientIO(SERVER_URL, { reconnection: false });
    const c2 = ClientIO(SERVER_URL, { reconnection: false });
    const c3 = ClientIO(SERVER_URL, { reconnection: false });
    const c4 = ClientIO(SERVER_URL, { reconnection: false });

    await Promise.all([
      new Promise(r => c1.on('connect', r)),
      new Promise(r => c2.on('connect', r)),
      new Promise(r => c3.on('connect', r)),
      new Promise(r => c4.on('connect', r))
    ]);
    console.log('[TIE-SIM] ✓ 4 virtual clients connected.');

    // 2. Room setup
    let roomCode = null;
    let p1Id, p2Id, p3Id, p4Id;

    await new Promise(resolve => {
      c1.emit('room:create', { nickname: 'Alice', settings: { maxPlayers: 4, undercoverCount: 1 } }, res => {
        roomCode = res.roomCode;
        p1Id = res.playerId;
        resolve();
      });
    });

    await new Promise(r => c2.emit('room:join', { roomCode, nickname: 'Bob' }, res => { p2Id = res.playerId; r(); }));
    await new Promise(r => c3.emit('room:join', { roomCode, nickname: 'Charlie' }, res => { p3Id = res.playerId; r(); }));
    await new Promise(r => c4.emit('room:join', { roomCode, nickname: 'Dave' }, res => { p4Id = res.playerId; r(); }));

    c2.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    c3.emit('room:toggle_ready', { roomCode, playerId: p3Id });
    c4.emit('room:toggle_ready', { roomCode, playerId: p4Id });

    // Wait for all ready
    await new Promise(resolve => {
      c1.on('room:lobby_update', lobby => {
        if (lobby.players.length === 4 && lobby.players.every(p => p.isReady)) resolve();
      });
    });
    console.log('[TIE-SIM] ✓ 4 players in lobby and ready.');

    // 3. Start game
    await new Promise(resolve => c1.emit('game:start', { roomCode, hostId: p1Id }, resolve));

    // Confirm roles
    c1.emit('game:player_ready_for_clues', { roomCode, playerId: p1Id });
    c2.emit('game:player_ready_for_clues', { roomCode, playerId: p2Id });
    c3.emit('game:player_ready_for_clues', { roomCode, playerId: p3Id });
    c4.emit('game:player_ready_for_clues', { roomCode, playerId: p4Id });

    // Wait for clue round
    const clueState = await new Promise(resolve => {
      const h = state => {
        if (state.phase === 'clue_round') {
          c1.off('game:state_update', h);
          resolve(state);
        }
      };
      c1.on('game:state_update', h);
    });

    const clientMap = { [p1Id]: c1, [p2Id]: c2, [p3Id]: c3, [p4Id]: c4 };
    for (const pid of clueState.turnOrder) {
      await new Promise(resolve => {
        clientMap[pid].emit('game:submit_clue', { roomCode, playerId: pid, clueText: 'Test clue' }, resolve);
      });
    }
    console.log('[TIE-SIM] ✓ Clues submitted.');

    // 4. Force advance to voting
    await new Promise(resolve => c1.emit('game:start_voting', { roomCode, hostId: p1Id }, resolve));
    console.log('[TIE-SIM] ✓ Entered voting phase.');

    // 5. Create a 2 vs 2 Tie between Alice (p1Id) and Bob (p2Id)
    // Alice votes for Bob, Charlie votes for Bob
    // Bob votes for Alice, Dave votes for Alice
    await new Promise(r => c1.emit('game:submit_vote', { roomCode, voterId: p1Id, targetId: p2Id }, r));
    await new Promise(r => c3.emit('game:submit_vote', { roomCode, voterId: p3Id, targetId: p2Id }, r));
    await new Promise(r => c2.emit('game:submit_vote', { roomCode, voterId: p2Id, targetId: p1Id }, r));

    // Dave's vote completes voting and triggers tie
    const tieState = await new Promise(resolve => {
      const h = state => {
        if (state.phase === 'elimination' && state.lastElimination?.tie) {
          c1.off('game:state_update', h);
          resolve(state);
        }
      };
      c1.on('game:state_update', h);
      c4.emit('game:submit_vote', { roomCode, voterId: p4Id, targetId: p1Id });
    });

    console.log('[TIE-SIM] ✓ Tie successfully detected in Elimination phase!');
    console.log('          Tied players:', tieState.lastElimination.tiedPlayers.map(p => p.nickname).join(' and '));

    // 6. Test Host triggering Tie Revote
    const revoteState = await new Promise(resolve => {
      const h = state => {
        if (state.phase === 'voting' && state.isTieRevote) {
          c1.off('game:state_update', h);
          resolve(state);
        }
      };
      c1.on('game:state_update', h);
      c1.emit('game:start_tie_revote', { roomCode, hostId: p1Id });
    });

    console.log('[TIE-SIM] ✓ Transitioned into TIE REVOTE voting phase.');
    console.log('          Revote targets limited to:', revoteState.tiedPlayerIds);

    // 7. Verify non-tied candidate cannot be voted for during revote
    await new Promise(resolve => {
      c4.emit('game:submit_vote', { roomCode, voterId: p4Id, targetId: p3Id }, res => {
        if (!res.success) {
          console.log('[TIE-SIM] ✓ Correctly rejected vote for non-tied candidate:', res.error);
        } else {
          throw new Error('Vote for non-tied candidate should have failed!');
        }
        resolve();
      });
    });

    // 8. Submit valid revotes breaking the tie (voting out Bob)
    await new Promise(r => c1.emit('game:submit_vote', { roomCode, voterId: p1Id, targetId: p2Id }, r));
    await new Promise(r => c2.emit('game:submit_vote', { roomCode, voterId: p2Id, targetId: p1Id }, r));
    await new Promise(r => c3.emit('game:submit_vote', { roomCode, voterId: p3Id, targetId: p2Id }, r));

    const postRevoteState = await new Promise(resolve => {
      const h = state => {
        if (state.phase === 'elimination' && !state.lastElimination?.tie) {
          c1.off('game:state_update', h);
          resolve(state);
        }
      };
      c1.on('game:state_update', h);
      c4.emit('game:submit_vote', { roomCode, voterId: p4Id, targetId: p2Id });
    });

    console.log('[TIE-SIM] ✓ Tie Revote resolved successfully! Eliminated:', postRevoteState.lastElimination.player.nickname);

    // 9. Test In-Game Match Restart by Host
    const restartState = await new Promise(resolve => {
      const h = state => {
        if (state.phase === 'role_reveal' && state.roundNumber === 2) {
          c1.off('game:state_update', h);
          resolve(state);
        }
      };
      c1.on('game:state_update', h);
      c1.emit('game:restart_match', { roomCode, hostId: p1Id }, res => {
        if (!res.success) throw new Error('Match restart failed');
      });
    });

    console.log('[TIE-SIM] ✓ Host In-Game Match Restart succeeded! Game reset to fresh Round 2 Role Reveal.');
    console.log('          All players alive:', restartState.players.every(p => p.isAlive));

    console.log('===============================================================');
    console.log('  🎉 TIE REVOTE & MATCH RESTART SIMULATION PASSED 100%!       ');
    console.log('===============================================================');

    c1.disconnect();
    c2.disconnect();
    c3.disconnect();
    c4.disconnect();
    clearInterval(roomManager.cleanupInterval);
    server.close();
    process.exit(0);
  } catch (err) {
    console.error('[TIE-SIM ERROR]', err);
    clearInterval(roomManager.cleanupInterval);
    server.close();
    process.exit(1);
  }
}

runTieSimulation();
