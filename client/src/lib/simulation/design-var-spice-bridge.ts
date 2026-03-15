/**
 * Design Variables ↔ SPICE Bridge (BL-0573).
 *
 * Provides bidirectional conversion between ProtoPulse's DesignVariable
 * system and SPICE `.param` directives, enabling design parameters to
 * drive circuit simulations.
 *
 * SPICE `.param` syntax:
 *   .param <name> = <value>
 *   .param <name> = {<expression>}
 *
 * References:
 *   - HSPICE User Guide: Parameters and Expressions
 *   - LTspice .param directive documentation
 */

import type { DesignVariable } from '@shared/design-variables';
import { VariableStore } from '@shared/design-variables';

// ---------------------------------------------------------------------------
// SPICE value formatting
// ---------------------------------------------------------------------------

/** SPICE-compatible SI suffix map (subset — SPICE does not support all SI prefixes). */
const SPICE_SUFFIX_MAP: ReadonlyArray<{ threshold: number; divisor: number; suffix: string }> = [
  { threshold: 1e12, divisor: 1e12, suffix: 'T' },
  { threshold: 1e9, divisor: 1e9, suffix: 'G' },
  { threshold: 1e6, divisor: 1e6, suffix: 'MEG' },
  { threshold: 1e3, divisor: 1e3, suffix: 'K' },
  { threshold: 1, divisor: 1, suffix: '' },
  { threshold: 1e-3, divisor: 1e-3, suffix: 'M' },
  { threshold: 1e-6, divisor: 1e-6, suffix: 'U' },
  { threshold: 1e-9, divisor: 1e-9, suffix: 'N' },
  { threshold: 1e-12, divisor: 1e-12, suffix: 'P' },
  { threshold: 1e-15, divisor: 1e-15, suffix: 'F' },
];

/**
 * Format a numeric value using SPICE-compatible SI suffixes.
 * Zero is returned as "0". Values too small for 'F' suffix use
 * scientific notation.
 */
export function formatSpiceValue(value: number): string {
  if (value === 0) {
    return '0';
  }

  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  for (const { threshold, divisor, suffix } of SPICE_SUFFIX_MAP) {
    if (abs >= threshold) {
      const scaled = abs / divisor;
      // Use up to 6 significant digits, strip trailing zeros
      const formatted = parseFloat(scaled.toPrecision(6)).toString();
      return `${sign}${formatted}${suffix}`;
    }
  }

  // Fallback: scientific notation for extremely small values
  return value.toExponential(6);
}

// ---------------------------------------------------------------------------
// Export: DesignVariable[] → SPICE .param directives
// ---------------------------------------------------------------------------

/**
 * Convert an array of design variables to SPICE `.param` directive lines.
 *
 * Variables that have a resolved numeric value produce a simple `.param name = value`.
 * Variables whose expression references other variables produce
 * `.param name = {expression}` (SPICE expression syntax).
 *
 * Variables with errors (unresolved, circular deps) are emitted as comments.
 *
 * @param vars - Array of design variables (order preserved)
 * @returns Multi-line string of `.param` directives with a header comment
 */
export function exportDesignVarsToSpice(vars: DesignVariable[]): string {
  if (vars.length === 0) {
    return '';
  }

  // Resolve all variables to detect which are simple literals vs expressions
  const store = new VariableStore();
  for (const v of vars) {
    store.addVariable(v);
  }
  const { resolved, errors } = store.resolveAll();

  const errorSet = new Set(errors.map((e) => e.variableName));

  const lines: string[] = [
    '* ProtoPulse Design Variables',
  ];

  for (const v of vars) {
    if (errorSet.has(v.name)) {
      // Emit as comment — cannot resolve
      const errMsg = errors.find((e) => e.variableName === v.name)?.error.message ?? 'unresolved';
      lines.push(`* ${v.name} = ${v.value} ; ERROR: ${errMsg}`);
      continue;
    }

    const resolvedValue = resolved.get(v.name);
    const deps = store.getDependencies(v.name);
    const hasVariableDeps = deps.some((dep) => store.get(dep) !== undefined);

    if (hasVariableDeps) {
      // Expression referencing other variables — use SPICE expression syntax
      lines.push(`.param ${v.name} = {${v.value}}`);
    } else if (resolvedValue !== undefined) {
      // Simple literal or expression that resolves to a constant
      lines.push(`.param ${v.name} = ${formatSpiceValue(resolvedValue)}`);
    } else {
      lines.push(`* ${v.name} = ${v.value} ; unresolved`);
    }
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Import: SPICE .param directives → DesignVariable[]
// ---------------------------------------------------------------------------

/** Regex for `.param name = value` or `.param name = {expression}`. */
const PARAM_RE = /^\.param\s+([a-zA-Z_]\w*)\s*=\s*(.+)$/i;

/** Regex for SPICE SI suffixed number: e.g. 10K, 4.7MEG, 100N */
const SPICE_NUMBER_RE = /^([+-]?\d+\.?\d*(?:[eE][+-]?\d+)?)\s*(T|G|MEG|K|M|U|N|P|F)?$/i;

/** Map SPICE suffixes (case-insensitive) to multipliers. */
const SPICE_SUFFIX_TO_MULTIPLIER: ReadonlyMap<string, number> = new Map([
  ['T', 1e12],
  ['G', 1e9],
  ['MEG', 1e6],
  ['K', 1e3],
  ['M', 1e-3],
  ['U', 1e-6],
  ['N', 1e-9],
  ['P', 1e-12],
  ['F', 1e-15],
]);

/**
 * Parse a SPICE value string (e.g. "10K", "4.7MEG", "100N", "3.3") to a number.
 * Returns NaN if the string cannot be parsed.
 */
export function parseSpiceValue(raw: string): number {
  const trimmed = raw.trim();
  const match = SPICE_NUMBER_RE.exec(trimmed);
  if (!match) {
    // Try plain number
    const num = Number(trimmed);
    return num;
  }

  const numPart = Number(match[1]);
  const suffix = match[2];

  if (!suffix) {
    return numPart;
  }

  const multiplier = SPICE_SUFFIX_TO_MULTIPLIER.get(suffix.toUpperCase());
  if (multiplier === undefined) {
    return numPart;
  }

  return numPart * multiplier;
}

/**
 * Parse SPICE `.param` directives from a netlist string and convert them
 * to DesignVariable objects.
 *
 * Recognizes:
 *   .param VCC = 3.3
 *   .param R_LOAD = 10K
 *   .param VOUT = {VCC * R2 / (R1 + R2)}
 *
 * Lines that are not `.param` directives are ignored.
 *
 * @param spice - Multi-line SPICE netlist text
 * @returns Array of parsed design variables
 */
export function importSpiceParamsToDesignVars(spice: string): DesignVariable[] {
  const vars: DesignVariable[] = [];
  const lines = spice.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('*') || trimmed.startsWith(';')) {
      continue;
    }

    const match = PARAM_RE.exec(trimmed);
    if (!match) {
      continue;
    }

    const name = match[1];
    let rawValue = match[2].trim();

    // Strip inline comment (anything after ; that is not inside braces)
    const commentIdx = rawValue.indexOf(';');
    if (commentIdx >= 0) {
      rawValue = rawValue.slice(0, commentIdx).trim();
    }

    // Check if it's a SPICE expression (wrapped in braces)
    if (rawValue.startsWith('{') && rawValue.endsWith('}')) {
      const expression = rawValue.slice(1, -1).trim();
      vars.push({ name, value: expression });
      continue;
    }

    // Try to parse as a SPICE-suffixed number
    const numericValue = parseSpiceValue(rawValue);
    if (!Number.isNaN(numericValue)) {
      vars.push({ name, value: rawValue });
    } else {
      // Treat as expression
      vars.push({ name, value: rawValue });
    }
  }

  return vars;
}

