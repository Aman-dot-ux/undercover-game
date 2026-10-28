/**
 * Game UI Rendering and Component Interaction Manager.
 * Handles DOM manipulation for Lobby, Role Reveal, Clues, Discussion, Voting, Elimination, and Results.
 */

import { sounds } from './audio.js';

class GameUI {
  constructor() {
    this.selectedCandidateId = null;
    this.hasVotedCurrentRound = false;
    this.isCardFlipped = false;
  }

  // =========================================================================
  // LOBBY RENDERING
  // =========================================================================
  renderLobby(lobbyData, myPlayerId, isHost) {
    if (!lobbyData) return;

    // Room Code
    const lobbyCodeEl = document.getElementById('lobby-code');
    if (lobbyCodeEl) lobbyCodeEl.textContent = lobbyData.roomCode;

    // Player Count
    const playerCountEl = document.getElementById('lobby-player-count');
    if (playerCountEl) {
      playerCountEl.textContent = `${lobbyData.players.length}/${lobbyData.settings.maxPlayers}`;
    }

    // Category Badge
    const categoryBadgeEl = document.getElementById('lobby-category-badge');
    if (categoryBadgeEl) {
      categoryBadgeEl.textContent = lobbyData.settings.category || 'Random';
    }

    // Min players warning
    const minWarningEl = document.getElementById('lobby-min-warning');
    if (minWarningEl) {
      if (lobbyData.players.length < 3) {
        minWarningEl.textContent = `Min 3 Players Needed (${3 - lobbyData.players.length} more)`;
        minWarningEl.classList.remove('hidden');
      } else {
        const allReady = lobbyData.players.every(p => p.isReady);
        if (!allReady) {
          minWarningEl.textContent = 'Waiting for everyone to Ready Up';
          minWarningEl.classList.remove('hidden');
        } else {
          minWarningEl.classList.add('hidden');
        }
      }
    }

    // Players Grid
    const playersGrid = document.getElementById('lobby-players-grid');
    if (playersGrid) {
      playersGrid.innerHTML = '';
      lobbyData.players.forEach(player => {
        const isMe = player.id === myPlayerId;
        const initial = (player.nickname || '?')[0].toUpperCase();

        const item = document.createElement('div');
        item.className = 'player-item';

        let badgeHtml = '';
        if (player.isHost) {
          badgeHtml += '<span class="tag tag-host">Host</span>';
        }
        if (player.isReady) {
          badgeHtml += '<span class="tag tag-ready">Ready</span>';
        } else {
          badgeHtml += '<span class="tag tag-waiting">Waiting</span>';
        }

        let kickBtnHtml = '';
        if (isHost && !isMe) {
          kickBtnHtml = `<button class="btn-kick" data-kick-id="${player.id}" title="Kick Player">✕</button>`;
        }

        item.innerHTML = `
          <div class="player-left">
            <div class="avatar">${initial}</div>
            <div>
              <span class="player-name">${this.escapeHtml(player.nickname)} ${isMe ? '<small style="color:var(--accent-cyan);">(You)</small>' : ''}</span>
              ${player.score > 0 ? `<div style="font-size:0.75rem; color:var(--text-secondary);">${player.score} pts</div>` : ''}
            </div>
          </div>
          <div class="player-badges">
            ${badgeHtml}
            ${kickBtnHtml}
          </div>
        `;
        playersGrid.appendChild(item);
      });
    }

    // Ready Button
    const btnToggleReady = document.getElementById('btn-toggle-ready');
    const readyStatusIcon = document.getElementById('ready-status-icon');
    const me = lobbyData.players.find(p => p.id === myPlayerId);

    if (btnToggleReady) {
      if (isHost) {
        btnToggleReady.classList.add('hidden');
      } else {
        btnToggleReady.classList.remove('hidden');
        if (me && me.isReady) {
          btnToggleReady.className = 'btn btn-outline active btn-lg flex-1';
          btnToggleReady.innerHTML = '<span id="ready-status-icon">✓</span> You are Ready';
        } else {
          btnToggleReady.className = 'btn btn-outline btn-lg flex-1';
          btnToggleReady.innerHTML = '<span id="ready-status-icon">⏳</span> Mark Ready';
        }
      }
    }

    // Host Start Game Button
    const btnStartGame = document.getElementById('btn-start-game');
    if (btnStartGame) {
      if (isHost) {
        btnStartGame.classList.remove('hidden');
        btnStartGame.disabled = !lobbyData.canStart;
      } else {
        btnStartGame.classList.add('hidden');
      }
    }

    // Host Settings Controls
    const hostControls = document.getElementById('lobby-host-controls');
    if (hostControls) {
      if (isHost) {
        hostControls.classList.remove('hidden');
        const catSelect = document.getElementById('lobby-setting-category');
        const undSelect = document.getElementById('lobby-setting-undercover');
        if (catSelect && lobbyData.settings.category) catSelect.value = lobbyData.settings.category;
        if (undSelect && lobbyData.settings.undercoverCount) undSelect.value = lobbyData.settings.undercoverCount;
      } else {
        hostControls.classList.add('hidden');
      }
    }
  }

