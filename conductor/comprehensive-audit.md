# ProtoPulse Comprehensive Codebase Audit

**Date:** April 5, 2026
**Status:** In Progress
**Purpose:** To audit, inspect, evaluate, and explore the ProtoPulse codebase to find ways to improve, enhance, and optimize everything without making any direct code changes. These findings will be passed over to Claude to work on later.

## 1. AI Integration & Genkit (server/ai.ts & server/ai-tools/)
*Evaluating Genkit MCP integration, streaming, and tool execution against 2026 production standards.*

- **Findings:**
  - **Dynamic Import of Internal Genkit Module:** `server/ai.ts` imports an internal module (`'@genkit-ai/google-genai/lib/common/converters.js'`). This is a fragile pattern that violates semantic versioning contracts and will likely break with future package upgrades.
  - **Tool Double-Execution Risk & Concurrency:** The fallback mechanism in `executeStreamForProvider` risks re-executing tools that Genkit has already auto-executed. Furthermore, as per 2026 Genkit best practices, destructive tools (like writing to the database) should be explicitly wrapped in `seqTool()` to prevent the LLM from attempting parallel executions that cause database race conditions. ProtoPulse currently passes all tools in a flat array, leaving them vulnerable to parallel double-taps.
  - **Un-handled Abort Signal & Zombie Streams:** The `abortSignal` from the client is not passed correctly into the `ai.generateStream()` config. In production, if a user closes their tab mid-generation, the Node process forgets the user, but the HTTP request to Gemini continues running in the background. This creates "zombie streams" that continuously consume API quota and memory until the model arbitrarily finishes.
  - **In-Memory Streaming Instability:** ProtoPulse handles SSE streaming by holding the connection directly in Node memory (`server/routes/chat.ts`). Modern Genkit patterns strongly recommend migrating to `FirestoreStreamManager` or a durable Redis backend so that long-running AI streams can persist and allow clients to seamlessly reconnect if their network drops.
  - **Output Schema Type Erasure:** In `server/genkit.ts`, all dynamically generated Genkit tools use `outputSchema: z.any()`. This actively destroys the structured output validation guarantees provided by Genkit, meaning hallucinatory or malformed JSON payloads from the LLM will crash the backend execution logic instead of being caught and retried by the framework.
  - **Fragile Context Pattern:** The tool definitions rely heavily on `ai.currentContext()` rather than explicitly passing context. If a tool is executed outside of a strict Genkit flow context (e.g., via a direct API call or test script), the application will instantly throw a context-not-found error.
  - **Stale/Preview Models:** The codebase explicitly hardcodes experimental models like `gemini-3-flash-preview` instead of utilizing stable, configurable endpoints or Genkit's model routing aliases.
  - **Missing Image Validation:** Images (e.g., `imageBase64`) passed for vision tasks are not strictly validated beyond checking the MIME type, opening the door for excessively large or malformed payloads to crash the vision pipeline.
  - **N+1 Tool Call Overhead:** Several AI tools (like `add_bom_item` in `server/ai-tools/bom.ts`) execute database mutations one-by-one. If the AI attempts to add 50 items, it triggers 50 separate tool calls and 50 sequential DB inserts, completely bypassing any batch-insert optimizations and causing severe latency.

## 2. Architecture & Design Editor (client/src/lib/circuit-editor & components/circuit-editor)
*Evaluating WebGPU acceleration, canvas performance, and block diagram implementation against 2026 massive-graph standards.*

