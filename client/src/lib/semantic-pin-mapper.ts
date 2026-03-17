/**
 * Semantic Pin Mapper — client-side pin role classification and matching.
 *
 * Classifies pin roles from name patterns and matches pins between components
 * by role, name similarity, and electrical type. Used for automated wiring
 * suggestions, component swap recommendations, and pin-compatibility analysis.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Functional role a pin serves on a component. */
export type PinRole =
  | 'power'
  | 'ground'
  | 'input'
  | 'output'
  | 'bidirectional'
  | 'clock'
  | 'data'
  | 'enable'
  | 'reset'
  | 'analog'
  | 'pwm';

/** Electrical type annotation (optional, refines role matching). */
export type ElectricalType =
  | 'passive'
  | 'input'
  | 'output'
  | 'bidirectional'
  | 'tri-state'
  | 'open-collector'
  | 'open-drain'
  | 'power-input'
  | 'power-output';

/** A pin with semantic metadata. */
export interface SemanticPin {
  /** Human-readable pin name (e.g. "VCC", "SDA", "D3"). */
  name: string;
  /** Functional role of this pin. */
  role: PinRole;
  /** Optional electrical type for finer-grained matching. */
  electricalType?: ElectricalType;
  /** Optional physical pin number or designator. */
  number?: string | number;
}

