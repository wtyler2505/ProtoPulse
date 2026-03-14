/**
 * Export File Syntax Validator — BL-0532
 *
 * Post-generation syntax checks for manufacturing export files.
 * Each validator inspects the generated output for structural correctness
 * without re-parsing the entire format — just enough to catch common
 * generator regressions before the file reaches a fab house.
 *
 * Supported formats:
 *   - Gerber RS-274X  (validateGerberSyntax)
 *   - Excellon Drill  (validateDrillSyntax)
 *   - IPC-2581B XML   (validateIpc2581Syntax)
 *   - ODB++           (validateOdbSyntax)
 *
 * Pure function library — no Express routes, no database access, no side effects.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface ValidationError {
  /** Line number (1-based) where the issue was found, or null for file-level issues */
  line: number | null;
  /** Human-readable description of the problem */
  message: string;
  /** Severity: 'error' blocks export, 'warning' is informational */
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  /** Whether the file passed validation (no errors — warnings are allowed) */
  valid: boolean;
  /** Hard errors that indicate a broken file */
  errors: ValidationError[];
  /** Soft warnings that may indicate suboptimal output */
  warnings: ValidationError[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeResult(errors: ValidationError[], warnings: ValidationError[]): ValidationResult {
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function err(line: number | null, message: string): ValidationError {
  return { line, message, severity: 'error' };
}

function warn(line: number | null, message: string): ValidationError {
  return { line, message, severity: 'warning' };
}

// ---------------------------------------------------------------------------
// Gerber RS-274X Validator
// ---------------------------------------------------------------------------

/**
 * Validates a Gerber RS-274X file for structural correctness.
 *
 * Checks:
 *  - Non-empty content
 *  - Required headers: %FSLAX...*%, %MO(MM|IN)*%
 *  - At least one aperture definition (%ADD...*%)
 *  - Presence of D01/D02/D03 operation codes (draw/move/flash)
 *  - File terminator: M02*
 *  - No unmatched % delimiters (extended command blocks)
 *  - Warns on missing G04 comment or TF attributes
 */
export function validateGerberSyntax(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!content || content.trim().length === 0) {
    errors.push(err(null, 'Gerber file is empty'));
    return makeResult(errors, warnings);
  }

  const lines = content.split('\n');

  // --- Required headers ---

  const hasFormatSpec = lines.some((l) => /^%FSLAX\d+Y\d+\*%/.test(l.trim()));
  if (!hasFormatSpec) {
    errors.push(err(null, 'Missing format specification header (%FSLAX...*%)'));
  }

  const hasModeUnit = lines.some((l) => /^%MO(MM|IN)\*%/.test(l.trim()));
  if (!hasModeUnit) {
    errors.push(err(null, 'Missing unit mode header (%MOMM*% or %MOIN*%)'));
  }

  // --- Aperture definitions ---

  const apertureLines = lines.filter((l) => /^%ADD\d+/.test(l.trim()));
  if (apertureLines.length === 0) {
    errors.push(err(null, 'No aperture definitions found (%ADD...*%)'));
  }

  // --- D-code operations ---

  const hasD01 = lines.some((l) => /D0?1\*/.test(l));
  const hasD02 = lines.some((l) => /D0?2\*/.test(l));
  const hasD03 = lines.some((l) => /D0?3\*/.test(l));

  if (!hasD01 && !hasD02 && !hasD03) {
    errors.push(err(null, 'No draw/move/flash operations (D01/D02/D03) found'));
  }

  // --- End of file ---

  const trimmedLines = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  const lastLine = trimmedLines.length > 0 ? trimmedLines[trimmedLines.length - 1] : '';
  if (lastLine !== 'M02*') {
    errors.push(err(lines.length, 'Missing end-of-file marker (M02*)'));
  }

  // --- Unmatched % delimiters ---

  let percentCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Extended commands are delimited by % on the same line (e.g. %MOMM*%)
    // or across lines. Count opening/closing %.
    for (const ch of line) {
      if (ch === '%') {
        percentCount++;
      }
    }
  }
  if (percentCount % 2 !== 0) {
    errors.push(err(null, 'Unmatched % delimiter in extended command block'));
  }

  // --- Warnings ---

  const hasComment = lines.some((l) => /^G04/.test(l.trim()));
  if (!hasComment) {
    warnings.push(warn(null, 'No G04 comment header found (recommended for file identification)'));
  }

  const hasTfAttr = lines.some((l) => /^%TF\./.test(l.trim()));
  if (!hasTfAttr) {
    warnings.push(warn(null, 'No TF file attributes found (recommended by Gerber X2 spec)'));
  }

  // --- Coordinate sanity ---

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Match coordinate commands: X...Y...D0n*
    const coordMatch = /^X(-?\d+)Y(-?\d+)D0[123]\*$/.exec(line);
    if (coordMatch) {
      const xVal = parseInt(coordMatch[1], 10);
      const yVal = parseInt(coordMatch[2], 10);
      // Coordinates in FSLAX36Y36 are in micrometers (mm * 1e6).
      // Values beyond 1e9 (~1000mm) are suspicious.
      if (Math.abs(xVal) > 1e9 || Math.abs(yVal) > 1e9) {
        warnings.push(warn(i + 1, `Coordinate values appear extremely large (X=${xVal}, Y=${yVal})`));
        break; // Only warn once
      }
    }
  }

  return makeResult(errors, warnings);
}

