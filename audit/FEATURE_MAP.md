# Undercover Party Game — Feature Map & Inventory
**Audit Phase 0 Discovery Document**

## 1. Product Identification
- **Product Name:** Undercover (Multiplayer Social Deduction Party Game)
- **Architecture:** Node.js Express server + Socket.IO WebSockets + LiveKit Cloud WebRTC Voice Chat + Vanilla ES Module Frontend + PWA.
- **Port / Host:** Port `3000`, `0.0.0.0`
- **Max Capacity:** 6 Players (`RoomManager.MAX_PLAYERS = 6`)
- **Min Players:** 3 Players
- **Max + 1 Rejection Target:** 7 Players

---

## 2. Screens & View Hierarchy

| Screen ID | Name / Purpose | Key Components & Sub-elements |
|---|---|---|
| `#screen-home` | Home / Landing | Hero title, `#btn-goto-create`, `#btn-goto-join`, `#btn-open-rules`, `#btn-pwa-install-home` |
| `#screen-create` | Create Room Form | `#create-nickname` (2–16 chars), `#create-max-players` (3–6), `#create-undercover-count` (1–2), `#create-category` (7 categories), `#create-discussion-time` (30–90s), `#btn-submit-create`, `.btn-nav-back` |
| `#screen-join` | Join Room Form | `#join-room-code` (4 uppercase alphanumeric), `#join-nickname` (2–16 chars), `#btn-submit-join`, `.btn-nav-back` |
| `#screen-lobby` | Lobby Room | `#lobby-code`, `#btn-copy-code`, `#lobby-player-count`, `#lobby-category-badge`, `#lobby-players-grid` (avatar, name, host badge, ready badge, kick button for host), `#btn-toggle-ready`, `#btn-start-game` (host only), `#btn-leave-lobby`, `#lobby-host-controls` (category & undercover count dropdowns) |
| `#screen-game` | Active Match Hub | Header with `#game-round-num`, `#game-phase-badge`, `#game-timer-container`, `#in-game-host-bar` (`#btn-ingame-restart`, `#btn-ingame-lobby`), `#in-game-player-bar` (`#btn-leave-game`), `#game-ending-banner` |
| ↳ `#phase-role-reveal` | Subview 1: Role Reveal | `#secret-card` (3D flip card front/back), `#player-role-badge`, `#player-secret-word`, `#player-word-description`, `#player-role-description`, `#btn-confirm-role`, `#role-reveal-players-list` (readiness status) |
| ↳ `#phase-clue-round` | Subview 2: Clue Round | `#current-turn-player-name`, `#my-clue-box` (active turn only), `#input-clue-text`, `#form-submit-clue`, `#clues-list` (chronological player clue cards) |
| ↳ `#phase-discussion` | Subview 3: Open Discussion | `#discussion-countdown` (30–90s timer dial), `#btn-host-skip-discussion` (Vote Now early trigger), `#discussion-clues-list` |
| ↳ `#phase-voting` | Subview 4: Voting | `#voting-candidates-grid` (living player cards, self disabled, radio select), `#btn-submit-vote`, `#btn-host-close-voting` (host fallback) |
| ↳ `#phase-elimination` | Subview 5: Elimination Reveal | `#elimination-title`, `#elimination-body`, `#vote-breakdown` (voter -> target breakdown), `#btn-continue-round` (host only), `#elimination-tie-actions` (`#btn-start-tie-revote`) |
| ↳ `#phase-game-over` | Subview 6: Game Over | `#victory-team-title`, `#victory-team-subtitle`, `#final-civ-word`, `#final-und-word`, `#final-roles-grid`, `#final-leaderboard`, `#btn-next-match` (host only), `#btn-return-lobby` (host only) |
| `#modal-rules` | Rules Modal | `#btn-close-rules`, `#btn-close-rules-footer`, game guide content |
| Global Audio / Voice | Header & Floating Controls | `#btn-voice-toggle` (header mic), `#btn-floating-voice-toggle` (mobile floating thumb widget), `#btn-audio-toggle` (sound FX), `#livekit-audio-elements` container |

