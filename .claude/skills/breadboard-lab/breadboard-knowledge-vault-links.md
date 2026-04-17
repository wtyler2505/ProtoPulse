# Breadboard Knowledge Vault Links

The Ars Contexta vault (`knowledge/*.md`) is **the source of truth** for breadboard layout rules, verified-board quirks, and bench-coach claims. Before hardcoding a rule in code, grep the vault — there's usually already a claim there.

## MOC (Topic Map)

**`knowledge/breadboard-intelligence.md`** — the Breadboard MOC. Contains:
- Power rail conventions (red/blue/black = VCC/GND, never cross)
- Component placement rules (ICs straddle center channel, short signal paths)
- Common mistakes (forgetting decouplers, floating inputs, shared ground returns, I2C without pull-ups)
- Verified board profile index
- Board-specific knowledge note list
- Layout quality heuristics
- Bench coach concept definition

## Direct-Relevance Notes (use these for coach plans + audit rules)

### Layout + fit

| Vault note | Relevance |
|---|---|
| `esp32-38pin-barely-fits-breadboard-with-one-free-column.md` | ESP32 38-pin fit check — 1 free tie point per side |
| `mega-2560-too-wide-for-any-breadboard.md` | Mega 2560 is off-board-only — use bench-pin endpoints |
| `mega-2560-pin-7-8-gap-for-shield-compatibility.md` | Non-standard 160mil gap breaks uniform pitch assumption |
| `nodemcu-amica-23mm-spacing-fits-standard-breadboard-with-both-rails-accessible.md` | NodeMCU Amica with 23mm spacing fits normally |
| `enforcing-impossible-fit-and-off-board-only-rules-prevents-invalid-physical-layouts-of-over-sized-modules-in-virtual-breadboards.md` | Must enforce off-board-only for oversized modules |

### Power + readiness

| Vault note | Relevance |
|---|---|
| `breadboard-power-module-700ma-total-budget-excludes-servos-and-motors-requiring-separate-power.md` | 700mA total — block servos/motors on breadboard power |
| `independent-per-rail-voltage-selection-enables-mixed-voltage-breadboard-prototyping-without-isolation-circuits.md` | Per-rail jumper for 3.3V vs 5V |
| `wrong-jumper-voltage-on-breadboard-power-module-silently-destroys-3v3-components-with-no-warning.md` | Audit rule: warn if 5V jumper + 3.3V component on same rail |

### Component-specific traps

| Vault note | Relevance |
|---|---|
| `bldc-stop-active-low-brake-active-high.md` | BLDC polarity trap — DRC should fire on reverse |
| `hall-sensor-wiring-order-matters-for-bldc.md` | Wire order must be verified empirically |
| `axial-cylindrical-components-can-roll-off-a-workbench-and-must-be-secured-during-handling.md` | Handling concern (future: coach mentions tape) |
| `l293d-dip-16-package-makes-it-the-only-motor-driver-ic-that-drops-directly-into-a-breadboard.md` | DIP-16 straddle placement |

### Bench coach patterns

| Vault note | Relevance |
|---|---|
| `breadboard-bench-coach-should-flag-i2c-on-esp8266-boot-pins-as-wiring-error.md` | DRC rule — I2C on GPIO0/GPIO2 is a wiring error |
| `breadboard-plus-ai-plus-free-is-the-maker-bundle.md` | Product-level insight — breadboard + AI + free-tier is the maker onboarding |

### ESP32 specifics (used by audit + coach)

| Vault note | Relevance |
|---|---|
| `esp32-gpio12-must-be-low-at-boot-or-module-crashes.md` | Strapping pin — coach warns on pull-up |
| `esp32-adc2-unavailable-when-wifi-active.md` | Design rule — audit flags ADC2 + WiFi combo |
| `esp32-six-flash-gpios-must-never-be-used.md` | Hard error — GPIO 6-11 are internal flash |
| `esp32-gpio5-is-a-strapping-pin-for-boot-message-printing-and-should-not-be-treated-as-unconditionally-safe.md` | Soft strapping — coach warns |
| `esp32-has-14-safe-gpio-pins-with-no-boot-or-flash-restrictions.md` | Safe-pin list — coach recommends these first |

