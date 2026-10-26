/**
 * Validation and sanitization utilities for Undercover.
 */

export function sanitizeString(str, maxLength = 30) {
  if (typeof str !== 'string') return '';
  return str
    .trim()
    .replace(/[<>'"&]/g, '') // Strip XSS characters
    .slice(0, maxLength);
}

export function validateNickname(nickname, existingPlayers = []) {
  const clean = sanitizeString(nickname, 20);
  if (!clean || clean.length < 2) {
    return { valid: false, error: 'Nickname must be at least 2 characters.' };
  }
  if (clean.length > 16) {
    return { valid: false, error: 'Nickname cannot exceed 16 characters.' };
  }

  // Check duplicate ignoring case
  const lower = clean.toLowerCase();
  const duplicate = existingPlayers.some(p => p.nickname && p.nickname.toLowerCase() === lower);
  if (duplicate) {
    return { valid: false, error: 'This nickname is already taken in this room.' };
  }

  return { valid: true, nickname: clean };
}

export function validateRoomSettings(settings = {}) {
  const maxPlayers = parseInt(settings.maxPlayers, 10) || 6;
  if (maxPlayers < 3 || maxPlayers > 6) {
    return { valid: false, error: 'Player capacity must be between 3 and 6.' };
  }

  const undercoverCount = parseInt(settings.undercoverCount, 10) || 1;
  if (maxPlayers <= 4 && undercoverCount !== 1) {
    return { valid: false, error: 'For 3-4 players, exactly 1 Undercover is required.' };
  }
  if (maxPlayers >= 5 && (undercoverCount < 1 || undercoverCount > 2)) {
    return { valid: false, error: 'For 5-6 players, select 1 or 2 Undercovers.' };
  }

  const category = sanitizeString(settings.category || 'Random', 20);

  return {
    valid: true,
    settings: {
      maxPlayers,
      undercoverCount,
      category,
      discussionDuration: parseInt(settings.discussionDuration, 10) || 45
    }
  };
}

export function validateClue(clue) {
  const clean = sanitizeString(clue, 60);
  if (!clean || clean.length < 1) {
    return { valid: false, error: 'Clue cannot be empty.' };
  }
  return { valid: true, clue: clean };
}

export function validateVote(voterId, targetId, activePlayers = []) {
  if (!voterId || !targetId) {
    return { valid: false, error: 'Invalid vote parameters.' };
  }

  if (voterId === targetId) {
    return { valid: false, error: 'You cannot vote for yourself!' };
  }

  const voter = activePlayers.find(p => p.id === voterId && p.isAlive);
  if (!voter) {
    return { valid: false, error: 'Only active, living players can vote.' };
  }

  const target = activePlayers.find(p => p.id === targetId && p.isAlive);
  if (!target) {
    return { valid: false, error: 'You can only vote for active, living players.' };
  }

  return { valid: true };
}
