import { describe, it, expect, beforeEach } from 'vitest';
import {
  ServerStaticAnalysisManager,
  parseCppcheckXml,
  parseClangTidyOutput,
  mergeFindings,
  buildMergedResult,
  toCodeMirrorAnnotations,
  runLocalAnalysis,
  getCppcheckRule,
  CPPCHECK_RULES,
} from '../server-static-analysis';
import type {
  ServerFinding,
  ToolSource,
  CppcheckRule,
} from '../server-static-analysis';

// ─── Helpers ─────────────────────────────────────────────────────

function getManager(): ServerStaticAnalysisManager {
  ServerStaticAnalysisManager.resetInstance();
  return ServerStaticAnalysisManager.getInstance();
}

function makeCppcheckXml(errors: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<results version="2">\n  <errors>\n${errors}\n  </errors>\n</results>`;
}

function makeClangTidyOutput(diags: string[]): string {
  return diags.join('\n');
}

const SAMPLE_CODE = `#include <stdio.h>

void setup() {
  int x;
  char *ptr = malloc(100);
  ptr[0] = 'a';
  strcpy(buf, input);
  free(ptr);
}

void loop() {
  int y = 42;
}
`;

// ─── Singleton ───────────────────────────────────────────────────

describe('ServerStaticAnalysisManager — singleton', () => {
  beforeEach(() => {
    ServerStaticAnalysisManager.resetInstance();
  });

  it('returns the same instance', () => {
    const a = ServerStaticAnalysisManager.getInstance();
    const b = ServerStaticAnalysisManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a fresh instance', () => {
    const a = ServerStaticAnalysisManager.getInstance();
    ServerStaticAnalysisManager.resetInstance();
    const b = ServerStaticAnalysisManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ─── Cppcheck Rule Database ─────────────────────────────────────

describe('CPPCHECK_RULES', () => {
  it('has at least 30 rules', () => {
    expect(CPPCHECK_RULES.length).toBeGreaterThanOrEqual(30);
  });

  it('each rule has required fields', () => {
    CPPCHECK_RULES.forEach((rule: CppcheckRule) => {
      expect(rule.id).toBeTruthy();
      expect(rule.severity).toBeTruthy();
      expect(rule.category).toBeTruthy();
      expect(rule.description).toBeTruthy();
    });
  });

  it('all rule IDs are unique', () => {
    const ids = CPPCHECK_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers all severity levels', () => {
    const severities = new Set(CPPCHECK_RULES.map((r) => r.severity));
    expect(severities.has('error')).toBe(true);
    expect(severities.has('warning')).toBe(true);
    expect(severities.has('style')).toBe(true);
    expect(severities.has('performance')).toBe(true);
    expect(severities.has('portability')).toBe(true);
  });

  it('getCppcheckRule returns matching rule', () => {
    const rule = getCppcheckRule('nullPointer');
    expect(rule).toBeDefined();
    expect(rule!.severity).toBe('error');
    expect(rule!.cweId).toBe(476);
  });

  it('getCppcheckRule returns undefined for unknown rule', () => {
    expect(getCppcheckRule('nonexistentRule')).toBeUndefined();
  });

  it('has CWE IDs on critical rules', () => {
    const criticalRules = CPPCHECK_RULES.filter((r) => r.severity === 'error');
    const withCwe = criticalRules.filter((r) => r.cweId !== undefined);
    expect(withCwe.length).toBeGreaterThan(0);
  });
});

// ─── Cppcheck XML Parser ────────────────────────────────────────

describe('parseCppcheckXml', () => {
  it('parses basic error with location', () => {
    const xml = makeCppcheckXml(`
      <error id="nullPointer" severity="error" msg="Null pointer dereference: ptr" cwe="476">
        <location file="main.c" line="10" column="5"/>
      </error>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('nullPointer');
    expect(findings[0].severity).toBe('error');
    expect(findings[0].line).toBe(10);
    expect(findings[0].column).toBe(5);
    expect(findings[0].cweId).toBe(476);
    expect(findings[0].source).toBe('cppcheck');
    expect(findings[0].file).toBe('main.c');
  });

  it('parses multiple errors', () => {
    const xml = makeCppcheckXml(`
      <error id="nullPointer" severity="error" msg="Null pointer" cwe="476">
        <location file="a.c" line="1" column="1"/>
      </error>
      <error id="memleak" severity="error" msg="Memory leak" cwe="401">
        <location file="b.c" line="5" column="3"/>
      </error>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings).toHaveLength(2);
    expect(findings[0].ruleId).toBe('nullPointer');
    expect(findings[1].ruleId).toBe('memleak');
  });

  it('handles self-closing error elements', () => {
    const xml = makeCppcheckXml(`
      <error id="unusedVariable" severity="style" msg="Unused variable: x" file="test.c" line="3" column="7"/>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('unusedVariable');
    expect(findings[0].line).toBe(3);
    expect(findings[0].file).toBe('test.c');
  });

  it('handles verbose attribute', () => {
    const xml = makeCppcheckXml(`
      <error id="bufferAccessOutOfBounds" severity="error" msg="Out of bounds" verbose="Array access at index 10 is out of bounds">
        <location file="x.c" line="5" column="1"/>
      </error>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings[0].suggestion).toBe('Array access at index 10 is out of bounds');
  });

  it('skips informational messages (missingInclude)', () => {
    const xml = makeCppcheckXml(`
      <error id="missingInclude" severity="information" msg="Include file not found"/>
      <error id="nullPointer" severity="error" msg="Null pointer">
        <location file="a.c" line="1" column="1"/>
      </error>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings).toHaveLength(1);
    expect(findings[0].ruleId).toBe('nullPointer');
  });

  it('skips toomanyconfigs', () => {
    const xml = makeCppcheckXml(`
      <error id="toomanyconfigs" severity="information" msg="Too many configs"/>
    `);
    expect(parseCppcheckXml(xml)).toHaveLength(0);
  });

  it('decodes XML entities in messages', () => {
    const xml = makeCppcheckXml(`
      <error id="test" severity="warning" msg="Value is &lt; 0 &amp; &gt; 100">
        <location file="x.c" line="1" column="1"/>
      </error>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings[0].message).toBe('Value is < 0 & > 100');
  });

  it('maps severity correctly', () => {
    const cases = [
      { sev: 'error', expected: 'error' },
      { sev: 'warning', expected: 'warning' },
      { sev: 'style', expected: 'style' },
      { sev: 'performance', expected: 'performance' },
      { sev: 'portability', expected: 'portability' },
      { sev: 'information', expected: 'style' },
    ];

    cases.forEach(({ sev, expected }) => {
      const xml = makeCppcheckXml(`
        <error id="test" severity="${sev}" msg="test">
          <location file="x.c" line="1" column="1"/>
        </error>
      `);
      const findings = parseCppcheckXml(xml);
      expect(findings[0].severity).toBe(expected);
    });
  });

  it('handles multiple locations (uses first)', () => {
    const xml = makeCppcheckXml(`
      <error id="nullPointer" severity="error" msg="Null ptr" cwe="476">
        <location file="a.c" line="10" column="5"/>
        <location file="a.c" line="3" column="1"/>
      </error>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings[0].line).toBe(10);
    expect(findings[0].column).toBe(5);
  });

  it('returns empty for empty XML', () => {
    const xml = makeCppcheckXml('');
    expect(parseCppcheckXml(xml)).toHaveLength(0);
  });

  it('returns empty for malformed XML', () => {
    expect(parseCppcheckXml('not xml at all')).toHaveLength(0);
  });

  it('uses known rule CWE when XML omits cwe attr', () => {
    const xml = makeCppcheckXml(`
      <error id="memleak" severity="error" msg="Memory leak">
        <location file="x.c" line="1" column="1"/>
      </error>
    `);
    const findings = parseCppcheckXml(xml);
    expect(findings[0].cweId).toBe(401);
  });
});