  // =========================================================================
  // ROLE REVEAL
  // =========================================================================
  setupRoleReveal(privateState) {
    if (!privateState) return;

    this.isCardFlipped = false;
    const card = document.getElementById('secret-card');
    if (card) {
      card.classList.remove('flipped');
    }

    const badge = document.getElementById('player-role-badge');
    const wordEl = document.getElementById('player-secret-word');
    const descEl = document.getElementById('player-role-description');
    const btnConfirm = document.getElementById('btn-confirm-role');

    if (badge) {
      badge.textContent = privateState.role === 'undercover' ? 'UNDERCOVER' : 'CIVILIAN';
      badge.style.color = privateState.role === 'undercover' ? 'var(--accent-crimson)' : 'var(--accent-emerald)';
      badge.style.borderColor = privateState.role === 'undercover' ? 'var(--accent-crimson)' : 'var(--accent-emerald)';
    }

    if (wordEl) {
      wordEl.textContent = privateState.word || '------';
    }

    const wordDescEl = document.getElementById('player-word-description');
    if (wordDescEl) {
      wordDescEl.textContent = privateState.description || 'Give subtle clues without saying this word!';
    }

    if (descEl) {
      if (privateState.role === 'undercover') {
        descEl.textContent = 'You have a slightly different word than Civilians! Give clever, subtle clues to blend in.';
      } else {
        descEl.textContent = 'Most players share this word. Give subtle clues without saying it, and find the imposter!';
      }
    }

    if (btnConfirm) {
      if (privateState.readyForClues) {
        btnConfirm.disabled = true;
        btnConfirm.textContent = 'Waiting for other players...';
      } else {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'I Understand & Am Ready for Clues';
      }
    }
  }

  renderRoleRevealReadiness(state, myPlayerId) {
    if (!state || !state.players) return;

    const listContainer = document.getElementById('role-reveal-players-list');
    const countEl = document.getElementById('role-reveal-count');

    const alivePlayers = state.players.filter(p => p.isAlive);
    const totalAlive = alivePlayers.length;
    const readyCount = alivePlayers.filter(p => p.readyForClues).length;

    if (countEl) {
      countEl.textContent = `${readyCount} / ${totalAlive} Ready`;
      if (readyCount === totalAlive && totalAlive > 0) {
        countEl.className = 'tag tag-ready';
      } else {
        countEl.className = 'tag tag-waiting';
      }
    }

    if (listContainer) {
      listContainer.innerHTML = '';
      alivePlayers.forEach(player => {
        const isMe = player.id === myPlayerId;
        const initial = (player.nickname || '?')[0].toUpperCase();
        const isReady = Boolean(player.readyForClues);

        const item = document.createElement('div');
        item.className = `readiness-item ${isReady ? 'ready' : 'waiting'}`;

        item.innerHTML = `
          <div class="readiness-left">
            <div class="avatar ${isReady ? 'avatar-ready' : ''}">${initial}</div>
            <span class="player-name">${this.escapeHtml(player.nickname)} ${isMe ? '<small style="color:var(--accent-cyan); font-weight:700;">(You)</small>' : ''}</span>
          </div>
          <div class="readiness-status">
            ${isReady
              ? '<span class="status-pill status-ready"><span class="check-icon">✓</span> Understood</span>'
              : '<span class="status-pill status-waiting"><span class="spin-icon">⏳</span> Reading...</span>'}
          </div>
        `;
        listContainer.appendChild(item);
      });
    }
  }

