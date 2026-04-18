/**
 * Arduino Library Conflict Detector
 *
 * Detects conflicts between Arduino libraries: duplicate symbols, version
 * mismatches, header include collisions, and known dependency conflicts.
 * Also parses #include directives from sketch code and resolves which
 * installed library provides a given header.
 *
 * Usage:
 *   const conflicts = detectConflicts(installedLibraries);
 *   logger.debug(formatConflictReport(conflicts));
 *
 *   const includes = parseIncludeDirectives(sketchCode);
 *   const lib = resolveLibraryForInclude('SPI.h', installedLibraries);
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ArduinoLibrary {
  /** Library name (e.g. "Adafruit_SSD1306"). */
  name: string;
  /** Semver-ish version string (e.g. "2.5.7"). */
  version: string;
  /** Header files the library exposes (e.g. ["SPI.h", "SPI_Private.h"]). */
  includes: string[];
}

export type ConflictType = 'duplicate_symbol' | 'version_mismatch' | 'include_collision' | 'dependency_conflict';

export type ConflictSeverity = 'error' | 'warning';

export interface LibraryConflict {
  /** Conflict classification. */
  type: ConflictType;
  /** Names of the libraries involved. */
  libraries: string[];
  /** Human-readable description. */
  detail: string;
  /** Whether this conflict will likely break compilation. */
  severity: ConflictSeverity;
}

// ---------------------------------------------------------------------------
// Known conflict database
// ---------------------------------------------------------------------------

export interface KnownConflictEntry {
  libraries: [string, string];
  type: ConflictType;
  detail: string;
  severity: ConflictSeverity;
}

/**
 * Curated database of well-known Arduino library conflicts.
 * Each entry represents a pair of libraries that are known to clash.
 */
export const KNOWN_CONFLICTS: readonly KnownConflictEntry[] = [
  {
    libraries: ['SPI', 'WiFi'],
    type: 'dependency_conflict',
    detail: 'WiFi library internally uses SPI — including both with different configurations can cause bus contention',
    severity: 'warning',
  },
  {
    libraries: ['Wire', 'I2C'],
    type: 'duplicate_symbol',
    detail: 'Wire and I2C both define I2C bus management functions — linking both produces duplicate symbol errors',
    severity: 'error',
  },
  {
    libraries: ['SoftwareSerial', 'AltSoftSerial'],
    type: 'dependency_conflict',
    detail: 'Both libraries compete for the same timer interrupt resources; only one software serial implementation should be active',
    severity: 'error',
  },
  {
    libraries: ['Servo', 'Tone'],
    type: 'dependency_conflict',
    detail: 'Servo and Tone both use Timer1 on AVR boards — simultaneous use causes unpredictable behavior',
    severity: 'error',
  },
  {
    libraries: ['SD', 'Ethernet'],
    type: 'dependency_conflict',
    detail: 'SD and Ethernet share the SPI bus and may conflict if chip-select pins are not explicitly managed',
    severity: 'warning',
  },
  {
    libraries: ['IRremote', 'IRLib2'],
    type: 'duplicate_symbol',
    detail: 'IRremote and IRLib2 both define IR send/receive routines — only one IR library should be installed at a time',
    severity: 'error',
  },
  {
    libraries: ['WiFi', 'WiFiNINA'],
    type: 'include_collision',
    detail: 'Both libraries provide WiFi.h — the compiler may pick the wrong one depending on include order',
    severity: 'error',
  },
  {
    libraries: ['Adafruit_GFX', 'U8g2'],
    type: 'dependency_conflict',
    detail: 'Both are display abstraction layers — using both wastes flash and may cause draw-call confusion',
    severity: 'warning',
  },
  {
    libraries: ['TinyGPS', 'TinyGPS++'],
    type: 'duplicate_symbol',
    detail: 'TinyGPS and TinyGPS++ both define GPS parsing symbols — use TinyGPS++ alone for modern projects',
    severity: 'warning',
  },
  {
    libraries: ['FastLED', 'NeoPixel'],
    type: 'dependency_conflict',
    detail: 'FastLED and Adafruit NeoPixel both control WS2812 LEDs — using both can cause timing conflicts on the data line',
    severity: 'warning',
  },
] as const;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a library name for comparison (lowercase, strip common suffixes).
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/[-_]/g, '');
}

/**
 * Check whether two library names are considered duplicates.
 * Two libraries with the same normalized name but different original names
 * are treated as duplicates (e.g. "MyLib" and "my_lib").
 */
