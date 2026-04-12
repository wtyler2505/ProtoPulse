/**
 * Deterministic slug generator for `parts.slug`.
 *
 * Slug format: `{category-abbrev}-{value}-{package}-{tolerance}`
 * Examples:
 *   { canonicalCategory: 'resistor', value: '10k', packageType: '0402', tolerance: '1%' }
 *     → 'res-10k-0402-1pct'
 *   { canonicalCategory: 'capacitor', value: '100nF', packageType: '0603', tolerance: '10%' }
 *     → 'cap-100nf-0603-10pct'
 *   { canonicalCategory: 'mcu', manufacturer: 'Espressif', mpn: 'ESP32-WROOM-32' }
 *     → 'mcu-esp32-wroom-32'
 *
 * The generator is **deterministic** — same input always produces the same slug — so it can be
 * used as a dedup key during ingress. If a collision occurs at insert time, the ingress pipeline
 * appends a numeric suffix (`-2`, `-3`, …) until uniqueness is achieved. The backfill migration
 * handles this globally after the initial seed.
 */

export interface SlugInput {
  canonicalCategory: string;
  /** Free-form value like '10k', '100nF', '3V3'. Falsy values are skipped. */
  value?: string | null;
  packageType?: string | null;
  tolerance?: string | null;
  manufacturer?: string | null;
  mpn?: string | null;
}

/** Canonical abbreviations for the common categories. Unknown categories fall through to `slugify(cat)`. */
const CATEGORY_ABBREV: Record<string, string> = {
  resistor: 'res',
  resistors: 'res',
  capacitor: 'cap',
  capacitors: 'cap',
  inductor: 'ind',
  inductors: 'ind',
  diode: 'di',
  diodes: 'di',
  transistor: 'tr',
  transistors: 'tr',
  mosfet: 'mos',
  mosfets: 'mos',
  led: 'led',
  leds: 'led',
  ic: 'ic',
  mcu: 'mcu',
  microcontroller: 'mcu',
  sensor: 'sen',
  sensors: 'sen',
  connector: 'con',
  connectors: 'con',
  crystal: 'xtal',
  oscillator: 'osc',
  fuse: 'fuse',
  relay: 'rly',
  switch: 'sw',
  switches: 'sw',
  button: 'btn',
  buttons: 'btn',
  battery: 'bat',
  display: 'disp',
  speaker: 'spkr',
  motor: 'mot',
  regulator: 'reg',
  amplifier: 'amp',
  optocoupler: 'opto',
  transformer: 'xfmr',
  module: 'mod',
  board: 'brd',
};

/**
 * Lowercase and collapse a string into a URL-safe slug segment.
 * Special handling:
 *   '%' → 'pct'   (so '1%' becomes '1pct')
 *   '+' → 'p'     (so 'BC5+' becomes 'bc5p')
 *   '.' → ''      (so '3.3V' becomes '33v')
 *   any other non-alphanumeric → '-'
 * Leading/trailing hyphens are stripped.
 */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/\+/g, 'p')
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Generate a deterministic slug from part fields. Returns `'unknown-part'` if no input fields
 * would produce any segments (should be caught upstream by Zod validation).
 */
export function generateSlug(input: SlugInput): string {
  const segments: string[] = [];

  const categoryKey = input.canonicalCategory.toLowerCase().trim();
  const abbrev = CATEGORY_ABBREV[categoryKey];
  const categorySegment = abbrev ?? slugify(input.canonicalCategory);
  if (categorySegment) {
    segments.push(categorySegment);
  }

  if (input.value) {
    const valueSegment = slugify(input.value);
    if (valueSegment) {
      segments.push(valueSegment);
    }
  }
  if (input.packageType) {
    const pkgSegment = slugify(input.packageType);
    if (pkgSegment) {
      segments.push(pkgSegment);
    }
  }
  if (input.tolerance) {
    const tolSegment = slugify(input.tolerance);
    if (tolSegment) {
      segments.push(tolSegment);
    }
  }

  // Generic fallback for rows with no value/package/tolerance: append mpn if available.
  // E.g. { category: 'mcu', mpn: 'ESP32-WROOM-32' } → 'mcu-esp32-wroom-32'.
  if (segments.length <= 1 && input.mpn) {
    const mpnSegment = slugify(input.mpn);
    if (mpnSegment) {
      segments.push(mpnSegment);
    }
  }

  const joined = segments.filter(Boolean).join('-');
  return joined || 'unknown-part';
}

/**
 * Append a disambiguation suffix to a slug on collision during ingress.
 * `appendCollisionSuffix('res-10k-0402-1pct', 2) → 'res-10k-0402-1pct-2'`
 */
export function appendCollisionSuffix(baseSlug: string, n: number): string {
  return `${baseSlug}-${n}`;
}
