import { io } from 'socket.io-client';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';

async function runTest() {
  console.log('--- STARTING 5-PLAYER LEAVE GAME SIMULATION ---');

  const app = express();
  const server = http.createServer(app);
  const serverIo = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();
  setupSocketHandlers(serverIo, roomManager);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const SERVER_URL = `http://localhost:${port}`;

  function createClient(nickname) {
    return new Promise((resolve) => {
      const socket = io(SERVER_URL, { reconnection: false, forceNew: true });
      socket.on('connect', () => {
        resolve({ socket, nickname });
      });
    });
  }

  try {
    const p1 = await createClient('P1');
    const p2 = await createClient('P2');
    const p3 = await createClient('P3');
    const p4 = await createClient('P4');
    const p5 = await createClient('P5');

    let roomCode = null;
    let p1Id, p2Id, p3Id, p4Id, p5Id;

    await new Promise((res) => {
      p1.socket.emit('room:create', { nickname: 'P1', settings: { category: 'Random', undercoverCount: 1 } }, (r) => {
        roomCode = r.roomCode;
        p1Id = r.playerId;
        res();
      });
    });

    await new Promise((res) => { p2.socket.emit('room:join', { roomCode, nickname: 'P2' }, (r) => { p2Id = r.playerId; res(); }); });
    await new Promise((res) => { p3.socket.emit('room:join', { roomCode, nickname: 'P3' }, (r) => { p3Id = r.playerId; res(); }); });
    await new Promise((res) => { p4.socket.emit('room:join', { roomCode, nickname: 'P4' }, (r) => { p4Id = r.playerId; res(); }); });
    await new Promise((res) => { p5.socket.emit('room:join', { roomCode, nickname: 'P5' }, (r) => { p5Id = r.playerId; res(); }); });

    p2.socket.emit('room:toggle_ready', { roomCode, playerId: p2Id });
    p3.socket.emit('room:toggle_ready', { roomCode, playerId: p3Id });
    p4.socket.emit('room:toggle_ready', { roomCode, playerId: p4Id });
    p5.socket.emit('room:toggle_ready', { roomCode, playerId: p5Id });

    await new Promise((r) => setTimeout(r, 200));

    await new Promise((res) => {
      p1.socket.emit('game:start', { roomCode, hostId: p1Id }, (r) => { res(); });
    });

    let p5LeftNotified = false;
    let endingCountdownFired = false;

    p1.socket.on('game:player_left', (d) => {
      if (d.nickname === 'P5') p5LeftNotified = true;
    });

    p1.socket.on('game:ending_countdown', () => {
      endingCountdownFired = true;
    });

    // P5 leaves
    await new Promise((res) => {
      p5.socket.emit('game:leave', { roomCode, playerId: p5Id }, (r) => { res(); });
    });

    await new Promise((r) => setTimeout(r, 500));

    if (!p5LeftNotified) throw new Error('P5 left notification not received!');
    if (endingCountdownFired) throw new Error('Ending countdown should NOT fire when 4 players remain!');

    console.log('SUCCESS: With 4 players remaining, game did NOT end and notification was delivered!');

    p1.socket.disconnect();
    p2.socket.disconnect();
    p3.socket.disconnect();
    p4.socket.disconnect();
    p5.socket.disconnect();
    server.close();
    process.exit(0);
  } catch (err) {
    console.error(err);
    server.close();
    process.exit(1);
  }
}

runTest();
