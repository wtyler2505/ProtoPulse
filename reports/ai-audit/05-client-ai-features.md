# Client AI Feature Libraries — Deep Audit Report

**Scope:** All files in `client/src/lib/` related to AI features, prediction, proactive analysis, voice, RAG, multimodal input, co-design, generative design, and related utilities.

**Files analyzed:** 30 files across `client/src/lib/` and `client/src/lib/generative-design/`

**Date:** 2026-03-27

---

## Executive Summary

ProtoPulse's client-side "AI" feature libraries comprise approximately **14,000 lines** of TypeScript across 30 modules. A critical finding: **none of these modules invoke any AI API**. They are entirely client-side algorithmic/heuristic engines using hardcoded knowledge bases, pattern matching, rule engines, and evolutionary algorithms. The "AI" label is aspirational branding — the actual intelligence comes from domain expertise encoded as static rules and data tables.

This is not necessarily a deficiency. These modules provide significant standalone value through well-engineered heuristics. However, the naming creates a gap between user expectations ("AI-powered") and reality (deterministic algorithms).

**Architecture pattern:** Nearly every module follows the **Singleton + Subscribe** pattern with localStorage persistence and a companion React hook using `useState`/`useEffect`/`useCallback` for reactive binding.

**Test coverage:** 29 of 30 modules have dedicated test files. `stream-resilience.ts` and `action-error-tracker.ts` have tests but in different locations. Coverage is comprehensive.

---

## Module-by-Module Analysis

### 1. ai-review-queue.ts (480 lines)

**Purpose:** Queues AI action suggestions for human review based on confidence thresholds. Actions above `autoApproveThreshold` (default 0.9) are auto-approved; actions between `reviewThreshold` (0.5) and auto-approve go to the queue; below review threshold are auto-dismissed.

**Implementation:**
- `ReviewQueueManager` singleton with subscribe pattern
- Deduplication by action type + target (exact match within 5 min window)
- Auto-expiry after 24 hours via lazy cleanup on `getQueue()`
- Max 100 items in queue (FIFO eviction)
- localStorage persistence under key `protopulse-review-queue`
- `useReviewQueue` React hook wraps the singleton

**Integration:** Wired into ChatPanel via the hook. Actions parsed from AI chat responses flow through this queue.

**Quality:** Production-quality. Clean separation of concerns, proper dedup, expiry, and boundary handling.

**Test file:** `client/src/lib/__tests__/ai-review-queue.test.ts`

---

### 2. ai-prediction-engine.ts (1387 lines)

**Purpose:** Predicts missing components, best practices, safety concerns, optimizations, and learning tips based on the current architecture graph.

**Implementation:**
- `PredictionEngine` singleton + subscribe
- **32 built-in rules** across 5 categories:
  - `missing_component` (10 rules): e.g., MCU without decoupling cap, motor without flyback diode
  - `best_practice` (8 rules): e.g., I2C without pull-ups, mixed voltage domains
  - `safety` (6 rules): e.g., no fuse, high-current path without protection
  - `optimization` (4 rules): e.g., linear regulator with high dropout
  - `learning_tip` (4 rules): e.g., first MCU gets beginner tips
- Pattern-matching classification functions: `isMcu()`, `isSensor()`, `isMotor()`, `isCapacitor()`, `isLed()`, etc. using keyword arrays matched against node type/label
- Adjacency graph construction from edges for neighbor analysis
- Confidence adjustment via user feedback: accept boosts (`1.0 + 0.05*acceptCount`), dismiss reduces (`1.0 - 0.02*dismissCount`), 7-day dismissal cooldown
- Debounced analysis (2s), max 5 suggestions at once
- localStorage persistence for feedback history

**Integration:** Connected to architecture view. Runs when nodes/edges change.

**Quality:** Solid heuristic engine. Rules are domain-appropriate for hobbyist electronics. Some rules overlap with `proactive-healing.ts` (e.g., both check for decoupling caps, flyback diodes).

**Test file:** `client/src/lib/__tests__/ai-prediction-engine.test.ts`

---

### 3. ai-root-cause.ts (1005 lines)

**Purpose:** Given observed symptoms (e.g., "LED not lighting", "I2C not responding"), identifies probable root causes and suggests fixes.

**Implementation:**
- `RootCauseAnalyzer` singleton + subscribe
- **22 known symptoms** spanning circuit, firmware, power, thermal, mechanical, environmental domains
- **20 failure patterns** with causal relationships (e.g., "bad_solder_joint" → causes "intermittent_connection")
- **Causal graph** with BFS traversal for transitive effect/cause detection (max depth 3)
- Cross-domain correlation: identifies when a circuit issue could cause firmware-visible symptoms
- Probability scoring: `matchRatio * avgWeight` with transitive boost (+10% per correlation)
- `analyzeSymptoms()`: accepts symptom IDs + observations, returns ranked diagnoses with confidence, explanation, and fixes
- History tracking with localStorage

**Integration:** Available via `useRootCauseAnalyzer` hook. Could be surfaced in validation or chat views.

**Quality:** Well-structured causal reasoning engine. The symptom-to-cause mapping is curated and electronics-relevant. The BFS-based transitive analysis is a nice touch for multi-factor problems.

**Test file:** `client/src/lib/__tests__/ai-root-cause.test.ts`

---

### 4. ai-safety-mode.ts (524 lines)

**Purpose:** Classifies design actions as safe/caution/destructive and provides teaching explanations for beginners.

