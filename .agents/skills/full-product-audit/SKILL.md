---
name: full-product-audit
description: Exhaustively test and audit any app, game, website, or tool that was built, finding bugs, glitches, crashes, and edge-case failures before declaring it finished. Use this skill whenever the user asks to test, QA, audit, verify, stress-test, debug, or "make sure it works" for anything built in the project, and ALWAYS run it before declaring any app, game, site, API, extension, or bot complete, even if the user does not explicitly ask for testing. Covers every function, button spam and rapid-click testing, multiplayer testing at the maximum allowed player count, voice/mic/audio features (mute, unmute, permissions, device switching), forms, navigation, state, responsiveness, performance, accessibility, and security basics. Only after all checks pass does it issue a final "PRODUCT FINISHED" verdict.
---

# Full Product Audit

You are a relentless QA engineer. Your job is to **break the product before a real user does**. Do not assume anything works. Prove it by running it, interacting with it, and recording evidence. Never declare the product finished until every phase below is complete and all blocking bugs are fixed and re-verified.

## Core rules

1. **Test by doing, not by reading.** Reading code is not testing. Run the app, use the browser/agent tools to click, type, and observe. Use Antigravity's browser agent, terminal, and test runners.
2. **Test everything.** Every page, screen, button, link, input, menu, setting, shortcut, API endpoint, and feature. If it exists, it gets tested.
3. **Think like an attacker, a toddler, and an impatient user.** Click wrong things, click too fast, enter garbage, go backwards, refresh mid-action, lose connection.
4. **Every bug found gets fixed, then re-tested**, and the surrounding area is regression-tested too.
5. **Keep evidence.** Log each test, result, and screenshot or console output in the audit report (see Report Format).
6. **No false "done".** If anything could not be tested (missing hardware, no permission, no network), mark it **UNVERIFIED** and say why. Unverified items must be listed in the final verdict.

---

## Phase 0: Discover and map the product

Before testing, build a complete inventory.

- Identify product type: web app, mobile app, desktop app, game (single or multiplayer), API/backend, CLI, extension, bot, or a mix.
- Read the project structure, README, routes, components, and config.
- List **every** feature and interactive element. Create a checklist file `audit/FEATURE_MAP.md` with:
  - Pages/screens/scenes
  - Buttons, links, toggles, inputs, menus, modals
  - API endpoints and background jobs
  - Authentication/roles/permissions
  - Real-time features (websockets, multiplayer, chat, voice, video, notifications)
  - Settings and persistence (localStorage, DB, cloud saves)
  - Third-party integrations (payments, maps, auth providers)
- Detect max limits from code/config: max players, max file size, max characters, rate limits, max items, level caps, etc. These drive Phase 4 and Phase 5.
- Identify how to run it (install, build, start commands) and get it running cleanly from a **fresh state** (clean install, empty storage/database).

## Phase 1: Build, launch, and baseline health

- Run a clean install and a production build. Zero errors; review all warnings.
- Launch the product. Check the console/terminal/logs for errors, warnings, failed requests, 404s, unhandled promise rejections, memory warnings.
- Run existing unit/integration/e2e tests. Record failures.
- Run linter and type-checker. Fix real issues.
- Verify first-load experience: loads without crash, correct title, favicon, no broken images/assets/fonts.

## Phase 2: Functional testing (every function)

For **each item in FEATURE_MAP.md**, test:

- **Happy path:** does it do exactly what it should?
- **Every button/link/control:** click it. Confirm the result, the UI update, and any side effect (data saved, request sent, sound played).
- **Forms and inputs:** valid input, empty input, whitespace only, very long input (10k+ chars), special characters, emoji, unicode/RTL text, SQL/HTML/script injection strings, negative numbers, zero, decimals, huge numbers, wrong types, copy-paste, autofill.
- **Navigation:** every route, back/forward buttons, deep links, refresh on every page, invalid URLs (404 page), redirects, protected routes when logged out.
- **State:** does state persist/reset correctly after refresh, logout/login, closing and reopening, and switching tabs?
- **CRUD cycles:** create, read, update, delete, then confirm deletion is real and nothing orphaned remains.
- **Auth flows:** sign up, login, logout, wrong password, password reset, session expiry, multiple tabs, multiple devices.
- **Search/filter/sort/pagination:** empty results, one result, thousands of results, last page, out-of-range page.
- **Files:** upload valid, invalid type, too large, empty, duplicate, corrupted; download and verify the content.
- **Payments/external services (if any):** use test mode; test success, failure, cancel, timeout, and duplicate submission.
- **Error handling:** every failure should show a clear message, not a blank screen or a stack trace.
- **Dead features:** flag any button/link/menu that does nothing, placeholder text (lorem ipsum, TODO), or unfinished UI.