---

## 3. Real-Time Socket.IO Protocol Events

### Client-to-Server
1. `room:create` `{ nickname, settings }`
2. `room:join` `{ roomCode, nickname }`
3. `room:reconnect` `{ roomCode, playerId, sessionToken }`
4. `room:ready_toggle` `{ roomCode }`
5. `room:start_game` `{ roomCode }`
6. `room:kick` `{ roomCode, targetId }`
7. `room:leave` `{ roomCode }`
8. `room:settings_update` `{ roomCode, settings }`
9. `room:get_voice_token` `{ roomCode }`
10. `game:confirm_role` `{ roomCode }`
11. `game:submit_clue` `{ roomCode, clue }`
12. `game:submit_vote` `{ roomCode, targetId }`
13. `game:vote_now` `{ roomCode }`
14. `game:host_close_voting` `{ roomCode }`
15. `game:continue_round` `{ roomCode }`
16. `game:start_tie_revote` `{ roomCode }`
17. `game:rematch` `{ roomCode }`
18. `game:return_lobby` `{ roomCode }`
19. `game:in_game_restart` `{ roomCode }`
20. `game:leave_game` `{ roomCode }`

### Server-to-Client Broadcasts
1. `room:created` `{ roomCode, playerId, sessionToken, settings }`
2. `room:joined` `{ roomCode, playerId, sessionToken, room }`
3. `room:reconnected` `{ roomCode, playerId, room, gameState }`
4. `room:lobby_update` `{ roomCode, hostId, players, settings, isReady }`
5. `room:error` `{ message }`
6. `room:kicked`
7. `room:voice_token` `{ token, url, roomName }`
8. `game:started`
9. `game:role_assigned` `{ role, word, description, roleDescription }` *(Strictly private to socket)*
10. `game:state_update` `publicState` *(Zero secret leakage: no roles, words, or undercoverId)*
11. `game:turn_change` `{ currentTurnPlayerId, turnIndex, timer }`
12. `game:timer_tick` `{ remaining }`
13. `game:elimination` `{ eliminatedPlayer, role, tie, tiedPlayers }`
14. `game:game_over` `{ winner, civilianWord, undercoverWord, roles, scores }`
15. `game:player_left` `{ leaverId, leaverNickname, remainingCount }`
16. `game:ending_countdown` `{ reason, seconds, leaverName, remainingCount }`
17. `game:ending_tick` `{ remaining }`
18. `game:nav_lobby`

---

## 4. Voice Chat (LiveKit Cloud) Integration
- **Server:** Issues JWT AccessToken scoped to room `undercover_${roomCode}` with `canPublish: true`, `canSubscribe: true`.
- **Client:** `VoiceManager` singleton manages connection locks, WebRTC audio track attach/detach, touch gesture audio unlocks, and microphone mute/unmute state.
- **UI:** Header button (`#btn-voice-toggle`) + Mobile floating thumb action button (`#btn-floating-voice-toggle`).

---

## 5. Constraints & Test Matrix

| Condition | Test Target | Expected Result |
|---|---|---|
| 1 Player in Lobby | Host clicks start | Rejected: `Need at least 3 players` |
| 2 Players in Lobby | Host clicks start | Rejected: `Need at least 3 players` |
| 4 Players (Midpoint) | Full game flow | Match completes cleanly |
| 5 Players (Max - 1) | 2 Undercovers setting | Match completes cleanly |
| 6 Players (Max Capacity) | Simultaneous match | 6 players connected, all actions sync, game finishes |
| 7 Players (Max + 1) | Join attempt | Rejected: `Room is full` (Zero crash) |
| Rapid Clicks (50x-100x) | Start/Join/Vote/Mic | Debounced/Guarded, no state duplication |
| Undercover Leaves mid-game | Player leaves | 5-second countdown aborts match to lobby |
| Civilian Leaves mid-game (4+p) | Player leaves | Notification shown, match continues with remaining players |
| Rapid Mic Toggle (50x) | Floating mic button | Accurate mute state, zero unhandled promise rejections |