// ---------------------------------------------------------------------------
// Merge: inject .param directives into an existing SPICE netlist
// ---------------------------------------------------------------------------

/**
 * Inject design variables as `.param` directives into a SPICE netlist.
 *
 * Placement strategy:
 *   1. If the netlist already has `.param` lines, new params are inserted
 *      after the last existing `.param` line.
 *   2. Otherwise, params are inserted after the title line (line 1).
 *   3. Existing `.param` lines with the same variable name are replaced
 *      (no duplicates).
 *
 * @param netlist - Original SPICE netlist text
 * @param vars - Design variables to inject
 * @returns Modified netlist with `.param` directives merged
 */
export function mergeDesignVarsIntoNetlist(netlist: string, vars: DesignVariable[]): string {
  if (vars.length === 0) {
    return netlist;
  }

  const paramBlock = exportDesignVarsToSpice(vars);
  if (!paramBlock) {
    return netlist;
  }

  // Parse the param block into individual directives (skip header comment)
  const newParamLines = paramBlock.split('\n').filter((l) => l.startsWith('.param'));
  const newParamNames = new Set(vars.map((v) => v.name.toLowerCase()));

  const lines = netlist.split('\n');
  const result: string[] = [];
  let lastParamIdx = -1;
  let insertionDone = false;

  // First pass: find existing .param lines and mark them for replacement
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim().toLowerCase();
    if (trimmed.startsWith('.param')) {
      // Check if this existing param should be replaced
      const existingMatch = PARAM_RE.exec(lines[i].trim());
      if (existingMatch && newParamNames.has(existingMatch[1].toLowerCase())) {
        // Skip this line — it will be replaced by our new param
        lastParamIdx = i;
        continue;
      }
      lastParamIdx = i;
    }
    result.push(lines[i]);
  }

  // Second pass: insert new params at the right position
  if (lastParamIdx >= 0) {
    // Insert after the last existing .param line (accounting for removed lines)
    // Find the position in result that corresponds to just after the last non-removed .param
    let insertPos = 0;
    let originalIdx = 0;
    for (let r = 0; r < result.length; r++) {
      // Walk original lines to find where we are
      while (originalIdx < lines.length) {
        const trimmedOrig = lines[originalIdx].trim().toLowerCase();
        if (trimmedOrig.startsWith('.param')) {
          const origMatch = PARAM_RE.exec(lines[originalIdx].trim());
          if (origMatch && newParamNames.has(origMatch[1].toLowerCase())) {
            // This line was removed, skip it
            originalIdx++;
            continue;
          }
        }
        if (lines[originalIdx] === result[r]) {
          originalIdx++;
          break;
        }
        originalIdx++;
      }
      if (originalIdx - 1 <= lastParamIdx) {
        insertPos = r + 1;
      }
    }
    result.splice(insertPos, 0, ...newParamLines);
    insertionDone = true;
  }

  if (!insertionDone) {
    // No existing .param lines — insert after the title line (first line)
    if (result.length > 0) {
      result.splice(1, 0, ...newParamLines);
    } else {
      result.push(...newParamLines);
    }
  }

  return result.join('\n');
}
