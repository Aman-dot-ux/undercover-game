/**
 * Automated Multi-Match Simulation Test:
 * Verifies that the host's 'Vote Now' (startVotingEarly) button works
 * in Match 1 and across subsequent matches (Match 2+).
 */

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

const targetArg = process.argv.find(arg => arg.startsWith('--target='));
const TARGET_URL = targetArg ? targetArg.split('=')[1] : null;
const TEST_PORT = 3203;
const SERVER_URL = TARGET_URL || `http://127.0.0.1:${TEST_PORT}`;

async function runVoteNowSimulation() {
  console.log('===============================================================');
  console.log('  ⚡ UNDERCOVER VOTE NOW MULTI-MATCH TEST (4 PLAYERS)');
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
    const names = ['Alice', 'Bob', 'Charlie', 'Dave'];
    clients = names.map(() => ClientIO(SERVER_URL, { reconnection: false }));
    await Promise.all(clients.map(c => new Promise(r => c.on('connect', r))));
    console.log('[TEST] ✓ 4 virtual clients connected.');

    let roomCode = null;
    const playerIds = {};
    const privateRoles = {};

    let latestState = null;
    clients[0].on('game:state_update', s => {
      latestState = s;
    });

    clients.forEach((c, idx) => {
      c.on('game:private_role', roleState => {
        privateRoles[names[idx]] = roleState;
      });
    });

    function waitForState(predicate, description, timeoutMs = 6000) {
      return new Promise((resolve, reject) => {
        if (latestState && predicate(latestState)) {
          return resolve(latestState);
        }
        const timer = setTimeout(() => {
          clients[0].off('game:state_update', onUpdate);
          reject(new Error(`Timed out waiting for [${description}] after ${timeoutMs}ms. Phase: ${latestState?.phase}`));
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

    // 1. Create Room
    await new Promise(resolve => {
      clients[0].emit('room:create', { nickname: names[0], settings: { maxPlayers: 4, undercoverCount: 1 } }, res => {
        if (!res.success) throw new Error(res.error);
        roomCode = res.roomCode;
        playerIds[names[0]] = res.playerId;
        resolve();
      });
    });

    for (let i = 1; i < 4; i++) {
      await new Promise(resolve => {
        clients[i].emit('room:join', { roomCode, nickname: names[i] }, res => {
          if (!res.success) throw new Error(res.error);
          playerIds[names[i]] = res.playerId;
          resolve();
        });
      });
    }
    console.log(`[TEST] ✓ Room ${roomCode} created with 4 players.`);

    // =========================================================================
    // MATCH 1
    // =========================================================================
    console.log('\n--- STARTING MATCH 1 ---');
    for (let i = 1; i < 4; i++) {
      clients[i].emit('room:toggle_ready', { roomCode, playerId: playerIds[names[i]] });
    }
    await new Promise(r => setTimeout(r, 200));

    await new Promise(resolve => {
      clients[0].emit('game:start', { roomCode, hostId: playerIds['Alice'] }, res => {
        if (!res.success) throw new Error(`Match 1 start failed: ${res.error}`);
        resolve();
      });
    });

    await waitForState(s => s.phase === 'role_reveal', 'Match 1: role_reveal');
    clients.forEach((c, idx) => {
      c.emit('game:player_ready_for_clues', { roomCode, playerId: playerIds[names[idx]] });
    });

    const m1ClueState = await waitForState(s => s.phase === 'clue_round', 'Match 1: clue_round');
    console.log('[TEST] ✓ Match 1: Entered clue round.');

    // Submit clues
    for (let step = 0; step < 4; step++) {
      const cur = await waitForState(s => s.phase === 'clue_round' && Object.keys(s.clues || {}).length === step, `M1 clue ${step}`);
      const pid = cur.currentTurnPlayerId;
      const cIdx = names.findIndex(n => playerIds[n] === pid);
      await new Promise(resolve => {
        clients[cIdx].emit('game:submit_clue', { roomCode, playerId: pid, clueText: `M1 Clue ${names[cIdx]}` }, res => {
          if (!res.success) throw new Error(`M1 clue failed: ${res.error}`);
          resolve();
        });
      });
    }

    await waitForState(s => s.phase === 'discussion', 'Match 1: discussion');
    console.log('[TEST] ✓ Match 1: Entered discussion phase.');

    // Host clicks 'Vote Now' in Match 1
    const m1VoteNowRes = await new Promise(resolve => {
      clients[0].emit('game:start_voting', { roomCode, hostId: playerIds['Alice'] }, resolve);
    });
    if (!m1VoteNowRes.success) {
      throw new Error(`Match 1: Vote Now failed: ${m1VoteNowRes.error}`);
    }
    await waitForState(s => s.phase === 'voting', 'Match 1: voting');
    console.log('[TEST] ✓ Match 1: Host clicked [Vote Now] -> Successfully advanced to Voting!');

    // Eliminate Undercover to finish Match 1
    const undercoverName = names.find(n => privateRoles[n]?.role === 'undercover');
    const undercoverId = playerIds[undercoverName];
    names.forEach((n, idx) => {
      const target = (n === undercoverName) ? playerIds['Alice'] : undercoverId;
      clients[idx].emit('game:submit_vote', { roomCode, voterId: playerIds[n], targetId: target });
    });

    await waitForState(s => s.phase === 'game_over', 'Match 1: game_over');
    console.log('[TEST] ✓ Match 1 ended with Game Over!');

    // =========================================================================
    // MATCH 2 (Next Match)
    // =========================================================================
    console.log('\n--- STARTING MATCH 2 (NEXT MATCH) ---');
    const m2StartRes = await new Promise(resolve => {
      clients[0].emit('game:next_match', { roomCode, hostId: playerIds['Alice'] }, resolve);
    });
    if (!m2StartRes.success) {
      throw new Error(`Match 2 start failed: ${m2StartRes.error}`);
    }

    await waitForState(s => s.phase === 'role_reveal', 'Match 2: role_reveal');
    console.log('[TEST] ✓ Match 2: Entered role reveal.');

    clients.forEach((c, idx) => {
      c.emit('game:player_ready_for_clues', { roomCode, playerId: playerIds[names[idx]] });
    });

    await waitForState(s => s.phase === 'clue_round', 'Match 2: clue_round');
    console.log('[TEST] ✓ Match 2: Entered clue round.');

    // Submit clues for Match 2
    for (let step = 0; step < 4; step++) {
      const cur = await waitForState(s => s.phase === 'clue_round' && Object.keys(s.clues || {}).length === step, `M2 clue ${step}`);
      const pid = cur.currentTurnPlayerId;
      const cIdx = names.findIndex(n => playerIds[n] === pid);
      await new Promise(resolve => {
        clients[cIdx].emit('game:submit_clue', { roomCode, playerId: pid, clueText: `M2 Clue ${names[cIdx]}` }, res => {
          if (!res.success) throw new Error(`M2 clue failed: ${res.error}`);
          resolve();
        });
      });
    }

    await waitForState(s => s.phase === 'discussion', 'Match 2: discussion');
    console.log('[TEST] ✓ Match 2: Entered discussion phase.');

    // Host clicks 'Vote Now' in Match 2!
    console.log('[TEST] Host clicking [Vote Now] in Match 2...');
    const m2VoteNowRes = await new Promise(resolve => {
      clients[0].emit('game:start_voting', { roomCode, hostId: playerIds['Alice'] }, resolve);
    });

    if (!m2VoteNowRes.success) {
      throw new Error(`Match 2: Vote Now failed: ${m2VoteNowRes.error}`);
    }

    await waitForState(s => s.phase === 'voting', 'Match 2: voting');
    console.log('[TEST] ✓ Match 2: Host clicked [Vote Now] -> Successfully advanced to Voting in Match 2!');

    console.log('===============================================================');
    console.log('  🎉 VOTE NOW MULTI-MATCH TEST PASSED 100%!                   ');
    console.log('===============================================================');
  } finally {
    clients.forEach(c => c.disconnect());
    if (server) server.close();
  }
}

runVoteNowSimulation().catch(err => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
