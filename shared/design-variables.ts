/**
 * Design parameterization / variable expression engine (CAPX-FFI-17).
 *
 * Provides a named-variable system with expression evaluation, SI prefix
 * parsing, dependency tracking, and circular dependency detection.
 * Pure TypeScript — no external math parser libraries.
 */

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

/** Base error class for all design variable errors. */
export class DesignVariableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DesignVariableError';
  }
}

export class UndefinedVariableError extends DesignVariableError {
  readonly variableName: string;
  constructor(variableName: string) {
    super(`Undefined variable: '${variableName}'`);
    this.name = 'UndefinedVariableError';
    this.variableName = variableName;
  }
}

export class CircularDependencyError extends DesignVariableError {
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' → ')}`);
    this.name = 'CircularDependencyError';
    this.cycle = cycle;
  }
}

export class DivisionByZeroError extends DesignVariableError {
  constructor() {
    super('Division by zero');
    this.name = 'DivisionByZeroError';
  }
}

export class ExpressionSyntaxError extends DesignVariableError {
  readonly position: number;
  constructor(message: string, position: number) {
    super(`Syntax error at position ${String(position)}: ${message}`);
    this.name = 'ExpressionSyntaxError';
    this.position = position;
  }
}

export class InvalidExpressionError extends DesignVariableError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidExpressionError';
  }
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

enum TokenType {
  Number = 'Number',
  Identifier = 'Identifier',
  Plus = 'Plus',
  Minus = 'Minus',
  Star = 'Star',
  Slash = 'Slash',
  Caret = 'Caret',
  Percent = 'Percent',
  LParen = 'LParen',
  RParen = 'RParen',
  Comma = 'Comma',
  EOF = 'EOF',
}

interface Token {
  type: TokenType;
  value: string;
  position: number;
}

// ---------------------------------------------------------------------------
// SI prefix map
// ---------------------------------------------------------------------------

const SI_PREFIX_MAP: ReadonlyMap<string, number> = new Map([
  ['p', 1e-12],
  ['n', 1e-9],
  ['u', 1e-6],
  ['\u00B5', 1e-6], // µ (U+00B5 micro sign)
  ['\u03BC', 1e-6], // μ (U+03BC Greek small letter mu)
  ['m', 1e-3],
  ['k', 1e3],
  ['K', 1e3],
  ['M', 1e6],
  ['G', 1e9],
  ['T', 1e12],
]);

/**
 * Parse a number string that may end with an SI prefix.
 * Returns the numeric value with prefix applied, or NaN if unparseable.
 *
 * Examples: "10k" → 10000, "4.7u" → 4.7e-6, "100n" → 1e-7, "3.3" → 3.3
 */
export function parseSINumber(raw: string): number {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return NaN;
  }

  // Check if last character is an SI prefix
  const lastChar = trimmed[trimmed.length - 1];
  const multiplier = SI_PREFIX_MAP.get(lastChar);

  if (multiplier !== undefined) {
    const numPart = trimmed.slice(0, -1);
    const num = Number(numPart);
    if (Number.isNaN(num) || numPart.length === 0) {
      return NaN;
    }
    return num * multiplier;
  }

  return Number(trimmed);
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < expression.length) {
    const ch = expression[i];

    // Skip whitespace
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r') {
      i++;
      continue;
    }

    // Single-character operators and punctuation
    if (ch === '+') { tokens.push({ type: TokenType.Plus, value: '+', position: i }); i++; continue; }
    if (ch === '-') { tokens.push({ type: TokenType.Minus, value: '-', position: i }); i++; continue; }
    if (ch === '*') { tokens.push({ type: TokenType.Star, value: '*', position: i }); i++; continue; }
    if (ch === '/') { tokens.push({ type: TokenType.Slash, value: '/', position: i }); i++; continue; }
    if (ch === '^') { tokens.push({ type: TokenType.Caret, value: '^', position: i }); i++; continue; }
    if (ch === '%') { tokens.push({ type: TokenType.Percent, value: '%', position: i }); i++; continue; }
    if (ch === '(') { tokens.push({ type: TokenType.LParen, value: '(', position: i }); i++; continue; }
    if (ch === ')') { tokens.push({ type: TokenType.RParen, value: ')', position: i }); i++; continue; }
    if (ch === ',') { tokens.push({ type: TokenType.Comma, value: ',', position: i }); i++; continue; }

    // Number: digit or decimal point followed by digit
    if (isDigitChar(ch) || (ch === '.' && i + 1 < expression.length && isDigitChar(expression[i + 1]))) {
      const start = i;
      // Consume integer part
      while (i < expression.length && isDigitChar(expression[i])) {
        i++;
      }
      // Consume decimal part
      if (i < expression.length && expression[i] === '.') {
        i++;
        while (i < expression.length && isDigitChar(expression[i])) {
          i++;
        }
      }
      // Consume optional SI prefix (single character that is NOT an identifier-start leading to more chars)
      const numStr = expression.slice(start, i);
      if (i < expression.length) {
        const nextCh = expression[i];
        const hasPrefix = SI_PREFIX_MAP.has(nextCh);
        // An SI prefix is consumed only if it is NOT followed by another identifier character
        // This prevents "10kohm" from being tokenized as number "10k" + "ohm"
        // But "10k" alone, or "10k * 2", "10k)" etc. should work
        if (hasPrefix && (i + 1 >= expression.length || !isIdentChar(expression[i + 1]))) {
          const prefixedStr = numStr + nextCh;
          const value = parseSINumber(prefixedStr);
          tokens.push({ type: TokenType.Number, value: String(value), position: start });
          i++;
          continue;
        }
      }
      tokens.push({ type: TokenType.Number, value: numStr, position: start });
      continue;
    }

    // Identifier: starts with letter or underscore
    if (isIdentStartChar(ch)) {
      const start = i;
      while (i < expression.length && isIdentChar(expression[i])) {
        i++;
      }
      tokens.push({ type: TokenType.Identifier, value: expression.slice(start, i), position: start });
      continue;
    }

    // Unicode mu prefix for numbers like "4.7µ" — handle standalone µ/μ
    if (ch === '\u00B5' || ch === '\u03BC') {
      // This would be part of a number that was already consumed, but handle edge case
      tokens.push({ type: TokenType.Identifier, value: ch, position: i });
      i++;
      continue;
    }

    throw new ExpressionSyntaxError(`Unexpected character: '${ch}'`, i);
  }

  tokens.push({ type: TokenType.EOF, value: '', position: i });
  return tokens;
}

function isDigitChar(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isIdentStartChar(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_';
}

function isIdentChar(ch: string): boolean {
  return isIdentStartChar(ch) || isDigitChar(ch);
}

// ---------------------------------------------------------------------------
// AST node types
// ---------------------------------------------------------------------------

interface NumberNode {
  kind: 'number';
  value: number;
}

interface VariableNode {
  kind: 'variable';
  name: string;
}

interface UnaryNode {
  kind: 'unary';
  operator: '+' | '-';
  operand: ASTNode;
}

interface BinaryNode {
  kind: 'binary';
  operator: '+' | '-' | '*' | '/' | '^' | '%';
  left: ASTNode;
  right: ASTNode;
}

interface FunctionCallNode {
  kind: 'functionCall';
  name: string;
  args: ASTNode[];
}

type ASTNode = NumberNode | VariableNode | UnaryNode | BinaryNode | FunctionCallNode;

// ---------------------------------------------------------------------------
// Built-in functions and constants
// ---------------------------------------------------------------------------

const BUILTIN_CONSTANTS: ReadonlyMap<string, number> = new Map([
  ['pi', Math.PI],
  ['PI', Math.PI],
  ['e', Math.E],
  ['E', Math.E],
]);

type BuiltinFn = (...args: number[]) => number;

const BUILTIN_FUNCTIONS: ReadonlyMap<string, { fn: BuiltinFn; minArgs: number; maxArgs: number }> = new Map([
  ['sqrt', { fn: Math.sqrt, minArgs: 1, maxArgs: 1 }],
  ['log', { fn: Math.log, minArgs: 1, maxArgs: 1 }],
  ['log10', { fn: Math.log10, minArgs: 1, maxArgs: 1 }],
  ['log2', { fn: Math.log2, minArgs: 1, maxArgs: 1 }],
  ['exp', { fn: Math.exp, minArgs: 1, maxArgs: 1 }],
  ['abs', { fn: Math.abs, minArgs: 1, maxArgs: 1 }],
  ['ceil', { fn: Math.ceil, minArgs: 1, maxArgs: 1 }],
  ['floor', { fn: Math.floor, minArgs: 1, maxArgs: 1 }],
  ['round', { fn: Math.round, minArgs: 1, maxArgs: 1 }],
  ['sin', { fn: Math.sin, minArgs: 1, maxArgs: 1 }],
  ['cos', { fn: Math.cos, minArgs: 1, maxArgs: 1 }],
  ['tan', { fn: Math.tan, minArgs: 1, maxArgs: 1 }],
  ['asin', { fn: Math.asin, minArgs: 1, maxArgs: 1 }],
  ['acos', { fn: Math.acos, minArgs: 1, maxArgs: 1 }],
  ['atan', { fn: Math.atan, minArgs: 1, maxArgs: 1 }],
  ['min', { fn: Math.min, minArgs: 2, maxArgs: Infinity }],
  ['max', { fn: Math.max, minArgs: 2, maxArgs: Infinity }],
  ['pow', { fn: Math.pow, minArgs: 2, maxArgs: 2 }],
]);

// ---------------------------------------------------------------------------
// Recursive-descent parser
// ---------------------------------------------------------------------------

/**
 * Grammar (precedence low → high):
 *
 *   expression  → additive
 *   additive    → multiplicative (('+' | '-') multiplicative)*
 *   multiplicative → power (('*' | '/' | '%') power)*
 *   power       → unary ('^' power)?          [right-associative]
 *   unary       → ('+' | '-') unary | primary
 *   primary     → NUMBER
 *               | IDENTIFIER '(' args ')'     [function call]
 *               | IDENTIFIER                  [variable or constant]
 *               | '(' expression ')'
 */
class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  parse(): ASTNode {
    const node = this.parseExpression();
    if (this.current().type !== TokenType.EOF) {
      throw new ExpressionSyntaxError(
        `Unexpected token '${this.current().value}'`,
        this.current().position,
      );
    }
    return node;
  }

  private current(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const tok = this.tokens[this.pos];
    this.pos++;
    return tok;
  }

  private expect(type: TokenType): Token {
    const tok = this.current();
    if (tok.type !== type) {
      throw new ExpressionSyntaxError(
        `Expected ${type} but found '${tok.value}'`,
        tok.position,
      );
    }
    return this.advance();
  }

  private parseExpression(): ASTNode {
    return this.parseAdditive();
  }

  private parseAdditive(): ASTNode {
    let left = this.parseMultiplicative();
    while (this.current().type === TokenType.Plus || this.current().type === TokenType.Minus) {
      const op = this.advance().value as '+' | '-';
      const right = this.parseMultiplicative();
      left = { kind: 'binary', operator: op, left, right };
    }
    return left;
  }

  private parseMultiplicative(): ASTNode {
    let left = this.parsePower();
    while (
      this.current().type === TokenType.Star ||
      this.current().type === TokenType.Slash ||
      this.current().type === TokenType.Percent
    ) {
      const op = this.advance().value as '*' | '/' | '%';
      const right = this.parsePower();
      left = { kind: 'binary', operator: op, left, right };
    }
    return left;
  }

  private parsePower(): ASTNode {
    const base = this.parseUnary();
    if (this.current().type === TokenType.Caret) {
      this.advance();
      // Right-associative: 2^3^2 = 2^(3^2)
      const exponent = this.parsePower();
      return { kind: 'binary', operator: '^', left: base, right: exponent };
    }
    return base;
  }

  private parseUnary(): ASTNode {
    if (this.current().type === TokenType.Minus) {
      const tok = this.advance();
      const operand = this.parseUnary();
      // Optimization: fold constant negation
      if (operand.kind === 'number') {
        return { kind: 'number', value: -operand.value };
      }
      return { kind: 'unary', operator: '-', operand };
    }
    if (this.current().type === TokenType.Plus) {
      this.advance();
      return this.parseUnary();
    }
    return this.parsePrimary();
  }

  private parsePrimary(): ASTNode {
    const tok = this.current();

    // Number literal
    if (tok.type === TokenType.Number) {
      this.advance();
      const value = Number(tok.value);
      if (Number.isNaN(value)) {
        throw new ExpressionSyntaxError(`Invalid number: '${tok.value}'`, tok.position);
      }
      return { kind: 'number', value };
    }

    // Identifier: could be function call, constant, or variable
    if (tok.type === TokenType.Identifier) {
      this.advance();
      const name = tok.value;

      // Function call: identifier followed by '('
      if (this.current().type === TokenType.LParen) {
        this.advance(); // consume '('
        const args: ASTNode[] = [];
        if (this.current().type !== TokenType.RParen) {
          args.push(this.parseExpression());
          while (this.current().type === TokenType.Comma) {
            this.advance(); // consume ','
            args.push(this.parseExpression());
          }
        }
        this.expect(TokenType.RParen);
        return { kind: 'functionCall', name, args };
      }

      // Constant
      if (BUILTIN_CONSTANTS.has(name)) {
        return { kind: 'number', value: BUILTIN_CONSTANTS.get(name)! };
      }

      // Variable reference
      return { kind: 'variable', name };
    }

    // Parenthesized expression
    if (tok.type === TokenType.LParen) {
      this.advance();
      const expr = this.parseExpression();
      this.expect(TokenType.RParen);
      return expr;
    }

    throw new ExpressionSyntaxError(
      tok.type === TokenType.EOF
        ? 'Unexpected end of expression'
        : `Unexpected token '${tok.value}'`,
      tok.position,
    );
  }
}

// ---------------------------------------------------------------------------
// AST evaluator
// ---------------------------------------------------------------------------

function evaluateAST(node: ASTNode, resolver: (name: string) => number): number {
  switch (node.kind) {
    case 'number':
      return node.value;

    case 'variable':
      return resolver(node.name);

    case 'unary':
      if (node.operator === '-') {
        return -evaluateAST(node.operand, resolver);
      }
      return evaluateAST(node.operand, resolver);

    case 'binary':
      return evaluateBinary(node, resolver);

    case 'functionCall':
      return evaluateFunctionCall(node, resolver);
  }
}

function evaluateBinary(node: BinaryNode, resolver: (name: string) => number): number {
  const left = evaluateAST(node.left, resolver);
  const right = evaluateAST(node.right, resolver);

  switch (node.operator) {
    case '+': return left + right;
    case '-': return left - right;
    case '*': return left * right;
    case '/':
      if (right === 0) {
        throw new DivisionByZeroError();
      }
      return left / right;
    case '^': return Math.pow(left, right);
    case '%':
      if (right === 0) {
        throw new DivisionByZeroError();
      }
      return left % right;
  }
}

function evaluateFunctionCall(node: FunctionCallNode, resolver: (name: string) => number): number {
  const builtin = BUILTIN_FUNCTIONS.get(node.name);
  if (!builtin) {
    throw new InvalidExpressionError(`Unknown function: '${node.name}'`);
  }

  if (node.args.length < builtin.minArgs) {
    throw new InvalidExpressionError(
      `Function '${node.name}' requires at least ${String(builtin.minArgs)} argument(s), got ${String(node.args.length)}`,
    );
  }
  if (node.args.length > builtin.maxArgs) {
    throw new InvalidExpressionError(
      `Function '${node.name}' accepts at most ${String(builtin.maxArgs)} argument(s), got ${String(node.args.length)}`,
    );
  }

  const evaluatedArgs = node.args.map((arg) => evaluateAST(arg, resolver));
  return builtin.fn(...evaluatedArgs);
}

// ---------------------------------------------------------------------------
// AST dependency collector
// ---------------------------------------------------------------------------

function collectVariableReferences(node: ASTNode): Set<string> {
  const refs = new Set<string>();

  function walk(n: ASTNode): void {
    switch (n.kind) {
      case 'number':
        break;
      case 'variable':
        refs.add(n.name);
        break;
      case 'unary':
        walk(n.operand);
        break;
      case 'binary':
        walk(n.left);
        walk(n.right);
        break;
      case 'functionCall':
        for (const arg of n.args) {
          walk(arg);
        }
        break;
    }
  }

  walk(node);
  return refs;
}

// ---------------------------------------------------------------------------
// Public API: standalone expression evaluation
// ---------------------------------------------------------------------------

/**
 * Parse and evaluate a single expression string.
 *
 * @param expression - The expression to evaluate (e.g., "3.3 * 2 + 1")
 * @param variables - Optional map of variable name → resolved numeric value
 * @returns The computed numeric result
 * @throws {ExpressionSyntaxError} on malformed input
 * @throws {UndefinedVariableError} if the expression references an unknown variable
 * @throws {DivisionByZeroError} on divide-by-zero
 * @throws {InvalidExpressionError} on unknown functions or argument count mismatch
 */
export function evaluateExpression(expression: string, variables?: ReadonlyMap<string, number>): number {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    throw new InvalidExpressionError('Empty expression');
  }

  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  const ast = parser.parse();

  const resolver = (name: string): number => {
    if (BUILTIN_CONSTANTS.has(name)) {
      return BUILTIN_CONSTANTS.get(name)!;
    }
    if (variables?.has(name)) {
      return variables.get(name)!;
    }
    throw new UndefinedVariableError(name);
  };

  return evaluateAST(ast, resolver);
}

/**
 * Extract variable names referenced in an expression (excluding built-in constants and functions).
 */
export function getExpressionDependencies(expression: string): string[] {
  const trimmed = expression.trim();
  if (trimmed.length === 0) {
    return [];
  }

  const tokens = tokenize(trimmed);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const refs = collectVariableReferences(ast);

  // Exclude built-in constants — they are not variable dependencies
  for (const name of Array.from(BUILTIN_CONSTANTS.keys())) {
    refs.delete(name);
  }

  return Array.from(refs);
}

// ---------------------------------------------------------------------------
// DesignVariable + VariableStore
// ---------------------------------------------------------------------------

/** A single named design variable. */
export interface DesignVariable {
  /** Variable name (case-sensitive). */
  name: string;
  /** Raw expression string or literal value: "3.3", "10k", "VOUT * 2". */
  value: string;
  /** Computed numeric value (populated after resolution). */
  resolved?: number;
  /** Optional unit label for display purposes: "V", "Ω", "A". */
  unit?: string;
  /** Optional human-readable description. */
  description?: string;
}

/** Result of variable store validation. */
export interface ValidationResult {
  variableName: string;
  error: DesignVariableError;
}

/**
 * Store for design variables with expression evaluation, dependency tracking,
 * and circular dependency detection.
 */
export class VariableStore {
  private readonly variables: Map<string, DesignVariable> = new Map();
  /** Cached parsed ASTs keyed by variable name. Invalidated on add/remove/update. */
  private readonly astCache: Map<string, ASTNode> = new Map();

  /** Get the number of variables in the store. */
  get size(): number {
    return this.variables.size;
  }

  /** Get a variable by name, or undefined if not found. */
  get(name: string): DesignVariable | undefined {
    return this.variables.get(name);
  }

  /** Get all variable names. */
  names(): string[] {
    return Array.from(this.variables.keys());
  }

  /** Get all variables as an array. */
  all(): DesignVariable[] {
    return Array.from(this.variables.values());
  }

  /** Add or update a variable. */
  addVariable(variable: DesignVariable): void {
    this.variables.set(variable.name, { ...variable });
    this.astCache.delete(variable.name);
  }

  /** Remove a variable by name. Returns true if the variable existed. */
  removeVariable(name: string): boolean {
    this.astCache.delete(name);
    return this.variables.delete(name);
  }

  /**
   * Resolve a single variable by name, returning its numeric value.
   * Throws if the variable is undefined, has a circular dependency, or
   * its expression is invalid.
   */
  resolve(name: string): number {
    const visiting = new Set<string>();
    return this.resolveInternal(name, visiting);
  }

  /**
   * Resolve all variables, returning a map of name → numeric value.
   * Uses topological sort to resolve in correct dependency order.
   * Variables that fail to resolve will have their error recorded in the
   * returned errors array.
   */
  resolveAll(): { resolved: Map<string, number>; errors: ValidationResult[] } {
    const order = this.topologicalSort();
    const resolved = new Map<string, number>();
    const errors: ValidationResult[] = [];

    for (const name of order) {
      try {
        const value = this.evaluateVariable(name, resolved);
        resolved.set(name, value);
        const variable = this.variables.get(name);
        if (variable) {
          variable.resolved = value;
        }
      } catch (err) {
        if (err instanceof DesignVariableError) {
          errors.push({ variableName: name, error: err });
        } else {
          errors.push({
            variableName: name,
            error: new InvalidExpressionError(err instanceof Error ? err.message : String(err)),
          });
        }
      }
    }

    return { resolved, errors };
  }

  /**
   * Get the names of variables that the given variable directly depends on.
   */
  getDependencies(name: string): string[] {
    const variable = this.variables.get(name);
    if (!variable) {
      return [];
    }

    const ast = this.getOrParseAST(name);
    if (!ast) {
      return [];
    }

    const refs = collectVariableReferences(ast);
    // Only include refs that are actual variables (not built-in constants)
    const deps: string[] = [];
    for (const ref of Array.from(refs)) {
      if (!BUILTIN_CONSTANTS.has(ref)) {
        deps.push(ref);
      }
    }
    return deps;
  }

  /**
   * Get the full dependency graph as a map of variable name → dependency names.
   */
  getDependencyGraph(): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    for (const name of Array.from(this.variables.keys())) {
      graph.set(name, this.getDependencies(name));
    }
    return graph;
  }

  /**
   * Detect circular dependencies. Returns an array of cycle paths, or null
   * if there are no circular dependencies.
   *
   * Each cycle path is an array like ["A", "B", "A"] showing the cycle.
   */
  detectCircularDependencies(): string[][] | null {
    const graph = this.getDependencyGraph();
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();
    const stack: string[] = [];

    const dfs = (node: string): void => {
      if (inStack.has(node)) {
        // Found a cycle — extract it from the stack
        const cycleStart = stack.indexOf(node);
        const cycle = [...stack.slice(cycleStart), node];
        cycles.push(cycle);
        return;
      }
      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      inStack.add(node);
      stack.push(node);

      const deps = graph.get(node) ?? [];
      for (const dep of deps) {
        // Only follow edges to variables that exist in the store
        if (this.variables.has(dep)) {
          dfs(dep);
        }
      }

      stack.pop();
      inStack.delete(node);
    };

    for (const name of Array.from(this.variables.keys())) {
      if (!visited.has(name)) {
        dfs(name);
      }
    }

    return cycles.length > 0 ? cycles : null;
  }

  /**
   * Validate all variables. Returns an array of validation results for
   * variables that have errors (empty array if everything is valid).
   */
  validate(): ValidationResult[] {
    const results: ValidationResult[] = [];

    // Check for circular dependencies first
    const cycles = this.detectCircularDependencies();
    if (cycles) {
      for (const cycle of cycles) {
        const varName = cycle[0];
        // Only report each variable once
        if (!results.some((r) => r.variableName === varName)) {
          results.push({
            variableName: varName,
            error: new CircularDependencyError(cycle),
          });
        }
      }
    }

    // Validate each variable's expression
    for (const name of Array.from(this.variables.keys())) {
      // Skip variables already flagged in circular dependencies
      if (results.some((r) => r.variableName === name)) {
        continue;
      }

      try {
        this.resolve(name);
      } catch (err) {
        if (err instanceof DesignVariableError) {
          results.push({ variableName: name, error: err });
        } else {
          results.push({
            variableName: name,
            error: new InvalidExpressionError(err instanceof Error ? err.message : String(err)),
          });
        }
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  private getOrParseAST(name: string): ASTNode | null {
    const cached = this.astCache.get(name);
    if (cached) {
      return cached;
    }

    const variable = this.variables.get(name);
    if (!variable) {
      return null;
    }

    const trimmed = variable.value.trim();
    if (trimmed.length === 0) {
      return null;
    }

    try {
      const tokens = tokenize(trimmed);
      const parser = new Parser(tokens);
      const ast = parser.parse();
      this.astCache.set(name, ast);
      return ast;
    } catch {
      return null;
    }
  }

  private resolveInternal(name: string, visiting: Set<string>): number {
    if (visiting.has(name)) {
      throw new CircularDependencyError([...Array.from(visiting), name]);
    }

    const variable = this.variables.get(name);
    if (!variable) {
      throw new UndefinedVariableError(name);
    }

    visiting.add(name);

    try {
      const resolved = new Map<string, number>();
      // Resolve all dependencies first
      const deps = this.getDependencies(name);
      for (const dep of deps) {
        resolved.set(dep, this.resolveInternal(dep, new Set(visiting)));
      }

      const value = this.evaluateVariable(name, resolved);
      variable.resolved = value;
      return value;
    } finally {
      visiting.delete(name);
    }
  }

  private evaluateVariable(name: string, resolvedContext: ReadonlyMap<string, number>): number {
    const variable = this.variables.get(name);
    if (!variable) {
      throw new UndefinedVariableError(name);
    }

    const trimmed = variable.value.trim();
    if (trimmed.length === 0) {
      throw new InvalidExpressionError(`Variable '${name}' has an empty expression`);
    }

    // Try parsing as a plain SI-prefixed number first (fast path)
    const siValue = parseSINumber(trimmed);
    if (!Number.isNaN(siValue)) {
      return siValue;
    }

    return evaluateExpression(trimmed, resolvedContext);
  }

  /**
   * Topological sort of variables by dependency order.
   * Variables with no dependencies come first.
   * Variables involved in circular dependencies are appended at the end.
   */
  private topologicalSort(): string[] {
    // graph: variable → [variables it depends on]
    // For Kahn's algorithm we need in-degree = number of dependencies,
    // and a reverse map: dependency → [variables that depend on it]
    const graph = this.getDependencyGraph();
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>(); // reverse graph
    const result: string[] = [];

    // Initialize
    for (const name of Array.from(this.variables.keys())) {
      inDegree.set(name, 0);
      dependents.set(name, []);
    }

    // For each variable, its dependencies increase its own in-degree
    // and register it as a dependent of each dependency
    for (const [name, deps] of Array.from(graph.entries())) {
      let count = 0;
      for (const dep of deps) {
        if (this.variables.has(dep)) {
          count++;
          const list = dependents.get(dep);
          if (list) {
            list.push(name);
          }
        }
      }
      inDegree.set(name, count);
    }

    // Kahn's algorithm: start with zero in-degree nodes (no dependencies)
    const queue: string[] = [];
    for (const [name, degree] of Array.from(inDegree.entries())) {
      if (degree === 0) {
        queue.push(name);
      }
    }

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);

      // For each variable that depends on current, decrement its in-degree
      const deps = dependents.get(current) ?? [];
      for (const dep of deps) {
        const newDegree = (inDegree.get(dep) ?? 1) - 1;
        inDegree.set(dep, newDegree);
        if (newDegree === 0) {
          queue.push(dep);
        }
      }
    }

    // Any remaining variables are part of circular dependencies — add them at the end
    for (const name of Array.from(this.variables.keys())) {
      if (!result.includes(name)) {
        result.push(name);
      }
    }

    return result;
  }
}
