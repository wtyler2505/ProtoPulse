import { describe, it, expect } from 'vitest';
import {
  analyzeCode,
  stripComments,
  stripStrings,
  ANALYSIS_RULES,
  getRuleById,
  getRulesByCategory,
  getRuleCategories,
  getCheckerCount,
} from '../static-analysis';
import type { AnalysisFinding, Severity } from '../static-analysis';

// ──────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────

function findByRule(findings: AnalysisFinding[], ruleId: string): AnalysisFinding[] {
  return findings.filter((f) => f.ruleId === ruleId);
}

// ──────────────────────────────────────────────────────────────────
// stripComments
// ──────────────────────────────────────────────────────────────────

describe('stripComments', () => {
  it('removes single-line comments', () => {
    const lines = stripComments('int x = 5; // set x\nint y = 10;');
    expect(lines[0]).not.toContain('//');
    expect(lines[0]).not.toContain('set x');
    expect(lines[1]).toContain('int y = 10;');
  });

  it('removes multi-line comments', () => {
    const lines = stripComments('int x; /* comment\nspans lines */ int y;');
    expect(lines.join('\n')).not.toContain('comment');
    expect(lines.join('\n')).not.toContain('spans');
  });

  it('preserves line count', () => {
    const code = 'a\n/* b\nc\nd */\ne';
    const lines = stripComments(code);
    expect(lines).toHaveLength(5);
  });

  it('handles no comments', () => {
    const lines = stripComments('int x = 5;');
    expect(lines[0]).toContain('int x = 5;');
  });
});

// ──────────────────────────────────────────────────────────────────
// stripStrings
// ──────────────────────────────────────────────────────────────────

describe('stripStrings', () => {
  it('removes double-quoted strings', () => {
    expect(stripStrings('printf("hello world");')).toBe('printf("");');
  });

  it('removes single-quoted chars', () => {
    expect(stripStrings("char c = 'A';")).toBe("char c = '';");
  });

  it('handles escaped quotes', () => {
    expect(stripStrings('printf("he said \\"hi\\"");')).toBe('printf("");');
  });

  it('handles no strings', () => {
    expect(stripStrings('int x = 5;')).toBe('int x = 5;');
  });
});

// ──────────────────────────────────────────────────────────────────
// Rule Metadata
// ──────────────────────────────────────────────────────────────────

