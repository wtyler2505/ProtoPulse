// ---------------------------------------------------------------------------
// ESP Exception Decoder
// ---------------------------------------------------------------------------
// Parses ESP32/ESP8266 crash stack traces from serial output.
// Currently returns raw hex addresses — full addr2line decoding will be
// available once we ship the native desktop build (xtensa-esp32-elf-addr2line
// can be invoked directly via the local toolchain).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StackFrame {
  /** Hex address, e.g. "0x400d1234" */
  address: string;
  /** Resolved function name (populated by addr2line — future native desktop) */
  function?: string;
  /** Resolved source file (populated by addr2line — future native desktop) */
  file?: string;
  /** Resolved source line (populated by addr2line — future native desktop) */
  line?: number;
  /** The raw token as it appeared in serial output */
  raw: string;
}

export interface EspExceptionResult {
  /** Whether we successfully identified and parsed a crash */
  decoded: boolean;
  /** High-level crash reason, e.g. "LoadProhibited" */
  crashType: string;
  /** Human-readable explanation of the crash type */
  description: string;
  /** Parsed backtrace frames */
  stackFrames: StackFrame[];
  /** Register dump, if present (register name -> hex value) */
  registers?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Crash type explanations
// ---------------------------------------------------------------------------

const CRASH_EXPLANATIONS: Record<string, string> = {
  LoadProhibited: 'Null pointer or invalid memory access (read)',
  StoreProhibited: 'Null pointer or invalid memory access (write)',
  IntegerDivideByZero: 'Division by zero in your code',
  InstrFetchProhibited: 'Trying to execute code from invalid memory',
  'Unhandled debug exception': 'Breakpoint hit or watchpoint triggered',
  InstrFetchError: 'Failed to fetch instruction from memory',
  LoadStoreError: 'Load/store alignment error or bus fault',
  Overflow: 'Stack overflow — function call depth too deep or large local arrays',
  IllegalInstruction: 'CPU encountered an invalid instruction',
  IllegalInstructionCause: 'CPU encountered an invalid instruction',
};

// Stack overflow is reported differently (not inside the panic reason parens)
const STACK_OVERFLOW_PATTERN = /stack\s*overflow/i;
const WDT_RESET_PATTERN = /wdt\s*reset|watchdog|wdt/i;

// ---------------------------------------------------------------------------
// Detection
// ---------------------------------------------------------------------------

const DETECTION_PATTERNS = [
  /Guru Meditation Error/i,
  /Backtrace:\s*0x/i,
  /rst:0x/,
  /panic'ed/i,
  /Stack smashing protect failure/i,
  /abort\(\) was called/i,
  STACK_OVERFLOW_PATTERN,
];

/**
 * Returns true if the serial output contains ESP crash indicators.
 */
export function detectEspException(output: string): boolean {
  return DETECTION_PATTERNS.some((pat) => pat.test(output));
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse "Guru Meditation Error: Core  0 panic'ed (LoadProhibited). ..."
 */
function parseCrashType(output: string): { crashType: string; description: string } {
  // Guru Meditation with reason in parentheses
  const guruMatch = /Guru Meditation Error.*?panic'ed\s*\(([^)]+)\)/i.exec(output);
  if (guruMatch) {
    const reason = guruMatch[1].trim();
    const description =
      CRASH_EXPLANATIONS[reason] ?? `ESP crash: ${reason}`;
    return { crashType: reason, description };
  }

  // abort() was called
  if (/abort\(\)\s*was called/i.test(output)) {
    return { crashType: 'abort()', description: 'Program called abort() — likely an assertion failure' };
  }

  // Stack smashing
  if (/Stack smashing protect failure/i.test(output)) {
    return {
      crashType: 'Stack smashing',
      description: 'Buffer overflow detected — a local variable overflowed its stack frame',
    };
  }

  // Stack overflow (standalone message)
  if (STACK_OVERFLOW_PATTERN.test(output)) {
    return {
      crashType: 'Stack overflow',
      description: 'Function call depth too deep or large local arrays',
    };
  }

  // WDT reset
  if (WDT_RESET_PATTERN.test(output)) {
    return {
      crashType: 'WDT reset',
      description: 'Code blocked too long without yielding — watchdog timer fired',
    };
  }

  // rst:0x codes (ESP8266 reset reason codes)
  const rstMatch = /rst:0x([0-9a-fA-F]+)/i.exec(output);
  if (rstMatch) {
    return {
      crashType: `Reset 0x${rstMatch[1]}`,
      description: `Hardware reset with reason code 0x${rstMatch[1]}`,
    };
  }

  return { crashType: 'Unknown', description: 'ESP crash detected but reason could not be determined' };
}

/**
 * Parse the Backtrace line into StackFrame[].
 *
 * Format: "Backtrace: 0x400d1234:0x3ffb1234 0x400d5678:0x3ffb5678"
 * Each pair is PC:SP (program counter : stack pointer).
 */
function parseBacktrace(output: string): StackFrame[] {
  const btMatch = /Backtrace:\s*((?:0x[0-9a-fA-F]+(?::0x[0-9a-fA-F]+)?\s*)+)/i.exec(output);
  if (!btMatch) {
    return [];
  }

  const raw = btMatch[1].trim();
  const tokens = raw.split(/\s+/);
  const frames: StackFrame[] = [];

  for (const token of tokens) {
    // Each token is "0xPC:0xSP" or just "0xPC"
    const parts = token.split(':');
    const address = parts[0];
    if (/^0x[0-9a-fA-F]+$/i.test(address)) {
      frames.push({ address, raw: token });
    }
  }

  return frames;
}

/**
 * Parse the register dump block.
 *
 * Typical format:
 *   PC      : 0x400d1234  PS      : 0x00060030  A0      : 0x800d5678  ...
 */
function parseRegisters(output: string): Record<string, string> | undefined {
  const regs: Record<string, string> = {};

  // Only look in lines that have at least 2 register-like pairs (to avoid false positives)
  const lines = output.split('\n');
  for (const line of lines) {
    const pairs: Array<{ name: string; value: string }> = [];
    const linePattern = /\b([A-Z][A-Z0-9_]{0,7})\s*:\s*(0x[0-9a-fA-F]+)\b/g;
    let lm: RegExpExecArray | null;
    while ((lm = linePattern.exec(line)) !== null) {
      pairs.push({ name: lm[1], value: lm[2] });
    }
    if (pairs.length >= 2) {
      for (const pair of pairs) {
        regs[pair.name] = pair.value;
      }
    }
  }

  return Object.keys(regs).length > 0 ? regs : undefined;
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse an ESP exception from serial output into a structured result.
 */
export function parseEspException(output: string): EspExceptionResult {
  if (!detectEspException(output)) {
    return {
      decoded: false,
      crashType: '',
      description: '',
      stackFrames: [],
    };
  }

  const { crashType, description } = parseCrashType(output);
  const stackFrames = parseBacktrace(output);
  const registers = parseRegisters(output);

  return {
    decoded: true,
    crashType,
    description,
    stackFrames,
    registers,
  };
}
