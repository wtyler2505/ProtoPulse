import type { SimVector } from './types.js';

/**
 * Math channels — a tiny SAFE expression evaluator over result vectors.
 * No eval, no Function: tokenizer + recursive-descent parser + an
 * elementwise complex-aware interpreter.
 *
 * Grammar:
 *   expr    := term  (('+' | '-') term)*
 *   term    := unary (('*' | '/') unary)*
 *   unary   := '-' unary | primary
 *   primary := number | func '(' expr ')' | vectorRef | '(' expr ')'
 *   func    := 'db' | 'abs' | 'mag'
 *
 * Vector refs are exact result-vector names: `v(led_a)`, `i(vbt1)` — a
 * name followed immediately by '(' that is NOT a known function swallows
 * everything up to the matching ')' as part of the name. Bare names
 * (`time`, `frequency`) work too. Output length is the min length of the
 * referenced vectors; scalar literals broadcast. Division by zero yields
 * Infinity (JS semantics) — the plot clips non-finite points.
 */

// ── Tokens ──

type Token =
  | { kind: 'num'; value: number }
  | { kind: 'name'; name: string }
  | { kind: 'func'; name: FuncName }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '(' | ')' };

type FuncName = 'db' | 'abs' | 'mag';

const FUNCS: ReadonlySet<string> = new Set(['db', 'abs', 'mag']);

