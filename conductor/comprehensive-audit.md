# ProtoPulse Comprehensive Codebase Audit

**Date:** April 5, 2026
**Status:** In Progress
**Purpose:** To audit, inspect, evaluate, and explore the ProtoPulse codebase to find ways to improve, enhance, and optimize everything without making any direct code changes. These findings will be passed over to Claude to work on later.

## 1. AI Integration & Genkit (server/ai.ts & server/ai-tools/)
*Evaluating Genkit MCP integration, streaming, and tool execution.*

- **Findings:**
  - **Dynamic Import of Internal Genkit Module:** `server/ai.ts` imports an internal module (`'@genkit-ai/google-genai/lib/common/converters.js'`) which is a fragile pattern and could break with package upgrades.
  - **Tool Double-Execution Risk:** The fallback mechanism in `executeStreamForProvider` risks re-executing tools that Genkit has already auto-executed, which could duplicate state mutations (e.g., DB writes).
  - **Un-handled Abort Signal:** The `abortSignal` is not passed correctly to `ai.generateStream()`, meaning cancelled connections still consume API quota.
  - **Output Schema Type:** In `server/genkit.ts`, all generated Genkit tools use `outputSchema: z.any()`. This removes output validation before returning data to the LLM.
  - **Fragile Context Pattern:** The tool definitions rely heavily on `ai.currentContext()` rather than passing context explicitly, creating a risk if tool execution happens outside a Genkit context.
  - **Stale/Preview Models:** The codebase explicitly uses experimental models like `gemini-3-flash-preview` instead of stable or configurable endpoints in `server/genkit.ts`.
  - **Missing Image Validation:** Images (e.g. `imageBase64`) passed for vision tasks are not strictly validated beyond checking the MIME type.
  - **N+1 Tool Call Overhead:** Several AI tools (like `add_bom_item` in `server/ai-tools/bom.ts`) execute database mutations one-by-one. If the AI attempts to add 50 items, it triggers 50 separate tool calls and 50 sequential DB inserts, bypassing any batch-insert optimizations.

## 2. Architecture & Design Editor (client/src/lib/circuit-editor & components/circuit-editor)
*Evaluating WebGPU acceleration, canvas performance, and block diagram implementation.*

- **Findings:**
  - **ReactFlow Sync Overhead:** `SchematicCanvas.tsx` uses `JSON.stringify` over entire node and edge arrays (`flowNodeSyncSignature`, `flowEdgeSyncSignature`) to diff canvas state. This is an O(N) operation per render cycle and is notoriously slow for large schematics.
  - **Context Coupling & Re-renders:** The canvas heavily relies on multiple TanStack Query hooks and context providers (`useCircuitInstances`, `useCircuitNets`, etc.). ReactFlow components often re-render entirely when any upstream context changes unless wrapped in strict memoization. The use of `JSON.stringify` for sync indicates struggles with referential equality.
  - **WebGPU Implementation:** The `GpuAccelerator` is well implemented as a singleton with a graceful CPU fallback, but the fallback checks could be improved by logging telemetry when fallback occurs (currently silently fails back to CPU).
  - **Context Provider Debt:** While the docs cite `ProjectProvider` as a monolithic context debt, `client/src/lib/project-context.tsx` reveals it has been partially split into nested domain providers (`<SeededProviders>`). The docs should be updated, and the nesting depth (provider hell) should be evaluated for performance.

## 3. Simulation Engine (client/src/lib/simulation/)
*Evaluating SPICE/MNA circuit simulation performance.*

- **Findings:**
  - **Event Loop Blocking:** The custom circuit solver (`circuit-solver.ts`) implements Modified Nodal Analysis (MNA), matrix solving, and Newton-Raphson iteration *synchronously on the main thread*. There is no WebWorker implementation for the core simulation logic. This will cause the UI to freeze entirely during heavy transient analysis or large Monte Carlo sweeps.
  - **O(N^3) Matrix Solving:** The Transient Analysis engine (`transient-analysis.ts`) implements a basic Gaussian elimination with partial pivoting in plain JavaScript. Gaussian elimination is an O(N^3) algorithm. For massive circuits with hundreds of nodes, this will cause severe performance degradation on the main thread.

