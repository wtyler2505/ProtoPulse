// ──────────────────────────────────────────────────────────────────
// BL-0634 — Server-Side Static Analysis Manager
// ──────────────────────────────────────────────────────────────────
// Parses Cppcheck XML and Clang-Tidy text output, merges/deduplicates
// findings, produces CodeMirror-compatible annotations, and falls
// back to the local static-analysis.ts engine when server tools
// are unavailable.
// Singleton + subscribe pattern for useSyncExternalStore integration.
// ──────────────────────────────────────────────────────────────────

import { analyzeCode } from './static-analysis';
import type { AnalysisConfig, AnalysisFinding, AnalysisResult, Severity } from './static-analysis';

// ─── Types ───────────────────────────────────────────────────────

type Listener = () => void;

export type ToolSource = 'cppcheck' | 'clang-tidy' | 'local';

export interface ServerFinding {
  readonly line: number;
  readonly column: number;
  readonly severity: Severity;
  readonly ruleId: string;
  readonly message: string;
  readonly suggestion: string;
  readonly cweId?: number;
  readonly snippet?: string;
  readonly source: ToolSource;
  readonly file?: string;
}

export interface MergedResult {
  readonly findings: readonly ServerFinding[];
  readonly totalFindings: number;
  readonly errors: number;
  readonly warnings: number;
  readonly style: number;
  readonly performance: number;
  readonly portability: number;
  readonly sources: readonly ToolSource[];
}

/**
 * CodeMirror 6 Diagnostic-compatible annotation.
 */
export interface CodeMirrorAnnotation {
  readonly from: number;
  readonly to: number;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
  readonly source: string;
  readonly ruleId: string;
}

export interface CppcheckRule {
  readonly id: string;
  readonly severity: Severity;
  readonly category: string;
  readonly description: string;
  readonly cweId?: number;
}

export interface ServerAnalysisState {
  readonly isAnalyzing: boolean;
  readonly lastResult: MergedResult | null;
  readonly lastAnnotations: readonly CodeMirrorAnnotation[];
  readonly availableTools: readonly ToolSource[];
  readonly error: string | null;
}

// ─── Cppcheck Rule Database (30+) ───────────────────────────────