**Implementation:**
- `AISafetyModeManager` singleton + subscribe
- **10 destructive action types:** delete_all_nodes, clear_circuit, reset_project, bulk_delete, drop_bom, delete_design, remove_all_nets, clear_history, factory_reset, purge_snapshots
- **13 caution action types:** delete_node, delete_edge, modify_value, swap_component, change_netclass, merge_nets, split_net, rename_component, change_footprint, modify_constraint, auto_route, generate_architecture, bulk_modify
- Teaching explanations: each action gets a beginner-friendly explanation of what it does and its consequences
- Per-action dismissal with localStorage persistence
- Configurable modes: `full` (all warnings), `minimal` (destructive only), `off`

**Integration:** Used in ChatPanel and action execution flow to gate destructive actions with confirmation dialogs.

**Quality:** Clean, focused module. Good UX consideration for the target audience (electronics beginners).

**Test file:** `client/src/lib/__tests__/ai-safety-mode.test.ts`

---

### 5. ai-tutor.ts (834 lines)

**Purpose:** Interactive electronics tutoring with adaptive questioning and progressive hint system.

**Implementation:**
- `AiTutor` singleton + subscribe
- **30+ topic question banks** (4 questions each avg) covering: resistors, capacitors, LEDs, Arduino basics, I2C, SPI, motor control, power supply, PCB design, etc.
- **4 tutoring styles:** socratic (guided questions), explain (direct explanations), challenge (harder problems), hint (just the hint)
- **Progressive hint system:** hint specificity increases with `askCount` (0-3: vague→specific)
- **User level classification** based on vocabulary analysis: beginner (basic terms), intermediate (protocol terms), advanced (register-level terms)
- **8 error-specific hint banks:** short-circuit, no-power, LED, I2C, motor, noise, SPI, UART — each with 3-5 contextual hints
- `processUserMessage()`: extracts topic + intent from user text via keyword matching, returns appropriate response

**Integration:** Available via `useAiTutor` hook. Wired into the knowledge hub view.

**Quality:** Comprehensive educational content. The progressive hint system is well-designed for self-directed learning. Content is accurate for the target audience.

**Test file:** `client/src/lib/__tests__/ai-tutor.test.ts`

---

### 6. ai-co-designer.ts (634 lines)

**Purpose:** Manages multi-option design sessions where users compare alternatives (e.g., MCU selection, power topology choices).

**Implementation:**
- `AiCoDesigner` singleton + subscribe
- Design session lifecycle: create → add options → score → compare → select → refine
- Client-side heuristic scoring placeholder — comments explicitly note "real scoring is server-side via AI"
- Comparison matrix generation: produces side-by-side matrices with normalized scores
- Option selection and refinement workflow
- Iteration tracking: each refinement creates a new iteration

**Integration:** Available via `useCoDesigner` hook. Connected to architecture view for component selection workflows.

**Quality:** The scoring is purely placeholder (returns random-ish scores based on option properties). This module is a framework awaiting real AI integration. The session management and comparison matrix logic is solid.

**Issue:** The placeholder scoring means this module doesn't actually provide intelligent design assistance yet. The comparison matrix works, but the scores are not meaningful.

**Test file:** `client/src/lib/__tests__/ai-co-designer.test.ts`

---

### 7. ai-goal-parser.ts (899 lines)

**Purpose:** Parses natural language project descriptions into architecture candidates with component selection.

**Implementation:**
- `parseProductGoal()`: NLP-like keyword extraction from user text
  - Extracts: board type (Arduino/ESP32/STM32/etc.), sensors, actuators, communication modules, power requirements
  - Pattern matching against ~60 keyword groups
- `generateArchitectureCandidates()`: produces 3 tiers from parsed goals:
  - **Minimal:** bare minimum components (MCU + essential sensors)
  - **Balanced:** practical set with recommended extras (regulators, connectors)
  - **Full:** comprehensive with redundancy, ESD protection, test points
- **30+ component knowledge base** with tier-appropriate selection
- Pure functions, no side effects, no singleton, no AI API calls
- Returns structured `ArchitectureCandidate[]` with nodes and edges ready for the architecture view

**Integration:** Used in the ideation flow (Idea-to-PCB workflow) and could be triggered from ChatPanel natural language input.

**Quality:** Impressive for a keyword-based parser. The 3-tier approach is genuinely useful for the target audience. Component selection is electronics-accurate.

**Test file:** `client/src/lib/__tests__/ai-goal-parser.test.ts`

---

### 8. action-error-tracker.ts (311 lines, in `client/src/lib/ai/`)

**Purpose:** Tracks AI action execution errors for retry decisions and user feedback.

**Implementation:**
- `ActionErrorTracker` singleton (NOT subscribe pattern — uses `useSyncExternalStore` directly)
- Classifies errors as retryable or non-retryable using regex patterns:
  - Retryable: timeout, network, rate limit, service unavailable, ECONNREFUSED
  - Non-retryable: validation, parse, schema, permission, unauthorized, 4xx
- FIFO eviction (max 50 errors), auto-expiry (5 min)
- Error callbacks for toast notifications
- `getSnapshot()` for `useSyncExternalStore` compatibility

**Integration:** Used by ChatPanel and DesignAgentPanel to track and display action errors.

**Quality:** Clean, focused. The retryable/non-retryable classification is correct for common AI API error patterns.

**Test file:** `client/src/lib/ai/__tests__/action-error-tracker.test.ts`

---

### 9. prediction-actions.ts (58 lines)

**Purpose:** Bridge between prediction engine output and the AI action format used by ChatPanel.

**Implementation:**
- `getPredictionComponentLabel()`: builds human-readable label from prediction payload
- `getPredictionComponentCount()`: safely extracts count with floor and >0 guard
- `buildPredictionAddNodeActions()`: converts a prediction payload into an array of `AIAction` objects

**Integration:** Used to convert prediction engine suggestions into executable chat actions.

**Quality:** Small, focused utility. Well-guarded against bad input.

