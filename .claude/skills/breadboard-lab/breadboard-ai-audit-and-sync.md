# Breadboard AI, Audit, Trust, And Sync Guidance

## Canonical Trust Tiers

Breadboard AI must always distinguish these tiers exactly — copy should never flatten them:

| Tier | When it applies | Copy style |
|---|---|---|
| `verified-exact` | Verified connector map + footprint + electrical profile | "Confirmed: Arduino Uno R3 has 14 digital + 6 analog pins at 0.3in header spacing." |
| `connector-defined` | Pin map defined; physical/electrical profile partial | "Pin map known. Fit not fully verified — double-check spacing." |
| `heuristic` | System inferred without user/vault confirmation | "Best guess: this looks like a 555 timer. Verify pin 1 against your datasheet." |
| `stash-absent` | Referenced but not owned | "Not in your stash. Request it below or substitute." |

**Prompt rule:** `breadboard-ai-prompts.ts` templates MUST pass trust tier into model context. Never let the model emit confident instructions for a heuristic part. Wrap heuristic statements in best-guess framing.


## Coach Plan Rules

`breadboard-coach-plan.ts` should be:

1. **Grounded in the selected part**, not the overall design. Answers "what does THIS component need next?"
2. **Stash-aware.** Recommended add-on not in stash -> surface recommendation AND shortfall.
3. **One-step-at-a-time.** Never dump a 10-step plan.
4. **Reversible.** Every applied step undoable in one click.
5. **Linked to vault claims.** Cite the knowledge note via a searchable concept, not a hardcoded slug.

## Board Health Rules

The audit panel is useful only if it is:
- Visible from the main workbench without expanding
- Actionable — every issue has a recommended fix
- Tied to affected parts/pins — clicking an issue focuses the board
- Compatible with selected-part inspection + coach actions

**A score without remediation is not enough.**

## Severity Ladder

| Severity | Real-world meaning | Example |
|---|---|---|
| critical | Destroys component or shocks user | 5V on 3.3V pin; reverse polarity on electrolytic |
| high | Circuit will not work | Missing decoupler on ESP32 VCC; missing I2C pull-ups |
| medium | Intermittent / degraded | Long high-speed signal wires; shared ground return |
| low | Best-practice violation | Using brown wire for VCC; misaligned parts |

Never mix tiers — a low alongside a critical with equal weight teaches users to ignore the audit.

## Sync Rules

`view-sync.ts` is high risk because silent success can still feel wrong.

### Always verify:

1. **No duplicate wires** — one schematic net produces one breadboard wire
2. **Hand-drawn wires are distinguishable** from synced wires in UI
3. **Selecting a synced part still exposes correct trust state**
4. **Beginner intuition intact** — board does not magically rearrange

### Sync anti-patterns (NEVER):

- Silent cascade (schematic change invisibly moves breadboard)
- Trust laundering (sync upgrades heuristic to verified-exact)
- Lossy merge (manual wire deleted because sync did not recognize it)
- Invisible provenance (synced and hand-drawn look identical)