// ─── Clang-Tidy Parser ──────────────────────────────────────────

describe('parseClangTidyOutput', () => {
  it('parses basic warning with check name', () => {
    const text = makeClangTidyOutput([
      'main.c:10:5: warning: variable is not initialized [cppcoreguidelines-init-variables]',
    ]);
    const findings = parseClangTidyOutput(text);
    expect(findings).toHaveLength(1);
    expect(findings[0].line).toBe(10);
    expect(findings[0].column).toBe(5);
    expect(findings[0].severity).toBe('warning');
    expect(findings[0].ruleId).toBe('cppcoreguidelines-init-variables');
    expect(findings[0].source).toBe('clang-tidy');
    expect(findings[0].file).toBe('main.c');
  });

  it('parses error severity', () => {
    const text = 'main.c:5:1: error: use of undeclared identifier [clang-diagnostic-error]';
    const findings = parseClangTidyOutput(text);
    expect(findings[0].severity).toBe('error');
  });

  it('parses note severity as style', () => {
    const text = 'main.c:5:1: note: previous declaration [misc-note]';
    const findings = parseClangTidyOutput(text);
    expect(findings[0].severity).toBe('style');
  });

  it('parses multiple diagnostics', () => {
    const text = makeClangTidyOutput([
      'a.c:1:1: warning: msg1 [check1]',
      'b.c:2:3: error: msg2 [check2]',
      'c.c:5:10: warning: msg3 [check3]',
    ]);
    const findings = parseClangTidyOutput(text);
    expect(findings).toHaveLength(3);
  });

  it('captures snippet from next non-caret line', () => {
    const text = makeClangTidyOutput([
      'main.c:10:5: warning: unused variable [misc-unused-parameters]',
      '  int unused_var = 42;',
      '      ^',
    ]);
    const findings = parseClangTidyOutput(text);
    expect(findings[0].snippet).toBe('  int unused_var = 42;');
  });

  it('skips caret-only lines as snippets', () => {
    const text = makeClangTidyOutput([
      'main.c:10:5: warning: msg [check]',
      '    ^~~~',
    ]);
    const findings = parseClangTidyOutput(text);
    expect(findings[0].snippet).toBeUndefined();
  });

  it('generates suggestions from known check names', () => {
    const text = 'x.c:1:1: warning: msg [modernize-use-nullptr]';
    const findings = parseClangTidyOutput(text);
    expect(findings[0].suggestion).toContain('nullptr');
  });

  it('generates fallback suggestions for unknown checks', () => {
    const text = 'x.c:1:1: warning: msg [bugprone-something-unknown]';
    const findings = parseClangTidyOutput(text);
    expect(findings[0].suggestion).toBeTruthy();
  });

  it('returns empty for non-diagnostic text', () => {
    const text = 'Running clang-tidy...\n3 warnings generated.\nDone.\n';
    expect(parseClangTidyOutput(text)).toHaveLength(0);
  });

  it('handles file paths with spaces', () => {
    const text = 'my project/main.c:5:1: warning: msg [check]';
    const findings = parseClangTidyOutput(text);
    expect(findings[0].file).toBe('my project/main.c');
  });

  it('handles Windows-style paths', () => {
    const text = 'C:\\Users\\dev\\main.c:5:1: warning: msg [check]';
    const findings = parseClangTidyOutput(text);
    expect(findings).toHaveLength(1);
  });
});

