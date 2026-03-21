// ──────────────────────────────────────────────────────────────────
// BL-0617 — Native Firmware Unit Testing Framework
// ──────────────────────────────────────────────────────────────────
// Generates Unity test framework C files, PlatformIO [env:native]
// config, parses Unity test output, suite CRUD, run history,
// assertion templates.
// ──────────────────────────────────────────────────────────────────

// ─── Types ───────────────────────────────────────────────────────

export type TestStatus = 'pass' | 'fail' | 'ignore' | 'error';

export interface TestAssertion {
  macro: string;
  description: string;
  args: string[];
  example: string;
  category: 'equality' | 'comparison' | 'boolean' | 'string' | 'memory' | 'float' | 'pointer';
}

export interface TestCase {
  id: string;
  name: string;
  body: string;
  group?: string;
  enabled: boolean;
}

export interface TestSuite {
  id: string;
  name: string;
  description: string;
  targetFile: string;
  cases: TestCase[];
  setupBody: string;
  teardownBody: string;
  includes: string[];
  createdAt: number;
  updatedAt: number;
}

export interface TestResult {
  testName: string;
  status: TestStatus;
  file?: string;
  line?: number;
  message?: string;
  duration?: number;
}

export interface TestRunSummary {
  id: string;
  suiteId: string;
  suiteName: string;
  timestamp: number;
  results: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  ignored: number;
  errors: number;
  durationMs: number;
  rawOutput: string;
}

export interface PlatformIONativeConfig {
  envName: string;
  platform: string;
  testFramework: string;
  buildFlags: string[];
  testFilter?: string;
}

// ─── Assertion Templates ─────────────────────────────────────────

