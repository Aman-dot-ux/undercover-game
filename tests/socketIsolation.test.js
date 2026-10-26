import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, PHASES } from '../src/game/engine.js';
import { ScoreManager } from '../src/game/scoring.js';
import { RoomManager } from '../src/server/rooms.js';

test('Security & Zero-Leak Isolation Tests', async (t) => {
  const dummyRoom = {
    settings: {
      category: 'Food',
      undercoverCount: 1,
      discussionDuration: 30,
      maxPlayers: 6
    }
  };

  const scoreManager = new ScoreManager();
  const engine = new GameEngine(dummyRoom, scoreManager);

  const players = [
    { id: 'u1', nickname: 'Alpha' },
    { id: 'u2', nickname: 'Bravo' },
    { id: 'u3', nickname: 'Charlie' }
  ];

  players.forEach(p => scoreManager.initPlayer(p.id));
  engine.startNewRound(players, dummyRoom.settings);

  await t.test('1. Public state during ROLE_REVEAL does NOT contain roles or words', () => {
    const publicState = engine.getPublicState();
    assert.equal(publicState.revealedRoles, null);
    assert.equal(publicState.revealedWordPair, null);

    // Ensure player objects in publicState do not leak role or word
    publicState.players.forEach(p => {
      assert.equal(p.role, undefined, 'Player object must not contain role in public state');
      assert.equal(p.word, undefined, 'Player object must not contain word in public state');
    });
  });

  await t.test('2. Public state during CLUE_ROUND, DISCUSSION, and VOTING never leaks secrets', () => {
    engine.playerReadyForClues('u1');
    engine.playerReadyForClues('u2');
    engine.playerReadyForClues('u3');

    // Clue Round
    let pub = engine.getPublicState();
    assert.equal(pub.revealedRoles, null);
    assert.equal(pub.revealedWordPair, null);

    // Advance to voting
    engine.beginVoting(false, []);
    pub = engine.getPublicState();
    assert.equal(pub.revealedRoles, null);
    assert.equal(pub.revealedWordPair, null);

    // Votes in public state are masked as hasVoted boolean only, NOT the target
    pub.players.forEach(p => {
      assert.equal(typeof p.hasVoted, 'boolean');
      assert.equal(p.targetVote, undefined);
    });
  });

  await t.test('3. Private state is ONLY accessible via individual player ID query', () => {
    const p1State = engine.getPrivatePlayerState('u1');
    assert.ok(p1State);
    assert.ok(p1State.role === 'civilian' || p1State.role === 'undercover');
    assert.ok(p1State.word);

    // Non-existent player ID returns null
    assert.equal(engine.getPrivatePlayerState('intruder_id'), null);
  });

  await t.test('4. Lobby state NEVER contains secret roles or words', () => {
    const rm = new RoomManager();
    const created = rm.createRoom('HostPlayer');
    rm.joinRoom(created.roomCode, 'GuestPlayer');

    const lobby = rm.getLobbyState(created.roomCode);
    assert.equal(lobby.players.length, 2);
    lobby.players.forEach(p => {
      assert.equal(p.role, undefined);
      assert.equal(p.word, undefined);
    });
    clearInterval(rm.cleanupInterval);
  });
});
