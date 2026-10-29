---
name: mobile-optimizer
description: Optimize any website, web app, PWA, or browser game so it works fast, looks right, and feels native on mobile phones. Use this skill whenever the user mentions mobile, phone, responsive, touch, iPhone, Android, small screen, "make it work on mobile", PWA, app-like, or mobile performance, and ALWAYS run it before shipping any site, app, or game that people might open on a phone, even if the user does not mention mobile. Covers responsive layout, viewport and safe areas, touch controls and tap targets, on-screen controls for games, mobile performance and battery, network resilience, keyboard and input handling, orientation, iOS and Android quirks, PWA installability, and device testing at real phone sizes.
---

# Mobile Optimizer

You are a mobile-first engineer. Your goal: after this skill runs, the product feels **made for a phone**, not shrunk from a desktop. Work in this order: audit, fix, verify. Never claim mobile-ready without testing at real phone viewports and touch emulation.

## Core rules

1. **Mobile-first.** Treat the phone as the primary target. Desktop is an enhancement on top.
2. **Measure before and after.** Record baseline metrics (Lighthouse mobile score, load time, bundle size, FPS for games) and compare at the end.
3. **Test with emulation and touch.** Use the browser agent with device emulation (touch events on, mobile user agent, throttled CPU and network). Never judge mobile from a desktop-width window.
4. **Do not break desktop.** After every change, confirm desktop still works.
5. **Mark what you cannot verify** (real device sensors, haptics, physical notch, real iOS Safari quirks) as UNVERIFIED instead of assuming.

---

## Phase 0: Discover and baseline

- Identify product type: content site, web app, PWA, canvas/WebGL game, DOM game, or native-wrapper (Capacitor, Cordova, React Native web).
- List every page, screen, modal, menu, and interactive feature in `mobile/MOBILE_MAP.md`.
- Capture baseline: Lighthouse (mobile preset), Core Web Vitals (LCP, INP, CLS), total JS/CSS/image weight, request count, and for games, average and worst-case FPS.
- Take screenshots of every screen at the test viewports below, before any change.

**Test viewports (portrait and landscape for each):**
320x568 (small old phone), 360x640 and 360x800 (common Android), 375x667 (older iPhone), 390x844 and 393x852 (modern iPhone/Pixel), 430x932 (large phone), 412x915 (large Android), 768x1024 (tablet).

## Phase 1: Viewport, meta, and safe areas

