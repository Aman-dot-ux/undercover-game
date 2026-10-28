/**
 * Main Frontend Application Coordinator.
 * Orchestrates Socket events, screen routing, user interactions, and audio effects.
 */

import { client } from './socketClient.js';
import { sounds } from './audio.js';
import { screens } from './screens.js';
import { gameUI } from './gameUI.js';

class App {
  constructor() {
    this.currentLobby = null;
    this.currentState = null;
    this.privateRole = null;
  }

  init() {
    // 1. Setup Audio icon state from localStorage
    const audioIcon = document.getElementById('audio-icon');
    if (audioIcon) {
      audioIcon.textContent = sounds.isMuted() ? '🔇' : '🔊';
    }

    // 2. Bind UI interactions
    this.bindNavigation();
    this.bindForms();
    this.bindInGameControls();

    // 4. Initialize PWA / WebAPK install support & Service Worker
    this.setupPWA();

    // 5. Initialize Socket connection
    client.init(() => {
      this.bindSocketEvents();
    });
  }

  // =========================================================================
  // PWA / WEBAPK INSTALLATION & SERVICE WORKER
  // =========================================================================
  setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((reg) => {
            console.log('[PWA] Service Worker registered. Scope:', reg.scope);
          })
          .catch((err) => {
            console.warn('[PWA] Service Worker registration failed:', err);
          });
      });
    }

    let deferredPrompt = null;
    const btnNavInstall = document.getElementById('btn-pwa-install-nav');
    const btnHomeInstall = document.getElementById('btn-pwa-install-home');

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (!isStandalone) {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (btnNavInstall) btnNavInstall.classList.remove('hidden');
        if (btnHomeInstall) btnHomeInstall.classList.remove('hidden');
        console.log('[PWA] Native install prompt ready.');
      });

      const handleInstall = async () => {
        if (!deferredPrompt) {
          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
          if (isIOS) {
            screens.showToast("To install on iOS: Tap Share (box with arrow) → 'Add to Home Screen'!", 'info');
          } else {
            screens.showToast("To install: Open browser menu (⋮) → 'Install App' or 'Add to Home screen'", 'info');
          }
          return;
        }

        sounds.playClick();
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log('[PWA] User response to install:', outcome);
        deferredPrompt = null;
        if (btnNavInstall) btnNavInstall.classList.add('hidden');
        if (btnHomeInstall) btnHomeInstall.classList.add('hidden');
      };

      if (btnNavInstall) btnNavInstall.addEventListener('click', handleInstall);
      if (btnHomeInstall) btnHomeInstall.addEventListener('click', handleInstall);

      window.addEventListener('appinstalled', () => {
        console.log('[PWA] App successfully installed as WebAPK!');
        screens.showToast('🎉 Undercover installed successfully!', 'success');
        if (btnNavInstall) btnNavInstall.classList.add('hidden');
        if (btnHomeInstall) btnHomeInstall.classList.add('hidden');
      });
    }
  }

  // =========================================================================
  // NAVIGATION & MODALS
  // =========================================================================
  bindNavigation() {
    // Audio mute toggle
    const btnAudio = document.getElementById('btn-audio-toggle');
    const audioIcon = document.getElementById('audio-icon');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        const muted = sounds.toggleMute();
        if (audioIcon) audioIcon.textContent = muted ? '🔇' : '🔊';
        if (!muted) sounds.playClick();
      });
    }

    // Home buttons
    const btnGotoCreate = document.getElementById('btn-goto-create');
    if (btnGotoCreate) {
      btnGotoCreate.addEventListener('click', () => {
        sounds.playClick();
        screens.showScreen('create');
        const nickInput = document.getElementById('create-nickname');
        if (nickInput) nickInput.focus();
      });
    }

    const btnGotoJoin = document.getElementById('btn-goto-join');
    if (btnGotoJoin) {
      btnGotoJoin.addEventListener('click', () => {
        sounds.playClick();
        screens.showScreen('join');
        const codeInput = document.getElementById('join-room-code');
        if (codeInput) codeInput.focus();
      });
    }

    // Back to Menu buttons
    document.querySelectorAll('.btn-nav-back').forEach(btn => {
      btn.addEventListener('click', () => {
        sounds.playClick();
        screens.showScreen('home');
      });
    });

    // Rules Modal
    const btnOpenRules = document.getElementById('btn-open-rules');
    const btnCloseRules = document.getElementById('btn-close-rules');
    const btnCloseRulesFooter = document.getElementById('btn-close-rules-footer');
    if (btnOpenRules) {
      btnOpenRules.addEventListener('click', () => {
        sounds.playClick();
        screens.openModal('modal-rules');
      });
    }
    if (btnCloseRules) {
      btnCloseRules.addEventListener('click', () => {
        sounds.playClick();
        screens.closeModal('modal-rules');
      });
    }
    if (btnCloseRulesFooter) {
      btnCloseRulesFooter.addEventListener('click', () => {
        sounds.playClick();
        screens.closeModal('modal-rules');
      });
    }

    // Copy room code
    const btnCopyCode = document.getElementById('btn-copy-code');
    if (btnCopyCode) {
      btnCopyCode.addEventListener('click', () => {
        const codeText = document.getElementById('lobby-code')?.textContent;
        if (codeText && codeText !== '----') {
          navigator.clipboard.writeText(codeText)
            .then(() => {
              sounds.playClick();
              screens.showToast(`Room code ${codeText} copied!`, 'success');
            })
            .catch(() => {
              screens.showToast(`Room Code: ${codeText}`, 'info');
            });
        }
      });
    }
  }

  // =========================================================================
  // ROOM CREATION & JOINING FORMS
  // =========================================================================
  bindForms() {
    // Create Room Form
    const formCreate = document.getElementById('form-create-room');
    if (formCreate) {
      formCreate.addEventListener('submit', (e) => {
        e.preventDefault();
        sounds.playClick();

        const nickname = document.getElementById('create-nickname')?.value.trim();
        const maxPlayers = parseInt(document.getElementById('create-max-players')?.value, 10) || 6;
        const undercoverCount = parseInt(document.getElementById('create-undercover-count')?.value, 10) || 1;
        const category = document.getElementById('create-category')?.value || 'Random';
        const discussionDuration = parseInt(document.getElementById('create-discussion-time')?.value, 10) || 45;

        if (!nickname) {
          screens.showToast('Please enter a nickname.', 'error');
          return;
        }

        const settings = {
          maxPlayers,
          undercoverCount,
          category,
          discussionDuration
        };

        const btnSubmit = document.getElementById('btn-submit-create');
        if (btnSubmit) btnSubmit.disabled = true;

        client.createRoom(nickname, settings, (res) => {
          if (btnSubmit) btnSubmit.disabled = false;

          if (res && res.success) {
            screens.updateNavRoom(res.roomCode);
            screens.showScreen('lobby');
            screens.showToast(`Room ${res.roomCode} created!`, 'success');
          } else {
            screens.showToast(res?.error || 'Failed to create room.', 'error');
          }
        });
      });
    }

    // Join Room Form
    const formJoin = document.getElementById('form-join-room');
    if (formJoin) {
      formJoin.addEventListener('submit', (e) => {
        e.preventDefault();
        sounds.playClick();

        const roomCode = document.getElementById('join-room-code')?.value.trim().toUpperCase();
        const nickname = document.getElementById('join-nickname')?.value.trim();

        if (!roomCode || roomCode.length !== 4) {
          screens.showToast('Room code must be 4 characters.', 'error');
          return;
        }
        if (!nickname) {
          screens.showToast('Please enter a nickname.', 'error');
          return;
        }

        const btnSubmit = document.getElementById('btn-submit-join');
        if (btnSubmit) btnSubmit.disabled = true;

        client.joinRoom(roomCode, nickname, (res) => {
          if (btnSubmit) btnSubmit.disabled = false;

          if (res && res.success) {
            screens.updateNavRoom(res.roomCode);
            screens.showScreen('lobby');
            screens.showToast(`Joined Room ${res.roomCode}!`, 'success');
          } else {
            screens.showToast(res?.error || 'Failed to join room.', 'error');
          }
        });
      });
    }
  }

  // =========================================================================
  // IN-GAME CONTROLS & INTERACTIONS
  // =========================================================================
  bindInGameControls() {
    // Lobby Ready toggle
    const btnToggleReady = document.getElementById('btn-toggle-ready');
    if (btnToggleReady) {
      btnToggleReady.addEventListener('click', () => {
        sounds.playClick();
        client.toggleReady();
      });
    }

    // Host Start Game
    const btnStartGame = document.getElementById('btn-start-game');
    if (btnStartGame) {
      btnStartGame.addEventListener('click', () => {
        sounds.playClick();
        btnStartGame.disabled = true;
        btnStartGame.textContent = 'Starting...';
        client.startGame((res) => {
          if (res && !res.success) {
            btnStartGame.disabled = false;
            btnStartGame.textContent = 'Start Game (Host)';
            screens.showToast(res.error || 'Cannot start game yet.', 'error');
          }
        });
      });
    }

    // Host Settings live update
    const settingCategory = document.getElementById('lobby-setting-category');
    const settingUndercover = document.getElementById('lobby-setting-undercover');
    const handleSettingsChange = () => {
      if (!client.isHost) return;
      client.updateSettings({
        category: settingCategory?.value || 'Random',
        undercoverCount: parseInt(settingUndercover?.value, 10) || 1
      });
    };
    if (settingCategory) settingCategory.addEventListener('change', handleSettingsChange);
    if (settingUndercover) settingUndercover.addEventListener('change', handleSettingsChange);

    // Lobby Kick Player (event delegation)
    const playersGrid = document.getElementById('lobby-players-grid');
    if (playersGrid) {
      playersGrid.addEventListener('click', (e) => {
        const kickBtn = e.target.closest('.btn-kick');
        if (kickBtn && client.isHost) {
          const targetId = kickBtn.dataset.kickId;
          if (targetId) {
            sounds.playClick();
            client.kickPlayer(targetId);
          }
        }
      });
    }

    // Role Reveal: Card Flip & Confirmation
    const secretCard = document.getElementById('secret-card');
    if (secretCard) {
      secretCard.addEventListener('click', () => {
        gameUI.toggleSecretCard();
      });
    }

    const btnConfirmRole = document.getElementById('btn-confirm-role');
    if (btnConfirmRole) {
      btnConfirmRole.addEventListener('click', () => {
        sounds.playClick();
        btnConfirmRole.disabled = true;
        btnConfirmRole.textContent = 'Waiting for other players...';
        client.readyForClues();
      });
    }

    // Clue Round: Submit Clue Form
    const formClue = document.getElementById('form-submit-clue');
    if (formClue) {
      formClue.addEventListener('submit', (e) => {
        e.preventDefault();
        sounds.playClick();

        const inputClue = document.getElementById('input-clue-text');
        const btnSubmitClue = formClue.querySelector('button[type="submit"]');
        const clueText = inputClue?.value.trim();
        if (!clueText) return;

        if (btnSubmitClue) {
          btnSubmitClue.disabled = true;
          btnSubmitClue.textContent = 'Submitting...';
        }

        client.submitClue(clueText, (res) => {
          if (res && res.success) {
            if (inputClue) inputClue.value = '';
            document.getElementById('my-clue-box')?.classList.add('hidden');
            screens.showToast('Clue submitted!', 'success');
          } else {
            if (btnSubmitClue) {
              btnSubmitClue.disabled = false;
              btnSubmitClue.textContent = 'Submit Public Clue';
            }
            screens.showToast(res?.error || 'Failed to submit clue.', 'error');
          }
        });
      });
    }

    // Discussion: Host Skip Early (Vote Now)
    // NOTE: The live click handler is re-attached on every discussion render
    // inside the game:state_update → case 'discussion' block below, to guarantee
    // the button is always fresh and enabled after round transitions.

    // Voting: Submit Vote
    const btnSubmitVote = document.getElementById('btn-submit-vote');
    if (btnSubmitVote) {
      btnSubmitVote.addEventListener('click', () => {
        if (!gameUI.selectedCandidateId) return;

        sounds.playVote();
        btnSubmitVote.disabled = true;
        btnSubmitVote.textContent = 'Submitting...';

        client.submitVote(gameUI.selectedCandidateId, (res) => {
          if (res && res.success) {
            screens.showToast('Secret vote cast!', 'success');
            btnSubmitVote.textContent = 'Vote Locked In ✓';
          } else {
            btnSubmitVote.disabled = false;
            btnSubmitVote.textContent = 'Confirm Vote';
            screens.showToast(res?.error || 'Vote could not be registered.', 'error');
          }
        });
      });
    }

    // Voting: Host Force Close
    const btnHostCloseVoting = document.getElementById('btn-host-close-voting');
    if (btnHostCloseVoting) {
      btnHostCloseVoting.addEventListener('click', () => {
        sounds.playClick();
        client.closeVoting((res) => {
          if (res && !res.success) {
            screens.showToast(res.error, 'error');
          }
        });
      });
    }

    // Elimination: Host Next Round
    const btnContinueRound = document.getElementById('btn-continue-round');
    if (btnContinueRound) {
      btnContinueRound.addEventListener('click', () => {
        sounds.playClick();
        btnContinueRound.disabled = true;
        btnContinueRound.textContent = 'Starting Round...';
        client.continueRound();
      });
    }

    // Elimination: Host Immediate Tie Revote
    const btnStartTieRevote = document.getElementById('btn-start-tie-revote');
    if (btnStartTieRevote) {
      btnStartTieRevote.addEventListener('click', () => {
        sounds.playClick();
        btnStartTieRevote.disabled = true;
        client.startTieRevote();
      });
    }

    // In-Game Host Controls (Restart Game & Exit to Lobby)
    const btnIngameRestart = document.getElementById('btn-ingame-restart');
    if (btnIngameRestart) {
      btnIngameRestart.addEventListener('click', () => {
        sounds.playClick();
        if (confirm('Restart game? All players will receive new confidential words and roles.')) {
          client.restartMatch((res) => {
            if (res && res.success) {
              screens.showToast('Match restarted with new secret words!', 'success');
            } else {
              screens.showToast(res?.error || 'Could not restart match.', 'error');
            }
          });
        }
      });
    }

    const btnIngameLobby = document.getElementById('btn-ingame-lobby');
    if (btnIngameLobby) {
      btnIngameLobby.addEventListener('click', () => {
        sounds.playClick();
        if (confirm('End match and return everyone to the room lobby?')) {
          client.returnToLobby();
        }
      });
    }

    // Game Over: Host Next Match & Return to Lobby
    const btnNextMatch = document.getElementById('btn-next-match');
    if (btnNextMatch) {
      btnNextMatch.addEventListener('click', () => {
        sounds.playClick();
        btnNextMatch.disabled = true;
        btnNextMatch.textContent = 'Preparing Next Match...';
        client.nextMatch((res) => {
          if (res && !res.success) {
            btnNextMatch.disabled = false;
            btnNextMatch.textContent = 'Play Next Match';
            screens.showToast(res.error || 'Failed to start next match.', 'error');
          }
        });
      });
    }

    const btnReturnLobby = document.getElementById('btn-return-lobby');
    if (btnReturnLobby) {
      btnReturnLobby.addEventListener('click', () => {
        sounds.playClick();
        client.returnToLobby();
      });
    }
  }

  // =========================================================================
  // SOCKET.IO INCOMING EVENTS
  // =========================================================================
  bindSocketEvents() {
    if (!client.socket) return;

    // Lobby updates
    client.socket.on('room:lobby_update', (lobbyData) => {
      if (!lobbyData || !client.roomCode || !client.playerId) return;

      // Ensure this client is still an active member of this room
      const me = lobbyData.players?.find(p => p.id === client.playerId);
      if (!me) return;

      this.currentLobby = lobbyData;
      client.isHost = lobbyData.hostId === client.playerId;
      screens.updateNavRoom(lobbyData.roomCode);

      // Only switch screen if not already in an active game
      if (screens.currentScreen !== 'game') {
        screens.showScreen('lobby');
      }

      gameUI.renderLobby(lobbyData, client.playerId, client.isHost);
    });

    // Private role assignment (strictly secret to this player)
    client.socket.on('game:private_role', (privateState) => {
      this.privateRole = privateState;
      gameUI.setupRoleReveal(privateState);
      if (this.currentState && this.currentState.phase === 'role_reveal') {
        gameUI.renderRoleRevealReadiness(this.currentState, client.playerId);
      }
    });

    // Public game state machine update
    client.socket.on('game:state_update', (state) => {
      if (!state || !client.roomCode || !client.playerId) return;

      // Ensure this client is still an active member of this match
      const me = state.players?.find(p => p.id === client.playerId);
      if (!me) return;

      this.currentState = state;

      // Update Top Status Bar
      const roundNumEl = document.getElementById('game-round-num');
      const phaseBadgeEl = document.getElementById('game-phase-badge');
      const timerContainer = document.getElementById('game-timer-container');

      if (roundNumEl) roundNumEl.textContent = state.roundNumber || 1;
      if (phaseBadgeEl) {
        phaseBadgeEl.textContent = state.phase ? state.phase.replace('_', ' ').toUpperCase() : 'GAME';
      }

      if (timerContainer) {
        if (state.phase === 'discussion') {
          timerContainer.classList.remove('hidden');
        } else {
          timerContainer.classList.add('hidden');
        }
      }

      // Switch to proper phase subview
      screens.showPhase(state.phase);

      // In-Game Host Controls visibility
      const inGameHostBar = document.getElementById('in-game-host-bar');
      if (inGameHostBar) {
        if (client.isHost && state.phase !== 'game_over') {
          inGameHostBar.classList.remove('hidden');
        } else {
          inGameHostBar.classList.add('hidden');
        }
      }

      // Phase-specific rendering
      switch (state.phase) {
        case 'role_reveal':
          if (this.privateRole) {
            gameUI.setupRoleReveal(this.privateRole);
          }
          gameUI.renderRoleRevealReadiness(state, client.playerId);
          break;
        case 'clue_round':
          gameUI.renderClueRound(state, client.playerId);
          break;
        case 'discussion':
          gameUI.renderDiscussion(state, client.isHost);
          // Re-attach Vote Now click every time discussion renders so the
          // button is never left disabled after round transitions.
          if (client.isHost) {
            const btnSkip = document.getElementById('btn-host-skip-discussion');
            if (btnSkip) {
              // Remove any previously attached handler to avoid stacking
              const fresh = btnSkip.cloneNode(true);
              btnSkip.parentNode.replaceChild(fresh, btnSkip);
              fresh.disabled = false;
              fresh.textContent = '⚡ Vote Now';
              fresh.addEventListener('click', () => {
                sounds.playClick();
                fresh.disabled = true;
                fresh.textContent = 'Opening Voting...';
                client.startVotingEarly((res) => {
                  if (res && !res.success) {
                    fresh.disabled = false;
                    fresh.textContent = '⚡ Vote Now';
                    screens.showToast(res.error, 'error');
                  }
                });
              });
            }
          }
          break;
        case 'voting':
          gameUI.renderVoting(state, client.playerId, client.isHost);
          break;
        case 'elimination':
          gameUI.renderElimination(state, client.isHost);
          break;
        case 'game_over':
          gameUI.renderGameOver(state, client.isHost);
          break;
      }
    });

    // Discussion countdown tick
    client.socket.on('game:timer_tick', ({ remaining }) => {
      const countdownEl = document.getElementById('discussion-countdown');
      const timerTextEl = document.getElementById('game-timer-text');

      if (countdownEl) countdownEl.textContent = remaining;
      if (timerTextEl) timerTextEl.textContent = `${remaining}s`;

      if (remaining <= 5 && remaining > 0) {
        sounds.playTick();
      }
    });

    // Host returned all to lobby
    client.socket.on('game:nav_lobby', () => {
      screens.showScreen('lobby');
      screens.showToast('Returned to room lobby.', 'info');
    });

    // Player kicked by host
    client.socket.on('room:kicked', () => {
      client.clearSession();
      this.currentLobby = null;
      this.currentState = null;
      this.privateRole = null;
      screens.updateNavRoom(null);
      screens.showScreen('home');
      sounds.playElimination?.();
      screens.showToast('You were removed from the room by the host.', 'error');
    });
  }
}

// Instantiate and start app on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
