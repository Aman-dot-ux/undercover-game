import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RoomManager } from '../src/server/rooms.js';
import { validateNickname, validateRoomSettings, validateClue, validateVote, sanitizeString } from '../src/server/validation.js';
import { GameEngine, PHASES } from '../src/game/engine.js';

test('Audit Phase 2: Functional Testing & Boundary Validation', async (t) => {
  const roomManager = new RoomManager();

  await t.test('1. Nickname Boundary & XSS Sanitization', () => {
    // 1 char -> invalid
    const r1 = validateNickname('A');
    assert.strictEqual(r1.valid, false, '1-character nickname must be rejected');

    // 2 chars -> valid
    const r2 = validateNickname('Bo');
    assert.strictEqual(r2.valid, true, '2-character nickname must be accepted');
    assert.strictEqual(r2.nickname, 'Bo');

    // 16 chars -> valid
    const r16 = validateNickname('1234567890123456');
    assert.strictEqual(r16.valid, true, '16-character nickname must be accepted');

    // XSS injection sanitization test
    const cleanXss = sanitizeString('<script>alert("hack")</script>');
    assert.strictEqual(cleanXss.includes('<'), false);
    assert.strictEqual(cleanXss.includes('>'), false);
    assert.strictEqual(cleanXss.includes('"'), false);

    // Duplicate nickname case-insensitive
    const existing = [{ id: '1', nickname: 'Alice' }];
    const rdup = validateNickname('alice', existing);
    assert.strictEqual(rdup.valid, false, 'Duplicate nickname (case-insensitive) must be rejected');

    // Long string 10,000 characters
    const longNick = 'A'.repeat(10000);
    const rlong = validateNickname(longNick);
    assert.strictEqual(rlong.valid, false, 'Overly long nickname must be rejected (> 16 chars)');
  });

  await t.test('2. Room Settings Validation & Rules Enforcement', () => {
    // Capacity limits: min 3, max 6
    assert.strictEqual(validateRoomSettings({ maxPlayers: 2 }).valid, false, 'Capacity 2 must be rejected');
    assert.strictEqual(validateRoomSettings({ maxPlayers: 7 }).valid, false, 'Capacity 7 must be rejected');
    assert.strictEqual(validateRoomSettings({ maxPlayers: 3, undercoverCount: 1 }).valid, true);
    assert.strictEqual(validateRoomSettings({ maxPlayers: 6, undercoverCount: 2 }).valid, true);

    // Undercover count limits for small rooms
    assert.strictEqual(
      validateRoomSettings({ maxPlayers: 3, undercoverCount: 2 }).valid,
      false,
      '3 players cannot have 2 undercovers'
    );
    assert.strictEqual(
      validateRoomSettings({ maxPlayers: 4, undercoverCount: 2 }).valid,
      false,
      '4 players cannot have 2 undercovers'
    );
    assert.strictEqual(
      validateRoomSettings({ maxPlayers: 5, undercoverCount: 2 }).valid,
      true,
      '5 players can have 2 undercovers'
    );
  });

  await t.test('3. Clue Submission Validation', () => {
    // Empty clue
    assert.strictEqual(validateClue('').valid, false, 'Empty clue must be rejected');
    assert.strictEqual(validateClue('   ').valid, false, 'Whitespace clue must be rejected');

    // Valid clue
    const vClue = validateClue('It is sweet and yellow');
    assert.strictEqual(vClue.valid, true);
    assert.strictEqual(vClue.clue, 'It is sweet and yellow');

    // XSS clue
    const xssClue = validateClue('<b>bold</b> clue');
    assert.strictEqual(xssClue.valid, true);
    assert.strictEqual(xssClue.clue.includes('<'), false);
    assert.strictEqual(xssClue.clue.includes('>'), false);
  });

  await t.test('4. Voting Validation Boundaries', () => {
    const players = [
      { id: 'p1', nickname: 'Alice', isAlive: true },
      { id: 'p2', nickname: 'Bob', isAlive: true },
      { id: 'p3', nickname: 'Charlie', isAlive: false }
    ];

    // Self-vote
    const selfVote = validateVote('p1', 'p1', players);
    assert.strictEqual(selfVote.valid, false, 'Self-vote must be rejected');

    // Voting for dead player
    const deadVote = validateVote('p1', 'p3', players);
    assert.strictEqual(deadVote.valid, false, 'Voting for dead player must be rejected');

    // Dead player voting
    const deadVoter = validateVote('p3', 'p2', players);
    assert.strictEqual(deadVoter.valid, false, 'Dead player voting must be rejected');

    // Valid vote
    const validVote = validateVote('p1', 'p2', players);
    assert.strictEqual(validVote.valid, true, 'Living player voting for another living player must be valid');
  });

  await t.test('5. Host Migration and Room Leave Lifecycle', () => {
    const room = roomManager.createRoom('HostPlayer');
    assert.ok(room.success);
    const roomCode = room.roomCode;
    const p1Id = room.playerId;

    // Add Player 2
    const p2Res = roomManager.joinRoom(roomCode, 'Player2');
    assert.ok(p2Res.success);
    const p2Id = p2Res.playerId;

    // Add Player 3
    const p3Res = roomManager.joinRoom(roomCode, 'Player3');
    assert.ok(p3Res.success);
    const p3Id = p3Res.playerId;

    const rObj = roomManager.getRoom(roomCode);
    assert.strictEqual(rObj.players.length, 3);
    assert.strictEqual(rObj.hostId, p1Id);

    // Host leaves: verify host migration
    const leaveRes = roomManager.removePlayer(roomCode, p1Id);
    assert.strictEqual(leaveRes, true);
    assert.strictEqual(rObj.players.length, 2);
    assert.strictEqual(rObj.hostId, p2Id, 'Host must migrate to Player 2');
    assert.strictEqual(rObj.players[0].isHost, true);

    // Remaining players leave: verify room cleanup when empty
    roomManager.removePlayer(roomCode, p2Id);
    roomManager.removePlayer(roomCode, p3Id);
    assert.strictEqual(rObj.players.length, 0);
  });

  clearInterval(roomManager.cleanupInterval);
});
