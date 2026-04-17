/**
 * Shared electronics domain knowledge — the single source of truth for rule
 * explanations, default component values, and vault references used by both
 * the AI Prediction Engine (`client/src/lib/ai-prediction-engine.ts`) and the
 * Proactive Healing Engine (`client/src/lib/proactive-healing.ts`).
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The two engines have different check signatures — the prediction engine
 * analyses full `(nodes, edges, bom)` snapshots, whereas the healing engine
 * evaluates per-action `(action, state)` events — so the rule *shapes* cannot
 * be unified. What *was* duplicated (and drifted) was the domain knowledge:
 * the explanation strings, default component values (100nF, 10µF, 4.7kΩ,
 * 1N4007, TXB0108, USBLC6-2), severities, and vault citations.
 *
 * Each entry in `ELECTRONICS_KNOWLEDGE` is keyed by a stable *topic id* and
 * consumed by per-engine rule factories that compose the knowledge into
 * their own proposal/prediction shape.  Changes to the canonical explanation
 * for, say, decoupling capacitors now happen here — once — and both engines
 * pick them up automatically.
 *
 * Vault references (`references: string[]`) cite real file stems from
 * `knowledge/` (the Ars Contexta vault).  The integrity test in
 * `shared/__tests__/electronics-knowledge.test.ts` asserts that every
 * reference resolves to an existing file.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stable topic identifiers for the shared knowledge entries. */
export type ElectronicsTopicId =
  | 'decoupling'
  | 'flyback-diode'
  | 'i2c-pullup'
  | 'level-shifter'
  | 'reset-pullup'
  | 'esd-protection';

/** Coarse category used by both engines for UI grouping. */
export type ElectronicsCategory =
  | 'voltage'
  | 'current'
  | 'protection'
  | 'signal_integrity'
  | 'thermal'
  | 'mechanical'
  | 'best_practice';

/** Severity mirror of healing engine's HealingSeverity. */
export type ElectronicsSeverity = 'critical' | 'warning' | 'suggestion';

/**
 * A canonical electronics-rule knowledge entry.
 *
 * `triggerTypes` is a non-empty list of node-classification names (matching
 * the classifier helpers such as `isMcu`, `isMotor`) that should fire this
 * topic when present in the design — informational/documentary; concrete
 * predicate logic still lives in each engine's rule factory.
 */
export interface ElectronicsRule {
  /** Stable topic id — engines use this to look up the entry. */
  id: ElectronicsTopicId;
  /** Short human name used in UI titles. */
  name: string;
  /** Domain category — maps onto consumer enums. */
  category: ElectronicsCategory;
  /** Default severity; consumers may override (e.g. a snapshot-wide vs. per-action fire). */
  severity: ElectronicsSeverity;
  /** Non-empty list of node-classification names that fire this rule. */
  triggerTypes: string[];
  /**
   * Canonical long-form explanation shown to the user.  The prose must still
   * satisfy existing test expectations (e.g. the decoupling text must mention
   * "100nF"), so edits here should preserve key tokens.
   */
  explanation: string;
  /** Short imperative fix description (e.g. "Add 4.7kΩ pull-up resistors..."). */
  fixDescription: string;
  /** Default component values / sub-payload hints for the fix. */
  defaultValues: Record<string, unknown>;
  /** Vault filename stems (without `.md`) supporting the rule. */
  references: string[];
}

// ---------------------------------------------------------------------------
// Canonical knowledge entries
// ---------------------------------------------------------------------------

/**
 * The shared knowledge base.  Keep entries alphabetised by `id` for easy
 * diffing.  New topics must include at least one non-empty `triggerTypes`
 * entry and at least one real vault reference.
 */
