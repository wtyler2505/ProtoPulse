---
summary: The Circuit DSL evaluator deliberately transpiles TypeScript on the main thread via Sucrase but evaluates the resulting JavaScript in a sandboxed Web Worker, because transpilation is trusted code while eval is not
category: architectural-decision
areas: ["[[index]]"]
related insights:
  - "[[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — the worker result feeds into a useSyncExternalStore-compatible hook (useCircuitEvaluator)"
  - "[[every-component-must-define-geometry-three-times-schematic-breadboard-pcb-because-eda-tools-traditionally-decouple-logical-from-physical-representations]] — the IR output from the DSL must generate geometry for all three views"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook.md
  - every-component-must-define-geometry-three-times-schematic-breadboard-pcb-because-eda-tools-traditionally-decouple-logical-from-physical-representations.md
---

The Circuit DSL evaluator (`client/src/lib/circuit-dsl/circuit-dsl-worker.ts`) has a surprising architecture split: Sucrase TypeScript transpilation happens on the **main thread**, while the transpiled JavaScript is evaluated in a **Web Worker** via `new Function()`. This is counterintuitive — you might expect both steps in the worker to avoid blocking the main thread.

The reasoning:

1. **Sucrase is safe**: It only does syntactic transformation (strip type annotations). It runs trusted library code, executes in under 5ms for typical DSL scripts, and has no security implications. Moving it to the worker would add message-passing overhead for no benefit.

2. **Eval is dangerous**: `new Function(userCode)` executes arbitrary JavaScript. The worker sandbox deletes 12 dangerous globals (`fetch`, `XMLHttpRequest`, `importScripts`, `WebSocket`, `EventSource`, `navigator`, `localStorage`, `sessionStorage`, `indexedDB`, `caches`, `CacheStorage`) before any user code runs. This containment only works inside a Web Worker's isolated global scope.

3. **Blob URL Worker**: The worker is created from an inline string via `new Blob([WORKER_CODE])` + `URL.createObjectURL()`. No separate worker file is needed, avoiding build system complexity. The URL is immediately revoked after worker creation.

4. **Three-layer validation**: After the worker returns, the main thread applies (a) a 2-second watchdog timeout (kills infinite loops), (b) a 1MB size cap on the IR output, and (c) full Zod schema validation of the IR structure. All three checks must pass before the result reaches React state.

5. **EvalId correlation**: Each evaluation is tagged with a `crypto.randomUUID()`. The worker response handler ignores messages whose `evalId` doesn't match the current request, preventing out-of-order results from stale evaluations.

This architecture means user-authored circuit code can never access the network, read secrets from localStorage, or hang the UI — even if the code is malicious.

## Topics

- [[index]]
