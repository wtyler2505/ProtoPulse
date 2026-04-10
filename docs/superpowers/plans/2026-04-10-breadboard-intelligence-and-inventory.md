# Breadboard Lab Phase 3+4: Intelligence & Inventory

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **For `/agent-teams`:** Two parallel tracks with one cross-team dependency. See Agent Teams section.

**Goal:** Make the bench coach catch hardware traps on ANY board (not just 3 verified ones), add a whole-board pre-flight safety scan, one-click remediation with undo, contextual learning cards, and streamline inventory intake with camera import, build-time reconciliation, and shopping list generation.

**Architecture:** Phase 3 adds a heuristic trap inference engine that pattern-matches component family/title to infer warnings for unverified parts, a whole-board preflight scanner that checks cross-component interactions, motor-specific behavioral traps, coach remediation actions backed by the undo system, and inline knowledge cards from the vault. Phase 4 adds a quick-intake sidebar widget, camera-to-inventory AI extraction, a build-time "have vs need" reconciliation panel, and supplier-linked shopping list generation.

**Tech Stack:** React 19 + TypeScript 5.6 + Vitest 4 + happy-dom + existing breadboard coach/audit/bench infrastructure

**Spec:** `docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md` (S2-01 through S2-05, S4-01 through S4-04)

**Prerequisites:** Phase 0 (bench surface), Phase 1 (10 verified boards), Phase 2 (S6-05 undo/redo) — all complete.

---

## Existing Infrastructure (Post Phase 0-2)

| Module | File | Lines | Status |
|--------|------|-------|--------|
| Board audit | `client/src/lib/breadboard-board-audit.ts` | 755 | Production — whole-board health, severity categories |
| Coach plan | `client/src/lib/breadboard-coach-plan.ts` | 371 | Production — hookups, bridges, corridors, suggestions |
| Coach overlay | `client/src/components/circuit-editor/BreadboardCoachOverlay.tsx` | 340 | Production — visual rendering of plan |
| Audit panel | `client/src/components/circuit-editor/BreadboardBoardAuditPanel.tsx` | 276 | Production — health score UI |
| AI prompts | `client/src/lib/breadboard-ai-prompts.ts` | 175 | Production — chat/planner/selection prompts |
| Part inspector | `client/src/lib/breadboard-part-inspector.ts` | 754 | Production — pin map, trust, confidence |
| Bench insights | `client/src/lib/breadboard-bench.ts` | 332 | Production — fit, owned/missing, readyNow |
| Workbench sidebar | `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` | 310 | Production — shelves, filters, inventory access |
| Inventory dialog | `client/src/components/circuit-editor/BreadboardInventoryDialog.tsx` | ~350 | Production — track/filter/update |
| Verified boards | `shared/verified-boards/` | 10 boards | Production — full pin maps, traps |
| Undo system | `client/src/lib/circuit-editor/breadboard-undo.ts` | NEW | Production — 5 command types |
| Knowledge vault | `knowledge/` | 9+ breadboard notes | Production — ESP32/Mega/motor traps |
| Supplier APIs | `client/src/lib/supplier-api.ts` | ~400 | Production — 7 distributors |
| Barcode scanning | `client/src/lib/barcode-scanner.ts` | ~300 | Production — EAN-13/UPC-A/Code128 |
| Multimodal input | `client/src/lib/multi-angle-capture.ts` | ~400 | Production — camera + AI extraction |

---

## `/agent-teams` Composition — 2 Parallel Tracks

### Team A: `intelligence` (S2-01 through S2-05)

**File ownership (exclusive):**
- `client/src/lib/heuristic-trap-inference.ts` (CREATE)
- `client/src/lib/breadboard-preflight.ts` (CREATE)
- `client/src/lib/breadboard-board-audit.ts` (extend for motor traps)
- `client/src/lib/breadboard-coach-plan.ts` (add remediation actions)
- `client/src/components/circuit-editor/BreadboardCoachOverlay.tsx` (add Apply buttons)
- `client/src/components/circuit-editor/BreadboardBoardAuditPanel.tsx` (add preflight button + learning cards)
- `client/src/components/circuit-editor/CoachLearnMoreCard.tsx` (CREATE)
- Test files for above