## Phase 3: Repetition, spam, and race-condition testing

Real users click fast and often. For **every** interactive control, especially submit, buy, save, delete, like, send, fire/attack, start, join, and restart:

1. **Rapid repeat clicking:** click the same button 10, 50, then 100+ times as fast as possible. Then try double-click and triple-click.
   - Does it duplicate the action (double purchase, duplicate post, duplicate score, duplicate request)?
   - Does it freeze, crash, lag, or desync the UI?
   - Does a loading/disabled state properly prevent repeat submissions?
   - Does the counter, score, balance, inventory, or cooldown stay correct?
2. **Hold-down and key mashing:** hold keys/buttons, mash multiple keys at once, alternate buttons quickly.
3. **Cross-button chaos:** click different buttons in rapid sequence, click while something is loading, click during animations and transitions, open and close modals repeatedly.
4. **Interrupt testing:** refresh, navigate away, or close mid-request; press back during a submit; cancel then immediately retry.
5. **Concurrency:** two tabs/sessions doing the same action at once (e.g., buying the last item, editing the same record, joining the same slot). Look for race conditions, double-spend, and lost updates.
6. **Timing abuse:** rapid toggling (on/off 50 times), spamming enter on forms, spamming API calls. Check rate limiting and debouncing.
7. **Verify server-side and database:** confirm in logs/DB that repeated clicks did not create duplicate or corrupt records, not just that the UI looked fine.

## Phase 4: Game-specific testing (if the product is a game)

- **Core loop:** start, play, win, lose, restart, quit, pause, resume, many times in a row.
- **Controls:** every input method (keyboard, mouse, touch, gamepad), simultaneous key presses, rebinding, held keys, focus loss mid-game.
- **Rules and logic:** scoring, health, timers, levels, win/lose conditions, power-ups, inventory, currency, progression, unlocks. Test boundaries (score at max, health at 0 and below, negative values, integer overflow).
- **Physics/collisions:** clipping through walls, getting stuck, falling out of the map, extreme speeds, edge-of-map behavior, spawn-point blocks.
- **Exploits:** can the player skip a level, duplicate items, gain infinite resources, pause to cheat, or break progression?
- **AI/enemies:** pathfinding failures, enemies stuck, impossible waves, spawning in walls.
- **Save/load:** save mid-action, load corrupted/old saves, save then quit instantly, multiple slots.
- **Performance:** frame rate over a long session (30+ minutes if feasible), memory growth, many entities on screen, maximum particle/enemy load, tab backgrounding and returning.
- **Audio/visual:** missing sounds, looping glitches, overlapping audio, animation stalls, z-order and rendering artifacts, different resolutions and aspect ratios, fullscreen toggle.

## Phase 5: Multiplayer testing (if applicable)

If there is **any** multiplayer, co-op, lobby, matchmaking, chat, or real-time collaborative feature, test it with **real simulated clients**. Use scripts, multiple browser sessions/profiles, headless clients, or bots (e.g., Playwright/Puppeteer contexts, socket clients) to simulate players.

1. **Find the maximum player limit** from code/config (e.g., `MAX_PLAYERS`). Test at these counts: **1, 2, the midpoint, max − 1, max, and max + 1.**
2. **At max players:**
   - All players join, move, act, chat, and use abilities **simultaneously**.
   - Check sync: do all clients see the same state (positions, scores, health, items)? Detect desync and rubber-banding.
   - Check server CPU, memory, bandwidth, tick rate, and latency under full load.
   - Run for an extended session (and through multiple rounds/matches) to catch leaks.
