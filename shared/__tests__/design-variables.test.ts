import { describe, it, expect, beforeEach } from 'vitest';
import {
  evaluateExpression,
  getExpressionDependencies,
  parseSINumber,
  VariableStore,
  DesignVariableError,
  UndefinedVariableError,
  CircularDependencyError,
  DivisionByZeroError,
  ExpressionSyntaxError,
  InvalidExpressionError,
} from '../design-variables';

// =============================================================================
// parseSINumber
// =============================================================================

describe('parseSINumber', () => {
  it('parses plain integers', () => {
    expect(parseSINumber('42')).toBe(42);
  });

  it('parses plain decimals', () => {
    expect(parseSINumber('3.3')).toBe(3.3);
  });

  it('parses kilo prefix', () => {
    expect(parseSINumber('10k')).toBe(10000);
  });

  it('parses micro prefix (u)', () => {
    expect(parseSINumber('4.7u')).toBeCloseTo(4.7e-6);
  });

  it('parses micro prefix (µ U+00B5)', () => {
    expect(parseSINumber('4.7\u00B5')).toBeCloseTo(4.7e-6);
  });

  it('parses nano prefix', () => {
    expect(parseSINumber('100n')).toBeCloseTo(1e-7);
  });

  it('parses mega prefix', () => {
    expect(parseSINumber('2.2M')).toBe(2.2e6);
  });

  it('parses giga prefix', () => {
    expect(parseSINumber('1G')).toBe(1e9);
  });

  it('parses pico prefix', () => {
    expect(parseSINumber('1p')).toBeCloseTo(1e-12);
  });

  it('parses milli prefix', () => {
    expect(parseSINumber('500m')).toBeCloseTo(0.5);
  });

  it('parses tera prefix', () => {
    expect(parseSINumber('1T')).toBe(1e12);
  });

  it('returns NaN for empty string', () => {
    expect(parseSINumber('')).toBeNaN();
  });

  it('handles whitespace', () => {
    expect(parseSINumber('  10k  ')).toBe(10000);
  });
});

// =============================================================================
// evaluateExpression — arithmetic
// =============================================================================

describe('evaluateExpression — arithmetic', () => {
  it('evaluates literal numbers', () => {
    expect(evaluateExpression('3.3')).toBe(3.3);
    expect(evaluateExpression('42')).toBe(42);
  });

  it('evaluates addition', () => {
    expect(evaluateExpression('3 + 4')).toBe(7);
  });

  it('evaluates subtraction', () => {
    expect(evaluateExpression('10 - 3')).toBe(7);
  });

  it('evaluates multiplication', () => {
    expect(evaluateExpression('10 * 2')).toBe(20);
  });

  it('evaluates division', () => {
    expect(evaluateExpression('100 / 4')).toBe(25);
  });

  it('evaluates modulo', () => {
    expect(evaluateExpression('10 % 3')).toBe(1);
  });

  it('evaluates power', () => {
    expect(evaluateExpression('2^10')).toBe(1024);
  });

  it('respects operator precedence (* before +)', () => {
    expect(evaluateExpression('2 + 3 * 4')).toBe(14);
  });

  it('respects parenthesized grouping', () => {
    expect(evaluateExpression('(2 + 3) * 4')).toBe(20);
  });

  it('handles nested parentheses', () => {
    expect(evaluateExpression('((2 + 3) * (4 - 1))')).toBe(15);
  });

  it('handles negative numbers', () => {
    expect(evaluateExpression('-5')).toBe(-5);
  });

  it('handles negated groups', () => {
    expect(evaluateExpression('-(3 + 2)')).toBe(-5);
  });

  it('handles unary plus', () => {
    expect(evaluateExpression('+5')).toBe(5);
  });

  it('handles whitespace gracefully', () => {
    expect(evaluateExpression('  3  +  4  ')).toBe(7);
  });

  it('handles right-associative exponentiation', () => {
    // 2^3^2 = 2^(3^2) = 2^9 = 512
    expect(evaluateExpression('2^3^2')).toBe(512);
  });

  it('handles complex mixed expression', () => {
    // (10 + 2) * 3 - 4 / 2 = 36 - 2 = 34
    expect(evaluateExpression('(10 + 2) * 3 - 4 / 2')).toBe(34);
  });

  it('handles SI-prefixed numbers in expressions', () => {
    expect(evaluateExpression('10k * 2')).toBe(20000);
  });

  it('handles decimal division result', () => {
    expect(evaluateExpression('100 / 3')).toBeCloseTo(33.333333, 4);
  });
});