export const CPPCHECK_RULES: readonly CppcheckRule[] = [
  // Memory
  { id: 'nullPointer', severity: 'error', category: 'nullPointer', description: 'Null pointer dereference', cweId: 476 },
  { id: 'nullPointerArithmetic', severity: 'error', category: 'nullPointer', description: 'Pointer arithmetic with null pointer', cweId: 476 },
  { id: 'nullPointerRedundantCheck', severity: 'warning', category: 'nullPointer', description: 'Redundant null check after dereference', cweId: 476 },
  { id: 'memleak', severity: 'error', category: 'memleak', description: 'Memory leak: allocated memory not freed', cweId: 401 },
  { id: 'resourceLeak', severity: 'error', category: 'memleak', description: 'Resource leak: file handle not closed', cweId: 775 },
  { id: 'doubleFree', severity: 'error', category: 'memleak', description: 'Double free or use-after-free', cweId: 415 },
  { id: 'deallocuse', severity: 'error', category: 'memleak', description: 'Use of deallocated memory', cweId: 416 },
  { id: 'leakReturnValNotUsed', severity: 'warning', category: 'memleak', description: 'Return value of allocation not stored', cweId: 401 },

  // Buffer
  { id: 'bufferAccessOutOfBounds', severity: 'error', category: 'bufferAccessOutOfBounds', description: 'Array index out of bounds', cweId: 788 },
  { id: 'arrayIndexOutOfBounds', severity: 'error', category: 'bufferAccessOutOfBounds', description: 'Array index out of bounds', cweId: 788 },
  { id: 'outOfBounds', severity: 'error', category: 'bufferAccessOutOfBounds', description: 'Out of bounds access', cweId: 788 },
  { id: 'negativeIndex', severity: 'error', category: 'bufferAccessOutOfBounds', description: 'Negative array index', cweId: 786 },

  // Uninitialized
  { id: 'uninitvar', severity: 'error', category: 'uninitvar', description: 'Uninitialized variable used', cweId: 457 },
  { id: 'uninitdata', severity: 'error', category: 'uninitvar', description: 'Uninitialized data used', cweId: 457 },
  { id: 'uninitstring', severity: 'error', category: 'uninitvar', description: 'Uninitialized string used', cweId: 457 },

  // Style
  { id: 'variableScope', severity: 'style', category: 'style', description: 'Variable scope can be reduced' },
  { id: 'unreadVariable', severity: 'style', category: 'style', description: 'Variable is assigned but never read', cweId: 563 },
  { id: 'unusedVariable', severity: 'style', category: 'style', description: 'Unused variable', cweId: 563 },
  { id: 'unusedFunction', severity: 'style', category: 'style', description: 'Unused function' },
  { id: 'redundantAssignment', severity: 'style', category: 'style', description: 'Redundant assignment — variable overwritten before read' },
  { id: 'constParameter', severity: 'style', category: 'style', description: 'Parameter can be declared const' },
  { id: 'constVariable', severity: 'style', category: 'style', description: 'Variable can be declared const' },
  { id: 'duplicateBreak', severity: 'style', category: 'style', description: 'Duplicate break statement' },
  { id: 'shadowVariable', severity: 'style', category: 'style', description: 'Local variable shadows outer variable' },

  // Warning
  { id: 'redundantCondition', severity: 'warning', category: 'warning', description: 'Redundant condition — always true or always false' },
  { id: 'duplicateCondition', severity: 'warning', category: 'warning', description: 'Duplicate condition in if-else-if chain' },
  { id: 'signConversion', severity: 'warning', category: 'warning', description: 'Implicit sign conversion may change value', cweId: 195 },
  { id: 'shiftTooManyBits', severity: 'error', category: 'warning', description: 'Shift count exceeds type width', cweId: 758 },
  { id: 'integerOverflow', severity: 'error', category: 'warning', description: 'Integer overflow in expression', cweId: 190 },
  { id: 'zerodiv', severity: 'error', category: 'warning', description: 'Division by zero', cweId: 369 },

  // Performance
  { id: 'passedByValue', severity: 'performance', category: 'performance', description: 'Function parameter passed by value — consider const reference' },
  { id: 'stlFindInsert', severity: 'performance', category: 'performance', description: 'STL find followed by insert — use emplace' },
  { id: 'useStlAlgorithm', severity: 'performance', category: 'performance', description: 'Loop can be replaced with STL algorithm' },

  // Portability
  { id: 'truncLongCastAssignment', severity: 'portability', category: 'portability', description: 'Truncation from long to int on assignment', cweId: 197 },
  { id: 'invalidPointerCast', severity: 'portability', category: 'portability', description: 'Invalid pointer cast may cause alignment issues', cweId: 704 },
  { id: 'sizeofDivisionMemfunc', severity: 'portability', category: 'portability', description: 'Division by sizeof in memory function call' },
] as const;

// ─── Cppcheck XML Parser ────────────────────────────────────────

/**
 * Severity mapping from Cppcheck XML to our internal Severity type.
 */
function mapCppcheckSeverity(sev: string): Severity {
  switch (sev) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'style': return 'style';
    case 'performance': return 'performance';
    case 'portability': return 'portability';
    case 'information': return 'style';
    default: return 'warning';
  }
}

/**
 * Look up a Cppcheck rule by its ID.
 */
export function getCppcheckRule(id: string): CppcheckRule | undefined {
  return CPPCHECK_RULES.find((r) => r.id === id);
}

/**
 * Parse Cppcheck XML output (version 2 format) into ServerFinding[].
 *
 * Cppcheck XML format:
 * ```xml
 * <?xml version="1.0" encoding="UTF-8"?>
 * <results version="2">
 *   <errors>
 *     <error id="nullPointer" severity="error" msg="Null pointer dereference: ptr"
 *            verbose="..." cwe="476">
 *       <location file="main.c" line="10" column="5"/>
 *     </error>
 *   </errors>
 * </results>
 * ```
 */
