import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseUnityResultLine,
  parseUnityOutput,
  sanitizeTestName,
  generateUnityTestFile,
  generatePlatformIONativeConfig,
  generateTestHeader,
  createSuite,
  getSuite,
  getAllSuites,
  updateSuite,
  deleteSuite,
  addTestCase,
  updateTestCase,
  removeTestCase,
  recordTestRun,
  getRunHistory,
  getLatestRun,
  clearRunHistory,
  resetFirmwareTestState,
  UNITY_ASSERTIONS,
  getAssertionsByCategory,
  getAssertionCategories,
  searchAssertions,
  scaffoldTestBody,
  scaffoldSuiteFromFunctions,
  subscribe,
  exportState,
  importState,
} from '../firmware-testing';
import type { TestSuite, TestResult } from '../firmware-testing';

beforeEach(() => {
  resetFirmwareTestState();
});

// ──────────────────────────────────────────────────────────────────
// parseUnityResultLine
// ──────────────────────────────────────────────────────────────────

describe('parseUnityResultLine', () => {
  it('parses a PASS result', () => {
    const result = parseUnityResultLine('test/test_main.c:10:test_add:PASS');
    expect(result).not.toBeNull();
    expect(result!.testName).toBe('test_add');
    expect(result!.status).toBe('pass');
    expect(result!.file).toBe('test/test_main.c');
    expect(result!.line).toBe(10);
    expect(result!.message).toBeUndefined();
  });

  it('parses a FAIL result with message', () => {
    const result = parseUnityResultLine(
      'test/test_math.c:25:test_multiply:FAIL: Expected 42 Was 0',
    );
    expect(result).not.toBeNull();
    expect(result!.testName).toBe('test_multiply');
    expect(result!.status).toBe('fail');
    expect(result!.line).toBe(25);
    expect(result!.message).toBe('Expected 42 Was 0');
  });

  it('parses an IGNORE result with reason', () => {
    const result = parseUnityResultLine(
      'test/test_hw.c:5:test_sensor:IGNORE: hardware not connected',
    );
    expect(result).not.toBeNull();
    expect(result!.status).toBe('ignore');
    expect(result!.message).toBe('hardware not connected');
  });

  it('returns null for non-matching lines', () => {
    expect(parseUnityResultLine('compiling...')).toBeNull();
    expect(parseUnityResultLine('')).toBeNull();
    expect(parseUnityResultLine('---')).toBeNull();
  });

  it('handles Windows-style paths', () => {
    const result = parseUnityResultLine('C:\\project\\test.c:10:test_init:PASS');
    expect(result).not.toBeNull();
    expect(result!.testName).toBe('test_init');
    expect(result!.status).toBe('pass');
  });

  it('trims whitespace from line', () => {
    const result = parseUnityResultLine('  test/test.c:1:test_x:PASS  ');
    expect(result).not.toBeNull();
    expect(result!.status).toBe('pass');
  });
});

// ──────────────────────────────────────────────────────────────────
// parseUnityOutput
// ──────────────────────────────────────────────────────────────────