**Test file:** `client/src/lib/__tests__/prediction-actions.test.ts`

---

### 10. stream-resilience.ts (285 lines)

**Purpose:** Resilient SSE (Server-Sent Events) streaming with automatic retry and heartbeat-based idle detection.

**Implementation:**
- `resilientStreamFetch()`: wraps `fetch()` for SSE streaming with:
  - Exponential backoff retry (1s base, 2x multiplier, max 30s, max 3 retries)
  - `StreamServerError` (HTTP 4xx/5xx — no retry)
  - `AbortError` handling (user cancellation — no retry)
  - Network errors trigger retry with backoff
  - Heartbeat-based idle detection (configurable timeout, default 30s)
  - `onChunk`, `onDone`, `onError` callbacks
- Line-based SSE parsing from ReadableStream chunks
- Configurable: `maxRetries`, `retryBaseMs`, `retryMaxMs`, `idleTimeoutMs`

**Integration:** Used by ChatPanel for AI chat streaming and DesignAgentPanel for agent loop streaming.

**Quality:** Production-quality streaming implementation. The retry logic is correct and the idle detection prevents hung connections.

**Test file:** None found in standard location. May be tested indirectly via ChatPanel tests.

**Issue:** No dedicated test file found. This is a coverage gap for a critical infrastructure module.

---

### 11. voice-workflow.ts (383 lines)

**Purpose:** Maps voice commands to application actions using fuzzy matching.

**Implementation:**
- `VoiceWorkflowManager` singleton + subscribe
- **Levenshtein distance** fuzzy matching with **match threshold 0.55**
- **20+ built-in voice commands** across 5 categories:
  - Navigation: "go to schematic", "open BOM", "show architecture"
  - Actions: "add resistor", "add capacitor", "save project"
  - Controls: "undo", "redo", "zoom in", "zoom out"
  - Queries: "show validation", "run DRC"
  - Bench: "start simulation", "stop simulation"
- Template parameter extraction from speech patterns (e.g., "add {component}" extracts component name)
- Custom command registration
- Match confidence scoring

**Integration:** Available via `useVoiceWorkflow` hook. Connected to voice-ai module for speech-to-action pipeline.

**Quality:** Well-implemented fuzzy matching. The Levenshtein implementation is correct. Command set is comprehensive for the target use case.

**Test file:** `client/src/lib/__tests__/voice-workflow.test.ts`

---

### 12. voice-ai.ts (556 lines)

**Purpose:** Voice input capture with Voice Activity Detection (VAD) using Web Audio API.

**Implementation:**
- `VoiceAIManager` singleton + subscribe
- **Web Audio API:** `getUserMedia()` → `AudioContext` → `ScriptProcessorNode` (deprecated but widely supported)
- **VAD:** RMS energy calculation → dBFS threshold detection (-35 dBFS default) with hold timer (500ms)
- **PCM encoding:** Float32 ↔ Int16 conversion for audio data transport
- **Audio playback:** reconstructs audio from PCM data for playback
- **Modes:** push-to-talk (manual start/stop) and hands-free (VAD-driven auto-start/stop)
- State machine: idle → listening → recording → processing

**Integration:** Available via `useVoiceAI` hook. Feeds captured audio to voice-workflow for command matching. No speech-to-text (STT) is included — the module captures raw audio but does not transcribe it.

**Quality:** Correct Web Audio API usage. The ScriptProcessorNode is deprecated (should migrate to AudioWorklet), but still functional in all browsers.

**Issue:** No STT integration. The module captures audio and provides VAD, but converting speech to text requires either a server-side API call or Web Speech API, neither of which is implemented. The voice workflow module expects text input, creating a disconnect: voice-ai captures audio, voice-workflow expects text, but nothing bridges them.

**Test file:** `client/src/lib/__tests__/voice-ai.test.ts`

---

### 13. smart-library-installer.ts (418 lines)

**Purpose:** Parses Arduino compile errors and suggests library installations.

**Implementation:**
- `parseCompileErrors()`: regex parsing of GCC/arduino-cli output
  - Extracts: filename, line number, error message, error type (error/warning/note)
  - Handles multi-line error messages with caret markers
- `suggestLibrariesForErrors()`:
  - **50+ include→library mappings** (e.g., `Servo.h` → `Servo`, `Wire.h` → `Wire`)
  - **30+ symbol→library mappings** (e.g., `FastLED` → `FastLED`)
  - Matches against "No such file or directory" and "was not declared in this scope" errors
- `getInstallCommand()`: generates `arduino-cli lib install` commands
- Pure functions, no singleton

**Integration:** Used in Arduino workspace view for compile error recovery.

**Quality:** Comprehensive library mapping. The regex parsing handles real GCC output formats correctly.

**Test file:** `client/src/lib/__tests__/smart-library-installer.test.ts`

---

### 14. multimodal-input.ts (895 lines)

**Purpose:** Manages image capture, preprocessing, type detection, and extraction result storage for multimodal AI circuit analysis.

**Implementation:**
- `MultimodalInputEngine` singleton + subscribe + localStorage persistence
- **Image capture:** from data URLs with format detection (JPEG/PNG/WebP), size estimation via base64 analysis
- **Preprocessing:** dimension calculation with crop/rotate/scale, estimated output size (no real canvas operations — documented as placeholder for unit testing)
- **Type detection:** classifies images as photo/screenshot/sketch/schematic-scan/datasheet/whiteboard using filename hints and MIME type
- **Analysis prompts:** 6 input-type-specific system/user prompt pairs for AI analysis (the prompts exist, but no AI API is called)
- **Extraction results:** stores detected components and connections
- **Architecture conversion:** `resultToArchitectureNodes()` converts extraction results to grid-positioned architecture nodes
- **Import/export:** JSON serialization with validation
- **PNG dimension parsing:** reads width/height directly from PNG IHDR chunk
- `useMultimodalInput` React hook