// =============================================================================
// evaluateExpression — functions
// =============================================================================

describe('evaluateExpression — functions', () => {
  it('evaluates sqrt', () => {
    expect(evaluateExpression('sqrt(9)')).toBe(3);
  });

  it('evaluates abs', () => {
    expect(evaluateExpression('abs(-5)')).toBe(5);
  });

  it('evaluates min', () => {
    expect(evaluateExpression('min(3, 7)')).toBe(3);
  });

  it('evaluates max', () => {
    expect(evaluateExpression('max(3, 7)')).toBe(7);
  });

  it('evaluates log (natural log)', () => {
    expect(evaluateExpression('log(1)')).toBe(0);
  });

  it('evaluates log10', () => {
    expect(evaluateExpression('log10(1000)')).toBeCloseTo(3);
  });

  it('evaluates exp', () => {
    expect(evaluateExpression('exp(0)')).toBe(1);
  });

  it('evaluates sin', () => {
    expect(evaluateExpression('sin(0)')).toBe(0);
  });

  it('evaluates cos', () => {
    expect(evaluateExpression('cos(0)')).toBe(1);
  });

  it('evaluates tan', () => {
    expect(evaluateExpression('tan(0)')).toBe(0);
  });

  it('evaluates nested function calls', () => {
    expect(evaluateExpression('sqrt(abs(-16))')).toBe(4);
  });

  it('evaluates pow function', () => {
    expect(evaluateExpression('pow(2, 8)')).toBe(256);
  });

  it('evaluates floor', () => {
    expect(evaluateExpression('floor(3.7)')).toBe(3);
  });

  it('evaluates ceil', () => {
    expect(evaluateExpression('ceil(3.2)')).toBe(4);
  });

  it('evaluates round', () => {
    expect(evaluateExpression('round(3.5)')).toBe(4);
  });
});

// =============================================================================
// evaluateExpression — constants
// =============================================================================

describe('evaluateExpression — constants', () => {
  it('evaluates pi', () => {
    expect(evaluateExpression('pi')).toBeCloseTo(Math.PI);
  });

  it('evaluates e', () => {
    expect(evaluateExpression('e')).toBeCloseTo(Math.E);
  });

  it('evaluates pi in expression', () => {
    // Circumference of unit circle
    expect(evaluateExpression('2 * pi')).toBeCloseTo(2 * Math.PI);
  });
});

// =============================================================================
// evaluateExpression — variables
// =============================================================================

describe('evaluateExpression — variables', () => {
  it('resolves a simple variable', () => {
    const vars = new Map([['VOUT', 3.3]]);
    expect(evaluateExpression('VOUT', vars)).toBe(3.3);
  });

  it('resolves a variable in expression', () => {
    const vars = new Map([['VOUT', 3.3]]);
    expect(evaluateExpression('VOUT * 2', vars)).toBe(6.6);
  });

  it('resolves multiple variables', () => {
    const vars = new Map([
      ['R1', 1000],
      ['R2', 2000],
      ['VOUT', 5],
    ]);
    expect(evaluateExpression('(R1 + R2) / R1 * VOUT', vars)).toBe(15);
  });

  it('resolves underscore-named variables', () => {
    const vars = new Map([['R_LOAD', 100]]);
    expect(evaluateExpression('R_LOAD * 2', vars)).toBe(200);
  });
});

// =============================================================================
// evaluateExpression — error handling
// =============================================================================