export function parseCppcheckXml(xml: string): ServerFinding[] {
  const findings: ServerFinding[] = [];

  // Match each <error> element
  const errorRe = /<error\s+([^>]*)(?:\/>|>([\s\S]*?)<\/error>)/g;
  let errorMatch: RegExpExecArray | null = null;

  while ((errorMatch = errorRe.exec(xml)) !== null) {
    const attrs = errorMatch[1];
    const inner = errorMatch[2] ?? '';

    const id = extractAttr(attrs, 'id');
    const severity = extractAttr(attrs, 'severity');
    const msg = extractAttr(attrs, 'msg');
    const verbose = extractAttr(attrs, 'verbose');
    const cweStr = extractAttr(attrs, 'cwe');

    if (!id || !severity || !msg) { continue; }

    // Skip internal cppcheck informational messages
    if (id === 'missingInclude' || id === 'missingIncludeSystem' || id === 'toomanyconfigs') {
      continue;
    }

    // Parse location(s) — may have multiple
    const locationRe = /<location\s+([^>]*)\/?>/g;
    let locMatch: RegExpExecArray | null = null;
    let primaryLine = 1;
    let primaryColumn = 1;
    let primaryFile = '';

    while ((locMatch = locationRe.exec(inner)) !== null) {
      const locAttrs = locMatch[1];
      const file = extractAttr(locAttrs, 'file') ?? '';
      const line = parseInt(extractAttr(locAttrs, 'line') ?? '1', 10);
      const column = parseInt(extractAttr(locAttrs, 'column') ?? '1', 10);
      // Use first location as primary
      if (primaryFile === '') {
        primaryFile = file;
        primaryLine = line;
        primaryColumn = column;
      }
    }

    // If no <location>, check attrs directly (compact format)
    if (primaryFile === '') {
      const file = extractAttr(attrs, 'file') ?? '';
      const line = parseInt(extractAttr(attrs, 'line') ?? '1', 10);
      const column = parseInt(extractAttr(attrs, 'column') ?? '1', 10);
      primaryFile = file;
      primaryLine = line;
      primaryColumn = column;
    }

    const rule = getCppcheckRule(id);
    const mappedSev = mapCppcheckSeverity(severity);

    findings.push({
      line: primaryLine,
      column: primaryColumn,
      severity: mappedSev,
      ruleId: id,
      message: decodeXmlEntities(msg),
      suggestion: verbose ? decodeXmlEntities(verbose) : (rule?.description ?? ''),
      cweId: cweStr ? parseInt(cweStr, 10) : rule?.cweId,
      file: primaryFile,
      source: 'cppcheck',
    });
  }

  return findings;
}

// ─── Clang-Tidy Text Parser ─────────────────────────────────────

/**
 * Severity mapping from Clang-Tidy diagnostic level to our Severity.
 */
function mapClangTidySeverity(level: string): Severity {
  switch (level.toLowerCase()) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'note': return 'style';
    case 'remark': return 'style';
    default: return 'warning';
  }
}

/**
 * Parse Clang-Tidy text output into ServerFinding[].
 *
 * Clang-Tidy output format:
 * ```
 * file.c:10:5: warning: some message [check-name]
 *   int *p = NULL;
 *       ^
 * file.c:15:3: error: another message [another-check]
 * ```
 */
export function parseClangTidyOutput(text: string): ServerFinding[] {
  const findings: ServerFinding[] = [];
  const lines = text.split('\n');

  // Pattern: file:line:col: severity: message [check-name]
  const diagRe = /^(.+?):(\d+):(\d+):\s*(warning|error|note|remark):\s*(.*?)\s*\[([^\]]+)\]\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const match = diagRe.exec(lines[i]);
    if (!match) { continue; }

    const file = match[1];
    const line = parseInt(match[2], 10);
    const column = parseInt(match[3], 10);
    const level = match[4];
    const message = match[5];
    const checkName = match[6];

    // Try to extract the snippet from the next line (if it's source code)
    let snippet: string | undefined;
    if (i + 1 < lines.length && !diagRe.test(lines[i + 1])) {
      const nextLine = lines[i + 1];
      // Skip caret lines (  ^~~~)
      if (nextLine.trim() && !/^\s*[~^]+\s*$/.test(nextLine)) {
        snippet = nextLine.trimEnd();
      }
    }

    findings.push({
      line,
      column,
      severity: mapClangTidySeverity(level),
      ruleId: checkName,
      message,
      suggestion: buildClangTidySuggestion(checkName),
      file,
      snippet,
      source: 'clang-tidy',
    });
  }

  return findings;
}