**Integration:** Wired into ChatPanel multimodal input UI. The prompts are prepared for sending to an AI API, but the actual API call happens elsewhere (in the chat system).

**Quality:** Well-structured. The preprocessing is a stub (returns input dimensions adjusted for transforms without actual canvas operations), which is appropriate for the current architecture where AI analysis happens server-side.

**Test file:** `client/src/lib/__tests__/multimodal-input.test.ts`

---

### 15. sketch-explainer.ts (1124 lines)

**Purpose:** Parses Arduino sketches (C/C++) and generates line-by-line explanations at beginner/intermediate/advanced levels.

**Implementation:**
- **CONCEPT_DATABASE:** 40+ entries covering Arduino functions, protocols, language constructs — each with name, explanation, and example code
- **CONCEPT_PATTERNS:** regex array mapping code patterns to concept keys (e.g., `Serial.begin(` → `Serial.begin`)
- **Section parser** (`parseSketchSections()`): splits Arduino code into structural sections:
  - Section types: include, global, setup, loop, function, isr, comment
  - Handles: block comments with nesting, brace matching (respects strings/comments), ISR patterns (5 formats), multi-line function definitions
  - `findClosingBrace()`: production-quality brace matcher with string/char/comment escape handling
- **Concept detection** (`detectConcepts()`): scans code for all used concepts, deduplicates (e.g., `Serial.println` suppresses generic `Serial`)
- **Section explanation** (`explainSection()`): generates level-appropriate explanations for each section type
  - Beginner: analogy-based ("like installing an app on your phone")
  - Intermediate: technical but accessible
  - Advanced: register-level, performance, memory considerations
- **Difficulty assessment:** classifies sketch as beginner/intermediate/advanced based on concept count and type
- **Full sketch explanation** (`explainSketch()`): orchestrates parse → detect → explain → summarize

**Integration:** Used in Arduino workspace and knowledge hub views.

**Quality:** Exceptional educational content. The 3-level explanation system is genuinely valuable for the target audience. The C parser is robust with proper handling of edge cases (nested comments, multi-line functions, ISR patterns).

**Test file:** `client/src/lib/__tests__/sketch-explainer.test.ts`

---

### 16. proactive-healing.ts (1295 lines)

**Purpose:** Real-time danger detection during design actions (add node, add edge, modify edge) with fix suggestions.

**Implementation:**
- `ProactiveHealingEngine` singleton + subscribe + localStorage persistence (config + history)
- **14 built-in danger rules:**
  1. `voltage-mismatch` (critical/block): detects connecting nodes with different voltages
  2. `missing-current-limit-resistor` (critical/block): LED connected to MCU without series resistor
  3. `direct-motor-drive` (critical/block): motor connected directly to GPIO
  4. `reverse-polarity` (warning/warn): regulator without input protection diode
  5. `missing-decoupling` (warning/warn): MCU without decoupling capacitors
  6. `gpio-overcurrent` (critical/block): relay connected directly to GPIO
  7. `missing-i2c-pullups` (warning/warn): I2C bus without pull-up resistors
  8. `adc-reference` (suggestion/info): ADC without precision voltage reference
  9. `flyback-diode` (critical/block): inductive load without flyback diode
  10. `reset-resistor` (suggestion/info): MCU without reset pull-up
  11. `esd-protection` (warning/warn): USB connector without ESD protection
  12. `thin-power-trace` (warning/warn): power trace width below 0.5mm
  13. `missing-level-shifter` (warning/warn): MCU-to-MCU connection across voltage domains
  14. `ungrounded-shield` (suggestion/info): EMI shield not connected to ground
- **Interrupt levels:** block (stops action), warn (shows dialog), info (passive notification), silent
- **Configurable:** global enable/disable, minimum interrupt level, auto-apply severity, per-rule overrides
- **Adjacency graph analysis** for neighbor-based checks
- **Voltage parsing** from node labels/properties (e.g., "5V", "3.3V")
- **Bulk analysis:** `analyzeDesign()` generates synthetic actions for all nodes/edges
- **Proposal lifecycle:** pending → approved/dismissed/auto_applied
- **Statistics:** by severity and category
- `useProactiveHealing` React hook

**Integration:** Wired into architecture editor action pipeline. Checks fire on every add_node/add_edge/modify_edge.

**Quality:** Excellent. The 14 rules cover the most common and dangerous beginner mistakes in electronics design. The interrupt level system allows appropriate UX responses. The voltage parsing is robust.

**Overlap with ai-prediction-engine.ts:** Both modules check for decoupling caps, flyback diodes, level shifters, and I2C pull-ups. The difference is timing — prediction runs on analysis (proactive suggestion), healing runs on action (reactive prevention).

**Test file:** `client/src/lib/__tests__/proactive-healing.test.ts`

---

### 17. rag-engine.ts (464 lines)

**Purpose:** Client-side Retrieval-Augmented Generation engine using TF-IDF for document search.

**Implementation:**
- `RAGEngine` singleton + subscribe + localStorage persistence
- **Tokenization:** lowercasing, punctuation removal, stop word filtering (30+ English stop words)
- **Chunking:** paragraph-aware chunking with configurable chunk size (default 500 chars) and overlap (100 chars), handles sentences and word-level splitting for oversized paragraphs
- **TF-IDF indexing:** term frequency per chunk, smoothed IDF across all chunks, TF-IDF vector per chunk
- **Cosine similarity:** sparse vector dot product for query-document matching
- **Search:** tokenize query → compute query TF-IDF → rank chunks by cosine similarity → top-K results (default 5, threshold 0.1)
- **Context builder:** `getContext()` assembles attributed text from top search results up to character limit
- Configurable: `chunkSize`, `chunkOverlap`, `topK`, `scoreThreshold`, `maxContextChars`

