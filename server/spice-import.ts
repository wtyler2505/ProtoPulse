/**
 * SPICE (.lib/.mod) and IBIS (.ibs) file parsers.
 *
 * Extracts model definitions from industry-standard simulation file formats
 * and maps them to the ProtoPulse spice_models schema.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ParsedSpiceModel {
  name: string;
  modelType: string;
  spiceDirective: string;
  parameters: Record<string, number | string>;
  description: string;
  category: string;
  sourceFile: string;
}

export interface ParseResult {
  models: ParsedSpiceModel[];
  errors: string[];
}

// ---------------------------------------------------------------------------
// SPICE type → ProtoPulse modelType / category mapping
// ---------------------------------------------------------------------------

const SPICE_TYPE_MAP: Record<string, { modelType: string; category: string }> = {
  NPN: { modelType: 'NPN', category: 'transistor' },
  PNP: { modelType: 'PNP', category: 'transistor' },
  D: { modelType: 'DIODE', category: 'diode' },
  NMOS: { modelType: 'MOSFET_N', category: 'mosfet' },
  PMOS: { modelType: 'MOSFET_P', category: 'mosfet' },
  NJF: { modelType: 'JFET_N', category: 'jfet' },
  PJF: { modelType: 'JFET_P', category: 'jfet' },
  R: { modelType: 'RESISTOR', category: 'passive' },
  C: { modelType: 'CAPACITOR', category: 'passive' },
  L: { modelType: 'INDUCTOR', category: 'passive' },
};

/**
 * Heuristic: guess a category for a .SUBCKT based on its name or pin names.
 */
function guessSubcktCategory(name: string, pinNames: string[]): { modelType: string; category: string } {
  const upper = name.toUpperCase();
  const pinStr = pinNames.join(' ').toUpperCase();

  // Op-amp patterns: names starting with LM/TL/AD/OPA/NE, or pins like IN+ IN- OUT
  if (/^(LM|TL|AD|OPA|NE|MCP|MAX)\d/i.test(name) || /IN\+.*IN-.*OUT/i.test(pinStr)) {
    return { modelType: 'OPAMP', category: 'opamp' };
  }

  // Comparator patterns: names starting with LM339/LM393/LM311
  if (/^LM3(39|93|11)/i.test(name)) {
    return { modelType: 'COMPARATOR', category: 'ic' };
  }

  // Voltage regulator patterns: 78xx/79xx/LM317/LM337/LDO
  if (/^(LM)?78\d{2}|^(LM)?79\d{2}|^LM3[13]7|^LDO/i.test(name) || upper.includes('REG')) {
    return { modelType: 'VOLTAGE_REG', category: 'voltage_regulator' };
  }

  // Timer (555, etc.)
  if (/555|556|^NE555|^LM555|^ICM7555/i.test(name)) {
    return { modelType: 'TIMER', category: 'ic' };
  }

  // Default: generic IC
  return { modelType: 'OPAMP', category: 'ic' };
}

// ---------------------------------------------------------------------------
// SPICE .lib/.mod parser
// ---------------------------------------------------------------------------

/**
 * Strip comments from a single SPICE line.
 * - Lines beginning with * are full-line comments.
 * - $ and ; are inline comment delimiters.
 */
function stripSpiceComment(line: string): string {
  // Full-line comment
  if (line.trimStart().startsWith('*')) {
    return '';
  }
  // Inline comment — $ or ; not inside quotes (simplified: first occurrence)
  const dollarIdx = line.indexOf('$');
  const semiIdx = line.indexOf(';');
  let cutIdx = -1;
  if (dollarIdx >= 0 && semiIdx >= 0) {
    cutIdx = Math.min(dollarIdx, semiIdx);
  } else if (dollarIdx >= 0) {
    cutIdx = dollarIdx;
  } else if (semiIdx >= 0) {
    cutIdx = semiIdx;
  }
  return cutIdx >= 0 ? line.slice(0, cutIdx) : line;
}

/**
 * Join continuation lines (lines starting with +) into logical lines.
 */
function joinContinuations(rawLines: string[]): string[] {
  const result: string[] = [];
  for (const raw of rawLines) {
    const stripped = stripSpiceComment(raw);
    if (stripped.trim() === '') {
      continue;
    }
    if (stripped.trimStart().startsWith('+')) {
      // Continuation of previous line
      if (result.length > 0) {
        result[result.length - 1] += ' ' + stripped.trimStart().slice(1).trim();
      }
    } else {
      result.push(stripped.trim());
    }
  }
  return result;
}