### Verified board list (trust-tier source)

From `knowledge/breadboard-intelligence.md`:
- Arduino Uno R3 (ATmega328P, 5V, 16MHz)
- Arduino Mega 2560 (5V, 16MHz, 54 digital pins) — off-board only
- NodeMCU ESP8266 (3.3V, 80/160MHz, WiFi)
- NodeMCU ESP32-S (3.3V, 240MHz, WiFi+BT, dual-core)
- Raspberry Pi Pico (RP2040, 3.3V, 133MHz, dual-core)
- STM32 Blue Pill (STM32F103, 3.3V, 72MHz)
- RioRand KJL-01 BLDC Controller (6-60V, 350W)
- Adafruit Feather family
- SparkFun Thing Plus ESP32 WROOM
- Teensy 4.0

## Query Patterns For Finding Vault Claims

**Before coding any breadboard rule, try these:**

```bash
# By keyword
qmd search "breadboard pull-up" --collection protopulse-vault

# By component
qmd search "ESP32 strapping" --collection protopulse-vault

# By concept
qmd search "decoupling cap placement" --collection protopulse-vault

# By failure mode
qmd search "bus stuck low i2c" --collection protopulse-vault
```

Or via MCP:
```
mcp__qmd__qmd_vector_search({ collection: "protopulse-vault", query: "breadboard + your topic", limit: 5 })
```

## How To Wire A Vault Claim Into Breadboard Code

### Pattern 1: Audit rule driven by vault note

```typescript
// client/src/lib/breadboard-board-audit.ts
import { checkEsp32Gpio12Strapping } from './breadboard-audit-rules/esp32-gpio12';

// The rule should cite the vault note slug in its remediation link:
const ESP32_GPIO12_RULE: AuditRule = {
  id: 'esp32-gpio12-low-at-boot',
  severity: 'high',
  appliesWhen: (state) => state.parts.some(p => p.type === 'esp32'),
  check: (state) => {
    /* ... detect GPIO12 pull-up ... */
  },
  remediation: {
    message: 'GPIO12 must be LOW at boot — remove the pull-up',
    vaultLink: 'knowledge/esp32-gpio12-must-be-low-at-boot-or-module-crashes.md',
  },
};
```

### Pattern 2: Coach plan step from vault

```typescript
// client/src/lib/breadboard-coach-plan.ts
function planForEsp32(state: BoardState): CoachStep[] {
  return [
    {
      message: 'Check GPIO12 — must be LOW at boot (strapping pin)',
      why: 'ESP32 reads GPIO12 on reset to set flash voltage.',
      vaultRef: 'esp32-gpio12-must-be-low-at-boot-or-module-crashes',
      severity: 'high',
    },
    // ... more steps ...
  ];
}
```

### Pattern 3: Starter-shelf copy cites vault

```typescript
// client/src/components/circuit-editor/BreadboardStarterShelf.tsx
<StarterPart
  label="NodeMCU ESP32-S"
  subtitle="Verified · 2.3mm spacing"
  vaultRef="nodemcu-amica-23mm-spacing-fits-standard-breadboard-with-both-rails-accessible"
  fitNotes="Fits standard breadboard with both rails accessible"
/>
```

## Adding New Vault Knowledge

If you discover durable breadboard knowledge during work (e.g., "this exact wiring pattern causes this exact failure"):

1. Drop the raw observation into `inbox/<date>-<slug>.md`
2. Run `/arscontexta:extract inbox/<date>-<slug>.md`
3. The extraction skill will route it to `knowledge/` and link it from `breadboard-intelligence.md`
4. Then wire it into code using one of the 3 patterns above

**Never hardcode a layout rule as a magic number.** Either cite a vault note or create one.

## Vault Coverage Gaps (contribute when you hit them)

Current known gaps (as of 2026-04-17):

- STM32 strapping-pin coverage (Blue Pill has BOOT0/BOOT1 modes not yet documented)
- Pico W + WiFi antenna clearance rules (breadboard placement affects WiFi range)
- RP2040 PIO-protocol breadboard-length limits
- Shield stacking geometry (Uno + Mega + Nano shield compatibility matrix)

If you encounter these during work, capture the knowledge through `inbox/` → `/extract`.