## 4. Storage & Database (server/storage.ts & shared/schema.ts)
*Evaluating Drizzle ORM, PostgreSQL performance, LRU cache effectiveness, and query optimizations.*

- **Findings:**
  - **Memory/Serialization Bottleneck:** Despite adding a `SimpleCache` (LRU) to mask DB latency, `server/ai.ts` still rebuilds the *entire* state (nodes, edges, BOM) into a massive string per turn. This creates an N+1 scaling issue directly in node memory limits, not just the DB.
  - **Storage Facade:** `server/storage.ts` aggregates 10 sub-storage classes via direct method bindings (e.g. `this._projects.getProjects.bind(this._projects)`). This creates a massive >200 line facade class that could become a serious maintainability bottleneck.
  - **Cache Invalidation Coupling:** `SimpleCache` uses `startsWith` string-matching for invalidation. If entity keys overlap or contain delimiters that change, cache invalidations could accidentally wipe out wrong keys, leading to cache misses.
  - **Soft Deletes Indexing:** Good composite index strategy exists (`projectId`, `deletedAt`) for core items, but requires constant vigilance in all manual DB queries to check for `isNull(deletedAt)`.

## 5. Hardware/Native Integration (Tauri & Web Serial)
*Evaluating the native desktop wrapper, hardware communication with Arduino, and build profiles.*

- **Findings:**
  - **Fragile Node Dependency:** In production, the Tauri app (`src-tauri/src/lib.rs`) launches the Express backend by spawning a child process calling the global `node` command (`std::process::Command::new("node")`). This means the desktop app is NOT self-contained and will fail if the user doesn't have Node.js installed locally or in their PATH. A properly bundled executable (like via `pkg` or Tauri sidecar binaries) should be used.
  - **Arbitrary Command Execution Risk:** The `spawn_process` Tauri command is exposed to the frontend without any command allow-listing or validation. Given that the product analysis explicitly found XSS vulnerabilities (e.g., `javascript:` URIs in AI markdown), this creates a critical path where an XSS payload could escalate to Remote Code Execution (RCE) on the host machine.
  - **Hardware Communication:** Hardware interaction (like `arduino-cli`) goes through the Express server (Node.js) instead of being handled securely by the Rust backend, maintaining an awkward architecture where the Node server does the heavy lifting while Tauri merely serves as a window and un-sandboxed shell executor.

## 6. Export & Translation Pipelines (server/export/)
*Evaluating industry-standard format generation (KiCad, Gerber, Pick & Place, etc.).*

- **Findings:**
  - **Deterministic UUID Collision Risk:** The KiCad exporter (`server/export/kicad-exporter.ts`) implements a custom deterministic UUID function (`deterministicUuid()`) using a simple FNV-1a-inspired hash. While this avoids `crypto` module dependencies and ensures reproducibility, it is not a true UUIDv4 and could theoretically cause ID collisions in massive PCB projects, leading to corrupted KiCad saves.

## 7. Offline PWA & Synchronization (client/src/lib/pwa-manager.ts & offline-sync.ts)
*Evaluating offline capability, IndexedDB sync, and conflict resolution.*

- **Findings:**
  - **Memory-Bound Sync State:** The `OfflineSyncManager` holds conflict state in memory (`this.conflicts`). If a user experiences a sync conflict while offline, and then refreshes the page, the entire conflict resolution state is wiped out, potentially leading to unresolved or stuck data in IndexedDB.
  - **Main Thread Blocking:** The sync manager iterates over pending IndexedDB operations synchronously with `await`. While using IndexedDB is asynchronous, bulk batch operations during reconnections could still cause UI stuttering if the payload is extremely large.

## 8. Validation & ERC Engine (shared/drc-engine.ts & client/src/lib/circuit-editor/erc-engine.ts)
*Evaluating the design rule check and electrical rule check systems.*

- **Findings:**
  - **Fragile Pin Classification Heuristics:** In `erc-engine.ts`, the `classifyPin` function relies strictly on hardcoded regex string matching (e.g., `/^(vcc|vdd|vin...)$/i`) rather than an explicit parts database lookup or metadata definition. This is a very fragile approach that will likely fail or produce false-positive DRC errors for any non-standard component or localized pin names.
  - **Algorithmic Complexity in Netlist Diffing:** The `computeNetlistDiff` function in `shared/netlist-diff.ts` loops over all nets and performs `.filter()` operations over connections. While Sets are used for fast lookups, array filtering inside loops still yields O(N * M) complexity. Large schematics with thousands of connections could block the thread during diffing.

