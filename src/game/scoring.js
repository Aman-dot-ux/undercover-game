/**
 * Server-authoritative scoring system for Undercover.
 * Tracks scores across rounds, awards bonuses, prevents duplicate scoring.
 */

export const SCORE_RULES = {
  CIVILIAN_WIN: 100,         // Points awarded to all civilians on civilian team victory
  UNDERCOVER_WIN: 150,       // Points awarded to all undercovers on undercover team victory
  CIVILIAN_CORRECT_VOTE: 25, // Bonus to civilians who voted for an eliminated Undercover
  UNDERCOVER_SURVIVAL_BONUS: 50 // Bonus to Undercover if they survived until the end
};

export class ScoreManager {
  constructor() {
    this.scores = new Map(); // playerId -> score
    this.roundStats = [];
  }

  initPlayer(playerId) {
    if (!this.scores.has(playerId)) {
      this.scores.set(playerId, 0);
    }
  }

  removePlayer(playerId) {
    this.scores.delete(playerId);
  }

  getScore(playerId) {
    return this.scores.get(playerId) || 0;
  }

  getLeaderboard(players) {
    return players.map(p => ({
      id: p.id,
      nickname: p.nickname,
      score: this.getScore(p.id)
    })).sort((a, b) => b.score - a.score);
  }

  calculateRoundScores({
    winnerTeam,
    players,
    eliminatedPlayers,
    voteHistory,
    wordPair
  }) {
    const roundAwards = new Map();

    for (const player of players) {
      roundAwards.set(player.id, {
        base: 0,
        bonus: 0,
        total: 0,
        reasons: []
      });
    }

    const undercovers = players.filter(p => p.role === 'undercover');
    const civilians = players.filter(p => p.role === 'civilian');

    if (winnerTeam === 'civilian') {
      for (const civ of civilians) {
        const award = roundAwards.get(civ.id);
        award.base += SCORE_RULES.CIVILIAN_WIN;
        award.reasons.push(`Civilian Victory (+${SCORE_RULES.CIVILIAN_WIN})`);
      }
    } else if (winnerTeam === 'undercover') {
      for (const und of undercovers) {
        const award = roundAwards.get(und.id);
        award.base += SCORE_RULES.UNDERCOVER_WIN;
        award.reasons.push(`Undercover Victory (+${SCORE_RULES.UNDERCOVER_WIN})`);

        if (und.isAlive) {
          award.bonus += SCORE_RULES.UNDERCOVER_SURVIVAL_BONUS;
          award.reasons.push(`Survival Bonus (+${SCORE_RULES.UNDERCOVER_SURVIVAL_BONUS})`);
        }
      }
    }

    // Award bonus to civilians who voted for eliminated Undercover
    if (voteHistory && voteHistory.length > 0) {
      for (const roundVotes of voteHistory) {
        const eliminatedId = roundVotes.eliminatedId;
        const eliminatedPlayer = players.find(p => p.id === eliminatedId);

        if (eliminatedPlayer && eliminatedPlayer.role === 'undercover') {
          for (const [voterId, targetId] of Object.entries(roundVotes.votes || {})) {
            const voter = players.find(p => p.id === voterId);
            if (voter && voter.role === 'civilian' && targetId === eliminatedId) {
              const award = roundAwards.get(voterId);
              if (award) {
                award.bonus += SCORE_RULES.CIVILIAN_CORRECT_VOTE;
                award.reasons.push(`Identified Undercover (+${SCORE_RULES.CIVILIAN_CORRECT_VOTE})`);
              }
            }
          }
        }
      }
    }

    // Apply awards to cumulative scores
    for (const [playerId, award] of roundAwards.entries()) {
      award.total = award.base + award.bonus;
      const current = this.getScore(playerId);
      this.scores.set(playerId, current + award.total);
    }

    const summary = {
      winnerTeam,
      wordPair,
      awards: Object.fromEntries(roundAwards)
    };

    this.roundStats.push(summary);
    return summary;
  }

  resetAll() {
    this.scores.clear();
    this.roundStats = [];
  }
}
