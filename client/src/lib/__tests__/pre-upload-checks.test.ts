import { describe, it, expect } from 'vitest';
import {
  runPreUploadChecks,
  shouldBlockUpload,
  BUILT_IN_CHECKS,
  KNOWN_BAD_LIBRARIES,
} from '../pre-upload-checks';
import type {
  UploadContext,
  PreUploadResult,
  PreUploadCheck,
  CheckResult,
  PreUploadCheckOutcome,
} from '../pre-upload-checks';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCtx(overrides: Partial<UploadContext> = {}): UploadContext {
  return {
    board: 'arduino:avr:uno',
    port: '/dev/ttyUSB0',
    sketchCode: 'void setup() {} void loop() {}',
    compileOutput: 'Sketch uses 1234 bytes. Done compiling.',
    flashBudgetBytes: 32256,
    flashUsageBytes: 1234,
    ramBudgetBytes: 2048,
    ramUsageBytes: 200,
    includedLibraries: [],
    ...overrides,
  };
}

function findOutcome(result: PreUploadResult, checkId: string): PreUploadCheckOutcome | undefined {
  return result.details.find((d) => d.checkId === checkId);
}

// ---------------------------------------------------------------------------
// BUILT_IN_CHECKS registry
// ---------------------------------------------------------------------------

describe('BUILT_IN_CHECKS', () => {
  it('ships at least 8 built-in checks', () => {
    expect(BUILT_IN_CHECKS.length).toBeGreaterThanOrEqual(8);
  });

  it('all checks have unique ids', () => {
    const ids = BUILT_IN_CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every check has a non-empty name and valid severity', () => {
    for (const chk of BUILT_IN_CHECKS) {
      expect(chk.name.trim().length).toBeGreaterThan(0);
      expect(['block', 'warn', 'info']).toContain(chk.severity);
    }
  });

  it('contains the 11 expected checks', () => {
    const ids = BUILT_IN_CHECKS.map((c) => c.id);
    expect(ids).toContain('board-selected');
    expect(ids).toContain('port-available');
    expect(ids).toContain('sketch-not-empty');
    expect(ids).toContain('compile-succeeded');
    expect(ids).toContain('no-secrets');
    expect(ids).toContain('flash-within-budget');
    expect(ids).toContain('ram-within-budget');
    expect(ids).toContain('no-known-bad-libraries');
    expect(ids).toContain('board-sketch-compatibility');
    expect(ids).toContain('compile-warnings');
    expect(ids).toContain('setup-loop-present');
  });
});

// ---------------------------------------------------------------------------
// runPreUploadChecks — happy path
// ---------------------------------------------------------------------------

