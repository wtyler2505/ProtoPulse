/**
 * package-heights — single source of truth for component body heights (PP3D-3).
 *
 * Consolidates the THREE divergent height tables that existed before this file
 * (TD-3D-08):
 *   1. `PACKAGE_HEIGHTS` in `CssBoardViewer.tsx` (body height above board only).
 *   2. `BUILTIN_PACKAGES[].bodyDepth` in `client/src/lib/board-viewer-3d.ts`.
 *   3. `PACKAGE_DIMENSIONS[].bodyHeight` in the dead `client/src/lib/pcb/webgl-viewer.ts`.
 *
 * These tables DISAGREE on several packages — they were authored independently
 * and never reconciled. Concrete examples:
 *   - DIP-8:   CssBoardViewer 5.0  | BUILTIN_PACKAGES 3.3 | PACKAGE_DIMENSIONS 3.3
 *   - QFP-44:  CssBoardViewer 1.6  | webgl-viewer 1.6     | (TQFP-44 1.0 in board-viewer-3d)
 *   - TO-220:  CssBoardViewer 4.5  | webgl-viewer 4.83    | board-viewer-3d 15.0 (lying flat)
 *
 * Resolution policy (deliberate, not a blind merge):
 *   - The CssBoardViewer table was the value actually rendered to users in the
 *     shipping CSS viewer, so it is the PRIMARY source where it has an entry.
 *   - Where CssBoardViewer lacks an entry, we fall back to the manufacturer-
 *     datasheet-derived `PACKAGE_DIMENSIONS.bodyHeight` (the most physically
 *     accurate of the three — it carries real mounting-type metadata).
 *   - TO-220 is normalised to its UPRIGHT seated height (4.5 mm body), NOT the
 *     15 mm value board-viewer-3d used (that measured the part lying on its
 *     side, which is wrong for a board-mounted seated render).
 *
 * The map is keyed by canonical package name (upper-cased, hyphen-normalised).
 * `getPackageHeight()` performs the canonicalisation and supplies a category
 * fallback so an unknown package still gets a sane non-zero height.
 *
 * Pure module: no three.js, no React, deterministic — unit-test target.
 */

/** Heights in millimetres of the component body above the board surface. */
export const PACKAGE_HEIGHTS_MM: Readonly<Record<string, number>> = {
  // --- DIP through-hole (datasheet-accurate seated body height) ---
  'DIP-8': 3.3,
  'DIP-14': 3.3,
  'DIP-16': 3.3,
  'DIP-28': 3.3,
  'DIP-40': 3.3,
  // --- SOIC / SOP small-outline ---
  'SOIC-8': 1.75,
  'SOIC-14': 1.75,
  'SOIC-16': 1.75,
  'SOP-8': 1.75,
  // --- TSSOP thin-shrink ---
  'TSSOP-8': 1.1,
  'TSSOP-16': 1.1,
  // --- SOT transistor/regulator ---
  'SOT-23': 1.1,
  'SOT-23-5': 1.1,
  'SOT-23-6': 1.1,
  'SOT-223': 1.8,
  // --- QFP quad-flat-pack ---
  'QFP-32': 1.4,
  'QFP-44': 1.6,
  'QFP-48': 1.4,
  'QFP-64': 1.6,
  'QFP-100': 1.6,
  'QFP-144': 1.6,
  'TQFP-44': 1.0,
  // --- QFN quad-flat-no-lead ---
  'QFN-16': 0.85,
  'QFN-32': 0.85,
  'QFN-48': 0.85,
  // --- BGA ball-grid-array ---
  'BGA-256': 1.6,
  // --- TO power packages (upright seated height) ---
  'TO-92': 4.83,
  'TO-220': 4.5,
  'TO-263': 2.5,
  // --- Chip passives (0402..1206) ---
  '0402': 0.5,
  '0603': 0.6,
  '0805': 0.7,
  '1206': 0.8,
  // --- Diodes ---
  'SOD-123': 1.1,
  'SOD-323': 0.6,
  'SMA': 2.3,
};

/** Category fallbacks for packages absent from the table above (mm). */
export const CATEGORY_HEIGHT_FALLBACK_MM = {
  /** SMD chip passives / small SMD bodies. */
  passive: 0.6,
  /** Generic SMD IC bodies (SOIC-ish). */
  smd: 1.75,
  /** Generic through-hole IC bodies (DIP-ish). */
  throughHole: 3.3,
} as const;

/** Last-resort height when no table entry and no category match (mm). */
export const DEFAULT_PACKAGE_HEIGHT_MM = 2.0;

/**
 * Canonicalise a package name for table lookup: trim, upper-case, and collapse
 * whitespace/underscores to single hyphens so `soic_8`, `SOIC 8`, and `SOIC-8`
 * all resolve to the same entry.
 */
export function canonicalisePackageName(pkg: string): string {
  return pkg
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Guess a coarse height category from a package name when it isn't in the
 * explicit table. Chip-passive sizes (4-digit imperial codes) and obvious THT
 * families are recognised; everything else defaults to a generic SMD body.
 */
function categoriseUnknownPackage(canonical: string): number {
  // Imperial chip-passive codes: exactly 4 digits (0201, 0402, 0603, 1206...).
  if (/^\d{4}$/.test(canonical)) {
    return CATEGORY_HEIGHT_FALLBACK_MM.passive;
  }
  if (
    canonical.startsWith('DIP') ||
    canonical.startsWith('TO-') ||
    canonical.startsWith('PDIP')
  ) {
    return CATEGORY_HEIGHT_FALLBACK_MM.throughHole;
  }
  if (
    canonical.startsWith('SOIC') ||
    canonical.startsWith('SOP') ||
    canonical.startsWith('TSSOP') ||
    canonical.startsWith('QFP') ||
    canonical.startsWith('QFN') ||
    canonical.startsWith('SOT') ||
    canonical.startsWith('BGA') ||
    canonical.startsWith('SOD')
  ) {
    return CATEGORY_HEIGHT_FALLBACK_MM.smd;
  }
  return DEFAULT_PACKAGE_HEIGHT_MM;
}

/**
 * Resolve the body height (mm above the board surface) for a package.
 *
 * Lookup order:
 *   1. Exact canonicalised table hit.
 *   2. Category fallback inferred from the package family.
 *   3. {@link DEFAULT_PACKAGE_HEIGHT_MM}.
 *
 * @param pkg      Package name (any casing / separators).
 * @param override Explicit caller height; returned verbatim when finite & > 0.
 */
export function getPackageHeight(pkg: string | null | undefined, override?: number): number {
  if (typeof override === 'number' && Number.isFinite(override) && override > 0) {
    return override;
  }
  if (!pkg) {
    return DEFAULT_PACKAGE_HEIGHT_MM;
  }
  const canonical = canonicalisePackageName(pkg);
  const exact = PACKAGE_HEIGHTS_MM[canonical];
  if (typeof exact === 'number') {
    return exact;
  }
  return categoriseUnknownPackage(canonical);
}
