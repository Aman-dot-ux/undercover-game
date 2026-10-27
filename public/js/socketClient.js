/**
 * Socket.IO client interface for Undercover.
 * Uses relative window origin to seamlessly support LAN connections.
 */

class SocketClient {
  constructor() {
    this.socket = null;
    this.connected = false;
    this.roomCode = sessionStorage.getItem('undercover_room_code') || null;
    this.playerId = sessionStorage.getItem('undercover_player_id') || null;
    this.sessionToken = sessionStorage.getItem('undercover_session_token') || null;
    this.nickname = sessionStorage.getItem('undercover_nickname') || null;
    this.isHost = false;
  }

  init(onConnectCallback) {
    // Relative connection to current page's host and port with low-latency settings
    this.socket = io(window.location.origin, {
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 2000,
      timeout: 10000,
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('Connected to Undercover server via', window.location.origin);

      // Attempt immediate sync/reconnect if credentials exist in sessionStorage
      if (this.roomCode && this.sessionToken) {
        this.syncState();
      }

      if (onConnectCallback) onConnectCallback();
    });

    this.socket.on('disconnect', (reason) => {
      this.connected = false;
      console.log('Disconnected from Undercover server:', reason);
      if (reason === 'io server disconnect') {
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('Socket connection error:', err.message);
    });

    // Auto-resync when browser tab becomes active, phone wakes up, or comes back online
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.roomCode && this.sessionToken) {
        this.syncState();
      }
    });

    window.addEventListener('focus', () => {
      if (this.roomCode && this.sessionToken) {
        this.syncState();
      }
    });

    window.addEventListener('online', () => {
      if (this.roomCode && this.sessionToken) {
        this.syncState();
      }
    });
  }

  saveSession(roomCode, playerId, sessionToken, nickname, isHost = false) {
    this.roomCode = roomCode;
    this.playerId = playerId;
    this.sessionToken = sessionToken;
    this.nickname = nickname;
    this.isHost = isHost;

    sessionStorage.setItem('undercover_room_code', roomCode);
    sessionStorage.setItem('undercover_player_id', playerId);
    sessionStorage.setItem('undercover_session_token', sessionToken);
    sessionStorage.setItem('undercover_nickname', nickname);
  }

  clearSession() {
    this.roomCode = null;
    this.playerId = null;
    this.sessionToken = null;
    this.nickname = null;
    this.isHost = false;

    sessionStorage.removeItem('undercover_room_code');
    sessionStorage.removeItem('undercover_player_id');
    sessionStorage.removeItem('undercover_session_token');
    sessionStorage.removeItem('undercover_nickname');
  }

  reconnect() {
    this.syncState();
  }

  syncState(callback) {
    if (!this.roomCode || !this.sessionToken) return;

    if (!this.connected && this.socket) {
      this.socket.connect();
    }

    this.socket.emit('room:sync', {
      roomCode: this.roomCode,
      sessionToken: this.sessionToken
    }, (res) => {
      if (res && res.success) {
        this.isHost = res.isHost;
        console.log('[SYNC] Room', this.roomCode, 'state synced.');
      } else if (res && !res.success) {
        console.log('Previous session expired:', res.error);
        this.clearSession();
      }
      if (callback) callback(res);
    });
  }

  // Socket wrappers
  createRoom(nickname, settings, callback) {
    this.socket.emit('room:create', { nickname, settings }, (res) => {
      if (res && res.success) {
        this.saveSession(res.roomCode, res.playerId, res.sessionToken, nickname, true);
      }
      callback(res);
    });
  }

  joinRoom(roomCode, nickname, callback) {
    this.socket.emit('room:join', { roomCode, nickname }, (res) => {
      if (res && res.success) {
        this.saveSession(res.roomCode, res.playerId, res.sessionToken, nickname, false);
      }
      callback(res);
    });
  }

  toggleReady() {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('room:toggle_ready', {
      roomCode: this.roomCode,
      playerId: this.playerId
    });
  }

  updateSettings(settings, callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('room:update_settings', {
      roomCode: this.roomCode,
      playerId: this.playerId,
      settings
    }, callback);
  }

  kickPlayer(targetPlayerId) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('room:kick_player', {
      roomCode: this.roomCode,
      hostId: this.playerId,
      targetPlayerId
    });
  }

  startGame(callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:start', {
      roomCode: this.roomCode,
      hostId: this.playerId
    }, callback);
  }

  readyForClues() {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:player_ready_for_clues', {
      roomCode: this.roomCode,
      playerId: this.playerId
    });
  }

  submitClue(clueText, callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:submit_clue', {
      roomCode: this.roomCode,
      playerId: this.playerId,
      clueText
    }, callback);
  }

  startVotingEarly(callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:start_voting', {
      roomCode: this.roomCode,
      hostId: this.playerId
    }, callback);
  }

  submitVote(targetId, callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:submit_vote', {
      roomCode: this.roomCode,
      voterId: this.playerId,
      targetId
    }, callback);
  }

  closeVoting(callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:close_voting', {
      roomCode: this.roomCode,
      hostId: this.playerId
    }, callback);
  }

  continueRound() {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:continue_round', {
      roomCode: this.roomCode,
      hostId: this.playerId
    });
  }

  nextMatch(callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:next_match', {
      roomCode: this.roomCode,
      hostId: this.playerId
    }, callback);
  }

  startTieRevote() {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:start_tie_revote', {
      roomCode: this.roomCode,
      hostId: this.playerId
    });
  }

  restartMatch(callback) {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:restart_match', {
      roomCode: this.roomCode,
      hostId: this.playerId
    }, callback);
  }

  returnToLobby() {
    if (!this.roomCode || !this.playerId) return;
    this.socket.emit('game:return_to_lobby', {
      roomCode: this.roomCode,
      hostId: this.playerId
    });
  }
}

export const client = new SocketClient();