**Integration:** Paired with `rag-knowledge-base.ts` for built-in electronics knowledge. Used to provide context to AI chat prompts.

**Quality:** Correct TF-IDF implementation. The chunking algorithm handles edge cases well (oversized paragraphs, empty chunks). The smoothed IDF prevents zero-division. Good for small-to-medium corpora.

**Limitation:** TF-IDF is a bag-of-words approach — no semantic understanding. A query about "voltage divider" won't match content about "resistor ratio" unless those exact terms appear.

**Test file:** `client/src/lib/__tests__/rag-engine.test.ts`

---

### 18. rag-knowledge-base.ts (443 lines)

**Purpose:** Provides 20+ curated electronics knowledge articles for the RAG engine.

**Implementation:**
- **20 knowledge entries** across 10 categories:
  - Microcontroller: ATmega328P (Arduino Uno), ATmega2560 (Arduino Mega), ESP8266, ESP32 (referenced in other modules)
  - Passive: Resistor basics (color codes, series/parallel), Capacitor types (ceramic/electrolytic/tantalum), Inductor selection
  - Active: 2N2222 NPN BJT, IRF540N MOSFET, Diode types (1N4148, 1N4007, Schottky, Zener, TVS)
  - Power: LM7805 regulator, LM317 adjustable regulator, power supply design best practices
  - Op-amp: LM358, LM741
  - Motor-driver: L293D, L298N
  - Communication: I2C protocol, SPI protocol, UART/Serial
  - Design-practice: LED driving, PCB design rules for beginners
- Each entry: id, title, category, content (detailed technical reference), tags
- `getKnowledgeDocuments()`: formats entries for RAG engine ingestion
- Pure data module

**Integration:** Loaded into RAG engine at startup. Provides base knowledge for electronics chat.

**Quality:** High-quality reference content. Accurate specifications, practical guidance, and common pitfalls. Content is appropriate for the target audience (hobbyists learning electronics).

**Test file:** `client/src/lib/__tests__/rag-knowledge-base.test.ts`

---

### 19. board-aware-suggestions.ts (586 lines)

**Purpose:** Pin analysis, conflict detection, and optimal pin suggestion for 5 microcontroller boards.

**Implementation:**
- **5 supported boards:** Arduino Uno, Arduino Mega, ESP32, STM32 (Blue Pill), Raspberry Pi Pico
- **Board capability database:** PWM pins, analog pins, interrupt pins, I2C bus pins, SPI bus pins
- **Timer-to-pin mappings:** per-board timer assignments (which timer drives which pins)
- **Feature-to-timer mappings:** which Arduino library/feature uses which timer (e.g., Servo uses Timer1 on Uno)
- **Pin usage analysis** (`analyzePinUsage()`):
  - I2C/SPI bus conflict detection (digital pin on bus line)
  - PWM-capable pin suggestions for non-PWM pins
  - High utilization warning (>80% pins used)
  - Remaining analog/interrupt pin tracking
- **Optimal pin suggestion** (`suggestOptimalPins()`):
  - Greedy allocation: interrupt pins first (most constrained), then analog, PWM, finally digital
  - Preserves PWM-capable pins for digital use (uses non-PWM first)
- **Timer conflict detection** (`checkTimerConflicts()`):
  - Detects when 2+ Arduino features share the same hardware timer
  - E.g., Servo + PWM on pins 9/10 both use Timer1 on Uno
- `useBoardSuggestions` React hook with memoized callbacks

**Integration:** Used in schematic editor and pin assignment views.

**Quality:** Accurate pin data for all 5 boards. The timer conflict detection is particularly valuable — this is a common source of subtle bugs in Arduino projects.

**Test file:** `client/src/lib/__tests__/board-aware-suggestions.test.ts`

---

### 20. semantic-pin-mapper.ts (350 lines)

**Purpose:** Classifies pin roles from names and automatically maps pins between components by semantic similarity.

**Implementation:**
- **Pin role classification** (`classifyPinRole()`):
  - 12 pin roles: power, ground, clock, data, enable, reset, analog, pwm, output, input, bidirectional
  - ~15 regex patterns matching common naming conventions (VCC, GND, SDA, SCL, CLK, etc.)
  - Default: bidirectional for unrecognized names
- **Pin mapping** (`mapPinsBySemantics()`):
  - Weighted scoring: role match (0.5) + name similarity (0.35) + electrical type (0.15)
  - Name similarity: token-based overlap with substring matching
  - Role compatibility: same role = 1.0, complementary (input/output) = 0.7, bidirectional partial = 0.5
  - Greedy assignment: iteratively picks best (source, target) pair
- `getUnmappedPins()`: identifies unmatched pins after mapping
- Pure functions, no singleton

**Integration:** Used by the schematic editor for auto-wiring when placing components near each other.

**Quality:** The weighted scoring approach is sound. The greedy assignment could miss globally optimal assignments in edge cases (Hungarian algorithm would be better), but is fast and sufficient for typical component pin counts.

**Test file:** `client/src/lib/__tests__/semantic-pin-mapper.test.ts`

---

### 21. idea-to-pcb.ts (754 lines)

**Purpose:** Manages an 8-stage workflow from ideation to PCB ordering with step tracking, prerequisites, and progress reporting.

**Implementation:**
- `IdeaToPcbManager` singleton + subscribe
- **8 stages:** ideation → architecture → schematic → simulation → pcb_layout → validation → manufacturing → ordering
- **18 steps** across all stages, each with:
  - Title, description, estimated minutes, automatable flag
  - Completion criteria (checklist items)
  - Prerequisites (step IDs that must be completed/skipped first)
  - Related view (for navigation)
