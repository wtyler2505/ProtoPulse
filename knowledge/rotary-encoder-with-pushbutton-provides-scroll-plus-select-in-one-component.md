---
description: "The KY-040 combines a rotary encoder (infinite-rotation scroll) with a center pushbutton (select/confirm) in a single shaft — providing a complete menu navigation interface from one 3-pin component (CLK, DT, SW)"
type: knowledge
topics:
  - "[[input-devices]]"
source: "[[ky-040-rotary-encoder-module-incremental-with-pushbutton]]"
---

# Rotary encoder with pushbutton provides scroll plus select in one component

The KY-040 module integrates two input modalities in one physical control:

1. **Rotation** (infinite, detented): Scroll through menu items, adjust values, navigate lists
2. **Push** (momentary, center-press): Confirm selection, enter submenu, toggle state

This eliminates the need for separate scroll + confirm inputs (e.g., up/down buttons + enter button = 3 buttons = 3 pins). The encoder achieves the same with 3 pins total (CLK + DT + SW), and the UX is more intuitive (continuous rotation vs discrete button presses).

**Common UI patterns with encoder + button:**
- **Menu navigation**: Rotate to highlight items, press to enter
- **Value adjustment**: Press to enter edit mode, rotate to change value, press to confirm
- **Volume control**: Rotate for level, press to mute/unmute
- **File browser**: Rotate to scroll, press to open/select

**Pin budget comparison for menu input:**
| Input Method | Pins | UX Quality |
|-------------|------|-----------|
| 3 buttons (up/down/enter) | 3 digital | Discrete steps only |
| Joystick + button | 2 analog + 1 digital | Proportional but imprecise for menus |
| Rotary encoder + button | 2 digital + 1 digital | Detented precision, infinite scroll |
| 4x4 keypad | 8 digital | Rich input but large pin budget |

The encoder's 20 detents per revolution provide tactile feedback without the cognitive overhead of analog-to-discrete mapping that joysticks require for menu navigation.

---

Topics:
- [[input-devices]]

Related:
- [[quadrature-encoding-detects-rotation-direction-from-phase-lead-lag-between-two-square-wave-channels]]
- [[incremental-encoder-has-no-position-memory-across-power-cycles-making-it-a-relative-only-input-device]]
- [[joystick-module-is-two-potentiometers-on-a-spring-return-gimbal-consuming-two-analog-pins-plus-one-digital-pin]]