/**
 * Parse SPICE parameter key=value pairs from a parenthesized parameter string.
 * Example: "(IS=14.34E-15 BF=255.9 NF=1.0)" → { IS: 14.34e-15, BF: 255.9, NF: 1.0 }
 */
function parseSpiceParams(paramStr: string): Record<string, number | string> {
  const params: Record<string, number | string> = {};

  // Remove outer parens if present
  let cleaned = paramStr.trim();
  if (cleaned.startsWith('(')) {
    cleaned = cleaned.slice(1);
  }
  if (cleaned.endsWith(')')) {
    cleaned = cleaned.slice(0, -1);
  }

  // Match KEY=VALUE pairs (value may be a number with scientific notation or a string)
  const pairRegex = /([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([^\s=]+(?:\s*[^\s=]+)*?)(?=\s+[A-Za-z_][A-Za-z0-9_]*\s*=|$)/g;
  let match;
  while ((match = pairRegex.exec(cleaned)) !== null) {
    const key = match[1];
    const val = match[2].trim();
    const num = parseFloat(val);
    if (!isNaN(num) && /^[+-]?(\d+\.?\d*|\d*\.?\d+)([eE][+-]?\d+)?$/.test(val)) {
      params[key] = num;
    } else {
      params[key] = val;
    }
  }

  return params;
}

/**
 * Parse .MODEL directives from joined SPICE lines.
 */
function parseModelDirectives(lines: string[], filename: string): { models: ParsedSpiceModel[]; errors: string[] } {
  const models: ParsedSpiceModel[] = [];
  const errors: string[] = [];

  for (const line of lines) {
    // Match: .MODEL name type(params...)
    // The type may or may not have params in parens
    const modelMatch = /^\.MODEL\s+(\S+)\s+(\S+)\s*(.*)/i.exec(line);
    if (!modelMatch) {
      continue;
    }

    const name = modelMatch[1];
    const rawType = modelMatch[2].toUpperCase();
    // rawType might have '(' attached, e.g., "NPN(" — strip it
    const spiceType = rawType.replace(/\(.*/, '');
    const restOfLine = rawType.includes('(')
      ? rawType.slice(rawType.indexOf('(')) + ' ' + modelMatch[3]
      : modelMatch[3];

    const mapping = SPICE_TYPE_MAP[spiceType];
    if (!mapping) {
      errors.push(`Unknown SPICE model type "${spiceType}" for model "${name}" in ${filename}`);
      continue;
    }

    const parameters = parseSpiceParams(restOfLine);

    models.push({
      name,
      modelType: mapping.modelType,
      spiceDirective: line,
      parameters,
      description: `Imported from ${filename}`,
      category: mapping.category,
      sourceFile: filename,
    });
  }

  return { models, errors };
}

/**
 * Parse .SUBCKT blocks from joined SPICE lines.
 */
function parseSubcktBlocks(lines: string[], filename: string): { models: ParsedSpiceModel[]; errors: string[] } {
  const models: ParsedSpiceModel[] = [];
  const errors: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const subcktMatch = /^\.SUBCKT\s+(\S+)\s+(.*)/i.exec(lines[i]);
    if (!subcktMatch) {
      i++;
      continue;
    }

    const name = subcktMatch[1];
    const pinLine = subcktMatch[2].trim();
    // Pin names are space-separated tokens before any PARAMS: keyword
    const paramsKeywordIdx = pinLine.toUpperCase().indexOf('PARAMS:');
    const pinSection = paramsKeywordIdx >= 0 ? pinLine.slice(0, paramsKeywordIdx) : pinLine;
    const pinNames = pinSection.split(/\s+/).filter(Boolean);

    // Collect all lines until .ENDS
    const blockLines: string[] = [lines[i]];
    i++;
    let foundEnds = false;
    while (i < lines.length) {
      blockLines.push(lines[i]);
      if (/^\.ENDS/i.test(lines[i])) {
        foundEnds = true;
        i++;
        break;
      }
      i++;
    }

    if (!foundEnds) {
      errors.push(`Unterminated .SUBCKT "${name}" in ${filename} — missing .ENDS`);
      continue;
    }

    // Extract any PARAMS: key=value from the .SUBCKT line
    const parameters: Record<string, number | string> = {};
    if (paramsKeywordIdx >= 0) {
      const paramStr = pinLine.slice(paramsKeywordIdx + 7);
      Object.assign(parameters, parseSpiceParams(paramStr));
    }

    // Also extract any .PARAM lines inside the subckt
    for (const bl of blockLines) {
      const paramLineMatch = /^\.PARAM\s+(.*)/i.exec(bl);
      if (paramLineMatch) {
        Object.assign(parameters, parseSpiceParams(paramLineMatch[1]));
      }
    }

    // Add pin count info
    parameters.pins = pinNames.length;

    const { modelType, category } = guessSubcktCategory(name, pinNames);

    models.push({
      name,
      modelType,
      spiceDirective: blockLines.join('\n'),
      parameters,
      description: `Subcircuit imported from ${filename} (${pinNames.length} pins: ${pinNames.join(', ')})`,
      category,
      sourceFile: filename,
    });
  }

  return { models, errors };
}

/**
 * Parse a SPICE .lib or .mod file and extract all model definitions.
 */
export function parseSpiceFile(content: string, filename: string): ParseResult {
  const rawLines = content.split(/\r?\n/);
  const lines = joinContinuations(rawLines);

  const modelResult = parseModelDirectives(lines, filename);
  const subcktResult = parseSubcktBlocks(lines, filename);

  return {
    models: [...modelResult.models, ...subcktResult.models],
    errors: [...modelResult.errors, ...subcktResult.errors],
  };
}

// ---------------------------------------------------------------------------
// IBIS .ibs parser
// ---------------------------------------------------------------------------

/**
 * Represents a raw parsed IBIS section with its header line and body lines.
 */
interface IbisSection {
  keyword: string;
  headerLine: string;
  body: string[];
}

/**
 * Split an IBIS file into keyword sections.
 * IBIS keywords are enclosed in square brackets: [Keyword]
 */
function splitIbisSections(content: string): IbisSection[] {
  const lines = content.split(/\r?\n/);
  const sections: IbisSection[] = [];
  let current: IbisSection | null = null;

  for (const raw of lines) {
    // Skip IBIS comment lines (start with |)
    if (raw.trimStart().startsWith('|')) {
      continue;
    }

    const sectionMatch = /^\[([^\]]+)\](.*)/.exec(raw);
    if (sectionMatch) {
      if (current) {
        sections.push(current);
      }
      current = {
        keyword: sectionMatch[1].trim(),
        headerLine: sectionMatch[2].trim(),
        body: [],
      };
    } else if (current) {
      current.body.push(raw);
    }
  }

  if (current) {
    sections.push(current);
  }

  return sections;
}

/**
 * Extract a simple key-value from IBIS body lines.
 * IBIS format: "key          value" (whitespace-separated) or "key = value"
 */
function extractIbisValue(body: string[], key: string): string | undefined {
  const keyLower = key.toLowerCase();
  for (const line of body) {
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('|')) {
      continue;
    }
    // Try "key = value" or "key    value"
    const match = new RegExp(`^${key}\\s*=?\\s*(.+)`, 'i').exec(trimmed);
    if (match) {
      return match[1].trim();
    }
    // Also try when key is at the start followed by whitespace
    if (trimmed.toLowerCase().startsWith(keyLower)) {
      const rest = trimmed.slice(key.length).trim();
      if (rest.startsWith('=')) {
        return rest.slice(1).trim();
      }
      if (rest.length > 0) {
        return rest;
      }
    }
  }
  return undefined;
}

