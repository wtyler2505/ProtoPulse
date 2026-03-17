/**
 * Pre-upload check engine for firmware upload workflows.
 *
 * Runs a structured battery of checks against the upload context (board,
 * port, sketch code, compile output) before the user commits to flashing
 * firmware onto a physical board.  Each check has a severity that controls
 * whether it blocks the upload, produces a warning, or is purely informational.
 *
 * Design:
 * - Pure functions, no side effects, no singletons
 * - Each check is a plain object with a `check` function
 * - `runPreUploadChecks` runs all enabled checks and aggregates results
 * - `shouldBlockUpload` is a convenience predicate for UI gating
 * - `BUILT_IN_CHECKS` ships 10 default checks; consumers can add custom ones
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Severity determines how the result is categorized. */
export type CheckSeverity = 'block' | 'warn' | 'info';

/** The result returned by a single check function. */
export interface CheckResult {
  /** Whether the check passed (true) or found an issue (false). */
  readonly passed: boolean;
  /** Human-readable description of the finding. */
  readonly message: string;
  /** Optional actionable suggestion shown to the user. */
  readonly suggestion?: string;
}

/** Context snapshot provided to every check function. */
export interface UploadContext {
  /** Selected target board FQBN or display name (e.g. "arduino:avr:uno"). */
  readonly board: string | null;
  /** Selected serial port path (e.g. "/dev/ttyUSB0", "COM3"). */
  readonly port?: string | null;
  /** Raw sketch source code (.ino / .cpp). */
  readonly sketchCode: string;
  /** Raw compiler output (stdout + stderr). Undefined if not yet compiled. */
  readonly compileOutput?: string | null;
  /** Flash size budget in bytes. 0 or undefined = unknown/skip. */
  readonly flashBudgetBytes?: number;
  /** RAM (SRAM) budget in bytes. 0 or undefined = unknown/skip. */
  readonly ramBudgetBytes?: number;
  /** Flash usage reported by compiler, in bytes. */
  readonly flashUsageBytes?: number;
  /** RAM usage reported by compiler, in bytes. */
  readonly ramUsageBytes?: number;
  /** List of library names included via `#include`. */
  readonly includedLibraries?: readonly string[];
}

/** A single pre-upload check definition. */
export interface PreUploadCheck {
  /** Stable unique identifier for this check. */
  readonly id: string;
  /** Short human-readable name shown in UI. */
  readonly name: string;
  /** Controls classification: block = stop upload, warn = caution, info = FYI. */
  readonly severity: CheckSeverity;
  /** Evaluates the check against the current upload context. */
  readonly check: (ctx: UploadContext) => CheckResult;
}

/** Aggregated result returned by `runPreUploadChecks`. */
export interface PreUploadResult {
  /** True when there are zero 'block'-severity failures. */
  readonly passed: boolean;
  /** Messages from failed checks with severity 'block'. */
  readonly blockers: readonly string[];
  /** Messages from failed checks with severity 'warn'. */
  readonly warnings: readonly string[];
  /** Messages from failed checks with severity 'info'. */
  readonly info: readonly string[];
  /** All individual check outcomes, in the order they were executed. */
  readonly details: readonly PreUploadCheckOutcome[];
}