3. **At max + 1:** the extra player must be rejected cleanly with a clear message, never crash the room or corrupt state.
4. **Join/leave chaos:** players join and leave rapidly; the host leaves; the last player leaves; everyone leaves at once; reconnect after disconnect; join mid-game; join a full or ended room; duplicate usernames; same account on two devices.
5. **Network conditions:** simulate high latency, packet loss, jitter, and sudden disconnects. Check reconnection, timeouts, and state recovery.
6. **Fairness and cheating:** is the server authoritative? Try sending impossible values (speed hacks, teleporting, negative damage, spoofed messages). Test spam of actions and chat messages from every player at once.
7. **Lobby/matchmaking:** create, join, leave, ready/unready spam, start-game spam, kick, ban, private/public rooms, invite links, room codes (invalid, expired, case sensitivity).
8. **Turn-based/ordering logic:** simultaneous actions, ties, same-tick conflicts, who wins when two players act at the same instant.
9. **Game end:** win/lose/draw for all players, score sync, rematch, return to the lobby, and cleanup of the room afterward.
10. **Run multiple full matches back to back** at max capacity.

## Phase 6: Voice, audio, and media testing (if applicable)

If the product has voice chat, calls, recording, speech recognition, text-to-speech, music, or video, test all of the following:

**Microphone and voice**
- Mic permission: **allow, deny, block-then-unblock, revoke mid-session**, and "ask again." Denial must show a helpful message, never a crash.
- **Mute / unmute:** the button works, the icon state matches the real state, muted audio is truly **not transmitted** (verify on the receiving side), and state persists correctly.
- **Rapid mute/unmute toggling** (50+ times): no stuck state, no leaked audio, no desync between UI and actual stream.
- Mute on join, mute before join, and mute while speaking; push-to-talk if present; deafen/undeafen; server-side mute by host/admin; self-mute vs forced-mute precedence.
- **Device handling:** switch mic and speaker mid-call, unplug/plug headset, Bluetooth connect/disconnect, no mic present, multiple mics, default device change.
- **Volume controls:** per-user volume, master volume, zero volume, max volume; mic input level indicator and voice-activity ("speaking") indicator accuracy.
- Voice quality issues: echo, feedback loops, clipping, delay, noise; echo cancellation, noise suppression, and auto-gain settings (if exposed).
- **Multiple speakers:** all players talking at once at max capacity; check audio mixing, CPU load, and dropped streams.
- Join/leave/reconnect during voice; network drop and recovery; tab in background; screen lock; page refresh mid-call; two tabs with the same account.
- Voice in lobby vs in-game vs spectator channels, if they exist; correct routing (team vs all, proximity if used).
- Recording/transcription/TTS (if present): start, stop, cancel, long input, unsupported language, silence, background noise, interrupted speech.

**Other audio/video**
- Play, pause, stop, seek, loop, mute, volume, autoplay-policy behavior, overlapping sounds, sounds continuing after navigation or game end.
- Camera/video: permission flows, on/off toggle spam, device switching, screen share start/stop, resolution changes.

If real microphone hardware is unavailable in the test environment, use fake media streams (e.g., browser fake-device flags) and mark any physical-hardware behavior as **UNVERIFIED** in the report.

## Phase 7: Cross-environment and responsiveness

- **Browsers:** Chromium, Firefox, WebKit/Safari at minimum (for web).
- **Viewports:** mobile (320px, 375px, 414px), tablet, laptop, desktop, ultrawide; portrait and landscape; zoom 50% to 200%.
- **Input types:** mouse, keyboard-only, touch.
- **Layout:** no overflow, clipped text, overlapping elements, unreachable buttons, broken scrolling, or sticky elements covering content.
- **Dark/light mode, language/locale, timezone, and long or short text** in all places.
- **OS/platform specifics** for desktop or mobile apps (install, uninstall, update, permissions, background/foreground, notifications, offline launch).

## Phase 8: Network, reliability, and data integrity

- Offline mode and going offline mid-action; slow 3G; request timeouts; server 500s, 404s, and 429s; API returning malformed or empty data.
- Retry logic, loading and empty and error states for every data-driven view.
- Data integrity: no data loss on refresh/crash, no duplicate records, correct totals and calculations, correct date/time and timezone handling, currency and rounding.
- Backend/API: test every endpoint with valid, invalid, missing, and oversized payloads, and with and without auth. Check status codes and error formats.
- Long-session test: leave it running for an extended period; watch memory, CPU, open connections, and log growth.

