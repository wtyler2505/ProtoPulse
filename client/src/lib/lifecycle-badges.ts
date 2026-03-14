/**
 * Lifecycle status classification for electronic components.
 *
 * Flags parts that are NRND (Not Recommended for New Designs), EOL (End of Life),
 * obsolete, or preliminary so makers can make informed procurement decisions.
 */

export type LifecycleStatus = 'active' | 'nrnd' | 'eol' | 'obsolete' | 'preliminary' | 'unknown';

export interface LifecycleEntry {
  partNumber: string;
  manufacturer?: string;
  status: LifecycleStatus;
}

/**
 * Built-in database of ~50 known lifecycle statuses for common hobbyist/maker parts.
 * Part numbers are stored lowercase for case-insensitive matching.
 * When a manufacturer is specified, it narrows the match.
 */
const LIFECYCLE_DB: LifecycleEntry[] = [
  // ── Obsolete through-hole regulators & discretes ──
  { partNumber: 'lm7805ct', status: 'nrnd' },
  { partNumber: 'lm7812ct', status: 'nrnd' },
  { partNumber: 'lm7905ct', status: 'nrnd' },
  { partNumber: 'lm317t', status: 'nrnd' },
  { partNumber: 'lm317k', status: 'obsolete' },
  { partNumber: 'lm317hv', status: 'obsolete' },
  { partNumber: 'lm337t', status: 'nrnd' },
  { partNumber: 'lm340t-5.0', status: 'nrnd' },
  { partNumber: 'lm340t-12', status: 'nrnd' },
  { partNumber: 'ua7805', status: 'obsolete', manufacturer: 'fairchild' },

  // ── Classic 555 / logic DIP packages ──
  { partNumber: 'ne555p', status: 'nrnd' },
  { partNumber: 'ne555n', status: 'nrnd' },
  { partNumber: 'lm555cn', status: 'nrnd' },
  { partNumber: 'cd4017be', status: 'nrnd' },
  { partNumber: 'cd4060be', status: 'nrnd' },
  { partNumber: 'cd4051be', status: 'nrnd' },
  { partNumber: 'cd4066be', status: 'nrnd' },
  { partNumber: 'sn74ls00n', status: 'nrnd' },
  { partNumber: 'sn74ls04n', status: 'nrnd' },
  { partNumber: 'sn74ls08n', status: 'nrnd' },
  { partNumber: 'sn74ls14n', status: 'nrnd' },
  { partNumber: 'sn74ls74an', status: 'nrnd' },

  // ── Op-amps (DIP packages being phased out) ──
  { partNumber: 'lm741cn', status: 'nrnd' },
  { partNumber: 'lm741cn/nopb', status: 'nrnd' },
  { partNumber: 'lm358n', status: 'nrnd' },
  { partNumber: 'lm324n', status: 'nrnd' },
  { partNumber: 'ua741cp', status: 'obsolete' },
  { partNumber: 'tl071cp', status: 'nrnd' },
  { partNumber: 'tl072cp', status: 'nrnd' },
  { partNumber: 'tl074cn', status: 'nrnd' },

  // ── Motor drivers ──
  { partNumber: 'l293d', status: 'nrnd' },
  { partNumber: 'l298n', status: 'nrnd' },
  { partNumber: 'sn754410ne', status: 'obsolete' },

  // ── Sensors / misc ──
  { partNumber: 'lm35dz', status: 'nrnd' },
  { partNumber: 'lm335z', status: 'nrnd' },
  { partNumber: 'lm75a', status: 'active' },
  { partNumber: 'ds18b20', status: 'active' },
  { partNumber: 'max232cpe', status: 'nrnd' },
  { partNumber: 'max232epe', status: 'nrnd' },

  // ── EOL microcontrollers / legacy ──
  { partNumber: 'atmega8-16pu', status: 'nrnd' },
  { partNumber: 'atmega16-16pu', status: 'obsolete' },
  { partNumber: 'at89s52-24pu', status: 'obsolete' },
  { partNumber: 'pic16f84a', status: 'nrnd' },
  { partNumber: 'pic16f877a', status: 'nrnd' },

  // ── Active modern parts (for contrast / testing) ──
  { partNumber: 'atmega328p-pu', status: 'active' },
  { partNumber: 'esp32-wroom-32', status: 'active' },
  { partNumber: 'stm32f103c8t6', status: 'active' },
  { partNumber: 'lm1117t-3.3', status: 'active' },
  { partNumber: 'apa102', status: 'active' },

  // ── Preliminary / pre-production ──
  { partNumber: 'rp2350', status: 'preliminary' },
];

