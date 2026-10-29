/**
 * LiveKit Cloud Voice Chat Manager for Undercover
 * Provides encrypted, room-isolated voice chat with mute controls and active-speaker indicators.
 */

import { client } from './socketClient.js';
import { screens } from './screens.js';

class VoiceManager {
  constructor() {
    this.room = null;
    this.isMuted = true;
    this.isConnected = false;
    this.currentRoomCode = null;
    this.currentPlayerId = null;

    // DOM Elements
    this.btnVoiceToggle = null;
    this.voiceMicIcon = null;
    this.voiceStatusText = null;
    this.voicePulseRing = null;
  }

  init() {
    this.btnVoiceToggle = document.getElementById('btn-voice-toggle');
    this.voiceMicIcon = document.getElementById('voice-mic-icon');
    this.voiceStatusText = document.getElementById('voice-status-text');
    this.voicePulseRing = document.getElementById('voice-pulse-ring');

    if (this.btnVoiceToggle) {
      this.btnVoiceToggle.addEventListener('click', () => this.toggleMute());
    }

    // Attempt to unlock audio on first document interaction (mobile iOS/Android requirement)
    const unlockAudio = () => {
      if (this.room && typeof this.room.startAudio === 'function') {
        this.room.startAudio().catch(() => {});
      }
    };
    document.addEventListener('click', unlockAudio, { once: false, passive: true });
    document.addEventListener('touchstart', unlockAudio, { once: false, passive: true });
  }

  /**
   * Connect to LiveKit Cloud for the specific room code.
   * Voice tracks are cryptographically isolated strictly to undercover_<roomCode>.
   */
  async joinRoom(roomCode, playerId) {
    if (!roomCode || !playerId) return;

    // If already connected to this room, no need to reconnect
    if (this.isConnected && this.currentRoomCode === roomCode && this.currentPlayerId === playerId) {
      return;
    }

    // Leave any previous voice room
    await this.leaveRoom();

    this.currentRoomCode = roomCode;
    this.currentPlayerId = playerId;

    if (!window.LivekitClient || !window.LivekitClient.Room) {
      console.warn('[VOICE] LiveKit SDK not available in window. Voice chat disabled.');
      return;
    }

    // Request ephemeral room token from our secure server
    client.socket.emit('voice:get_token', { roomCode, playerId }, async (res) => {
      if (!res || !res.success) {
        console.info('[VOICE] Voice chat not active or not configured on server:', res?.error);
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

        // 1. Subscribe to remote audio tracks
        this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'audio') {
            console.log(`[VOICE] Subscribed to audio from: ${participant.name || participant.identity}`);
            const el = track.attach();
            el.setAttribute('data-participant-identity', participant.identity);
            document.body.appendChild(el);
          }
        });

        // 2. Unsubscribe / cleanup detached tracks
        this.room.on(RoomEvent.TrackUnsubscribed, (track) => {
          track.detach().forEach((el) => el.remove());
        });

        // 3. Active Speakers Detection (shows who is talking!)
        this.room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          this.handleActiveSpeakers(speakers);
        });

        // 4. Handle Disconnect
        this.room.on(RoomEvent.Disconnected, () => {
          console.log('[VOICE] Disconnected from voice room');
          this.handleDisconnect();
        });

        // Connect to LiveKit Cloud WebRTC SFU
        console.log(`[VOICE] Connecting to LiveKit Cloud for room: ${res.roomName}...`);
        await this.room.connect(res.url, res.token);

        // Try unlocking audio in case of autoplay restrictions
        await this.room.startAudio().catch(() => {});

        // Start with microphone muted by default for privacy
        this.isMuted = true;
        await this.room.localParticipant.setMicrophoneEnabled(false).catch(() => {});

        this.isConnected = true;
        this.showVoiceControls();
        this.updateUI();
        console.log(`[VOICE] Successfully connected to room voice channel: ${res.roomName}`);
      } catch (err) {
        console.error('[VOICE] Failed to connect to LiveKit Cloud:', err);
        this.handleDisconnect();
      }
    });
  }

  /**
   * Leave voice channel and clean up tracks.
   */
  async leaveRoom() {
    if (this.room) {
      try {
        await this.room.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      this.room = null;
    }
    this.handleDisconnect();
  }

  /**
   * Toggle mute / unmute state.
   */
  async toggleMute() {
    if (!this.room || !this.room.localParticipant) {
      screens.showToast('Voice chat is connecting...', 'info');
      return;
    }

    try {
      const willMute = !this.isMuted;

      if (willMute) {
        await this.room.localParticipant.setMicrophoneEnabled(false);
        this.isMuted = true;
        screens.showToast('Microphone Muted 🔇', 'info', 1800);
      } else {
        await this.room.localParticipant.setMicrophoneEnabled(true);
        this.isMuted = false;
        screens.showToast('Microphone Active 🎙️', 'success', 1800);
      }

      this.updateUI();
    } catch (err) {
      console.error('[VOICE] Error toggling microphone:', err);
      screens.showToast('Could not access microphone. Please check browser permissions.', 'error');
    }
  }

  /**
   * Handle active speaker updates from LiveKit SFU.
   */
  handleActiveSpeakers(speakers) {
    const activeIdentities = new Set(speakers.map(s => s.identity));

    // Update local mic pulse ring
    if (this.voicePulseRing) {
      if (activeIdentities.has(this.currentPlayerId) && !this.isMuted) {
        this.voicePulseRing.classList.add('speaking');
      } else {
        this.voicePulseRing.classList.remove('speaking');
      }
    }

    // Update player cards / pills in lobby and game
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
    if (!this.btnVoiceToggle) return;

    if (!this.isConnected) {
      this.btnVoiceToggle.classList.add('hidden');
      return;
    }

    this.btnVoiceToggle.classList.remove('hidden');

    if (this.isMuted) {
      this.btnVoiceToggle.classList.remove('mic-active');
      this.btnVoiceToggle.classList.add('mic-muted');
      if (this.voiceMicIcon) this.voiceMicIcon.textContent = '🔇';
      if (this.voiceStatusText) this.voiceStatusText.textContent = 'Muted';
      if (this.voicePulseRing) this.voicePulseRing.classList.remove('speaking');
    } else {
      this.btnVoiceToggle.classList.remove('mic-muted');
      this.btnVoiceToggle.classList.add('mic-active');
      if (this.voiceMicIcon) this.voiceMicIcon.textContent = '🎙️';
      if (this.voiceStatusText) this.voiceStatusText.textContent = 'Mic On';
    }
  }

  showVoiceControls() {
    if (this.btnVoiceToggle) this.btnVoiceToggle.classList.remove('hidden');
  }

  hideVoiceControls() {
    if (this.btnVoiceToggle) this.btnVoiceToggle.classList.add('hidden');
  }

  handleDisconnect() {
    this.isConnected = false;
    this.currentRoomCode = null;
    this.currentPlayerId = null;
    this.hideVoiceControls();

    // Remove any attached remote audio elements
    document.querySelectorAll('audio[data-participant-identity]').forEach((el) => el.remove());
    // Clear speaking badges
    document.querySelectorAll('.is-speaking').forEach((el) => el.classList.remove('is-speaking'));
  }
}

export const voiceManager = new VoiceManager();