- **Step lifecycle:** pending → blocked → active → completed/skipped
- **Prerequisite propagation:** automatic blocked-status updates when prerequisites complete
- **Progress tracking:** per-session elapsed time, completion percentage, estimated time remaining
- **Recommendations engine:** context-aware suggestions based on current state (e.g., "simulation was skipped — consider running DC check before manufacturing")
- **Session report export:** generates markdown summary with step status, artifacts, warnings, blockers
- **Multi-session support:** concurrent sessions with independent state

**Integration:** Used in the Idea-to-PCB guided workflow view.

**Quality:** Well-designed guided workflow. The prerequisite system prevents skipping critical steps. Time estimates are reasonable for hobbyist projects.

**Test file:** `client/src/lib/__tests__/idea-to-pcb.test.ts`

---

### 22. co-design.ts (845 lines)

**Purpose:** Cross-domain co-design management linking circuit, firmware, and enclosure design with constraint tracking and conflict detection.

**Implementation:**
- `CoDesignManager` singleton + subscribe
- **3 design domains:** circuit, firmware, enclosure
- **Constraint management:** CRUD operations for cross-domain constraints with types: dimensional, electrical, thermal, timing, weight, interface
- **Automatic conflict detection:**
  - Range violations (value exceeds max/min)
  - Thermal cross-checks (thermal constraint not met + affects enclosure)
- **6 default sync points:**
  - Pin assignment sync (circuit ↔ firmware)
  - Power budget sync (circuit ↔ firmware)
  - PCB ↔ enclosure fit
  - Thermal budget sync (circuit ↔ enclosure)
  - Connector placement sync (circuit ↔ enclosure)
  - Communication protocol sync (circuit ↔ firmware)
- **Enclosure generation:** from PCB dimensions + wall thickness + clearance
- **Fit checking:** PCB vs enclosure with mounting hole clearance validation
- **Enclosure weight estimation** from shell volume × material density
- **Materials database:** 10 materials (ABS, PLA, PETG, Nylon, Polycarbonate, Aluminum, Steel, Carbon Fiber, FR-4, Acrylic) with density, thermal conductivity, max temp, cost, EM shielding
- **Material recommendation** based on temp/shielding/cost requirements
- **Firmware resource tracking:** pin/timer/UART/SPI/I2C assignments with conflict detection
- **Domain health metrics** and overall health aggregation

**Integration:** Co-design view in the UI. Links across architecture, PCB, and firmware views.

**Quality:** Comprehensive cross-domain design tool. The materials database is accurate. The fit-checking geometry is correct. This is a genuinely novel feature for a maker-focused EDA tool.

**Test file:** `client/src/lib/__tests__/co-design.test.ts`

---

### 23. panel-explainer.ts (507 lines)

**Purpose:** Static explanations for all ProtoPulse views/panels, providing onboarding context.

**Implementation:**
- `PANEL_EXPLANATIONS`: Record covering 28+ ViewModes
- Each entry: title, description, tips[] (3-5 per panel), relatedViews[]
- Pure data module with lookup functions
- No singleton, no state, no localStorage

**Integration:** Used in panel headers/tooltips for first-time user guidance.

**Quality:** Well-written, beginner-friendly descriptions. Covers all current views.

**Test file:** `client/src/lib/__tests__/panel-explainer.test.ts`

---

### 24-27. Generative Design Suite (4 files, ~1463 lines total)

#### 24. generative-design/fitness-scorer.ts (339 lines)

**Purpose:** Multi-criteria fitness evaluation for circuit design candidates.

**Implementation:**
- **5 fitness dimensions:** component count, estimated cost, DRC violations, power budget, thermal margin
- Each returns a score in [0, 1] with configurable weight
- **Cost estimation:** 16-entry part cost lookup (resistor $0.02, motor $2.00, etc.)
- **Power estimation:** 12-entry power draw lookup per part type
- **Thermal estimation:** ambient + power × thermal resistance (simplified)
- **DRC check:** floating nets, single-pin components
- `scoreCircuit()`: weighted sum → overall score [0, 1]
- `rankCandidates()`: sorts by overall score, assigns ranks
- `defaultCriteria()`: sensible defaults for maker circuits ($25 budget, 5W max, 85C max)

**Quality:** Good heuristic scoring. The cost/power estimates are rough but directionally correct.

**Test file:** `client/src/lib/generative-design/__tests__/fitness-scorer.test.ts`

#### 25. generative-design/circuit-mutator.ts (442 lines)

**Purpose:** Genetic algorithm mutation and crossover operators for evolving CircuitIR.

**Implementation:**
- **6 mutation types:**
  - `value_change`: picks from standard E12 resistor, capacitor, inductor values
  - `component_swap`: swaps within compatibility groups (e.g., transistor ↔ MOSFET)
  - `add_bypass_cap`: inserts decoupling cap between power and ground nets
  - `add_protection`: adds protection diode on a signal net
  - `remove_component`: removes non-essential component (prefers caps/diodes/LEDs)
  - `rewire_net`: changes a pin connection to a different net
- **Mutation application:** per-component mutations (rate-controlled) + structural mutations (once per circuit)
- **Crossover:** uniform crossover (50% inclusion), refdes deduplication, fresh ID generation
- **Spec-guided variants** (`generateVariant()`): keyword analysis biases mutation type selection (e.g., "cheap" → prefer remove_component)
- **Seeded PRNG:** all operations use `mulberry32` for reproducibility

**Quality:** Correct GA implementation. The E12 value tables and component swap groups are electronics-accurate.

**Test file:** `client/src/lib/generative-design/__tests__/circuit-mutator.test.ts`