  toggleSecretCard() {
    const card = document.getElementById('secret-card');
    if (card) {
      this.isCardFlipped = !this.isCardFlipped;
      if (this.isCardFlipped) {
        card.classList.add('flipped');
      } else {
        card.classList.remove('flipped');
      }
      sounds.playCardFlip();
    }
  }

  // =========================================================================
  // CLUE ROUND
  // =========================================================================
  renderClueRound(state, myPlayerId) {
    if (!state) return;

    // Current turn player
    const turnPlayerNameEl = document.getElementById('current-turn-player-name');
    const turnStatusMessage = document.getElementById('turn-status-message');
    const myClueBox = document.getElementById('my-clue-box');
    const inputClue = document.getElementById('input-clue-text');

    const currentTurnPlayer = state.players.find(p => p.id === state.currentTurnPlayerId);
    const isMyTurn = state.currentTurnPlayerId === myPlayerId;
    const me = state.players.find(p => p.id === myPlayerId);

    if (turnPlayerNameEl) {
      turnPlayerNameEl.textContent = isMyTurn ? 'YOUR TURN!' : (currentTurnPlayer ? currentTurnPlayer.nickname : 'Waiting...');
      turnPlayerNameEl.style.color = isMyTurn ? 'var(--accent-emerald)' : 'var(--accent-cyan)';
    }

    if (turnStatusMessage) {
      turnStatusMessage.textContent = isMyTurn
        ? 'Type your clue below and submit it.'
        : `Listening to ${currentTurnPlayer ? currentTurnPlayer.nickname : 'player'}...`;
    }

    if (myClueBox) {
      if (isMyTurn && me && me.isAlive && !me.hasGivenClue) {
        if (myClueBox.classList.contains('hidden')) {
          if (inputClue) inputClue.value = '';
          const btnSubmit = myClueBox.querySelector('button[type="submit"]');
          if (btnSubmit) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Submit Public Clue';
          }
        }
        myClueBox.classList.remove('hidden');
        if (inputClue && document.activeElement !== inputClue) {
          inputClue.focus();
        }
      } else {
        myClueBox.classList.add('hidden');
      }
    }