/**
 * Normalize a part number for lookup: lowercase, trim, strip trailing
 * packaging suffixes that don't affect lifecycle (e.g., /NOPB, +, #PBF).
 */
function normalizePartNumber(pn: string): string {
  return pn
    .toLowerCase()
    .trim()
    .replace(/\/nopb$/i, '')
    .replace(/[+#]pbf$/i, '')
    .replace(/\s+/g, '');
}

/**
 * Classify the lifecycle status of a component by its part number.
 * Returns 'unknown' if the part is not in the built-in database.
 */
export function classifyLifecycle(partNumber: string, manufacturer?: string): LifecycleStatus {
  if (!partNumber || !partNumber.trim()) {
    return 'unknown';
  }

  const normalizedPn = normalizePartNumber(partNumber);
  const normalizedMfg = manufacturer?.toLowerCase().trim();

  // First pass: try to match with manufacturer if provided
  if (normalizedMfg) {
    const mfgMatch = LIFECYCLE_DB.find(
      (entry) =>
        normalizePartNumber(entry.partNumber) === normalizedPn &&
        entry.manufacturer &&
        normalizedMfg.includes(entry.manufacturer),
    );
    if (mfgMatch) {
      return mfgMatch.status;
    }
  }

  // Second pass: match by part number only (entries without a manufacturer restriction)
  const pnMatch = LIFECYCLE_DB.find(
    (entry) =>
      normalizePartNumber(entry.partNumber) === normalizedPn &&
      !entry.manufacturer,
  );
  if (pnMatch) {
    return pnMatch.status;
  }

  // Third pass: if manufacturer wasn't provided, also check manufacturer-specific entries
  if (!normalizedMfg) {
    const anyMatch = LIFECYCLE_DB.find(
      (entry) => normalizePartNumber(entry.partNumber) === normalizedPn,
    );
    if (anyMatch) {
      return anyMatch.status;
    }
  }

  return 'unknown';
}

/**
 * Badge color classes for each lifecycle status.
 */
export function getLifecycleColor(status: LifecycleStatus): {
  bg: string;
  text: string;
  border: string;
} {
  switch (status) {
    case 'active':
      return { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' };
    case 'nrnd':
      return { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' };
    case 'eol':
      return { bg: 'bg-orange-500/10', text: 'text-orange-500', border: 'border-orange-500/20' };
    case 'obsolete':
      return { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' };
    case 'preliminary':
      return { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' };
    case 'unknown':
      return { bg: 'bg-muted/50', text: 'text-muted-foreground', border: 'border-border' };
  }
}

/**
 * Human-readable label for each lifecycle status.
 */
export function getLifecycleLabel(status: LifecycleStatus): string {
  switch (status) {
    case 'active': return 'Active';
    case 'nrnd': return 'NRND';
    case 'eol': return 'EOL';
    case 'obsolete': return 'Obsolete';
    case 'preliminary': return 'Preliminary';
    case 'unknown': return 'Unknown';
  }
}

/**
 * Actionable advice for the user based on lifecycle status.
 */
export function getLifecycleAdvice(status: LifecycleStatus): string {
  switch (status) {
    case 'active':
      return 'This part is actively manufactured and recommended for new designs.';
    case 'nrnd':
      return 'Not Recommended for New Designs — still available but the manufacturer advises against using it in new projects. Consider migrating to a recommended replacement.';
    case 'eol':
      return 'End of Life — the manufacturer has announced discontinuation. Stock up on remaining inventory or find an alternative before supply runs out.';
    case 'obsolete':
      return 'Obsolete — no longer manufactured. Only available through surplus/broker channels at inflated prices. Find a modern replacement immediately.';
    case 'preliminary':
      return 'Preliminary — pre-production or early release. Specifications may change. Use with caution in designs that need long-term stability.';
    case 'unknown':
      return 'Lifecycle status not in the built-in database. Check the manufacturer datasheet or distributor listing for current status.';
  }
}

/**
 * Returns the full list of known parts in the lifecycle database.
 * Useful for testing and inspection.
 */
export function getLifecycleDatabase(): ReadonlyArray<Readonly<LifecycleEntry>> {
  return LIFECYCLE_DB;
}
