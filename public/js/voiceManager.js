/**
 * LiveKit Cloud Voice Chat Manager for Undercover
 * Highly optimized for mobile devices (iOS Safari & Android Chrome/Brave),
 * with strict connection locking, autoplay unlock, and mobile thumb-friendly controls.
 */

import { client } from './socketClient.js';
import { screens } from './screens.js';

class VoiceManager {
  constructor() {
    this.room = null;
    this.isMuted = true;
    this.isConnected = false;
    this.isConnecting = false;
    this.currentRoomCode = null;
    this.currentPlayerId = null;

    // Header Controls
    this.btnVoiceToggle = null;
    this.voiceMicIcon = null;
    this.voiceStatusText = null;
    this.voicePulseRing = null;

    // Mobile Floating Controls
    this.floatingWidget = null;
    this.btnFloatingToggle = null;
    this.floatingIcon = null;
    this.floatingText = null;
    this.floatingPulse = null;

    // Audio container
    this.audioContainer = null;
  }

  init() {
    this.btnVoiceToggle = document.getElementById('btn-voice-toggle');
    this.voiceMicIcon = document.getElementById('voice-mic-icon');
    this.voiceStatusText = document.getElementById('voice-status-text');
    this.voicePulseRing = document.getElementById('voice-pulse-ring');

    this.floatingWidget = document.getElementById('floating-voice-widget');
    this.btnFloatingToggle = document.getElementById('btn-floating-voice-toggle');
    this.floatingIcon = document.getElementById('floating-voice-icon');
    this.floatingText = document.getElementById('floating-voice-text');
    this.floatingPulse = document.querySelector('.floating-voice-pulse');

    this.audioContainer = document.getElementById('livekit-audio-elements');

    if (this.btnVoiceToggle) {
      this.btnVoiceToggle.addEventListener('click', () => this.toggleMute());
    }

    if (this.btnFloatingToggle) {
      this.btnFloatingToggle.addEventListener('click', () => this.toggleMute());
    }

    // Audio unlock listener for mobile iOS Safari / Chrome autoplay policy
    const unlockAudio = () => {
      if (this.room) {
        if (typeof this.room.startAudio === 'function') {
          this.room.startAudio().catch(() => {});
        }
      }
    };

    document.addEventListener('click', unlockAudio, { passive: true });
    document.addEventListener('touchend', unlockAudio, { passive: true });
  }

  /**
   * Connect to LiveKit Cloud for the specific room code.
   * Guarded with connection lock so rapid state updates NEVER interrupt active voice!
   */
  async joinRoom(roomCode, playerId) {
    if (!roomCode || !playerId) return;

    // GUARD 1: If already in or actively connecting to this room, do not reconnect!
    if (this.currentRoomCode === roomCode && (this.isConnected || this.isConnecting)) {
      return;
    }

    // GUARD 2: Prevent concurrent connection attempts
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.currentRoomCode = roomCode;
    this.currentPlayerId = playerId;

    if (!window.LivekitClient || !window.LivekitClient.Room) {
      console.warn('[VOICE] LiveKit SDK not loaded in browser.');
      this.isConnecting = false;
      return;
    }

    // If there is an existing room from another code, cleanly disconnect it first
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (e) {}
      this.room = null;
      this.isConnected = false;
    }

    // Fetch ephemeral room token from our secure backend
    client.socket.emit('voice:get_token', { roomCode, playerId }, async (res) => {
      if (!res || !res.success) {
        console.info('[VOICE] Token not returned:', res?.error);
        this.isConnecting = false;
        this.hideVoiceControls();
        return;
      }

      try {
        const { Room, RoomEvent } = window.LivekitClient;

        this.room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            autoGainControl: true,
            echoCancellation: true,
            noiseSuppression: true
          }
        });