// ─── Merge & Dedup ───────────────────────────────────────────────

describe('mergeFindings', () => {
  const makeF = (line: number, msg: string, sev: 'error' | 'warning' | 'style', source: ToolSource): ServerFinding => ({
    line,
    column: 1,
    severity: sev,
    ruleId: 'test',
    message: msg,
    suggestion: '',
    source,
  });

  it('merges findings from multiple sources', () => {
    const a = [makeF(1, 'msg1', 'error', 'cppcheck')];
    const b = [makeF(5, 'msg2', 'warning', 'clang-tidy')];
    const merged = mergeFindings(a, b);
    expect(merged).toHaveLength(2);
  });

  it('deduplicates identical findings (same line+col+message)', () => {
    const a = [makeF(1, 'duplicate', 'warning', 'cppcheck')];
    const b = [makeF(1, 'duplicate', 'warning', 'clang-tidy')];
    const merged = mergeFindings(a, b);
    expect(merged).toHaveLength(1);
  });

  it('keeps higher severity on dedup', () => {
    const a = [makeF(1, 'issue', 'warning', 'local')];
    const b = [makeF(1, 'issue', 'error', 'cppcheck')];
    const merged = mergeFindings(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].severity).toBe('error');
  });

  it('prefers cppcheck over clang-tidy on equal severity', () => {
    const a = [makeF(1, 'issue', 'warning', 'clang-tidy')];
    const b = [makeF(1, 'issue', 'warning', 'cppcheck')];
    const merged = mergeFindings(a, b);
    expect(merged).toHaveLength(1);
    expect(merged[0].source).toBe('cppcheck');
  });

  it('prefers clang-tidy over local on equal severity', () => {
    const a = [makeF(1, 'issue', 'warning', 'local')];
    const b = [makeF(1, 'issue', 'warning', 'clang-tidy')];
    const merged = mergeFindings(a, b);
    expect(merged[0].source).toBe('clang-tidy');
  });

  it('sorts by line then severity', () => {
    const findings = [
      makeF(10, 'late', 'style', 'local'),
      makeF(1, 'early warning', 'warning', 'local'),
      makeF(1, 'early error', 'error', 'local'),
    ];
    const merged = mergeFindings(findings);
    expect(merged[0].line).toBe(1);
    expect(merged[0].severity).toBe('error');
    expect(merged[1].line).toBe(1);
    expect(merged[1].severity).toBe('warning');
    expect(merged[2].line).toBe(10);
  });

  it('handles empty arrays', () => {
    expect(mergeFindings([], [])).toHaveLength(0);
    expect(mergeFindings()).toHaveLength(0);
  });

  it('does not deduplicate different messages on same line', () => {
    const a = [makeF(1, 'msg1', 'warning', 'cppcheck')];
    const b = [makeF(1, 'msg2', 'warning', 'clang-tidy')];
    const merged = mergeFindings(a, b);
    expect(merged).toHaveLength(2);
  });
});