export const ELECTRONICS_KNOWLEDGE: readonly ElectronicsRule[] = [
  {
    id: 'decoupling',
    name: 'MCU decoupling capacitors',
    category: 'signal_integrity',
    severity: 'warning',
    triggerTypes: ['mcu'],
    explanation:
      'Every MCU needs 100nF ceramic decoupling capacitors on each VCC pin and a 10µF bulk capacitor near the power input. Without them, voltage dips during fast switching cause erratic behavior.',
    fixDescription: 'Add 100nF ceramic + 10µF bulk capacitors',
    defaultValues: { component: 'capacitor', values: ['100nF', '10µF'] },
    references: [
      'every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients',
      'analog-ics-need-decoupling-more-critically-than-digital-because-supply-noise-directly-contaminates-signal-measurements',
      'max7219-requires-both-ceramic-and-electrolytic-decoupling-caps-or-spi-communication-becomes-unreliable',
    ],
  },
  {
    id: 'esd-protection',
    name: 'ESD protection on external interface',
    category: 'protection',
    severity: 'warning',
    triggerTypes: ['usb', 'connector'],
    explanation:
      'External-facing connectors (USB, Ethernet, etc.) should have ESD protection (TVS diodes, e.g. USBLC6-2) to protect internal circuitry from electrostatic discharge.',
    fixDescription: 'Add TVS diode array (e.g. USBLC6-2) for ESD protection',
    defaultValues: { component: 'tvs-diode', part: 'USBLC6-2' },
    references: [
      'every-digital-ic-requires-a-100nf-ceramic-decoupling-capacitor-between-vcc-and-gnd-to-absorb-switching-transients',
    ],
  },
  {
    id: 'flyback-diode',
    name: 'Flyback diode on inductive load',
    category: 'protection',
    severity: 'critical',
    triggerTypes: ['motor', 'relay'],
    explanation:
      'Inductive loads (motors, relays, solenoids) generate voltage spikes when switched off. A flyback diode (e.g. 1N4007) across the coil clamps these spikes and protects driver circuitry.',
    fixDescription: 'Add 1N4007 flyback diode across inductive load',
    defaultValues: { component: 'diode', value: '1N4007', type: 'flyback' },
    references: [
      'drc-should-flag-direct-gpio-to-inductive-load-connections-and-suggest-driver-plus-flyback-subcircuit',
      'l298n-has-no-internal-flyback-diodes-unlike-l293d-making-external-protection-mandatory',
    ],
  },
  {
    id: 'i2c-pullup',
    name: 'I2C pull-up resistors',
    category: 'signal_integrity',
    severity: 'warning',
    triggerTypes: ['i2c'],
    explanation:
      'I2C bus lines (SDA, SCL) are open-drain and require pull-up resistors (typically 4.7kΩ) to VCC. Without them, communication will be unreliable or completely fail.',
    fixDescription: 'Add 4.7kΩ pull-up resistors on SDA and SCL',
    defaultValues: { component: 'resistor', value: '4.7kΩ', count: 2, placement: 'i2c-pullup' },
    references: [
      'i2c-bus-capacitance-budget-of-400pf-caps-practical-total-wire-length-at-roughly-one-meter-in-fast-mode',
      'i2c-scanner-sketch-is-the-mandatory-first-debug-step-after-wiring-a-multi-device-bus',
      'oled-i2c-modules-include-onboard-pull-ups-and-external-pull-ups-should-only-be-added-for-bus-lengths-exceeding-30cm',
    ],
  },
  {
    id: 'level-shifter',
    name: 'Level shifter between voltage domains',
    category: 'voltage',
    severity: 'warning',
    triggerTypes: ['mcu'],
    explanation:
      'Connecting a device in one voltage domain (e.g. 3.3V) to one in another (e.g. 5V) without a level shifter can damage the lower-voltage device. Use a bidirectional level shifter (e.g. TXB0108) or a simple MOSFET-based shifter.',
    fixDescription: 'Add bidirectional level shifter',
    defaultValues: { component: 'level-shifter', part: 'TXB0108' },
    references: [
      '74hct-buffers-are-purpose-built-3v3-to-5v-level-shifters-for-timing-critical-signals',
      'bss138-body-diode-makes-level-shifting-bidirectional-without-direction-control',
      'active-level-shifters-use-one-shot-edge-accelerators-to-drive-rising-edges-breaking-the-bss138-rc-ceiling',
    ],
  },
  {
    id: 'reset-pullup',
    name: 'Reset pull-up resistor',
    category: 'best_practice',
    severity: 'suggestion',
    triggerTypes: ['mcu'],
    explanation:
      'MCU reset pins are typically active-low and should have a pull-up resistor (10kΩ) to VCC to prevent spurious resets from noise. Optionally add a 100nF cap to GND for debouncing.',
    fixDescription: 'Add 10kΩ pull-up resistor on RESET pin',
    defaultValues: { component: 'resistor', value: '10kΩ', placement: 'reset-pullup' },
    references: [
      'joystick-sw-pin-has-no-onboard-pull-up-requiring-input-pullup-or-external-resistor-to-avoid-floating-input',
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

const KNOWLEDGE_BY_ID: ReadonlyMap<ElectronicsTopicId, ElectronicsRule> = new Map(
  ELECTRONICS_KNOWLEDGE.map((entry) => [entry.id, entry]),
);

/**
 * Fetch a shared knowledge entry by topic id.  Throws if the id is unknown —
 * this is intentional: both engines use a compile-time-typed topic id, so a
 * runtime miss indicates the knowledge base drifted from the consumers and
 * should fail loudly in development/tests rather than silently falling back.
 */
export function getElectronicsKnowledge(id: ElectronicsTopicId): ElectronicsRule {
  const entry = KNOWLEDGE_BY_ID.get(id);
  if (!entry) {
    throw new Error(`Unknown electronics knowledge topic: ${id}`);
  }
  return entry;
}