function areNameDuplicates(a: string, b: string): boolean {
  if (a === b) {
    return false; // Same exact library, not a duplicate conflict
  }
  return normalizeName(a) === normalizeName(b);
}

/**
 * Parse a version string into comparable numeric parts.
 * Returns [major, minor, patch] — non-numeric parts become 0.
 */
function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map((p) => {
    const n = parseInt(p, 10);
    return Number.isNaN(n) ? 0 : n;
  });
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Check if two semver-ish versions have a major version mismatch,
 * which is likely to cause API incompatibilities.
 */
function hasMajorMismatch(v1: string, v2: string): boolean {
  const [major1] = parseVersion(v1);
  const [major2] = parseVersion(v2);
  return major1 !== major2;
}

// ---------------------------------------------------------------------------
// Core detection
// ---------------------------------------------------------------------------

/**
 * Detect all conflicts among a set of Arduino libraries.
 *
 * Checks performed:
 * 1. **Duplicate symbol** — two libraries with the same normalized name
 * 2. **Version mismatch** — same library name installed at different major versions
 * 3. **Include collision** — two different libraries expose the same header file
 * 4. **Known dependency conflicts** — matches against KNOWN_CONFLICTS database
 *
 * @param libraries - The installed / referenced Arduino libraries
 * @returns Array of detected conflicts, sorted errors-first
 */
export function detectConflicts(libraries: ArduinoLibrary[]): LibraryConflict[] {
  const conflicts: LibraryConflict[] = [];

  if (libraries.length < 2) {
    return conflicts;
  }

  // 1. Duplicate symbol detection (name-based)
  for (let i = 0; i < libraries.length; i++) {
    for (let j = i + 1; j < libraries.length; j++) {
      const a = libraries[i];
      const b = libraries[j];

      if (areNameDuplicates(a.name, b.name)) {
        conflicts.push({
          type: 'duplicate_symbol',
          libraries: [a.name, b.name],
          detail: `Libraries "${a.name}" (${a.version}) and "${b.name}" (${b.version}) have conflicting names and likely define the same symbols`,
          severity: 'error',
        });
      }
    }
  }

  // 2. Version mismatch detection (same exact name, different versions)
  const byName = new Map<string, ArduinoLibrary[]>();
  for (const lib of libraries) {
    const existing = byName.get(lib.name);
    if (existing) {
      existing.push(lib);
    } else {
      byName.set(lib.name, [lib]);
    }
  }

  for (const [name, instances] of Array.from(byName.entries())) {
    if (instances.length < 2) {
      continue;
    }
    for (let i = 0; i < instances.length; i++) {
      for (let j = i + 1; j < instances.length; j++) {
        const a = instances[i];
        const b = instances[j];
        if (a.version !== b.version) {
          const severity: ConflictSeverity = hasMajorMismatch(a.version, b.version) ? 'error' : 'warning';
          conflicts.push({
            type: 'version_mismatch',
            libraries: [name],
            detail: `Library "${name}" is present at versions ${a.version} and ${b.version}${severity === 'error' ? ' (major version mismatch — likely API-incompatible)' : ' (minor version difference)'}`,
            severity,
          });
        }
      }
    }
  }

  // 3. Include collision detection
  const includeMap = new Map<string, string[]>();
  for (const lib of libraries) {
    for (const inc of lib.includes) {
      const normalized = inc.toLowerCase();
      const existing = includeMap.get(normalized);
      if (existing) {
        if (!existing.includes(lib.name)) {
          existing.push(lib.name);
        }
      } else {
        includeMap.set(normalized, [lib.name]);
      }
    }
  }

  for (const [header, libNames] of Array.from(includeMap.entries())) {
    if (libNames.length > 1) {
      conflicts.push({
        type: 'include_collision',
        libraries: [...libNames],
        detail: `Header "${header}" is provided by multiple libraries: ${libNames.join(', ')} — the compiler may resolve the wrong one`,
        severity: 'error',
      });
    }
  }

  // 4. Known dependency conflicts
  const nameSet = new Set(libraries.map((l) => normalizeName(l.name)));
  for (const known of KNOWN_CONFLICTS) {
    const [nameA, nameB] = known.libraries;
    if (nameSet.has(normalizeName(nameA)) && nameSet.has(normalizeName(nameB))) {
      // Avoid adding a duplicate if we already detected this pair in an earlier pass
      const alreadyReported = conflicts.some(
        (c) =>
          c.type === known.type &&
          known.libraries.every((kn) => c.libraries.some((cl) => normalizeName(cl) === normalizeName(kn))),
      );
      if (!alreadyReported) {
        conflicts.push({
          type: known.type,
          libraries: [nameA, nameB],
          detail: known.detail,
          severity: known.severity,
        });
      }
    }
  }

  // Sort: errors first, then warnings; within each severity, alphabetical by first library
  conflicts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'error' ? -1 : 1;
    }
    return (a.libraries[0] ?? '').localeCompare(b.libraries[0] ?? '');
  });

  return conflicts;
}