/** A mapping between two pins with a confidence score. */
export interface PinMapping {
  sourcePin: SemanticPin;
  targetPin: SemanticPin;
  /** Confidence from 0 (no match) to 1 (perfect match). */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Classification patterns
// ---------------------------------------------------------------------------

/** Ordered pattern table: first match wins for classifyPinRole. */
const ROLE_PATTERNS: ReadonlyArray<{ pattern: RegExp; role: PinRole }> = [
  // Power (VCC, VDD, VIN, VBUS, VBAT, VSYS, 3V3, 5V, 12V, V+, VOUT, AVCC, DVCC)
  { pattern: /^(vcc|vdd|vin|vbus|vbat|vsys|v\+|3v3|5v|12v|vout|avcc|dvcc)$/i, role: 'power' },

  // Ground (GND, VSS, V-, AGND, DGND, PGND, GNDA, GNDD)
  { pattern: /^(gnd|vss|v-|ground|agnd|dgnd|pgnd|gnda|gndd)$/i, role: 'ground' },

  // Clock (SCL, SCK, SCLK, CLK, XTAL, OSC)
  { pattern: /^(scl|sck|sclk|clk|clock|xtal\d*|osc\d*|i2c_scl|twi_scl|spi_sck|spi_clk)$/i, role: 'clock' },

  // Data (SDA, MOSI, MISO, SDI, SDO, DI, DO, SI, SO)
  { pattern: /^(sda|mosi|miso|sdi|sdo|di|do|si|so|i2c_sda|twi_sda|spi_mosi|spi_miso)$/i, role: 'data' },

  // Enable (EN, CE, CS, SS, NSS, OE, NCS, CSN, CHIP_EN)
  { pattern: /^(en|ce|cs|ss|nss|oe|ncs|csn|chip_en|enable)$/i, role: 'enable' },

  // Reset (RST, NRST, RESET, NRESET, MR, MCLR)
  { pattern: /^(rst|nrst|reset|nreset|mr|mclr)$/i, role: 'reset' },

  // Analog (A0-A7, ADC0-ADC7, AIN0-AIN7, AN0-AN7)
  { pattern: /^(a[0-7]|adc\d*|ain\d*|an\d+|analog\d*)$/i, role: 'analog' },

  // PWM
  { pattern: /^(pwm\d*|oc\d+[a-b]?|timer\d*_ch\d*)$/i, role: 'pwm' },

  // Output (TX, TXD, DOUT, TOUT, OUT, Q, QBAR, VOUT already caught by power)
  { pattern: /^(tx|txd|uart_tx|usart_tx|txo|tout|out\d*|q|qbar|dout)$/i, role: 'output' },

  // Input (RX, RXD, DIN, RIN, IN, COMP_IN)
  { pattern: /^(rx|rxd|uart_rx|usart_rx|rxi|rin|in\d*|din|comp_in)$/i, role: 'input' },

  // Bidirectional — digital GPIOs (D0-D13, GPIO, IO, PBx, PCx, PDx, PAx)
  { pattern: /^(d\d+|gpio\d*|io\d+|digital\d*|p[a-d]\d+|pb\d+|pc\d+|pd\d+|pa\d+)$/i, role: 'bidirectional' },
];

// ---------------------------------------------------------------------------
// Public API — classifyPinRole
// ---------------------------------------------------------------------------

/**
 * Classify a pin's functional role from its name.
 *
 * Uses pattern matching against common naming conventions in
 * microcontroller, sensor, and IC datasheets.
 *
 * @param pinName  The pin name/label (e.g. "VCC", "SDA", "D3").
 * @returns        The classified role, defaulting to 'bidirectional' for
 *                 unrecognised names.
 */
export function classifyPinRole(pinName: string): PinRole {
  const normalized = pinName.trim();
  if (normalized === '') {
    return 'bidirectional';
  }

  for (const { pattern, role } of ROLE_PATTERNS) {
    if (pattern.test(normalized)) {
      return role;
    }
  }

  return 'bidirectional';
}

// ---------------------------------------------------------------------------
// Similarity helpers
// ---------------------------------------------------------------------------

/**
 * Compute a 0-1 name similarity score between two pin names.
 * Uses token overlap with substring matching.
 */
function nameSimilarity(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim();
  const bNorm = b.toLowerCase().trim();

  // Exact match
  if (aNorm === bNorm) {
    return 1.0;
  }

  // Token-based overlap
  const aTokens = aNorm.split(/[\s_\-/,.;:()]+/).filter(Boolean);
  const bTokens = bNorm.split(/[\s_\-/,.;:()]+/).filter(Boolean);

  if (aTokens.length === 0 || bTokens.length === 0) {
    return 0;
  }

  let matchedTokens = 0;
  const totalTokens = Math.max(aTokens.length, bTokens.length);

  for (const at of aTokens) {
    for (const bt of bTokens) {
      if (at === bt) {
        matchedTokens += 1;
        break;
      } else if (at.includes(bt) || bt.includes(at)) {
        matchedTokens += 0.5;
        break;
      }
    }
  }

  return matchedTokens / totalTokens;
}

/** Role compatibility score (0-1). Same role = 1, compatible roles get partial credit. */
function roleCompatibility(a: PinRole, b: PinRole): number {
  if (a === b) {
    return 1.0;
  }

  // Complementary pairs
  const complementary: ReadonlyArray<[PinRole, PinRole]> = [
    ['input', 'output'],
    ['output', 'input'],
    ['data', 'data'],
    ['clock', 'clock'],
  ];
  for (const [r1, r2] of complementary) {
    if (a === r1 && b === r2) {
      return 0.7;
    }
  }

  // Bidirectional is partially compatible with input, output, data
  const biCompat: ReadonlyArray<PinRole> = ['input', 'output', 'data'];
  if (a === 'bidirectional' && biCompat.includes(b)) {
    return 0.5;
  }
  if (b === 'bidirectional' && biCompat.includes(a)) {
    return 0.5;
  }

  // Analog and PWM have some overlap
  if ((a === 'analog' && b === 'pwm') || (a === 'pwm' && b === 'analog')) {
    return 0.3;
  }

  return 0;
}

/** Electrical type compatibility score (0 or 0.1 bonus). */
function electricalTypeCompatibility(
  a: ElectricalType | undefined,
  b: ElectricalType | undefined,
): number {
  if (a === undefined || b === undefined) {
    return 0;
  }
  if (a === b) {
    return 0.1;
  }

  // Input ↔ output compatibility
  const ioCompat =
    (a === 'input' && b === 'output') ||
    (a === 'output' && b === 'input') ||
    (a === 'power-input' && b === 'power-output') ||
    (a === 'power-output' && b === 'power-input') ||
    (a === 'bidirectional' && (b === 'input' || b === 'output')) ||
    (b === 'bidirectional' && (a === 'input' || a === 'output'));
  if (ioCompat) {
    return 0.05;
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Public API — mapPinsBySemantics
// ---------------------------------------------------------------------------

/**
 * Match source pins to target pins by semantic role, name similarity,
 * and electrical type.
 *
 * Strategy (weighted blend):
 *   1. Role match (weight 0.5) — same role = 1.0, complementary = 0.7, etc.
 *   2. Name similarity (weight 0.35) — token overlap / substring matching.
 *   3. Electrical type (weight 0.15) — bonus for compatible electrical types.
 *
 * Each source pin is greedily matched to the best available target pin.
 * A mapping is only emitted when the composite confidence exceeds 0.
 *
 * @param sourcePins  The pins on the source component.
 * @param targetPins  The pins on the target component.
 * @returns           Array of mappings sorted by confidence descending.
 */
export function mapPinsBySemantics(
  sourcePins: ReadonlyArray<SemanticPin>,
  targetPins: ReadonlyArray<SemanticPin>,
): PinMapping[] {
  if (sourcePins.length === 0 || targetPins.length === 0) {
    return [];
  }

  // Build a score matrix: [sourceIdx][targetIdx] → confidence
  const scores: number[][] = [];
  for (let si = 0; si < sourcePins.length; si++) {
    scores[si] = [];
    for (let ti = 0; ti < targetPins.length; ti++) {
      const src = sourcePins[si];
      const tgt = targetPins[ti];

      const roleScore = roleCompatibility(src.role, tgt.role) * 0.5;
      const nameScore = nameSimilarity(src.name, tgt.name) * 0.35;
      const elecScore = electricalTypeCompatibility(src.electricalType, tgt.electricalType) * 0.15;

      scores[si][ti] = roleScore + nameScore + elecScore;
    }
  }

  // Greedy assignment: pick the best (source, target) pair, remove both, repeat.
  const mappings: PinMapping[] = [];
  const usedSources = new Set<number>();
  const usedTargets = new Set<number>();
  const maxMappings = Math.min(sourcePins.length, targetPins.length);

  for (let m = 0; m < maxMappings; m++) {
    let bestScore = -1;
    let bestSi = -1;
    let bestTi = -1;

    for (let si = 0; si < sourcePins.length; si++) {
      if (usedSources.has(si)) {
        continue;
      }
      for (let ti = 0; ti < targetPins.length; ti++) {
        if (usedTargets.has(ti)) {
          continue;
        }
        if (scores[si][ti] > bestScore) {
          bestScore = scores[si][ti];
          bestSi = si;
          bestTi = ti;
        }
      }
    }

    if (bestSi < 0 || bestTi < 0 || bestScore <= 0) {
      break;
    }

    usedSources.add(bestSi);
    usedTargets.add(bestTi);

    mappings.push({
      sourcePin: sourcePins[bestSi],
      targetPin: targetPins[bestTi],
      confidence: Math.round(bestScore * 1000) / 1000, // 3 decimal places
    });
  }

  // Sort by confidence descending
  mappings.sort((a, b) => b.confidence - a.confidence);

  return mappings;
}

// ---------------------------------------------------------------------------
// Public API — getUnmappedPins
// ---------------------------------------------------------------------------

/**
 * Given a set of mappings and the full list of pins, return pins that
 * have no mapping on either side.
 *
 * @param mappings  The pin mappings produced by mapPinsBySemantics.
 * @param allPins   The full list of pins to check against.
 * @returns         Pins from allPins that don't appear in any mapping
 *                  (as either source or target).
 */
export function getUnmappedPins(
  mappings: ReadonlyArray<PinMapping>,
  allPins: ReadonlyArray<SemanticPin>,
): SemanticPin[] {
  const mappedPins = new Set<SemanticPin>();

  for (const mapping of mappings) {
    mappedPins.add(mapping.sourcePin);
    mappedPins.add(mapping.targetPin);
  }

  return allPins.filter((pin) => !mappedPins.has(pin));
}