export const UNITY_ASSERTIONS: TestAssertion[] = [
  // Equality
  {
    macro: 'TEST_ASSERT_EQUAL',
    description: 'Assert two integers are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL(42, getValue());',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_INT',
    description: 'Assert two ints are equal (type-safe)',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_INT(10, counter);',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_INT8',
    description: 'Assert two int8_t values are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_INT8(-5, readByte());',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_INT16',
    description: 'Assert two int16_t values are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_INT16(1024, readWord());',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_INT32',
    description: 'Assert two int32_t values are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_INT32(100000, readLong());',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_UINT',
    description: 'Assert two unsigned integers are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_UINT(255, readRegister());',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_UINT8',
    description: 'Assert two uint8_t values are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_UINT8(0xFF, mask);',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_UINT16',
    description: 'Assert two uint16_t values are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_UINT16(0xABCD, adcValue);',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_UINT32',
    description: 'Assert two uint32_t values are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_UINT32(0xDEADBEEF, crc);',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_HEX',
    description: 'Assert two values are equal (hex display on failure)',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_HEX(0xA0, status);',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_HEX8',
    description: 'Assert two bytes are equal (hex8 display)',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_HEX8(0xFF, readByte());',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_HEX16',
    description: 'Assert two 16-bit values are equal (hex16 display)',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_HEX16(0xCAFE, readWord());',
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_CHAR',
    description: 'Assert two characters are equal',
    args: ['expected', 'actual'],
    example: "TEST_ASSERT_EQUAL_CHAR('A', getChar());",
    category: 'equality',
  },
  {
    macro: 'TEST_ASSERT_NOT_EQUAL',
    description: 'Assert two integers are NOT equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_NOT_EQUAL(0, initResult);',
    category: 'equality',
  },
  // Comparison
  {
    macro: 'TEST_ASSERT_GREATER_THAN',
    description: 'Assert actual > threshold',
    args: ['threshold', 'actual'],
    example: 'TEST_ASSERT_GREATER_THAN(0, sensorReading);',
    category: 'comparison',
  },
  {
    macro: 'TEST_ASSERT_GREATER_OR_EQUAL',
    description: 'Assert actual >= threshold',
    args: ['threshold', 'actual'],
    example: 'TEST_ASSERT_GREATER_OR_EQUAL(MIN_VOLTAGE, readVoltage());',
    category: 'comparison',
  },
  {
    macro: 'TEST_ASSERT_LESS_THAN',
    description: 'Assert actual < threshold',
    args: ['threshold', 'actual'],
    example: 'TEST_ASSERT_LESS_THAN(MAX_TEMP, readTemp());',
    category: 'comparison',
  },
  {
    macro: 'TEST_ASSERT_LESS_OR_EQUAL',
    description: 'Assert actual <= threshold',
    args: ['threshold', 'actual'],
    example: 'TEST_ASSERT_LESS_OR_EQUAL(100, pwmValue);',
    category: 'comparison',
  },
  {
    macro: 'TEST_ASSERT_INT_WITHIN',
    description: 'Assert actual is within delta of expected',
    args: ['delta', 'expected', 'actual'],
    example: 'TEST_ASSERT_INT_WITHIN(5, 100, sensorReading);',
    category: 'comparison',
  },
  // Boolean
  {
    macro: 'TEST_ASSERT_TRUE',
    description: 'Assert condition is true',
    args: ['condition'],
    example: 'TEST_ASSERT_TRUE(isConnected());',
    category: 'boolean',
  },
  {
    macro: 'TEST_ASSERT_FALSE',
    description: 'Assert condition is false',
    args: ['condition'],
    example: 'TEST_ASSERT_FALSE(hasError());',
    category: 'boolean',
  },
  {
    macro: 'TEST_ASSERT_UNLESS',
    description: 'Assert condition is false (alias for FALSE)',
    args: ['condition'],
    example: 'TEST_ASSERT_UNLESS(isOverflow());',
    category: 'boolean',
  },
  // String
  {
    macro: 'TEST_ASSERT_EQUAL_STRING',
    description: 'Assert two C strings are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_STRING("OK", getStatus());',
    category: 'string',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_STRING_LEN',
    description: 'Assert first N chars of two strings are equal',
    args: ['expected', 'actual', 'len'],
    example: 'TEST_ASSERT_EQUAL_STRING_LEN("ERR", msg, 3);',
    category: 'string',
  },
  // Memory
  {
    macro: 'TEST_ASSERT_EQUAL_MEMORY',
    description: 'Assert two memory regions are identical',
    args: ['expected', 'actual', 'len'],
    example: 'TEST_ASSERT_EQUAL_MEMORY(expectedBuf, actualBuf, 16);',
    category: 'memory',
  },
  {
    macro: 'TEST_ASSERT_EACH_EQUAL_INT',
    description: 'Assert each element in array equals expected',
    args: ['expected', 'actual', 'numElements'],
    example: 'TEST_ASSERT_EACH_EQUAL_INT(0, buffer, 32);',
    category: 'memory',
  },
  // Float
  {
    macro: 'TEST_ASSERT_FLOAT_WITHIN',
    description: 'Assert float is within delta of expected',
    args: ['delta', 'expected', 'actual'],
    example: 'TEST_ASSERT_FLOAT_WITHIN(0.01, 3.14, calcPi());',
    category: 'float',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_FLOAT',
    description: 'Assert two floats are equal (within float epsilon)',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_FLOAT(1.0f, normalize(100));',
    category: 'float',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_DOUBLE',
    description: 'Assert two doubles are equal (within double epsilon)',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_DOUBLE(2.718281828, calcE());',
    category: 'float',
  },
  {
    macro: 'TEST_ASSERT_FLOAT_IS_INF',
    description: 'Assert float is infinity',
    args: ['actual'],
    example: 'TEST_ASSERT_FLOAT_IS_INF(divideByZero());',
    category: 'float',
  },
  {
    macro: 'TEST_ASSERT_FLOAT_IS_NOT_INF',
    description: 'Assert float is not infinity',
    args: ['actual'],
    example: 'TEST_ASSERT_FLOAT_IS_NOT_INF(result);',
    category: 'float',
  },
  {
    macro: 'TEST_ASSERT_FLOAT_IS_NAN',
    description: 'Assert float is NaN',
    args: ['actual'],
    example: 'TEST_ASSERT_FLOAT_IS_NAN(sqrtNeg());',
    category: 'float',
  },
  {
    macro: 'TEST_ASSERT_FLOAT_IS_NOT_NAN',
    description: 'Assert float is not NaN',
    args: ['actual'],
    example: 'TEST_ASSERT_FLOAT_IS_NOT_NAN(sensorValue);',
    category: 'float',
  },
  // Pointer
  {
    macro: 'TEST_ASSERT_NULL',
    description: 'Assert pointer is NULL',
    args: ['pointer'],
    example: 'TEST_ASSERT_NULL(findNode(999));',
    category: 'pointer',
  },
  {
    macro: 'TEST_ASSERT_NOT_NULL',
    description: 'Assert pointer is not NULL',
    args: ['pointer'],
    example: 'TEST_ASSERT_NOT_NULL(initSensor());',
    category: 'pointer',
  },
  {
    macro: 'TEST_ASSERT_EQUAL_PTR',
    description: 'Assert two pointers are equal',
    args: ['expected', 'actual'],
    example: 'TEST_ASSERT_EQUAL_PTR(&head, getFirst());',
    category: 'pointer',
  },
];

