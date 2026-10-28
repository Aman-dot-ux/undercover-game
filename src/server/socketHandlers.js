import { PHASES } from '../game/engine.js';

export function setupSocketHandlers(io, roomManager) {
  // Map of active discussion timers: roomCode -> timerInterval
  const discussionTimers = new Map();
  // Map of active tie revote auto-transition timers: roomCode -> timeout
  const tieRevoteTimers = new Map();

  function clearDiscussionTimer(roomCode) {
    if (discussionTimers.has(roomCode)) {
      clearInterval(discussionTimers.get(roomCode));
      discussionTimers.delete(roomCode);
    }
  }

  function clearTieRevoteTimer(roomCode) {
    if (tieRevoteTimers.has(roomCode)) {
      clearTimeout(tieRevoteTimers.get(roomCode));
      tieRevoteTimers.delete(roomCode);
    }
  }

  function handleTieRevote(roomCode, tiedIds) {
    clearTieRevoteTimer(roomCode);
    const timer = setTimeout(() => {
      clearTieRevoteTimer(roomCode);
      const currentRoom = roomManager.getRoom(roomCode);
      if (currentRoom && currentRoom.engine.phase === PHASES.ELIMINATION && currentRoom.engine.lastElimination?.tie) {
        currentRoom.engine.beginVoting(true, tiedIds);
        io.to(roomCode).emit('game:state_update', currentRoom.engine.getPublicState());
      }
    }, 4500);
    tieRevoteTimers.set(roomCode, timer);
  }

  function startDiscussionTimer(roomCode) {
    clearDiscussionTimer(roomCode);
    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const interval = setInterval(() => {
      const currentRoom = roomManager.getRoom(roomCode);
      if (!currentRoom || currentRoom.engine.phase !== PHASES.DISCUSSION) {
        clearDiscussionTimer(roomCode);
        return;
      }

      currentRoom.engine.discussionRemaining -= 1;
      io.to(roomCode).emit('game:timer_tick', {
        remaining: currentRoom.engine.discussionRemaining
      });

      if (currentRoom.engine.discussionRemaining <= 0) {
        clearDiscussionTimer(roomCode);
        // Automatically advance to voting
        currentRoom.engine.beginVoting(false, []);
        io.to(roomCode).emit('game:state_update', currentRoom.engine.getPublicState());
      }
    }, 1000);

    discussionTimers.set(roomCode, interval);
  }

  function sendPrivateRoles(room) {
    for (const player of room.players) {
      if (player.socketId) {
        const privateState = room.engine.getPrivatePlayerState(player.id);
        if (privateState) {
          io.to(player.socketId).emit('game:private_role', privateState);
        }
      }
    }
  }

  io.on('connection', (socket) => {
    // -----------------------------------------------------------------
    // ROOM: CREATE
    // -----------------------------------------------------------------
    socket.on('room:create', ({ nickname, settings }, callback) => {
      try {
        const result = roomManager.createRoom(nickname, settings);
        if (!result.success) {
          return callback?.({ success: false, error: result.error });
        }

        socket.join(result.roomCode);
        roomManager.bindSocket(result.roomCode, result.playerId, socket.id);

        callback?.({
          success: true,
          roomCode: result.roomCode,
          playerId: result.playerId,
          sessionToken: result.sessionToken
        });

        io.to(result.roomCode).emit('room:lobby_update', roomManager.getLobbyState(result.roomCode));
      } catch (err) {
        console.error('Error creating room:', err);
        callback?.({ success: false, error: 'Internal server error creating room.' });
      }
    });

    // -----------------------------------------------------------------
    // ROOM: JOIN
    // -----------------------------------------------------------------
    socket.on('room:join', ({ roomCode, nickname }, callback) => {
      try {
        const result = roomManager.joinRoom(roomCode, nickname);
        if (!result.success) {
          return callback?.({ success: false, error: result.error });
        }

        socket.join(result.roomCode);
        roomManager.bindSocket(result.roomCode, result.playerId, socket.id);

        callback?.({
          success: true,
          roomCode: result.roomCode,
          playerId: result.playerId,
          sessionToken: result.sessionToken
        });

        io.to(result.roomCode).emit('room:lobby_update', roomManager.getLobbyState(result.roomCode));
      } catch (err) {
        console.error('Error joining room:', err);
        callback?.({ success: false, error: 'Internal server error joining room.' });
      }
    });

    // -----------------------------------------------------------------
    // ROOM: RECONNECT
    // -----------------------------------------------------------------
    socket.on('room:reconnect', ({ roomCode, sessionToken }, callback) => {
      try {
        const result = roomManager.reconnectPlayer(roomCode, sessionToken, socket.id);
        if (!result.success) {
          return callback?.({ success: false, error: result.error });
        }

        socket.join(result.roomCode);

        const room = result.room;
        const player = result.player;

        callback?.({
          success: true,
          roomCode: result.roomCode,
          playerId: player.id,
          nickname: player.nickname,
          isHost: player.isHost,
          phase: room.engine.phase
        });

        // If in game, restore private role & state
        if (room.engine.phase !== PHASES.LOBBY) {
          const privateState = room.engine.getPrivatePlayerState(player.id);
          if (privateState) {
            socket.emit('game:private_role', privateState);
          }
          socket.emit('game:state_update', room.engine.getPublicState());
        } else {
          io.to(result.roomCode).emit('room:lobby_update', roomManager.getLobbyState(result.roomCode));
        }
      } catch (err) {
        console.error('Error reconnecting:', err);
        callback?.({ success: false, error: 'Reconnection failed.' });
      }
    });

    // -----------------------------------------------------------------
    // ROOM: SYNC (Instant state sync when tab wakes up or reconnects)
    // -----------------------------------------------------------------
    socket.on('room:sync', ({ roomCode, sessionToken }, callback) => {
      try {
        const result = roomManager.reconnectPlayer(roomCode, sessionToken, socket.id);
        if (!result.success) {
          return callback?.({ success: false, error: result.error });
        }

        socket.join(result.roomCode);
        const room = result.room;
        const player = result.player;

        callback?.({
          success: true,
          roomCode: result.roomCode,
          playerId: player.id,
          nickname: player.nickname,
          isHost: player.isHost,
          phase: room.engine.phase
        });

        if (room.engine.phase !== PHASES.LOBBY) {
          const privateState = room.engine.getPrivatePlayerState(player.id);
          if (privateState) {
            socket.emit('game:private_role', privateState);
          }
          socket.emit('game:state_update', room.engine.getPublicState());
        } else {
          socket.emit('room:lobby_update', roomManager.getLobbyState(result.roomCode));
        }
      } catch (err) {
        console.error('Error in room:sync:', err);
        callback?.({ success: false, error: 'Sync failed.' });
      }
    });

    // -----------------------------------------------------------------
    // ROOM: TOGGLE READY
    // -----------------------------------------------------------------
    socket.on('room:toggle_ready', ({ roomCode, playerId }) => {
      if (roomManager.toggleReady(roomCode, playerId)) {
        io.to(roomCode).emit('room:lobby_update', roomManager.getLobbyState(roomCode));
      }
    });

    // -----------------------------------------------------------------
    // ROOM: UPDATE SETTINGS
    // -----------------------------------------------------------------
    socket.on('room:update_settings', ({ roomCode, playerId, settings }, callback) => {
      const result = roomManager.updateSettings(roomCode, playerId, settings);
      if (result.success) {
        io.to(roomCode).emit('room:lobby_update', roomManager.getLobbyState(roomCode));
        callback?.({ success: true });
      } else {
        callback?.({ success: false, error: result.error });
      }
    });

    // -----------------------------------------------------------------
    // ROOM: KICK PLAYER (Host only)
    // -----------------------------------------------------------------
    socket.on('room:kick_player', ({ roomCode, hostId, targetPlayerId }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) return;

      const target = room.players.find(p => p.id === targetPlayerId);
      if (target && target.socketId) {
        io.to(target.socketId).emit('room:kicked');
      }

      roomManager.removePlayer(roomCode, targetPlayerId);
      io.to(roomCode).emit('room:lobby_update', roomManager.getLobbyState(roomCode));
    });

    // -----------------------------------------------------------------
    // GAME: START MATCH (Host only)
    // -----------------------------------------------------------------
    socket.on('game:start', ({ roomCode, hostId }, callback) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return callback?.({ success: false, error: 'Room not found.' });

      if (room.hostId !== hostId) {
        return callback?.({ success: false, error: 'Only the host can start the game.' });
      }

      if (room.engine.phase !== PHASES.LOBBY) {
        return callback?.({ success: false, error: 'Game has already started.' });
      }

      if (room.players.length < 3) {
        return callback?.({ success: false, error: 'At least 3 players are required to start.' });
      }

      const allReady = room.players.every(p => p.isReady);
      if (!allReady) {
        return callback?.({ success: false, error: 'All players must be ready before starting.' });
      }

      clearDiscussionTimer(roomCode);

      // Start new round
      room.engine.startNewRound(room.players, room.settings);

      // Privately transmit secret roles
      sendPrivateRoles(room);

      // Broadcast public game state
      io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      callback?.({ success: true });
    });

    // -----------------------------------------------------------------
    // GAME: PLAYER READY FOR CLUES (Role reveal done)
    // -----------------------------------------------------------------
    socket.on('game:player_ready_for_clues', ({ roomCode, playerId }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      if (room.engine.playerReadyForClues(playerId)) {
        io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      }
    });

    // -----------------------------------------------------------------
    // GAME: SUBMIT CLUE
    // -----------------------------------------------------------------
    socket.on('game:submit_clue', ({ roomCode, playerId, clueText }, callback) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return callback?.({ success: false, error: 'Room not found.' });

      const result = room.engine.submitClue(playerId, clueText);
      if (!result.success) {
        return callback?.({ success: false, error: result.error });
      }

      // Check if transitioned to discussion
      if (room.engine.phase === PHASES.DISCUSSION) {
        startDiscussionTimer(roomCode);
      }

      io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      callback?.({ success: true });
    });

    // -----------------------------------------------------------------
    // GAME: ADVANCE TO VOTING (Host skip discussion or timer end)
    // -----------------------------------------------------------------
    socket.on('game:start_voting', ({ roomCode, hostId }, callback) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) {
        return callback?.({ success: false, error: 'Only the host can advance early.' });
      }

      if (room.engine.phase !== PHASES.DISCUSSION) {
        return callback?.({ success: false, error: 'Voting can only be started during discussion.' });
      }

      clearDiscussionTimer(roomCode);
      room.engine.beginVoting(false, []);
      io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      callback?.({ success: true });
    });

    // -----------------------------------------------------------------
    // GAME: SUBMIT VOTE
    // -----------------------------------------------------------------
    socket.on('game:submit_vote', ({ roomCode, voterId, targetId }, callback) => {
      const room = roomManager.getRoom(roomCode);
      if (!room) return callback?.({ success: false, error: 'Room not found.' });

      const result = room.engine.submitVote(voterId, targetId);
      if (!result.success) {
        return callback?.({ success: false, error: result.error });
      }

      callback?.({ success: true });

      // If all living players have voted, automatically resolve voting
      if (result.allVoted) {
        const resolveResult = room.engine.resolveVoting();
        io.to(roomCode).emit('game:state_update', room.engine.getPublicState());

        if (resolveResult.tie && resolveResult.needsRevote) {
          // Show tie elimination view, then automatically transition to revote after 4.5s
          handleTieRevote(roomCode, resolveResult.tiedIds);
        }
      } else {
        // Broadcast state showing who has voted (without revealing targets)
        io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      }
    });

    // -----------------------------------------------------------------
    // GAME: CLOSE VOTING (Host forced close)
    // -----------------------------------------------------------------
    socket.on('game:close_voting', ({ roomCode, hostId }, callback) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) {
        return callback?.({ success: false, error: 'Only the host can close voting.' });
      }

      if (room.engine.phase !== PHASES.VOTING) {
        return callback?.({ success: false, error: 'Voting is not currently active.' });
      }

      const resolveResult = room.engine.resolveVoting();
      io.to(roomCode).emit('game:state_update', room.engine.getPublicState());

      if (resolveResult.tie && resolveResult.needsRevote) {
        handleTieRevote(roomCode, resolveResult.tiedIds);
      }

      callback?.({ success: true });
    });

    // -----------------------------------------------------------------
    // GAME: START TIE REVOTE (Host trigger immediately)
    // -----------------------------------------------------------------
    socket.on('game:start_tie_revote', ({ roomCode, hostId }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) return;

      if (room.engine.phase === PHASES.ELIMINATION && room.engine.lastElimination?.tie) {
        clearTieRevoteTimer(roomCode);
        room.engine.beginVoting(true, room.engine.lastElimination.tiedIds || []);
        io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      }
    });

    // -----------------------------------------------------------------
    // GAME: NEXT CLUE ROUND (Continue if round is not over)
    // -----------------------------------------------------------------
    socket.on('game:continue_round', ({ roomCode, hostId }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) return;

      if (room.engine.phase === PHASES.ELIMINATION && !room.engine.winnerTeam) {
        clearTieRevoteTimer(roomCode);
        room.engine.roundNumber += 1;
        room.engine.beginClueRound();
        io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      }
    });

    // -----------------------------------------------------------------
    // GAME: RESTART MATCH (Host resets match during active play)
    // -----------------------------------------------------------------
    socket.on('game:restart_match', ({ roomCode, hostId }, callback) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) {
        return callback?.({ success: false, error: 'Only the host can restart the match.' });
      }

      clearDiscussionTimer(roomCode);
      clearTieRevoteTimer(roomCode);
      room.engine.startNewRound(room.players, room.settings);
      sendPrivateRoles(room);

      io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      callback?.({ success: true });
    });

    // -----------------------------------------------------------------
    // GAME: PLAY NEXT MATCH / ROUND (After Game Over)
    // -----------------------------------------------------------------
    socket.on('game:next_match', ({ roomCode, hostId }, callback) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) {
        return callback?.({ success: false, error: 'Only the host can start the next match.' });
      }

      if (room.engine.phase !== PHASES.GAME_OVER) {
        return callback?.({ success: false, error: 'Current match is not over yet.' });
      }

      clearDiscussionTimer(roomCode);
      clearTieRevoteTimer(roomCode);
      room.engine.startNewRound(room.players, room.settings);
      sendPrivateRoles(room);

      io.to(roomCode).emit('game:state_update', room.engine.getPublicState());
      callback?.({ success: true });
    });

    // -----------------------------------------------------------------
    // GAME: RETURN TO LOBBY
    // -----------------------------------------------------------------
    socket.on('game:return_to_lobby', ({ roomCode, hostId }) => {
      const room = roomManager.getRoom(roomCode);
      if (!room || room.hostId !== hostId) return;

      clearDiscussionTimer(roomCode);
      clearTieRevoteTimer(roomCode);
      room.engine.returnToLobby();

      // Reset players ready status except host
      for (const p of room.players) {
        p.isReady = p.isHost;
      }

      io.to(roomCode).emit('room:lobby_update', roomManager.getLobbyState(roomCode));
      io.to(roomCode).emit('game:nav_lobby');
    });

    // -----------------------------------------------------------------
    // DISCONNECTION
    // -----------------------------------------------------------------
    socket.on('disconnect', () => {
      const info = roomManager.handleDisconnect(socket.id);
      if (info && info.room) {
        io.to(info.room.code).emit('room:lobby_update', roomManager.getLobbyState(info.room.code));
        io.to(info.room.code).emit('game:state_update', info.room.engine.getPublicState());
      }
    });
  });
}