// ---------------------------------------------------------------------------
// Excellon Drill Validator
// ---------------------------------------------------------------------------

/**
 * Validates an Excellon NC drill file for structural correctness.
 *
 * Checks:
 *  - Non-empty content
 *  - Header block: M48 start, % end-of-header
 *  - At least one tool definition (T<n>C<diameter>)
 *  - Format declaration (FMAT,2 or METRIC/INCH)
 *  - Tool selections in drill body match header definitions
 *  - Drill coordinates (X...Y...)
 *  - End marker: M30
 *  - Warns on missing METRIC/INCH declaration
 */
export function validateDrillSyntax(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!content || content.trim().length === 0) {
    errors.push(err(null, 'Drill file is empty'));
    return makeResult(errors, warnings);
  }

  const lines = content.split('\n');

  // --- M48 header ---

  const firstNonEmpty = lines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmpty < 0 || lines[firstNonEmpty].trim() !== 'M48') {
    errors.push(err(1, 'Missing M48 header (must be first non-empty line)'));
  }

  // --- End-of-header marker ---

  const headerEndIdx = lines.findIndex((l) => l.trim() === '%');
  if (headerEndIdx < 0) {
    errors.push(err(null, 'Missing % end-of-header marker'));
  }

  // --- Tool definitions ---

  const toolDefPattern = /^T(\d+)C([\d.]+)/;
  const definedTools = new Set<number>();
  for (let i = 0; i < lines.length; i++) {
    const match = toolDefPattern.exec(lines[i].trim());
    if (match) {
      const toolNum = parseInt(match[1], 10);
      const diameter = parseFloat(match[2]);
      definedTools.add(toolNum);
      if (diameter <= 0) {
        errors.push(err(i + 1, `Tool T${toolNum} has invalid diameter: ${match[2]}`));
      }
      if (diameter > 10) {
        warnings.push(warn(i + 1, `Tool T${toolNum} diameter ${match[2]}mm seems unusually large`));
      }
    }
  }

  if (definedTools.size === 0) {
    errors.push(err(null, 'No tool definitions found (T<n>C<diameter>)'));
  }

  // --- Format / unit declaration ---

  const hasFmat = lines.some((l) => /^FMAT,\d/.test(l.trim()));
  const hasMetric = lines.some((l) => /^METRIC/.test(l.trim()));
  const hasInch = lines.some((l) => /^INCH/.test(l.trim()));

  if (!hasFmat) {
    warnings.push(warn(null, 'Missing FMAT declaration'));
  }
  if (!hasMetric && !hasInch) {
    warnings.push(warn(null, 'Missing METRIC or INCH unit declaration'));
  }

  // --- Drill body: tool selections and coordinates ---

  const toolSelectPattern = /^T(\d+)$/;
  const coordPattern = /^X-?\d+Y-?\d+$/;
  const selectedTools = new Set<number>();
  let hasCoords = false;

  // Only check lines after header end
  const bodyStart = headerEndIdx >= 0 ? headerEndIdx + 1 : 0;
  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i].trim();
    const toolMatch = toolSelectPattern.exec(line);
    if (toolMatch) {
      const toolNum = parseInt(toolMatch[1], 10);
      selectedTools.add(toolNum);
      if (!definedTools.has(toolNum)) {
        errors.push(err(i + 1, `Tool T${toolNum} selected but not defined in header`));
      }
    }
    if (coordPattern.test(line)) {
      hasCoords = true;
    }
  }

  if (!hasCoords && definedTools.size > 0) {
    warnings.push(warn(null, 'No drill coordinates found (file defines tools but has no drill hits)'));
  }

  // Warn about defined but never used tools
  for (const toolNum of Array.from(definedTools)) {
    if (!selectedTools.has(toolNum)) {
      warnings.push(warn(null, `Tool T${toolNum} defined but never selected in drill body`));
    }
  }

  // --- M30 end marker ---

  const trimmedNonEmpty = lines.map((l) => l.trim()).filter((l) => l.length > 0);
  const lastLine = trimmedNonEmpty.length > 0 ? trimmedNonEmpty[trimmedNonEmpty.length - 1] : '';
  if (lastLine !== 'M30') {
    errors.push(err(lines.length, 'Missing end-of-file marker (M30)'));
  }

  return makeResult(errors, warnings);
}