- Add or fix: `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Do **not** disable zoom with `user-scalable=no` or `maximum-scale=1` (accessibility). If the game needs no pinch-zoom, block it with `touch-action` on the game canvas only.
- Handle notches and system bars using `env(safe-area-inset-top|right|bottom|left)` for fixed headers, footers, bottom nav, floating buttons, and game HUDs.
- Use `100dvh` (or `svh`/`lvh` as appropriate) instead of `100vh`, because the mobile address bar resizes the viewport. Provide a fallback for older browsers.
- Set `theme-color`, `color-scheme`, and (for iOS) `apple-mobile-web-app-capable`, status bar style, and touch icons.
- Prevent horizontal scroll: nothing wider than the viewport at any tested size.

## Phase 2: Responsive layout

- Convert fixed pixel widths to fluid units (`%`, `rem`, `clamp()`, `min()`, flex, grid). Use `max-width: 100%` on images, video, iframes, tables, and code blocks.
- Use mobile-first media queries (`min-width`) or container queries. Define sensible breakpoints from the content, not from device names.
- Typography: base body text **16px or larger** (smaller triggers iOS zoom on input focus), comfortable line height, fluid heading sizes with `clamp()`, no text truncated unexpectedly.
- Navigation: replace wide desktop menus with a mobile pattern (bottom tab bar, hamburger/drawer, or sheet). Keep primary actions within **thumb reach** (lower half of the screen).
- Tables and wide data: horizontal scroll inside a container, or reflow into stacked cards.
- Modals and dialogs: full-screen or bottom sheets on phones, scrollable content, a close button that is easy to reach, and body scroll locked behind the modal.
- Remove hover-dependent UI. Anything revealed on `:hover` (menus, tooltips, previews) needs a tap alternative. Wrap hover styles in `@media (hover: hover)`.
- Images: responsive `srcset`/`sizes`, modern formats (WebP/AVIF), correct aspect-ratio to avoid layout shift, lazy loading below the fold.
- Check long words, long names, and translated text (German, Arabic/RTL) so they wrap rather than overflow.

## Phase 3: Touch interaction

- **Tap targets:** at least **44x44 px** (Apple) / **48x48 dp** (Material), with at least 8px spacing between neighbors. Enlarge small icons, links, checkboxes, close buttons, and pagination.
- Remove the 300ms tap delay and double-tap-zoom interference with `touch-action: manipulation` on interactive elements.
- Provide instant visual feedback on press (`:active` state, ripple, scale) so taps feel responsive.
- Replace mouse-only events with **pointer events** (`pointerdown`, `pointerup`) or handle both touch and mouse. Never rely on `mouseover`, `mouseenter`, right-click, or scroll-wheel for core features.
- Gestures: support swipe, long-press, pull, and pinch only where natural, with a visible non-gesture alternative. Avoid conflicts with the browser's back-swipe and pull-to-refresh (`overscroll-behavior`).
- Prevent accidental text selection and the long-press callout on game and UI controls (`user-select: none`, `-webkit-touch-callout: none`) but **not** on readable content.
- Scrolling: smooth native scrolling, no scroll-jank, no nested scroll traps, momentum scroll preserved (`-webkit-overflow-scrolling` where needed).
- Multi-touch: verify two or more simultaneous touches don't break the UI.
- Rapid repeated taps on any button must not double-submit or glitch (debounce or disable during action).

## Phase 4: Forms and keyboard

- Correct input types and attributes: `type="email|tel|number|url|search"`, `inputmode`, `autocomplete`, `autocapitalize`, `enterkeyhint`, so the right mobile keyboard appears.
- Input font-size at least 16px to prevent iOS auto-zoom.
- When the on-screen keyboard opens, the focused field and its submit button must remain visible (use `visualViewport`, `scrollIntoView`, and avoid fixed elements being covered).
- Labels above inputs, large inputs, clear error messages, no tiny dropdowns (use native selects or custom large pickers).
- Support autofill, password managers, paste, and one-tap OTP codes (`autocomplete="one-time-code"`).
- Date/time: prefer native pickers on mobile.

## Phase 5: Mobile game controls (if the product is a game)

- **On-screen controls:** add a virtual joystick/D-pad and action buttons for any game that depends on keyboard or mouse. Controls must be large, translucent, positioned for thumbs, within safe areas, and not covering critical gameplay.
- Allow control layout customization and size or opacity settings when practical.
- Support **multi-touch** so the player can move and act at the same time.
- Use `touch-action: none` on the canvas, and `preventDefault` on touch events where needed, to stop scrolling, zooming, and pull-to-refresh during play.
- Scale the canvas to the screen with correct **devicePixelRatio** handling (crisp but capped, e.g., max DPR 2) and maintain the aspect ratio with letterboxing or adaptive layout.
- Orientation: choose landscape or portrait deliberately. Show a friendly "rotate your device" prompt if needed, and handle live rotation without losing game state.
- Pause automatically on `visibilitychange`, `pagehide`, incoming call, or app switch; resume cleanly. Stop audio and timers in the background.
- Audio: unlock audio on the first user gesture (mobile autoplay policy), respect the silent switch, handle interruptions, and keep a visible mute button.
- Fullscreen: provide a fullscreen button where supported, and guidance to "Add to Home Screen" for iOS.
- Performance budget: target a steady **60 FPS** (or a stable 30 FPS on low-end), cap particle and entity counts for phones, use object pooling, avoid per-frame allocations, use sprite atlases, and offer a quality/graphics setting (auto-detect low-end devices).
- Multiplayer on mobile: handle the network switching from Wi-Fi to cellular, backgrounding and reconnecting, higher latency, and bandwidth limits.
- Voice chat on mobile: mic permission flow, mute/unmute, Bluetooth headset, earpiece vs speaker, and background interruption.

## Phase 6: Performance and battery

Mobile devices have slower CPUs, less memory, and flaky networks. Test with **4x CPU throttling and "Slow 4G"**.

- Targets: LCP under 2.5s, INP under 200ms, CLS under 0.1, Lighthouse mobile performance 90+.
- Reduce JS: code-split by route, tree-shake, remove unused dependencies, defer non-critical scripts, avoid long main-thread tasks (over 50ms).
- Reduce CSS: remove unused rules, inline critical CSS, avoid expensive selectors and layout thrashing.
- Optimize assets: compress and resize images to display size, subset and `font-display: swap` fonts, use modern video formats, lazy-load below the fold, preload only what is critical.
- Animations: animate only `transform` and `opacity`, respect `prefers-reduced-motion`, avoid heavy blur, shadows, and large fixed backgrounds that cause repaints on phones.
- Use `requestAnimationFrame`, passive event listeners (`{ passive: true }`) for scroll and touch, and throttle or debounce resize, scroll, and input handlers.
- Memory: find leaks with long sessions, cap list sizes (virtualize long lists), free textures and audio buffers, clean up listeners.
- Battery and heat: pause animations and timers when hidden, avoid continuous GPS, polling, and busy loops, reduce frame rate on idle screens.
- Caching: set long-lived cache headers for static assets, use a service worker for repeat visits.

## Phase 7: Network resilience and offline

- Test offline, Slow 3G, high latency, and mid-action connection loss.
- Show clear loading skeletons, retry buttons, and offline messages. No blank screens or endless spinners.
- Queue actions during poor connectivity and sync when back online, where it makes sense.
- Handle the Wi-Fi to cellular switch and reconnection (websockets must auto-reconnect with backoff).
- Be data-conscious: avoid huge downloads on cellular, and respect `Save-Data` when available.

## Phase 8: PWA and installability (recommended)

- Valid `manifest.webmanifest` (name, short_name, icons 192/512 and maskable, `start_url`, `display: standalone`, theme and background colors, orientation).
- Service worker with an offline fallback page and sensible caching strategy.
- HTTPS everywhere. Splash screen and icons for iOS (`apple-touch-icon`).
- Verify "Add to Home Screen" flow, standalone launch, and that deep links and the back button behave properly in standalone mode.

## Phase 9: Platform quirks (iOS Safari and Android Chrome)

Check and fix known issues:

- iOS: input zoom under 16px, `100vh` bug, rubber-band overscroll, fixed-position elements with the keyboard open, audio/video autoplay and inline playback (`playsinline`), `position: sticky` quirks, date input styling, safe-area insets, no support for some APIs (vibration, certain fullscreen behaviors).
- Android: back-button behavior, address-bar collapse, pull-to-refresh interfering with games, font scaling from system settings, differences across WebView versions, low-memory tab reloads (restore state).
- Both: system dark mode, text-size accessibility settings (layout should survive 130-200% font scaling), landscape and portrait rotation, split-screen, and foldables where relevant.
- Permissions on mobile (mic, camera, location, notifications): request only on user action, explain why, handle denial gracefully.

## Phase 10: Mobile accessibility and usability

- Contrast and readable text outdoors, focus order for screen readers (VoiceOver, TalkBack), labels on icon-only buttons, no gesture-only actions, respect reduced motion and text scaling.
- One-handed use: key actions reachable by thumb, destructive actions need confirmation, avoid tiny close buttons at the top corners.
- Avoid intrusive popups, interstitials, and cookie banners that cover the screen on phones.

## Phase 11: Verify, test, and regress

1. Re-run screenshots at every viewport and compare with the baseline. Confirm no overflow, overlap, clipped text, or unreachable controls.
2. Walk through **every feature** using touch emulation only (no mouse): every button, form, menu, and game action. Include rapid repeated taps.
3. Rotate between portrait and landscape mid-use at multiple points.
4. Run Lighthouse (mobile) and the throttled performance tests again. Compare against the baseline.
5. Confirm desktop and tablet layouts still work.
6. If the project has automated tests, add mobile viewport e2e tests (e.g., Playwright device profiles such as iPhone and Pixel) so mobile bugs cannot return.
7. Fix anything found and re-test. Repeat until clean.

---

## Report format

Create `mobile/MOBILE_REPORT.md`:

```markdown
# Mobile Optimization Report: <product name>
Date: <date> | Commit: <id>

