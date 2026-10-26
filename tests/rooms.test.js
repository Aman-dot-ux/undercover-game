import test from 'node:test';
import assert from 'node:assert/strict';
import { RoomManager } from '../src/server/rooms.js';

test('RoomManager - Lifecycle, Joining, Reconnection & Host Migration', async (t) => {
  const rm = new RoomManager();

  let roomCode;
  let hostPlayerId;
  let hostToken;

  await t.test('1. Create room generates 4-letter code and assigns host', () => {
    const res = rm.createRoom('HostDetective', { maxPlayers: 4, category: 'Food' });
    assert.equal(res.success, true);
    assert.ok(res.roomCode);
    assert.equal(res.roomCode.length, 4);
    assert.ok(res.sessionToken);

    roomCode = res.roomCode;
    hostPlayerId = res.playerId;
    hostToken = res.sessionToken;

    const room = rm.getRoom(roomCode);
    assert.equal(room.players.length, 1);
    assert.equal(room.players[0].isHost, true);
    assert.equal(room.players[0].isReady, true);
  });

  await t.test('2. Join room validates nicknames and prevents duplicates', () => {
    // Duplicate nickname
    const dupRes = rm.joinRoom(roomCode, 'HostDetective');
    assert.equal(dupRes.success, false);
    assert.ok(dupRes.error.includes('already taken'));

    // Valid nickname
    const joinRes = rm.joinRoom(roomCode, 'PlayerTwo');
    assert.equal(joinRes.success, true);
    assert.equal(joinRes.room.players.length, 2);

    // Join until limit (maxPlayers = 4)
    rm.joinRoom(roomCode, 'PlayerThree');
    rm.joinRoom(roomCode, 'PlayerFour');
    assert.equal(rm.getRoom(roomCode).players.length, 4);

    // Exceed capacity
    const overflowRes = rm.joinRoom(roomCode, 'PlayerFive');
    assert.equal(overflowRes.success, false);
    assert.ok(overflowRes.error.includes('full'));
  });

  await t.test('3. Reconnect player restores session with valid sessionToken', () => {
    const fakeSocketId = 'socket_123';
    const recRes = rm.reconnectPlayer(roomCode, hostToken, fakeSocketId);

    assert.equal(recRes.success, true);
    assert.equal(recRes.player.id, hostPlayerId);
    assert.equal(recRes.player.socketId, fakeSocketId);
    assert.equal(recRes.player.connected, true);

    // Invalid token rejected
    const invalidRec = rm.reconnectPlayer(roomCode, 'invalid_token_999', 'socket_456');
    assert.equal(invalidRec.success, false);
  });

  await t.test('4. Disconnect and Host migration transfers host role', () => {
    const room = rm.getRoom(roomCode);
    const host = room.players[0];
    const secondPlayer = room.players[1];

    // Bind sockets so disconnect works
    rm.bindSocket(roomCode, host.id, 'host_sock');
    rm.bindSocket(roomCode, secondPlayer.id, 'second_sock');

    // Simulate host disconnect
    rm.handleDisconnect('host_sock');

    assert.equal(host.connected, false);
    // Host should migrate to connected player
    assert.equal(room.hostId, secondPlayer.id);
    assert.equal(secondPlayer.isHost, true);
  });

  clearInterval(rm.cleanupInterval);
});
