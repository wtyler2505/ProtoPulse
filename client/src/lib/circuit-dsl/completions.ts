/**
 * Circuit DSL autocomplete — context-aware completion for the CodeMirror editor.
 *
 * Provides completions for:
 *   - Builder methods after `c.`
 *   - Option keys inside `c.resistor({`, `c.ic({`, etc.
 *   - IC/component part names inside `part: "`
 *   - Variable names inside `c.connect(` / `c.chain(`
 */

import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';

// ---------------------------------------------------------------------------
// Known component part names (mirrors IC_PIN_DEFAULTS in circuit-api.ts)
// ---------------------------------------------------------------------------

const KNOWN_PARTS: readonly string[] = [
  'ATmega328P',
  'ATmega2560',
  'ESP32',
  'NE555',
  'LM358',
  'LM741',
  '7400',
  '7402',
  '7404',
  '7408',
  '7432',
];

// ---------------------------------------------------------------------------
// Builder method definitions
// ---------------------------------------------------------------------------

interface MethodDef {
  readonly label: string;
  readonly detail: string;
}

const BUILDER_METHODS: readonly MethodDef[] = [
  { label: 'resistor', detail: 'Add a resistor ({ value, footprint?, refdes?, part? })' },
  { label: 'capacitor', detail: 'Add a capacitor ({ value, footprint?, refdes?, part? })' },
  { label: 'inductor', detail: 'Add an inductor ({ value, footprint?, refdes?, part? })' },
  { label: 'diode', detail: 'Add a diode ({ part, footprint?, refdes?, value? })' },
  { label: 'led', detail: 'Add an LED ({ part, footprint?, refdes?, value? })' },
  { label: 'transistor', detail: 'Add a transistor ({ part, footprint?, refdes?, value? })' },
  { label: 'ic', detail: 'Add an IC ({ part, footprint?, refdes?, value? })' },
  { label: 'connector', detail: 'Add a connector ({ part, pins, footprint?, refdes?, value? })' },
  { label: 'generic', detail: 'Add a generic component ({ part, refdesPrefix, pins, footprint?, value? })' },
  { label: 'net', detail: 'Create a named net (name, { voltage?, ground? })' },
  { label: 'connect', detail: 'Connect pins/nets together (...refs)' },
  { label: 'chain', detail: 'Chain components/nets in series (...items)' },
  { label: 'export', detail: 'Export the circuit as CircuitIR' },
];

// ---------------------------------------------------------------------------
// Option keys per component type
// ---------------------------------------------------------------------------

/** Passive components: resistor, capacitor, inductor */
const PASSIVE_KEYS = ['value', 'footprint', 'refdes', 'part'];

/** Active components: diode, led, transistor, ic */
const ACTIVE_KEYS = ['part', 'footprint', 'refdes', 'value'];

/** Connector */
const CONNECTOR_KEYS = ['part', 'pins', 'footprint', 'refdes', 'value'];

/** Generic */
const GENERIC_KEYS = ['part', 'refdesPrefix', 'pins', 'footprint', 'value'];

/** Net options (second argument) */
const NET_KEYS = ['voltage', 'ground'];

const METHOD_TO_OPTION_KEYS: Record<string, readonly string[]> = {
  resistor: PASSIVE_KEYS,
  capacitor: PASSIVE_KEYS,
  inductor: PASSIVE_KEYS,
  diode: ACTIVE_KEYS,
  led: ACTIVE_KEYS,
  transistor: ACTIVE_KEYS,
  ic: ACTIVE_KEYS,
  connector: CONNECTOR_KEYS,
  generic: GENERIC_KEYS,
  net: NET_KEYS,
};

// ---------------------------------------------------------------------------
// Context detection types
// ---------------------------------------------------------------------------

export type CompletionContextType = 'method' | 'option-key' | 'part-name' | 'connect-arg';

// ---------------------------------------------------------------------------
// detectContext — analyze text before cursor to determine completion type
// ---------------------------------------------------------------------------

/**
 * Determine what kind of completion to offer based on the text before the cursor.
 *
 * Returns:
 *   - `'method'`       — after `c.` (suggest builder methods)
 *   - `'option-key'`   — inside `c.resistor({` (suggest option keys)
 *   - `'part-name'`    — inside `part: "` (suggest IC part names)
 *   - `'connect-arg'`  — inside `c.connect(` or `c.chain(` (suggest variable names)
 *   - `null`           — no completion context detected
 */
