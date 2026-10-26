import test from 'node:test';
import assert from 'node:assert/strict';
import { GameEngine, PHASES } from '../src/game/engine.js';
import { ScoreManager } from '../src/game/scoring.js';

test('GameEngine - Full Match Flow & State Transitions', async (t) => {
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
    { id: 'p1', nickname: 'Alice' },
    { id: 'p2', nickname: 'Bob' },
    { id: 'p3', nickname: 'Charlie' }
  ];

  players.forEach(p => scoreManager.initPlayer(p.id));

  await t.test('1. Start round initializes roles and secret words', () => {
    const state = engine.startNewRound(players, dummyRoom.settings);

    assert.equal(engine.phase, PHASES.ROLE_REVEAL);
    assert.equal(engine.players.length, 3);
    assert.ok(engine.wordPair);

    // Verify 1 Undercover and 2 Civilians
    const undercovers = engine.players.filter(p => p.role === 'undercover');
    const civilians = engine.players.filter(p => p.role === 'civilian');
    assert.equal(undercovers.length, 1);
    assert.equal(civilians.length, 2);

    // Verify secret words correspond to role
    undercovers.forEach(u => assert.equal(u.word, engine.wordPair.undercover));
    civilians.forEach(c => assert.equal(c.word, engine.wordPair.civilian));

    // Public state must NOT contain roles during role_reveal
    assert.equal(state.revealedRoles, null);
    assert.equal(state.revealedWordPair, null);
  });

  await t.test('2. Player ready transitions to clue round when all ready', () => {
    engine.playerReadyForClues('p1');
    assert.equal(engine.phase, PHASES.ROLE_REVEAL);

    engine.playerReadyForClues('p2');
    assert.equal(engine.phase, PHASES.ROLE_REVEAL);

    engine.playerReadyForClues('p3');
    assert.equal(engine.phase, PHASES.CLUE_ROUND);
    assert.equal(engine.turnOrder.length, 3);
    assert.equal(engine.currentTurnIndex, 0);
  });

  await t.test('3. Clue submissions advance turns in order', () => {
    const firstPlayerId = engine.turnOrder[0];
    const secondPlayerId = engine.turnOrder[1];
    const thirdPlayerId = engine.turnOrder[2];

    // Non-turn player cannot submit
    const invalidSubmit = engine.submitClue(secondPlayerId, 'Too early');
    assert.equal(invalidSubmit.success, false);

    // Turn 1
    const res1 = engine.submitClue(firstPlayerId, 'Sweet and juicy');
    assert.equal(res1.success, true);
    assert.equal(engine.currentTurnIndex, 1);

    // Turn 2
    const res2 = engine.submitClue(secondPlayerId, 'Tropical fruit');
    assert.equal(res2.success, true);
    assert.equal(engine.currentTurnIndex, 2);

    // Turn 3 - Final submission triggers discussion
    const res3 = engine.submitClue(thirdPlayerId, 'Orange inside');
    assert.equal(res3.success, true);
    assert.equal(engine.phase, PHASES.DISCUSSION);
    assert.equal(engine.discussionRemaining, 30);
  });

  await t.test('4. Voting handles validation and self-vote rejection', () => {
    engine.beginVoting(false, []);
    assert.equal(engine.phase, PHASES.VOTING);

    // Self vote should be rejected
    const selfVote = engine.submitVote('p1', 'p1');
    assert.equal(selfVote.success, false);

    // Valid vote
    const vote1 = engine.submitVote('p1', 'p2');
    assert.equal(vote1.success, true);
    assert.equal(vote1.allVoted, false);
  });

  await t.test('5. Voting resolution eliminates candidate with most votes', () => {
    // p1 voted for p2
    // Let p2 vote for p3, p3 vote for p2 -> p2 has 2 votes, p3 has 1 vote
    engine.submitVote('p2', 'p3');
    const finalVote = engine.submitVote('p3', 'p2');
    assert.equal(finalVote.allVoted, true);

    const result = engine.resolveVoting();
    assert.equal(result.elimination.player.id, 'p2');
    assert.equal(engine.players.find(p => p.id === 'p2').isAlive, false);
  });

  await t.test('6. Tie vote detection triggers revote', () => {
    // Reset round with 4 players
    const fourPlayers = [
      { id: 'a', nickname: 'A' },
      { id: 'b', nickname: 'B' },
      { id: 'c', nickname: 'C' },
      { id: 'd', nickname: 'D' }
    ];
    fourPlayers.forEach(p => scoreManager.initPlayer(p.id));

    engine.startNewRound(fourPlayers, dummyRoom.settings);
    engine.beginVoting(false, []);

    // 2 votes for 'a', 2 votes for 'b'
    engine.submitVote('a', 'b');
    engine.submitVote('c', 'b');
    engine.submitVote('b', 'a');
    engine.submitVote('d', 'a');

    const tieResult = engine.resolveVoting();
    assert.equal(tieResult.tie, true);
    assert.equal(tieResult.needsRevote, true);
    assert.deepEqual(tieResult.tiedIds.sort(), ['a', 'b']);
    assert.equal(engine.lastElimination.needsRevote, true);
  });

  await t.test('7. Tie Revote restricts candidate targets to tied suspects only', () => {
    // Start revote between 'a' and 'b'
    engine.beginVoting(true, ['a', 'b']);
    assert.equal(engine.phase, PHASES.VOTING);
    assert.equal(engine.isTieRevote, true);

    // Voting for non-tied candidate 'c' must be rejected
    const invalidVote = engine.submitVote('d', 'c');
    assert.equal(invalidVote.success, false);
    assert.ok(invalidVote.error.includes('tied'));

    // Valid vote for tied candidate 'a'
    const validVote = engine.submitVote('d', 'a');
    assert.equal(validVote.success, true);
  });

  await t.test('8. Double tie in a row applies deterministic tiebreaker and eliminates one', () => {
    // Revote: 2 votes for 'a', 2 votes for 'b'
    engine.beginVoting(true, ['a', 'b']);
    engine.submitVote('a', 'b');
    engine.submitVote('c', 'b');
    engine.submitVote('b', 'a');
    engine.submitVote('d', 'a');

    const doubleTieResult = engine.resolveVoting();
    // Second tie must eliminate one player with tiebreakerUsed: true
    assert.ok(doubleTieResult.elimination);
    assert.equal(doubleTieResult.elimination.tiebreakerUsed, true);
    assert.ok(['a', 'b'].includes(doubleTieResult.elimination.player.id));
  });

  await t.test('9. In-game match restart re-deals fresh words and resets state', () => {
    const freshState = engine.startNewRound(dummyRoom.settings ? [
      { id: 'p1', nickname: 'Alice' },
      { id: 'p2', nickname: 'Bob' },
      { id: 'p3', nickname: 'Charlie' }
    ] : [], dummyRoom.settings);

    assert.equal(engine.phase, PHASES.ROLE_REVEAL);
    assert.equal(engine.players.every(p => p.isAlive), true);
    assert.equal(engine.isTieRevote, false);
    assert.equal(engine.tiedPlayerIds.length, 0);
  });
});