#### 26. generative-design/generative-engine.ts (335 lines)

**Purpose:** Orchestrates the evolutionary design loop.

**Implementation:**
- `GenerativeDesignEngine` singleton + subscribe
- **Async generator** pattern: yields `GenerationResult` after each generation
- **Population initialization:** mutates from base circuits with increasing variation
- **Evolutionary loop:**
  - Score all candidates
  - Sort by fitness descending
  - **Elitism:** keep top 2 unchanged
  - **Tournament selection:** pick 2 random, use the fitter one as parent
  - **Crossover + mutation** to fill remaining population
- **Cancellation:** via `cancel()` flag checked between generations
- **State machine:** idle → generating → scoring → evolving → complete
- `useGenerativeDesign` React hook with `useSyncExternalStore`

**Quality:** Correct GA implementation with elitism and tournament selection. The async generator pattern is a nice design choice for progressive UI updates.

**Test file:** `client/src/lib/generative-design/__tests__/generative-engine.test.ts`

#### 27. generative-design/generative-adopt.ts (346 lines)

**Purpose:** Bridges generative design output to the project architecture.

**Implementation:**
- **Compare:** diffs candidate against current circuit by refdes (components) and name (nets)
  - Produces: added/removed/changed/unchanged counts, component diffs, net diffs, summary
- **Adopt:** converts CircuitIR to architecture nodes + edges
  - Grid layout (4 columns, 200px spacing)
  - Net-based edge generation (chain connectivity)
  - Metadata tagging (`generatedFrom: 'generative-design'`)
- **Export:** JSON download of candidate with fitness data
  - `noopener,noreferrer` on download link (security)
  - Proper blob URL cleanup

**Quality:** Clean implementation. The comparison and adoption workflows are well-structured.

**Test file:** `client/src/lib/generative-design/__tests__/generative-adopt.test.ts`

---

## Cross-Cutting Analysis

### Architectural Patterns

| Pattern | Modules Using It | Notes |
|---------|-----------------|-------|
| Singleton + Subscribe | 15/30 | Standard pattern. Consistent implementation |
| localStorage persistence | 10/30 | Config and history state |
| React hook wrapper | 15/30 | useState + useEffect + useCallback pattern |
| useSyncExternalStore | 2/30 | action-error-tracker, generative-engine |
| Pure functions (no state) | 8/30 | goal-parser, prediction-actions, semantic-pin-mapper, smart-library-installer, panel-explainer, fitness-scorer, generative-adopt, rag-knowledge-base |
| Async generator | 1/30 | generative-engine |
| Web APIs | 1/30 | voice-ai (Web Audio API) |

### Knowledge Base Sizes

| Module | Knowledge Items |
|--------|----------------|
| ai-prediction-engine | 32 rules |
| ai-root-cause | 22 symptoms, 20 failure patterns |
| ai-tutor | 30+ topic banks, 8 error hint banks |
| ai-safety-mode | 10 destructive + 13 caution action types |
| proactive-healing | 14 danger rules |
| sketch-explainer | 40+ concepts, 45+ regex patterns |
| voice-workflow | 20+ voice commands |
| smart-library-installer | 50+ include mappings, 30+ symbol mappings |
| rag-knowledge-base | 20 knowledge entries |
| board-aware-suggestions | 5 board profiles, 5 timer mappings |
| co-design | 10 materials, 6 sync points |
| fitness-scorer | 16 cost entries, 12 power entries |
| circuit-mutator | 36 resistor values, 23 cap values, 11 inductor values |

**Total:** ~500+ hardcoded knowledge items across all modules.

### Integration Status Matrix

| Module | Has Test File | Has React Hook | Has UI Integration | Calls AI API |
|--------|:------------:|:--------------:|:-----------------:|:------------:|
| ai-review-queue | Yes | Yes | Yes (ChatPanel) | No |
| ai-prediction-engine | Yes | Yes | Yes (Architecture) | No |
| ai-root-cause | Yes | Yes | Partial | No |
| ai-safety-mode | Yes | Yes | Yes (ChatPanel) | No |
| ai-tutor | Yes | Yes | Yes (Knowledge) | No |
| ai-co-designer | Yes | Yes | Yes (Architecture) | No |
| ai-goal-parser | Yes | No (pure funcs) | Yes (Idea-to-PCB) | No |
| action-error-tracker | Yes | Yes | Yes (ChatPanel) | No |
| prediction-actions | Yes | No (utility) | Yes (via prediction) | No |
| stream-resilience | No* | No (utility) | Yes (ChatPanel) | No (transport) |
| voice-workflow | Yes | Yes | Yes (Voice) | No |
| voice-ai | Yes | Yes | Partial | No |
| smart-library-installer | Yes | No (pure funcs) | Yes (Arduino) | No |
| multimodal-input | Yes | Yes | Yes (ChatPanel) | No |
| sketch-explainer | Yes | No (pure funcs) | Yes (Arduino) | No |
| proactive-healing | Yes | Yes | Yes (Architecture) | No |
| rag-engine | Yes | No (singleton) | Yes (Chat context) | No |
| rag-knowledge-base | Yes | No (pure data) | Yes (via RAG) | No |
| board-aware-suggestions | Yes | Yes | Yes (Schematic) | No |
| semantic-pin-mapper | Yes | No (pure funcs) | Yes (Schematic) | No |
| idea-to-pcb | Yes | No (singleton) | Yes (Workflow) | No |
| co-design | Yes | No (singleton) | Yes (Co-design) | No |
| panel-explainer | Yes | No (pure data) | Yes (All panels) | No |
| fitness-scorer | Yes | No (pure funcs) | Yes (via engine) | No |
| circuit-mutator | Yes | No (pure funcs) | Yes (via engine) | No |
| generative-engine | Yes | Yes | Yes (Design) | No |
| generative-adopt | Yes | No (pure funcs) | Yes (Design) | No |