// ---------------------------------------------------------------------------
// IPC-2581 XML Validator
// ---------------------------------------------------------------------------

/**
 * Validates an IPC-2581B XML file for structural correctness.
 *
 * This is NOT a full XML parser — it performs lightweight regex checks
 * for the required IPC-2581 structure:
 *
 *  - XML declaration (<?xml ...?>)
 *  - Root <IPC-2581> element with revision attribute
 *  - Required sections: Content, LogicalNet, PhysicalNet, Bom, Ecad
 *  - Matching open/close tags for root element
 *  - Warns on missing xmlns namespace
 */
export function validateIpc2581Syntax(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!content || content.trim().length === 0) {
    errors.push(err(null, 'IPC-2581 file is empty'));
    return makeResult(errors, warnings);
  }

  const lines = content.split('\n');

  // --- XML declaration ---

  const hasXmlDecl = lines.some((l) => /^<\?xml\s+.*\?>/.test(l.trim()));
  if (!hasXmlDecl) {
    errors.push(err(null, 'Missing XML declaration (<?xml ...?>)'));
  }

  // --- Root element ---

  const hasRootOpen = content.includes('<IPC-2581');
  const hasRootClose = content.includes('</IPC-2581>');

  if (!hasRootOpen) {
    errors.push(err(null, 'Missing <IPC-2581> root element'));
  }
  if (!hasRootClose) {
    errors.push(err(null, 'Missing </IPC-2581> closing tag'));
  }

  // Revision attribute
  const revisionMatch = /revision="([^"]*)"/.exec(content);
  if (hasRootOpen && !revisionMatch) {
    errors.push(err(null, '<IPC-2581> element missing required "revision" attribute'));
  }

  // --- Required sections ---

  const requiredSections = ['Content', 'LogicalNet', 'PhysicalNet', 'Bom', 'Ecad'] as const;
  for (const section of requiredSections) {
    const hasOpen = content.includes(`<${section}`);
    const hasClose = content.includes(`</${section}>`);
    if (!hasOpen) {
      errors.push(err(null, `Missing required <${section}> section`));
    } else if (!hasClose) {
      errors.push(err(null, `<${section}> section opened but never closed`));
    }
  }

  // --- Basic well-formedness: unmatched angle brackets ---
  // Count < and > outside of CDATA/comments as a rough balance check
  let openCount = 0;
  let closeCount = 0;
  for (const ch of content) {
    if (ch === '<') {
      openCount++;
    }
    if (ch === '>') {
      closeCount++;
    }
  }
  if (openCount !== closeCount) {
    errors.push(err(null, `Unbalanced angle brackets: ${openCount} '<' vs ${closeCount} '>'`));
  }

  // --- Warnings ---

  if (hasRootOpen && !content.includes('xmlns=')) {
    warnings.push(warn(null, 'Missing xmlns namespace declaration on <IPC-2581> element'));
  }

  // Check for empty sections
  for (const section of requiredSections) {
    const openTag = new RegExp(`<${section}[^>]*>`);
    const closeTag = `</${section}>`;
    const openMatch = openTag.exec(content);
    if (openMatch) {
      const openIdx = openMatch.index + openMatch[0].length;
      const closeIdx = content.indexOf(closeTag, openIdx);
      if (closeIdx >= 0) {
        const between = content.slice(openIdx, closeIdx).trim();
        // Allow comments inside
        const withoutComments = between.replace(/<!--[\s\S]*?-->/g, '').trim();
        if (withoutComments.length === 0) {
          warnings.push(warn(null, `<${section}> section is empty`));
        }
      }
    }
  }

  return makeResult(errors, warnings);
}