describe('evaluateExpression — error handling', () => {
  it('throws UndefinedVariableError for unknown variable', () => {
    expect(() => evaluateExpression('UNKNOWN')).toThrow(UndefinedVariableError);
    try {
      evaluateExpression('UNKNOWN');
    } catch (err) {
      expect(err).toBeInstanceOf(UndefinedVariableError);
      expect((err as UndefinedVariableError).variableName).toBe('UNKNOWN');
    }
  });

  it('throws DivisionByZeroError', () => {
    expect(() => evaluateExpression('10 / 0')).toThrow(DivisionByZeroError);
  });

  it('throws DivisionByZeroError for modulo by zero', () => {
    expect(() => evaluateExpression('10 % 0')).toThrow(DivisionByZeroError);
  });

  it('throws ExpressionSyntaxError for trailing operator', () => {
    expect(() => evaluateExpression('3 +')).toThrow(ExpressionSyntaxError);
  });

  it('throws InvalidExpressionError for empty expression', () => {
    expect(() => evaluateExpression('')).toThrow(InvalidExpressionError);
  });

  it('throws InvalidExpressionError for whitespace-only expression', () => {
    expect(() => evaluateExpression('   ')).toThrow(InvalidExpressionError);
  });

  it('throws ExpressionSyntaxError for unmatched parenthesis', () => {
    expect(() => evaluateExpression('(3 + 4')).toThrow(ExpressionSyntaxError);
  });

  it('throws InvalidExpressionError for unknown function', () => {
    expect(() => evaluateExpression('foobar(3)')).toThrow(InvalidExpressionError);
  });

  it('throws InvalidExpressionError for wrong argument count', () => {
    expect(() => evaluateExpression('sqrt(1, 2)')).toThrow(InvalidExpressionError);
    expect(() => evaluateExpression('min(1)')).toThrow(InvalidExpressionError);
  });

  it('all errors extend DesignVariableError', () => {
    try {
      evaluateExpression('UNKNOWN');
    } catch (err) {
      expect(err).toBeInstanceOf(DesignVariableError);
    }
    try {
      evaluateExpression('10 / 0');
    } catch (err) {
      expect(err).toBeInstanceOf(DesignVariableError);
    }
    try {
      evaluateExpression('');
    } catch (err) {
      expect(err).toBeInstanceOf(DesignVariableError);
    }
  });

  it('throws ExpressionSyntaxError for unexpected character', () => {
    expect(() => evaluateExpression('3 & 4')).toThrow(ExpressionSyntaxError);
  });
});

// =============================================================================
// getExpressionDependencies
// =============================================================================

describe('getExpressionDependencies', () => {
  it('returns empty array for literal expression', () => {
    expect(getExpressionDependencies('3.3')).toEqual([]);
  });

  it('returns variable names', () => {
    const deps = getExpressionDependencies('VOUT * 2');
    expect(deps).toEqual(['VOUT']);
  });

  it('returns multiple variable names', () => {
    const deps = getExpressionDependencies('R1 + R2');
    expect(deps).toContain('R1');
    expect(deps).toContain('R2');
    expect(deps).toHaveLength(2);
  });

  it('excludes built-in constants', () => {
    const deps = getExpressionDependencies('pi * R');
    expect(deps).toEqual(['R']);
  });

  it('returns empty array for empty expression', () => {
    expect(getExpressionDependencies('')).toEqual([]);
  });
});

// =============================================================================
// VariableStore — basic operations
// =============================================================================

describe('VariableStore — basic operations', () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
  });

  it('starts empty', () => {
    expect(store.size).toBe(0);
    expect(store.names()).toEqual([]);
  });

  it('adds a variable', () => {
    store.addVariable({ name: 'VOUT', value: '3.3' });
    expect(store.size).toBe(1);
    expect(store.get('VOUT')?.value).toBe('3.3');
  });

  it('updates an existing variable', () => {
    store.addVariable({ name: 'VOUT', value: '3.3' });
    store.addVariable({ name: 'VOUT', value: '5.0' });
    expect(store.size).toBe(1);
    expect(store.get('VOUT')?.value).toBe('5.0');
  });

  it('removes a variable', () => {
    store.addVariable({ name: 'VOUT', value: '3.3' });
    const removed = store.removeVariable('VOUT');
    expect(removed).toBe(true);
    expect(store.size).toBe(0);
  });

  it('returns false when removing nonexistent variable', () => {
    expect(store.removeVariable('NOPE')).toBe(false);
  });

  it('lists all variable names', () => {
    store.addVariable({ name: 'A', value: '1' });
    store.addVariable({ name: 'B', value: '2' });
    store.addVariable({ name: 'C', value: '3' });
    expect(store.names()).toEqual(['A', 'B', 'C']);
  });

  it('returns all variables', () => {
    store.addVariable({ name: 'VOUT', value: '3.3', unit: 'V' });
    const all = store.all();
    expect(all).toHaveLength(1);
    expect(all[0].name).toBe('VOUT');
    expect(all[0].unit).toBe('V');
  });
});

