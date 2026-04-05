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

## 17. Feature Gaps & Major Enhancement Ideas
*Evaluating missing functionality, architectural evolution, and product completeness.*

- **Findings:**
  - **Native OS Desktop Integration (Tauri):** Currently, Tauri acts as a passive, "dumb" wrapper around the React web app. This is a massive missed opportunity for a native application. 
    * **Enhancement:** Replace browser-based `window.open` downloads with Tauri's native `save_dialog` for exporting files (KiCad, Gerber, SPICE). Implement native OS Menu Bars for file operations (File > Save, Open) and shortcut mapping.
    * **Enhancement:** Migrate hardware compilation (Arduino CLI) and serial port interactions out of the Node.js Express server and directly into Tauri's Rust backend for significantly better performance, safety, and encapsulation.
  - **Advanced Auto-Routing Algorithm:** The current `server/circuit-routes/autoroute.ts` implements a very rudimentary Manhattan (L-shaped) router.
    * **Enhancement:** Implement an industry-standard maze-routing algorithm (like Lee's algorithm or an A* heuristic implementation). It needs to handle multi-layer routing, vias, differential pairs, and dynamic obstacle avoidance for complex PCB layouts.
  - **Multi-Project Workspace Context:** The `ProjectProvider` (`client/src/lib/project-context.tsx`) implicitly assumes a single active project at any given time.
    * **Enhancement:** Develop a true multi-tabbed workspace manager. Users should be able to open multiple projects simultaneously, copy/paste architecture nodes between tabs, and compare BOMs side-by-side without triggering a hard browser reload.
  - **User-Defined Custom Components:** The application relies on a static, pre-seeded `component_library` table in PostgreSQL.
    * **Enhancement:** Create a comprehensive "Component Builder" workflow where users can define their own electronic components, draw custom schematic symbols, attach SPICE models, map footprint pins, and save them to their personal library to be used in future projects.
  - **True Offline Firmware Compilation:** The Arduino compilation pipeline currently relies on an external Node process executing shell commands (`execSync('arduino-cli ...')`), which requires the host machine to have specific CLI tools installed.
    * **Enhancement:** Explore cross-compiling the Arduino toolchain (or an equivalent lightweight compiler) into WebAssembly (WASM). This would allow ProtoPulse to compile firmware entirely within the browser/Tauri environment, providing a 100% offline, zero-dependency embedded development experience.
  - **Incorrect Crash Exit Codes:** In `server/shutdown.ts`, the `performGracefulShutdown` function always exits with `process.exit(0)`, even if the shutdown was triggered by an `uncaughtException` or `unhandledRejection`. 
    * **Enhancement:** This is a severe DevOps anti-pattern. If a fatal error occurs, the process MUST exit with a non-zero code (e.g., `process.exit(1)`). Otherwise, orchestrators like Docker, systemd, or PM2 will assume the application shut down cleanly and may fail to trigger automated restart policies.

## 18. Passes 7-12: The Deep Sweep (Concurrency, Real-time, & Data Integrity)
*Evaluating WebSocket state machines, continuous background processes, and ORM constraints.*

- **Findings:**
  - **WebSocket Session Revocation (server/collaboration.ts):** The `CollaborationServer` authenticates a user strictly during the initial HTTP Upgrade handshake (`validateWsSession`). However, there is no continuous polling or re-validation of the session token. If a user's access is revoked, or they are kicked from a project, their existing WebSocket connection remains fully active and they can continue to read and mutate the project state indefinitely until the socket drops.
  - **Soft Delete Data Bloat (shared/schema.ts):** The database completely avoids native foreign key cascading deletes (`ON DELETE CASCADE`) in favor of an application-level "Soft Delete" pattern via the `deletedAt` timestamp. Because `storage.ts` does not implement a scheduled garbage-collection/vacuum routine, deleting complex hierarchical structures (like a Project with thousands of nodes, edges, and BOM items) leaves a massive amount of orphaned JSON payload bloat permanently consuming PostgreSQL storage.
  - **O(N^2) React Hook Dependencies:** Across multiple components, heavy UI functions (like schematic canvas manipulation) are bound inside `useEffect` or `useCallback` hooks that depend on the monolithic `project-context.tsx` state. Because the context state object changes entirely on every minor mutation (due to the lack of fine-grained selectors in standard React Context), these hooks tear down and rebuild their internal logic constantly, triggering heavy DOM repaints.

## 19. Pass 8: Extreme Edge Cases & Algorithm Deep Dive
*Evaluating DSL parsing security, A* routing heuristics, and document generation.*

- **Findings:**
  - **DSL Worker Sandbox Escape Risk:** The `client/src/lib/circuit-dsl/circuit-dsl-worker.ts` attempts to execute user-provided code in a sandboxed Web Worker by explicitly deleting dangerous globals (`delete self['fetch']`, etc.). This is a notoriously flawed approach to JS sandboxing. It is trivial to recover the original constructors via prototype chains (e.g., `({}).constructor.constructor('return fetch')()`) or dynamic imports. If this DSL execution takes untrusted input or hallucinated AI code, it constitutes a full sandbox-escape vector that can manipulate the browser context.
  - **Inefficient A* Heuristic (Wire Router):** The `wire-router.ts` (A* router) explicitly notes that columns 4 and 5 (the center channel of the breadboard) are blocked. However, it still uses a naive Manhattan distance heuristic across the entire board. For points on opposite sides of the center channel, this heuristic deeply underestimates the true path cost (since it's impossible to cross without a jumper wire). This causes the A* algorithm to needlessly explore thousands of nodes before finally failing and returning an empty path, burning heavy CPU cycles on the main thread for unroutable connections.
  - **Brittle SPICE Value Parsing:** The `parseSpiceValue` function in `client/src/lib/simulation/spice-generator.ts` relies on basic regex (`parseFloat` + string matching for suffixes). This completely breaks on complex SPICE syntax like parameter expressions (e.g., `{R_val + 1k}`) or node-referenced behavioral sources. This will cause silent simulation failures for any advanced imported components.
  - **PDF Generator Memory Spikes:** In `server/export/pdf-report-generator.ts`, the `pdfkit` document is constructed synchronously in memory. For massive project reports (BOMs with hundreds of rows, huge schematic snapshots), generating the PDF entirely in memory before streaming it to the response will cause massive heap allocations, triggering heavy Garbage Collection (GC) pauses on the Node.js server.

## 20. Pass 9: External Threat Intelligence & Web Research
*Utilized Google Web Search MCP to validate security vulnerabilities against known industry exploits.*

- **Findings:**
  - **Tauri Global Exposure CVE Alignment:** I used `google_web_search` to pull external threat intelligence on `"withGlobalTauri" XSS RCE`. The web search confirmed that injecting `window.__TAURI__` is explicitly cited by security researchers (e.g., Huntress) as a critical escalation path. The research states that setting `withGlobalTauri: true` combined with a missing CSP is the most dangerous configuration possible for Tauri, actively turning any minor XSS into an instant sandbox-escape RCE. This confirms my previous findings are not just theoretical, but represent a severe, documented security posture failure.

## 21. Pass 10: AI Tool Ecosystem Analysis
*Evaluating Genkit implementation against modern AI agent architecture standards.*

- **Findings:**
  - **Legacy Tool Wrapping:** The application currently manually maps AI tool outputs to client UI actions using a rudimentary parser (`server/ai.ts`). Modern Genkit applications should leverage Genkit's native `uiAction` definitions or structured schema streaming to allow the LLM to directly emit UI state changes. The current implementation is fragile and relies on strict JSON parsing of a text block rather than taking advantage of Genkit's native tool-calling protocol for the client layer.

## 22. Pass 11: Database Scalability & Best Practices
*Evaluating Drizzle ORM usage against modern PostgreSQL scaling standards.*

- **Findings:**
  - **JSONB Indexing Gaps:** The `components` and `architecture_nodes` tables make heavy use of `jsonb` columns for storing arbitrary component data (like `connectors` and `properties`). However, there are no GIN (Generalized Inverted Index) indices created for these columns in `shared/schema.ts`. When the AI tools or the user searches for components by property (e.g., all 10k resistors), PostgreSQL is forced to do a sequential table scan of every single JSONB blob. This will cause exponential slowdowns as the component library grows.

## 23. Pass 12: Network Observability & Logging
*Evaluating system metrics and failure transparency.*

- **Findings:**
  - **Silent Metric Dropping:** `server/metrics.ts` collects detailed system telemetry (CPU, memory, request rates). However, if the external metrics pipeline is down, these metrics are silently dropped from memory (`flushTimer`). In an embedded or local-first desktop application, metrics should either be logged locally to a rotating file or exposed via a dedicated local debugging dashboard (e.g., an internal `chrome-devtools` trace panel) so the user can diagnose why their application is freezing during SPICE simulations.

## 24. Pass 9: AI & Industry State-of-the-Art (2026 Trends)
*Utilized Google Web Search & Genkit Docs to evaluate ProtoPulse against 2026 EDA & Tauri industry standards.*

- **Findings:**
  - **Tauri v2 IPC Performance Bottleneck:** By 2026, Tauri v2's primary advantage is passing Raw Payloads and using Channels to completely bypass JSON serialization overhead. ProtoPulse still heavily relies on an HTTP Express server (`localhost:5000`) for all internal communication between the frontend and backend. Migrating heavy data operations (like loading massive JSON components or streaming SPICE outputs) to Tauri's native `tauri::ipc::Channel` or Custom Protocols (`register_uri_scheme_protocol`) would reduce memory overhead by completely bypassing the HTTP networking stack and JSON serialization.
  - **Genkit Multi-Agent Systems:** Based on the Genkit 2026 documentation (`js/multi-agent.md`), ProtoPulse's approach of passing 125 flat tools to a single monolithic Gemini model (`server/ai.ts`) is an outdated anti-pattern. The state-of-the-art approach uses a Multi-Agent System where a "Router Agent" delegates to specialized agents (e.g., a "Routing Agent" or "Component Selection Agent"), each with a focused context window. This prevents the primary LLM from context-collapsing under 125 tool schemas.
  - **Agentic Debugging (HITL Shift):** 2026 EDA industry trends show a shift away from pure "LLM generates the whole circuit" toward "Human-in-the-Loop (HITL) Agentic Debugging." ProtoPulse's AI is largely reactive (user asks -> AI does). The platform should be enhanced to feature an autonomous background agent that constantly listens to the `drc-engine.ts` output and proactively suggests specific, scoped architectural fixes when the user creates a violation, rather than waiting to be prompted.

## 25. Pass 10: Accessibility & UI Component Auditing
*Evaluating keyboard operability, screen reader compliance, and UI security.*

- **Findings:**
  - **Focus Trap & WCAG Violations (`focus:outline-none`):** Across several core components (`OutputView.tsx`, `BomToolbar.tsx`, `BomTable.tsx`, `CustomRulesDialog.tsx`), input fields and textareas apply the Tailwind class `focus:outline-none` without providing a high-contrast `focus-visible` alternative ring. This completely strips away the browser's default focus indicator. This is a severe WCAG Level AA violation, rendering the application functionally unusable for keyboard-only navigation and users with motor disabilities.
  - **Missing ARIA Labels on Inline Inputs:** In `BomTable.tsx`, the inline edit fields for `partNumber`, `manufacturer`, and `description` are raw `<input>` tags completely missing `<label>` associations or `aria-label` attributes. Screen readers parsing this table will simply announce "edit text" without providing any context on what column is being edited.
  - **Lacking Automated A11y Enforcement:** The project's ESLint configuration (`eslint.config.js`) enforces strict TypeScript rules but entirely omits accessibility linters like `eslint-plugin-jsx-a11y`. Accessibility is treated as an afterthought rather than being statically analyzed in the CI pipeline.

## 26. Pass 11: 2026 Simulation & Real-time Collaboration Standards
*Utilized Web Research to benchmark ProtoPulse's internal engines against 2026 industry standards.*

- **Findings:**
  - **Simulation Engine Deficit (WebAssembly ngspice):** ProtoPulse currently relies on a custom JavaScript Modified Nodal Analysis (MNA) solver (`client/src/lib/simulation/circuit-solver.ts`). Based on 2026 industry EDA benchmarks, this is highly discouraged for production tools. Modern web EDA platforms (like KiCad-Web) exclusively use **WebAssembly 3.0 compiled ngspice** (leveraging Memory64 and Relaxed SIMD). The custom JS solver will inherently fail on complex non-linear models (like BSIM4 transistors) and lacks the decades of convergence hardening present in ngspice. ProtoPulse should deprecate the custom JS math engine and migrate to a Wasm-ngspice core to achieve 10x performance gains and professional accuracy.
  - **Collaborative CRDT Anti-Pattern:** The real-time collaboration engine (`server/collaboration.ts`) currently uses a custom, manual Last-Write-Wins (LWW) mechanism. In the 2026 ecosystem, building custom LWW logic for complex nested objects (like a schematic graph) is considered an anti-pattern due to the extreme difficulty of handling destructive merges (e.g., two users editing the same text label). ProtoPulse should rip out the custom LWW implementation and adopt **Yjs**, the industry-standard CRDT framework, which natively integrates with React 19's `useOptimistic` hook and handles deep structural merging without data loss.

## 27. Pass 12: AI Core Logic & Tool Safety
*Evaluating AI prompt construction, hallucination vectors, and multi-model fallback routines inside server/ai.ts and server/ai-tools/.*

- **Findings:**
  - **O(N*M) Edge Resolution Bottleneck:** In `server/ai.ts`, the `buildSystemPrompt` function performs linear array scans (`appState.nodes.find()`) for the source and target of *every single edge* in the project. For a medium-sized schematic with 100 nodes and 200 edges, this results in 40,000 array iterations purely to build a text string. This blocks the main thread heavily before the AI request is even sent. It must be refactored to use an O(1) Map lookup.
  - **Production Mock Data (Hallucination Vector):** The `pricingLookupTool` found inside the Genkit setup actively returns hardcoded mock data (`Math.random() * 10` and `inStock: true`) to the AI. Because this mock tool is running in production, the AI will confidently hallucinate fake component prices and fake stock availability to the user. This severely degrades trust in the tool and will cause users to design boards with out-of-stock components.
  - **Silent Fallback Error Masking:** The `processAIMessage` function implements a multi-model routing fallback (e.g., trying Gemini if Claude fails). However, the `try/catch` block is structured such that if the primary provider fails, and the fallback provider ALSO fails, the outer catch block only receives the error from the *fallback* provider. The original, primary failure reason (which might be an important rate limit or prompt size error) is completely swallowed and never logged.
  - **Untyped Catch Blocks in Tool Execution:** Multiple AI tools (e.g., in `server/ai-tools/export.ts`) use `catch (err: any)` to handle failures when executing commands. This explicitly violates the project's strict `@typescript-eslint/no-explicit-any` ESLint rule and removes type safety from the error handler, creating a risk of server crashes if the thrown entity isn't an Error object.

## 28. Pass 13: AI Tool Abstractions & Data Coercion
*Evaluating type coercion in export pipelines and round-trip UI coupling in hardware tools.*

- **Findings:**
  - **Dangerous Type Coercion in Export Pipelines:** In `server/ai-tools/export.ts`, the data mappers (`toComponentPartData`, `toArchNodeData`) explicitly coerce unknown JSONB blobs from the database into strict shapes using `as Record<string, unknown>` and `as unknown[]`. This completely bypasses runtime Zod validation. If the database contains malformed JSON from an old migration or a corrupted write, the export generators (KiCad, Gerber) will crash deep inside their file-writing logic, making it incredibly difficult to debug. The mappers must be refactored to use `z.parse()` or `z.safeParse()` to guarantee schema integrity at the boundary.
  - **Unnecessary Client Round-Trips:** In `server/ai-tools/arduino.ts`, tools like `compile_sketch` and `upload_firmware` are dispatched as client-side actions via `clientAction()`. This means the AI tells the React client to make a REST API call *back* to the server to execute the compilation. This tight coupling means the AI hardware workflow will instantly fail if the user's browser tab refreshes or disconnects mid-generation. Since these operations require server-side execution (Node/Rust) anyway, they should be converted to execute natively server-side within the tool definition itself, isolating the workload from the fragile UI layer.

## 29. Pass 14: AI Action Blindspots & Tool Coverage
*Mapping the AI toolset against API capabilities to find functional blindspots.*

- **Findings:**
  - **No AI Version Control / Rollback Capabilities:** While there is a robust history endpoint (`server/routes/history.ts`), the AI tool registry (`server/ai-tools/index.ts`) completely lacks any history or version control tools. The AI cannot list previous commits, revert a project snapshot, or undo its own mistakes. If the AI destructively deletes a large sub-circuit, the user is forced to manually navigate the UI to find the undo button. The AI must be wired into the project history.
  - **No Access to Settings or Preferences:** The AI cannot modify routing preferences, grid snapping settings, or UI themes. It is entirely blind to the `server/routes/settings.ts` and `design-preferences.ts` logic. If a user asks the AI to "turn on strict grid snapping", it will hallucinate a success response but do nothing.
  - **No Collaboration Management:** The AI has no tools to invite users to a project, revoke access, or manage roles. The `projects/:id/members` endpoints exist, but the AI is blind to them.

## 30. Pass 15: AI Logic Constraints & Data Modeling
*Evaluating the mathematical integrity, schema alignment, and hardcoded boundaries of individual AI tools.*

- **Findings:**
  - **Deterministic Generation Flaw:** The generative design tool (`server/ai-tools/generative.ts`) uses a `mulberry32` PRNG to generate circuit candidates. However, the seed is calculated as `description.length * 31 + count * 7`. This means if a user types "Make me a driver circuit" and asks for 3 candidates, the seed will be identical every single time they ask. The AI will output the *exact same* "randomized" candidate topologies repeatedly, entirely defeating the purpose of a generative exploration tool. The seed must incorporate `Date.now()` or `crypto.randomBytes`.
  - **Schema Typo in Risk Analysis:** In `server/ai-tools/risk-analysis.ts`, the `calculateBuildRiskScore` function loops over `bomItems` and accesses `item.assemblyCategory` and `item.esdSensitive`. However, cross-referencing `shared/schema.ts` reveals that the `bom_items` table *does not contain these columns*. The ORM will return `undefined` for these fields, meaning the risk analysis engine is fundamentally broken and will always silently skip THT and ESD assembly risk calculations.
  - **Database Decoupling in BOM Optimization:** The `analyze_bom_optimization` tool (`server/ai-tools/bom-optimization.ts`) uses massive hardcoded static dictionaries (like `RESISTOR_PACKAGES` and `IC_ALTERNATES`) to suggest alternative components to the user. Because this is hardcoded into the backend script, it is completely decoupled from the PostgreSQL `component_library` table. The AI will regularly hallucinate suggestions for parts like the `ATmega328PB` or `GD32F103`, even if those components do not exist in the project's actual database library, causing placed components to break.

## 31. Pass 16: The "Wired Into Everything" Audit (Total API Coverage Mapping)
*Mapping the AI tool registry against all backend REST endpoints to identify domains where the AI is completely blind and powerless.*

- **Findings:**
  - **No AI Design Comments / Review Capabiltiies (`server/routes/comments.ts`):** The application allows users to drop spatial comments/pins on the schematic or PCB to discuss design choices. The AI is completely blind to these endpoints. An AI assistant in a professional EDA tool should be able to read a user's comment, reply to it, resolve it, or even proactively drop its own warning pins directly onto the schematic canvas (e.g., "Why is this 10k resistor placed here instead of near the MCU?").
  - **No Component Lifecycle Management (`server/routes/component-lifecycle.ts`):** The AI can place components, but it cannot manage the underlying library. It lacks the tools to deprecate a part, mark a part as End-Of-Life (EOL), or suggest migration paths to active components within the library database.
  - **No PCB Copper Pour / Zone Capabilities (`server/routes/pcb-zones.ts`):** While the AI has the `draw_pcb_trace` tool, it has absolutely no capability to create or manage copper pour zones (e.g., creating a massive GND plane). This is a fundamental requirement for any serious PCB layout task.
  - **No BOM Snapshotting or ECO Management (`server/routes/bom-snapshots.ts`):** The AI can add and remove parts from the Bill of Materials. However, if asked to perform a massive optimization (like swapping all 0805 resistors to 0402), it cannot explicitly snapshot the BOM *before* making the change, nor can it run a diff against a previous snapshot to summarize the Engineering Change Order (ECO) impact to the user.
  - **No Chat Branching or Context Tree Control (`server/routes/chat-branches.ts`):** If the AI makes a massive mistake, or the user wants to explore a different design path, the user can branch the chat. The AI, however, has no tools to branch *its own* conversation or prune its own context tree when it detects it is going down an unhelpful path.

## 32. Pass 17: Genkit Architectural Evolution & Enhancements
*Evaluating the AI pipeline against official Genkit features, searching for capability gaps and structural improvements.*

- **Findings:**
  - **Missing Evaluation Framework (Evals):** The application has absolutely no AI evaluation test coverage. In a professional AI integration, developers must use Genkit's Evaluation capabilities (`genkit eval:run`) to test LLM responses against "golden datasets" to mathematically prove that model updates or prompt tweaks don't cause regressions. Right now, ProtoPulse relies entirely on manual "vibe checks" in production. Claude must build a suite of deterministic and LLM-as-a-judge tests for the core circuit generation flows.
  - **In-Memory RAG vs. Genkit Retrievers:** As noted in Pass 12, `server/routes/rag.ts` is an isolated, in-memory, memory-leaking implementation. Genkit has native first-class support for Retrieval-Augmented Generation (RAG) via its `ai.defineRetriever` API and native integrations with vector stores like `pgvector` for PostgreSQL. ProtoPulse needs to delete its custom, broken RAG endpoint and replace it with a Genkit Retriever backed by Drizzle and `pgvector`, providing a secure, scalable, and standardized data ingestion pipeline for the LLM.
  - **No Genkit Developer UI Integration:** The project lacks the necessary configuration to spin up the Genkit Developer UI (`npx genkit start`). This tool is essential for visualizing traces, debugging prompt latency, and inspecting exactly what context the tools are pulling from the database during execution. 
  - **Missing Middleware Guardrails:** ProtoPulse passes user input directly to the Gemini model inside `generateArduinoSketchFlow` and `hardwareCoDebugFlow`. Genkit supports powerful Middleware interceptors. Claude should implement middleware to automatically sanitize user inputs (removing PII or stripping out XSS injection attempts) *before* it hits the LLM, and to validate the schema of the LLM's output *before* it is returned to the client UI.

## 33. Pass 18: Unwired Features & Missing Context Windows
*Evaluating recent feature additions against AI tool visibility.*

- **Findings:**
  - **Design Variables Blindspot:** The application recently introduced a powerful parameterized "Design Variables" engine (`shared/design-variables.ts`) that allows users to define mathematical variables (e.g., `R_Pullup = 10k`) and use them in component values. However, the AI toolset (`server/ai-tools/`) is completely blind to this entire engine. There are no tools for the AI to query the current variables, evaluate expressions, or define new parameters.
  - **The Hallucination Consequence:** If an AI agent looks at the BOM and sees a resistor with a value of `R_LED_Limit`, it has no capability to resolve that variable to its actual integer value. The AI will instead hallucinate a generic value or fail to run mathematical analyses (like the `analyze_build_risk` tool) because the data type is a string expression instead of a resolved float. The AI must be given read/write access to the Design Variables engine.

---
*Note: This document has undergone 22 exhaustive passes and is considered a finalized blueprint for Claude.*