## 9. API Design & Security (server/routes.ts & server/routes/)
*Evaluating Express routes, dependency injection, and endpoint security.*

- **Findings:**
  - **Dependency Injection Inconsistency:** As noted in `server/routes.ts` comments, domain routers (auth, bom, etc.) directly import the `storage` module as a global singleton. In contrast, the newer `circuit-routes.ts` receives the `storage` instance via explicit parameter passing (Dependency Injection). This mixed approach creates tech debt and complicates unit testing for the older domain routes.
  - **Synchronous Event-Loop Blocking:** In `server/arduino-service.ts`, methods like `discoverBoards`, `searchLibraries`, and `listCores` use `execSync` and `execFileSync`. Since these are executed within the Node.js Express server process, they will completely block the event loop while waiting for the shell command to return, freezing the entire API for all users during the execution.
  - **Denial of Service (DoS) Vector via Scrypt:** In `server/routes/auth.ts`, the `crypto.scrypt` password hashing function is configured with a high memory cost (`maxmem: 64 * 1024 * 1024` or 64MB). A malicious actor sending concurrent login or registration requests could instantly trigger an Out-Of-Memory (OOM) crash on the Node server before the rate limiter kicks in (10 allowed attempts = 640MB RAM allocated instantly).
  - **In-Memory DoS Vectors (RAG & Embeds):** Both `server/routes/rag.ts` and `server/routes/embed.ts` implement unbounded, in-memory `Map` stores for uploaded documents and circuit embeds rather than using PostgreSQL. RAG documents can be up to 100KB each, and Embeds up to 500KB. An attacker can repeatedly call these endpoints, easily crashing the Node.js process via an Out-of-Memory (OOM) error.

## 10. AI Tools & Data Coupling (server/ai-tools/)
*Evaluating the modularity of the AI toolset.*

- **Findings:**
  - **Data/Logic Coupling:** Tools like `server/ai-tools/manufacturing.ts` contain massive, hardcoded typescript dictionaries (`IPC_STANDARDS` and `VIOLATION_EXPLANATIONS`). This unnecessarily bloats the JavaScript bundle and couples domain knowledge directly to executable logic. These should be moved to JSON configuration files or a database table.

## 11. Client UI & Performance (client/src/components/)
*Evaluating React render paths and UI state.*

- **Findings:**
  - **Memory Bloat in Chat State:** The `ChatPanel.tsx` component handles rendering brilliantly with virtualization (`useVirtualizer`), but the `ChatMessage` type contains an `attachments` array that can hold raw `base64` image data. Storing dozens of messages with massive base64 string payloads entirely in React state will inevitably cause severe memory bloat and GC (Garbage Collection) pauses on the client side.

## 12. Project Routes & Route Handlers (server/routes/)
*Evaluating routing logic, unhandled promises, and implementation completeness.*

- **Findings:**
  - **Unfinished Approval Logic:** In `server/routes/projects.ts`, the `/approve` endpoint does not actually update the `approvedAt` or `approvedBy` database columns. It contains comments noting this tech debt and instead executes a dummy update (`name: project.name`) just to bump the project version.

## 13. Pass 2 Audit Findings (Code Quality, Leaks, and Safety)
*Evaluating deeper patterns, memory leaks, type safety, and framework encapsulation.*

- **Findings:**
  - **Memory Leaks via setInterval:** The codebase contains numerous `setInterval` calls in `server/routes/arduino.ts`, `server/routes/agent.ts`, and `server/routes/chat.ts`. These intervals are often created per-connection or globally but are never assigned to a variable to be cleared with `clearInterval()`. Over time, these dangling intervals will capture closures and leak memory until the Node process crashes.
  - **React Encapsulation Violations:** In `client/src/components/panels/SerialMonitorPanel.tsx` and `BreadboardWireEditor.tsx`, DOM elements are selected directly using `document.querySelector()`. This bypasses React's Virtual DOM and component encapsulation. If multiple instances of these components are ever rendered, or if the DOM structure changes dynamically, these queries will fail or target the wrong elements. React `useRef` should be used instead.
  - **Type Safety Bypasses in Genkit:** In `server/genkit.ts`, the parameter schema for AI tools is cast with `inputSchema: toolDef.parameters as any`. This completely bypasses TypeScript's safety checks and effectively disables Zod validation at the boundary between Genkit's execution and the tool definition, meaning invalid LLM outputs might not be caught before executing database mutations.

