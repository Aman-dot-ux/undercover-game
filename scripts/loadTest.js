/**
 * Automated Staged Load-Testing Harness for Undercover.
 * Progressively scales 6-player active rooms against target server,
 * measuring connection latency, room creation, game start, and heartbeat stability.
 */

import http from 'http';
import https from 'https';
import { io as ClientIO } from 'socket.io-client';

const TARGET_URL = process.argv.find(arg => arg.startsWith('--target='))?.split('=')[1] ||
  (process.argv.includes('--local') ? 'http://localhost:3000' : 'https://undercover-game-g84e.onrender.com');

const STAGES = [10, 25, 50, 75, 100];
const PLAYERS_PER_ROOM = 6;
const SOCKET_TIMEOUT_MS = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Check /health endpoint
async function checkHealth(targetUrl) {
  const start = Date.now();
  const url = new URL('/health', targetUrl);
  const client = url.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const req = client.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = Date.now() - start;
        try {
          const parsed = JSON.parse(data);
          resolve({ ok: res.statusCode === 200, status: res.statusCode, duration, data: parsed });
        } catch {
          resolve({ ok: res.statusCode === 200, status: res.statusCode, duration, raw: data });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ ok: false, error: err.message, duration: Date.now() - start });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'Health check timed out (8s)', duration: Date.now() - start });
    });
  });
}

// Create single player socket
function createClient(targetUrl) {
  return ClientIO(targetUrl, {
    transports: ['websocket', 'polling'],
    timeout: SOCKET_TIMEOUT_MS,
    reconnection: false,
    forceNew: true
  });
}