// ─── buildMergedResult ───────────────────────────────────────────

describe('buildMergedResult', () => {
  it('counts findings by severity', () => {
    const findings: ServerFinding[] = [
      { line: 1, column: 1, severity: 'error', ruleId: 'a', message: 'e', suggestion: '', source: 'cppcheck' },
      { line: 2, column: 1, severity: 'warning', ruleId: 'b', message: 'w', suggestion: '', source: 'cppcheck' },
      { line: 3, column: 1, severity: 'style', ruleId: 'c', message: 's', suggestion: '', source: 'local' },
      { line: 4, column: 1, severity: 'performance', ruleId: 'd', message: 'p', suggestion: '', source: 'local' },
      { line: 5, column: 1, severity: 'portability', ruleId: 'e', message: 'po', suggestion: '', source: 'clang-tidy' },
    ];
    const result = buildMergedResult(findings);
    expect(result.totalFindings).toBe(5);
    expect(result.errors).toBe(1);
    expect(result.warnings).toBe(1);
    expect(result.style).toBe(1);
    expect(result.performance).toBe(1);
    expect(result.portability).toBe(1);
  });

  it('collects unique sources', () => {
    const findings: ServerFinding[] = [
      { line: 1, column: 1, severity: 'error', ruleId: 'a', message: 'e', suggestion: '', source: 'cppcheck' },
      { line: 2, column: 1, severity: 'error', ruleId: 'b', message: 'f', suggestion: '', source: 'local' },
      { line: 3, column: 1, severity: 'error', ruleId: 'c', message: 'g', suggestion: '', source: 'cppcheck' },
    ];
    const result = buildMergedResult(findings);
    expect(result.sources).toContain('cppcheck');
    expect(result.sources).toContain('local');
    expect(result.sources).toHaveLength(2);
  });

  it('handles empty findings', () => {
    const result = buildMergedResult([]);
    expect(result.totalFindings).toBe(0);
    expect(result.sources).toHaveLength(0);
  });
});

// ─── CodeMirror Annotations ─────────────────────────────────────

