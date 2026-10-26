import crypto from 'crypto';
import { getRandomWordPair } from './wordPairs.js';
import { validateVote } from '../server/validation.js';

export const PHASES = {
  LOBBY: 'lobby',
  ROLE_REVEAL: 'role_reveal',
  CLUE_ROUND: 'clue_round',
  DISCUSSION: 'discussion',
  VOTING: 'voting',
  ELIMINATION: 'elimination',
  GAME_OVER: 'game_over'
};

/**
 * Fisher-Yates array shuffle using cryptographically secure random integers.
 */
function secureShuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class GameEngine {
  constructor(room, scoreManager) {
    this.room = room;
    this.scoreManager = scoreManager;
    this.phase = PHASES.LOBBY;
    this.roundNumber = 0;
    this.wordPair = null;
    this.usedPairs = new Set();
    
    // Players state in current game
    this.players = []; // { id, nickname, role, word, isAlive, readyForClues }
    
    // Clues state
    this.turnOrder = []; // array of playerIds
    this.currentTurnIndex = 0;
    this.clues = {}; // playerId -> clueText
    
    // Discussion timer
    this.discussionSeconds = 45;
    this.discussionTimer = null;
    this.discussionRemaining = 45;
    
    // Voting state
    this.votes = {}; // voterId -> targetId
    this.voteHistory = [];
    this.isTieRevote = false;
    this.tiedPlayerIds = [];
    
    // Elimination results
    this.lastElimination = null;
    this.winnerTeam = null;
    this.roundSummary = null;
  }

  /**
   * Start a new round of Undercover.
   */
  startNewRound(connectedPlayers, settings) {
    this.roundNumber += 1;
    this.phase = PHASES.ROLE_REVEAL;
    this.clues = {};
    this.votes = {};
    this.isTieRevote = false;
    this.tiedPlayerIds = [];
    this.lastElimination = null;
    this.winnerTeam = null;
    this.roundSummary = null;

    // Pick word pair
    this.wordPair = getRandomWordPair(settings.category || 'Random', this.usedPairs);
    this.usedPairs.add(this.wordPair.pairId);

    // Assign roles cryptographically
    const playerCount = connectedPlayers.length;
    let undercoverCount = settings.undercoverCount || 1;
    if (playerCount <= 4) undercoverCount = 1;
    if (playerCount >= 5 && undercoverCount > 2) undercoverCount = 2;

    const roles = Array(playerCount).fill('civilian');
    for (let i = 0; i < undercoverCount; i++) {
      roles[i] = 'undercover';
    }
    const shuffledRoles = secureShuffle(roles);

    this.players = connectedPlayers.map((p, idx) => {
      const role = shuffledRoles[idx];
      const word = role === 'undercover' ? this.wordPair.undercover : this.wordPair.civilian;
      return {
        id: p.id,
        nickname: p.nickname,
        role,
        word,
        isAlive: true,
        readyForClues: false
      };
    });

    return this.getPublicState();
  }

  /**
   * Player marks that they have read their role and are ready.
   */
  playerReadyForClues(playerId) {
    const player = this.players.find(p => p.id === playerId && p.isAlive);
    if (!player) return false;

    player.readyForClues = true;

    // If all alive players are ready, begin Clue Round
    const alivePlayers = this.players.filter(p => p.isAlive);
    const allReady = alivePlayers.every(p => p.readyForClues);
    if (allReady) {
      this.beginClueRound();
    }
    return true;
  }

  /**
   * Start clue round with a randomized turn order of living players.
   */
  beginClueRound() {
    this.phase = PHASES.CLUE_ROUND;
    const aliveIds = this.players.filter(p => p.isAlive).map(p => p.id);
    this.turnOrder = secureShuffle(aliveIds);
    this.currentTurnIndex = 0;
  }

  /**
   * Submit clue for current turn.
   */
  submitClue(playerId, clueText) {
    if (this.phase !== PHASES.CLUE_ROUND) {
      return { success: false, error: 'Not currently in clue round.' };
    }

    const currentTurnPlayerId = this.turnOrder[this.currentTurnIndex];
    if (playerId !== currentTurnPlayerId) {
      return { success: false, error: 'It is not your turn to give a clue.' };
    }

    if (this.clues[playerId]) {
      return { success: false, error: 'You have already submitted your clue.' };
    }

    this.clues[playerId] = clueText;
    this.currentTurnIndex += 1;

    // If everyone in turn order gave a clue, move to discussion
    if (this.currentTurnIndex >= this.turnOrder.length) {
      this.beginDiscussion();
    }

    return { success: true };
  }

  /**
   * Begin discussion phase with configurable timer.
   */
  beginDiscussion() {
    this.phase = PHASES.DISCUSSION;
    this.discussionRemaining = this.room.settings.discussionDuration || 45;
  }

  /**
   * Begin voting phase.
   */
  beginVoting(isRevote = false, tiedIds = []) {
    this.phase = PHASES.VOTING;
    this.votes = {};
    this.isTieRevote = isRevote;
    this.tiedPlayerIds = tiedIds;
  }

  /**
   * Submit a private vote.
   */
  submitVote(voterId, targetId) {
    if (this.phase !== PHASES.VOTING) {
      return { success: false, error: 'Voting is not active.' };
    }

    const validation = validateVote(voterId, targetId, this.players);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // If revote, target must be one of the tied players
    if (this.isTieRevote && this.tiedPlayerIds.length > 0) {
      if (!this.tiedPlayerIds.includes(targetId)) {
        return { success: false, error: 'In a revote, you must vote for one of the tied players.' };
      }
    }

    this.votes[voterId] = targetId;

    // Check if all alive players have voted
    const alivePlayers = this.players.filter(p => p.isAlive);
    const allVoted = alivePlayers.every(p => this.votes[p.id]);

    return { success: true, allVoted };
  }

  /**
   * Resolve votes, handle ties or elimination, and check win condition.
   */
  resolveVoting() {
    this.phase = PHASES.ELIMINATION;

    // Count votes
    const tally = {};
    for (const targetId of Object.values(this.votes)) {
      tally[targetId] = (tally[targetId] || 0) + 1;
    }

    // Determine highest vote count
    let maxVotes = 0;
    for (const count of Object.values(tally)) {
      if (count > maxVotes) {
        maxVotes = count;
      }
    }

    const candidatesWithMaxVotes = Object.keys(tally).filter(id => tally[id] === maxVotes);

    // Record voting history
    this.voteHistory.push({
      round: this.roundNumber,
      votes: { ...this.votes },
      tally: { ...tally },
      isTieRevote: this.isTieRevote
    });

    // Check for ties
    if (candidatesWithMaxVotes.length > 1) {
      if (!this.isTieRevote) {
        // First tie: trigger Revote among tied players
        this.lastElimination = {
          tie: true,
          tiedPlayers: candidatesWithMaxVotes.map(id => this.getPlayerInfo(id)),
          needsRevote: true,
          tiedIds: candidatesWithMaxVotes,
          tally,
          votes: { ...this.votes }
        };
        return { tie: true, tiedIds: candidatesWithMaxVotes, needsRevote: true };
      } else {
        // Second tie in a row: apply deterministic rule (random choice between tied players)
        const chosenIndex = crypto.randomInt(0, candidatesWithMaxVotes.length);
        const eliminatedId = candidatesWithMaxVotes[chosenIndex];
        return this.eliminatePlayer(eliminatedId, tally, true);
      }
    }

    // Single player with highest votes
    const eliminatedId = candidatesWithMaxVotes[0];
    return this.eliminatePlayer(eliminatedId, tally, false);
  }

  /**
   * Eliminate player, reveal their role, and assess win conditions.
   */
  eliminatePlayer(eliminatedId, tally, tiebreakerUsed = false) {
    const player = this.players.find(p => p.id === eliminatedId);
    if (!player) {
      return { error: 'Eliminated player not found.' };
    }

    player.isAlive = false;

    // Record last elimination details
    this.lastElimination = {
      tie: false,
      tiebreakerUsed,
      player: {
        id: player.id,
        nickname: player.nickname,
        role: player.role
      },
      tally,
      votes: { ...this.votes }
    };

    // Store in latest vote history item
    if (this.voteHistory.length > 0) {
      this.voteHistory[this.voteHistory.length - 1].eliminatedId = eliminatedId;
    }

    // Check Win Conditions
    const aliveUndercovers = this.players.filter(p => p.role === 'undercover' && p.isAlive).length;
    const aliveCivilians = this.players.filter(p => p.role === 'civilian' && p.isAlive).length;

    let gameOver = false;
    if (aliveUndercovers === 0) {
      // Civilians eliminate all Undercovers!
      this.winnerTeam = 'civilian';
      gameOver = true;
    } else if (aliveUndercovers >= aliveCivilians) {
      // Undercover equals or exceeds civilians!
      this.winnerTeam = 'undercover';
      gameOver = true;
    }

    if (gameOver) {
      this.phase = PHASES.GAME_OVER;
      this.roundSummary = this.scoreManager.calculateRoundScores({
        winnerTeam: this.winnerTeam,
        players: this.players,
        eliminatedPlayers: this.players.filter(p => !p.isAlive),
        voteHistory: this.voteHistory,
        wordPair: this.wordPair
      });
      return { gameOver: true, winnerTeam: this.winnerTeam, elimination: this.lastElimination };
    }

    return { gameOver: false, elimination: this.lastElimination };
  }

  /**
   * Reset the game back to lobby while retaining player scores.
   */
  returnToLobby() {
    this.phase = PHASES.LOBBY;
    this.players = [];
    this.wordPair = null;
    this.clues = {};
    this.votes = {};
    this.lastElimination = null;
    this.winnerTeam = null;
  }

  /**
   * Helper to fetch safe player info.
   */
  getPlayerInfo(playerId) {
    const p = this.players.find(player => player.id === playerId);
    return p ? { id: p.id, nickname: p.nickname } : null;
  }

  /**
   * Public state broadcast to all room members.
   * STRICT SECURITY: NEVER includes private roles, secret words, or hidden votes.
   */
  getPublicState() {
    return {
      phase: this.phase,
      roundNumber: this.roundNumber,
      category: this.wordPair ? this.wordPair.category : (this.room.settings.category || 'Random'),
      players: this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        isAlive: p.isAlive,
        readyForClues: p.readyForClues,
        hasVoted: Boolean(this.votes[p.id]),
        hasGivenClue: Boolean(this.clues[p.id])
      })),
      turnOrder: this.turnOrder,
      currentTurnPlayerId: this.turnOrder[this.currentTurnIndex] || null,
      clues: this.clues,
      discussionRemaining: this.discussionRemaining,
      isTieRevote: this.isTieRevote,
      tiedPlayerIds: this.tiedPlayerIds,
      lastElimination: this.lastElimination,
      winnerTeam: this.winnerTeam,
      // Full roles/words are only disclosed in game_over phase!
      revealedRoles: this.phase === PHASES.GAME_OVER ? this.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        role: p.role,
        word: p.word
      })) : null,
      revealedWordPair: this.phase === PHASES.GAME_OVER ? this.wordPair : null,
      roundSummary: this.roundSummary,
      leaderboard: this.scoreManager.getLeaderboard(this.players)
    };
  }

  /**
   * Private state sent exclusively to a single player.
   */
  getPrivatePlayerState(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    return {
      playerId: player.id,
      nickname: player.nickname,
      role: player.role,
      word: player.word,
      isAlive: player.isAlive,
      readyForClues: player.readyForClues
    };
  }
}
