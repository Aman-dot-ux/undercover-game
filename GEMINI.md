# Project Rules: Undercover Game

## Full Product Audit Protocol
Whenever the user asks to test, QA, audit, or check whether everything is working or ready:
1. **DO NOT** execute the `full-product-audit` skill on your own.
2. **ASK PERMISSION FIRST**: Explicitly ask the user for permission to execute the `full-product-audit` skill.
3. **WAIT FOR CONFIRMATION**: Only proceed once the user explicitly grants permission.

## Post-Build Mobile Optimization Protocol
Whenever a build, major feature, or implementation milestone is finished:
1. **ALWAYS** use the `mobile-optimizer` skill to inspect and optimize the application for mobile devices.
2. Ensure touch targets >= 44x44px, safe area insets are respected, input fields do not trigger iOS auto-zoom (>= 16px font), dynamic `100dvh` is used, and layout wraps cleanly across viewports from 320px to 430px.