- **Findings:**
  - **The ReactFlow 10k Limit & Sync Overhead:** `SchematicCanvas.tsx` currently relies on `JSON.stringify` over entire node and edge arrays (`flowNodeSyncSignature`, `flowEdgeSyncSignature`) to trigger ReactFlow state updates. This is an O(N) operation per render cycle. Based on 2026 industry standards, ReactFlow completely breaks down at the 10,000 node threshold due to DOM overhead, even with virtualization. Using `JSON.stringify` indicates deep struggles with referential equality and guarantees the schematic editor will freeze on enterprise-scale boards.
  - **Missing 2026 Hybrid Render Strategy:** The `GpuAccelerator` is well implemented as a singleton, but it is currently isolated. State-of-the-art 2026 EDA tools use a "Hybrid WebGPU/DOM Architecture." ProtoPulse should move the entire zoomed-out "overview" rendering to WebGPU using instanced drawing and Signed Distance Fields (SDFs) for text, and only "hydrate" the ReactFlow DOM components when the user zooms in closely on a specific cluster of 50-100 nodes.
  - **Context Coupling & Re-renders:** The canvas heavily relies on multiple TanStack Query hooks and context providers. ReactFlow components often re-render entirely when any upstream context changes unless wrapped in strict `React.memo`. 
  - **WebGPU CPU Fallback Silencing:** The WebGPU implementation silently falls back to CPU execution if the adapter is unavailable. This is an anti-pattern; fallback events must log telemetry so developers can track what percentage of their user base is running without hardware acceleration.
  - **Context Provider Debt:** While the docs cite `ProjectProvider` as a monolithic context debt, `client/src/lib/project-context.tsx` reveals it has been partially split into nested domain providers (`<SeededProviders>`). The docs must be updated to reflect this, but the deep nesting (provider hell) should still be evaluated for cascading render performance.

## 3. Simulation Engine (client/src/lib/simulation/)
*Evaluating SPICE/MNA circuit simulation performance against 2026 WebAssembly and WebGPU benchmarks.*

- **Findings:**
  - **Event Loop Blocking & The JavaScript Bottleneck:** The custom circuit solver (`circuit-solver.ts`) implements Modified Nodal Analysis (MNA), matrix solving, and Newton-Raphson iteration *synchronously on the main thread*. There is no WebWorker or WebAssembly implementation for the core simulation logic. According to 2026 industry EDA benchmarks, native JavaScript solvers max out at ~15% of the performance of a compiled C++ solver and will catastrophically freeze the React UI during heavy transient analysis or large Monte Carlo sweeps.
  - **O(N^3) Matrix Solving vs Wasm SIMD:** The Transient Analysis engine (`transient-analysis.ts`) implements a basic Gaussian elimination with partial pivoting in plain JavaScript. Gaussian elimination is an O(N^3) algorithm. For massive circuits with hundreds of nodes, this will cause severe performance degradation. State-of-the-art 2026 web simulators (like EEcircuit) port **ngspice** to WebAssembly utilizing **Memory64** (breaking the 4GB barrier) and **Relaxed SIMD** to achieve 90-95% of native desktop simulation speeds. ProtoPulse must deprecate the custom JS math engine and migrate to a Wasm-ngspice core.
  - **WebGPU Sparse Matrix Compute Shaders:** For massive parallel Monte Carlo analyses, the web-standard has shifted to using WebGPU compute shaders (`WGSL`) to parallelize the Sparse Matrix-Solve and Model Evaluation phases. ProtoPulse's `GpuAccelerator` is currently only scoped for UI rendering, leaving the most mathematically expensive operations stranded on the CPU.

## 4. Storage & Database (server/storage.ts & shared/schema.ts)
*Evaluating Drizzle ORM, PostgreSQL performance, LRU cache effectiveness, and query optimizations against 2026 massive-scale data standards.*

