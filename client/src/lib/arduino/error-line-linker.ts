/**
 * ErrorLineLinkManager — Maps compile diagnostics to code editor positions.
 *
 * Stores parsed build diagnostics (errors, warnings, notes) and provides
 * file-filtered access, gutter mark aggregation, navigation events, and
 * line-set helpers for editor highlighting.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;
type NavigateCallback = (link: ErrorLineLink) => void;

export interface ErrorLineLink {
  file: string;
  line: number;
  column: number;
  severity: 'error' | 'warning' | 'note';
  message: string;
  hint?: string;
}

export interface GutterMark {
  line: number;
  severity: 'error' | 'warning' | 'note';
  count: number;
  messages: string[];
}

export interface DiagnosticSummary {
  files: number;
  errors: number;
  warnings: number;
  notes: number;
}

// ---------------------------------------------------------------------------
// Severity ordering — error > warning > note
// ---------------------------------------------------------------------------

const SEVERITY_RANK: Record<ErrorLineLink['severity'], number> = {
  error: 0,
  warning: 1,
  note: 2,
};

function highestSeverity(
  a: ErrorLineLink['severity'],
  b: ErrorLineLink['severity'],
): ErrorLineLink['severity'] {
  return SEVERITY_RANK[a] <= SEVERITY_RANK[b] ? a : b;
}

// ---------------------------------------------------------------------------
// ErrorLineLinkManager
// ---------------------------------------------------------------------------

export class ErrorLineLinkManager {
  private diagnostics: ErrorLineLink[] = [];
  private listeners = new Set<Listener>();
  private navigateCallbacks = new Set<NavigateCallback>();
  private version = 0;

  private static instance: ErrorLineLinkManager | null = null;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  static getInstance(): ErrorLineLinkManager {
    if (!ErrorLineLinkManager.instance) {
      ErrorLineLinkManager.instance = new ErrorLineLinkManager();
    }
    return ErrorLineLinkManager.instance;
  }

  /** Reset singleton — primarily for testing. */
  static resetInstance(): void {
    if (ErrorLineLinkManager.instance) {
      ErrorLineLinkManager.instance.destroy();
    }
    ErrorLineLinkManager.instance = null;
  }

  /**
   * Create a standalone instance (for testing).
   * Does NOT replace the singleton.
   */
  static createInstance(): ErrorLineLinkManager {
    return new ErrorLineLinkManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): number => {
    return this.version;
  };

  private notify(): void {
    this.version += 1;
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Navigation events
  // -----------------------------------------------------------------------

  /**
   * Subscribe to navigation events (e.g. clicking an error to jump to line).
   * Returns an unsubscribe function.
   */
  onNavigate(callback: NavigateCallback): () => void {
    this.navigateCallbacks.add(callback);
    return () => {
      this.navigateCallbacks.delete(callback);
    };
  }

  /** Emit a navigation event for the given error link. */
  navigateToError(link: ErrorLineLink): void {
    Array.from(this.navigateCallbacks).forEach((cb) => {
      cb(link);
    });
  }

  // -----------------------------------------------------------------------
  // Core API
  // -----------------------------------------------------------------------

  /** Replace all diagnostics with a new build's results. */
  setDiagnostics(diagnostics: ErrorLineLink[]): void {
    this.diagnostics = [...diagnostics];
    this.notify();
  }

  /** Clear all diagnostics. */
  clearDiagnostics(): void {
    if (this.diagnostics.length === 0) {
      return;
    }
    this.diagnostics = [];
    this.notify();
  }

  /** Get all diagnostics for a specific file, sorted by line then column. */
  getDiagnosticsForFile(file: string): ErrorLineLink[] {
    return this.diagnostics
      .filter((d) => d.file === file)
      .sort((a, b) => {
        if (a.line !== b.line) {
          return a.line - b.line;
        }
        return a.column - b.column;
      });
  }

  /** Get all stored diagnostics (unfiltered). */
  getAllDiagnostics(): ErrorLineLink[] {
    return [...this.diagnostics];
  }

  /**
   * Aggregate diagnostics into gutter marks for a file.
   * Multiple diagnostics on the same line produce a single mark
   * with combined messages and the highest severity.
   */
  getGutterMarks(file: string): GutterMark[] {
    const fileDiags = this.getDiagnosticsForFile(file);
    const lineMap = new Map<number, { severity: ErrorLineLink['severity']; messages: string[] }>();

    for (const d of fileDiags) {
      const existing = lineMap.get(d.line);
      if (existing) {
        existing.severity = highestSeverity(existing.severity, d.severity);
        existing.messages.push(d.message);
      } else {
        lineMap.set(d.line, { severity: d.severity, messages: [d.message] });
      }
    }

    const marks: GutterMark[] = [];
    for (const [line, entry] of Array.from(lineMap.entries())) {
      marks.push({
        line,
        severity: entry.severity,
        count: entry.messages.length,
        messages: entry.messages,
      });
    }

    return marks.sort((a, b) => a.line - b.line);
  }

  /** Return the first error diagnostic (by file then line), or null if none. */
  getFirstError(): ErrorLineLink | null {
    const errors = this.diagnostics
      .filter((d) => d.severity === 'error')
      .sort((a, b) => {
        if (a.file !== b.file) {
          return a.file.localeCompare(b.file);
        }
        if (a.line !== b.line) {
          return a.line - b.line;
        }
        return a.column - b.column;
      });
    return errors.length > 0 ? errors[0] : null;
  }

  /**
   * Resolve a relative include path against a sketch directory.
   * Handles both forward-slash and backslash separators.
   * Collapses `..` and `.` segments.
   */
  resolveFilePath(relativePath: string, sketchDir: string): string {
    // Normalize to forward slashes
    const normalizedRelative = relativePath.replace(/\\/g, '/');
    const normalizedDir = sketchDir.replace(/\\/g, '/').replace(/\/+$/, '');

    // If already absolute, just normalize
    if (normalizedRelative.startsWith('/')) {
      return this.normalizePath(normalizedRelative);
    }

    const combined = `${normalizedDir}/${normalizedRelative}`;
    return this.normalizePath(combined);
  }

  /** Set of line numbers that have errors for a given file. */
  getErrorLines(file: string): Set<number> {
    const lines = new Set<number>();
    for (const d of this.diagnostics) {
      if (d.file === file && d.severity === 'error') {
        lines.add(d.line);
      }
    }
    return lines;
  }

  /** Set of line numbers that have warnings for a given file. */
  getWarningLines(file: string): Set<number> {
    const lines = new Set<number>();
    for (const d of this.diagnostics) {
      if (d.file === file && d.severity === 'warning') {
        lines.add(d.line);
      }
    }
    return lines;
  }

  /** Aggregate summary across all files. */
  getSummary(): DiagnosticSummary {
    const fileSet = new Set<string>();
    let errors = 0;
    let warnings = 0;
    let notes = 0;

    for (const d of this.diagnostics) {
      fileSet.add(d.file);
      switch (d.severity) {
        case 'error':
          errors++;
          break;
        case 'warning':
          warnings++;
          break;
        case 'note':
          notes++;
          break;
      }
    }

    return { files: fileSet.size, errors, warnings, notes };
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy(): void {
    this.diagnostics = [];
    this.listeners.clear();
    this.navigateCallbacks.clear();
    this.version = 0;
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Collapse `.` and `..` segments in a forward-slash path. */
  private normalizePath(path: string): string {
    const parts = path.split('/');
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '' || part === '.') {
        // Skip empty segments (from leading / or double /) and current-dir refs
        if (resolved.length === 0 && path.startsWith('/')) {
          resolved.push('');
        }
        continue;
      }
      if (part === '..') {
        // Don't pop past root
        if (resolved.length > 1 || (resolved.length === 1 && resolved[0] !== '')) {
          resolved.pop();
        }
        continue;
      }
      resolved.push(part);
    }

    const result = resolved.join('/');
    // Preserve leading slash for absolute paths
    if (path.startsWith('/') && !result.startsWith('/')) {
      return `/${result}`;
    }
    return result || '/';
  }
}