describe('ANALYSIS_RULES', () => {
  it('has at least 12 rules', () => {
    expect(ANALYSIS_RULES.length).toBeGreaterThanOrEqual(12);
  });

  it('all rules have required fields', () => {
    ANALYSIS_RULES.forEach((r) => {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(r.description).toBeTruthy();
      expect(r.severity).toBeTruthy();
      expect(r.category).toBeTruthy();
      expect(typeof r.enabled).toBe('boolean');
    });
  });

  it('most rules have CWE IDs', () => {
    const withCwe = ANALYSIS_RULES.filter((r) => r.cweId !== undefined);
    expect(withCwe.length).toBeGreaterThanOrEqual(10);
  });

  it('no duplicate rule IDs', () => {
    const ids = ANALYSIS_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getRuleById', () => {
  it('returns rule by id', () => {
    const rule = getRuleById('buffer-overflow');
    expect(rule).toBeDefined();
    expect(rule!.name).toBe('Buffer Overflow');
  });

  it('returns undefined for unknown id', () => {
    expect(getRuleById('nonexistent')).toBeUndefined();
  });
});

describe('getRulesByCategory', () => {
  it('filters by category', () => {
    const memRules = getRulesByCategory('memory');
    expect(memRules.length).toBeGreaterThanOrEqual(2);
    memRules.forEach((r) => {
      expect(r.category).toBe('memory');
    });
  });

  it('returns empty for unknown category', () => {
    expect(getRulesByCategory('nonexistent')).toHaveLength(0);
  });
});

describe('getRuleCategories', () => {
  it('returns all unique categories', () => {
    const cats = getRuleCategories();
    expect(cats).toContain('memory');
    expect(cats).toContain('correctness');
    expect(cats).toContain('security');
    expect(cats).toContain('maintainability');
  });
});

describe('getCheckerCount', () => {
  it('matches rule count', () => {
    expect(getCheckerCount()).toBe(ANALYSIS_RULES.length);
  });
});

// ──────────────────────────────────────────────────────────────────
// null-pointer-deref
// ──────────────────────────────────────────────────────────────────

describe('null-pointer-deref checker', () => {
  it('detects deref after malloc without null check', () => {
    const code = `
void func() {
    int* ptr = malloc(sizeof(int));
    ptr->value = 5;
}`;
    const result = analyzeCode(code, { enabledRules: ['null-pointer-deref'] });
    const hits = findByRule(result.findings, 'null-pointer-deref');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits[0].cweId).toBe(476);
  });

  it('does not flag when null check exists', () => {
    const code = `
void func() {
    int* ptr = malloc(sizeof(int));
    if (ptr == NULL) return;
    ptr->value = 5;
}`;
    const result = analyzeCode(code, { enabledRules: ['null-pointer-deref'] });
    expect(findByRule(result.findings, 'null-pointer-deref')).toHaveLength(0);
  });

  it('detects deref after fopen', () => {
    const code = `
void func() {
    FILE* f = fopen("data.txt", "r");
    f->_cnt = 0;
}`;
    const result = analyzeCode(code, { enabledRules: ['null-pointer-deref'] });
    expect(findByRule(result.findings, 'null-pointer-deref').length).toBeGreaterThanOrEqual(1);
  });
});

// ──────────────────────────────────────────────────────────────────
// buffer-overflow
// ──────────────────────────────────────────────────────────────────

describe('buffer-overflow checker', () => {
  it('detects strcpy', () => {
    const code = '    strcpy(dest, src);';
    const result = analyzeCode(code, { enabledRules: ['buffer-overflow'] });
    const hits = findByRule(result.findings, 'buffer-overflow');
    expect(hits).toHaveLength(1);
    expect(hits[0].suggestion).toContain('strncpy');
    expect(hits[0].cweId).toBe(120);
  });

  it('detects strcat', () => {
    const code = '    strcat(buf, extra);';
    const result = analyzeCode(code, { enabledRules: ['buffer-overflow'] });
    expect(findByRule(result.findings, 'buffer-overflow')).toHaveLength(1);
  });

  it('detects sprintf', () => {
    const code = '    sprintf(buf, "%d", num);';
    const result = analyzeCode(code, { enabledRules: ['buffer-overflow'] });
    expect(findByRule(result.findings, 'buffer-overflow')).toHaveLength(1);
  });

  it('detects gets', () => {
    const code = '    gets(buf);';
    const result = analyzeCode(code, { enabledRules: ['buffer-overflow'] });
    expect(findByRule(result.findings, 'buffer-overflow')).toHaveLength(1);
  });

  it('does not flag strncpy', () => {
    const code = '    strncpy(dest, src, sizeof(dest));';
    const result = analyzeCode(code, { enabledRules: ['buffer-overflow'] });
    expect(findByRule(result.findings, 'buffer-overflow')).toHaveLength(0);
  });

  it('does not flag inside comments', () => {
    const code = '    // strcpy(dest, src);';
    const result = analyzeCode(code, { enabledRules: ['buffer-overflow'] });
    expect(findByRule(result.findings, 'buffer-overflow')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// uninitialized-var
// ──────────────────────────────────────────────────────────────────

describe('uninitialized-var checker', () => {
  it('detects uninitialized local int', () => {
    const code = `
void func() {
    int x;
    printf("%d", x);
}`;
    const result = analyzeCode(code, { enabledRules: ['uninitialized-var'] });
    const hits = findByRule(result.findings, 'uninitialized-var');
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain('x');
  });

  it('detects uninitialized uint8_t', () => {
    const code = `
void func() {
    uint8_t val;
}`;
    const result = analyzeCode(code, { enabledRules: ['uninitialized-var'] });
    expect(findByRule(result.findings, 'uninitialized-var')).toHaveLength(1);
  });

  it('does not flag initialized variables', () => {
    const code = `
void func() {
    int x = 0;
    float y = 1.0;
}`;
    const result = analyzeCode(code, { enabledRules: ['uninitialized-var'] });
    expect(findByRule(result.findings, 'uninitialized-var')).toHaveLength(0);
  });

  it('does not flag global scope', () => {
    const code = 'int globalVar;';
    const result = analyzeCode(code, { enabledRules: ['uninitialized-var'] });
    expect(findByRule(result.findings, 'uninitialized-var')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// integer-overflow
// ──────────────────────────────────────────────────────────────────

describe('integer-overflow checker', () => {
  it('detects multiplication on narrow types', () => {
    const code = '    uint8_t result = a * b;';
    const result = analyzeCode(code, { enabledRules: ['integer-overflow'] });
    expect(findByRule(result.findings, 'integer-overflow')).toHaveLength(1);
  });

  it('detects addition on byte type', () => {
    const code = '    byte sum = x + y;';
    const result = analyzeCode(code, { enabledRules: ['integer-overflow'] });
    expect(findByRule(result.findings, 'integer-overflow')).toHaveLength(1);
  });

  it('detects large shift on 8-bit', () => {
    const code = '    uint8_t val = x << 8;';
    const result = analyzeCode(code, { enabledRules: ['integer-overflow'] });
    expect(findByRule(result.findings, 'integer-overflow')).toHaveLength(1);
  });

  it('does not flag small shift', () => {
    const code = '    uint8_t val = x << 2;';
    const result = analyzeCode(code, { enabledRules: ['integer-overflow'] });
    expect(findByRule(result.findings, 'integer-overflow')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// dead-code
// ──────────────────────────────────────────────────────────────────

describe('dead-code checker', () => {
  it('detects code after return', () => {
    const code = `
void func() {
    return;
    int x = 5;
}`;
    const result = analyzeCode(code, { enabledRules: ['dead-code'] });
    expect(findByRule(result.findings, 'dead-code')).toHaveLength(1);
  });

  it('detects code after break', () => {
    const code = `
void func() {
    while(1) {
        break;
        doStuff();
    }
}`;
    const result = analyzeCode(code, { enabledRules: ['dead-code'] });
    expect(findByRule(result.findings, 'dead-code')).toHaveLength(1);
  });

  it('does not flag code in new scope after return', () => {
    const code = `
void func() {
    return;
}
void other() {
    doStuff();
}`;
    const result = analyzeCode(code, { enabledRules: ['dead-code'] });
    expect(findByRule(result.findings, 'dead-code')).toHaveLength(0);
  });

  it('does not flag empty lines after return', () => {
    const code = `
void func() {
    return;

}`;
    const result = analyzeCode(code, { enabledRules: ['dead-code'] });
    expect(findByRule(result.findings, 'dead-code')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// resource-leak
// ──────────────────────────────────────────────────────────────────

describe('resource-leak checker', () => {
  it('detects malloc without free', () => {
    const code = `
void* func() {
    char* buf = malloc(256);
    buf[0] = 'a';
}`;
    const result = analyzeCode(code, { enabledRules: ['resource-leak'] });
    expect(findByRule(result.findings, 'resource-leak')).toHaveLength(1);
  });

  it('detects fopen without fclose', () => {
    const code = `
void readFile() {
    FILE* f = fopen("data.txt", "r");
    int c = fgetc(f);
}`;
    const result = analyzeCode(code, { enabledRules: ['resource-leak'] });
    expect(findByRule(result.findings, 'resource-leak')).toHaveLength(1);
  });

  it('does not flag when free is called', () => {
    const code = `
void func() {
    char* buf = malloc(256);
    free(buf);
}`;
    const result = analyzeCode(code, { enabledRules: ['resource-leak'] });
    expect(findByRule(result.findings, 'resource-leak')).toHaveLength(0);
  });

  it('does not flag when fclose is called', () => {
    const code = `
void func() {
    FILE* f = fopen("data.txt", "r");
    fclose(f);
}`;
    const result = analyzeCode(code, { enabledRules: ['resource-leak'] });
    expect(findByRule(result.findings, 'resource-leak')).toHaveLength(0);
  });

  it('does not flag when set to NULL', () => {
    const code = `
void func() {
    char* buf = malloc(256);
    buf = NULL;
}`;
    const result = analyzeCode(code, { enabledRules: ['resource-leak'] });
    expect(findByRule(result.findings, 'resource-leak')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// dangerous-function
// ──────────────────────────────────────────────────────────────────

describe('dangerous-function checker', () => {
  it('detects gets()', () => {
    const code = '    gets(buffer);';
    const result = analyzeCode(code, { enabledRules: ['dangerous-function'] });
    expect(findByRule(result.findings, 'dangerous-function')).toHaveLength(1);
  });

  it('detects atoi()', () => {
    const code = '    int x = atoi(str);';
    const result = analyzeCode(code, { enabledRules: ['dangerous-function'] });
    expect(findByRule(result.findings, 'dangerous-function')).toHaveLength(1);
  });

  it('detects system()', () => {
    const code = '    system("rm -rf /");';
    const result = analyzeCode(code, { enabledRules: ['dangerous-function'] });
    expect(findByRule(result.findings, 'dangerous-function')).toHaveLength(1);
  });

  it('detects scanf with %s', () => {
    const code = '    scanf("%s", buf);';
    const result = analyzeCode(code, { enabledRules: ['dangerous-function'] });
    expect(findByRule(result.findings, 'dangerous-function')).toHaveLength(1);
  });

  it('does not flag safe functions', () => {
    const code = '    fgets(buf, sizeof(buf), stdin);';
    const result = analyzeCode(code, { enabledRules: ['dangerous-function'] });
    expect(findByRule(result.findings, 'dangerous-function')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// unused-variable
// ──────────────────────────────────────────────────────────────────

describe('unused-variable checker', () => {
  it('detects unused local variable', () => {
    const code = `
void func() {
    int unusedXyzQwerty;
}`;
    const result = analyzeCode(code, { enabledRules: ['unused-variable'] });
    const hits = findByRule(result.findings, 'unused-variable');
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain('unusedXyzQwerty');
  });

  it('does not flag used variables', () => {
    const code = `
void func() {
    int used = 5;
    printf("%d", used);
    return used;
}`;
    const result = analyzeCode(code, { enabledRules: ['unused-variable'] });
    expect(findByRule(result.findings, 'unused-variable')).toHaveLength(0);
  });

  it('does not flag underscore-prefixed variables', () => {
    const code = `
void func() {
    int _intentionallyUnused;
}`;
    const result = analyzeCode(code, { enabledRules: ['unused-variable'] });
    expect(findByRule(result.findings, 'unused-variable')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// infinite-loop
// ──────────────────────────────────────────────────────────────────

describe('infinite-loop checker', () => {
  it('detects while(1) without break', () => {
    const code = `
void func() {
    while(1) {
        doWork();
    }
}`;
    const result = analyzeCode(code, { enabledRules: ['infinite-loop'] });
    expect(findByRule(result.findings, 'infinite-loop')).toHaveLength(1);
  });

  it('detects for(;;) without break', () => {
    const code = `
void func() {
    for(;;) {
        doWork();
    }
}`;
    const result = analyzeCode(code, { enabledRules: ['infinite-loop'] });
    expect(findByRule(result.findings, 'infinite-loop')).toHaveLength(1);
  });

  it('does not flag while(1) with break', () => {
    const code = `
void func() {
    while(1) {
        if (done) break;
        doWork();
    }
}`;
    const result = analyzeCode(code, { enabledRules: ['infinite-loop'] });
    expect(findByRule(result.findings, 'infinite-loop')).toHaveLength(0);
  });

  it('does not flag while(1) with return', () => {
    const code = `
void func() {
    while(true) {
        if (done) return;
        doWork();
    }
}`;
    const result = analyzeCode(code, { enabledRules: ['infinite-loop'] });
    expect(findByRule(result.findings, 'infinite-loop')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// magic-number
// ──────────────────────────────────────────────────────────────────

describe('magic-number checker', () => {
  it('detects magic numbers in expressions', () => {
    const code = '    delay(5000);';
    const result = analyzeCode(code, { enabledRules: ['magic-number'] });
    expect(findByRule(result.findings, 'magic-number')).toHaveLength(1);
  });

  it('does not flag 0, 1, 2, -1', () => {
    const code = `
    int x = 0;
    int y = 1;
    int z = 2;
    int w = -1;`;
    const result = analyzeCode(code, { enabledRules: ['magic-number'] });
    expect(findByRule(result.findings, 'magic-number')).toHaveLength(0);
  });

  it('does not flag preprocessor lines', () => {
    const code = '#define TIMEOUT 5000';
    const result = analyzeCode(code, { enabledRules: ['magic-number'] });
    expect(findByRule(result.findings, 'magic-number')).toHaveLength(0);
  });

  it('does not flag const definitions', () => {
    const code = '    const int TIMEOUT = 5000;';
    const result = analyzeCode(code, { enabledRules: ['magic-number'] });
    expect(findByRule(result.findings, 'magic-number')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// missing-volatile
// ──────────────────────────────────────────────────────────────────

describe('missing-volatile checker', () => {
  it('detects non-volatile variable modified in ISR', () => {
    const code = `
int counter;
ISR(TIMER1_COMPA_vect) {
    counter++;
}`;
    const result = analyzeCode(code, { enabledRules: ['missing-volatile'] });
    const hits = findByRule(result.findings, 'missing-volatile');
    expect(hits).toHaveLength(1);
    expect(hits[0].message).toContain('counter');
  });

  it('does not flag volatile variable', () => {
    const code = `
volatile int counter;
ISR(TIMER1_COMPA_vect) {
    counter++;
}`;
    const result = analyzeCode(code, { enabledRules: ['missing-volatile'] });
    expect(findByRule(result.findings, 'missing-volatile')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// double-free
// ──────────────────────────────────────────────────────────────────

describe('double-free checker', () => {
  it('detects double free', () => {
    const code = `
    char* buf = malloc(256);
    free(buf);
    free(buf);`;
    const result = analyzeCode(code, { enabledRules: ['double-free'] });
    const hits = findByRule(result.findings, 'double-free');
    expect(hits).toHaveLength(1);
    expect(hits[0].cweId).toBe(415);
  });

  it('does not flag if reassigned between frees', () => {
    const code = `
    char* buf = malloc(256);
    free(buf);
    buf = malloc(128);
    free(buf);`;
    const result = analyzeCode(code, { enabledRules: ['double-free'] });
    expect(findByRule(result.findings, 'double-free')).toHaveLength(0);
  });

  it('does not flag single free', () => {
    const code = `
    char* buf = malloc(256);
    free(buf);`;
    const result = analyzeCode(code, { enabledRules: ['double-free'] });
    expect(findByRule(result.findings, 'double-free')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// format-string
// ──────────────────────────────────────────────────────────────────

describe('format-string checker', () => {
  it('detects variable format string in printf', () => {
    const code = '    printf(userInput);';
    const result = analyzeCode(code, { enabledRules: ['format-string'] });
    const hits = findByRule(result.findings, 'format-string');
    expect(hits).toHaveLength(1);
    expect(hits[0].cweId).toBe(134);
  });

  it('does not flag literal format string', () => {
    const code = '    printf("value: %d", x);';
    const result = analyzeCode(code, { enabledRules: ['format-string'] });
    expect(findByRule(result.findings, 'format-string')).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────
// analyzeCode — integration
// ──────────────────────────────────────────────────────────────────

describe('analyzeCode', () => {
  it('runs all rules by default', () => {
    const code = `
void func() {
    char* buf = malloc(256);
    strcpy(buf, src);
    free(buf);
    free(buf);
}`;
    const result = analyzeCode(code);
    expect(result.rulesChecked).toBe(ANALYSIS_RULES.length);
    expect(result.totalFindings).toBeGreaterThan(0);
  });

  it('respects enabledRules config', () => {
    const code = '    strcpy(dest, src);';
    const result = analyzeCode(code, { enabledRules: ['buffer-overflow'] });
    expect(result.rulesChecked).toBe(1);
    expect(findByRule(result.findings, 'buffer-overflow')).toHaveLength(1);
  });

  it('respects disabledRules config', () => {
    const code = '    strcpy(dest, src);';
    const result = analyzeCode(code, { disabledRules: ['buffer-overflow'] });
    expect(findByRule(result.findings, 'buffer-overflow')).toHaveLength(0);
  });

  it('respects minSeverity config', () => {
    const code = `
void func() {
    int x;
    strcpy(dest, src);
    delay(5000);
}`;
    const result = analyzeCode(code, { minSeverity: 'error' });
    result.findings.forEach((f) => {
      expect(f.severity).toBe('error');
    });
  });

  it('sorts findings by line then severity', () => {
    const code = `
void func() {
    strcpy(dest, src);
    int y;
    gets(buf);
}`;
    const result = analyzeCode(code);
    for (let i = 1; i < result.findings.length; i++) {
      const prev = result.findings[i - 1];
      const curr = result.findings[i];
      if (prev.line === curr.line) {
        // error < warning < style ordering
        expect(severityOrder(prev.severity)).toBeLessThanOrEqual(severityOrder(curr.severity));
      } else {
        expect(prev.line).toBeLessThanOrEqual(curr.line);
      }
    }
  });

  it('counts severity breakdown correctly', () => {
    const code = `
void func() {
    strcpy(dest, src);
    int x;
}`;
    const result = analyzeCode(code);
    const manualErrors = result.findings.filter((f) => f.severity === 'error').length;
    const manualWarnings = result.findings.filter((f) => f.severity === 'warning').length;
    const manualStyle = result.findings.filter((f) => f.severity === 'style').length;
    expect(result.errors).toBe(manualErrors);
    expect(result.warnings).toBe(manualWarnings);
    expect(result.style).toBe(manualStyle);
    expect(result.totalFindings).toBe(result.errors + result.warnings + result.style + result.performance + result.portability);
  });

  it('reports linesAnalyzed', () => {
    const code = 'line1\nline2\nline3';
    const result = analyzeCode(code);
    expect(result.linesAnalyzed).toBe(3);
  });

  it('handles empty code', () => {
    const result = analyzeCode('');
    expect(result.totalFindings).toBe(0);
    expect(result.linesAnalyzed).toBe(1); // empty string splits to ['']
  });

  it('does not flag preprocessor directives', () => {
    const code = '#include <stdio.h>\n#define MAX 100';
    const result = analyzeCode(code);
    expect(findByRule(result.findings, 'magic-number')).toHaveLength(0);
  });

  it('handles code with only comments', () => {
    const code = '// this is a comment\n/* block comment */';
    const result = analyzeCode(code);
    expect(result.totalFindings).toBe(0);
  });
});

// helper
function severityOrder(sev: Severity): number {
  const order: Record<Severity, number> = { error: 0, warning: 1, performance: 2, portability: 3, style: 4 };
  return order[sev] ?? 5;
}