describe('runPreUploadChecks — happy path', () => {
  it('passes when all data is valid', () => {
    const result = runPreUploadChecks(makeCtx());
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('returns details for every built-in check', () => {
    const result = runPreUploadChecks(makeCtx());
    expect(result.details).toHaveLength(BUILT_IN_CHECKS.length);
  });

  it('shouldBlockUpload returns false for passing result', () => {
    const result = runPreUploadChecks(makeCtx());
    expect(shouldBlockUpload(result)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Board Selected check
// ---------------------------------------------------------------------------

describe('board-selected', () => {
  it('passes when board is set', () => {
    const result = runPreUploadChecks(makeCtx({ board: 'arduino:avr:mega' }));
    const outcome = findOutcome(result, 'board-selected');
    expect(outcome?.passed).toBe(true);
    expect(outcome?.message).toContain('arduino:avr:mega');
  });

  it('blocks when board is null', () => {
    const result = runPreUploadChecks(makeCtx({ board: null }));
    expect(result.passed).toBe(false);
    expect(findOutcome(result, 'board-selected')?.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes('No target board'))).toBe(true);
  });

  it('blocks when board is empty string', () => {
    const result = runPreUploadChecks(makeCtx({ board: '' }));
    expect(findOutcome(result, 'board-selected')?.passed).toBe(false);
  });

  it('blocks when board is whitespace-only', () => {
    const result = runPreUploadChecks(makeCtx({ board: '   ' }));
    expect(findOutcome(result, 'board-selected')?.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Port Available check
// ---------------------------------------------------------------------------

describe('port-available', () => {
  it('passes when port is set', () => {
    const result = runPreUploadChecks(makeCtx({ port: 'COM3' }));
    expect(findOutcome(result, 'port-available')?.passed).toBe(true);
  });

  it('blocks when port is null', () => {
    const result = runPreUploadChecks(makeCtx({ port: null }));
    expect(result.passed).toBe(false);
    expect(findOutcome(result, 'port-available')?.passed).toBe(false);
  });

  it('blocks when port is undefined', () => {
    const result = runPreUploadChecks(makeCtx({ port: undefined }));
    expect(findOutcome(result, 'port-available')?.passed).toBe(false);
  });

  it('blocks when port is empty string', () => {
    const result = runPreUploadChecks(makeCtx({ port: '' }));
    expect(findOutcome(result, 'port-available')?.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Sketch Not Empty check
// ---------------------------------------------------------------------------

describe('sketch-not-empty', () => {
  it('passes when sketch has content', () => {
    const result = runPreUploadChecks(makeCtx());
    expect(findOutcome(result, 'sketch-not-empty')?.passed).toBe(true);
  });

  it('blocks when sketch is empty', () => {
    const result = runPreUploadChecks(makeCtx({ sketchCode: '' }));
    expect(findOutcome(result, 'sketch-not-empty')?.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('blocks when sketch is whitespace-only', () => {
    const result = runPreUploadChecks(makeCtx({ sketchCode: '   \n\t  ' }));
    expect(findOutcome(result, 'sketch-not-empty')?.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Compile Succeeded check
// ---------------------------------------------------------------------------

describe('compile-succeeded', () => {
  it('passes when compile output has no errors', () => {
    const result = runPreUploadChecks(makeCtx({ compileOutput: 'Compiling sketch... Done.' }));
    expect(findOutcome(result, 'compile-succeeded')?.passed).toBe(true);
  });

  it('blocks when compile output is null (not compiled)', () => {
    const result = runPreUploadChecks(makeCtx({ compileOutput: null }));
    expect(findOutcome(result, 'compile-succeeded')?.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes('not been compiled'))).toBe(true);
  });

  it('blocks when compile output is undefined', () => {
    const result = runPreUploadChecks(makeCtx({ compileOutput: undefined }));
    expect(findOutcome(result, 'compile-succeeded')?.passed).toBe(false);
  });

  it('blocks when compile output contains error:', () => {
    const result = runPreUploadChecks(makeCtx({
      compileOutput: "sketch.ino:10:5: error: 'foo' was not declared in this scope",
    }));
    expect(findOutcome(result, 'compile-succeeded')?.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes('Compilation failed'))).toBe(true);
  });

  it('blocks when compile output contains fatal error', () => {
    const result = runPreUploadChecks(makeCtx({
      compileOutput: 'fatal error: board not found',
    }));
    expect(findOutcome(result, 'compile-succeeded')?.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// No Secrets check
// ---------------------------------------------------------------------------

describe('no-secrets', () => {
  it('passes when no secrets detected', () => {
    const result = runPreUploadChecks(makeCtx({ sketchCode: 'void setup() {} void loop() {}' }));
    expect(findOutcome(result, 'no-secrets')?.passed).toBe(true);
  });

  it('warns when WiFi password is hardcoded', () => {
    const code = `
      const char* ssid = "MyNetwork";
      const char* password = "SuperSecret123";
      void setup() {} void loop() {}
    `;
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    expect(findOutcome(result, 'no-secrets')?.passed).toBe(false);
    expect(result.warnings.some((w) => w.includes('hardcoded secrets'))).toBe(true);
  });

  it('warns when API key is hardcoded', () => {
    const code = `
      const char* api_key = "sk-1234567890abcdef";
      void setup() {} void loop() {}
    `;
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    expect(findOutcome(result, 'no-secrets')?.passed).toBe(false);
  });

  it('warns when AWS-style key is found', () => {
    const code = `
      const char* awsKey = "AKIAIOSFODNN7EXAMPLE1";
      void setup() {} void loop() {}
    `;
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    expect(findOutcome(result, 'no-secrets')?.passed).toBe(false);
  });

  it('ignores secrets in comment lines', () => {
    const code = `
      // password = "NotAReal123"
      // ssid = "TestSSID"
      void setup() {} void loop() {}
    `;
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    expect(findOutcome(result, 'no-secrets')?.passed).toBe(true);
  });

  it('warns on #define with secret-like name and long value', () => {
    const code = `
      #define MQTT_SECRET_KEY "abcdefghijklmnop"
      void setup() {} void loop() {}
    `;
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    expect(findOutcome(result, 'no-secrets')?.passed).toBe(false);
  });

  it('does not block upload (severity is warn)', () => {
    const code = 'const char* password = "MyPassword1234"; void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    // Secrets check is warn, not block — passed should still be true
    // (assuming no other blockers)
    expect(result.passed).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it('passes for empty sketch code', () => {
    // sketch-not-empty will block, but no-secrets itself passes
    const check = BUILT_IN_CHECKS.find((c) => c.id === 'no-secrets');
    const checkResult = check?.check({ board: 'test', sketchCode: '', port: '/dev/test' });
    expect(checkResult?.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Flash Within Budget check
// ---------------------------------------------------------------------------

describe('flash-within-budget', () => {
  it('passes when flash is well within budget', () => {
    const result = runPreUploadChecks(makeCtx({ flashUsageBytes: 5000, flashBudgetBytes: 32256 }));
    expect(findOutcome(result, 'flash-within-budget')?.passed).toBe(true);
  });

  it('blocks when flash exceeds budget', () => {
    const result = runPreUploadChecks(makeCtx({ flashUsageBytes: 33000, flashBudgetBytes: 32256 }));
    expect(findOutcome(result, 'flash-within-budget')?.passed).toBe(false);
    expect(result.passed).toBe(false);
    expect(result.blockers.some((b) => b.includes('exceeds budget'))).toBe(true);
  });

  it('passes but suggests when flash is at 90%+', () => {
    const result = runPreUploadChecks(makeCtx({ flashUsageBytes: 30000, flashBudgetBytes: 32256 }));
    const outcome = findOutcome(result, 'flash-within-budget');
    expect(outcome?.passed).toBe(true);
    expect(outcome?.message).toContain('93%');
    expect(outcome?.suggestion).toBeDefined();
  });

  it('passes with skip message when no budget data', () => {
    const result = runPreUploadChecks(makeCtx({ flashBudgetBytes: 0, flashUsageBytes: 0 }));
    expect(findOutcome(result, 'flash-within-budget')?.passed).toBe(true);
    expect(findOutcome(result, 'flash-within-budget')?.message).toContain('not available');
  });

  it('passes when flashBudgetBytes is undefined', () => {
    const result = runPreUploadChecks(makeCtx({ flashBudgetBytes: undefined }));
    expect(findOutcome(result, 'flash-within-budget')?.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// RAM Within Budget check
// ---------------------------------------------------------------------------

describe('ram-within-budget', () => {
  it('passes when RAM is well within budget', () => {
    const result = runPreUploadChecks(makeCtx({ ramUsageBytes: 200, ramBudgetBytes: 2048 }));
    expect(findOutcome(result, 'ram-within-budget')?.passed).toBe(true);
  });

  it('blocks when RAM exceeds budget', () => {
    const result = runPreUploadChecks(makeCtx({ ramUsageBytes: 3000, ramBudgetBytes: 2048 }));
    expect(findOutcome(result, 'ram-within-budget')?.passed).toBe(false);
    expect(result.passed).toBe(false);
  });

  it('passes but warns when RAM is at 80%+', () => {
    const result = runPreUploadChecks(makeCtx({ ramUsageBytes: 1700, ramBudgetBytes: 2048 }));
    const outcome = findOutcome(result, 'ram-within-budget');
    expect(outcome?.passed).toBe(true);
    expect(outcome?.suggestion).toBeDefined();
    expect(outcome?.message).toContain('83%');
  });

  it('passes with skip message when no budget data', () => {
    const result = runPreUploadChecks(makeCtx({ ramBudgetBytes: undefined, ramUsageBytes: undefined }));
    expect(findOutcome(result, 'ram-within-budget')?.passed).toBe(true);
    expect(findOutcome(result, 'ram-within-budget')?.message).toContain('not available');
  });
});

// ---------------------------------------------------------------------------
// No Known-Bad Libraries check
// ---------------------------------------------------------------------------

describe('no-known-bad-libraries', () => {
  it('passes when no bad libraries are included', () => {
    const result = runPreUploadChecks(makeCtx({ includedLibraries: ['Servo', 'Wire'] }));
    expect(findOutcome(result, 'no-known-bad-libraries')?.passed).toBe(true);
  });

  it('warns when a known-bad library is included', () => {
    const result = runPreUploadChecks(makeCtx({ includedLibraries: ['SoftwareSerial'] }));
    const outcome = findOutcome(result, 'no-known-bad-libraries');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('SoftwareSerial');
    expect(result.warnings.some((w) => w.includes('known-bad'))).toBe(true);
  });

  it('detects multiple bad libraries', () => {
    const result = runPreUploadChecks(makeCtx({ includedLibraries: ['SoftwareSerial', 'Blynk', 'Servo'] }));
    const outcome = findOutcome(result, 'no-known-bad-libraries');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('2 known-bad libraries');
  });

  it('matches library names case-insensitively', () => {
    const result = runPreUploadChecks(makeCtx({ includedLibraries: ['softwareserial'] }));
    expect(findOutcome(result, 'no-known-bad-libraries')?.passed).toBe(false);
  });

  it('passes when includedLibraries is empty', () => {
    const result = runPreUploadChecks(makeCtx({ includedLibraries: [] }));
    expect(findOutcome(result, 'no-known-bad-libraries')?.passed).toBe(true);
  });

  it('passes when includedLibraries is undefined', () => {
    const result = runPreUploadChecks(makeCtx({ includedLibraries: undefined }));
    expect(findOutcome(result, 'no-known-bad-libraries')?.passed).toBe(true);
  });

  it('uses singular grammar for 1 bad library', () => {
    const result = runPreUploadChecks(makeCtx({ includedLibraries: ['IRremote'] }));
    const outcome = findOutcome(result, 'no-known-bad-libraries');
    expect(outcome?.message).toContain('1 known-bad library');
  });
});

// ---------------------------------------------------------------------------
// KNOWN_BAD_LIBRARIES data
// ---------------------------------------------------------------------------

describe('KNOWN_BAD_LIBRARIES', () => {
  it('has at least 5 entries', () => {
    expect(KNOWN_BAD_LIBRARIES.length).toBeGreaterThanOrEqual(5);
  });

  it('every entry has name and reason', () => {
    for (const lib of KNOWN_BAD_LIBRARIES) {
      expect(lib.name.length).toBeGreaterThan(0);
      expect(lib.reason.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Board–Sketch Compatibility check
// ---------------------------------------------------------------------------

describe('board-sketch-compatibility', () => {
  it('passes when board and sketch are compatible', () => {
    const result = runPreUploadChecks(makeCtx({
      board: 'arduino:avr:uno',
      sketchCode: 'void setup() { pinMode(13, OUTPUT); } void loop() {}',
    }));
    expect(findOutcome(result, 'board-sketch-compatibility')?.passed).toBe(true);
  });

  it('warns when ESP APIs used on AVR board', () => {
    const code = 'WiFi.begin("ssid", "pass"); void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ board: 'arduino:avr:uno', sketchCode: code }));
    const outcome = findOutcome(result, 'board-sketch-compatibility');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('ESP32/WiFi');
  });

  it('warns when AVR constructs used on ESP board', () => {
    const code = 'PROGMEM const char str[] = "hello"; void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ board: 'esp32:esp32:esp32', sketchCode: code }));
    const outcome = findOutcome(result, 'board-sketch-compatibility');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('AVR-only');
  });

  it('warns for EEPROM usage on ESP boards', () => {
    const code = 'int val = EEPROM.read(0); void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ board: 'esp8266:esp8266:nodemcu', sketchCode: code }));
    expect(findOutcome(result, 'board-sketch-compatibility')?.passed).toBe(false);
  });

  it('passes when ESP APIs used on ESP board', () => {
    const code = 'WiFi.begin("ssid", "pass"); void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ board: 'esp32:esp32:esp32', sketchCode: code }));
    expect(findOutcome(result, 'board-sketch-compatibility')?.passed).toBe(true);
  });

  it('passes when board or sketch is missing', () => {
    const result = runPreUploadChecks(makeCtx({ board: null }));
    expect(findOutcome(result, 'board-sketch-compatibility')?.passed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Compile Warnings check
// ---------------------------------------------------------------------------

describe('compile-warnings', () => {
  it('passes when no warnings in output', () => {
    const result = runPreUploadChecks(makeCtx({ compileOutput: 'Compiling... Done.' }));
    expect(findOutcome(result, 'compile-warnings')?.passed).toBe(true);
  });

  it('detects compiler warnings', () => {
    const output = 'sketch.ino:5: warning: unused variable\nCompiling... Done.';
    const result = runPreUploadChecks(makeCtx({ compileOutput: output }));
    const outcome = findOutcome(result, 'compile-warnings');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('1 compiler warning');
  });

  it('counts multiple warnings', () => {
    const output = [
      'sketch.ino:5: warning: unused variable',
      'sketch.ino:10: warning: implicit conversion',
      'sketch.ino:15: warning: comparison between signed and unsigned',
    ].join('\n');
    const result = runPreUploadChecks(makeCtx({ compileOutput: output }));
    const outcome = findOutcome(result, 'compile-warnings');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('3 compiler warnings');
  });

  it('does not count "warnings generated" summary line', () => {
    const output = 'sketch.ino:5: warning: something\n1 warnings generated.';
    const result = runPreUploadChecks(makeCtx({ compileOutput: output }));
    const outcome = findOutcome(result, 'compile-warnings');
    expect(outcome?.message).toContain('1 compiler warning');
  });

  it('passes when compile output is not available', () => {
    const result = runPreUploadChecks(makeCtx({ compileOutput: undefined }));
    expect(findOutcome(result, 'compile-warnings')?.passed).toBe(true);
  });

  it('severity is info (never blocks)', () => {
    const check = BUILT_IN_CHECKS.find((c) => c.id === 'compile-warnings');
    expect(check?.severity).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// setup() and loop() Present check
// ---------------------------------------------------------------------------

describe('setup-loop-present', () => {
  it('passes when both setup() and loop() are present', () => {
    const code = 'void setup() { } void loop() { }';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    expect(findOutcome(result, 'setup-loop-present')?.passed).toBe(true);
  });

  it('fails when setup() is missing', () => {
    const code = 'void loop() { }';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    const outcome = findOutcome(result, 'setup-loop-present');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('setup()');
  });

  it('fails when loop() is missing', () => {
    const code = 'void setup() { }';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    const outcome = findOutcome(result, 'setup-loop-present');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('loop()');
  });

  it('fails when both are missing', () => {
    const code = 'int main() { return 0; }';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    const outcome = findOutcome(result, 'setup-loop-present');
    expect(outcome?.passed).toBe(false);
    expect(outcome?.message).toContain('setup()');
    expect(outcome?.message).toContain('loop()');
  });

  it('handles multiline function signatures', () => {
    const code = 'void setup\n(\n) {\n}\nvoid loop\n(\n) {\n}';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    expect(findOutcome(result, 'setup-loop-present')?.passed).toBe(true);
  });

  it('severity is info', () => {
    const check = BUILT_IN_CHECKS.find((c) => c.id === 'setup-loop-present');
    expect(check?.severity).toBe('info');
  });
});

// ---------------------------------------------------------------------------
// shouldBlockUpload
// ---------------------------------------------------------------------------

describe('shouldBlockUpload', () => {
  it('returns false when result.passed is true', () => {
    const result = runPreUploadChecks(makeCtx());
    expect(shouldBlockUpload(result)).toBe(false);
  });

  it('returns true when any blocker exists', () => {
    const result = runPreUploadChecks(makeCtx({ board: null }));
    expect(shouldBlockUpload(result)).toBe(true);
  });

  it('returns false when only warnings exist (no blockers)', () => {
    const code = 'const char* password = "MySuperSecret"; void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    // password warning but no blocker
    expect(shouldBlockUpload(result)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// runPreUploadChecks — custom checks
// ---------------------------------------------------------------------------

describe('runPreUploadChecks — custom checks', () => {
  it('accepts custom check array', () => {
    const customCheck: PreUploadCheck = {
      id: 'custom-1',
      name: 'Custom Check',
      severity: 'block',
      check: () => ({ passed: false, message: 'Custom failure.' }),
    };
    const result = runPreUploadChecks(makeCtx(), [customCheck]);
    expect(result.passed).toBe(false);
    expect(result.blockers).toContain('Custom failure.');
    expect(result.details).toHaveLength(1);
  });

  it('runs empty check array producing passing result', () => {
    const result = runPreUploadChecks(makeCtx(), []);
    expect(result.passed).toBe(true);
    expect(result.blockers).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(result.info).toHaveLength(0);
    expect(result.details).toHaveLength(0);
  });

  it('preserves check execution order', () => {
    const checks: PreUploadCheck[] = [
      { id: 'a', name: 'A', severity: 'info', check: () => ({ passed: true, message: 'a' }) },
      { id: 'b', name: 'B', severity: 'info', check: () => ({ passed: true, message: 'b' }) },
      { id: 'c', name: 'C', severity: 'info', check: () => ({ passed: true, message: 'c' }) },
    ];
    const result = runPreUploadChecks(makeCtx(), checks);
    expect(result.details.map((d) => d.checkId)).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// PreUploadResult structure
// ---------------------------------------------------------------------------

describe('PreUploadResult structure', () => {
  it('blockers only contain messages from block-severity failed checks', () => {
    const result = runPreUploadChecks(makeCtx({ board: null, port: null }));
    // board-selected and port-available are both severity 'block'
    expect(result.blockers.length).toBeGreaterThanOrEqual(2);
    for (const blocker of result.blockers) {
      const detail = result.details.find((d) => d.message === blocker);
      expect(detail?.severity).toBe('block');
      expect(detail?.passed).toBe(false);
    }
  });

  it('warnings only contain messages from warn-severity failed checks', () => {
    const code = 'const char* password = "MySuperSecret"; void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    for (const warning of result.warnings) {
      const detail = result.details.find((d) => d.message === warning);
      expect(detail?.severity).toBe('warn');
      expect(detail?.passed).toBe(false);
    }
  });

  it('info only contains messages from info-severity failed checks', () => {
    const code = 'int main() { return 0; }';
    const output = 'sketch.ino:1: warning: something\nDone.';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code, compileOutput: output }));
    for (const infoMsg of result.info) {
      const detail = result.details.find((d) => d.message === infoMsg);
      expect(detail?.severity).toBe('info');
      expect(detail?.passed).toBe(false);
    }
  });

  it('suggestion is preserved in detail outcomes', () => {
    const result = runPreUploadChecks(makeCtx({ board: null }));
    const outcome = findOutcome(result, 'board-selected');
    expect(outcome?.suggestion).toBeDefined();
    expect(typeof outcome?.suggestion).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('multiple blockers accumulate', () => {
    const result = runPreUploadChecks(makeCtx({
      board: null,
      port: null,
      sketchCode: '',
      compileOutput: null,
    }));
    expect(result.passed).toBe(false);
    expect(result.blockers.length).toBeGreaterThanOrEqual(4);
  });

  it('flash at exactly 100% blocks', () => {
    const result = runPreUploadChecks(makeCtx({
      flashUsageBytes: 32257,
      flashBudgetBytes: 32256,
    }));
    expect(findOutcome(result, 'flash-within-budget')?.passed).toBe(false);
  });

  it('flash at exactly budget passes (boundary)', () => {
    const result = runPreUploadChecks(makeCtx({
      flashUsageBytes: 32256,
      flashBudgetBytes: 32256,
    }));
    // At exactly 100%, usage does not exceed budget
    const outcome = findOutcome(result, 'flash-within-budget');
    expect(outcome?.passed).toBe(true);
  });

  it('RAM at exactly budget passes (boundary)', () => {
    const result = runPreUploadChecks(makeCtx({
      ramUsageBytes: 2048,
      ramBudgetBytes: 2048,
    }));
    const outcome = findOutcome(result, 'ram-within-budget');
    expect(outcome?.passed).toBe(true);
    expect(outcome?.suggestion).toBeDefined();
  });

  it('handles sketch with only comments (no functions)', () => {
    const code = '// This is a comment\n/* Block comment */';
    const result = runPreUploadChecks(makeCtx({ sketchCode: code }));
    // setup-loop-present should detect missing functions
    expect(findOutcome(result, 'setup-loop-present')?.passed).toBe(false);
    // no-secrets should pass (only comments)
    expect(findOutcome(result, 'no-secrets')?.passed).toBe(true);
  });

  it('pgm_read_byte triggers AVR-only warning on ESP', () => {
    const code = 'uint8_t b = pgm_read_byte(&data); void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ board: 'esp32:esp32:esp32', sketchCode: code }));
    expect(findOutcome(result, 'board-sketch-compatibility')?.passed).toBe(false);
  });

  it('Bluetooth APIs trigger ESP warning on AVR', () => {
    const code = 'BluetoothSerial.begin("ESP32"); void setup() {} void loop() {}';
    const result = runPreUploadChecks(makeCtx({ board: 'arduino:avr:nano', sketchCode: code }));
    expect(findOutcome(result, 'board-sketch-compatibility')?.passed).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Type smoke tests
// ---------------------------------------------------------------------------

describe('type contracts', () => {
  it('CheckResult has required fields', () => {
    const r: CheckResult = { passed: true, message: 'ok' };
    expect(r.passed).toBe(true);
    expect(r.message).toBe('ok');
    expect(r.suggestion).toBeUndefined();
  });

  it('CheckResult with suggestion', () => {
    const r: CheckResult = { passed: false, message: 'bad', suggestion: 'fix it' };
    expect(r.suggestion).toBe('fix it');
  });

  it('PreUploadCheckOutcome captures all fields', () => {
    const result = runPreUploadChecks(makeCtx());
    const first = result.details[0];
    expect(typeof first.checkId).toBe('string');
    expect(typeof first.checkName).toBe('string');
    expect(['block', 'warn', 'info']).toContain(first.severity);
    expect(typeof first.passed).toBe('boolean');
    expect(typeof first.message).toBe('string');
  });
});
