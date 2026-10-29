# Mobile Optimization Report: Undercover Party Game
Date: 2026-10-29 | Commit: `ac087293e976`

## Metrics (before -> after)
| Metric | Before | After | Target |
|---|---|---|---|
| Viewport Fit | Standard (`1.0, user-scalable=no`) | `width=device-width, initial-scale=1.0, viewport-fit=cover` | `viewport-fit=cover` |
| Viewport Units | `100vh` (address bar jumps) | `100dvh` + `100vh` fallback | `100dvh` |
| Safe Area Insets | None | Handled on `.top-nav`, `.floating-voice-widget`, `.modal-backdrop` | `env(safe-area-inset-*)` |
| Minimum Touch Target | 36x36px on icon buttons & copy | 44x44px across all interactive controls | >= 44x44px (Apple HIG) |
| Tap Delay | 300ms default click latency | 0ms via `touch-action: manipulation` | 0ms |
| iOS Input Auto-Zoom | Triggered on select `< 16px` | Eliminated (inputs & selects >= 16px) | No auto-zoom |
| Callout Menus | Triggered on card long-press | Suppressed via `-webkit-touch-callout: none` | Native app feel |
| Automated Test Pass Rate | 39 / 39 (100%) | 39 / 39 (100%) | 100% |

## Viewport results
| Viewport | Portrait | Landscape | Issues |
|---|---|---|---|
| 320x568 (iPhone SE / 5s) | ✅ Clean single-column layout, compact nav icon | ✅ Clean, scrollable | None |
| 360x640 / 360x800 (Android) | ✅ Full-width card actions, thumb-friendly buttons | ✅ Responsive flex wrap | None |
| 375x667 (iPhone 6/7/8/SE2) | ✅ Touch targets >= 44px, zero horizontal overflow | ✅ Clean layout | None |
| 390x844 / 393x852 (iPhone 13/14/15/Pixel 7) | ✅ Notch & dynamic island safe areas respected | ✅ Safe insets active | None |
| 412x915 / 430x932 (iPhone Pro Max / Galaxy Ultra) | ✅ Spacious thumb zone, max 520px container centered | ✅ Centered container | None |
| 768x1024 (iPad / Tablet) | ✅ Centered mobile frame, comfortable ergonomics | ✅ Tablet friendly | None |

## Changes made
- `public/index.html`: Replaced `user-scalable=no` with `viewport-fit=cover`; added `enterkeyhint`, `autocapitalize`, `autocorrect="off"`, and `spellcheck="false"` on mobile inputs.
- `public/css/styles.css`:
  - Added `min-height: 100dvh` to `.app-container` and `height: 100dvh` to `.modal-backdrop`.
  - Added safe area insets `env(safe-area-inset-top|bottom|left|right)` to `.top-nav`, `.modal-backdrop`, and `.floating-voice-widget`.
  - Increased `.btn-icon`, `.modal-header .btn-icon`, and `.btn-copy` to minimum 44x44px.
  - Added `touch-action: manipulation; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;` on `.btn`, `.btn-icon`, `.candidate-card`, `.secret-card`, `.btn-copy`, and `.btn-floating-voice`.
  - Increased `.select-sm` font size from `0.95rem` to `16px` to prevent iOS auto-zoom on dropdown focus.
  - Added momentum scrolling (`-webkit-overflow-scrolling: touch`) and `overscroll-behavior-y: contain` on `.clues-list` and `.modal-body`.
- `public/sw.js`: Added `/js/voiceManager.js` to pre-cached PWA static shell assets.

## Issues found and fixed
1. **iOS Auto-Zoom on Small Selects:** `.select-sm` had `font-size: 0.95rem` (~15.2px), causing iOS Safari to auto-zoom on focus. Fixed by explicitly setting `font-size: 16px`.
2. **Missing Notch & Dynamic Island Insets:** Fixed header and floating mic button lacked `env(safe-area-inset-*)`, causing buttons to overlap iPhone home indicator bars or status notches. Fixed with safe-area padding calculations.
3. **Sub-44px Touch Targets:** Close buttons in modals and top nav were 36x36px on small screens. Fixed by enforcing `min-width: 44px; min-height: 44px`.

## UNVERIFIED (needs real device)
- Physical haptic feedback and physical notch occlusion on specific Android vendor skins (Xiaomi MIUI, Samsung OneUI). (Verified via browser device viewport emulation and standard WebKit safe-area testing).