// Setup and launch a complete 6-player room
async function setupRoom(targetUrl, roomIndex) {
  const roomMetrics = {
    roomIndex,
    roomCode: null,
    createDuration: 0,
    joinDurations: [],
    startDuration: 0,
    errors: [],
    clients: []
  };

  try {
    // 1. Connect Host
    const hostClient = createClient(targetUrl);
    roomMetrics.clients.push(hostClient);

    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Host socket connect timeout')), SOCKET_TIMEOUT_MS);
      hostClient.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      hostClient.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    // 2. Host creates room
    const createStart = Date.now();
    let hostPlayerId = null;

    await new Promise((resolve, reject) => {
      hostClient.emit('room:create', {
        nickname: `H_${roomIndex}`,
        settings: {
          maxPlayers: PLAYERS_PER_ROOM,
          category: 'Random',
          undercoverCount: 1,
          discussionDuration: 45
        }
      }, (res) => {
        roomMetrics.createDuration = Date.now() - createStart;
        if (res && res.success) {
          roomMetrics.roomCode = res.roomCode;
          hostPlayerId = res.playerId;
          resolve();
        } else {
          reject(new Error(res?.error || 'Failed to create room'));
        }
      });
    });

    const roomCode = roomMetrics.roomCode;

    // 3. Connect remaining 5 players
    const otherClients = [];
    for (let p = 2; p <= PLAYERS_PER_ROOM; p++) {
      await sleep(25); // Gentle stagger to prevent socket flood
      const pClient = createClient(targetUrl);
      roomMetrics.clients.push(pClient);
      otherClients.push({ client: pClient, playerIndex: p });
    }

    // Connect all 5 players in parallel
    await Promise.all(otherClients.map(({ client }) => {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Player connect timeout')), SOCKET_TIMEOUT_MS);
        client.on('connect', () => {
          clearTimeout(timer);
          resolve();
        });
        client.on('connect_error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    }));

    // Each player joins
    const playerIds = [];
    for (const { client, playerIndex } of otherClients) {
      const joinStart = Date.now();

      await new Promise((resolve, reject) => {
        client.emit('room:join', {
          roomCode,
          nickname: `P${playerIndex}_${roomIndex}`
        }, (res) => {
          roomMetrics.joinDurations.push(Date.now() - joinStart);
          if (res && res.success) {
            playerIds.push({ client, pId: res.playerId });
            resolve();
          } else {
            reject(new Error(res?.error || `Player ${playerIndex} join failed`));
          }
        });
      });
    }

    // Ensure all players are marked ready before starting match
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timeout waiting for all players ready')), 5000);
      const onLobby = (lobby) => {
        if (lobby && lobby.players.length === PLAYERS_PER_ROOM && lobby.players.every(p => p.isReady)) {
          clearTimeout(timer);
          hostClient.off('room:lobby_update', onLobby);
          resolve();
        }
      };
      hostClient.on('room:lobby_update', onLobby);

      // Trigger ready for all players
      playerIds.forEach(({ client, pId }) => {
        client.emit('room:toggle_ready', { roomCode, playerId: pId });
      });
    });

    // 4. Host starts the game
    const startStart = Date.now();
    await new Promise((resolve, reject) => {
      hostClient.emit('game:start', {
        roomCode,
        hostId: hostPlayerId
      }, (res) => {
        roomMetrics.startDuration = Date.now() - startStart;
        if (res && res.success) {
          resolve();
        } else {
          reject(new Error(res?.error || 'Game start failed'));
        }
      });
    });

    return { success: true, metrics: roomMetrics };
  } catch (err) {
    roomMetrics.errors.push(err.message);
    return { success: false, metrics: roomMetrics, error: err.message };
  }
}

async function runLoadTest() {
  console.log('====================================================================');
  console.log('  🚀 UNDERCOVER LOAD TESTING — RENDER CLOUD INSTANCE');
  console.log(`  Target URL:        ${TARGET_URL}`);
  console.log(`  Room Size:         ${PLAYERS_PER_ROOM} Players per Room`);
  console.log(`  Ramp-Up Targets:   ${STAGES.join(' -> ')} Concurrent Rooms`);
  console.log('====================================================================\n');

  // Initial Pre-Flight Health Check
  console.log('[PRE-FLIGHT] Checking server health...');
  const initialHealth = await checkHealth(TARGET_URL);
  if (!initialHealth.ok) {
    console.error(`[ERROR] Server health check failed: ${initialHealth.error || initialHealth.status}`);
    console.error('Please ensure the instance is active and accessible before testing.');
    process.exit(1);
  }
  console.log(`[PRE-FLIGHT] ✓ Server online | Latency: ${initialHealth.duration}ms | Uptime: ${Math.round(initialHealth.data?.uptime || 0)}s | Active Rooms: ${initialHealth.data?.activeRooms || 0}\n`);

  let allActiveRooms = [];

  for (const targetRooms of STAGES) {
    const targetPlayers = targetRooms * PLAYERS_PER_ROOM;
    const additionalRoomsNeeded = targetRooms - allActiveRooms.length;

    console.log(`--------------------------------------------------------------------`);
    console.log(`  ⚡ TIER: Scaling to ${targetRooms} Active Rooms (${targetPlayers} Concurrent Players)`);
    console.log(`     Adding ${additionalRoomsNeeded} new rooms with 6 players each...`);
    console.log(`--------------------------------------------------------------------`);

    const stageStart = Date.now();
    let stageSuccessCount = 0;
    let stageFailCount = 0;
    const createTimes = [];
    const joinTimes = [];
    const startTimes = [];

    for (let r = 0; r < additionalRoomsNeeded; r++) {
      const roomNum = allActiveRooms.length + 1;
      process.stdout.write(`  [${roomNum}/${targetRooms}] Provisioning 6-player room... `);

      const result = await setupRoom(TARGET_URL, roomNum);

      if (result.success) {
        stageSuccessCount++;
        allActiveRooms.push(result.metrics);
        createTimes.push(result.metrics.createDuration);
        joinTimes.push(...result.metrics.joinDurations);
        startTimes.push(result.metrics.startDuration);
        console.log(`✓ Code: ${result.metrics.roomCode} | Create: ${result.metrics.createDuration}ms | Start: ${result.metrics.startDuration}ms`);
      } else {
        stageFailCount++;
        console.log(`✗ FAILED: ${result.error}`);
        // Clean up any sockets created for failed room
        result.metrics.clients.forEach(c => {
          try { c.disconnect(); } catch {}
        });
      }

      // Small pause between room spawns to keep ramp smooth
      await sleep(100);
    }

    const currentTotalRooms = allActiveRooms.length;
    const currentTotalPlayers = currentTotalRooms * PLAYERS_PER_ROOM;

    // Dwell period: Hold active rooms under real-time load for 10 seconds
    console.log(`\n  [HOLD] Holding ${currentTotalRooms} rooms (${currentTotalPlayers} players) active under real-time load for 10s...`);
    await sleep(10000);

    // Health check under load
    const loadHealth = await checkHealth(TARGET_URL);

    // Compute averages
    const avgCreate = createTimes.length ? Math.round(createTimes.reduce((a, b) => a + b, 0) / createTimes.length) : 0;
    const avgJoin = joinTimes.length ? Math.round(joinTimes.reduce((a, b) => a + b, 0) / joinTimes.length) : 0;
    const avgStart = startTimes.length ? Math.round(startTimes.reduce((a, b) => a + b, 0) / startTimes.length) : 0;
    const failRate = ((stageFailCount / (stageSuccessCount + stageFailCount || 1)) * 100).toFixed(1);

    console.log('\n  ==============================================================');
    console.log(`  📊 STAGE SUMMARY: ${currentTotalRooms} Active Rooms (${currentTotalPlayers} Connected Players)`);
    console.log('  ==============================================================');
    console.log(`    Total Active Rooms:     ${currentTotalRooms} / ${targetRooms}`);
    console.log(`    Total Active Players:   ${currentTotalPlayers} / ${targetPlayers}`);
    console.log(`    Stage Room Success:     ${stageSuccessCount} succeeded, ${stageFailCount} failed (${failRate}% failure rate)`);
    console.log(`    Avg Room Creation Time: ${avgCreate} ms`);
    console.log(`    Avg Player Join Time:   ${avgJoin} ms`);
    console.log(`    Avg Match Start Time:   ${avgStart} ms`);
    console.log(`    Server Health Latency:  ${loadHealth.ok ? `${loadHealth.duration} ms (Status: ${loadHealth.status})` : `DEGRADED (${loadHealth.error})`}`);
    console.log(`    Server Reported Rooms:  ${loadHealth.data?.activeRooms ?? 'N/A'}`);
    console.log('  ==============================================================\n');

    // Threshold detection: if failure rate > 20% or health check failed, stop scaling
    if (stageFailCount > 0 && (stageFailCount / (stageSuccessCount + stageFailCount)) >= 0.2) {
      console.warn(`\n[WARNING] Threshold reached! Failure rate (${failRate}%) exceeded 20% tolerance.`);
      console.warn(`[RESULT] Maximum stable concurrent rooms before degradation: ~${currentTotalRooms - stageFailCount} rooms (${(currentTotalRooms - stageFailCount) * PLAYERS_PER_ROOM} players).`);
      break;
    }

    if (!loadHealth.ok) {
      console.warn(`\n[WARNING] Server health check timed out or failed under ${currentTotalRooms} rooms load.`);
      console.warn(`[RESULT] Saturation ceiling reached at ~${currentTotalRooms} rooms.`);
      break;
    }
  }

  // Graceful Teardown
  console.log('--------------------------------------------------------------------');
  console.log(`[TEARDOWN] Disconnecting all ${allActiveRooms.length * PLAYERS_PER_ROOM} virtual clients cleanly...`);
  for (const room of allActiveRooms) {
    room.clients.forEach(c => {
      try { c.disconnect(); } catch {}
    });
  }
  console.log('[TEARDOWN] ✓ All test sockets closed. Test complete.');
  console.log('--------------------------------------------------------------------\n');
}

runLoadTest().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
