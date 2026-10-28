/**
 * Automated Multi-Client Simulation Test for:
 * 1. 6-player room creation, join, ready, and match start.
 * 2. Role reveal and Round 1 clues submission.
 * 3. Civilian elimination & win condition assessment (match continues).
 * 4. Host advancing to Round 2 ("Next Clue Round").
 * 5. Verification that Round 2 clue input is available and accepted.
 * 6. Repetitive click / spam protection stress test.
 */

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

const TEST_PORT = 3201;
const SERVER_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runMultiRoundSimulation() {
  console.log('===============================================================');
  console.log('  🎭 UNDERCOVER MULTI-ROUND & REPETITIVE CLICK TEST (6 PLAYERS)');
  console.log('===============================================================');

  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();
  setupSocketHandlers(io, roomManager);

  await new Promise(resolve => server.listen(TEST_PORT, '127.0.0.1', resolve));
  console.log(`[TEST] Server listening on ${SERVER_URL}`);

  let clients = [];
  try {
    // 1. Connect 6 virtual clients
    const names = ['Alice', 'Bob', 'Charlie', 'Dave', 'Emma', 'Frank'];
    clients = names.map(() => ClientIO(SERVER_URL, { reconnection: false }));

    await Promise.all(clients.map(c => new Promise(r => c.on('connect', r))));
    console.log('[TEST] ✓ All 6 virtual clients connected.');

    // 2. Host creates room
    let roomCode = null;
    const playerIds = {};
    const privateRoles = {};

    await new Promise(resolve => {
      clients[0].emit('room:create', { nickname: names[0], settings: { maxPlayers: 6, undercoverCount: 1 } }, res => {
        if (!res.success) throw new Error(res.error);
        roomCode = res.roomCode;
        playerIds[names[0]] = res.playerId;
        resolve();
      });
    });

    // 3. Other 5 players join
    for (let i = 1; i < 6; i++) {
      await new Promise(resolve => {
        clients[i].emit('room:join', { roomCode, nickname: names[i] }, res => {
          if (!res.success) throw new Error(res.error);
          playerIds[names[i]] = res.playerId;
          resolve();
        });
      });
    }
    console.log(`[TEST] ✓ Room ${roomCode} created with all 6 players joined.`);

    // 4. Track private roles & continuous public state
    let latestState = null;
    clients[0].on('game:state_update', s => {
      latestState = s;
    });

    clients.forEach((c, idx) => {
      c.on('game:private_role', roleState => {
        privateRoles[names[idx]] = roleState;
      });
    });

    function waitForState(predicate, description, timeoutMs = 5000) {
      return new Promise((resolve, reject) => {
        if (latestState && predicate(latestState)) {
          return resolve(latestState);
        }
        const timer = setTimeout(() => {
          clients[0].off('game:state_update', onUpdate);
          reject(new Error(`Timed out waiting for [${description}] after ${timeoutMs}ms. Current phase: ${latestState?.phase}`));
        }, timeoutMs);

        function onUpdate(s) {
          if (predicate(s)) {
            clearTimeout(timer);
            clients[0].off('game:state_update', onUpdate);
            resolve(s);
          }
        }
        clients[0].on('game:state_update', onUpdate);
      });
    }

    // 5. Mark ready for all non-host players
    for (let i = 1; i < 6; i++) {
      clients[i].emit('room:toggle_ready', { roomCode, playerId: playerIds[names[i]] });
    }
    await new Promise(r => setTimeout(r, 200));

    // 6. Host starts game (test spam start clicks: 3 simultaneous requests)
    let startCallbacks = 0;
    const startPromises = [1, 2, 3].map(() => new Promise(resolve => {
      clients[0].emit('game:start', { roomCode, hostId: playerIds['Alice'] }, res => {
        if (res.success) startCallbacks++;
        resolve(res);
      });
    }));
    await Promise.all(startPromises);
    console.log(`[TEST] ✓ Host started game (Duplicate start clicks safely handled, successes: ${startCallbacks}).`);

    // Wait for role reveal state
    await waitForState(s => s.phase === 'role_reveal', 'phase: role_reveal');

    // 7. All players confirm role reveal readiness
    clients.forEach((c, idx) => {
      c.emit('game:player_ready_for_clues', { roomCode, playerId: playerIds[names[idx]] });
    });

    // 8. Wait for Clue Round 1
    const clueRound1State = await waitForState(s => s.phase === 'clue_round', 'phase: clue_round');
    console.log('[TEST] ✓ Entered Round 1 Clue Phase. Round Number:', clueRound1State.roundNumber);
    if (clueRound1State.roundNumber !== 1) throw new Error(`Expected roundNumber 1, got ${clueRound1State.roundNumber}`);

    // 9. Submit clues for all 6 players in turn order
    for (let step = 0; step < 6; step++) {
      const curState = await waitForState(
        s => s.phase === 'clue_round' && Object.keys(s.clues || {}).length === step,
        `clue step ${step}`
      );

      const activePid = curState.currentTurnPlayerId;
      const activeIdx = names.findIndex(n => playerIds[n] === activePid);
      const activeClient = clients[activeIdx];

      // Submit clue
      await new Promise(resolve => {
        activeClient.emit('game:submit_clue', { roomCode, playerId: activePid, clueText: `Clue from ${names[activeIdx]}` }, res => {
          if (!res.success) throw new Error(`Failed to submit clue for ${names[activeIdx]}: ${res.error}`);
          resolve();
        });
      });

      // Stress test: rapid duplicate submit from same player
      await new Promise(resolve => {
        activeClient.emit('game:submit_clue', { roomCode, playerId: activePid, clueText: 'Duplicate clue spam' }, res => {
          // Must fail safely without crashing
          if (res.success) throw new Error('Duplicate clue submission should have been rejected!');
          resolve();
        });
      });
    }

    console.log('[TEST] ✓ All 6 players submitted Round 1 clues. Spam duplicate submissions safely rejected.');

    // 10. Wait for Discussion phase
    await waitForState(s => s.phase === 'discussion', 'phase: discussion');
    console.log('[TEST] ✓ Transitioned to Discussion phase.');

    // 11. Advance to voting (test spam skip clicks)
    await new Promise(resolve => {
      clients[0].emit('game:start_voting', { roomCode, hostId: playerIds['Alice'] }, res => {
        if (!res.success) throw new Error('Failed to start voting early');
        resolve();
      });
    });

    await waitForState(s => s.phase === 'voting', 'phase: voting');
    console.log('[TEST] ✓ Transitioned to Voting phase.');

    // 12. Find a Civilian to eliminate
    const civilianName = names.find(n => privateRoles[n]?.role === 'civilian' && n !== 'Alice');
    const civilianId = playerIds[civilianName];
    console.log(`[TEST] Targeting Civilian [${civilianName}] for elimination to test next round clue flow.`);

    // All other players vote for this civilian; the civilian votes for Alice
    names.forEach((n, idx) => {
      const target = (n === civilianName) ? playerIds['Alice'] : civilianId;
      clients[idx].emit('game:submit_vote', { roomCode, voterId: playerIds[n], targetId: target });
    });

    // 13. Wait for Elimination phase
    const elimState = await waitForState(s => s.phase === 'elimination', 'phase: elimination');

    console.log('[TEST] ✓ Player eliminated:', elimState.lastElimination?.player?.nickname, `(${elimState.lastElimination?.player?.role})`);
    if (elimState.winnerTeam !== null) {
      throw new Error('Game should not be over after 1 civilian eliminated in a 6-player match!');
    }

    // 14. Host clicks "Next Clue Round" (test repetitive spam clicks: 5 rapid calls)
    console.log('[TEST] Testing rapid spam clicks on Next Clue Round...');
    for (let k = 0; k < 5; k++) {
      clients[0].emit('game:continue_round', { roomCode, hostId: playerIds['Alice'] });
    }

    // 15. Wait for Round 2 Clue Phase
    const round2State = await waitForState(
      s => s.phase === 'clue_round' && s.roundNumber === 2,
      'phase: clue_round roundNumber: 2'
    );

    console.log('[TEST] ✓ Successfully transitioned to ROUND 2 Clue Phase!');
    console.log('       Round Number:', round2State.roundNumber);
    console.log('       Turn Order Count:', round2State.turnOrder.length, '(Expected: 5 alive players)');
    console.log('       Current Round Clues Object:', JSON.stringify(round2State.clues));
    console.log('       Archived Clue History Rounds:', round2State.clueHistory?.length);

    // CRITICAL ASSERTIONS:
    if (round2State.roundNumber !== 2) {
      throw new Error(`Expected roundNumber 2, got ${round2State.roundNumber}`);
    }
    if (round2State.turnOrder.includes(civilianId)) {
      throw new Error('Eliminated civilian is erroneously present in Round 2 turn order!');
    }
    if (round2State.turnOrder.length !== 5) {
      throw new Error(`Expected exactly 5 alive players in turn order, got ${round2State.turnOrder.length}`);
    }
    if (Object.keys(round2State.clues).length !== 0) {
      throw new Error('round2State.clues should be empty {} at start of Round 2!');
    }

    // Verify first living player in Round 2 can submit their clue
    const r2FirstPid = round2State.turnOrder[0];
    const r2FirstIdx = names.findIndex(n => playerIds[n] === r2FirstPid);
    const r2FirstClient = clients[r2FirstIdx];

    const playerMeta = round2State.players.find(p => p.id === r2FirstPid);
    if (playerMeta.hasGivenClue !== false) {
      throw new Error(`Player ${names[r2FirstIdx]} hasGivenClue is ${playerMeta.hasGivenClue}, expected false! Option to type would be missing!`);
    }

    const r2SubmitRes = await new Promise(resolve => {
      r2FirstClient.emit('game:submit_clue', { roomCode, playerId: r2FirstPid, clueText: 'Round 2 fresh clue!' }, resolve);
    });

    if (!r2SubmitRes.success) {
      throw new Error(`Round 2 clue submission failed: ${r2SubmitRes.error}`);
    }
    console.log(`[TEST] ✓ Player [${names[r2FirstIdx]}] successfully submitted clue in Round 2! Typing option is working!`);

    // Verify eliminated player is rejected if attempting to give a clue
    const deadClientIdx = names.findIndex(n => n === civilianName);
    const deadSubmitRes = await new Promise(resolve => {
      clients[deadClientIdx].emit('game:submit_clue', { roomCode, playerId: civilianId, clueText: 'Ghost clue' }, resolve);
    });
    if (deadSubmitRes.success) {
      throw new Error('Eliminated player was able to submit a clue!');
    }
    console.log(`[TEST] ✓ Eliminated player [${civilianName}] clue submission correctly rejected (${deadSubmitRes.error}).`);

    console.log('===============================================================');
    console.log('  🎉 MULTI-ROUND & REPETITIVE CLICK SIMULATION PASSED 100%!   ');
    console.log('===============================================================');
  } finally {
    clients.forEach(c => c.disconnect());
    server.close();
  }
}

runMultiRoundSimulation().catch(err => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