    // Render Clues List
    const cluesList = document.getElementById('clues-list');
    if (cluesList) {
      cluesList.innerHTML = '';
      const order = state.turnOrder || [];
      let clueCount = 0;

      order.forEach(pid => {
        const clueText = state.clues[pid];
        const p = state.players.find(pl => pl.id === pid);
        if (clueText && p) {
          clueCount++;
          const item = document.createElement('div');
          item.className = 'clue-item';
          item.innerHTML = `
            <span class="clue-author">${this.escapeHtml(p.nickname)}:</span>
            <span class="clue-text">"${this.escapeHtml(clueText)}"</span>
          `;
          cluesList.appendChild(item);
        }
      });

      if (clueCount === 0) {
        cluesList.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem;">No clues submitted yet this round.</div>';
      }

      // Render Clue History from earlier rounds of this match
      if (state.clueHistory && state.clueHistory.length > 0) {
        const histContainer = document.createElement('div');
        histContainer.className = 'clue-history-section';
        histContainer.style.marginTop = '12px';
        histContainer.style.paddingTop = '8px';
        histContainer.style.borderTop = '1px dashed rgba(255,255,255,0.15)';

        state.clueHistory.forEach(h => {
          const roundHeader = document.createElement('div');
          roundHeader.style.fontSize = '0.75rem';
          roundHeader.style.fontWeight = '700';
          roundHeader.style.color = 'var(--text-muted)';
          roundHeader.style.marginBottom = '4px';
          roundHeader.textContent = `ROUND ${h.round} CLUES:`;
          histContainer.appendChild(roundHeader);

          Object.entries(h.clues || {}).forEach(([pid, text]) => {
            const p = state.players.find(pl => pl.id === pid);
            if (p && text) {
              const item = document.createElement('div');
              item.className = 'clue-item previous-round-clue';
              item.style.opacity = '0.75';
              item.innerHTML = `
                <span class="clue-author">${this.escapeHtml(p.nickname)}:</span>
                <span class="clue-text">"${this.escapeHtml(text)}"</span>
              `;
              histContainer.appendChild(item);
            }
          });
        });
        cluesList.appendChild(histContainer);
      }
    }
  }

  // =========================================================================
  // DISCUSSION
  // =========================================================================
  renderDiscussion(state, isHost) {
    if (!state) return;

    const countdownEl = document.getElementById('discussion-countdown');
    if (countdownEl) {
      countdownEl.textContent = state.discussionRemaining;
    }

    const hostControls = document.getElementById('host-discussion-controls');
    if (hostControls) {
      if (isHost) {
        hostControls.classList.remove('hidden');
      } else {
        hostControls.classList.add('hidden');
      }
    }

    // Discussion Clues Recap
    const recapList = document.getElementById('discussion-clues-list');
    if (recapList) {
      recapList.innerHTML = '';
      (state.turnOrder || []).forEach(pid => {
        const text = state.clues[pid];
        const p = state.players.find(pl => pl.id === pid);
        if (text && p) {
          const item = document.createElement('div');
          item.className = 'clue-item';
          item.innerHTML = `
            <span class="clue-author">${this.escapeHtml(p.nickname)}:</span>
            <span class="clue-text">"${this.escapeHtml(text)}"</span>
          `;
          recapList.appendChild(item);
        }
      });

      // Show history in discussion recap
      if (state.clueHistory && state.clueHistory.length > 0) {
        const histContainer = document.createElement('div');
        histContainer.style.marginTop = '12px';
        histContainer.style.paddingTop = '8px';
        histContainer.style.borderTop = '1px dashed rgba(255,255,255,0.15)';

        state.clueHistory.forEach(h => {
          const roundHeader = document.createElement('div');
          roundHeader.style.fontSize = '0.75rem';
          roundHeader.style.fontWeight = '700';
          roundHeader.style.color = 'var(--text-muted)';
          roundHeader.style.marginBottom = '4px';
          roundHeader.textContent = `ROUND ${h.round} CLUES:`;
          histContainer.appendChild(roundHeader);

          Object.entries(h.clues || {}).forEach(([pid, text]) => {
            const p = state.players.find(pl => pl.id === pid);
            if (p && text) {
              const item = document.createElement('div');
              item.className = 'clue-item previous-round-clue';
              item.style.opacity = '0.75';
              item.innerHTML = `
                <span class="clue-author">${this.escapeHtml(p.nickname)}:</span>
                <span class="clue-text">"${this.escapeHtml(text)}"</span>
              `;
              histContainer.appendChild(item);
            }
          });
        });
        recapList.appendChild(histContainer);
      }
    }
  }

  // =========================================================================
  // VOTING
  // =========================================================================
  renderVoting(state, myPlayerId, isHost) {
    if (!state) return;

    this.selectedCandidateId = null;
    const me = state.players.find(p => p.id === myPlayerId);
    const hasVoted = me ? me.hasVoted : false;
    this.hasVotedCurrentRound = hasVoted;

    const titleEl = document.getElementById('voting-header-title');
    const subtitleEl = document.getElementById('voting-header-subtitle');
    const countInfoEl = document.getElementById('vote-count-info');
    const btnSubmitVote = document.getElementById('btn-submit-vote');
    const hostVotingControls = document.getElementById('host-voting-controls');

    if (state.isTieRevote) {
      if (titleEl) titleEl.textContent = '⚡ TIE REVOTE!';
      if (subtitleEl) subtitleEl.textContent = 'Votes were tied! Vote only among the tied suspects below.';
    } else {
      if (titleEl) titleEl.textContent = 'Cast Your Secret Vote';
      if (subtitleEl) subtitleEl.textContent = 'Select the player you suspect is the Undercover.';
    }

    const aliveCount = state.players.filter(p => p.isAlive).length;
    const votesCount = state.players.filter(p => p.isAlive && p.hasVoted).length;
    if (countInfoEl) {
      countInfoEl.textContent = `${votesCount}/${aliveCount} votes cast`;
    }

    if (btnSubmitVote) {
      btnSubmitVote.disabled = true;
      if (hasVoted) {
        btnSubmitVote.textContent = 'Vote Locked In ✓';
      } else {
        btnSubmitVote.textContent = 'Confirm Vote';
      }
    }

    if (hostVotingControls) {
      if (isHost) {
        hostVotingControls.classList.remove('hidden');
      } else {
        hostVotingControls.classList.add('hidden');
      }
    }

    // Render Candidates Grid
    const grid = document.getElementById('voting-candidates-grid');
    if (grid) {
      grid.innerHTML = '';

      state.players.forEach(p => {
        // Only living players can be voted for
        if (!p.isAlive) return;

        const isMe = p.id === myPlayerId;
        const isEligibleInTie = !state.isTieRevote || (state.tiedPlayerIds && state.tiedPlayerIds.includes(p.id));
        const canBeVotedFor = !isMe && isEligibleInTie && !hasVoted && (me ? me.isAlive : false);

        let subText = p.hasVoted ? '✓ Voted' : 'Thinking...';
        if (state.isTieRevote) {
          if (isEligibleInTie && !isMe) {
            subText = '⚡ TIED SUSPECT — Eligible for vote';
          } else if (!isEligibleInTie) {
            subText = 'Not in tie (Cannot vote for)';
          }
        }

        const card = document.createElement('div');
        card.className = `candidate-card ${canBeVotedFor ? '' : 'disabled'} ${state.isTieRevote && isEligibleInTie && !isMe ? 'tie-target' : ''}`;
        card.dataset.candidateId = p.id;

        const initial = (p.nickname || '?')[0].toUpperCase();

        card.innerHTML = `
          <div class="candidate-left">
            <div class="avatar">${initial}</div>
            <div>
              <div class="candidate-name">${this.escapeHtml(p.nickname)} ${isMe ? '<small>(You)</small>' : ''}</div>
              <div style="font-size:0.75rem; color:${state.isTieRevote && isEligibleInTie && !isMe ? 'var(--accent-amber)' : 'var(--text-secondary)'}; font-weight:${state.isTieRevote && isEligibleInTie && !isMe ? '700' : 'normal'};">
                ${subText}
              </div>
            </div>
          </div>
          <div class="vote-radio"></div>
        `;

        if (canBeVotedFor) {
          card.addEventListener('click', () => {
            document.querySelectorAll('.candidate-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            this.selectedCandidateId = p.id;
            sounds.playClick();
            if (btnSubmitVote) {
              btnSubmitVote.disabled = false;
            }
          });
        }

        grid.appendChild(card);
      });
    }
  }

  // =========================================================================
  // ELIMINATION REVEAL
  // =========================================================================
  renderElimination(state, isHost) {
    if (!state || !state.lastElimination) return;

    const elim = state.lastElimination;
    const titleEl = document.getElementById('elimination-title');
    const bodyEl = document.getElementById('elimination-body');
    const breakdownEl = document.getElementById('vote-breakdown');
    const hostActions = document.getElementById('elimination-host-actions');

    if (elim.tie) {
      // Tie outcome
      if (titleEl) titleEl.textContent = '⚖️ VOTES TIED!';
      if (bodyEl) {
        const names = elim.tiedPlayers.map(p => this.escapeHtml(p.nickname)).join(' and ');
        bodyEl.innerHTML = `
          <div style="font-size:1.3rem; font-weight:800; color:var(--accent-amber); margin:8px 0;">
            Deadlock between ${names}!
          </div>
          <p style="font-size:0.95rem; color:var(--text-secondary);">
            Both received the same number of votes. A rapid revote will now take place among the tied suspects!
          </p>
        `;
      }
      if (hostActions) hostActions.classList.add('hidden');

      // Show Tie Actions & Countdown
      const tieActions = document.getElementById('elimination-tie-actions');
      const tieCountdownNum = document.getElementById('tie-countdown-num');
      const btnStartTieRevote = document.getElementById('btn-start-tie-revote');

      if (tieActions) {
        tieActions.classList.remove('hidden');

        if (btnStartTieRevote) {
          if (isHost) {
            btnStartTieRevote.classList.remove('hidden');
          } else {
            btnStartTieRevote.classList.add('hidden');
          }
        }

        // 4-second local countdown visual
        let secondsLeft = 4;
        if (tieCountdownNum) tieCountdownNum.textContent = secondsLeft;
        if (this.tieInterval) clearInterval(this.tieInterval);
        this.tieInterval = setInterval(() => {
          secondsLeft -= 1;
          if (tieCountdownNum) tieCountdownNum.textContent = Math.max(0, secondsLeft);
          if (secondsLeft <= 0) {
            clearInterval(this.tieInterval);
            this.tieInterval = null;
          }
        }, 1000);
      }
    } else {
      if (this.tieInterval) {
        clearInterval(this.tieInterval);
        this.tieInterval = null;
      }
      const tieActions = document.getElementById('elimination-tie-actions');
      if (tieActions) tieActions.classList.add('hidden');

      // Player eliminated
      sounds.playElimination();
      const p = elim.player;
      const isUndercover = p.role === 'undercover';

      if (titleEl) titleEl.textContent = '⚰️ PLAYER ELIMINATED';
      if (bodyEl) {
        bodyEl.innerHTML = `
          <div class="eliminated-tag">${this.escapeHtml(p.nickname)}</div>
          <p>was voted out by the group!</p>
          <div style="margin: 12px 0;">
            <span class="role-reveal-pill ${isUndercover ? 'undercover' : 'civilian'}">
              THEY WERE A ${isUndercover ? '🕵️ UNDERCOVER' : '👤 CIVILIAN'}
            </span>
          </div>
          ${elim.tiebreakerUsed ? '<div style="font-size:0.8rem; color:var(--text-muted);">(Determined by tiebreaker)</div>' : ''}
        `;
      }

      // Host action to continue if match is not over
      if (hostActions) {
        if (isHost && !state.winnerTeam) {
          hostActions.classList.remove('hidden');
          const btnContinue = document.getElementById('btn-continue-round');
          if (btnContinue) {
            btnContinue.disabled = false;
            btnContinue.textContent = 'Next Clue Round';
          }
        } else {
          hostActions.classList.add('hidden');
        }
      }
    }

    // Render Vote Breakdown
    if (breakdownEl && elim.votes) {
      breakdownEl.innerHTML = '<div style="font-weight:700; color:var(--text-primary); margin-bottom:4px;">Vote Breakdown:</div>';
      Object.entries(elim.votes).forEach(([voterId, targetId]) => {
        const voter = state.players.find(pl => pl.id === voterId);
        const target = state.players.find(pl => pl.id === targetId);
        if (voter && target) {
          const row = document.createElement('div');
          row.textContent = `${voter.nickname} voted for → ${target.nickname}`;
          breakdownEl.appendChild(row);
        }
      });
    }
  }

  // =========================================================================
  // GAME OVER / VICTORY
  // =========================================================================
  renderGameOver(state, isHost) {
    if (!state) return;

    sounds.playVictory();

    const titleEl = document.getElementById('victory-team-title');
    const subtitleEl = document.getElementById('victory-team-subtitle');
    const iconEl = document.getElementById('victory-banner-icon');
    const civWordEl = document.getElementById('final-civ-word');
    const undWordEl = document.getElementById('final-und-word');
    const rolesGrid = document.getElementById('final-roles-grid');
    const leaderboardEl = document.getElementById('final-leaderboard');
    const hostControls = document.getElementById('game-over-host-controls');

    const civWin = state.winnerTeam === 'civilian';

    if (iconEl) iconEl.textContent = civWin ? '🏆' : '🕵️';
    if (titleEl) {
      titleEl.textContent = civWin ? 'Civilians Win!' : 'Undercover Wins!';
      titleEl.style.color = civWin ? 'var(--accent-emerald)' : 'var(--accent-crimson)';
    }
    if (subtitleEl) {
      subtitleEl.textContent = civWin
        ? 'All Undercovers have been successfully identified!'
        : 'The Undercovers managed to blend in and outnumber the Civilians!';
    }

    // Secret Words
    if (state.revealedWordPair) {
      if (civWordEl) civWordEl.textContent = state.revealedWordPair.civilian;
      if (undWordEl) undWordEl.textContent = state.revealedWordPair.undercover;
    }

    // Final Player Roles Grid
    if (rolesGrid && state.revealedRoles) {
      rolesGrid.innerHTML = '';
      state.revealedRoles.forEach(p => {
        const row = document.createElement('div');
        row.className = 'final-role-row';
        const isUnd = p.role === 'undercover';

        row.innerHTML = `
          <div>
            <strong>${this.escapeHtml(p.nickname)}</strong>
            <div style="font-size:0.8rem; color:var(--text-secondary);">Word: "${this.escapeHtml(p.word)}"</div>
            ${p.description ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${this.escapeHtml(p.description)}</div>` : ''}
          </div>
          <span class="role-reveal-pill ${isUnd ? 'undercover' : 'civilian'}">
            ${isUnd ? 'UNDERCOVER' : 'CIVILIAN'}
          </span>
        `;
        rolesGrid.appendChild(row);
      });
    }

    // Leaderboard
    if (leaderboardEl && state.leaderboard) {
      leaderboardEl.innerHTML = '';
      state.leaderboard.forEach((entry, idx) => {
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        row.innerHTML = `
          <div style="display:flex; align-items:center; gap:10px;">
            <span class="rank">#${idx + 1}</span>
            <span style="font-weight:600;">${this.escapeHtml(entry.nickname)}</span>
          </div>
          <span class="player-score">${entry.score} pts</span>
        `;
        leaderboardEl.appendChild(row);
      });
    }

    // Host replay options
    if (hostControls) {
      if (isHost) {
        hostControls.classList.remove('hidden');
        const btnNext = document.getElementById('btn-next-match');
        if (btnNext) {
          btnNext.disabled = false;
          btnNext.textContent = 'Play Next Match';
        }
      } else {
        hostControls.classList.add('hidden');
      }
    }
  }

  // =========================================================================
  // HELPER: HTML Sanitization
  // =========================================================================
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}

export const gameUI = new GameUI();