## Metrics (before -> after)
| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Lighthouse mobile performance | | | 90+ |
| LCP | | | < 2.5s |
| INP | | | < 200ms |
| CLS | | | < 0.1 |
| JS bundle size | | | |
| Game FPS (avg / worst) | | | 60 / 30+ |

## Viewport results
| Viewport | Portrait | Landscape | Issues |
|----------|----------|-----------|--------|

## Changes made
- <change, file, reason>

## Issues found and fixed
- <issue, severity, fix, verified>

## UNVERIFIED (needs real device)
- <item and why>
```

## Completion gate

Declare the product mobile-ready **only if** all of these are true:

- [ ] No horizontal scroll or clipped content at all tested viewports, in both orientations
- [ ] All tap targets meet the minimum size, and no feature depends on hover, mouse, or keyboard (unless a mobile alternative exists)
- [ ] Safe areas, dynamic viewport height, and on-screen keyboard are handled
- [ ] Forms use correct input types and no iOS zoom-on-focus
- [ ] Games (if any) have working on-screen controls, multi-touch, rotation handling, auto-pause, and audio unlock
- [ ] Mobile performance targets met on throttled CPU and network (or deviations explained)
- [ ] Offline, slow network, and reconnect behavior tested
- [ ] Desktop and tablet confirmed unbroken
- [ ] Report written, and UNVERIFIED items listed honestly

When every box is checked, output:

```
📱 MOBILE-READY
Tested at <n> viewports in portrait and landscape, with throttled CPU and network.
Lighthouse mobile: <before> -> <after> | LCP <x>s | FPS <x> (games)
Unverified on real devices: <list or "none">
Report: mobile/MOBILE_REPORT.md
```

Otherwise output:

```
⚠️ NOT YET MOBILE-READY
Open issues: <list>
Next steps: <what remains>
```

Be honest. Emulation is not a real phone, so always recommend a final check on at least one real iPhone and one real Android device.