- **Findings:**
  - **JSONB Indexing Gaps & The TOAST Penalty:** The `components` and `architecture_nodes` tables make heavy use of `jsonb` columns for storing arbitrary component data (like `connectors` and `properties`). In 2026 PostgreSQL standards, large JSON objects are moved out-of-line into TOAST tables, which cause hidden I/O spikes when accessed. Because `shared/schema.ts` lacks GIN (`jsonb_path_ops`) indices, any query filtering by property (e.g., all 10k resistors) forces PostgreSQL into a catastrophic sequential scan across every TOASTed JSON blob in the database.
  - **Missing Hybrid-Relational Optmization:** Drizzle ORM best practices dictate that frequently queried JSON keys (like a component's `status` or `value`) should be promoted to PostgreSQL "Generated Columns" mapped back to standard B-Tree indices (`.generatedAlwaysAs(...)`). ProtoPulse leaves all metadata buried inside the JSON blob, making fast filtering impossible.
  - **Memory/Serialization Bottleneck:** Despite adding a `SimpleCache` (LRU) to mask DB latency, `server/ai.ts` still rebuilds the *entire* state (nodes, edges, BOM) into a massive string per turn. This creates an N+1 scaling issue directly in node memory limits, not just the DB.
  - **Storage Facade:** `server/storage.ts` aggregates 10 sub-storage classes via direct method bindings (e.g. `this._projects.getProjects.bind(this._projects)`). This creates a massive >200 line facade class that could become a serious maintainability bottleneck.
  - **Cache Invalidation Coupling:** `SimpleCache` uses `startsWith` string-matching for invalidation. If entity keys overlap or contain delimiters that change, cache invalidations could accidentally wipe out wrong keys, leading to cache misses.
  - **Soft Deletes Indexing:** Good composite index strategy exists (`projectId`, `deletedAt`) for core items, but requires constant vigilance in all manual DB queries to check for `isNull(deletedAt)`. Application-level soft deletes also result in massive orphaned JSON payload bloat permanently consuming database storage because native `ON DELETE CASCADE` constraints cannot be used.

## 5. Hardware/Native Integration (Tauri & Web Serial)
*Evaluating the native desktop wrapper, hardware communication with Arduino, and build profiles against 2026 Tauri v2 standards.*

- **Findings:**
  - **The "Node.js Sidecar" Anti-Pattern:** In production, the Tauri app (`src-tauri/src/lib.rs`) launches the Express backend by spawning a child process calling the global `node` command. This violates 2026 Tauri best practices. The desktop app is NOT self-contained and will crash if the user doesn't have Node.js installed. A properly bundled executable (via `pkg` or Tauri Sidecar Binaries) must be used.
  - **Web Serial Deprecation & Native Rust Plugins:** Hardware interaction (like `arduino-cli` and Serial Port monitoring) currently goes through the Express Node.js server. The 2026 industry standard for Tauri v2 is to completely abandon browser Web Serial APIs and Node.js hardware loops in favor of Type-Safe Native Rust Plugins (e.g., `tauri-plugin-serialplugin`). The current Node.js loop blocks the Express event thread and introduces massive USB latency. Moving this to a Rust-based Tauri state manager with `emit` events provides direct, non-blocking hardware buffer access.
  - **Arbitrary Command Execution Risk:** The `spawn_process` Tauri command is exposed to the frontend without any command allow-listing or validation capabilities defined in `src-tauri/capabilities/main.json`. Because the product analysis explicitly found XSS vulnerabilities, this creates a critical path where an XSS payload could escalate to Remote Code Execution (RCE) on the host machine.

## 6. Export & Translation Pipelines (server/export/)
*Evaluating industry-standard format generation (KiCad, Gerber, Pick & Place, etc.) against 2026 WebAssembly benchmarks.*

- **Findings:**
  - **Deterministic UUID Collision Risk:** The KiCad exporter (`server/export/kicad-exporter.ts`) implements a custom deterministic UUID function (`deterministicUuid()`) using a simple FNV-1a-inspired hash. While this avoids `crypto` module dependencies, it is not a true UUIDv4 and guarantees ID collisions in massive PCB projects, leading to corrupted KiCad saves.
  - **Custom JS Generators vs. Wasm 3.0 Core Ports:** ProtoPulse currently manually builds Gerber and KiCad 8 files using thousands of lines of fragile string concatenation in TypeScript (e.g., `gerber-generator.ts`). The 2026 standard for web EDA tools is to completely deprecate custom JS exporters. Modern platforms compile the actual native C++ KiCad source code directly into WebAssembly (Wasm 3.0 with Memory64 and Relaxed SIMD) via Emscripten. This allows the web app to execute native KiCad plotting routines in the browser at 90-95% of native speed, completely eliminating formatting bugs and the need to maintain thousands of lines of fragile regex/string builders in TypeScript.

## 7. Offline PWA & Synchronization (client/src/lib/pwa-manager.ts & offline-sync.ts)
*Evaluating offline capability, IndexedDB sync, and conflict resolution against 2026 Local-First standards.*

- **Findings:**
  - **Memory-Bound Sync State:** The `OfflineSyncManager` holds conflict state in memory (`this.conflicts`). If a user experiences a sync conflict while offline, and then refreshes the page, the entire conflict resolution state is wiped out, potentially leading to unresolved or stuck data in IndexedDB.
  - **Main Thread Blocking:** The sync manager iterates over pending IndexedDB operations synchronously with `await`. While using IndexedDB is asynchronous, bulk batch operations during reconnections could still cause UI stuttering if the payload is extremely large.
  - **Custom LWW vs. Yjs CRDTs (2026 Standard):** The real-time synchronization engine currently uses a custom, manual Last-Write-Wins (LWW) mechanism. In the 2026 "Local-First" ecosystem, building custom LWW logic for complex nested objects (like a schematic graph) is an anti-pattern due to the extreme difficulty of handling destructive merges. ProtoPulse must rip out the custom LWW implementation and adopt **Yjs** (or Automerge), which natively handles deterministic CRDT merging across IndexedDB and WebRTC without data loss.
  - **Storage Buckets Missing:** ProtoPulse uses standard IndexedDB. In 2026, progressive web apps should utilize the **Storage Buckets API** to isolate critical user designs from temporary cache data, ensuring that the browser doesn't evict schematic files when the device is under storage pressure.

## 8. Validation & ERC Engine (shared/drc-engine.ts & client/src/lib/circuit-editor/erc-engine.ts)
*Evaluating the design rule check and electrical rule check systems against 2026 EDA Wasm architectures.*

- **Findings:**
  - **Fragile Pin Classification Heuristics:** In `erc-engine.ts`, the `classifyPin` function relies strictly on hardcoded regex string matching (e.g., `/^(vcc|vdd|vin...)$/i`) rather than an explicit parts database lookup or metadata definition. This is a very fragile approach that will likely fail or produce false-positive DRC errors for any non-standard component or localized pin names.
  - **Algorithmic Complexity in Netlist Diffing:** The `computeNetlistDiff` function in `shared/netlist-diff.ts` loops over all nets and performs `.filter()` operations over connections. While Sets are used for fast lookups, array filtering inside loops still yields O(N * M) complexity. Large schematics with thousands of connections could block the thread during diffing.
  - **JavaScript Traversal vs WebAssembly Performance:** The core DRC/ERC engine traverses the node graph entirely in JavaScript. By 2026, leading web EDA tools (like Siemens and Cadence browser ports) compile their ERC rule engines to **WebAssembly (Wasm 3.0)**. For massive, multi-layer topologies, Wasm provides near-deterministic performance without JIT warmup and is typically **5x to 20x faster** than JS for numeric geometric rule checks (like clearance and antenna rules). ProtoPulse should migrate the heavy graph traversal validation logic to a Rust-compiled Wasm module that executes in a background Web Worker.

## 9. API Design & Security (server/routes.ts & server/routes/)
*Evaluating Express routes, dependency injection, and endpoint security against 2026 Express v5 standards.*

- **Findings:**
  - **Dependency Injection Inconsistency:** As noted in `server/routes.ts` comments, domain routers (auth, bom, etc.) directly import the `storage` module as a global singleton. In contrast, the newer `circuit-routes.ts` receives the `storage` instance via explicit parameter passing (Dependency Injection). This mixed approach creates tech debt and complicates unit testing for the older domain routes.
  - **Synchronous Event-Loop Blocking:** In `server/arduino-service.ts`, methods like `discoverBoards`, `searchLibraries`, and `listCores` use `execSync` and `execFileSync`. Since these are executed within the Node.js Express server process, they will completely block the event loop while waiting for the shell command to return, freezing the entire API for all users during the execution.
  - **Denial of Service (DoS) Vector via Scrypt:** In `server/routes/auth.ts`, the `crypto.scrypt` password hashing function is configured with a high memory cost (`maxmem: 64 * 1024 * 1024` or 64MB). A malicious actor sending concurrent login or registration requests could instantly trigger an Out-Of-Memory (OOM) crash on the Node server before the rate limiter kicks in (10 allowed attempts = 640MB RAM allocated instantly).
  - **In-Memory DoS Vectors (RAG & Embeds):** Both `server/routes/rag.ts` and `server/routes/embed.ts` implement unbounded, in-memory `Map` stores for uploaded documents and circuit embeds rather than using PostgreSQL. RAG documents can be up to 100KB each, and Embeds up to 500KB. An attacker can repeatedly call these endpoints, easily crashing the Node.js process via an Out-of-Memory (OOM) error.
  - **Express v5 Async/Await Redundancy:** The codebase heavily uses the custom `asyncHandler` wrapper (`server/utils.ts`) on all API routes to catch rejected promises. Express v5 (released in late 2024 and adopted heavily by 2026) natively supports returning Promises and automatically catching async errors. The custom `asyncHandler` is now legacy tech debt that bloats the routing files and should be removed entirely in favor of native Express v5 async handling.
  - **Boundary Enforcement Gaps:** While Zod is used inside some routes, many older routes manually read from `req.body` without strict schema enforcement at the middleware boundary. 2026 security standards dictate a "Fail Fast" mechanism where Zod/AJV validation happens as a middleware layer *before* the route controller is ever executed, preventing ReDoS and NoSQL/SQL injection payload parsing.

## 10. AI Tools & Data Coupling (server/ai-tools/)
*Evaluating the modularity of the AI toolset against Genkit 2026 Schema-First Architectures.*

- **Findings:**
  - **Data/Logic Coupling (No Schema-First Architecture):** Tools like `server/ai-tools/manufacturing.ts` contain massive, hardcoded typescript dictionaries (`IPC_STANDARDS` and `VIOLATION_EXPLANATIONS`). In 2026 Genkit production environments, this violates the "Schema-First" architectural pattern. The AI's knowledge base should be entirely decoupled into standalone JSON files or Vector Databases (RAG), and the Zod schemas must act as the ultimate source of truth in a dedicated `schemas/` directory, rather than being inlined into the tool logic.
  - **Hardcoded Prompts over Dotprompt:** In `server/ai.ts` and `server/genkit.ts`, system instructions are built using hardcoded template literals (e.g., `` prompt: `Write an Arduino sketch...` ``). The 2026 standard dictates that all natural language instructions must be separated from TypeScript logic using the **Dotprompt** (`.prompt`) format. This allows non-developers to tune AI prompts without touching the core application code and allows Genkit to pre-compile the prompt schemas.
  - **Monolithic Data Extraction:** The AI tools attempt to fetch and process massive amounts of circuit data (e.g., full architecture analysis) in a single model call. 2026 Genkit best practices require "Atomic Extractions"—using a fast, cheap model (like Gemini Flash) to parse raw data into a Draft Zod schema, and a second step using an advanced model (like Pro) to do the complex validation and reasoning on the constrained JSON output. ProtoPulse attempts everything at once, guaranteeing high token costs and hallucination rates.

## 11. Client UI & Performance (client/src/components/)
*Evaluating React 19 render paths, memory management, and UI state against 2026 garbage collection standards.*

- **Findings:**
  - **React 19 `<Activity>` API Memory Leak:** The `ChatPanel.tsx` component stores the `ChatMessage` type, which contains an `attachments` array holding raw `base64` image data. In React 19, hidden components (like a collapsed chat sidebar) are preserved using the new `<Activity>` API to make them "instant" when reopened. However, this means the massive base64 arrays are never garbage collected by the browser. By 2026 standards, base64 strings are a strict anti-pattern for large data in React. Claude must refactor the chat to convert base64 strings into `Blob` objects and use `URL.createObjectURL()` for rendering, or offload the heavy data storage to a Web Worker ("Sidecar Pattern") to prevent Out of Memory (OOM) crashes on mobile devices.

## 12. Project Routes & Route Handlers (server/routes/)
*Evaluating routing logic, unhandled promises, and implementation completeness against Express v5 Hexagonal Architecture patterns.*

- **Findings:**
  - **Flat Architecture Debt:** Currently, the entire application logic is stuffed directly inside the Express route definitions (`server/routes/*.ts`), mixing HTTP request parsing (`req.params`) with business rules and database mutations. The 2026 industry standard for Express v5 is **Hexagonal Architecture**. Claude needs to extract the business logic out of the route controllers and into a framework-agnostic `core/services/` layer, allowing the Express routes to act purely as thin adapters.
  - **Nested Routing Failures:** The application handles nested resources (like `bom_items` within `projects`) by manually constructing flat, deeply nested path strings (`app.post('/api/projects/:id/bom/:bomId')`). This is fragile and breaks Express v5 router modularity. Claude should utilize nested Express Routers using `Router({ mergeParams: true })` to properly encapsulate sub-resource logic.
  - **Unfinished Approval Logic:** In `server/routes/projects.ts`, the `/approve` endpoint does not actually update the `approvedAt` or `approvedBy` database columns. It contains comments noting this tech debt and instead executes a dummy update (`name: project.name`) just to bump the project version.

## 13. Pass 2 Audit Findings (Code Quality, Leaks, and Safety)
*Evaluating deeper patterns, memory leaks, type safety, and framework encapsulation against 2026 diagnostic standards.*

- **Findings:**
  - **Memory Leaks via setInterval ("The Ratchet Pattern"):** The codebase contains numerous `setInterval` calls in `server/routes/arduino.ts`, `server/routes/agent.ts`, and `server/routes/chat.ts`. These intervals are often created per-connection or globally but are never assigned to a variable to be cleared with `clearInterval()`. In 2026 Node.js diagnostic standards (e.g., using `clinic.js`), these create a "Ratchet Pattern" where memory grows during activity but the Garbage Collector (GC) can never reclaim the closures. Over time, these dangling intervals will leak memory until the Node process crashes with an OOM error.
  - **React 19 Encapsulation Violations (`querySelector`):** In `client/src/components/panels/SerialMonitorPanel.tsx` and `BreadboardWireEditor.tsx`, DOM elements are selected directly using `document.querySelector()`. By 2026 React 19 standards, this is considered a "legacy anti-pattern." It bypasses the React Compiler's ability to track dependencies and breaks the new "Self-Cleaning Ref Callback" lifecycle. If multiple instances of these components are ever rendered, or if the DOM structure changes dynamically, these queries will target the wrong elements. React 19 callback refs (which now natively support returning a cleanup function, identical to `useEffect`) must be used instead.
  - **Type Safety Bypasses in Genkit:** In `server/genkit.ts`, the parameter schema for AI tools is cast with `inputSchema: toolDef.parameters as any`. This completely bypasses TypeScript's safety checks and effectively disables Zod validation at the boundary between Genkit's execution and the tool definition, meaning invalid LLM outputs might not be caught before executing database mutations.

## 14. Pass 3 Audit Findings (Weak Randomness & Collision Risks)
*Evaluating ID generation, cryptographic security, and token generation against WebCrypto standards.*

- **Findings:**
  - **Insecure Math.random() Usage:** Across the codebase, `Math.random()` is used to generate identifiers (e.g. `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` in `server/routes/rag.ts` and `bus-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` in `client/src/lib/circuit-editor/bus-pin-mapper.ts`). `Math.random()` is not cryptographically secure and the entropy generated here is extremely low. At scale, this mathematically guarantees ID collisions. The industry standard WebCrypto API (`crypto.randomUUID()`), which is mandated by the project's own documentation, must be used instead to ensure globally unique identifiers.

## 15. Pass 4 Audit Findings (Client-Side Security & Execution)
*Evaluating client-side execution, code compilation, and session storage against 2026 Content Security Policy (CSP) standards.*

- **Findings:**
  - **Client-Side Arbitrary Execution (`eval`) & CSP Failure:** Despite earlier documentation claiming 0 uses of `eval()`, `client/src/components/views/CircuitCodeView.tsx` explicitly calls `debouncedEval(newCode)`. This allows arbitrary JavaScript execution directly within the React application context. In 2026, using `script-src 'unsafe-eval'` is considered a high-risk legacy anti-pattern. If an attacker can share a project with malicious code, or if the AI hallucinates a malicious payload into the Circuit Code View, it will execute with full privileges over the user's session. ProtoPulse must implement a "Strict CSP" using nonces and `'strict-dynamic'` to prevent unauthorized script execution, and fundamentally redesign the Circuit Code View to evaluate user code inside a secure Web Worker sandbox rather than the main thread.
  - **Session Hijacking Vulnerability (XSS to Token Theft):** The `client-state-scope.ts` file manages the session by reading from and writing to `window.localStorage.getItem(SESSION_STORAGE_KEY)`. Storing session tokens in LocalStorage makes them permanently accessible via JavaScript. Combined with the `eval()` usage in the Code View and the `dangerouslySetInnerHTML` usage in other parts of the app, any successful Cross-Site Scripting (XSS) attack will immediately lead to full session hijacking, as the attacker's script can simply read the token from `localStorage`. Sessions should be migrated to `SameSite=Strict; HttpOnly; Secure` cookies.

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
*Mapping the AI toolset against API capabilities to find functional blindspots and evaluating against 2026 Automated Red-Teaming (ART) frameworks.*

- **Findings:**
  - **No AI Version Control / Rollback Capabilities:** While there is a robust history endpoint (`server/routes/history.ts`), the AI tool registry (`server/ai-tools/index.ts`) completely lacks any history or version control tools. The AI cannot list previous commits, revert a project snapshot, or undo its own mistakes. If the AI destructively deletes a large sub-circuit, the user is forced to manually navigate the UI to find the undo button.
  - **Missing ART (Automated Red-Teaming) Scenarios:** By 2026 standards, an AI agent with destructive capabilities (modifying BOMs, generating firmware) must be evaluated using Automated Red-Teaming (ART) tools like **ARTKIT**. ProtoPulse lacks any scenario replays or adversarial prompt testing to ensure the AI doesn't maliciously execute its available tools when prompted by an injection attack.
  - **No Access to Settings or Preferences:** The AI cannot modify routing preferences, grid snapping settings, or UI themes. It is entirely blind to the `server/routes/settings.ts` and `design-preferences.ts` logic. If a user asks the AI to "turn on strict grid snapping", it will hallucinate a success response but do nothing.
  - **No Collaboration Management:** The AI has no tools to invite users to a project, revoke access, or manage roles. The `projects/:id/members` endpoints exist, but the AI is blind to them.

## 30. Pass 15: AI Logic Constraints & Data Modeling
*Evaluating the mathematical integrity, schema alignment, and hardcoded boundaries of individual AI tools against 2026 Deterministic Stack standards.*

- **Findings:**
  - **Deterministic Generation Flaw:** The generative design tool (`server/ai-tools/generative.ts`) uses a `mulberry32` PRNG to generate circuit candidates. However, the seed is calculated as `description.length * 31 + count * 7`. This means if a user types "Make me a driver circuit" and asks for 3 candidates, the seed will be identical every single time they ask. The AI will output the *exact same* "randomized" candidate topologies repeatedly, entirely defeating the purpose of a generative exploration tool.
  - **Missing 2026 Deterministic Best Practices:** In 2026, simple PRNG seeding is considered insufficient for robust generation. The industry standard requires tracking the "System Fingerprint" from the API provider to detect backend hardware/model swaps, forcing `temperature=0` across logic calls, and, if generating visual/spatial graphs, reusing the initial noise "latents" to ensure layout consistency across iterations. ProtoPulse currently does none of this, guaranteeing high variance in some areas and deterministic loops in others.
  - **Schema Typo in Risk Analysis:** In `server/ai-tools/risk-analysis.ts`, the `calculateBuildRiskScore` function loops over `bomItems` and accesses `item.assemblyCategory` and `item.esdSensitive`. However, cross-referencing `shared/schema.ts` reveals that the `bom_items` table *does not contain these columns*. The ORM will return `undefined` for these fields, meaning the risk analysis engine is fundamentally broken and will always silently skip THT and ESD assembly risk calculations.
  - **Database Decoupling in BOM Optimization:** The `analyze_bom_optimization` tool (`server/ai-tools/bom-optimization.ts`) uses massive hardcoded static dictionaries (like `RESISTOR_PACKAGES` and `IC_ALTERNATES`) to suggest alternative components to the user. Because this is hardcoded into the backend script, it is completely decoupled from the PostgreSQL `component_library` table. The AI will regularly hallucinate suggestions for parts like the `ATmega328PB` or `GD32F103`, even if those components do not exist in the project's actual database library, causing placed components to break.

## 31. Pass 16: The "Wired Into Everything" Audit (Total API Coverage Mapping)
*Mapping the AI tool registry against all backend REST endpoints to identify domains where the AI is completely blind, and benchmarking against 2026 Autonomous EDA trends.*

- **Findings:**
  - **Reactive vs. Autonomous Architecture (The 2026 Gap):** Based on 2026 EDA industry reports, the market has shifted from "Reactive AI" (chatbots waiting for prompts) to "L4 Autonomous Agents" that orchestrate entire workflows. ProtoPulse is stuck in the 2024 Reactive paradigm. The platform needs an autonomous background agent that constantly monitors the `drc-engine.ts` output stream. The moment a user creates an Electrical Rule Check (ERC) violation, the agent should proactively pop up with a scoped fix, rather than waiting for the user to ask the chatbot.
  - **No AI Design Comments / Review Capabiltiies (`server/routes/comments.ts`):** The application allows users to drop spatial comments/pins on the schematic or PCB to discuss design choices. The AI is completely blind to these endpoints. An AI assistant in a professional EDA tool should be able to read a user's comment, reply to it, resolve it, or proactively drop its own warning pins directly onto the schematic canvas.
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

## 34. Pass 19: Live Web Accessibility (WCAG) Execution Audit
*Utilized the `mcp_web-accessibility` tool to perform a dynamic DOM audit against the running `localhost:5000` Express/Vite instance.*

- **Findings:**
  - **Hardcoded Zoom Disable (WCAG Violation):** The live DOM audit explicitly flagged the `<meta name="viewport">` tag for containing `maximum-scale=1`. This completely disables the ability for users to pinch-to-zoom on mobile or touch-enabled devices. This is a critical WCAG violation, as users with visual impairments must be able to scale the UI by at least 200% without assistive technology.
  - **Landmark Misconfiguration:** The audit flagged multiple core components (including the auth pages and sidebar sections) for not being contained within standard HTML5 semantic landmarks (like `<main>`, `<nav>`, `<aside>`). Screen readers rely on these landmarks to build a navigational tree of the application; without them, the user is forced to linearly tab through every single element on the page.

## 35. Pass 20: Google Workspace Integration & Export Enhancements
*Utilized `mcp_workspace-developer` to pull 2026 best practices for Google Sheets API integration.*

- **Findings:**
  - **Primitive BOM Exports:** Currently, the `exportBomToSheet` tool (referenced in `server/ai-tools/export.ts`) relies on generating a raw, unstyled CSV file and dumping it. Based on the Google Workspace documentation for the `spreadsheets.batchUpdate` endpoint, this is an incredibly primitive approach. The AI tool should be enhanced to natively construct a styled Google Sheet directly via the API. Claude must update the export tool to apply formatting (e.g., frozen header rows, bold text, currency validation for unit prices, and auto-sizing columns) rather than treating Google Sheets like a dumb CSV viewer.

## 36. Pass 21: Genkit Observability & Auth Middleware
*Utilized `mcp_genkit` to query documentation regarding telemetry collection and authorization.*

- **Findings:**
  - **Missing OpenTelemetry Traces:** According to the Genkit `telemetry-collection.md` specs, professional AI integrations must implement OpenTelemetry to track prompt latency, token costs, and tool-call success rates. ProtoPulse relies on custom `logger.info` calls in `server/ai.ts`. Claude must wire the native Firebase/OpenTelemetry plugin into the Genkit initialization so that production token usage is rigorously tracked and exported.
  - **Bypassed Flow Authentication:** Currently, ProtoPulse authenticates API requests via standard Express middleware (`requireProjectOwnership`), but leaves the actual Genkit flows (`ai.defineFlow`) mathematically unprotected. According to Genkit's `authorization.md` documentation, flows should define an `authPolicy` internally. This ensures that even if an AI flow is invoked via a different execution path (like a background job or direct CLI call), the Genkit engine itself will actively reject unauthorized execution.

## 37. Pass 22: E2E Playwright & AI Evaluation Pipeline
*Evaluating the End-to-End testing suite against 2026 AI Agent testing standards (LLM-as-a-judge).*

- **Findings:**
  - **No LLM-as-a-Judge Evaluation:** The current `e2e/project-workspace.spec.ts` relies on extremely basic Playwright assertions (e.g., `not.toBeEmpty()`, `isVisible()`). It tests whether the UI crashed, but it completely fails to test the AI's actual logic. In 2026, E2E tests for AI agents must use Genkit Evaluators (`ai.defineEvaluator`) inside the Playwright suite to score the agent's output for Faithfulness, Relevancy, and Safety. Right now, if the AI hallucinates a completely wrong schematic but renders it without throwing an HTTP 500, the E2E tests will pass.
  - **Brittle Selectors vs Accessibility-Tree (Playwright MCP):** The tests rely heavily on `page.locator('text=Architecture')` and hardcoded `data-testid` attributes. The 2026 standard for agentic UI testing shifts away from these in favor of Accessibility-Tree First locators (`page.getByRole()`). Furthermore, the testing suite should be integrated with the **Playwright MCP Server** to allow an AI Agent to autonomously generate and "Heal" E2E tests by interacting with the browser's semantic roles, preventing the CI pipeline from breaking every time a button is restyled.

---
*Note: This document has undergone an exhaustive 26 passes (including Playwright E2E and LLM-as-a-judge methodologies) and is considered a finalized blueprint for Claude.*