/** Individual check outcome within the aggregated result. */
export interface PreUploadCheckOutcome {
  readonly checkId: string;
  readonly checkName: string;
  readonly severity: CheckSeverity;
  readonly passed: boolean;
  readonly message: string;
  readonly suggestion?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pass(message: string): CheckResult {
  return { passed: true, message };
}

function fail(message: string, suggestion?: string): CheckResult {
  return { passed: false, message, suggestion };
}

// ---------------------------------------------------------------------------
// Secret detection helpers
// ---------------------------------------------------------------------------

/**
 * Patterns that strongly suggest hardcoded secrets or credentials.
 * Each pattern is tested against individual non-comment lines of the sketch.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  // WiFi / network credentials
  /(?:password|passwd|pwd)\s*=\s*"[^"]{4,}"/i,
  /(?:ssid)\s*=\s*"[^"]{1,}"/i,
  // API keys / tokens
  /(?:api[_-]?key|apikey|secret[_-]?key|token|auth[_-]?token|bearer)\s*=\s*"[^"]{8,}"/i,
  // AWS-style keys
  /AKIA[0-9A-Z]{16}/,
  // Generic long hex/base64 secrets assigned to const/define
  /#define\s+\w*(?:KEY|SECRET|TOKEN|PASS)\w*\s+"[^"]{12,}"/i,
];

/**
 * Returns true if a line looks like a C/C++ comment.
 * Handles single-line `//` comments and very simple `/* ... *​/` on one line.
 */
function isCommentLine(line: string): boolean {
  const trimmed = line.trimStart();
  return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
}

function containsHardcodedSecrets(code: string): boolean {
  const lines = code.split('\n');
  for (const line of lines) {
    if (isCommentLine(line)) {
      continue;
    }
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(line)) {
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Known-bad library database
// ---------------------------------------------------------------------------

export interface KnownBadLibrary {
  readonly name: string;
  readonly reason: string;
  readonly alternative?: string;
}

const KNOWN_BAD_LIBRARIES: readonly KnownBadLibrary[] = [
  {
    name: 'SoftwareSerial',
    reason: 'Known to cause timing issues on ESP32; uses busy-wait loops that block interrupts.',
    alternative: 'HardwareSerial or ESP32 UART driver',
  },
  {
    name: 'Blynk',
    reason: 'Legacy Blynk library (pre-2.0) has memory leaks and is no longer maintained.',
    alternative: 'BlynkNcpDriver or direct MQTT',
  },
  {
    name: 'IRremote',
    reason: 'Versions prior to 3.0 conflict with tone() and other timer-dependent libraries.',
    alternative: 'IRremote >= 3.0 or IRremoteESP8266',
  },
  {
    name: 'NewPing',
    reason: 'Timer-based ISR conflicts with Servo library on AVR boards.',
    alternative: 'Use direct pulseIn() for HC-SR04, or NewPing with timer disabled',
  },
  {
    name: 'PubSubClient',
    reason: 'Default buffer size (256 bytes) silently truncates MQTT payloads.',
    alternative: 'Set MQTT_MAX_PACKET_SIZE or use AsyncMqttClient',
  },
];

// ---------------------------------------------------------------------------
// Board–sketch compatibility helpers
// ---------------------------------------------------------------------------

/** Patterns in sketch code that indicate AVR-only constructs. */
const AVR_ONLY_PATTERNS: readonly RegExp[] = [
  /\bPROGMEM\b/,
  /\bpgm_read_\w+\b/,
  /\bEEPROM\.(?:read|write|put|get)\b/,
];

/** Patterns that indicate ESP32/WiFi-specific constructs. */
const ESP_PATTERNS: readonly RegExp[] = [
  /\bWiFi\.\w+/,
  /\bESP\.\w+/,
  /\bBluetooth(?:Serial)?\.\w+/,
];

function isAvrBoard(board: string): boolean {
  const lower = board.toLowerCase();
  return lower.includes('avr') || lower.includes('uno') || lower.includes('mega') || lower.includes('nano');
}

function isEspBoard(board: string): boolean {
  const lower = board.toLowerCase();
  return lower.includes('esp32') || lower.includes('esp8266');
}

function codeMatchesAny(code: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((p) => p.test(code));
}

// ---------------------------------------------------------------------------
// Built-in checks
// ---------------------------------------------------------------------------

const boardSelectedCheck: PreUploadCheck = {
  id: 'board-selected',
  name: 'Board Selected',
  severity: 'block',
  check: (ctx) => {
    if (ctx.board && ctx.board.trim().length > 0) {
      return pass(`Board selected: ${ctx.board}.`);
    }
    return fail(
      'No target board selected.',
      'Select a board from the board picker before uploading.',
    );
  },
};

const portAvailableCheck: PreUploadCheck = {
  id: 'port-available',
  name: 'Port Available',
  severity: 'block',
  check: (ctx) => {
    if (ctx.port && ctx.port.trim().length > 0) {
      return pass(`Port available: ${ctx.port}.`);
    }
    return fail(
      'No serial port selected or available.',
      'Connect your board via USB and select a port.',
    );
  },
};

const compileSucceededCheck: PreUploadCheck = {
  id: 'compile-succeeded',
  name: 'Compilation Succeeded',
  severity: 'block',
  check: (ctx) => {
    if (ctx.compileOutput === undefined || ctx.compileOutput === null) {
      return fail(
        'Sketch has not been compiled yet.',
        'Compile the sketch before uploading.',
      );
    }
    const output = ctx.compileOutput.toLowerCase();
    if (output.includes('error:') || output.includes('fatal error')) {
      return fail(
        'Compilation failed with errors.',
        'Fix compiler errors before uploading.',
      );
    }
    return pass('Compilation succeeded.');
  },
};

const noSecretsCheck: PreUploadCheck = {
  id: 'no-secrets',
  name: 'No Hardcoded Secrets',
  severity: 'warn',
  check: (ctx) => {
    if (!ctx.sketchCode || ctx.sketchCode.trim().length === 0) {
      return pass('No sketch code to scan.');
    }
    if (containsHardcodedSecrets(ctx.sketchCode)) {
      return fail(
        'Sketch may contain hardcoded secrets (passwords, API keys, tokens).',
        'Move secrets to a separate credentials header or use environment-based configuration.',
      );
    }
    return pass('No hardcoded secrets detected.');
  },
};

const flashWithinBudgetCheck: PreUploadCheck = {
  id: 'flash-within-budget',
  name: 'Flash Within Budget',
  severity: 'block',
  check: (ctx) => {
    if (!ctx.flashBudgetBytes || !ctx.flashUsageBytes) {
      return pass('Flash usage data not available — skipping check.');
    }
    const pct = Math.round((ctx.flashUsageBytes / ctx.flashBudgetBytes) * 100);
    if (ctx.flashUsageBytes > ctx.flashBudgetBytes) {
      return fail(
        `Flash usage (${ctx.flashUsageBytes} bytes) exceeds budget (${ctx.flashBudgetBytes} bytes, ${pct}%).`,
        'Reduce code size: remove unused libraries, use PROGMEM for large constants, or choose a board with more flash.',
      );
    }
    if (pct >= 90) {
      return {
        passed: true,
        message: `Flash usage is at ${pct}% (${ctx.flashUsageBytes} / ${ctx.flashBudgetBytes} bytes).`,
        suggestion: 'Consider optimizing — very little flash headroom remaining.',
      };
    }
    return pass(`Flash usage: ${pct}% (${ctx.flashUsageBytes} / ${ctx.flashBudgetBytes} bytes).`);
  },
};

const ramWithinBudgetCheck: PreUploadCheck = {
  id: 'ram-within-budget',
  name: 'RAM Within Budget',
  severity: 'block',
  check: (ctx) => {
    if (!ctx.ramBudgetBytes || !ctx.ramUsageBytes) {
      return pass('RAM usage data not available — skipping check.');
    }
    const pct = Math.round((ctx.ramUsageBytes / ctx.ramBudgetBytes) * 100);
    if (ctx.ramUsageBytes > ctx.ramBudgetBytes) {
      return fail(
        `RAM usage (${ctx.ramUsageBytes} bytes) exceeds budget (${ctx.ramBudgetBytes} bytes, ${pct}%).`,
        'Reduce RAM: use F() macro for strings, reduce buffer sizes, avoid large global arrays.',
      );
    }
    if (pct >= 80) {
      return {
        passed: true,
        message: `RAM usage is at ${pct}% (${ctx.ramUsageBytes} / ${ctx.ramBudgetBytes} bytes).`,
        suggestion: 'Caution — runtime stack and heap allocations may exceed remaining RAM.',
      };
    }
    return pass(`RAM usage: ${pct}% (${ctx.ramUsageBytes} / ${ctx.ramBudgetBytes} bytes).`);
  },
};

const noKnownBadLibrariesCheck: PreUploadCheck = {
  id: 'no-known-bad-libraries',
  name: 'No Known-Bad Libraries',
  severity: 'warn',
  check: (ctx) => {
    if (!ctx.includedLibraries || ctx.includedLibraries.length === 0) {
      return pass('No included libraries to check.');
    }
    const found: KnownBadLibrary[] = [];
    for (const lib of ctx.includedLibraries) {
      const bad = KNOWN_BAD_LIBRARIES.find(
        (b) => b.name.toLowerCase() === lib.toLowerCase(),
      );
      if (bad) {
        found.push(bad);
      }
    }
    if (found.length === 0) {
      return pass('No known-bad libraries detected.');
    }
    const messages = found.map(
      (b) => `${b.name}: ${b.reason}${b.alternative ? ` Consider: ${b.alternative}.` : ''}`,
    );
    return fail(
      `Found ${found.length} known-bad librar${found.length === 1 ? 'y' : 'ies'}: ${found.map((b) => b.name).join(', ')}.`,
      messages.join(' | '),
    );
  },
};

const boardSketchCompatibilityCheck: PreUploadCheck = {
  id: 'board-sketch-compatibility',
  name: 'Board–Sketch Compatibility',
  severity: 'warn',
  check: (ctx) => {
    if (!ctx.board || !ctx.sketchCode) {
      return pass('Insufficient data for compatibility check.');
    }
    const issues: string[] = [];
    // ESP code on AVR board
    if (isAvrBoard(ctx.board) && codeMatchesAny(ctx.sketchCode, ESP_PATTERNS)) {
      issues.push('Sketch uses ESP32/WiFi APIs but the selected board is AVR-based.');
    }
    // AVR-only code on ESP board
    if (isEspBoard(ctx.board) && codeMatchesAny(ctx.sketchCode, AVR_ONLY_PATTERNS)) {
      issues.push('Sketch uses AVR-only constructs (PROGMEM, pgm_read, EEPROM) which may not compile on ESP boards.');
    }
    if (issues.length === 0) {
      return pass('Board and sketch appear compatible.');
    }
    return fail(
      issues.join(' '),
      'Verify your board selection matches the libraries and APIs used in the sketch.',
    );
  },
};

const sketchNotEmptyCheck: PreUploadCheck = {
  id: 'sketch-not-empty',
  name: 'Sketch Not Empty',
  severity: 'block',
  check: (ctx) => {
    if (!ctx.sketchCode || ctx.sketchCode.trim().length === 0) {
      return fail(
        'Sketch is empty.',
        'Write some code or load an example sketch before uploading.',
      );
    }
    return pass('Sketch has content.');
  },
};

const compileWarningsCheck: PreUploadCheck = {
  id: 'compile-warnings',
  name: 'Compile Warnings',
  severity: 'info',
  check: (ctx) => {
    if (!ctx.compileOutput) {
      return pass('No compile output to analyze.');
    }
    const output = ctx.compileOutput.toLowerCase();
    // Count warning lines (excluding "warnings generated" summary lines)
    const warningLines = ctx.compileOutput
      .split('\n')
      .filter((line) => {
        const lower = line.toLowerCase();
        return lower.includes('warning:') && !lower.includes('warnings generated');
      });
    if (warningLines.length === 0) {
      return pass('No compiler warnings.');
    }
    if (output.includes('-wunused-variable') || output.includes('unused variable')) {
      return fail(
        `${warningLines.length} compiler warning${warningLines.length === 1 ? '' : 's'} detected (includes unused variables).`,
        'Clean up unused variables to reduce code size and improve readability.',
      );
    }
    return fail(
      `${warningLines.length} compiler warning${warningLines.length === 1 ? '' : 's'} detected.`,
      'Review warnings — they may indicate potential runtime issues.',
    );
  },
};

const setupLoopPresentCheck: PreUploadCheck = {
  id: 'setup-loop-present',
  name: 'setup() and loop() Present',
  severity: 'info',
  check: (ctx) => {
    if (!ctx.sketchCode || ctx.sketchCode.trim().length === 0) {
      return pass('No sketch code to analyze.');
    }
    const hasSetup = /\bvoid\s+setup\s*\(/.test(ctx.sketchCode);
    const hasLoop = /\bvoid\s+loop\s*\(/.test(ctx.sketchCode);
    if (hasSetup && hasLoop) {
      return pass('Both setup() and loop() functions found.');
    }
    const missing: string[] = [];
    if (!hasSetup) {
      missing.push('setup()');
    }
    if (!hasLoop) {
      missing.push('loop()');
    }
    return fail(
      `Missing required function${missing.length > 1 ? 's' : ''}: ${missing.join(' and ')}.`,
      'Arduino sketches require both void setup() and void loop() functions.',
    );
  },
};

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/**
 * All built-in pre-upload checks, in recommended execution order.
 * Consumers can filter, reorder, or extend this array.
 */
export const BUILT_IN_CHECKS: readonly PreUploadCheck[] = [
  boardSelectedCheck,
  portAvailableCheck,
  sketchNotEmptyCheck,
  compileSucceededCheck,
  noSecretsCheck,
  flashWithinBudgetCheck,
  ramWithinBudgetCheck,
  noKnownBadLibrariesCheck,
  boardSketchCompatibilityCheck,
  compileWarningsCheck,
  setupLoopPresentCheck,
] as const;

/**
 * Run a set of pre-upload checks against the given context.
 *
 * @param ctx     - Current upload context snapshot
 * @param checks  - Checks to run (defaults to `BUILT_IN_CHECKS`)
 * @returns Aggregated result with blockers, warnings, and info messages
 */
export function runPreUploadChecks(
  ctx: UploadContext,
  checks: readonly PreUploadCheck[] = BUILT_IN_CHECKS,
): PreUploadResult {
  const details: PreUploadCheckOutcome[] = [];
  const blockers: string[] = [];
  const warnings: string[] = [];
  const info: string[] = [];

  for (const chk of checks) {
    const result = chk.check(ctx);
    details.push({
      checkId: chk.id,
      checkName: chk.name,
      severity: chk.severity,
      passed: result.passed,
      message: result.message,
      suggestion: result.suggestion,
    });

    if (!result.passed) {
      switch (chk.severity) {
        case 'block':
          blockers.push(result.message);
          break;
        case 'warn':
          warnings.push(result.message);
          break;
        case 'info':
          info.push(result.message);
          break;
      }
    }
  }

  return {
    passed: blockers.length === 0,
    blockers,
    warnings,
    info,
    details,
  };
}

/**
 * Convenience predicate: returns true when the result contains any blockers.
 * Intended for gating the "Upload" button in the UI.
 */
export function shouldBlockUpload(result: PreUploadResult): boolean {
  return !result.passed;
}

/** Exported for testing / documentation purposes. */
export { KNOWN_BAD_LIBRARIES };