        // 1. Subscribe to remote audio tracks with explicit mobile playsinline & autoplay
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'audio') {
            console.log(`[VOICE] Subscribed to audio track from: ${participant.name || participant.identity}`);
            
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.playsInline = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.setAttribute('webkit-playsinline', 'true');
            audioEl.setAttribute('data-participant-identity', participant.identity);

            track.attach(audioEl);

            const container = this.audioContainer || document.body;
            container.appendChild(audioEl);

            audioEl.play().catch(() => {
              console.log('[VOICE] Autoplay deferred until user interaction.');
            });
          }
        });

        // 2. Unsubscribe / cleanup detached tracks
        this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });

        // 3. Autoplay status listener (prompts audio start if browser blocked it)
        this.room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
          if (this.room && !this.room.canPlaybackAudio) {
            console.log('[VOICE] Audio playback restricted by mobile browser, will resume on touch.');
          }
        });

        // 4. Active Speakers Detection
        this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          this.handleActiveSpeakers(speakers);
        });

        // 5. Disconnect handler
        this.room.on(RoomEvent.Disconnected, () => {
          console.log('[VOICE] LiveKit room disconnected.');
          this.handleDisconnect();
        });

        // Connect to LiveKit Cloud SFU
        console.log(`[VOICE] Connecting to LiveKit Cloud room: ${res.roomName}...`);
        await this.room.connect(res.url, res.token);

        // Attempt initial audio start
        await this.room.startAudio().catch(() => {});

        // Start muted by default to preserve privacy
        this.isMuted = true;
        this.isConnected = true;
        this.isConnecting = false;

        this.showVoiceControls();
        this.updateUI();
        console.log(`[VOICE] Voice chat ready and connected to ${res.roomName}`);
      } catch (err) {
        console.error('[VOICE] Error connecting to LiveKit:', err);
        this.isConnecting = false;
        this.handleDisconnect();
      }
    });
  }

  /**
   * Leave voice channel cleanly.
   */
  async leaveRoom() {
    this.isConnecting = false;
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (e) {}
      this.room = null;
    }
    this.handleDisconnect();
  }

  /**
   * Toggle mute / unmute state with phone-friendly error handling.
   */
  async toggleMute() {
    if (!this.room || !this.room.localParticipant) {
      screens.showToast('Connecting voice...', 'info', 1200);
      return;
    }

    // Try starting audio context on user click
    if (typeof this.room.startAudio === 'function') {
      this.room.startAudio().catch(() => {});
    }

    try {
      const willMute = !this.isMuted;

      if (willMute) {
        await this.room.localParticipant.setMicrophoneEnabled(false);
        this.isMuted = true;
        screens.showToast('Microphone Muted 🔇', 'info', 1200);
      } else {
        // Explicit mobile-optimized constraints
        await this.room.localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        });
        this.isMuted = false;
        screens.showToast('Microphone Active 🎙️', 'success', 1200);
      }

      this.updateUI();
    } catch (err) {
      console.error('[VOICE] Microphone permission or publish error:', err);
      screens.showToast('Microphone permission blocked. Please check browser settings.', 'error', 3000);
    }
  }

  /**
   * Handle active speaker updates from LiveKit SFU.
   */
  handleActiveSpeakers(speakers) {
    const activeIdentities = new Set(speakers.map(s => s.identity));

    // Update local mic pulse rings
    const isLocalSpeaking = activeIdentities.has(this.currentPlayerId) && !this.isMuted;

    if (this.voicePulseRing) {
      if (isLocalSpeaking) {
        this.voicePulseRing.classList.add('speaking');
      } else {
        this.voicePulseRing.classList.remove('speaking');
      }
    }

    if (this.floatingPulse) {
      if (isLocalSpeaking) {
        this.floatingPulse.classList.add('speaking');
      } else {
        this.floatingPulse.classList.remove('speaking');
      }
    }

    // Update player cards in lobby and voting/discussion
    document.querySelectorAll('[data-player-id]').forEach((el) => {
      const playerId = el.getAttribute('data-player-id');
      if (activeIdentities.has(playerId)) {
        el.classList.add('is-speaking');
      } else {
        el.classList.remove('is-speaking');
      }
    });
  }

  updateUI() {
    if (!this.isConnected) {
      this.hideVoiceControls();
      return;
    }

    this.showVoiceControls();

    if (this.isMuted) {
      // Header pill
      if (this.btnVoiceToggle) {
        this.btnVoiceToggle.classList.remove('mic-active');
        this.btnVoiceToggle.classList.add('mic-muted');
      }
      if (this.voiceMicIcon) this.voiceMicIcon.textContent = '🔇';
      if (this.voiceStatusText) this.voiceStatusText.textContent = 'Muted';
      if (this.voicePulseRing) this.voicePulseRing.classList.remove('speaking');

      // Floating button
      if (this.btnFloatingToggle) {
        this.btnFloatingToggle.classList.remove('mic-active');
        this.btnFloatingToggle.classList.add('mic-muted');
      }
      if (this.floatingIcon) this.floatingIcon.textContent = '🔇';
      if (this.floatingText) this.floatingText.textContent = 'MUTED';
      if (this.floatingPulse) this.floatingPulse.classList.remove('speaking');
    } else {
      // Header pill
      if (this.btnVoiceToggle) {
        this.btnVoiceToggle.classList.remove('mic-muted');
        this.btnVoiceToggle.classList.add('mic-active');
      }
      if (this.voiceMicIcon) this.voiceMicIcon.textContent = '🎙️';
      if (this.voiceStatusText) this.voiceStatusText.textContent = 'Mic On';

      // Floating button
      if (this.btnFloatingToggle) {
        this.btnFloatingToggle.classList.remove('mic-muted');
        this.btnFloatingToggle.classList.add('mic-active');
      }
      if (this.floatingIcon) this.floatingIcon.textContent = '🎙️';
      if (this.floatingText) this.floatingText.textContent = 'MIC ON';
    }
  }

  showVoiceControls() {
    if (this.btnVoiceToggle) this.btnVoiceToggle.classList.remove('hidden');
    if (this.floatingWidget) this.floatingWidget.classList.remove('hidden');
  }

  hideVoiceControls() {
    if (this.btnVoiceToggle) this.btnVoiceToggle.classList.add('hidden');
    if (this.floatingWidget) this.floatingWidget.classList.add('hidden');
  }

  handleDisconnect() {
    this.isConnected = false;
    this.isConnecting = false;
    this.currentRoomCode = null;
    this.currentPlayerId = null;
    this.hideVoiceControls();

    // Clean up attached audio elements
    if (this.audioContainer) {
      this.audioContainer.innerHTML = '';
    }
    document.querySelectorAll('audio[data-participant-identity]').forEach((el) => el.remove());
    document.querySelectorAll('.is-speaking').forEach((el) => el.classList.remove('is-speaking'));
  }
}

export const voiceManager = new VoiceManager();
