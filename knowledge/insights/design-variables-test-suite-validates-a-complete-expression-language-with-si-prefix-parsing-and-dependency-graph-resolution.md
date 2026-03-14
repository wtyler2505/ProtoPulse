---
summary: The design-variables test suite reveals that VariableStore implements a full expression language with recursive descent parsing, SI prefix support (p/n/u/m/k/M/G/T), topological dependency resolution, circular dependency detection, and a typed error hierarchy — making it a standalone computational engine
type: pattern
---

# Design variables test suite validates a complete expression language with dependency graph resolution

`shared/__tests__/design-variables.test.ts` (107 tests) is the most architecturally dense test file in the shared directory. It reveals that `shared/design-variables.ts` is not a simple key-value store but a **complete expression evaluation engine** with language-level features:

**Layer 1 — SI Prefix Parser** (`parseSINumber`):
- Handles 8 SI prefixes: p (10^-12), n (10^-7), u/µ (10^-6), m (10^-3), k (10^3), M (10^6), G (10^9), T (10^12)
- Unicode-aware: accepts both `u` (ASCII) and `µ` (U+00B5) for micro
- Returns NaN for empty strings, trims whitespace
- This parser is reused inside the expression evaluator for inline SI values like `10k * 2`

**Layer 2 — Recursive Descent Expression Evaluator** (`evaluateExpression`):
- Full arithmetic: +, -, *, /, %, ^ (right-associative exponentiation)
- Operator precedence and parenthesized grouping
- Unary operators: negation, double negation (`--5`), unary plus
- 14 built-in functions: sqrt, abs, min, max, log, log10, exp, sin, cos, tan, pow, floor, ceil, round
- Variadic functions: `min(5, 3, 8, 1, 9)` accepts arbitrary argument counts
- Built-in constants: pi, e
- Variable resolution from `Map<string, number>`
- **Case-sensitive** variable names (`vout` !== `VOUT`)

**Layer 3 — Dependency Graph** (`VariableStore`):
- Variables can reference other variables: `R1 = VOUT / 0.02`
- Topological resolution: `resolveAll()` evaluates in dependency order
- Circular dependency detection: returns cycle path for `A → B → A`
- Automatic re-evaluation: changing `V` from `5` to `3.3` updates dependent `R = V * 10`
- `getDependencyGraph()` returns the full DAG

**Layer 4 — Typed Error Hierarchy**:
- `DesignVariableError` (base class)
  - `UndefinedVariableError` (with `.variableName` property)
  - `DivisionByZeroError`
  - `ExpressionSyntaxError`
  - `InvalidExpressionError`
  - `CircularDependencyError`
- All errors extend the base class, enabling `catch (err) { if (err instanceof DesignVariableError) ... }`

**Why this is non-obvious:** The test file reveals that design variables are not just UI input fields with formulas — they are a **parametric constraint system** where changing one value propagates through a dependency graph. This is the foundation for parametric PCB design (where changing a voltage rail recalculates all dependent resistor values) and what-if analysis (WhatIfSliderPanel, from Wave 62). The expression language effectively makes ProtoPulse a domain-specific spreadsheet for electronics calculations.

---

Related:
- [[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — VariableStore likely follows this singleton+subscribe pattern for React integration
- [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — design variables are a shared source of truth that multiple views depend on