// ---------------------------------------------------------------------------
// Include directive parsing
// ---------------------------------------------------------------------------

/**
 * Regex to match #include directives in Arduino/C++ sketch code.
 * Captures both angle-bracket and quoted forms:
 *   #include <SPI.h>
 *   #include "MyLib.h"
 */
const INCLUDE_RE = /^\s*#\s*include\s+[<"]([^>"]+)[>"]/gm;

/**
 * Parse all #include directives from Arduino sketch source code.
 *
 * @param sketchCode - Raw sketch/C++ source code
 * @returns Array of included file names (e.g. ["SPI.h", "Wire.h"]), deduplicated
 */
export function parseIncludeDirectives(sketchCode: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  let match: RegExpExecArray | null = null;
  // Reset lastIndex in case the regex was used before
  INCLUDE_RE.lastIndex = 0;

  while ((match = INCLUDE_RE.exec(sketchCode)) !== null) {
    const header = match[1];
    if (header && !seen.has(header)) {
      seen.add(header);
      results.push(header);
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Library resolution
// ---------------------------------------------------------------------------

/**
 * Resolve which installed library provides a given #include header.
 *
 * Resolution order:
 * 1. Exact case-sensitive match on includes[]
 * 2. Case-insensitive match on includes[]
 * 3. Library name match (e.g. "SPI" library for "SPI.h")
 *
 * @param include - The header file name (e.g. "SPI.h")
 * @param available - List of available/installed libraries
 * @returns The best matching library, or null if none found
 */
export function resolveLibraryForInclude(include: string, available: ArduinoLibrary[]): ArduinoLibrary | null {
  if (available.length === 0) {
    return null;
  }

  // 1. Exact match in includes
  for (const lib of available) {
    if (lib.includes.includes(include)) {
      return lib;
    }
  }

  // 2. Case-insensitive match in includes
  const lowerInclude = include.toLowerCase();
  for (const lib of available) {
    if (lib.includes.some((inc) => inc.toLowerCase() === lowerInclude)) {
      return lib;
    }
  }

  // 3. Library name match: strip .h/.hpp extension and compare to library name
  const baseName = include.replace(/\.(h|hpp|hh)$/i, '');
  const normalizedBase = normalizeName(baseName);

  for (const lib of available) {
    if (normalizeName(lib.name) === normalizedBase) {
      return lib;
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Conflict report formatting
// ---------------------------------------------------------------------------

const SEVERITY_PREFIX: Record<ConflictSeverity, string> = {
  error: 'ERROR',
  warning: 'WARNING',
};

const TYPE_LABEL: Record<ConflictType, string> = {
  duplicate_symbol: 'Duplicate Symbol',
  version_mismatch: 'Version Mismatch',
  include_collision: 'Include Collision',
  dependency_conflict: 'Dependency Conflict',
};

/**
 * Format an array of conflicts into a human-readable report string.
 *
 * @param conflicts - Conflicts to format
 * @returns Multi-line report string. Empty string if no conflicts.
 */
export function formatConflictReport(conflicts: LibraryConflict[]): string {
  if (conflicts.length === 0) {
    return '';
  }

  const errorCount = conflicts.filter((c) => c.severity === 'error').length;
  const warningCount = conflicts.filter((c) => c.severity === 'warning').length;

  const lines: string[] = [
    `Library Conflict Report: ${conflicts.length} issue${conflicts.length === 1 ? '' : 's'} found (${errorCount} error${errorCount === 1 ? '' : 's'}, ${warningCount} warning${warningCount === 1 ? '' : 's'})`,
    '─'.repeat(72),
  ];

  for (let i = 0; i < conflicts.length; i++) {
    const c = conflicts[i];
    lines.push(`  [${SEVERITY_PREFIX[c.severity]}] ${TYPE_LABEL[c.type]}`);
    lines.push(`    Libraries: ${c.libraries.join(', ')}`);
    lines.push(`    ${c.detail}`);
    if (i < conflicts.length - 1) {
      lines.push('');
    }
  }

  return lines.join('\n');
}
