/**
 * Import Repair Assistant
 *
 * Auto-detects and fixes common problems in imported design files:
 *   - Missing IDs (generates UUIDs)
 *   - Invalid coordinates (clamps to valid range)
 *   - Duplicate reference designators (adds numeric suffixes)
 *   - Missing required fields (fills with sensible defaults)
 *   - Encoding issues (strips invalid characters, fixes mojibake)
 *   - Truncated JSON recovery (attempts to close braces/brackets)
 *
 * Each repair is tracked as a RepairAction so the user can review
 * what was changed.
 */

import type {
  ImportedDesign,
  ImportedComponent,
  ImportedNet,
  ImportedWire,
} from '@/lib/design-import';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type RepairCategory =
  | 'missing-id'
  | 'invalid-coords'
  | 'duplicate-refdes'
  | 'missing-field'
  | 'encoding'
  | 'truncated-json';

export type RepairSeverity = 'info' | 'warning' | 'error';

export interface RepairAction {
  /** Which repair category this falls into. */
  category: RepairCategory;
  /** How severe the original issue was. */
  severity: RepairSeverity;
  /** The entity that was repaired (component ref, net name, etc.). */
  entity: string;
  /** Human-readable description of the original problem. */
  problem: string;
  /** Human-readable description of the fix applied. */
  fix: string;
}

export interface RepairResult {
  /** The repaired design — null if repair was impossible. */
  design: ImportedDesign | null;
  /** All repairs that were applied. */
  actions: RepairAction[];
  /** Whether all critical issues were fixable. */
  success: boolean;
  /** Summary counts by category. */
  summary: Record<RepairCategory, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum valid coordinate (±100000 mils / 2540mm — generous for any EDA). */
const MAX_COORD = 100_000;

/** Default position for components missing coordinates. */
const DEFAULT_POSITION = { x: 0, y: 0 };

// ---------------------------------------------------------------------------
// UUID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for test environments without crypto.randomUUID
  idCounter += 1;
  return `repair-${Date.now().toString(36)}-${idCounter.toString(36)}`;
}

// ---------------------------------------------------------------------------
// Encoding helpers
// ---------------------------------------------------------------------------

/** Strip non-printable characters (except newlines/tabs) and fix common mojibake. */
function sanitizeString(value: string): { cleaned: string; hadIssues: boolean } {
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Replace common UTF-8 mojibake sequences
  const deMojibaked = cleaned
    .replace(/Ã¼/g, '\u00fc') // ü
    .replace(/Ã¶/g, '\u00f6') // ö
    .replace(/Ã¤/g, '\u00e4') // ä
    .replace(/Ã©/g, '\u00e9') // é
    .replace(/Ã\u0080/g, '\u00c0') // À
    .replace(/\uFFFD/g, '?'); // replacement chars → ?

  return { cleaned: deMojibaked, hadIssues: deMojibaked !== value };
}

// ---------------------------------------------------------------------------
// Truncated JSON recovery
// ---------------------------------------------------------------------------

/**
 * Attempt to recover truncated JSON by closing unclosed braces/brackets
 * and stripping trailing garbage.
 */