/**
 * Build a suggestion string from a Clang-Tidy check name.
 */
function buildClangTidySuggestion(checkName: string): string {
  // Common check name → suggestion mapping
  const suggestions: Record<string, string> = {
    'bugprone-use-after-move': 'Do not use object after std::move.',
    'bugprone-narrowing-conversions': 'Use explicit cast to avoid narrowing.',
    'bugprone-integer-division': 'Cast operand to floating-point before division.',
    'bugprone-sizeof-expression': 'Check sizeof expression for correctness.',
    'bugprone-string-constructor': 'Check string constructor arguments.',
    'bugprone-undefined-memory-manipulation': 'Use type-safe operations instead of memset/memcpy on non-trivial types.',
    'clang-analyzer-core.NullDereference': 'Add null check before dereference.',
    'clang-analyzer-core.DivideZero': 'Add zero-check before division.',
    'clang-analyzer-deadcode.DeadStores': 'Remove dead store or use the variable.',
    'clang-analyzer-unix.Malloc': 'Fix memory management issue.',
    'cppcoreguidelines-init-variables': 'Initialize variable at declaration.',
    'cppcoreguidelines-pro-type-cstyle-cast': 'Use C++ style cast (static_cast, etc.).',
    'cppcoreguidelines-avoid-magic-numbers': 'Define as named constant.',
    'modernize-use-nullptr': 'Use nullptr instead of NULL or 0.',
    'modernize-use-auto': 'Use auto for type deduction.',
    'modernize-loop-convert': 'Use range-based for loop.',
    'modernize-use-override': 'Add override specifier.',
    'performance-unnecessary-copy-initialization': 'Use const reference to avoid copy.',
    'performance-for-range-copy': 'Use const reference in range-based for.',
    'readability-identifier-naming': 'Follow naming conventions.',
    'readability-magic-numbers': 'Replace magic number with named constant.',
    'readability-redundant-string-cstr': 'Remove unnecessary .c_str() call.',
    'misc-unused-parameters': 'Remove unused parameter or mark with /*unused*/.',
  };

  // Try exact match first
  if (suggestions[checkName]) {
    return suggestions[checkName];
  }

  // Try prefix match
  const prefix = checkName.split('-').slice(0, 2).join('-');
  const prefixSuggestions: Record<string, string> = {
    'bugprone': 'Review for potential bugs.',
    'clang-analyzer': 'Review analyzer finding.',
    'cppcoreguidelines': 'Follow C++ Core Guidelines.',
    'modernize': 'Consider modernizing this code.',
    'performance': 'Consider performance improvement.',
    'readability': 'Improve code readability.',
    'misc': 'Review this code pattern.',
    'cert': 'Follow CERT coding standard.',
    'hicpp': 'Follow High Integrity C++ guidelines.',
  };

  return prefixSuggestions[prefix] ?? `Review: ${checkName}`;
}

// ─── Result Merging & Deduplication ──────────────────────────────

/**
 * Generate a dedup key for a finding.
 */
function findingKey(f: ServerFinding): string {
  return `${f.line}:${f.column}:${f.severity}:${f.message}`;
}

/**
 * Merge findings from multiple sources and deduplicate.
 * When two findings match on line+column+message, the higher-severity
 * one wins. When equal, prefer cppcheck > clang-tidy > local.
 */
