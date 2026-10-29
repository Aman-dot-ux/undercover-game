# Mobile Feature Map & Touch Inventory
**Target Product:** Undercover Multiplayer Party Game

## 1. Screen & Viewport Mapping

| Screen / Modal | Mobile Layout Strategy | Thumb Zone / Touch Target Audit |
|---|---|---|
| Top Navigation (`.top-nav`) | Safe-area top padding, room badge, compact voice mic button, sound toggle | >= 44x44px touch targets; voice text hidden on small phones to prevent overflow |
| Screen 1: Home (`#screen-home`) | Vertical hero stack with flex card actions | Large 52px buttons, thumb-reachable CTA buttons (`#btn-goto-create`, `#btn-goto-join`) |
| Screen 2: Create (`#screen-create`) | Single column form layout with 16px inputs | Mobile native selects, minimum 16px input fonts to prevent iOS auto-zoom |
| Screen 3: Join (`#screen-join`) | Large 4-char room code input + nickname | `autocapitalize="characters"`, `autocorrect="off"`, `enterkeyhint="go"` |
| Screen 4: Lobby (`#screen-lobby`) | Room code copy pill, player grid, action bar | One-tap code copy with feedback, full-width thumb ready/start buttons |
| Screen 5: Active Match Hub | Header with round indicator, timer, host bar | Safe-area padding, sticky status, responsive phase subviews |
| ↳ Role Reveal | 3D flip card, private dossier view | Large card touch target, 3D flip on tap, tap-to-hide hint |
| ↳ Clue Round | Turn indicator, my clue card, clues feed | Auto-scrolling clue list, touch-friendly clue submit form |
| ↳ Open Discussion | Circular countdown timer, vote now button | Prominent timer dial, large "Vote Now" skip button |
| ↳ Voting Phase | Grid of candidate suspect cards | Large 48px+ touch cards, self disabled, confirm button |
| ↳ Elimination Phase | Dramatic results card with vote breakdown | Scrollable breakdown list, tie revote action button |
| ↳ Game Over Phase | Winner podium, secret words reveal, leaderboard | Responsive leaderboard cards, rematch button |
| Rules Modal (`#modal-rules`) | Bottom sheet / responsive modal card | Easy-reach close button (>=44x44px), scrollable body |
| Floating Voice Widget | Bottom-right fixed floating thumb pill | `env(safe-area-inset-bottom)` spacing, atomic mute lock |

---

## 2. Touch & Gesture Inventory
- **Single Tap:** Screen navigation, form submission, card flipping, ready toggle, voting selection, mic mute/unmute.
- **Double Tap / Zoom:** Disabled via `touch-action: manipulation` without blocking accessibility.
- **Scroll:** Smooth momentum touch scrolling (`-webkit-overflow-scrolling: touch`) in clue feeds, player grids, and modal bodies.
- **Long Press:** Text selection popups disabled on interactive cards via `-webkit-touch-callout: none` and `user-select: none`.