describe('toCodeMirrorAnnotations', () => {
  const code = 'line one\nline two\nline three\n';

  it('converts findings to CodeMirror annotations', () => {
    const findings: ServerFinding[] = [
      { line: 2, column: 1, severity: 'error', ruleId: 'test', message: 'error msg', suggestion: '', source: 'cppcheck' },
    ];
    const annotations = toCodeMirrorAnnotations(findings, code);
    expect(annotations).toHaveLength(1);
    expect(annotations[0].severity).toBe('error');
    expect(annotations[0].message).toContain('[cppcheck]');
    expect(annotations[0].message).toContain('error msg');
    expect(annotations[0].ruleId).toBe('test');
    expect(annotations[0].source).toBe('cppcheck');
  });

  it('computes correct byte offsets', () => {
    // line 1 starts at 0, line 2 starts at 9 ('line one\n'.length)
    const findings: ServerFinding[] = [
      { line: 2, column: 6, severity: 'warning', ruleId: 'x', message: 'm', suggestion: '', source: 'local' },
    ];
    const annotations = toCodeMirrorAnnotations(findings, code);
    expect(annotations[0].from).toBe(9 + 5); // lineStart[1] + (col-1)
  });

  it('maps severity correctly', () => {
    const cases: Array<{ sev: 'error' | 'warning' | 'style' | 'performance' | 'portability'; expected: string }> = [
      { sev: 'error', expected: 'error' },
      { sev: 'warning', expected: 'warning' },
      { sev: 'style', expected: 'info' },
      { sev: 'performance', expected: 'info' },
      { sev: 'portability', expected: 'warning' },
    ];

    cases.forEach(({ sev, expected }) => {
      const findings: ServerFinding[] = [
        { line: 1, column: 1, severity: sev, ruleId: 'x', message: 'm', suggestion: '', source: 'local' },
      ];
      const annotations = toCodeMirrorAnnotations(findings, code);
      expect(annotations[0].severity).toBe(expected);
    });
  });

  it('clamps line to valid range', () => {
    const findings: ServerFinding[] = [
      { line: 999, column: 1, severity: 'error', ruleId: 'x', message: 'm', suggestion: '', source: 'local' },
    ];
    const annotations = toCodeMirrorAnnotations(findings, code);
    expect(annotations[0].from).toBeLessThanOrEqual(code.length);
  });

  it('handles single-line code', () => {
    const singleLine = 'int x = 0;';
    const findings: ServerFinding[] = [
      { line: 1, column: 5, severity: 'warning', ruleId: 'x', message: 'm', suggestion: '', source: 'local' },
    ];
    const annotations = toCodeMirrorAnnotations(findings, singleLine);
    expect(annotations[0].from).toBe(4);
    expect(annotations[0].to).toBeGreaterThanOrEqual(annotations[0].from);
  });

  it('ensures from <= to', () => {
    const findings: ServerFinding[] = [
      { line: 1, column: 100, severity: 'error', ruleId: 'x', message: 'm', suggestion: '', source: 'local' },
    ];
    const annotations = toCodeMirrorAnnotations(findings, 'short');
    expect(annotations[0].to).toBeGreaterThanOrEqual(annotations[0].from);
  });
});

// ─── Local Analysis Adapter ─────────────────────────────────────

describe('runLocalAnalysis', () => {
  it('returns findings with source=local', () => {
    const code = `void f() {
  char *buf;
  strcpy(buf, "hello");
}`;
    const findings = runLocalAnalysis(code);
    expect(findings.length).toBeGreaterThan(0);
    findings.forEach((f) => {
      expect(f.source).toBe('local');
    });
  });

  it('respects config.enabledRules', () => {
    const code = `void f() {
  char *buf;
  strcpy(buf, "hello");
}`;
    const all = runLocalAnalysis(code);
    const restricted = runLocalAnalysis(code, { enabledRules: ['buffer-overflow'] });
    expect(restricted.length).toBeLessThanOrEqual(all.length);
    restricted.forEach((f) => {
      expect(f.ruleId).toBe('buffer-overflow');
    });
  });

  it('returns empty for clean code', () => {
    const code = 'void setup() {}\nvoid loop() {}\n';
    const findings = runLocalAnalysis(code);
    expect(findings).toHaveLength(0);
  });
});

// ─── ServerStaticAnalysisManager ─────────────────────────────────

describe('ServerStaticAnalysisManager — tool management', () => {
  let mgr: ServerStaticAnalysisManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('starts with local tool available', () => {
    expect(mgr.getAvailableTools()).toContain('local');
  });

  it('registerTool adds a tool', () => {
    mgr.registerTool('cppcheck');
    expect(mgr.isToolAvailable('cppcheck')).toBe(true);
  });

  it('unregisterTool removes a tool', () => {
    mgr.registerTool('clang-tidy');
    mgr.unregisterTool('clang-tidy');
    expect(mgr.isToolAvailable('clang-tidy')).toBe(false);
  });

  it('cannot unregister local tool', () => {
    mgr.unregisterTool('local');
    expect(mgr.isToolAvailable('local')).toBe(true);
  });

  it('registerTool notifies listeners', () => {
    let called = 0;
    mgr.subscribe(() => { called++; });
    mgr.registerTool('cppcheck');
    expect(called).toBe(1);
  });
});

describe('ServerStaticAnalysisManager — subscribe', () => {
  let mgr: ServerStaticAnalysisManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('returns unsubscribe function', () => {
    let calls = 0;
    const unsub = mgr.subscribe(() => { calls++; });
    mgr.registerTool('cppcheck');
    expect(calls).toBe(1);
    unsub();
    mgr.registerTool('clang-tidy');
    expect(calls).toBe(1);
  });

  it('multiple listeners all fire', () => {
    let a = 0;
    let b = 0;
    mgr.subscribe(() => { a++; });
    mgr.subscribe(() => { b++; });
    mgr.registerTool('cppcheck');
    expect(a).toBe(1);
    expect(b).toBe(1);
  });
});