// =============================================================================
// VariableStore — resolution
// =============================================================================

describe('VariableStore — resolution', () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
  });

  it('resolves a literal value', () => {
    store.addVariable({ name: 'VOUT', value: '3.3' });
    expect(store.resolve('VOUT')).toBe(3.3);
  });

  it('resolves an SI-prefixed literal', () => {
    store.addVariable({ name: 'R1', value: '10k' });
    expect(store.resolve('R1')).toBe(10000);
  });

  it('resolves an expression referencing another variable', () => {
    store.addVariable({ name: 'VOUT', value: '3.3' });
    store.addVariable({ name: 'R1', value: 'VOUT / 0.02' });
    expect(store.resolve('R1')).toBe(165);
  });

  it('resolves a chain of dependencies', () => {
    store.addVariable({ name: 'A', value: '10' });
    store.addVariable({ name: 'B', value: 'A * 2' });
    store.addVariable({ name: 'C', value: 'B + 5' });
    expect(store.resolve('C')).toBe(25);
  });

  it('resolves SI-prefixed variable in expression', () => {
    store.addVariable({ name: 'R1', value: '10k' });
    store.addVariable({ name: 'DOUBLE_R', value: 'R1 * 2' });
    expect(store.resolve('DOUBLE_R')).toBe(20000);
  });

  it('throws UndefinedVariableError for unknown variable', () => {
    expect(() => store.resolve('MISSING')).toThrow(UndefinedVariableError);
  });

  it('populates resolved field after resolution', () => {
    store.addVariable({ name: 'VOUT', value: '3.3' });
    store.resolve('VOUT');
    expect(store.get('VOUT')?.resolved).toBe(3.3);
  });

  it('resolveAll resolves all variables in topological order', () => {
    store.addVariable({ name: 'A', value: '10' });
    store.addVariable({ name: 'B', value: 'A * 2' });
    store.addVariable({ name: 'C', value: 'B + A' });
    const { resolved, errors } = store.resolveAll();
    expect(errors).toHaveLength(0);
    expect(resolved.get('A')).toBe(10);
    expect(resolved.get('B')).toBe(20);
    expect(resolved.get('C')).toBe(30);
  });

  it('resolveAll reports errors for invalid variables', () => {
    store.addVariable({ name: 'GOOD', value: '42' });
    store.addVariable({ name: 'BAD', value: '' });
    const { resolved, errors } = store.resolveAll();
    expect(resolved.get('GOOD')).toBe(42);
    expect(errors).toHaveLength(1);
    expect(errors[0].variableName).toBe('BAD');
  });

  it('reassigning a variable updates dependents', () => {
    store.addVariable({ name: 'V', value: '5' });
    store.addVariable({ name: 'R', value: 'V * 10' });
    expect(store.resolve('R')).toBe(50);

    // Reassign V
    store.addVariable({ name: 'V', value: '3.3' });
    expect(store.resolve('R')).toBe(33);
  });
});

// =============================================================================
// VariableStore — dependency graph
// =============================================================================

describe('VariableStore — dependency graph', () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
  });

  it('returns empty dependencies for a literal', () => {
    store.addVariable({ name: 'V', value: '3.3' });
    expect(store.getDependencies('V')).toEqual([]);
  });

  it('returns correct dependencies for an expression', () => {
    store.addVariable({ name: 'V', value: '3.3' });
    store.addVariable({ name: 'R', value: 'V / 0.02' });
    expect(store.getDependencies('R')).toEqual(['V']);
  });

  it('returns empty for nonexistent variable', () => {
    expect(store.getDependencies('NOPE')).toEqual([]);
  });

  it('builds complete dependency graph', () => {
    store.addVariable({ name: 'A', value: '1' });
    store.addVariable({ name: 'B', value: 'A + 1' });
    store.addVariable({ name: 'C', value: 'A + B' });

    const graph = store.getDependencyGraph();
    expect(graph.get('A')).toEqual([]);
    expect(graph.get('B')).toEqual(['A']);
    const cDeps = graph.get('C');
    expect(cDeps).toContain('A');
    expect(cDeps).toContain('B');
  });
});

