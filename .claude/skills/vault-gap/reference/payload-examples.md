# Payload Examples — `/vault-gap` Output

The `/vault-gap` skill emits one of three payload shapes depending on coverage. The calling agent pastes the payload verbatim into the originating plan's Research log.

## Coverage: sufficient (≥3 strong hits)

```
### /vault-gap result — ESP32 GPIO12 boot strapping

Coverage: sufficient (4 strong hits, threshold 3)

Existing notes (top 5 by score):
- knowledge/esp32-gpio12-must-be-low-at-boot-or-module-crashes.md — "GPIO12 is a strapping pin controlling flash voltage on boot" (0.94)
- knowledge/esp32-strapping-pins-summary-gpio0-gpio2-gpio5-gpio12-gpio15.md — "Five strapping pins determine boot mode" (0.88)
- knowledge/avoid-strapping-pins-for-sensor-inputs-use-gpio34-or-gpio35-instead.md — "Strapping pins must not be pulled unexpectedly" (0.72)
- knowledge/esp32-boot-mode-errors-caused-by-pullups-on-gpio2.md — "Boot mode faults on GPIO2 caused by external pullups" (0.64)

Recommended consumption:
- <VaultHoverCard slug="esp32-gpio12-must-be-low-at-boot-or-module-crashes"> on any UI that renders GPIO12 pin metadata.
- Cite esp32-strapping-pins-summary-... in the "pin role" column of the Component Editor.

No inbox stub required.
```

## Coverage: thin (1-2 strong hits)

```
### /vault-gap result — net naming convention VCC GND

Coverage: thin (2 strong hits, threshold 3)

Existing notes (top 5 by score):
- knowledge/power-net-naming-conventions-vcc-vdd-vbat-vin.md — "Five common power-net prefixes and their semantics" (0.79)
- knowledge/ground-net-conventions-gnd-agnd-dgnd-pgnd.md — "Split-ground schemes for mixed-signal designs" (0.64)
- knowledge/schematic-net-color-conventions-red-black-yellow.md — "Wire color mapping to net role" (0.48 — below threshold, included for orientation)

Pedagogical gap: no existing note covers SIGNAL net naming conventions (SDA/SCL/MOSI/TX/RX). This stub seeds that gap.

Stub seeded: inbox/2026-04-18-net-naming-convention-vcc-gnd.md
Queue entry: ops/queue/gap-stubs.md (row 3)

After /extract processes the stub, cite the resulting knowledge/<slug>.md in Plan 06-schematic.md Wave 2 Task 2.2.
```

## Coverage: missing (0 strong hits)

```
### /vault-gap result — WCAG 2.1 focus ring 3:1 contrast

Coverage: missing (0 strong hits, threshold 3)

Closest qmd_deep_search hits (all below 0.5):
- knowledge/focus-outline-none-strips-keyboard-indicators-wcag-violation.md (0.42) — related but narrow
- knowledge/maker-ux.md (0.31) — MOC only
- knowledge/cyan-on-dark-contrast-failures-in-primary-buttons.md (0.28) — different SC

No vault note currently covers WCAG 2.1 SC 1.4.11 Non-text Contrast with the 3:1 ratio requirement for focus indicators.

Stub seeded: inbox/2026-04-18-wcag-focus-ring-3to1-contrast.md
Queue entry: ops/queue/gap-stubs.md (row 7)

After /extract processes the stub, cite in:
- 03-a11y-systemic.md Wave 10 (inbox-seeding wave — this IS one of the four stubs)
- 16-design-system.md Phase 1 (color tokens must validate against the threshold)

Primary sources suggested in stub:
- https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html
- https://www.w3.org/WAI/WCAG21/Understanding/focus-visible.html
```

## Error payload (qmd unreachable)

```
### /vault-gap result — <topic>

ERROR: mcp__qmd__qmd_deep_search failed — <error message>.
Fallback: ran `grep -rli "<keywords>" knowledge/` — found N matching files.
  - knowledge/<file1>.md
  - knowledge/<file2>.md

Coverage: <indeterminate — falling back to grep-only count> (N hits)

Stub seeded (N<3): inbox/YYYY-MM-DD-<slug>.md

Recommend: run `mcp__qmd__qmd_status` to diagnose index health, then re-run `/vault-gap "<topic>"` when resolved.
```

## Interpretation notes for consuming agent

- **"sufficient" does NOT mean "no work needed"** — the agent still consumes the cited notes via `<VaultHoverCard>` / `<VaultExplainer>`. The stub is only skipped because the work of writing is already done.
- **"thin" is the subtle case** — one great note may cover the topic; two mediocre notes may not. Read the top-hit excerpts. Override with `--min-notes=1` if the single note is canonical.
- **"missing" means action required** — the stub exists; `/extract` will process; agent should checkpoint here or note the dependency.
- **Never fabricate citations.** If coverage is thin/missing, cite the 0 or 1-2 hits verbatim, not a made-up slug.
