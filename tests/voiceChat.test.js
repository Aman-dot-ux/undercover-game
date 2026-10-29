import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIO } from 'socket.io-client';
import { TokenVerifier } from 'livekit-server-sdk';
import { RoomManager } from '../src/server/rooms.js';
import { setupSocketHandlers } from '../src/server/socketHandlers.js';
import { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } from '../src/config.js';

test('Voice Chat - LiveKit Ephemeral Token & Room Isolation', async (t) => {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager();
  setupSocketHandlers(io, roomManager);

  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const SERVER_URL = `http://localhost:${port}`;

  function createClient() {
    return new Promise((resolve) => {
      const socket = ClientIO(SERVER_URL, { reconnection: false, forceNew: true });
      socket.on('connect', () => resolve(socket));
    });
  }

  const verifier = new TokenVerifier(LIVEKIT_API_KEY, LIVEKIT_API_SECRET);

  await t.test('1. Generates cryptographically valid room-scoped token for room member', async () => {
    const socket = await createClient();

    let roomCode, playerId;
    await new Promise((resolve) => {
      socket.emit('room:create', { nickname: 'Alice', settings: { category: 'Random' } }, (res) => {
        roomCode = res.roomCode;
        playerId = res.playerId;
        resolve();
      });
    });

    const tokenRes = await new Promise((resolve) => {
      socket.emit('voice:get_token', { roomCode, playerId }, resolve);
    });

    assert.equal(tokenRes.success, true);
    assert.ok(tokenRes.token);
    assert.equal(tokenRes.roomName, `undercover_${roomCode}`);

    // Verify claims inside JWT
    const claims = await verifier.verify(tokenRes.token);
    assert.equal(claims.sub, playerId);
    assert.equal(claims.name, 'Alice');
    assert.equal(claims.video.room, `undercover_${roomCode}`);
    assert.equal(claims.video.roomJoin, true);
    assert.equal(claims.video.canPublish, true);
    assert.equal(claims.video.canSubscribe, true);

    socket.close();
  });

  await t.test('2. Strict rejection if player is not in the room', async () => {
    const socket = await createClient();

    let roomCode;
    await new Promise((resolve) => {
      socket.emit('room:create', { nickname: 'Bob', settings: { category: 'Random' } }, (res) => {
        roomCode = res.roomCode;
        resolve();
      });
    });

    const tokenRes = await new Promise((resolve) => {
      socket.emit('voice:get_token', { roomCode, playerId: 'fake-intruder-id' }, resolve);
    });

    assert.equal(tokenRes.success, false);
    assert.match(tokenRes.error, /Player not found/);

    socket.close();
  });

  await t.test('3. Room Isolation: Multiple rooms have distinct, segregated room claims', async () => {
    const socketA = await createClient();
    const socketB = await createClient();

    let roomCodeA, playerA;
    let roomCodeB, playerB;

    await new Promise((resolve) => {
      socketA.emit('room:create', { nickname: 'Alice', settings: { category: 'Random' } }, (res) => {
        roomCodeA = res.roomCode;
        playerA = res.playerId;
        resolve();
      });
    });

    await new Promise((resolve) => {
      socketB.emit('room:create', { nickname: 'Charlie', settings: { category: 'Random' } }, (res) => {
        roomCodeB = res.roomCode;
        playerB = res.playerId;
        resolve();
      });
    });

    const resA = await new Promise((resolve) => {
      socketA.emit('voice:get_token', { roomCode: roomCodeA, playerId: playerA }, resolve);
    });

    const resB = await new Promise((resolve) => {
      socketB.emit('voice:get_token', { roomCode: roomCodeB, playerId: playerB }, resolve);
    });

    assert.notEqual(roomCodeA, roomCodeB);
    assert.equal(resA.roomName, `undercover_${roomCodeA}`);
    assert.equal(resB.roomName, `undercover_${roomCodeB}`);

    const claimsA = await verifier.verify(resA.token);
    const claimsB = await verifier.verify(resB.token);

    assert.equal(claimsA.video.room, `undercover_${roomCodeA}`);
    assert.equal(claimsB.video.room, `undercover_${roomCodeB}`);
    assert.notEqual(claimsA.video.room, claimsB.video.room, 'Rooms must have separate isolated LiveKit room targets');

    socketA.close();
    socketB.close();
  });

  clearInterval(roomManager.cleanupInterval);
  await new Promise((r) => io.close(r));
});