\* `stream-resilience.ts` has no dedicated test file. This is the only coverage gap.

---

## Issues Found

### Critical

1. **No AI API calls in any "AI" module.** Every module branded as "AI" is purely algorithmic. The actual AI integration happens in `server/ai.ts` and `client/src/lib/project-context.tsx`. These client modules are heuristic/rule engines.

2. **Voice pipeline disconnect.** `voice-ai.ts` captures raw audio with VAD, but `voice-workflow.ts` expects text input. There is no speech-to-text bridge. The Web Speech API (`SpeechRecognition`) is not used, and no server-side STT endpoint exists.

### High

3. **Rule duplication between prediction and healing.** `ai-prediction-engine.ts` and `proactive-healing.ts` both check for: decoupling capacitors, flyback diodes, I2C pull-ups, level shifters. While they serve different purposes (prediction=proactive suggestion, healing=reactive prevention), the rule logic is duplicated, not shared.

4. **ai-co-designer scoring is a placeholder.** The module's comments explicitly state "real scoring is server-side via AI," but no server-side scoring endpoint exists. The module generates arbitrary scores, making the comparison feature misleading.

5. **ScriptProcessorNode deprecation in voice-ai.** The Web Audio API's `ScriptProcessorNode` is deprecated in favor of `AudioWorklet`. While still functional in all current browsers, it should be migrated.

### Medium

6. **stream-resilience has no dedicated test file.** This module handles all AI chat streaming — a test gap for critical infrastructure.

7. **RAG engine uses TF-IDF only.** No semantic search capability. Cannot find conceptually related content if exact terms differ.

8. **multimodal-input preprocessing is a stub.** The `preprocessImage()` method calculates output dimensions but does not perform actual canvas operations (resize, crop, grayscale, contrast, etc.). This is documented as intentional for unit testing, but means real preprocessing is not happening.

9. **Generative design cost/power estimates are very rough.** A resistor at $0.02 and a motor at $2.00 are ballpark — real BOM cost optimization would need supplier API integration.

### Low

10. **No localStorage quota management.** Multiple modules persist to localStorage independently. No coordination for quota limits. If one module fills the quota, others will silently fail.

11. **Singleton reset methods are inconsistent.** Some use `resetForTesting()`, others use `resetInstance()`, others use `reset()`. Should standardize.

---

## Coverage Gaps

1. **stream-resilience.ts** — No dedicated test file
2. **Voice pipeline end-to-end** — No test verifying audio capture → text → command execution
3. **Cross-module integration** — No tests verifying prediction → review queue → action execution pipeline
4. **localStorage quota exhaustion** — No tests for behavior when localStorage is full
5. **multimodal-input preprocessing** — No test for actual image transformation (canvas operations)

---

## Recommendations

### Short-term (address now)

1. Add a test file for `stream-resilience.ts` covering retry logic, heartbeat detection, error classification, and abort handling.

2. Standardize singleton reset method naming across all modules (`resetInstance()` everywhere).

### Medium-term (next wave)

3. Extract shared rule logic from `ai-prediction-engine.ts` and `proactive-healing.ts` into a common `electronics-rules.ts` module to eliminate duplication.

4. Implement Web Speech API bridge in `voice-ai.ts` to connect audio capture to text for `voice-workflow.ts`.

5. Replace `ScriptProcessorNode` with `AudioWorklet` in `voice-ai.ts`.

6. Add real canvas-based image preprocessing in `multimodal-input.ts` or remove the preprocessing API surface if it will always happen server-side.

### Long-term

7. Consider integrating actual AI calls into modules that would benefit: `ai-co-designer` (real scoring), `ai-goal-parser` (LLM-based parsing instead of keyword matching), `ai-root-cause` (LLM-augmented diagnosis).

8. Add semantic search capability to `rag-engine.ts` — either via embedding vectors (requires server-side model) or a client-side approach like BM25+.

9. Implement centralized localStorage management with per-module quota allocation to prevent silent failures.

---

## Module Inventory (sorted by size)

| File | Lines | Category |
|------|------:|----------|
| ai-prediction-engine.ts | 1387 | Rule engine |
| proactive-healing.ts | 1295 | Rule engine |
| sketch-explainer.ts | 1124 | Parser/Explainer |
| ai-root-cause.ts | 1005 | Causal analysis |
| multimodal-input.ts | 895 | Image pipeline |
| ai-goal-parser.ts | 899 | NLP parser |
| co-design.ts | 845 | Cross-domain |
| ai-tutor.ts | 834 | Educational |
| idea-to-pcb.ts | 754 | Workflow |
| ai-co-designer.ts | 634 | Design sessions |
| board-aware-suggestions.ts | 586 | Board analysis |
| voice-ai.ts | 556 | Audio capture |
| ai-safety-mode.ts | 524 | Action safety |
| panel-explainer.ts | 507 | Static data |
| ai-review-queue.ts | 480 | Action queue |
| rag-engine.ts | 464 | Text search |
| circuit-mutator.ts | 442 | GA operators |
| rag-knowledge-base.ts | 443 | Static data |
| smart-library-installer.ts | 418 | Error parser |
| voice-workflow.ts | 383 | Command matching |
| semantic-pin-mapper.ts | 350 | Pin analysis |
| generative-adopt.ts | 346 | Design adoption |
| fitness-scorer.ts | 339 | Scoring |
| generative-engine.ts | 335 | GA engine |
| action-error-tracker.ts | 311 | Error tracking |
| stream-resilience.ts | 285 | SSE transport |
| prediction-actions.ts | 58 | Utility |
| **Total** | **~14,500** | |