// =============================================================================
// VariableStore — circular dependency detection
// =============================================================================

describe('VariableStore — circular dependency detection', () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
  });

  it('returns null when there are no circular dependencies', () => {
    store.addVariable({ name: 'A', value: '1' });
    store.addVariable({ name: 'B', value: 'A + 1' });
    expect(store.detectCircularDependencies()).toBeNull();
  });

  it('detects mutual circular dependency', () => {
    store.addVariable({ name: 'A', value: 'B + 1' });
    store.addVariable({ name: 'B', value: 'A + 1' });
    const cycles = store.detectCircularDependencies();
    expect(cycles).not.toBeNull();
    expect(cycles!.length).toBeGreaterThan(0);
  });

  it('detects self-reference', () => {
    store.addVariable({ name: 'A', value: 'A + 1' });
    const cycles = store.detectCircularDependencies();
    expect(cycles).not.toBeNull();
  });

  it('throws CircularDependencyError on resolve of circular variable', () => {
    store.addVariable({ name: 'A', value: 'B + 1' });
    store.addVariable({ name: 'B', value: 'A + 1' });
    expect(() => store.resolve('A')).toThrow(CircularDependencyError);
  });

  it('detects 3-node cycle', () => {
    store.addVariable({ name: 'A', value: 'C + 1' });
    store.addVariable({ name: 'B', value: 'A + 1' });
    store.addVariable({ name: 'C', value: 'B + 1' });
    const cycles = store.detectCircularDependencies();
    expect(cycles).not.toBeNull();
  });
});

// =============================================================================
// VariableStore — validation
// =============================================================================

describe('VariableStore — validation', () => {
  let store: VariableStore;

  beforeEach(() => {
    store = new VariableStore();
  });

  it('returns empty array for valid store', () => {
    store.addVariable({ name: 'V', value: '3.3' });
    store.addVariable({ name: 'R', value: 'V * 100' });
    expect(store.validate()).toEqual([]);
  });

  it('reports circular dependency errors', () => {
    store.addVariable({ name: 'A', value: 'B + 1' });
    store.addVariable({ name: 'B', value: 'A + 1' });
    const results = store.validate();
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].error).toBeInstanceOf(CircularDependencyError);
  });

  it('reports undefined variable reference errors', () => {
    store.addVariable({ name: 'R', value: 'MISSING * 2' });
    const results = store.validate();
    expect(results).toHaveLength(1);
    expect(results[0].variableName).toBe('R');
    expect(results[0].error).toBeInstanceOf(UndefinedVariableError);
  });
});

// =============================================================================
// Edge cases
// =============================================================================

describe('edge cases', () => {
  it('variables are case-sensitive', () => {
    const vars = new Map([
      ['vout', 3.3],
      ['VOUT', 5.0],
    ]);
    expect(evaluateExpression('vout', vars)).toBe(3.3);
    expect(evaluateExpression('VOUT', vars)).toBe(5.0);
  });

  it('handles very large numbers (giga)', () => {
    expect(parseSINumber('1G')).toBe(1e9);
  });

  it('handles very small numbers (pico)', () => {
    expect(parseSINumber('1p')).toBeCloseTo(1e-12);
  });

  it('handles expression with only a function call', () => {
    expect(evaluateExpression('sqrt(144)')).toBe(12);
  });

  it('handles double negation', () => {
    expect(evaluateExpression('--5')).toBe(5);
  });

  it('handles expression with function and arithmetic', () => {
    expect(evaluateExpression('sqrt(16) + 3')).toBe(7);
  });

  it('handles multiple SI-prefixed values in one expression', () => {
    // 10k + 4.7k = 14700
    expect(evaluateExpression('10k + 4.7k')).toBeCloseTo(14700);
  });

  it('handles min with many arguments', () => {
    expect(evaluateExpression('min(5, 3, 8, 1, 9)')).toBe(1);
  });

  it('handles max with many arguments', () => {
    expect(evaluateExpression('max(5, 3, 8, 1, 9)')).toBe(9);
  });
});
