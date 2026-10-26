# 🎭 UNDERCOVER — Wi-Fi Multiplayer Party Game

A thrilling, self-contained browser-based social deduction party game for 3–6 players playing in the same room over home Wi-Fi.

The game runs locally on the host's Windows 11 machine. Friends simply connect their smartphones or tablets to the same Wi-Fi network and open the host's local URL in any modern mobile browser (Safari, Chrome, Firefox, Edge).

---

## 🚀 Quick Start Guide

### 1. One-Click Desktop Shortcut
Double-click the **UNDERCOVER Party Game** shortcut directly on your Windows Desktop! It automatically starts the server and launches your browser.
Alternatively, launch `start.bat` in the project folder or run:
```bash
node server.js
```
The terminal will display your active Wi-Fi LAN address, for example:
```
👉 http://192.168.1.9:3000
```

### 2. Connect Mobile Players
1. Ensure all players' phones are connected to the same Wi-Fi network as the host laptop.
2. Open mobile browsers and navigate to: `http://<HOST_IP>:3000` (e.g. `http://192.168.1.9:3000`).
3. One player creates a room; other players enter the 4-letter room code to join.
4. Once everyone taps **"Mark Ready"**, the host starts the match!

### 3. In-Game Host Controls (Restart Game Anytime)
During any active match, the host has a dedicated top bar control to:
- **`🔄 Restart Game`**: Immediately re-deals new secret words and roles, restarting Round 1 with a fresh slate.
- **`🏠 Exit to Lobby`**: Aborts the match and safely brings all players back to the room lobby.

---

## 🛠️ Network & Firewall Configuration

Undercover binds to `0.0.0.0:3000`, accepting incoming TCP traffic from both `localhost` and your local area network (LAN).

### If Mobile Phones Cannot Connect:
Windows Defender Firewall may block incoming connections on port 3000 by default. To safely allow port 3000 on your **Private (Home) network only**:

1. Open PowerShell or Command Prompt as **Administrator**.
2. Run:
```cmd
netsh advfirewall firewall add rule name="Undercover Party Game" dir=in action=allow protocol=TCP localport=3000 profile=private
```
3. Run `check-network.bat` to verify your adapter and port availability.

---

## 📖 Game Rules & How to Play

### 1. Secret Roles & Words
- **Civilians**: Receive the primary secret word (e.g., *Mango*).
- **Undercover(s)**: Receive a closely related secret word (e.g., *Papaya*).
- Roles and words are kept strictly confidential on each player's private screen.

### 2. Clue Round
- Living players take turns giving a single subtle clue.
- **Goal for Civilians**: Identify players whose clues seem slightly off.
- **Goal for Undercover**: Blend in without knowing the Civilians' exact word!

### 3. Discussion & Voting
- A visual countdown timer (30s–90s) prompts open debate.
- Players cast secret votes on mobile screens. Self-voting is blocked.
- The player with the most votes is eliminated and their true role is revealed!

### 4. Ties & Win Conditions
- **Ties**: If voting results in a tie, a rapid **Tie Revote** is triggered among the tied candidates.
- **Civilians Win**: When all Undercovers are eliminated.
- **Undercover Wins**: When living Undercovers equal or outnumber living Civilians.

---

## 🧪 Automated Testing

Undercover comes with automated unit, security, and multi-client simulation suites using Node's native test runner (`node:test`):

```bash
# Run logic, room, and security isolation tests
npm test

# Run 3-player automated match simulation
npm run sim

# Run 4-player tie revote & restart match simulation
npm run sim:tie
```

---

## 🔒 Security & Privacy Architecture
- **Server Authority**: The server is the sole arbiter of roles, votes, and state transitions.
- **Zero Secret Leakage**: Role identities and secret words are never broadcast over public room channels. Only the individual recipient socket receives private role packets.
- **Session Tokens**: Players can safely refresh their mobile browsers or recover from transient Wi-Fi drops without losing their slot or secret words.