// ─── Unity Output Parser ─────────────────────────────────────────

/**
 * Regex for Unity test output lines:
 *   path/file.c:42:test_name:PASS
 *   path/file.c:42:test_name:FAIL: Expected 5 Was 3
 *   path/file.c:42:test_name:IGNORE: reason
 */
const UNITY_RESULT_RE = /^(.+?):(\d+):(\w+):(PASS|FAIL|IGNORE)(?::\s*(.*))?$/;

/**
 * Regex for Unity summary line:
 *   -----------------------
 *   10 Tests 2 Failures 1 Ignored
 *   FAIL
 */
const UNITY_SUMMARY_RE = /^(\d+)\s+Tests?\s+(\d+)\s+Failures?\s+(\d+)\s+Ignored?$/;

/**
 * Parse a single Unity test result line.
 */
export function parseUnityResultLine(line: string): TestResult | null {
  const trimmed = line.trim();
  const match = UNITY_RESULT_RE.exec(trimmed);
  if (!match) {
    return null;
  }

  const [, file, lineStr, testName, statusStr, message] = match;
  const statusMap: Record<string, TestStatus> = {
    PASS: 'pass',
    FAIL: 'fail',
    IGNORE: 'ignore',
  };

  return {
    testName,
    status: statusMap[statusStr] ?? 'error',
    file,
    line: parseInt(lineStr, 10),
    message: message ?? undefined,
  };
}

/**
 * Parse complete Unity test output (multi-line).
 */
export function parseUnityOutput(output: string): {
  results: TestResult[];
  totalTests: number;
  passed: number;
  failed: number;
  ignored: number;
} {
  const lines = output.split('\n');
  const results: TestResult[] = [];
  let totalTests = 0;
  let passed = 0;
  let failed = 0;
  let ignored = 0;

  lines.forEach((line) => {
    const result = parseUnityResultLine(line);
    if (result) {
      results.push(result);
      return;
    }

    const summaryMatch = UNITY_SUMMARY_RE.exec(line.trim());
    if (summaryMatch) {
      totalTests = parseInt(summaryMatch[1], 10);
      failed = parseInt(summaryMatch[2], 10);
      ignored = parseInt(summaryMatch[3], 10);
      passed = totalTests - failed - ignored;
    }
  });

  // If no summary line found, derive from results
  if (totalTests === 0 && results.length > 0) {
    totalTests = results.length;
    passed = results.filter((r) => r.status === 'pass').length;
    failed = results.filter((r) => r.status === 'fail').length;
    ignored = results.filter((r) => r.status === 'ignore').length;
  }

  return { results, totalTests, passed, failed, ignored };
}

// ─── Code Generation ─────────────────────────────────────────────

/**
 * Convert a test case name into a valid C function name.
 */
export function sanitizeTestName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/^(\d)/, 'test_$1');
}

/**
 * Generate the Unity test runner C source file for a suite.
 */
