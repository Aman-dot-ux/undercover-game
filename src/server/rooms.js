import crypto from 'crypto';
import { GameEngine, PHASES } from '../game/engine.js';
import { ScoreManager } from '../game/scoring.js';
import { validateNickname, validateRoomSettings } from './validation.js';

export class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomCode -> Room
    this.socketToRoom = new Map(); // socketId -> { roomCode, playerId }
    this.cleanupInterval = setInterval(() => this.cleanupAbandonedRooms(), 60000);
  }

  generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[crypto.randomInt(0, chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(hostNickname, settings = {}) {
    const nickCheck = validateNickname(hostNickname);
    if (!nickCheck.valid) {
      return { success: false, error: nickCheck.error };
    }

    const settingsCheck = validateRoomSettings(settings);
    if (!settingsCheck.valid) {
      return { success: false, error: settingsCheck.error };
    }

    const roomCode = this.generateRoomCode();
    const playerId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(24).toString('hex');

    const scoreManager = new ScoreManager();
    const room = {
      code: roomCode,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      hostId: playerId,
      settings: settingsCheck.settings,
      scoreManager,
      players: [
        {
          id: playerId,
          nickname: nickCheck.nickname,
          sessionToken,
          socketId: null,
          isHost: true,
          isReady: true, // host is ready by default
          connected: false
        }
      ],
      engine: null
    };

    room.engine = new GameEngine(room, scoreManager);
    scoreManager.initPlayer(playerId);
    this.rooms.set(roomCode, room);

    return {
      success: true,
      roomCode,
      playerId,
      sessionToken,
      room
    };
  }

  joinRoom(roomCode, nickname) {
    const code = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Room not found. Check the code.' };
    }

    if (room.engine.phase !== PHASES.LOBBY) {
      return { success: false, error: 'Game already in progress in this room.' };
    }

    if (room.players.length >= room.settings.maxPlayers) {
      return { success: false, error: `Room is full (max ${room.settings.maxPlayers} players).` };
    }

    const nickCheck = validateNickname(nickname, room.players);
    if (!nickCheck.valid) {
      return { success: false, error: nickCheck.error };
    }

    const playerId = crypto.randomUUID();
    const sessionToken = crypto.randomBytes(24).toString('hex');

    const newPlayer = {
      id: playerId,
      nickname: nickCheck.nickname,
      sessionToken,
      socketId: null,
      isHost: false,
      isReady: false,
      connected: false
    };

    room.players.push(newPlayer);
    room.scoreManager.initPlayer(playerId);
    room.lastActivity = Date.now();

    return {
      success: true,
      roomCode: code,
      playerId,
      sessionToken,
      room
    };
  }

  reconnectPlayer(roomCode, sessionToken, socketId) {
    const code = (roomCode || '').toUpperCase().trim();
    const room = this.rooms.get(code);

    if (!room) {
      return { success: false, error: 'Room does not exist.' };
    }

    const player = room.players.find(p => p.sessionToken === sessionToken);
    if (!player) {
      return { success: false, error: 'Invalid session token. Please join again.' };
    }

    // Attach new socket
    player.socketId = socketId;
    player.connected = true;
    room.lastActivity = Date.now();
    this.socketToRoom.set(socketId, { roomCode: code, playerId: player.id });

    return {
      success: true,
      roomCode: code,
      player,
      room
    };
  }

  bindSocket(roomCode, playerId, socketId) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;

    player.socketId = socketId;
    player.connected = true;
    room.lastActivity = Date.now();
    this.socketToRoom.set(socketId, { roomCode, playerId });
    return true;
  }

  handleDisconnect(socketId) {
    const record = this.socketToRoom.get(socketId);
    if (!record) return null;

    const { roomCode, playerId } = record;
    const room = this.rooms.get(roomCode);
    this.socketToRoom.delete(socketId);

    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (player) {
      player.connected = false;
      player.socketId = null;
    }

    room.lastActivity = Date.now();

    // Host migration if host disconnected and we are in lobby
    if (room.hostId === playerId && room.engine.phase === PHASES.LOBBY) {
      const nextHost = room.players.find(p => p.id !== playerId && p.connected);
      if (nextHost) {
        room.hostId = nextHost.id;
        nextHost.isHost = true;
        nextHost.isReady = true;
      }
    }

    return { room, player };
  }

  removePlayer(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const idx = room.players.findIndex(p => p.id === playerId);
    if (idx === -1) return false;

    const [removed] = room.players.splice(idx, 1);
    room.scoreManager.removePlayer(playerId);
    room.lastActivity = Date.now();

    if (removed.socketId) {
      this.socketToRoom.delete(removed.socketId);
    }

    // Migrate host if needed
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
      room.players[0].isReady = true;
    }

    return true;
  }

  toggleReady(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return false;

    // Host is always ready
    if (player.isHost) {
      player.isReady = true;
      return true;
    }

    player.isReady = !player.isReady;
    room.lastActivity = Date.now();
    return true;
  }

  updateSettings(roomCode, hostId, newSettings) {
    const room = this.rooms.get(roomCode);
    if (!room || room.hostId !== hostId) {
      return { success: false, error: 'Only the host can modify settings.' };
    }

    const check = validateRoomSettings(newSettings);
    if (!check.valid) {
      return { success: false, error: check.error };
    }

    room.settings = { ...room.settings, ...check.settings };
    room.lastActivity = Date.now();
    return { success: true, settings: room.settings };
  }

  cleanupAbandonedRooms() {
    const now = Date.now();
    const MAX_IDLE_TIME = 2 * 60 * 60 * 1000; // 2 hours

    for (const [code, room] of this.rooms.entries()) {
      const allDisconnected = room.players.every(p => !p.connected);
      const isStale = (now - room.lastActivity) > MAX_IDLE_TIME;

      if ((allDisconnected && (now - room.lastActivity) > 15 * 60 * 1000) || isStale) {
        for (const p of room.players) {
          if (p.socketId) this.socketToRoom.delete(p.socketId);
        }
        this.rooms.delete(code);
      }
    }
  }

  getRoom(roomCode) {
    return this.rooms.get((roomCode || '').toUpperCase().trim());
  }

  getLobbyState(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      roomCode: room.code,
      hostId: room.hostId,
      settings: room.settings,
      players: room.players.map(p => ({
        id: p.id,
        nickname: p.nickname,
        isHost: p.isHost,
        isReady: p.isReady,
        connected: p.connected,
        score: room.scoreManager.getScore(p.id)
      })),
      canStart: room.players.length >= 3 && room.players.every(p => p.isReady)
    };
  }
}