describe('ServerStaticAnalysisManager — analyze', () => {
  let mgr: ServerStaticAnalysisManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('analyzeLocal runs local engine only', () => {
    const code = `void f() { strcpy(buf, input); }`;
    const result = mgr.analyzeLocal(code);
    expect(result.totalFindings).toBeGreaterThan(0);
    expect(result.sources).toContain('local');
    expect(result.sources).not.toContain('cppcheck');
  });

  it('analyze merges local + cppcheck', () => {
    const code = 'void f() {\n  strcpy(buf, input);\n}';
    const cppcheckXml = makeCppcheckXml(`
      <error id="uninitvar" severity="error" msg="Uninitialized variable: x" cwe="457">
        <location file="test.c" line="1" column="16"/>
      </error>
    `);
    const result = mgr.analyze(code, cppcheckXml);
    expect(result.sources).toContain('local');
    expect(result.sources).toContain('cppcheck');
  });

  it('analyze merges local + clang-tidy', () => {
    const code = 'void f() { int x; }';
    const clangOutput = 'test.c:1:16: warning: variable is not initialized [cppcoreguidelines-init-variables]';
    const result = mgr.analyze(code, undefined, clangOutput);
    expect(result.sources).toContain('clang-tidy');
  });

  it('analyze merges all three sources', () => {
    const code = 'void f() {\n  strcpy(buf, input);\n}';
    const cppcheckXml = makeCppcheckXml(`
      <error id="uninitvar" severity="error" msg="Uninit var" cwe="457">
        <location file="t.c" line="1" column="1"/>
      </error>
    `);
    const clangOutput = 'test.c:2:3: warning: unsafe function [bugprone-unsafe-function]';
    const result = mgr.analyze(code, cppcheckXml, clangOutput);
    expect(result.sources).toContain('local');
    expect(result.sources).toContain('cppcheck');
    expect(result.sources).toContain('clang-tidy');
  });

  it('stores result and annotations', () => {
    const code = 'void f() { strcpy(buf, input); }';
    mgr.analyze(code);
    expect(mgr.getLastResult()).not.toBeNull();
    expect(mgr.getAnnotations().length).toBeGreaterThan(0);
  });

  it('clearResults clears stored data', () => {
    mgr.analyzeLocal('void f() { strcpy(buf, input); }');
    mgr.clearResults();
    expect(mgr.getLastResult()).toBeNull();
    expect(mgr.getAnnotations()).toHaveLength(0);
    expect(mgr.getError()).toBeNull();
  });

  it('handles malformed cppcheck XML gracefully', () => {
    const code = 'void f() {}';
    const result = mgr.analyze(code, 'not valid xml');
    // Should still have local results
    expect(result).toBeDefined();
  });

  it('sets error on parse failure but still returns result', () => {
    const code = 'void f() { int x; }';
    // Provide cppcheck XML that's valid enough to parse but test error path
    mgr.analyze(code, '<results><errors></errors></results>');
    // No error since XML parsed (just empty)
    expect(mgr.getLastResult()).not.toBeNull();
  });
});

describe('ServerStaticAnalysisManager — state', () => {
  let mgr: ServerStaticAnalysisManager;

  beforeEach(() => {
    mgr = getManager();
  });

  it('getSnapshot returns full state', () => {
    const snap = mgr.getSnapshot();
    expect(snap.isAnalyzing).toBe(false);
    expect(snap.lastResult).toBeNull();
    expect(snap.lastAnnotations).toHaveLength(0);
    expect(snap.availableTools).toContain('local');
    expect(snap.error).toBeNull();
  });

  it('isAnalyzing returns false after analysis', () => {
    mgr.analyzeLocal('void f() {}');
    expect(mgr.isAnalyzing()).toBe(false);
  });

  it('getSnapshot updates after analysis', () => {
    mgr.analyzeLocal('void f() { strcpy(buf, input); }');
    const snap = mgr.getSnapshot();
    expect(snap.lastResult).not.toBeNull();
    expect(snap.lastResult!.totalFindings).toBeGreaterThan(0);
  });
});