export function generateUnityTestFile(suite: TestSuite): string {
  const lines: string[] = [];

  // Header comment
  lines.push('// ──────────────────────────────────────────────────────────────');
  lines.push(`// Unity Test Suite: ${suite.name}`);
  lines.push(`// Generated by ProtoPulse — ${suite.description}`);
  lines.push('// ──────────────────────────────────────────────────────────────');
  lines.push('');

  // Includes
  lines.push('#include "unity.h"');
  suite.includes.forEach((inc) => {
    if (inc.startsWith('<') || inc.startsWith('"')) {
      lines.push(`#include ${inc}`);
    } else {
      lines.push(`#include "${inc}"`);
    }
  });
  if (suite.targetFile) {
    lines.push(`#include "${suite.targetFile}"`);
  }
  lines.push('');

  // setUp / tearDown
  lines.push('void setUp(void) {');
  if (suite.setupBody.trim()) {
    suite.setupBody
      .trim()
      .split('\n')
      .forEach((l) => {
        lines.push(`    ${l}`);
      });
  }
  lines.push('}');
  lines.push('');
  lines.push('void tearDown(void) {');
  if (suite.teardownBody.trim()) {
    suite.teardownBody
      .trim()
      .split('\n')
      .forEach((l) => {
        lines.push(`    ${l}`);
      });
  }
  lines.push('}');
  lines.push('');

  // Test functions
  const enabledCases = suite.cases.filter((tc) => tc.enabled);
  enabledCases.forEach((tc) => {
    const funcName = `test_${sanitizeTestName(tc.name)}`;
    if (tc.group) {
      lines.push(`// Group: ${tc.group}`);
    }
    lines.push(`void ${funcName}(void) {`);
    tc.body
      .trim()
      .split('\n')
      .forEach((l) => {
        lines.push(`    ${l}`);
      });
    lines.push('}');
    lines.push('');
  });

  // Main
  lines.push('int main(void) {');
  lines.push('    UNITY_BEGIN();');
  enabledCases.forEach((tc) => {
    const funcName = `test_${sanitizeTestName(tc.name)}`;
    lines.push(`    RUN_TEST(${funcName});`);
  });
  lines.push('    return UNITY_END();');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate PlatformIO `platformio.ini` section for native testing.
 */
export function generatePlatformIONativeConfig(config?: Partial<PlatformIONativeConfig>): string {
  const envName = config?.envName ?? 'native';
  const platform = config?.platform ?? 'native';
  const framework = config?.testFramework ?? 'unity';
  const flags = config?.buildFlags ?? [];

  const lines: string[] = [];
  lines.push(`[env:${envName}]`);
  lines.push(`platform = ${platform}`);
  lines.push(`test_framework = ${framework}`);

  if (flags.length > 0) {
    lines.push('build_flags =');
    flags.forEach((f) => {
      lines.push(`    ${f}`);
    });
  }

  if (config?.testFilter) {
    lines.push(`test_filter = ${config.testFilter}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Generate a test header stub with forward declarations.
 */
export function generateTestHeader(suite: TestSuite): string {
  const guard = `TEST_${sanitizeTestName(suite.name).toUpperCase()}_H`;
  const lines: string[] = [];

  lines.push(`#ifndef ${guard}`);
  lines.push(`#define ${guard}`);
  lines.push('');
  lines.push('#include "unity.h"');
  lines.push('');

  lines.push('void setUp(void);');
  lines.push('void tearDown(void);');
  lines.push('');

  suite.cases
    .filter((tc) => tc.enabled)
    .forEach((tc) => {
      const funcName = `test_${sanitizeTestName(tc.name)}`;
      lines.push(`void ${funcName}(void);`);
    });

  lines.push('');
  lines.push(`#endif // ${guard}`);
  lines.push('');

  return lines.join('\n');
}

// ─── Suite Manager (Singleton + Subscribe) ───────────────────────

type Listener = () => void;

let suites: Map<string, TestSuite> = new Map();
let runHistory: TestRunSummary[] = [];
const listeners: Set<Listener> = new Set();
let nextId = 1;

function generateId(): string {
  return `ts-${Date.now()}-${nextId++}`;
}

function notify(): void {
  listeners.forEach((fn) => {
    fn();
  });
}

// ─── Subscribe ───────────────────────────────────────────────────

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── Suite CRUD ──────────────────────────────────────────────────

export function createSuite(params: {
  name: string;
  description: string;
  targetFile: string;
  includes?: string[];
  setupBody?: string;
  teardownBody?: string;
}): TestSuite {
  const id = generateId();
  const now = Date.now();
  const suite: TestSuite = {
    id,
    name: params.name,
    description: params.description,
    targetFile: params.targetFile,
    cases: [],
    setupBody: params.setupBody ?? '',
    teardownBody: params.teardownBody ?? '',
    includes: params.includes ?? [],
    createdAt: now,
    updatedAt: now,
  };
  suites.set(id, suite);
  notify();
  return suite;
}

export function getSuite(id: string): TestSuite | undefined {
  return suites.get(id);
}

export function getAllSuites(): TestSuite[] {
  return Array.from(suites.values());
}

export function updateSuite(
  id: string,
  updates: Partial<Pick<TestSuite, 'name' | 'description' | 'targetFile' | 'includes' | 'setupBody' | 'teardownBody'>>,
): TestSuite {
  const suite = suites.get(id);
  if (!suite) {
    throw new Error(`Suite not found: ${id}`);
  }

  const updated: TestSuite = {
    ...suite,
    ...updates,
    updatedAt: Date.now(),
  };
  suites.set(id, updated);
  notify();
  return updated;
}

export function deleteSuite(id: string): boolean {
  const existed = suites.delete(id);
  if (existed) {
    // Also remove run history for this suite
    runHistory = runHistory.filter((r) => r.suiteId !== id);
    notify();
  }
  return existed;
}

// ─── Test Case CRUD ──────────────────────────────────────────────

export function addTestCase(
  suiteId: string,
  params: {
    name: string;
    body: string;
    group?: string;
    enabled?: boolean;
  },
): TestCase {
  const suite = suites.get(suiteId);
  if (!suite) {
    throw new Error(`Suite not found: ${suiteId}`);
  }

  const testCase: TestCase = {
    id: generateId(),
    name: params.name,
    body: params.body,
    group: params.group,
    enabled: params.enabled ?? true,
  };

  const updated: TestSuite = {
    ...suite,
    cases: [...suite.cases, testCase],
    updatedAt: Date.now(),
  };
  suites.set(suiteId, updated);
  notify();
  return testCase;
}

export function updateTestCase(
  suiteId: string,
  caseId: string,
  updates: Partial<Pick<TestCase, 'name' | 'body' | 'group' | 'enabled'>>,
): TestCase {
  const suite = suites.get(suiteId);
  if (!suite) {
    throw new Error(`Suite not found: ${suiteId}`);
  }

  const caseIndex = suite.cases.findIndex((c) => c.id === caseId);
  if (caseIndex === -1) {
    throw new Error(`Test case not found: ${caseId}`);
  }

  const updatedCase: TestCase = {
    ...suite.cases[caseIndex],
    ...updates,
  };

  const updatedCases = [...suite.cases];
  updatedCases[caseIndex] = updatedCase;

  const updated: TestSuite = {
    ...suite,
    cases: updatedCases,
    updatedAt: Date.now(),
  };
  suites.set(suiteId, updated);
  notify();
  return updatedCase;
}

export function removeTestCase(suiteId: string, caseId: string): boolean {
  const suite = suites.get(suiteId);
  if (!suite) {
    throw new Error(`Suite not found: ${suiteId}`);
  }

  const newCases = suite.cases.filter((c) => c.id !== caseId);
  if (newCases.length === suite.cases.length) {
    return false;
  }

  const updated: TestSuite = {
    ...suite,
    cases: newCases,
    updatedAt: Date.now(),
  };
  suites.set(suiteId, updated);
  notify();
  return true;
}

// ─── Run History ─────────────────────────────────────────────────

export function recordTestRun(
  suiteId: string,
  rawOutput: string,
  durationMs: number,
): TestRunSummary {
  const suite = suites.get(suiteId);
  if (!suite) {
    throw new Error(`Suite not found: ${suiteId}`);
  }

  const parsed = parseUnityOutput(rawOutput);

  const summary: TestRunSummary = {
    id: generateId(),
    suiteId,
    suiteName: suite.name,
    timestamp: Date.now(),
    results: parsed.results,
    totalTests: parsed.totalTests,
    passed: parsed.passed,
    failed: parsed.failed,
    ignored: parsed.ignored,
    errors: parsed.results.filter((r) => r.status === 'error').length,
    durationMs,
    rawOutput,
  };

  runHistory.push(summary);
  notify();
  return summary;
}

export function getRunHistory(suiteId?: string): TestRunSummary[] {
  if (suiteId) {
    return runHistory.filter((r) => r.suiteId === suiteId);
  }
  return [...runHistory];
}

export function getLatestRun(suiteId: string): TestRunSummary | undefined {
  const suiteRuns = runHistory.filter((r) => r.suiteId === suiteId);
  return suiteRuns.length > 0 ? suiteRuns[suiteRuns.length - 1] : undefined;
}

export function clearRunHistory(suiteId?: string): number {
  const before = runHistory.length;
  if (suiteId) {
    runHistory = runHistory.filter((r) => r.suiteId !== suiteId);
  } else {
    runHistory = [];
  }
  const cleared = before - runHistory.length;
  if (cleared > 0) {
    notify();
  }
  return cleared;
}

// ─── Assertion Helpers ───────────────────────────────────────────

export function getAssertionsByCategory(category: TestAssertion['category']): TestAssertion[] {
  return UNITY_ASSERTIONS.filter((a) => a.category === category);
}

export function getAssertionCategories(): TestAssertion['category'][] {
  const categories = new Set<TestAssertion['category']>();
  UNITY_ASSERTIONS.forEach((a) => {
    categories.add(a.category);
  });
  return Array.from(categories);
}

export function searchAssertions(query: string): TestAssertion[] {
  const lower = query.toLowerCase();
  return UNITY_ASSERTIONS.filter(
    (a) =>
      a.macro.toLowerCase().includes(lower) ||
      a.description.toLowerCase().includes(lower) ||
      a.category.toLowerCase().includes(lower),
  );
}

// ─── Test Scaffolding Helpers ────────────────────────────────────

/**
 * Generate a minimal test case body for a function under test.
 */
export function scaffoldTestBody(params: {
  functionName: string;
  returnType?: string;
  args?: string[];
}): string {
  const { functionName, returnType = 'int', args = [] } = params;
  const argList = args.join(', ');
  const lines: string[] = [];

  lines.push('// Arrange');

  if (args.length > 0) {
    args.forEach((arg, i) => {
      lines.push(`// ${arg} = ...; // TODO: set test input ${i + 1}`);
    });
  }

  lines.push('');
  lines.push('// Act');

  if (returnType === 'void') {
    lines.push(`${functionName}(${argList});`);
  } else {
    lines.push(`${returnType} result = ${functionName}(${argList});`);
  }

  lines.push('');
  lines.push('// Assert');

  if (returnType === 'void') {
    lines.push('// TODO: verify side effects');
    lines.push('TEST_ASSERT_TRUE(1); // placeholder');
  } else if (returnType === 'float' || returnType === 'double') {
    lines.push(`TEST_ASSERT_FLOAT_WITHIN(0.001, /* expected */, result);`);
  } else if (returnType.includes('*')) {
    lines.push('TEST_ASSERT_NOT_NULL(result);');
  } else if (returnType === 'bool') {
    lines.push('TEST_ASSERT_TRUE(result);');
  } else {
    lines.push('TEST_ASSERT_EQUAL(/* expected */, result);');
  }

  return lines.join('\n');
}

/**
 * Generate a test suite scaffold from a list of function signatures.
 */
export function scaffoldSuiteFromFunctions(
  suiteName: string,
  targetFile: string,
  functions: Array<{
    name: string;
    returnType?: string;
    args?: string[];
  }>,
): TestSuite {
  const suite = createSuite({
    name: suiteName,
    description: `Auto-generated tests for ${targetFile}`,
    targetFile,
  });

  functions.forEach((fn) => {
    addTestCase(suite.id, {
      name: fn.name,
      body: scaffoldTestBody({
        functionName: fn.name,
        returnType: fn.returnType,
        args: fn.args,
      }),
      group: 'auto-generated',
    });
  });

  return suites.get(suite.id)!;
}

// ─── State Management ────────────────────────────────────────────

/**
 * Reset all state (for testing purposes).
 */
export function resetFirmwareTestState(): void {
  suites = new Map();
  runHistory = [];
  listeners.clear();
  nextId = 1;
}

/**
 * Export current state for persistence.
 */
export function exportState(): {
  suites: TestSuite[];
  runHistory: TestRunSummary[];
} {
  return {
    suites: Array.from(suites.values()),
    runHistory: [...runHistory],
  };
}

/**
 * Import state from persistence.
 */
export function importState(state: { suites: TestSuite[]; runHistory: TestRunSummary[] }): void {
  suites = new Map();
  state.suites.forEach((s) => {
    suites.set(s.id, s);
  });
  runHistory = [...state.runHistory];
  notify();
}
