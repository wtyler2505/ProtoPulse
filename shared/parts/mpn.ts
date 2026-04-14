/**
 * Manufacturer Part Number (MPN) normalization utility.
 *
 * Provides a single canonical normalization function used across every BOM
 * ingestion path (manual add, CSV import, AI tool `add_bom_item`, FZPZ import,
 * camera/barcode scan, BOM snapshot restore, library copy, circuit instance).
 *
 * Normalization rules (applied in order):
 *   1. Trim leading/trailing whitespace.
 *   2. Collapse all internal whitespace (including non-breaking space) to a single space.
 *   3. Strip packaging/reel/lead-finish suffixes that do not affect part identity:
 *      - `/NOPB`  — TI's "no Pb" marker (e.g., `LM317T/NOPB` ≡ `LM317T`)
 *      - `#PBF`   — RoHS/lead-free suffix (e.g., `ATMEGA328P-PU#PBF` ≡ `ATMEGA328P-PU`)
 *      - `+`      — Generic trailing "+" separator
 *      - `-TR`, `-TR13`, `-7` style reel/tape-and-reel suffixes
 *   4. Remove surrounding quotes / backticks that sometimes sneak in from CSV sources.
 *
 * Casing: the normalization is **case-preserving**. Callers that want a
 * comparison key should pipe the result through `.toLowerCase()` explicitly
 * (or use {@link mpnEquals}). This keeps the original casing available for
 * display while enabling case-insensitive dedup checks.
 *
 * Manufacturer is normalized separately by {@link normalizeManufacturer} —
 * same whitespace/quote handling, no suffix stripping.
 *
 * @module shared/parts/mpn
 */

/** Strip a known packaging/lead-finish suffix, case-insensitive. Returns the string unchanged if no suffix matched. */
function stripPackagingSuffix(s: string): string {
  // Order matters: longest/most-specific first.
  const patterns: RegExp[] = [
    /\/nopb$/i,       // /NOPB
    /[#]pbf$/i,       // #PBF
    /-tr\d*$/i,       // -TR, -TR13, etc.
    /-7$/i,           // -7 (common reel suffix on Digi-Key sales codes; preserve -7 only when trailing)
    /\+$/,            // trailing +
  ];
  let out = s;
  // Apply all patterns in a loop until none match — handles chained suffixes like `LM317T/NOPB+`.
  let changed = true;
  while (changed) {
    changed = false;
    for (const re of patterns) {
      const next = out.replace(re, '');
      if (next !== out) {
        out = next;
        changed = true;
      }
    }
  }
  return out;
}

/**
 * Normalize an MPN string for comparison/dedup.
 *
 * @param raw - The raw MPN as entered by the user, imported from CSV, returned
 *   by an AI tool, or read from a fzpz file. May be `null`/`undefined`/empty.
 * @returns The cleaned MPN (case-preserving, trimmed, whitespace-collapsed,
 *   packaging suffixes stripped, surrounding quotes removed). Returns an
 *   empty string if the input was falsy or whitespace-only.
 */
export function normalizeMpn(raw: string | null | undefined): string {
  if (raw == null) { return ''; }
  // 1. Trim and replace non-breaking space with regular space.
  let out = String(raw).replace(/\u00A0/g, ' ').trim();
  if (out === '') { return ''; }

  // 2. Strip surrounding matched quotes/backticks.
  const quoteMatch = out.match(/^(['"`])(.*)\1$/);
  if (quoteMatch) {
    out = quoteMatch[2].trim();
  }

  // 3. Collapse internal whitespace.
  out = out.replace(/\s+/g, ' ');

  // 4. Strip packaging / lead-finish / reel suffixes.
  out = stripPackagingSuffix(out);

  // 5. Second trim in case stripping revealed trailing whitespace.
  return out.trim();
}

/**
 * Normalize a manufacturer name for comparison/dedup.
 * Trims, collapses whitespace, and strips surrounding quotes. Does NOT strip
 * suffixes or change case — same contract as {@link normalizeMpn} for casing.
 */
export function normalizeManufacturer(raw: string | null | undefined): string {
  if (raw == null) { return ''; }
  let out = String(raw).replace(/\u00A0/g, ' ').trim();
  if (out === '') { return ''; }
  const quoteMatch = out.match(/^(['"`])(.*)\1$/);
  if (quoteMatch) {
    out = quoteMatch[2].trim();
  }
  out = out.replace(/\s+/g, ' ');
  return out.trim();
}

/**
 * Build a case-insensitive comparison key from an MPN. Use this when indexing
 * normalized MPNs into a Map/Set for dedup; do NOT persist this value — use
 * the result of {@link normalizeMpn} (case-preserved) in the DB.
 */
export function mpnComparisonKey(raw: string | null | undefined): string {
  return normalizeMpn(raw).toLowerCase();
}

/** Case-insensitive MPN equality check after normalization. */
export function mpnEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  const an = mpnComparisonKey(a);
  const bn = mpnComparisonKey(b);
  return an !== '' && an === bn;
}

/** Case-insensitive manufacturer equality check after normalization. */
export function manufacturerEquals(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  const an = normalizeManufacturer(a).toLowerCase();
  const bn = normalizeManufacturer(b).toLowerCase();
  return an !== '' && an === bn;
}

/**
 * Composite identity check — both manufacturer and MPN must match
 * (case-insensitive, normalized). Used by BOM dedup to decide if a candidate
 * part row should bump quantity on an existing row instead of inserting.
 */
export function mpnIdentityEquals(
  a: { manufacturer?: string | null; mpn?: string | null },
  b: { manufacturer?: string | null; mpn?: string | null },
): boolean {
  return manufacturerEquals(a.manufacturer, b.manufacturer) && mpnEquals(a.mpn, b.mpn);
}