## Phase 9: Security and privacy basics

- Authentication and authorization: can a user reach another user's data or admin routes by changing a URL or ID?
- Injection and XSS in every input; CSRF where relevant; secrets or API keys exposed in client code, logs, or repos.
- Rate limiting on login, signup, and expensive endpoints; file upload restrictions; CORS configuration.
- Permissions requested are minimal and explained; sensitive data is not logged or stored in plain text.
- Dependencies: run an audit (e.g., `npm audit`) and review critical or high findings.

## Phase 10: Performance and accessibility

- **Performance:** load time, time to interactive, bundle size, slow queries, memory leaks, heavy re-renders, large lists, image optimization. Run Lighthouse or an equivalent profiler.
- **Accessibility:** keyboard navigation and visible focus order, labels and alt text, color contrast, screen-reader basics, no keyboard traps, reduced-motion respect, captions for audio/video where appropriate.

## Phase 11: Fix, re-test, and regress

1. Classify each bug: **Blocker** (crash, data loss, security, core feature broken), **Major** (feature broken with workaround), **Minor** (cosmetic, rare edge case).
2. Fix every Blocker and Major bug. Fix Minor bugs unless the user explicitly defers them.
3. After each fix, **re-run the failing test** plus related tests (regression).
4. After all fixes, **re-run the full audit from Phase 1** one more time on a clean state. A single pass that finds zero new Blocker or Major issues is required before finishing. If new bugs appear, repeat the loop.
5. Add automated tests for each bug found so it cannot return (unit, integration, or e2e).

---

## Report format

Create `audit/AUDIT_REPORT.md` and keep it updated:

```markdown
# Audit Report: <product name>
Date: <date> | Version/commit: <id> | Audit rounds: <n>

## Summary
- Total tests run: X | Passed: X | Failed (fixed): X | Unverified: X
- Bugs found: X (Blocker: X, Major: X, Minor: X) | Fixed: X | Deferred: X

## Coverage
| Phase | Status | Notes |
|-------|--------|-------|
| 1 Build and baseline | Done | |
| 2 Functional | Done | |
| 3 Repetition/spam | Done | |
| 4 Game | Done / N/A | |
| 5 Multiplayer (max players = N) | Done / N/A | |
| 6 Voice/mic/audio | Done / N/A | |
| 7 Cross-environment | Done | |
| 8 Network and data | Done | |
| 9 Security | Done | |
| 10 Performance and a11y | Done | |

## Bugs
### BUG-001: <title>
- Severity: Blocker | Major | Minor
- Where: <page/feature/file>
- Steps to reproduce: 1... 2... 3...
- Expected vs actual:
- Evidence: <screenshot/log/recording>
- Fix: <what changed> | Re-test: Pass

## Unverified items
- <item> and why it could not be tested

## Test log
| ID | Feature | Test | Result | Evidence |
```

## Final verdict (completion gate)

The product may be declared finished **only if all of these are true**:

- [ ] Every phase that applies was completed (non-applicable phases marked N/A with a reason)
- [ ] Every item in `FEATURE_MAP.md` was tested
- [ ] Repetitive-click, spam, and race-condition tests were run on all key controls
- [ ] Multiplayer was tested at max players and max + 1 (if applicable)
- [ ] Voice, mic, mute/unmute, and device tests were completed (if applicable)
- [ ] Zero open Blocker or Major bugs
- [ ] A final full clean re-run found no new Blocker or Major issues
- [ ] Build, lint, and all automated tests pass
- [ ] Any UNVERIFIED items are listed honestly

When every box is checked, output this statement:

```
✅ PRODUCT FINISHED
Full audit completed across <n> rounds, <X> tests run, <Y> bugs found and fixed.
Max-capacity multiplayer: <tested at N players / N/A>
Voice/mic features: <tested / N/A>
Known limitations / unverified: <list or "none">
Full report: audit/AUDIT_REPORT.md
```

If any box is unchecked, do **not** say the product is finished. Instead output:

```
⚠️ NOT YET FINISHED
Open issues: <list>
Next steps: <what remains>
```

Be honest. A truthful "not finished" is always better than a false "finished."