export function mergeFindings(
  ...findingArrays: readonly ServerFinding[][]
): ServerFinding[] {
  const merged: Map<string, ServerFinding> = new Map();
  const severityPriority: Record<Severity, number> = {
    error: 0,
    warning: 1,
    performance: 2,
    portability: 3,
    style: 4,
  };
  const sourcePriority: Record<ToolSource, number> = {
    cppcheck: 0,
    'clang-tidy': 1,
    local: 2,
  };

  findingArrays.forEach((arr) => {
    arr.forEach((f) => {
      const key = findingKey(f);
      const existing = merged.get(key);
      if (!existing) {
        merged.set(key, f);
      } else {
        const existingSev = severityPriority[existing.severity] ?? 5;
        const newSev = severityPriority[f.severity] ?? 5;
        if (newSev < existingSev) {
          merged.set(key, f);
        } else if (newSev === existingSev) {
          const existingSrc = sourcePriority[existing.source] ?? 5;
          const newSrc = sourcePriority[f.source] ?? 5;
          if (newSrc < existingSrc) {
            merged.set(key, f);
          }
        }
      }
    });
  });

  // Sort by line, then severity
  return Array.from(merged.values()).sort((a, b) => {
    if (a.line !== b.line) { return a.line - b.line; }
    return (severityPriority[a.severity] ?? 5) - (severityPriority[b.severity] ?? 5);
  });
}

/**
 * Build a MergedResult from a list of findings.
 */
export function buildMergedResult(findings: readonly ServerFinding[]): MergedResult {
  const sources = new Set<ToolSource>();
  findings.forEach((f) => { sources.add(f.source); });

  return {
    findings,
    totalFindings: findings.length,
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    style: findings.filter((f) => f.severity === 'style').length,
    performance: findings.filter((f) => f.severity === 'performance').length,
    portability: findings.filter((f) => f.severity === 'portability').length,
    sources: Array.from(sources),
  };
}

// ─── CodeMirror Annotation Conversion ────────────────────────────

/**
 * Map our Severity to CodeMirror diagnostic severity.
 */
function toCmSeverity(sev: Severity): 'error' | 'warning' | 'info' {
  switch (sev) {
    case 'error': return 'error';
    case 'warning': return 'warning';
    case 'style': return 'info';
    case 'performance': return 'info';
    case 'portability': return 'warning';
    default: return 'warning';
  }
}

/**
 * Convert ServerFinding[] to CodeMirror 6 Diagnostic-compatible annotations.
 *
 * @param findings The findings to convert.
 * @param code The source code text (needed to compute byte offsets from line:col).
 */
export function toCodeMirrorAnnotations(
  findings: readonly ServerFinding[],
  code: string,
): CodeMirrorAnnotation[] {
  const lineStarts = computeLineStarts(code);

  return findings.map((f) => {
    const lineIdx = Math.max(0, Math.min(f.line - 1, lineStarts.length - 1));
    const from = lineStarts[lineIdx] + Math.max(0, f.column - 1);
    // Highlight to end of token or next 10 chars
    const lineEnd = lineIdx + 1 < lineStarts.length
      ? lineStarts[lineIdx + 1] - 1
      : code.length;
    const to = Math.min(from + 10, lineEnd, code.length);

    return {
      from,
      to: Math.max(from, to),
      severity: toCmSeverity(f.severity),
      message: `[${f.source}] ${f.message}`,
      source: f.source,
      ruleId: f.ruleId,
    };
  });
}

/**
 * Compute line start offsets for a string.
 */
function computeLineStarts(code: string): number[] {
  const starts = [0];
  for (let i = 0; i < code.length; i++) {
    if (code[i] === '\n') {
      starts.push(i + 1);
    }
  }
  return starts;
}

// ─── XML Utilities ───────────────────────────────────────────────