// ---------------------------------------------------------------------------
// ODB++ Validator
// ---------------------------------------------------------------------------

/**
 * Validates an ODB++ archive structure.
 *
 * ODB++ is a directory-based format, typically delivered as a ZIP.
 * Since we generate the ZIP in-memory, this validator checks the
 * file listing (array of paths) for required directory markers:
 *
 *  - matrix/matrix
 *  - misc/info
 *  - steps/pcb/layers/ (at least one layer)
 *  - steps/pcb/eda/data
 *
 * It also validates the matrix file content if provided and checks
 * for standard layer names.
 *
 * @param filePaths - Array of file paths inside the ZIP archive
 * @param matrixContent - Optional content of the matrix/matrix file for deeper validation
 */
export function validateOdbSyntax(
  filePaths: string[],
  matrixContent?: string,
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  if (!filePaths || filePaths.length === 0) {
    errors.push(err(null, 'ODB++ archive contains no files'));
    return makeResult(errors, warnings);
  }

  // --- Required files ---

  const hasMatrix = filePaths.some((p) => p === 'matrix/matrix');
  const hasInfo = filePaths.some((p) => p === 'misc/info');
  const hasEdaData = filePaths.some((p) => p === 'steps/pcb/eda/data');
  const layerFiles = filePaths.filter((p) => /^steps\/pcb\/layers\/[^/]+\/features$/.test(p));

  if (!hasMatrix) {
    errors.push(err(null, 'Missing required file: matrix/matrix'));
  }
  if (!hasInfo) {
    errors.push(err(null, 'Missing required file: misc/info'));
  }
  if (!hasEdaData) {
    errors.push(err(null, 'Missing required file: steps/pcb/eda/data'));
  }
  if (layerFiles.length === 0) {
    errors.push(err(null, 'No layer feature files found in steps/pcb/layers/'));
  }

  // --- Standard layer names ---

  const expectedLayers = [
    'comp_+_top',
    'comp_+_bot',
    'solder_mask_top',
    'solder_mask_bot',
    'silk_screen_top',
    'silk_screen_bot',
    'drill',
  ];

  for (const layerName of expectedLayers) {
    const expected = `steps/pcb/layers/${layerName}/features`;
    if (!filePaths.includes(expected)) {
      warnings.push(warn(null, `Missing standard layer: ${layerName}`));
    }
  }

  // --- Matrix content validation ---

  if (matrixContent) {
    const matrixLines = matrixContent.split('\n');

    const hasUnits = matrixLines.some((l) => /^UNITS=/.test(l.trim()));
    if (!hasUnits) {
      errors.push(err(null, 'Matrix file missing UNITS declaration'));
    }

    const hasStepBlock = matrixLines.some((l) => /^STEP\s*\{/.test(l.trim()));
    if (!hasStepBlock) {
      errors.push(err(null, 'Matrix file contains no STEP blocks'));
    }

    // Validate STEP blocks have required fields
    let inStep = false;
    let stepHasName = false;
    let stepHasType = false;
    let stepLineStart = 0;

    for (let i = 0; i < matrixLines.length; i++) {
      const line = matrixLines[i].trim();
      if (/^STEP\s*\{/.test(line)) {
        inStep = true;
        stepHasName = false;
        stepHasType = false;
        stepLineStart = i + 1;
      } else if (line === '}' && inStep) {
        if (!stepHasName) {
          warnings.push(warn(stepLineStart, 'STEP block missing NAME field'));
        }
        if (!stepHasType) {
          warnings.push(warn(stepLineStart, 'STEP block missing TYPE field'));
        }
        inStep = false;
      } else if (inStep) {
        if (/^\s*NAME=/.test(line)) {
          stepHasName = true;
        }
        if (/^\s*TYPE=/.test(line)) {
          stepHasType = true;
        }
      }
    }

    // Unclosed STEP block
    if (inStep) {
      errors.push(err(stepLineStart, 'Unclosed STEP block (missing closing })'));
    }
  }

  return makeResult(errors, warnings);
}