**Spawn prompt:**
```
You are implementing the Bench Coach intelligence layer for ProtoPulse's Breadboard Lab.
Read the plan: docs/superpowers/plans/2026-04-10-breadboard-intelligence-and-inventory.md — Tasks 1-5.
Read the spec: docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md — S2-01 through S2-05.

YOUR TASKS: #1 → #2 → #3 → #4 → #5 (sequential, check TaskList).

YOUR EXCLUSIVE FILES:
- client/src/lib/heuristic-trap-inference.ts (CREATE)
- client/src/lib/breadboard-preflight.ts (CREATE)
- client/src/lib/breadboard-board-audit.ts
- client/src/lib/breadboard-coach-plan.ts
- client/src/components/circuit-editor/BreadboardCoachOverlay.tsx
- client/src/components/circuit-editor/BreadboardBoardAuditPanel.tsx
- client/src/components/circuit-editor/CoachLearnMoreCard.tsx (CREATE)
- Test files for above

DO NOT TOUCH: BreadboardWorkbenchSidebar.tsx, BreadboardInventoryDialog.tsx, BreadboardReconciliationPanel.tsx, any server/ files

Key context:
- breadboard-board-audit.ts: auditBreadboard(params) → BoardAuditSummary with issues[], score, stats
- breadboard-coach-plan.ts: BreadboardCoachPlan with bridges[], hookups[], suggestions[], corridorHints[]
- Each suggestion has: id, label, type, value, preferredColumns, priority, reason, targetPinIds, desiredAnchor
- verified-boards/types.ts: VerifiedBoardDefinition has pins[] with restricted, warnings, restrictionReason
- breadboard-undo.ts: PlaceComponentCommand, DrawWireCommand — use for one-click remediation
- knowledge/ has 9+ markdown files with hardware trap explanations

Process: claim task → TDD → npm run check → npm test → commit → mark complete → next.
```

### Team B: `inventory` (S4-01 through S4-04)

**File ownership (exclusive):**
- `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` (add quick-intake)
- `client/src/components/circuit-editor/BreadboardQuickIntake.tsx` (CREATE)
- `client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx` (CREATE)
- `client/src/components/circuit-editor/BreadboardShoppingList.tsx` (CREATE)
- Test files for above

**Cross-team dependency:** Task #8 (S4-03 reconciliation) depends on Task #2 (S2-02 preflight) from Team A. Team B should start with Tasks #6-#7, then wait for Team A's Task #2 before starting Task #8.

**Spawn prompt:**
```
You are implementing inventory intake and reconciliation for ProtoPulse's Breadboard Lab.
Read the plan: docs/superpowers/plans/2026-04-10-breadboard-intelligence-and-inventory.md — Tasks 6-9.
Read the spec: docs/superpowers/specs/2026-04-10-breadboard-lab-evolution-design.md — S4-01 through S4-04.

YOUR TASKS: #6 → #7 (independent), then #8 → #9 (sequential, #8 blocked by intelligence team's Task #2).

YOUR EXCLUSIVE FILES:
- client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx
- client/src/components/circuit-editor/BreadboardQuickIntake.tsx (CREATE)
- client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx (CREATE)
- client/src/components/circuit-editor/BreadboardShoppingList.tsx (CREATE)
- Test files for above

DO NOT TOUCH: breadboard-board-audit.ts, breadboard-coach-plan.ts, BreadboardCoachOverlay.tsx, BreadboardBoardAuditPanel.tsx, heuristic-trap-inference.ts, breadboard-preflight.ts

Key context:
- BreadboardWorkbenchSidebar.tsx (310 lines): shelves, filters, inventory button. Add quick-intake inline here.
- breadboard-bench.ts: BreadboardBenchInsight with ownedQuantity, requiredQuantity, missingQuantity, readyNow
- BreadboardInventoryDialog.tsx: existing full inventory dialog — quick-intake is the lightweight inline alternative
- supplier-api.ts: existing supplier lookup with pricing — wire into shopping list
- barcode-scanner.ts: existing EAN-13/UPC-A/Code128 — wire scan button into quick-intake
- multi-angle-capture.ts: existing camera capture — wire into receipt import
- Task #8 (reconciliation) imports breadboard-preflight.ts from the intelligence team — wait for that to exist

Process: claim task → TDD → npm run check → npm test → commit → mark complete → next.
```