function extractAttr(attrs: string, name: string): string | undefined {
  const re = new RegExp(`${name}="([^"]*)"`, 'i');
  const match = re.exec(attrs);
  return match ? match[1] : undefined;
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// ─── Local Analysis Adapter ─────────────────────────────────────

/**
 * Run the local (regex-based) static analysis and convert results
 * to ServerFinding[] format for merging.
 */
export function runLocalAnalysis(code: string, config?: AnalysisConfig): ServerFinding[] {
  const result: AnalysisResult = analyzeCode(code, config);
  return result.findings.map((f: AnalysisFinding) => ({
    line: f.line,
    column: f.column,
    severity: f.severity,
    ruleId: f.ruleId,
    message: f.message,
    suggestion: f.suggestion,
    cweId: f.cweId,
    snippet: f.snippet,
    source: 'local' as ToolSource,
  }));
}

// ─── ServerStaticAnalysisManager ─────────────────────────────────

export class ServerStaticAnalysisManager {
  // Singleton
  private static _instance: ServerStaticAnalysisManager | null = null;

  static getInstance(): ServerStaticAnalysisManager {
    if (!ServerStaticAnalysisManager._instance) {
      ServerStaticAnalysisManager._instance = new ServerStaticAnalysisManager();
    }
    return ServerStaticAnalysisManager._instance;
  }

  static resetInstance(): void {
    ServerStaticAnalysisManager._instance = null;
  }

  // State
  private _isAnalyzing = false;
  private _lastResult: MergedResult | null = null;
  private _lastAnnotations: CodeMirrorAnnotation[] = [];
  private _availableTools: Set<ToolSource> = new Set(['local']);
  private _error: string | null = null;
  private _listeners: Set<Listener> = new Set();

  // ─── Subscribe ────────────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _notify(): void {
    this._listeners.forEach((fn) => { fn(); });
  }

  // ─── Tool Availability ────────────────────────────────────────

  registerTool(tool: ToolSource): void {
    this._availableTools.add(tool);
    this._notify();
  }

  unregisterTool(tool: ToolSource): void {
    if (tool === 'local') { return; } // Local is always available
    this._availableTools.delete(tool);
    this._notify();
  }

  getAvailableTools(): ToolSource[] {
    return Array.from(this._availableTools);
  }

  isToolAvailable(tool: ToolSource): boolean {
    return this._availableTools.has(tool);
  }

  // ─── Analysis ─────────────────────────────────────────────────

  /**
   * Run analysis using all available tools.
   *
   * @param code Source code to analyze.
   * @param cppcheckXml Optional Cppcheck XML output (if server ran it).
   * @param clangTidyOutput Optional Clang-Tidy text output (if server ran it).
   * @param config Optional config for the local analysis engine.
   */
  analyze(
    code: string,
    cppcheckXml?: string,
    clangTidyOutput?: string,
    config?: AnalysisConfig,
  ): MergedResult {
    this._isAnalyzing = true;
    this._error = null;
    this._notify();

    try {
      const allFindings: ServerFinding[][] = [];

      // Always run local analysis as baseline
      allFindings.push(runLocalAnalysis(code, config));

      // Parse server outputs if provided
      if (cppcheckXml) {
        try {
          const cppcheckFindings = parseCppcheckXml(cppcheckXml);
          allFindings.push(cppcheckFindings);
        } catch (e) {
          this._error = `Cppcheck parse error: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      if (clangTidyOutput) {
        try {
          const clangFindings = parseClangTidyOutput(clangTidyOutput);
          allFindings.push(clangFindings);
        } catch (e) {
          this._error = `Clang-Tidy parse error: ${e instanceof Error ? e.message : String(e)}`;
        }
      }

      const merged = mergeFindings(...allFindings);
      const result = buildMergedResult(merged);
      const annotations = toCodeMirrorAnnotations(merged, code);

      this._lastResult = result;
      this._lastAnnotations = annotations;
      this._isAnalyzing = false;
      this._notify();

      return result;
    } catch (e) {
      this._error = e instanceof Error ? e.message : String(e);
      this._isAnalyzing = false;
      this._notify();
      throw e;
    }
  }

  /**
   * Analyze using only the local engine (no server tools).
   */
  analyzeLocal(code: string, config?: AnalysisConfig): MergedResult {
    return this.analyze(code, undefined, undefined, config);
  }

  // ─── Results ──────────────────────────────────────────────────

  getLastResult(): MergedResult | null {
    return this._lastResult;
  }

  getAnnotations(): readonly CodeMirrorAnnotation[] {
    return this._lastAnnotations;
  }

  clearResults(): void {
    this._lastResult = null;
    this._lastAnnotations = [];
    this._error = null;
    this._notify();
  }

  // ─── State ────────────────────────────────────────────────────

  getSnapshot(): ServerAnalysisState {
    return {
      isAnalyzing: this._isAnalyzing,
      lastResult: this._lastResult,
      lastAnnotations: this._lastAnnotations,
      availableTools: Array.from(this._availableTools),
      error: this._error,
    };
  }

  isAnalyzing(): boolean {
    return this._isAnalyzing;
  }

  getError(): string | null {
    return this._error;
  }
}
