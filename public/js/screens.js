/**
 * Screen and UI Phase Transition Manager.
 * Controls which screen or game phase view is active, handles modals and toasts.
 */

class ScreenManager {
  constructor() {
    this.screens = {
      home: document.getElementById('screen-home'),
      create: document.getElementById('screen-create'),
      join: document.getElementById('screen-join'),
      lobby: document.getElementById('screen-lobby'),
      game: document.getElementById('screen-game')
    };

    this.phaseViews = {
      role_reveal: document.getElementById('phase-role-reveal'),
      clue_round: document.getElementById('phase-clue-round'),
      discussion: document.getElementById('phase-discussion'),
      voting: document.getElementById('phase-voting'),
      elimination: document.getElementById('phase-elimination'),
      game_over: document.getElementById('phase-game-over')
    };

    this.roomBadge = document.getElementById('room-badge');
    this.navRoomCode = document.getElementById('nav-room-code');
    this.toastContainer = document.getElementById('toast-container');
    this.currentScreen = 'home';
    this.currentPhase = null;
  }

  showScreen(screenName) {
    if (!this.screens[screenName]) {
      console.warn(`Screen ${screenName} not found.`);
      return;
    }

    Object.entries(this.screens).forEach(([name, el]) => {
      if (el) {
        if (name === screenName) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    this.currentScreen = screenName;
    window.scrollTo(0, 0);
  }

  showPhase(phaseName) {
    // Ensure game screen is active
    this.showScreen('game');

    Object.entries(this.phaseViews).forEach(([name, el]) => {
      if (el) {
        if (name === phaseName) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });

    this.currentPhase = phaseName;
    window.scrollTo(0, 0);
  }

  updateNavRoom(roomCode) {
    if (roomCode) {
      if (this.navRoomCode) this.navRoomCode.textContent = roomCode;
      if (this.roomBadge) this.roomBadge.classList.remove('hidden');
    } else {
      if (this.roomBadge) this.roomBadge.classList.add('hidden');
    }
  }

  showToast(message, type = 'info', duration = 3000) {
    if (!this.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
    toast.textContent = message;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, duration);
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('hidden');
    }
  }
}

export const screens = new ScreenManager();