export function detectContext(textBefore: string): CompletionContextType | null {
  // Check for part-name context first (most specific) — `part: "` inside a method call
  // Match: c.ic({ part: "ATm  or  c.diode({ part: "
  if (/c\.\w+\(\{[^}]*part:\s*"[^"]*$/.test(textBefore)) {
    return 'part-name';
  }

  // Check for option-key context — inside `c.methodName({` but NOT inside a string value
  // Must be after `c.<method>({` with optional existing key-value pairs, and cursor is
  // at a position where a new key is expected (after `{`, after `, `)
  if (/c\.(\w+)\([^)]*\{[^}]*$/.test(textBefore)) {
    // Make sure we're not inside a string value
    const afterBrace = textBefore.slice(textBefore.lastIndexOf('{'));
    // Count unescaped quotes — if odd, we're inside a string
    const quoteCount = (afterBrace.match(/(?<!\\)"/g) ?? []).length;
    if (quoteCount % 2 === 0) {
      return 'option-key';
    }
  }

  // Check for net option-key context — `c.net("name", {`
  if (/c\.net\([^)]*,\s*\{[^}]*$/.test(textBefore)) {
    const afterBrace = textBefore.slice(textBefore.lastIndexOf('{'));
    const quoteCount = (afterBrace.match(/(?<!\\)"/g) ?? []).length;
    if (quoteCount % 2 === 0) {
      return 'option-key';
    }
  }

  // Check for connect-arg context — inside `c.connect(` or `c.chain(`
  if (/c\.(connect|chain)\([^)]*$/.test(textBefore)) {
    return 'connect-arg';
  }

  // Check for method context — after `c.` with optional partial method name
  if (/c\.\w*$/.test(textBefore)) {
    return 'method';
  }

  return null;
}

// ---------------------------------------------------------------------------
// getOptionsForContext — return completion options for a given context
// ---------------------------------------------------------------------------

export interface CompletionOption {
  readonly label: string;
  readonly detail?: string;
  readonly type?: string;
}

/**
 * Return completion options for the detected context.
 *
 * @param context - The detected completion context type
 * @param textBefore - The full text before the cursor (used to extract method name, variable names, etc.)
 */
export function getOptionsForContext(context: CompletionContextType, textBefore: string): CompletionOption[] {
  switch (context) {
    case 'method':
      return BUILDER_METHODS.map((m) => ({
        label: m.label,
        detail: m.detail,
        type: 'method',
      }));

    case 'option-key': {
      const methodName = extractMethodName(textBefore);
      const keys = METHOD_TO_OPTION_KEYS[methodName] ?? ACTIVE_KEYS;
      return keys.map((key) => ({
        label: key,
        detail: `${methodName} option`,
        type: 'property',
      }));
    }

    case 'part-name':
      return KNOWN_PARTS.map((name) => ({
        label: name,
        detail: 'Component part',
        type: 'constant',
      }));

    case 'connect-arg':
      return extractVariableNames(textBefore).map((name) => ({
        label: name,
        detail: 'Circuit variable',
        type: 'variable',
      }));
  }
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/** Returns the list of known IC/component part names from the standard library. */
export function getComponentNames(): string[] {
  return [...KNOWN_PARTS];
}

/** Returns builder method completion options. */
export function getMethodCompletions(): CompletionOption[] {
  return BUILDER_METHODS.map((m) => ({
    label: m.label,
    detail: m.detail,
    type: 'method',
  }));
}

// ---------------------------------------------------------------------------
// CodeMirror CompletionSource
// ---------------------------------------------------------------------------

/**
 * CodeMirror CompletionSource for the Circuit DSL.
 *
 * Plug this into a CodeMirror `autocompletion()` extension:
 *
 *   import { autocompletion } from '@codemirror/autocomplete';
 *   autocompletion({ override: [circuitCompletionSource] })
 */
export function circuitCompletionSource(ctx: CompletionContext): CompletionResult | null {
  // Get the line text up to the cursor position
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);

  // For connect-arg context we need the full document text to find variable names
  const fullTextBefore = ctx.state.doc.sliceString(0, ctx.pos);

  const context = detectContext(textBefore);
  if (!context) {
    return null;
  }

  const options = getOptionsForContext(
    context,
    context === 'connect-arg' ? fullTextBefore : textBefore,
  );

  if (options.length === 0) {
    return null;
  }

  // Calculate the `from` position — where the completion starts replacing text
  const from = computeFrom(context, textBefore, line.from);

  const completions: Completion[] = options.map((opt) => ({
    label: opt.label,
    detail: opt.detail,
    type: opt.type,
  }));

  return { from, options: completions };
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Extract the builder method name from text like `c.resistor({ v` */
function extractMethodName(textBefore: string): string {
  // Match the last `c.<methodName>(` pattern
  const match = /c\.(\w+)\(/.exec(textBefore);
  return match?.[1] ?? '';
}

/**
 * Extract variable names from the code (scan for `const xxx =` patterns).
 * Excludes the circuit builder variable `c`.
 */
function extractVariableNames(textBefore: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const re = /\b(?:const|let|var)\s+(\w+)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(textBefore)) !== null) {
    const name = match[1];
    // Skip the circuit builder itself
    if (name === 'c' || seen.has(name)) {
      continue;
    }
    seen.add(name);
    names.push(name);
  }
  return names;
}

/** Compute the `from` position for the completion result. */
function computeFrom(context: CompletionContextType, textBefore: string, lineFrom: number): number {
  switch (context) {
    case 'method': {
      // After `c.` — replace partial method name
      const dotIdx = textBefore.lastIndexOf('.');
      return lineFrom + dotIdx + 1;
    }
    case 'option-key': {
      // After `{` or `, ` — replace partial key name
      // Find the last non-alphanumeric before cursor that starts the key
      const match = /[\s,{](\w*)$/.exec(textBefore);
      if (match) {
        return lineFrom + textBefore.length - match[1].length;
      }
      return lineFrom + textBefore.length;
    }
    case 'part-name': {
      // Inside `part: "xxx` — replace partial part name
      const quoteIdx = textBefore.lastIndexOf('"');
      return lineFrom + quoteIdx + 1;
    }
    case 'connect-arg': {
      // After `(` or `, ` — replace partial variable name
      const match = /[\s,(](\w*)$/.exec(textBefore);
      if (match) {
        return lineFrom + textBefore.length - match[1].length;
      }
      return lineFrom + textBefore.length;
    }
  }
}
