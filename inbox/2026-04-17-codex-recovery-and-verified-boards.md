# Session Summary: Codex Recovery and Verified Boards
Date: 2026-04-17

## Context
Codex hit usage limits during a previous session. I recovered the session transcript from `~/.codex/sessions/` and resumed work exactly where it left off, maintaining context and continuing the task list without the user having to re-explain anything.

## Hardware Verification & Geometry
- Expanded the `VerifiedBoardDefinition` interface to include precise, real-world `pcbColor` and `silkscreenColor`.
- Researched and added three highly-detailed, exact-match verified boards where physical layout matters:
  - **L298N Dual Motor Driver Module** (Red PCB, screw terminals, header groupings)
  - **SSD1306 0.96" OLED I2C Display** (Blue PCB, 4-pin header)
  - **HC-SR04 Ultrasonic Sensor** (Blue PCB, 5V strict logic)
- Updated all existing boards (Arduino, Pico, Nucleo, Teensy, Feather) with authentic physical PCB colors.

## AI Component Generation Protocol (System Prompt)
- Updated `server/ai.ts` system prompt to strictly enforce rigorous research and validation for newly generated hardware parts.
- The AI must now:
  1. Ask for exact model details.
  2. Exhaustively research real-world dimensions (mm), colors, headers, and electrical limits.
  3. Verify with the user before creation.
  4. Never invent or approximate physical attributes.

## Breadboard Fit Rules & Testing
- Enforced impossible-fit and off-board-only rules in the UI when placing over-sized modules (e.g., L298N or Mega 2560) onto the breadboard.
- Created explicit `e2e/breadboard-fit.spec.ts` Playwright test to validate these fit constraints.
- Resolved a `TypeError: URL is not a constructor` warning in `BreadboardShoppingList.test.tsx` by using a safer `vi.fn()` mock on `window.URL.createObjectURL`.