### Team Execution Checklist
- [ ] `/agent-teams` spawn with prompts above — 2 teammates
- [ ] Team A starts on Tasks #1-#5 sequentially
- [ ] Team B starts on Tasks #6-#7, then waits for Team A Task #2 before #8-#9
- [ ] Each agent: implement → `npm run check` → `npm test` → commit per task
- [ ] Lead reviews commits
- [ ] All agents complete → integration test in Chrome DevTools
- [ ] Clean up team

---

## Phase 3: Intelligence

### Task 1: Heuristic trap inference for unverified parts (S2-01)

**Files:**
- Create: `client/src/lib/heuristic-trap-inference.ts`
- Test: `client/src/lib/__tests__/heuristic-trap-inference.test.ts` (CREATE)

**Context:** Currently hardware trap detection only works for 3 verified boards (ESP32, Mega 2560, RioRand). If a user places an unverified ESP32 clone or a generic ATmega328 board, they get zero warnings. We need a heuristic engine that pattern-matches part family + title/MPN to infer likely traps at "inferred" confidence level.

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { inferTraps, type InferredTrap } from '../heuristic-trap-inference';

describe('heuristic-trap-inference', () => {
  describe('ESP32 family inference', () => {
    it('infers flash GPIO traps for unverified ESP32 parts', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32-WROOM-32E' });
      const flashTrap = traps.find(t => t.id === 'esp32-flash-gpio');
      expect(flashTrap).toBeDefined();
      expect(flashTrap!.confidence).toBe('inferred');
      expect(flashTrap!.severity).toBe('critical');
    });

    it('infers ADC2/WiFi conflict for ESP32 family', () => {
      const traps = inferTraps({ family: 'mcu', title: 'NodeMCU ESP32S' });
      expect(traps.find(t => t.id === 'esp32-adc2-wifi')).toBeDefined();
    });

    it('infers GPIO12 strapping pin trap', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ESP32 DevKit' });
      expect(traps.find(t => t.id === 'esp32-gpio12-strapping')).toBeDefined();
    });
  });

  describe('ATmega family inference', () => {
    it('infers 5V logic warning for ATmega328 parts', () => {
      const traps = inferTraps({ family: 'mcu', title: 'ATmega328P' });
      expect(traps.find(t => t.id === 'avr-5v-logic')).toBeDefined();
    });

    it('infers serial pin conflict for Arduino-family boards', () => {
      const traps = inferTraps({ family: 'mcu', title: 'Arduino Pro Mini' });
      expect(traps.find(t => t.id === 'avr-serial-conflict')).toBeDefined();
    });
  });

  describe('3.3V MCU inference', () => {
    it('infers voltage level warning for RP2040/STM32/nRF parts', () => {
      const traps = inferTraps({ family: 'mcu', title: 'RP2040 Pico' });
      expect(traps.find(t => t.id === 'mcu-3v3-logic')).toBeDefined();
    });
  });

  describe('generic parts', () => {
    it('returns empty traps for passive components', () => {
      expect(inferTraps({ family: 'resistor', title: '1k Resistor' })).toHaveLength(0);
    });

    it('returns empty for unknown MCU families', () => {
      expect(inferTraps({ family: 'mcu', title: 'Unknown Board XYZ' })).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
- [ ] **Step 3: Implement heuristic-trap-inference.ts**

Pattern matching rules:
- ESP32 family: title contains "esp32" → flash GPIO (6-11), ADC2/WiFi, GPIO12 strapping, GPIO0 boot
- ATmega family: title contains "atmega" or "arduino" → 5V logic, serial D0/D1, reset pin noise
- ARM 3.3V: title contains "rp2040", "stm32", "nrf", "samd" → 3.3V-only logic level warning
- Motor/driver: family "driver" → see Task 3

- [ ] **Step 4: Run tests, verify pass, commit**

```bash
git commit -m "feat(breadboard): heuristic trap inference for unverified parts (S2-01)"
```

---

### Task 2: Whole-board pre-flight safety scan (S2-02)

**Files:**
- Create: `client/src/lib/breadboard-preflight.ts`
- Modify: `client/src/components/circuit-editor/BreadboardBoardAuditPanel.tsx` (add "Ready to Build?" button)
- Test: `client/src/lib/__tests__/breadboard-preflight.test.ts` (CREATE)

**Context:** The existing `auditBreadboard()` checks individual component health. The preflight scan checks cross-component interactions: ADC2+WiFi conflict, voltage rail mismatches (3.3V part on 5V rail), missing decoupling on ICs, power budget overrun, unconnected required pins. It runs on ALL instances (both on-board and on-bench).

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import { runPreflight, type PreflightResult, type PreflightCheck } from '../breadboard-preflight';

describe('breadboard-preflight', () => {
  it('detects voltage rail mismatch (3.3V part on 5V rail)', () => {
    const result = runPreflight({
      instances: [
        mockInstance({ title: 'ESP32', voltage: 3.3 }),
        mockInstance({ title: 'Arduino Uno', voltage: 5.0 }),
      ],
      wires: [mockWire({ fromInstance: 0, toInstance: 1, net: 'VCC' })],
      nets: [mockNet({ name: 'VCC', netType: 'power' })],
    });
    const mismatch = result.checks.find(c => c.id === 'voltage-mismatch');
    expect(mismatch?.status).toBe('fail');
  });

  it('detects missing decoupling on IC', () => {
    const result = runPreflight({
      instances: [mockInstance({ family: 'ic', title: 'ATmega328P' })],
      wires: [],
      nets: [],
    });
    expect(result.checks.find(c => c.id === 'missing-decoupling')?.status).toBe('warn');
  });

  it('detects power budget overrun', () => {
    const result = runPreflight({
      instances: Array.from({ length: 20 }, () => mockInstance({ family: 'led', currentDraw: 20 })),
      wires: [],
      nets: [],
    });
    expect(result.checks.find(c => c.id === 'power-budget')?.status).toBe('fail');
  });

  it('passes clean board', () => {
    const result = runPreflight({ instances: [], wires: [], nets: [] });
    expect(result.overallStatus).toBe('pass');
  });
});
```

- [ ] **Step 2: Run test, verify fail**
- [ ] **Step 3: Implement breadboard-preflight.ts**

Checks: voltage-mismatch, missing-decoupling, power-budget, unconnected-required-pins, adc2-wifi-conflict. Each check returns pass/warn/fail with detail message.

- [ ] **Step 4: Add "Ready to Build?" button to BreadboardBoardAuditPanel.tsx**
- [ ] **Step 5: Run tests, commit**

```bash
git commit -m "feat(breadboard): whole-board pre-flight safety scan (S2-02)"
```

---

### Task 3: Motor controller behavioral traps (S2-03)

**Files:**
- Modify: `client/src/lib/heuristic-trap-inference.ts` (add motor rules)
- Modify: `client/src/lib/breadboard-board-audit.ts` (motor-specific audit checks)
- Test: Extend existing tests

- [ ] **Step 1: Write tests for motor traps**

```typescript
describe('motor controller traps', () => {
  it('warns about STOP/BRAKE polarity inversion on BLDC drivers', () => {
    const traps = inferTraps({ family: 'driver', title: 'RioRand BLDC Controller' });
    expect(traps.find(t => t.id === 'motor-brake-polarity')).toBeDefined();
  });

  it('warns about back-EMF protection for H-bridge', () => {
    const traps = inferTraps({ family: 'driver', title: 'L298N H-Bridge' });
    expect(traps.find(t => t.id === 'motor-back-emf')).toBeDefined();
  });

  it('warns about PWM frequency range', () => {
    const traps = inferTraps({ family: 'driver', title: 'TB6612FNG Motor Driver' });
    expect(traps.find(t => t.id === 'motor-pwm-frequency')).toBeDefined();
  });
});
```

- [ ] **Step 2: Implement motor rules in heuristic-trap-inference.ts**
- [ ] **Step 3: Add motor-specific checks to board audit**
- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(breadboard): motor controller behavioral traps (S2-03)"
```

---

### Task 4: One-click coach remediation (S2-04)

**Files:**
- Modify: `client/src/lib/breadboard-coach-plan.ts` (add `remediation` field to suggestions)
- Modify: `client/src/components/circuit-editor/BreadboardCoachOverlay.tsx` (add Apply buttons)
- Test: Extend coach overlay tests

**Context:** Coach suggestions currently surface problems but fixing is manual. Each suggestion should include a concrete remediation action. The "Apply" button executes it as an UndoableCommand (from `breadboard-undo.ts`). Supported actions: place decoupling cap, rewire to safe pin, add pull-down resistor.

- [ ] **Step 1: Write tests**

```typescript
describe('coach remediation', () => {
  it('decoupling suggestion includes remediation with target coordinates', () => {
    const plan = buildCoachPlan(modelWithIC);
    const decoupSuggestion = plan.suggestions.find(s => s.type === 'capacitor');
    expect(decoupSuggestion?.remediation).toBeDefined();
    expect(decoupSuggestion?.remediation?.action).toBe('place-component');
    expect(decoupSuggestion?.remediation?.coords).toBeDefined();
  });
});
```

- [ ] **Step 2: Add `remediation` to BreadboardCoachSuggestion type**

```typescript
export interface CoachRemediation {
  action: 'place-component' | 'rewire' | 'add-jumper';
  componentType?: string;
  componentValue?: string;
  coords?: { col: string; row: number };
  fromPinId?: string;
  toPinId?: string;
}
```

- [ ] **Step 3: Add Apply buttons to BreadboardCoachOverlay.tsx**
- [ ] **Step 4: Wire Apply to breadboard-undo.ts PlaceComponentCommand**
- [ ] **Step 5: Run tests, commit**

```bash
git commit -m "feat(breadboard): one-click coach remediation with undo support (S2-04)"
```

---

### Task 5: Contextual "why this matters" learning cards (S2-05)

**Files:**
- Create: `client/src/components/circuit-editor/CoachLearnMoreCard.tsx`
- Modify: `client/src/components/circuit-editor/BreadboardCoachOverlay.tsx` (add expandable cards)
- Modify: `client/src/components/circuit-editor/BreadboardBoardAuditPanel.tsx` (add cards to issues)
- Test: `client/src/components/circuit-editor/__tests__/CoachLearnMoreCard.test.tsx` (CREATE)

**Context:** Knowledge vault (`knowledge/`) has rich markdown explanations for every hardware trap. Surface these as expandable "Why?" cards on coach warnings. Content keyed by trap ID (e.g., `esp32-flash-gpio` → `knowledge/esp32-six-flash-gpios-must-never-be-used.md` summary).

- [ ] **Step 1: Write tests**

```typescript
describe('CoachLearnMoreCard', () => {
  it('renders collapsed by default with "Why?" button', () => {
    render(<CoachLearnMoreCard trapId="esp32-flash-gpio" />);
    expect(screen.getByText('Why?')).toBeInTheDocument();
    expect(screen.queryByTestId('learn-more-content')).not.toBeInTheDocument();
  });

  it('expands to show explanation on click', async () => {
    render(<CoachLearnMoreCard trapId="esp32-flash-gpio" />);
    await userEvent.click(screen.getByText('Why?'));
    expect(screen.getByTestId('learn-more-content')).toBeInTheDocument();
  });

  it('shows relevant content for known trap IDs', () => {
    render(<CoachLearnMoreCard trapId="esp32-flash-gpio" expanded />);
    expect(screen.getByTestId('learn-more-content').textContent).toContain('flash');
  });
});
```

- [ ] **Step 2: Implement CoachLearnMoreCard.tsx** — static content map keyed by trap ID, beginner-friendly language, "what could happen" scenario
- [ ] **Step 3: Wire into coach overlay and audit panel**
- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(breadboard): contextual learning cards for coach warnings (S2-05)"
```

---

## Phase 4: Inventory

### Task 6: Inline quick-intake in workbench sidebar (S4-01)

**Files:**
- Create: `client/src/components/circuit-editor/BreadboardQuickIntake.tsx`
- Modify: `client/src/components/circuit-editor/BreadboardWorkbenchSidebar.tsx` (add quick-intake section)
- Test: `client/src/components/circuit-editor/__tests__/BreadboardQuickIntake.test.tsx` (CREATE)

**Context:** The full BreadboardInventoryDialog requires a modal. Quick-intake is inline in the sidebar — type part name, set quantity, done. No modal, no page switch. Includes a barcode scan button that pre-fills the part name.

- [ ] **Step 1: Write tests**

```typescript
describe('BreadboardQuickIntake', () => {
  it('renders inline form with part name, quantity, and submit', () => {
    render(<BreadboardQuickIntake onAdd={vi.fn()} />);
    expect(screen.getByPlaceholderText(/part name/i)).toBeInTheDocument();
    expect(screen.getByTestId('quick-intake-quantity')).toBeInTheDocument();
    expect(screen.getByTestId('quick-intake-submit')).toBeInTheDocument();
  });

  it('calls onAdd with part name and quantity on submit', async () => {
    const onAdd = vi.fn();
    render(<BreadboardQuickIntake onAdd={onAdd} />);
    await userEvent.type(screen.getByPlaceholderText(/part name/i), '10k Resistor');
    await userEvent.clear(screen.getByTestId('quick-intake-quantity'));
    await userEvent.type(screen.getByTestId('quick-intake-quantity'), '5');
    await userEvent.click(screen.getByTestId('quick-intake-submit'));
    expect(onAdd).toHaveBeenCalledWith({ partName: '10k Resistor', quantity: 5 });
  });

  it('clears form after successful submit', async () => {
    render(<BreadboardQuickIntake onAdd={vi.fn()} />);
    await userEvent.type(screen.getByPlaceholderText(/part name/i), 'LED');
    await userEvent.click(screen.getByTestId('quick-intake-submit'));
    expect(screen.getByPlaceholderText(/part name/i)).toHaveValue('');
  });
});
```

- [ ] **Step 2: Implement BreadboardQuickIntake.tsx**
- [ ] **Step 3: Add to BreadboardWorkbenchSidebar.tsx**
- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(breadboard): inline quick-intake widget in workbench sidebar (S4-01)"
```

---

### Task 7: Camera receipt/bag import (S4-02)

**Files:**
- Modify: `client/src/components/circuit-editor/BreadboardQuickIntake.tsx` (add camera button)
- Test: Extend BreadboardQuickIntake tests

**Context:** "Scan parts" button opens camera. AI extracts part numbers + quantities from receipt/bag photo. Pre-fills the quick-intake form. Uses existing `multi-angle-capture.ts` for camera and existing AI chat for extraction.

- [ ] **Step 1: Write tests**

```typescript
it('renders scan button', () => {
  render(<BreadboardQuickIntake onAdd={vi.fn()} />);
  expect(screen.getByTestId('quick-intake-scan')).toBeInTheDocument();
});

it('pre-fills form from scan result', async () => {
  // Mock scan returning { partName: 'ESP32', quantity: 2 }
  // Verify form pre-filled
});
```

- [ ] **Step 2: Add camera scan flow to BreadboardQuickIntake.tsx**
- [ ] **Step 3: Run tests, commit**

```bash
git commit -m "feat(breadboard): camera receipt import for quick-intake (S4-02)"
```

---

### Task 8: Build-time stash reconciliation (S4-03)

**Files:**
- Create: `client/src/components/circuit-editor/BreadboardReconciliationPanel.tsx`
- Test: `client/src/components/circuit-editor/__tests__/BreadboardReconciliationPanel.test.tsx` (CREATE)

**Context:** Triggered by the "Ready to Build?" button (from Task 2's preflight). Shows a "have / need" table for every component on the board. Missing parts flagged red. Links to shopping list (Task 9). Uses `BreadboardBenchInsight` data from `breadboard-bench.ts`.

**DEPENDENCY:** Requires `breadboard-preflight.ts` from Team A's Task 2 to exist (imports the preflight trigger).

- [ ] **Step 1: Write tests**

```typescript
describe('BreadboardReconciliationPanel', () => {
  it('shows have/need comparison per component', () => {
    render(<BreadboardReconciliationPanel insights={mockInsights} />);
    expect(screen.getByText('3 / 5')).toBeInTheDocument(); // have 3, need 5
    expect(screen.getByTestId('missing-badge')).toBeInTheDocument();
  });

  it('shows all-clear when everything owned', () => {
    render(<BreadboardReconciliationPanel insights={ownedInsights} />);
    expect(screen.getByText(/ready to build/i)).toBeInTheDocument();
  });

  it('links missing parts to shopping list', () => {
    render(<BreadboardReconciliationPanel insights={mockInsights} onShop={vi.fn()} />);
    expect(screen.getByTestId('shop-missing-button')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement BreadboardReconciliationPanel.tsx**
- [ ] **Step 3: Run tests, commit**

```bash
git commit -m "feat(breadboard): build-time stash reconciliation panel (S4-03)"
```

---

### Task 9: Shopping list generation (S4-04)

**Files:**
- Create: `client/src/components/circuit-editor/BreadboardShoppingList.tsx`
- Test: `client/src/components/circuit-editor/__tests__/BreadboardShoppingList.test.tsx` (CREATE)

**Context:** From the reconciliation panel, generate a consolidated shopping list with supplier pricing. Each row: part name, quantity needed, best price, distributor link. Export as CSV. Uses existing `supplier-api.ts`.

- [ ] **Step 1: Write tests**

```typescript
describe('BreadboardShoppingList', () => {
  it('renders one row per missing part', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    expect(screen.getAllByTestId(/^shopping-row-/)).toHaveLength(3);
  });

  it('shows total estimated cost', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    expect(screen.getByTestId('total-cost')).toBeInTheDocument();
  });

  it('has export CSV button', () => {
    render(<BreadboardShoppingList missingParts={mockMissing} />);
    expect(screen.getByTestId('export-csv')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Implement BreadboardShoppingList.tsx**
- [ ] **Step 3: Run tests, commit**

```bash
git commit -m "feat(breadboard): shopping list with supplier pricing and CSV export (S4-04)"
```

---

## Post-Implementation

After all 9 tasks complete:
1. `npm run check && npm test` — zero errors
2. Chrome DevTools verification: place unverified ESP32 → see inferred warnings. Run preflight → see cross-component checks. Click Apply on coach suggestion → component placed with undo. Expand "Why?" card. Quick-intake a part. Reconciliation panel shows have/need.
3. This completes the entire Breadboard Lab Evolution spec (S0 through S6, S3, S4, S5). The only remaining item is BL-0571 actual implementation (the ADR was written in Phase 5).