## 14. Pass 3 Audit Findings (Weak Randomness & Collision Risks)
*Evaluating ID generation, cryptographic security, and token generation.*

- **Findings:**
  - **Insecure Math.random() Usage:** Across the codebase, `Math.random()` is used to generate identifiers (e.g. `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` in `server/routes/rag.ts` and `bus-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` in `client/src/lib/circuit-editor/bus-pin-mapper.ts`). `Math.random()` is not cryptographically secure and the entropy generated here is extremely low. At scale, this guarantees ID collisions. The built-in `crypto.randomUUID()` (which is mandated by the project's own documentation) should be used instead.

## 15. Pass 4 Audit Findings (Client-Side Security & Execution)
*Evaluating client-side execution, code compilation, and session storage.*

- **Findings:**
  - **Client-Side Arbitrary Execution (`eval`):** Despite earlier documentation claiming 0 uses of `eval()`, I found that `client/src/components/views/CircuitCodeView.tsx` explicitly calls `debouncedEval(newCode)`. This allows arbitrary JavaScript execution directly within the React application context. If an attacker can share a project with malicious code, or if the AI hallucinates a malicious payload into the Circuit Code View, it will execute with full privileges over the user's session.
  - **Session Hijacking Vulnerability (XSS to Token Theft):** The `client-state-scope.ts` file manages the session by reading from and writing to `window.localStorage.getItem(SESSION_STORAGE_KEY)`. Storing session tokens in LocalStorage makes them permanently accessible via JavaScript. Combined with the `eval()` usage in the Code View and the `dangerouslySetInnerHTML` usage in other parts of the app, any successful Cross-Site Scripting (XSS) attack will immediately lead to full session hijacking, as the attacker's script can simply read the token from `localStorage`. Sessions should be migrated to `HttpOnly` Secure cookies.

## 16. Pass 5 Audit Findings (Native Security, Networking, & Build Tooling)
*Evaluating Tauri Rust bindings, WebSocket/SSE memory management, and Vite build optimizations.*

- **Findings:**
  - **Tauri Security (Disabled CSP):** In `src-tauri/tauri.conf.json`, the configuration explicitly sets `"csp": null`. This completely disables the Content Security Policy within the Tauri WebView. Any Cross-Site Scripting (XSS) payload can now execute uninhibited network requests, load external scripts, and exfiltrate sensitive data without the browser intervening.
  - **Tauri Security (Global API Exposure):** Additionally, `"withGlobalTauri": true` is enabled in `tauri.conf.json`. This injects the powerful Rust Tauri API directly into the global `window.__TAURI__` object. An attacker exploiting the `eval()` vulnerability in the Circuit Code View doesn't even need to bypass bundler imports; they can directly invoke `window.__TAURI__.invoke('spawn_process', ...)` to achieve instant Arbitrary Remote Code Execution (RCE) on the host operating system.
  - **SSE Connection Memory Leaks:** While the streaming endpoint (`server/routes/chat.ts`) listens to `req.on('close')` to abort streams when a user disconnects, the underlying AI execution engine (`server/ai.ts`) completely ignores the passed `abortSignal` inside `executeStreamForProvider`. If a user closes their browser mid-stream, the Node process forgets the user, but the HTTP request to the Gemini API continues running in the background, consuming API tokens and memory until the model decides it has finished generating.
  - **De-optimized Vite Chunking:** In `vite.config.ts`, the custom `manualChunks` strategy isolates massive libraries (`@xyflow`, `react-markdown`, `recharts`, `codemirror`) into their own dedicated vendor chunks. While intended to improve caching, this actually forces all users to download the entirety of these libraries upon initial load—even if they only visit a route that doesn't use them. This defeats Vite's native dynamic import and tree-shaking optimizations, resulting in a massively bloated initial JS payload.

---
*Note: This document will be frequently updated as the audit progresses.*