const isDigit = (c: string): boolean => c >= '0' && c <= '9';
const isNameStart = (c: string): boolean => /[A-Za-z_$]/.test(c);
const isNameChar = (c: string): boolean => /[A-Za-z0-9_$.:#]/.test(c);

function tokenize(input: string): Token[] | string {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === undefined) break;
    if (c === ' ' || c === '\t' || c === '\n') {
      i += 1;
      continue;
    }
    if (c === '+' || c === '-' || c === '*' || c === '/' || c === '(' || c === ')') {
      tokens.push({ kind: 'op', op: c });
      i += 1;
      continue;
    }
    if (isDigit(c) || (c === '.' && isDigit(input[i + 1] ?? ''))) {
      const m = /^\d*\.?\d+(?:[eE][+-]?\d+)?/.exec(input.slice(i));
      if (!m) return `bad number at position ${String(i)}`;
      tokens.push({ kind: 'num', value: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (isNameStart(c)) {
      let j = i + 1;
      while (j < input.length && isNameChar(input[j] ?? '')) j += 1;
      const ident = input.slice(i, j);
      if (input[j] === '(') {
        if (FUNCS.has(ident.toLowerCase())) {
          tokens.push({ kind: 'func', name: ident.toLowerCase() as FuncName });
          i = j;
          continue;
        }
        // v(led_a)-style ref: the whole token up to the ')' is the name.
        const close = input.indexOf(')', j);
        if (close === -1) return `unterminated vector reference "${ident}("`;
        tokens.push({ kind: 'name', name: input.slice(i, close + 1) });
        i = close + 1;
        continue;
      }
      tokens.push({ kind: 'name', name: ident });
      i = j;
      continue;
    }
    return `unexpected character "${c}" at position ${String(i)}`;
  }
  return tokens;
}

// ── AST ──

type Node =
  | { kind: 'num'; value: number }
  | { kind: 'ref'; name: string }
  | { kind: 'neg'; arg: Node }
  | { kind: 'bin'; op: '+' | '-' | '*' | '/'; left: Node; right: Node }
  | { kind: 'call'; func: FuncName; arg: Node };

function parse(tokens: Token[]): Node | string {
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const isOp = (op: string): boolean => {
    const t = peek();
    return t?.kind === 'op' && t.op === op;
  };

  function expr(): Node | string {
    let left = term();
    if (typeof left === 'string') return left;
    while (isOp('+') || isOp('-')) {
      const t = tokens[pos];
      pos += 1;
      const right = term();
      if (typeof right === 'string') return right;
      left = { kind: 'bin', op: t?.kind === 'op' && t.op === '-' ? '-' : '+', left, right };
    }
    return left;
  }

  function term(): Node | string {
    let left = unary();
    if (typeof left === 'string') return left;
    while (isOp('*') || isOp('/')) {
      const t = tokens[pos];
      pos += 1;
      const right = unary();
      if (typeof right === 'string') return right;
      left = { kind: 'bin', op: t?.kind === 'op' && t.op === '/' ? '/' : '*', left, right };
    }
    return left;
  }

  function unary(): Node | string {
    if (isOp('-')) {
      pos += 1;
      const arg = unary();
      if (typeof arg === 'string') return arg;
      return { kind: 'neg', arg };
    }
    return primary();
  }

  function primary(): Node | string {
    const t = peek();
    if (t === undefined) return 'unexpected end of expression';
    if (t.kind === 'num') {
      pos += 1;
      return { kind: 'num', value: t.value };
    }
    if (t.kind === 'name') {
      pos += 1;
      return { kind: 'ref', name: t.name };
    }
    if (t.kind === 'func') {
      pos += 1;
      if (!isOp('(')) return `expected "(" after ${t.name}`;
      pos += 1;
      const arg = expr();
      if (typeof arg === 'string') return arg;
      if (!isOp(')')) return `expected ")" to close ${t.name}(…)`;
      pos += 1;
      return { kind: 'call', func: t.name, arg };
    }
    // Only op tokens remain at this point.
    if (t.op === '(') {
      pos += 1;
      const inner = expr();
      if (typeof inner === 'string') return inner;
      if (!isOp(')')) return 'expected ")"';
      pos += 1;
      return inner;
    }
    return `unexpected "${t.op}"`;
  }

  const root = expr();
  if (typeof root === 'string') return root;
  const trailing = peek();
  if (trailing !== undefined) {
    const what =
      trailing.kind === 'op' ? trailing.op : trailing.kind === 'num' ? String(trailing.value) : trailing.name;
    return `unexpected "${what}" after expression`;
  }
  return root;
}

// ── Evaluation (elementwise, complex-aware) ──

/** Internal value: parallel re/im arrays, or a real scalar to broadcast. */
type Value = { scalar: number } | { re: number[]; im: number[] };

function lift(v: Value, n: number): { re: number[]; im: number[] } {
  if ('scalar' in v) {
    return { re: new Array<number>(n).fill(v.scalar), im: new Array<number>(n).fill(0) };
  }
  return v;
}

function zipLen(a: Value, b: Value): number {
  const la = 'scalar' in a ? Infinity : a.re.length;
  const lb = 'scalar' in b ? Infinity : b.re.length;
  const n = Math.min(la, lb);
  return Number.isFinite(n) ? n : 1;
}

function binOp(op: '+' | '-' | '*' | '/', a: Value, b: Value): Value {
  if ('scalar' in a && 'scalar' in b) {
    const x = a.scalar;
    const y = b.scalar;
    return { scalar: op === '+' ? x + y : op === '-' ? x - y : op === '*' ? x * y : x / y };
  }
  const n = zipLen(a, b);
  const A = lift(a, n);
  const B = lift(b, n);
  const re = new Array<number>(n);
  const im = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    const ar = A.re[i] ?? 0;
    const ai = A.im[i] ?? 0;
    const br = B.re[i] ?? 0;
    const bi = B.im[i] ?? 0;
    switch (op) {
      case '+':
        re[i] = ar + br;
        im[i] = ai + bi;
        break;
      case '-':
        re[i] = ar - br;
        im[i] = ai - bi;
        break;
      case '*':
        re[i] = ar * br - ai * bi;
        im[i] = ar * bi + ai * br;
        break;
      case '/': {
        if (bi === 0) {
          // Real divisor — keep JS semantics (x/0 → ±Infinity, not NaN).
          re[i] = ar / br;
          im[i] = ai / br;
        } else {
          const d = br * br + bi * bi;
          re[i] = (ar * br + ai * bi) / d;
          im[i] = (ai * br - ar * bi) / d;
        }
        break;
      }
    }
  }
  return { re, im };
}

function mapReal(v: Value, f: (re: number, im: number) => number): Value {
  if ('scalar' in v) return { scalar: f(v.scalar, 0) };
  const n = v.re.length;
  const re = new Array<number>(n);
  for (let i = 0; i < n; i++) re[i] = f(v.re[i] ?? 0, v.im[i] ?? 0);
  return { re, im: new Array<number>(n).fill(0) };
}

function evalNode(node: Node, byName: ReadonlyMap<string, SimVector>): Value | string {
  switch (node.kind) {
    case 'num':
      return { scalar: node.value };
    case 'ref': {
      const vec = byName.get(node.name);
      if (!vec) return `unknown vector "${node.name}"`;
      return { re: vec.values, im: vec.imag ?? new Array<number>(vec.values.length).fill(0) };
    }
    case 'neg': {
      const v = evalNode(node.arg, byName);
      if (typeof v === 'string') return v;
      if ('scalar' in v) return { scalar: -v.scalar };
      return { re: v.re.map((x) => -x), im: v.im.map((x) => -x) };
    }
    case 'bin': {
      const a = evalNode(node.left, byName);
      if (typeof a === 'string') return a;
      const b = evalNode(node.right, byName);
      if (typeof b === 'string') return b;
      return binOp(node.op, a, b);
    }
    case 'call': {
      const v = evalNode(node.arg, byName);
      if (typeof v === 'string') return v;
      switch (node.func) {
        case 'mag':
          return mapReal(v, (re, im) => Math.hypot(re, im));
        case 'db':
          return mapReal(v, (re, im) => 20 * Math.log10(Math.hypot(re, im)));
        case 'abs':
          return mapReal(v, (re, im) => (im === 0 ? Math.abs(re) : Math.hypot(re, im)));
      }
    }
  }
}

export interface MathChannelResult {
  values: number[];
  error?: string;
}

/** Evaluate an expression over result vectors. On error, values is []. */
export function evaluate(expr: string, vectors: SimVector[]): MathChannelResult {
  if (expr.trim() === '') return { values: [], error: 'empty expression' };
  const tokens = tokenize(expr);
  if (typeof tokens === 'string') return { values: [], error: tokens };
  const root = parse(tokens);
  if (typeof root === 'string') return { values: [], error: root };
  const byName = new Map(vectors.map((v) => [v.name, v] as const));
  const out = evalNode(root, byName);
  if (typeof out === 'string') return { values: [], error: out };
  if ('scalar' in out) return { values: [out.scalar] };
  return { values: out.re };
}