/**
 * Parse a numeric value from IBIS, handling suffixes like "V", "A", "F", etc.
 */
function parseIbisNumeric(val: string | undefined): number | undefined {
  if (!val) {
    return undefined;
  }
  // Strip trailing units/suffixes (V, A, F, s, etc.)
  const cleaned = val.replace(/[A-Za-z]+$/, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

/**
 * Map IBIS model_type to our modelType/category.
 */
function mapIbisModelType(ibisType: string): { modelType: string; category: string } {
  const upper = ibisType.toUpperCase().trim();
  switch (upper) {
    case 'INPUT':
    case 'I/O':
    case 'I/O_OPEN_DRAIN':
    case 'I/O_OPEN_SOURCE':
    case 'I/O_ECL':
      return { modelType: 'MOSFET_N', category: 'ic' };
    case 'OUTPUT':
    case 'OUTPUT_ECL':
    case 'OUTPUT_OPEN_DRAIN':
    case 'OUTPUT_OPEN_SOURCE':
    case '3-STATE':
    case '3-STATE_ECL':
      return { modelType: 'MOSFET_N', category: 'ic' };
    case 'TERMINATOR':
      return { modelType: 'RESISTOR', category: 'passive' };
    default:
      return { modelType: 'MOSFET_N', category: 'ic' };
  }
}

/**
 * Parse an IBIS (.ibs) file and extract model definitions.
 *
 * IBIS files describe I/O buffer characteristics for signal integrity simulation.
 * We extract [Model] sections and key parameters, converting them to a structured
 * representation stored alongside SPICE models.
 */
export function parseIbisFile(content: string, filename: string): ParseResult {
  const sections = splitIbisSections(content);
  const models: ParsedSpiceModel[] = [];
  const errors: string[] = [];

  // Extract top-level [Component] info for descriptions
  let componentName = '';
  let manufacturer = '';
  for (const section of sections) {
    if (section.keyword.toLowerCase() === 'component') {
      componentName = section.headerLine || extractIbisValue(section.body, 'Component') || '';
      manufacturer = extractIbisValue(section.body, 'Manufacturer') || '';
    }
  }

  // Extract [Model] sections
  for (const section of sections) {
    if (section.keyword.toLowerCase() !== 'model') {
      continue;
    }

    const modelName = section.headerLine;
    if (!modelName) {
      errors.push(`[Model] section without a name in ${filename}`);
      continue;
    }

    const modelTypeStr = extractIbisValue(section.body, 'Model_type') || 'I/O';
    const { modelType, category } = mapIbisModelType(modelTypeStr);

    const parameters: Record<string, number | string> = {};

    // Extract key IBIS parameters
    const vinh = parseIbisNumeric(extractIbisValue(section.body, 'Vinh'));
    const vinl = parseIbisNumeric(extractIbisValue(section.body, 'Vinl'));
    const vmeas = parseIbisNumeric(extractIbisValue(section.body, 'Vmeas'));
    const cComp = extractIbisValue(section.body, 'C_comp');

    if (vinh !== undefined) {
      parameters.Vinh = vinh;
    }
    if (vinl !== undefined) {
      parameters.Vinl = vinl;
    }
    if (vmeas !== undefined) {
      parameters.Vmeas = vmeas;
    }
    if (cComp !== undefined) {
      // C_comp can have "typ min max" columns
      const cParts = cComp.split(/\s+/);
      const cTyp = parseFloat(cParts[0]);
      if (!isNaN(cTyp)) {
        parameters.C_comp = cTyp;
      }
    }

    parameters.ibis_model_type = modelTypeStr;

    if (manufacturer) {
      parameters.manufacturer = manufacturer;
    }

    // Build a synthetic SPICE directive comment (IBIS models don't have native SPICE directives,
    // but we store the key characteristics in a readable format)
    const directiveLines: string[] = [
      `* IBIS Model: ${modelName}`,
      `* Source: ${filename}`,
      `* Model_type: ${modelTypeStr}`,
    ];
    if (componentName) {
      directiveLines.push(`* Component: ${componentName}`);
    }
    if (manufacturer) {
      directiveLines.push(`* Manufacturer: ${manufacturer}`);
    }
    if (vinh !== undefined) {
      directiveLines.push(`* Vinh = ${vinh}`);
    }
    if (vinl !== undefined) {
      directiveLines.push(`* Vinl = ${vinl}`);
    }

    const descParts: string[] = [`IBIS ${modelTypeStr} model`];
    if (componentName) {
      descParts.push(`from ${componentName}`);
    }
    if (manufacturer) {
      descParts.push(`(${manufacturer})`);
    }
    descParts.push(`— imported from ${filename}`);

    models.push({
      name: modelName,
      modelType,
      spiceDirective: directiveLines.join('\n'),
      parameters,
      description: descParts.join(' '),
      category,
      sourceFile: filename,
    });
  }

  if (models.length === 0 && errors.length === 0) {
    errors.push(`No [Model] sections found in IBIS file ${filename}`);
  }

  return { models, errors };
}

// ---------------------------------------------------------------------------
// Unified dispatcher
// ---------------------------------------------------------------------------

const ALLOWED_EXTENSIONS = new Set(['.lib', '.mod', '.ibs']);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/**
 * Validate a filename's extension for SPICE/IBIS import.
 */
export function validateImportFilename(filename: string): { valid: boolean; error?: string; extension?: string } {
  const dotIdx = filename.lastIndexOf('.');
  if (dotIdx < 0) {
    return { valid: false, error: `File "${filename}" has no extension. Expected .lib, .mod, or .ibs` };
  }
  const ext = filename.slice(dotIdx).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Unsupported file extension "${ext}". Expected .lib, .mod, or .ibs`,
    };
  }
  return { valid: true, extension: ext };
}

/**
 * Validate file content size.
 */
export function validateImportSize(byteLength: number): { valid: boolean; error?: string } {
  if (byteLength > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  if (byteLength === 0) {
    return { valid: false, error: 'File is empty' };
  }
  return { valid: true };
}

/**
 * Parse a SPICE or IBIS file based on its extension.
 */
export function parseImportFile(content: string, filename: string): ParseResult {
  const { extension } = validateImportFilename(filename);
  if (extension === '.ibs') {
    return parseIbisFile(content, filename);
  }
  return parseSpiceFile(content, filename);
}