export function recoverTruncatedJson(input: string): { recovered: string; wasRepaired: boolean } {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return { recovered: trimmed, wasRepaired: false };
  }

  // Try parsing as-is first
  try {
    JSON.parse(trimmed);
    return { recovered: trimmed, wasRepaired: false };
  } catch {
    // Continue to recovery
  }

  // Strip trailing commas and incomplete key-value pairs
  let working = trimmed
    // Remove trailing comma possibly followed by whitespace
    .replace(/,\s*$/, '')
    // Remove incomplete key-value: `"key":` or `"key": ` at end
    .replace(/,?\s*"[^"]*"\s*:\s*$/, '')
    // Remove incomplete string value: `"key": "partial` at end
    .replace(/,?\s*"[^"]*"\s*:\s*"[^"]*$/, '');

  // Count unclosed braces and brackets
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;

  for (let i = 0; i < working.length; i++) {
    const ch = working[i];
    if (inString) {
      if (ch === '\\' && i + 1 < working.length) {
        i++; // skip escaped char
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      openBraces++;
    } else if (ch === '}') {
      openBraces--;
    } else if (ch === '[') {
      openBrackets++;
    } else if (ch === ']') {
      openBrackets--;
    }
  }

  // If we're inside a string at EOF, close it
  if (inString) {
    working += '"';
  }

  // Close unclosed brackets/braces (brackets first since they're usually inner)
  for (let i = 0; i < openBrackets; i++) {
    working += ']';
  }
  for (let i = 0; i < openBraces; i++) {
    working += '}';
  }

  // Verify the result parses
  try {
    JSON.parse(working);
    return { recovered: working, wasRepaired: true };
  } catch {
    // Last resort: try stripping from the end until it parses
    return { recovered: input, wasRepaired: false };
  }
}

// ---------------------------------------------------------------------------
// Component repair
// ---------------------------------------------------------------------------

function repairComponents(
  components: ImportedComponent[],
  actions: RepairAction[],
): ImportedComponent[] {
  const seenRefDes = new Map<string, number>();
  const repaired: ImportedComponent[] = [];

  for (const comp of components) {
    const c = { ...comp, properties: { ...comp.properties }, pins: [...comp.pins] };

    // -- Missing refDes --
    if (!c.refDes || c.refDes.trim().length === 0) {
      const generated = `U${generateId().slice(0, 6).toUpperCase()}`;
      actions.push({
        category: 'missing-id',
        severity: 'warning',
        entity: c.name || 'unknown',
        problem: 'Component has no reference designator',
        fix: `Assigned generated refDes "${generated}"`,
      });
      c.refDes = generated;
    }

    // -- Encoding issues in refDes --
    const refDesResult = sanitizeString(c.refDes);
    if (refDesResult.hadIssues) {
      actions.push({
        category: 'encoding',
        severity: 'info',
        entity: c.refDes,
        problem: 'Reference designator contains invalid characters',
        fix: `Cleaned to "${refDesResult.cleaned}"`,
      });
      c.refDes = refDesResult.cleaned;
    }

    // -- Encoding issues in name --
    if (c.name) {
      const nameResult = sanitizeString(c.name);
      if (nameResult.hadIssues) {
        actions.push({
          category: 'encoding',
          severity: 'info',
          entity: c.refDes,
          problem: `Component name contains invalid characters: "${c.name}"`,
          fix: `Cleaned to "${nameResult.cleaned}"`,
        });
        c.name = nameResult.cleaned;
      }
    }

    // -- Duplicate refDes --
    const refDesKey = c.refDes.toUpperCase();
    const count = seenRefDes.get(refDesKey) ?? 0;
    if (count > 0) {
      const suffix = count + 1;
      const original = c.refDes;
      c.refDes = `${c.refDes}_${String(suffix)}`;
      actions.push({
        category: 'duplicate-refdes',
        severity: 'warning',
        entity: original,
        problem: `Duplicate reference designator "${original}"`,
        fix: `Renamed to "${c.refDes}"`,
      });
    }
    seenRefDes.set(refDesKey, count + 1);

    // -- Missing name --
    if (!c.name || c.name.trim().length === 0) {
      c.name = c.refDes;
      actions.push({
        category: 'missing-field',
        severity: 'info',
        entity: c.refDes,
        problem: 'Component has no name',
        fix: `Set name to refDes "${c.refDes}"`,
      });
    }

    // -- Missing value --
    if (!c.value && c.value !== '0') {
      c.value = '';
      // No action needed — empty value is valid
    }

    // -- Missing package --
    if (!c.package || c.package.trim().length === 0) {
      c.package = 'Unknown';
      actions.push({
        category: 'missing-field',
        severity: 'info',
        entity: c.refDes,
        problem: 'Component has no package/footprint',
        fix: 'Set package to "Unknown"',
      });
    }

    // -- Invalid coordinates --
    if (c.position) {
      const origX = c.position.x;
      const origY = c.position.y;
      let clamped = false;

      if (!Number.isFinite(c.position.x)) {
        c.position = { ...c.position, x: DEFAULT_POSITION.x };
        clamped = true;
      } else if (Math.abs(c.position.x) > MAX_COORD) {
        c.position = { ...c.position, x: Math.sign(c.position.x) * MAX_COORD };
        clamped = true;
      }

      if (!Number.isFinite(c.position.y)) {
        c.position = { ...c.position, y: DEFAULT_POSITION.y };
        clamped = true;
      } else if (Math.abs(c.position.y) > MAX_COORD) {
        c.position = { ...c.position, y: Math.sign(c.position.y) * MAX_COORD };
        clamped = true;
      }

      if (clamped) {
        actions.push({
          category: 'invalid-coords',
          severity: 'warning',
          entity: c.refDes,
          problem: `Invalid position (${String(origX)}, ${String(origY)})`,
          fix: `Clamped to (${String(c.position.x)}, ${String(c.position.y)})`,
        });
      }
    } else {
      c.position = { ...DEFAULT_POSITION };
      actions.push({
        category: 'missing-field',
        severity: 'info',
        entity: c.refDes,
        problem: 'Component has no position',
        fix: 'Set to default position (0, 0)',
      });
    }

    // -- Pin repairs --
    const repairedPins = c.pins.map((pin, idx) => {
      const p = { ...pin };
      if (!p.number || p.number.trim().length === 0) {
        p.number = String(idx + 1);
        actions.push({
          category: 'missing-field',
          severity: 'info',
          entity: `${c.refDes}.pin[${String(idx)}]`,
          problem: 'Pin has no number',
          fix: `Assigned pin number "${p.number}"`,
        });
      }
      if (!p.name || p.name.trim().length === 0) {
        p.name = `Pin_${p.number}`;
      }
      if (!p.type) {
        p.type = 'unspecified';
      }
      return p;
    });
    c.pins = repairedPins;

    repaired.push(c);
  }

  return repaired;
}

// ---------------------------------------------------------------------------
// Net repair
// ---------------------------------------------------------------------------

function repairNets(
  nets: ImportedNet[],
  validRefDes: Set<string>,
  actions: RepairAction[],
): ImportedNet[] {
  const seenNames = new Map<string, number>();
  const repaired: ImportedNet[] = [];

  for (const net of nets) {
    const n = { ...net, pins: [...net.pins] };

    // -- Missing net name --
    if (!n.name || n.name.trim().length === 0) {
      const generated = `NET_${generateId().slice(0, 6).toUpperCase()}`;
      actions.push({
        category: 'missing-id',
        severity: 'warning',
        entity: 'net',
        problem: 'Net has no name',
        fix: `Assigned generated name "${generated}"`,
      });
      n.name = generated;
    }

    // -- Encoding in net name --
    const nameResult = sanitizeString(n.name);
    if (nameResult.hadIssues) {
      actions.push({
        category: 'encoding',
        severity: 'info',
        entity: n.name,
        problem: 'Net name contains invalid characters',
        fix: `Cleaned to "${nameResult.cleaned}"`,
      });
      n.name = nameResult.cleaned;
    }

    // -- Duplicate net names --
    const nameKey = n.name.toUpperCase();
    const count = seenNames.get(nameKey) ?? 0;
    if (count > 0) {
      const original = n.name;
      n.name = `${n.name}_${String(count + 1)}`;
      actions.push({
        category: 'duplicate-refdes',
        severity: 'warning',
        entity: original,
        problem: `Duplicate net name "${original}"`,
        fix: `Renamed to "${n.name}"`,
      });
    }
    seenNames.set(nameKey, count + 1);

    // -- Remove pins referencing non-existent components --
    const originalPinCount = n.pins.length;
    n.pins = n.pins.filter((pin) => validRefDes.has(pin.componentRef));
    if (n.pins.length < originalPinCount) {
      const removed = originalPinCount - n.pins.length;
      actions.push({
        category: 'missing-field',
        severity: 'warning',
        entity: n.name,
        problem: `${String(removed)} pin(s) reference non-existent components`,
        fix: `Removed ${String(removed)} orphan pin reference(s)`,
      });
    }

    repaired.push(n);
  }

  return repaired;
}

// ---------------------------------------------------------------------------
// Wire repair
// ---------------------------------------------------------------------------

function repairWires(
  wires: ImportedWire[],
  actions: RepairAction[],
): ImportedWire[] {
  return wires.map((wire, idx) => {
    const w = { ...wire, start: { ...wire.start }, end: { ...wire.end } };
    const label = `wire[${String(idx)}]`;
    let startClamped = false;
    let endClamped = false;

    // -- Start coordinate repair --
    if (!Number.isFinite(w.start.x)) {
      w.start.x = 0;
      startClamped = true;
    } else if (Math.abs(w.start.x) > MAX_COORD) {
      w.start.x = Math.sign(w.start.x) * MAX_COORD;
      startClamped = true;
    }
    if (!Number.isFinite(w.start.y)) {
      w.start.y = 0;
      startClamped = true;
    } else if (Math.abs(w.start.y) > MAX_COORD) {
      w.start.y = Math.sign(w.start.y) * MAX_COORD;
      startClamped = true;
    }

    // -- End coordinate repair --
    if (!Number.isFinite(w.end.x)) {
      w.end.x = 0;
      endClamped = true;
    } else if (Math.abs(w.end.x) > MAX_COORD) {
      w.end.x = Math.sign(w.end.x) * MAX_COORD;
      endClamped = true;
    }
    if (!Number.isFinite(w.end.y)) {
      w.end.y = 0;
      endClamped = true;
    } else if (Math.abs(w.end.y) > MAX_COORD) {
      w.end.y = Math.sign(w.end.y) * MAX_COORD;
      endClamped = true;
    }

    if (startClamped || endClamped) {
      actions.push({
        category: 'invalid-coords',
        severity: 'warning',
        entity: label,
        problem: 'Wire has invalid coordinates',
        fix: `Clamped to valid range (±${String(MAX_COORD)})`,
      });
    }

    // -- Missing width --
    if (w.width !== undefined && (!Number.isFinite(w.width) || w.width <= 0)) {
      actions.push({
        category: 'missing-field',
        severity: 'info',
        entity: label,
        problem: `Invalid wire width: ${String(w.width)}`,
        fix: 'Reset wire width to undefined (default)',
      });
      w.width = undefined;
    }

    return w;
  });
}

// ---------------------------------------------------------------------------
// Main repair function
// ---------------------------------------------------------------------------

/**
 * Attempt to repair an ImportedDesign that has issues.
 *
 * Returns a RepairResult with the repaired design (if possible),
 * all actions taken, and a summary.
 */
export function repairImportedDesign(design: ImportedDesign): RepairResult {
  const actions: RepairAction[] = [];

  // -- Encoding on top-level strings --
  let title = design.title;
  if (title) {
    const titleResult = sanitizeString(title);
    if (titleResult.hadIssues) {
      actions.push({
        category: 'encoding',
        severity: 'info',
        entity: 'design',
        problem: 'Design title contains invalid characters',
        fix: `Cleaned to "${titleResult.cleaned}"`,
      });
      title = titleResult.cleaned;
    }
  }

  // Repair components first so we have valid refDes set for nets
  const repairedComponents = repairComponents(design.components, actions);

  // Build set of valid refDes for net pin validation
  const validRefDes = new Set(repairedComponents.map((c) => c.refDes));

  const repairedNets = repairNets(design.nets, validRefDes, actions);
  const repairedWires = repairWires(design.wires, actions);

  // Build summary
  const summary: Record<RepairCategory, number> = {
    'missing-id': 0,
    'invalid-coords': 0,
    'duplicate-refdes': 0,
    'missing-field': 0,
    'encoding': 0,
    'truncated-json': 0,
  };
  for (const action of actions) {
    summary[action.category]++;
  }

  const repairedDesign: ImportedDesign = {
    ...design,
    title,
    components: repairedComponents,
    nets: repairedNets,
    wires: repairedWires,
    warnings: [
      ...design.warnings,
      ...actions
        .filter((a) => a.severity !== 'info')
        .map((a) => `[${a.category}] ${a.entity}: ${a.problem} -> ${a.fix}`),
    ],
  };

  return {
    design: repairedDesign,
    actions,
    success: true,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Diagnose (check without repairing)
// ---------------------------------------------------------------------------

export interface DiagnosticIssue {
  category: RepairCategory;
  severity: RepairSeverity;
  entity: string;
  problem: string;
}

/**
 * Scan a design for issues without modifying it.
 * Returns the list of problems found.
 */
export function diagnoseDesign(design: ImportedDesign): DiagnosticIssue[] {
  const issues: DiagnosticIssue[] = [];
  const seenRefDes = new Map<string, number>();

  // -- Components --
  for (const comp of design.components) {
    if (!comp.refDes || comp.refDes.trim().length === 0) {
      issues.push({
        category: 'missing-id',
        severity: 'warning',
        entity: comp.name || 'unknown',
        problem: 'Component has no reference designator',
      });
    } else {
      const key = comp.refDes.toUpperCase();
      const count = seenRefDes.get(key) ?? 0;
      if (count > 0) {
        issues.push({
          category: 'duplicate-refdes',
          severity: 'warning',
          entity: comp.refDes,
          problem: `Duplicate reference designator "${comp.refDes}"`,
        });
      }
      seenRefDes.set(key, count + 1);

      const refResult = sanitizeString(comp.refDes);
      if (refResult.hadIssues) {
        issues.push({
          category: 'encoding',
          severity: 'info',
          entity: comp.refDes,
          problem: 'Reference designator contains invalid characters',
        });
      }
    }

    if (!comp.name || comp.name.trim().length === 0) {
      issues.push({
        category: 'missing-field',
        severity: 'info',
        entity: comp.refDes || 'unknown',
        problem: 'Component has no name',
      });
    }

    if (!comp.package || comp.package.trim().length === 0) {
      issues.push({
        category: 'missing-field',
        severity: 'info',
        entity: comp.refDes || 'unknown',
        problem: 'Component has no package/footprint',
      });
    }

    if (comp.position) {
      if (!Number.isFinite(comp.position.x) || Math.abs(comp.position.x) > MAX_COORD) {
        issues.push({
          category: 'invalid-coords',
          severity: 'warning',
          entity: comp.refDes || comp.name || 'unknown',
          problem: `Invalid X coordinate: ${String(comp.position.x)}`,
        });
      }
      if (!Number.isFinite(comp.position.y) || Math.abs(comp.position.y) > MAX_COORD) {
        issues.push({
          category: 'invalid-coords',
          severity: 'warning',
          entity: comp.refDes || comp.name || 'unknown',
          problem: `Invalid Y coordinate: ${String(comp.position.y)}`,
        });
      }
    }
  }

  // -- Nets --
  const seenNetNames = new Map<string, number>();
  for (const net of design.nets) {
    if (!net.name || net.name.trim().length === 0) {
      issues.push({
        category: 'missing-id',
        severity: 'warning',
        entity: 'net',
        problem: 'Net has no name',
      });
    } else {
      const key = net.name.toUpperCase();
      const count = seenNetNames.get(key) ?? 0;
      if (count > 0) {
        issues.push({
          category: 'duplicate-refdes',
          severity: 'warning',
          entity: net.name,
          problem: `Duplicate net name "${net.name}"`,
        });
      }
      seenNetNames.set(key, count + 1);
    }
  }

  // -- Wires --
  for (let i = 0; i < design.wires.length; i++) {
    const w = design.wires[i];
    const label = `wire[${String(i)}]`;
    if (!Number.isFinite(w.start.x) || !Number.isFinite(w.start.y) ||
        Math.abs(w.start.x) > MAX_COORD || Math.abs(w.start.y) > MAX_COORD) {
      issues.push({
        category: 'invalid-coords',
        severity: 'warning',
        entity: label,
        problem: 'Wire start has invalid coordinates',
      });
    }
    if (!Number.isFinite(w.end.x) || !Number.isFinite(w.end.y) ||
        Math.abs(w.end.x) > MAX_COORD || Math.abs(w.end.y) > MAX_COORD) {
      issues.push({
        category: 'invalid-coords',
        severity: 'warning',
        entity: label,
        problem: 'Wire end has invalid coordinates',
      });
    }
  }

  return issues;
}

// ---------------------------------------------------------------------------
// Format helpers for UI display
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<RepairCategory, string> = {
  'missing-id': 'Missing IDs',
  'invalid-coords': 'Invalid Coordinates',
  'duplicate-refdes': 'Duplicate References',
  'missing-field': 'Missing Fields',
  'encoding': 'Encoding Issues',
  'truncated-json': 'Truncated Data',
};

const CATEGORY_DESCRIPTIONS: Record<RepairCategory, string> = {
  'missing-id': 'Components or nets without identifiers were assigned generated IDs.',
  'invalid-coords': 'Out-of-range or non-finite coordinates were clamped to valid values.',
  'duplicate-refdes': 'Duplicate reference designators or net names were given unique suffixes.',
  'missing-field': 'Required fields like name, package, or position were set to defaults.',
  'encoding': 'Invalid or garbled characters were cleaned up.',
  'truncated-json': 'Truncated JSON data was recovered by closing unclosed structures.',
};

export function getCategoryLabel(category: RepairCategory): string {
  return CATEGORY_LABELS[category];
}

export function getCategoryDescription(category: RepairCategory): string {
  return CATEGORY_DESCRIPTIONS[category];
}

/**
 * Format a repair summary as a human-readable string.
 */
export function formatRepairSummary(result: RepairResult): string {
  if (result.actions.length === 0) {
    return 'No issues found — the design is clean.';
  }

  const parts: string[] = [];
  for (const [category, count] of Object.entries(result.summary)) {
    if (count > 0) {
      parts.push(`${String(count)} ${CATEGORY_LABELS[category as RepairCategory].toLowerCase()}`);
    }
  }

  return `Repaired ${String(result.actions.length)} issue(s): ${parts.join(', ')}.`;
}