describe('parseUnityOutput', () => {
  it('parses complete Unity output with summary', () => {
    const output = [
      'test/test_main.c:10:test_add:PASS',
      'test/test_main.c:20:test_sub:PASS',
      'test/test_main.c:30:test_mul:FAIL: Expected 6 Was 0',
      'test/test_main.c:40:test_div:IGNORE',
      '-----------------------',
      '4 Tests 1 Failures 1 Ignored',
      'FAIL',
    ].join('\n');

    const parsed = parseUnityOutput(output);
    expect(parsed.results).toHaveLength(4);
    expect(parsed.totalTests).toBe(4);
    expect(parsed.passed).toBe(2);
    expect(parsed.failed).toBe(1);
    expect(parsed.ignored).toBe(1);
  });

  it('derives stats from results when no summary line', () => {
    const output = [
      'test.c:1:test_a:PASS',
      'test.c:2:test_b:FAIL: oops',
      'test.c:3:test_c:PASS',
    ].join('\n');

    const parsed = parseUnityOutput(output);
    expect(parsed.totalTests).toBe(3);
    expect(parsed.passed).toBe(2);
    expect(parsed.failed).toBe(1);
    expect(parsed.ignored).toBe(0);
  });

  it('handles empty output', () => {
    const parsed = parseUnityOutput('');
    expect(parsed.results).toHaveLength(0);
    expect(parsed.totalTests).toBe(0);
  });

  it('ignores non-result lines in output', () => {
    const output = [
      'Compiling test_main.c...',
      'Linking...',
      'test.c:1:test_ok:PASS',
      'Done.',
    ].join('\n');

    const parsed = parseUnityOutput(output);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.totalTests).toBe(1);
  });

  it('handles all PASS output', () => {
    const output = [
      'test.c:1:test_a:PASS',
      'test.c:2:test_b:PASS',
      'test.c:3:test_c:PASS',
      '-----------------------',
      '3 Tests 0 Failures 0 Ignored',
      'OK',
    ].join('\n');

    const parsed = parseUnityOutput(output);
    expect(parsed.passed).toBe(3);
    expect(parsed.failed).toBe(0);
    expect(parsed.ignored).toBe(0);
  });

  it('handles singular "Test" / "Failure" / "Ignore" in summary', () => {
    const output = [
      'test.c:1:test_a:FAIL: bad',
      '-----------------------',
      '1 Test 1 Failure 0 Ignored',
      'FAIL',
    ].join('\n');

    const parsed = parseUnityOutput(output);
    expect(parsed.totalTests).toBe(1);
    expect(parsed.failed).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// sanitizeTestName
// ──────────────────────────────────────────────────────────────────

describe('sanitizeTestName', () => {
  it('replaces spaces with underscores', () => {
    expect(sanitizeTestName('my test name')).toBe('my_test_name');
  });

  it('removes special characters', () => {
    expect(sanitizeTestName('test@#$%^&')).toBe('test');
  });

  it('collapses consecutive underscores', () => {
    expect(sanitizeTestName('test__name___here')).toBe('test_name_here');
  });

  it('strips leading/trailing underscores', () => {
    expect(sanitizeTestName('_test_')).toBe('test');
  });

  it('prefixes names starting with digit', () => {
    expect(sanitizeTestName('123abc')).toBe('test_123abc');
  });

  it('handles empty string', () => {
    expect(sanitizeTestName('')).toBe('');
  });

  it('preserves valid C identifier', () => {
    expect(sanitizeTestName('valid_name_42')).toBe('valid_name_42');
  });
});

// ──────────────────────────────────────────────────────────────────
// generateUnityTestFile
// ──────────────────────────────────────────────────────────────────

describe('generateUnityTestFile', () => {
  function makeSuite(overrides?: Partial<TestSuite>): TestSuite {
    return {
      id: 'suite-1',
      name: 'motor_control',
      description: 'Tests for motor controller',
      targetFile: 'motor.h',
      cases: [
        { id: 'tc-1', name: 'init returns zero', body: 'TEST_ASSERT_EQUAL(0, motor_init());', enabled: true },
        { id: 'tc-2', name: 'speed clamp', body: 'motor_set_speed(999);\nTEST_ASSERT_LESS_OR_EQUAL(255, motor_get_speed());', enabled: true, group: 'limits' },
      ],
      setupBody: 'motor_reset();',
      teardownBody: 'motor_stop();',
      includes: ['<stdint.h>'],
      createdAt: 0,
      updatedAt: 0,
      ...overrides,
    } as TestSuite;
  }

  it('includes unity.h and target file', () => {
    const output = generateUnityTestFile(makeSuite());
    expect(output).toContain('#include "unity.h"');
    expect(output).toContain('#include "motor.h"');
  });

  it('includes custom includes', () => {
    const output = generateUnityTestFile(makeSuite());
    expect(output).toContain('#include <stdint.h>');
  });

  it('generates setUp function with body', () => {
    const output = generateUnityTestFile(makeSuite());
    expect(output).toContain('void setUp(void) {');
    expect(output).toContain('motor_reset();');
  });

  it('generates tearDown function with body', () => {
    const output = generateUnityTestFile(makeSuite());
    expect(output).toContain('void tearDown(void) {');
    expect(output).toContain('motor_stop();');
  });

  it('generates test functions with sanitized names', () => {
    const output = generateUnityTestFile(makeSuite());
    expect(output).toContain('void test_init_returns_zero(void) {');
    expect(output).toContain('void test_speed_clamp(void) {');
  });

  it('generates main with RUN_TEST calls', () => {
    const output = generateUnityTestFile(makeSuite());
    expect(output).toContain('int main(void) {');
    expect(output).toContain('UNITY_BEGIN();');
    expect(output).toContain('RUN_TEST(test_init_returns_zero);');
    expect(output).toContain('RUN_TEST(test_speed_clamp);');
    expect(output).toContain('return UNITY_END();');
  });

  it('skips disabled test cases', () => {
    const suite = makeSuite({
      cases: [
        { id: 'tc-1', name: 'enabled', body: 'TEST_ASSERT_TRUE(1);', enabled: true },
        { id: 'tc-2', name: 'disabled', body: 'TEST_ASSERT_TRUE(0);', enabled: false },
      ],
    });
    const output = generateUnityTestFile(suite);
    expect(output).toContain('test_enabled');
    expect(output).not.toContain('test_disabled');
  });

  it('adds group comments', () => {
    const output = generateUnityTestFile(makeSuite());
    expect(output).toContain('// Group: limits');
  });

  it('handles empty setUp/tearDown', () => {
    const suite = makeSuite({ setupBody: '', teardownBody: '' });
    const output = generateUnityTestFile(suite);
    expect(output).toContain('void setUp(void) {\n}');
    expect(output).toContain('void tearDown(void) {\n}');
  });

  it('quotes non-angle-bracket includes', () => {
    const suite = makeSuite({ includes: ['my_utils.h', '<stdio.h>'] });
    const output = generateUnityTestFile(suite);
    expect(output).toContain('#include "my_utils.h"');
    expect(output).toContain('#include <stdio.h>');
  });

  it('handles already-quoted includes', () => {
    const suite = makeSuite({ includes: ['"already_quoted.h"'] });
    const output = generateUnityTestFile(suite);
    expect(output).toContain('#include "already_quoted.h"');
  });
});

// ──────────────────────────────────────────────────────────────────
// generatePlatformIONativeConfig
// ──────────────────────────────────────────────────────────────────

describe('generatePlatformIONativeConfig', () => {
  it('generates default native config', () => {
    const config = generatePlatformIONativeConfig();
    expect(config).toContain('[env:native]');
    expect(config).toContain('platform = native');
    expect(config).toContain('test_framework = unity');
  });

  it('respects custom env name', () => {
    const config = generatePlatformIONativeConfig({ envName: 'test' });
    expect(config).toContain('[env:test]');
  });

  it('includes build flags', () => {
    const config = generatePlatformIONativeConfig({
      buildFlags: ['-DUNIT_TEST', '-I include/'],
    });
    expect(config).toContain('build_flags =');
    expect(config).toContain('-DUNIT_TEST');
    expect(config).toContain('-I include/');
  });

  it('includes test filter when specified', () => {
    const config = generatePlatformIONativeConfig({ testFilter: 'test_motor' });
    expect(config).toContain('test_filter = test_motor');
  });

  it('omits build_flags when empty', () => {
    const config = generatePlatformIONativeConfig({ buildFlags: [] });
    expect(config).not.toContain('build_flags');
  });
});

// ──────────────────────────────────────────────────────────────────
// generateTestHeader
// ──────────────────────────────────────────────────────────────────

describe('generateTestHeader', () => {
  it('generates include guard', () => {
    const suite: TestSuite = {
      id: 's1', name: 'motor_tests', description: '', targetFile: '',
      cases: [], setupBody: '', teardownBody: '', includes: [],
      createdAt: 0, updatedAt: 0,
    };
    const header = generateTestHeader(suite);
    expect(header).toContain('#ifndef TEST_MOTOR_TESTS_H');
    expect(header).toContain('#define TEST_MOTOR_TESTS_H');
    expect(header).toContain('#endif // TEST_MOTOR_TESTS_H');
  });

  it('declares setUp and tearDown', () => {
    const suite: TestSuite = {
      id: 's1', name: 'x', description: '', targetFile: '',
      cases: [], setupBody: '', teardownBody: '', includes: [],
      createdAt: 0, updatedAt: 0,
    };
    const header = generateTestHeader(suite);
    expect(header).toContain('void setUp(void);');
    expect(header).toContain('void tearDown(void);');
  });

  it('declares enabled test functions', () => {
    const suite: TestSuite = {
      id: 's1', name: 'x', description: '', targetFile: '',
      cases: [
        { id: '1', name: 'alpha', body: '', enabled: true },
        { id: '2', name: 'beta', body: '', enabled: false },
      ],
      setupBody: '', teardownBody: '', includes: [],
      createdAt: 0, updatedAt: 0,
    };
    const header = generateTestHeader(suite);
    expect(header).toContain('void test_alpha(void);');
    expect(header).not.toContain('test_beta');
  });
});

// ──────────────────────────────────────────────────────────────────
// Suite CRUD
// ──────────────────────────────────────────────────────────────────

describe('Suite CRUD', () => {
  it('creates a suite with defaults', () => {
    const suite = createSuite({
      name: 'LED Driver',
      description: 'Tests for LED driver',
      targetFile: 'led.h',
    });
    expect(suite.id).toBeTruthy();
    expect(suite.name).toBe('LED Driver');
    expect(suite.cases).toHaveLength(0);
    expect(suite.setupBody).toBe('');
    expect(suite.teardownBody).toBe('');
    expect(suite.includes).toEqual([]);
    expect(suite.createdAt).toBeGreaterThan(0);
  });

  it('creates a suite with custom setup/teardown', () => {
    const suite = createSuite({
      name: 'test',
      description: '',
      targetFile: 'x.h',
      setupBody: 'init();',
      teardownBody: 'cleanup();',
      includes: ['<string.h>'],
    });
    expect(suite.setupBody).toBe('init();');
    expect(suite.teardownBody).toBe('cleanup();');
    expect(suite.includes).toEqual(['<string.h>']);
  });

  it('getSuite returns the suite by id', () => {
    const created = createSuite({ name: 'a', description: '', targetFile: '' });
    const fetched = getSuite(created.id);
    expect(fetched).toEqual(created);
  });

  it('getSuite returns undefined for unknown id', () => {
    expect(getSuite('nonexistent')).toBeUndefined();
  });

  it('getAllSuites returns all suites', () => {
    createSuite({ name: 'a', description: '', targetFile: '' });
    createSuite({ name: 'b', description: '', targetFile: '' });
    expect(getAllSuites()).toHaveLength(2);
  });

  it('updateSuite modifies suite properties', () => {
    const suite = createSuite({ name: 'old', description: 'old desc', targetFile: 'old.h' });
    const updated = updateSuite(suite.id, { name: 'new', description: 'new desc' });
    expect(updated.name).toBe('new');
    expect(updated.description).toBe('new desc');
    expect(updated.targetFile).toBe('old.h');
    expect(updated.updatedAt).toBeGreaterThanOrEqual(suite.updatedAt);
  });

  it('updateSuite throws for unknown id', () => {
    expect(() => updateSuite('bad-id', { name: 'x' })).toThrow('Suite not found');
  });

  it('deleteSuite removes the suite', () => {
    const suite = createSuite({ name: 'del', description: '', targetFile: '' });
    expect(deleteSuite(suite.id)).toBe(true);
    expect(getSuite(suite.id)).toBeUndefined();
    expect(getAllSuites()).toHaveLength(0);
  });

  it('deleteSuite returns false for unknown id', () => {
    expect(deleteSuite('nonexistent')).toBe(false);
  });

  it('deleteSuite also removes run history for that suite', () => {
    const suite = createSuite({ name: 's', description: '', targetFile: '' });
    addTestCase(suite.id, { name: 't', body: '' });
    recordTestRun(suite.id, 'test.c:1:test_t:PASS\n1 Tests 0 Failures 0 Ignored', 100);
    expect(getRunHistory(suite.id)).toHaveLength(1);
    deleteSuite(suite.id);
    expect(getRunHistory(suite.id)).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Test Case CRUD
// ──────────────────────────────────────────────────────────────────

describe('Test Case CRUD', () => {
  let suiteId: string;

  beforeEach(() => {
    const suite = createSuite({ name: 'suite', description: '', targetFile: '' });
    suiteId = suite.id;
  });

  it('addTestCase creates a test case', () => {
    const tc = addTestCase(suiteId, {
      name: 'test_init',
      body: 'TEST_ASSERT_TRUE(init());',
    });
    expect(tc.id).toBeTruthy();
    expect(tc.name).toBe('test_init');
    expect(tc.enabled).toBe(true);
    expect(tc.group).toBeUndefined();
  });

  it('addTestCase with group and disabled', () => {
    const tc = addTestCase(suiteId, {
      name: 'test_hw',
      body: '',
      group: 'hardware',
      enabled: false,
    });
    expect(tc.group).toBe('hardware');
    expect(tc.enabled).toBe(false);
  });

  it('addTestCase throws for unknown suite', () => {
    expect(() => addTestCase('bad', { name: 'x', body: '' })).toThrow('Suite not found');
  });

  it('addTestCase appends to suite cases', () => {
    addTestCase(suiteId, { name: 'a', body: '' });
    addTestCase(suiteId, { name: 'b', body: '' });
    const suite = getSuite(suiteId)!;
    expect(suite.cases).toHaveLength(2);
    expect(suite.cases[0].name).toBe('a');
    expect(suite.cases[1].name).toBe('b');
  });

  it('updateTestCase modifies case properties', () => {
    const tc = addTestCase(suiteId, { name: 'old', body: 'old body' });
    const updated = updateTestCase(suiteId, tc.id, { name: 'new', body: 'new body' });
    expect(updated.name).toBe('new');
    expect(updated.body).toBe('new body');
  });

  it('updateTestCase throws for unknown suite', () => {
    expect(() => updateTestCase('bad', 'tc', {})).toThrow('Suite not found');
  });

  it('updateTestCase throws for unknown case', () => {
    expect(() => updateTestCase(suiteId, 'bad', {})).toThrow('Test case not found');
  });

  it('removeTestCase removes a case', () => {
    const tc = addTestCase(suiteId, { name: 'doomed', body: '' });
    expect(removeTestCase(suiteId, tc.id)).toBe(true);
    expect(getSuite(suiteId)!.cases).toHaveLength(0);
  });

  it('removeTestCase returns false for unknown case', () => {
    addTestCase(suiteId, { name: 'keep', body: '' });
    expect(removeTestCase(suiteId, 'bad-id')).toBe(false);
    expect(getSuite(suiteId)!.cases).toHaveLength(1);
  });

  it('removeTestCase throws for unknown suite', () => {
    expect(() => removeTestCase('bad', 'tc')).toThrow('Suite not found');
  });
});

// ──────────────────────────────────────────────────────────────────
// Run History
// ──────────────────────────────────────────────────────────────────

describe('Run History', () => {
  let suiteId: string;

  beforeEach(() => {
    const suite = createSuite({ name: 'suite', description: '', targetFile: '' });
    suiteId = suite.id;
    addTestCase(suiteId, { name: 'test_a', body: '' });
  });

  it('recordTestRun parses output and stores summary', () => {
    const output = 'test.c:1:test_a:PASS\n1 Tests 0 Failures 0 Ignored';
    const run = recordTestRun(suiteId, output, 250);
    expect(run.suiteId).toBe(suiteId);
    expect(run.totalTests).toBe(1);
    expect(run.passed).toBe(1);
    expect(run.failed).toBe(0);
    expect(run.durationMs).toBe(250);
    expect(run.rawOutput).toBe(output);
  });

  it('recordTestRun throws for unknown suite', () => {
    expect(() => recordTestRun('bad', '', 0)).toThrow('Suite not found');
  });

  it('getRunHistory returns all runs when no suiteId', () => {
    const suite2 = createSuite({ name: 's2', description: '', targetFile: '' });
    addTestCase(suite2.id, { name: 'test_b', body: '' });
    recordTestRun(suiteId, 'test.c:1:test_a:PASS', 100);
    recordTestRun(suite2.id, 'test.c:1:test_b:FAIL: oops', 200);
    expect(getRunHistory()).toHaveLength(2);
  });

  it('getRunHistory filters by suiteId', () => {
    recordTestRun(suiteId, 'test.c:1:test_a:PASS', 100);
    expect(getRunHistory(suiteId)).toHaveLength(1);
    expect(getRunHistory('other')).toHaveLength(0);
  });

  it('getLatestRun returns the most recent run', () => {
    recordTestRun(suiteId, 'test.c:1:test_a:PASS', 100);
    recordTestRun(suiteId, 'test.c:1:test_a:FAIL: oops', 200);
    const latest = getLatestRun(suiteId);
    expect(latest).toBeDefined();
    expect(latest!.durationMs).toBe(200);
  });

  it('getLatestRun returns undefined when no runs', () => {
    expect(getLatestRun(suiteId)).toBeUndefined();
  });

  it('clearRunHistory clears all runs', () => {
    recordTestRun(suiteId, 'test.c:1:test_a:PASS', 100);
    const cleared = clearRunHistory();
    expect(cleared).toBe(1);
    expect(getRunHistory()).toHaveLength(0);
  });

  it('clearRunHistory clears only specified suite', () => {
    const suite2 = createSuite({ name: 's2', description: '', targetFile: '' });
    addTestCase(suite2.id, { name: 'test_b', body: '' });
    recordTestRun(suiteId, 'test.c:1:test_a:PASS', 100);
    recordTestRun(suite2.id, 'test.c:1:test_b:PASS', 200);
    const cleared = clearRunHistory(suiteId);
    expect(cleared).toBe(1);
    expect(getRunHistory()).toHaveLength(1);
    expect(getRunHistory()[0].suiteId).toBe(suite2.id);
  });

  it('clearRunHistory returns 0 when nothing to clear', () => {
    expect(clearRunHistory()).toBe(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// Assertion Templates
// ──────────────────────────────────────────────────────────────────

describe('UNITY_ASSERTIONS', () => {
  it('has at least 30 assertions', () => {
    expect(UNITY_ASSERTIONS.length).toBeGreaterThanOrEqual(30);
  });

  it('all assertions have required fields', () => {
    UNITY_ASSERTIONS.forEach((a) => {
      expect(a.macro).toBeTruthy();
      expect(a.description).toBeTruthy();
      expect(a.args.length).toBeGreaterThan(0);
      expect(a.example).toBeTruthy();
      expect(a.category).toBeTruthy();
    });
  });

  it('covers all categories', () => {
    const cats = getAssertionCategories();
    expect(cats).toContain('equality');
    expect(cats).toContain('comparison');
    expect(cats).toContain('boolean');
    expect(cats).toContain('string');
    expect(cats).toContain('memory');
    expect(cats).toContain('float');
    expect(cats).toContain('pointer');
  });
});

describe('getAssertionsByCategory', () => {
  it('filters by equality', () => {
    const eq = getAssertionsByCategory('equality');
    expect(eq.length).toBeGreaterThan(5);
    eq.forEach((a) => {
      expect(a.category).toBe('equality');
    });
  });

  it('filters by float', () => {
    const fl = getAssertionsByCategory('float');
    expect(fl.length).toBeGreaterThan(2);
    fl.forEach((a) => {
      expect(a.category).toBe('float');
    });
  });

  it('returns empty for unknown category', () => {
    expect(getAssertionsByCategory('nonexistent' as TestAssertion['category'])).toHaveLength(0);
  });
});

describe('searchAssertions', () => {
  it('finds by macro name', () => {
    const results = searchAssertions('EQUAL_STRING');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.macro === 'TEST_ASSERT_EQUAL_STRING')).toBe(true);
  });

  it('finds by description', () => {
    const results = searchAssertions('pointer');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('case insensitive', () => {
    const results = searchAssertions('null');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty for no match', () => {
    expect(searchAssertions('zzzznotfound')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// scaffoldTestBody
// ──────────────────────────────────────────────────────────────────

describe('scaffoldTestBody', () => {
  it('generates Arrange/Act/Assert structure', () => {
    const body = scaffoldTestBody({ functionName: 'motor_init' });
    expect(body).toContain('// Arrange');
    expect(body).toContain('// Act');
    expect(body).toContain('// Assert');
  });

  it('calls function with return type', () => {
    const body = scaffoldTestBody({ functionName: 'get_value', returnType: 'int' });
    expect(body).toContain('int result = get_value();');
    expect(body).toContain('TEST_ASSERT_EQUAL');
  });

  it('handles void return type', () => {
    const body = scaffoldTestBody({ functionName: 'reset', returnType: 'void' });
    expect(body).toContain('reset();');
    expect(body).not.toContain('result');
    expect(body).toContain('TEST_ASSERT_TRUE(1);');
  });

  it('handles float return type', () => {
    const body = scaffoldTestBody({ functionName: 'read_temp', returnType: 'float' });
    expect(body).toContain('float result = read_temp();');
    expect(body).toContain('TEST_ASSERT_FLOAT_WITHIN');
  });

  it('handles pointer return type', () => {
    const body = scaffoldTestBody({ functionName: 'get_buf', returnType: 'char*' });
    expect(body).toContain('TEST_ASSERT_NOT_NULL(result);');
  });

  it('handles bool return type', () => {
    const body = scaffoldTestBody({ functionName: 'is_ready', returnType: 'bool' });
    expect(body).toContain('TEST_ASSERT_TRUE(result);');
  });

  it('includes args in function call', () => {
    const body = scaffoldTestBody({
      functionName: 'add',
      returnType: 'int',
      args: ['a', 'b'],
    });
    expect(body).toContain('int result = add(a, b);');
  });
});

// ──────────────────────────────────────────────────────────────────
// scaffoldSuiteFromFunctions
// ──────────────────────────────────────────────────────────────────

describe('scaffoldSuiteFromFunctions', () => {
  it('creates suite with test cases for each function', () => {
    const suite = scaffoldSuiteFromFunctions('motor', 'motor.h', [
      { name: 'motor_init', returnType: 'int' },
      { name: 'motor_set_speed', returnType: 'void', args: ['speed'] },
    ]);
    expect(suite.name).toBe('motor');
    expect(suite.targetFile).toBe('motor.h');
    expect(suite.cases).toHaveLength(2);
    expect(suite.cases[0].name).toBe('motor_init');
    expect(suite.cases[1].name).toBe('motor_set_speed');
    expect(suite.cases[0].group).toBe('auto-generated');
  });

  it('generates valid test bodies', () => {
    const suite = scaffoldSuiteFromFunctions('math', 'math.h', [
      { name: 'my_abs', returnType: 'int', args: ['x'] },
    ]);
    expect(suite.cases[0].body).toContain('int result = my_abs(x);');
  });
});

// ──────────────────────────────────────────────────────────────────
// subscribe
// ──────────────────────────────────────────────────────────────────

describe('subscribe', () => {
  it('notifies on suite creation', () => {
    let called = 0;
    subscribe(() => { called++; });
    createSuite({ name: 'a', description: '', targetFile: '' });
    expect(called).toBe(1);
  });

  it('unsubscribe stops notifications', () => {
    let called = 0;
    const unsub = subscribe(() => { called++; });
    createSuite({ name: 'a', description: '', targetFile: '' });
    unsub();
    createSuite({ name: 'b', description: '', targetFile: '' });
    expect(called).toBe(1);
  });

  it('notifies on test case add', () => {
    const suite = createSuite({ name: 'a', description: '', targetFile: '' });
    let called = 0;
    subscribe(() => { called++; });
    addTestCase(suite.id, { name: 't', body: '' });
    expect(called).toBe(1);
  });

  it('notifies on run recorded', () => {
    const suite = createSuite({ name: 'a', description: '', targetFile: '' });
    addTestCase(suite.id, { name: 't', body: '' });
    let called = 0;
    subscribe(() => { called++; });
    recordTestRun(suite.id, 'test.c:1:test_t:PASS', 10);
    expect(called).toBe(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// exportState / importState
// ──────────────────────────────────────────────────────────────────

describe('exportState / importState', () => {
  it('round-trips state', () => {
    const suite = createSuite({ name: 'persist', description: 'test', targetFile: 'x.h' });
    addTestCase(suite.id, { name: 'tc', body: 'TEST_ASSERT_TRUE(1);' });
    recordTestRun(suite.id, 'test.c:1:test_tc:PASS\n1 Tests 0 Failures 0 Ignored', 50);

    const exported = exportState();
    resetFirmwareTestState();
    expect(getAllSuites()).toHaveLength(0);

    importState(exported);
    expect(getAllSuites()).toHaveLength(1);
    expect(getAllSuites()[0].name).toBe('persist');
    expect(getAllSuites()[0].cases).toHaveLength(1);
    expect(getRunHistory()).toHaveLength(1);
  });

  it('importState replaces existing state', () => {
    createSuite({ name: 'old', description: '', targetFile: '' });
    importState({ suites: [], runHistory: [] });
    expect(getAllSuites()).toHaveLength(0);
  });

  it('importState notifies listeners', () => {
    let called = 0;
    subscribe(() => { called++; });
    importState({ suites: [], runHistory: [] });
    expect(called).toBe(1);
  });
});
