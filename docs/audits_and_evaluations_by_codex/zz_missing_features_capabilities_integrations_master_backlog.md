# ProtoPulse Missing Features, Capabilities, and Integrations (Master Backlog)

Date: 2026-03-06  
Author: Codex  
Goal: One big plain-English list of what ProtoPulse still needs.

How to read:
- `Missing` = not built yet.
- `Partial` = some code exists, but not fully working/connected in real product flow.

## A) Critical Foundation Gaps (must exist for safe scale)
- `MF-001` `Missing` Unified project ownership guard on every project route.
- `MF-002` `Missing` Unified project ownership guard on every circuit route.
- `MF-003` `Missing` Ownership enforcement in AI endpoints (project + circuit scope).
- `MF-004` `Missing` Ownership enforcement in AI tool executors.
- `MF-005` `Missing` Ownership-safe storage APIs by default (not raw ID-only).
- `MF-006` `Missing` Tenant-scoped job routes (read/cancel/delete).
- `MF-007` `Missing` Tenant-scoped collaboration REST routes.
- `MF-008` `Missing` WebSocket project authorization enforcement.
- `MF-009` `Missing` Collaboration lock scope per project (no cross-project lock collisions).
- `MF-010` `Missing` Server-side enforcement for destructive AI tool confirmations.
- `MF-011` `Missing` Auth/session cache separation on account switch.
- `MF-012` `Missing` Query cache clear on user identity change.
- `MF-013` `Missing` Safe session handling for network blips (no false logout).
- `MF-014` `Missing` Migration chain fully synced with live schema.
- `MF-015` `Missing` Real transaction safety for multi-step import writes.
- `MF-016` `Missing` Queue executor runtime wiring in production.
- `MF-017` `Missing` Queue watchdog timeout for stuck jobs.
- `MF-018` `Missing` ngspice netlist directive injection hardening.
- `MF-019` `Missing` Safe sandbox for custom script checks (hard timeout/kill path).
- `MF-020` `Missing` API error/status consistency contracts across all route families.

## B) Product Truth Gaps (feature says “done” but runtime is still partial)
- `MF-021` `Partial` Import flow parses files but often does not apply into live project state.
- `MF-022` `Partial` Export panel contracts are inconsistent (`fzz`, Gerber, auth header path).
- `MF-023` `Partial` Collaboration exists in code but runtime activation is inconsistent.
- `MF-024` `Partial` Offline sync exists in code but real backend contract is incomplete.
- `MF-025` `Partial` Component standard library seeding is not a true upsert.
- `MF-026` `Partial` Standard categories are not unified end-to-end (UI/filter/storage).
- `MF-027` `Partial` Manufacturer DRC templates exist but are not connected to active flows.
- `MF-028` `Partial` Design variable engine exists but is not wired into real user workflows.
- `MF-029` `Partial` Serial/hardware client code exists but user-facing flow is incomplete.
- `MF-030` `Partial` Metrics lifecycle is implemented but not fully wired in runtime.
- `MF-031` `Partial` Fatal error handling exists but lifecycle and exit behavior need hardening.
- `MF-032` `Partial` Route-level test reality is weaker than real route surface.

## C) Learning + Onboarding Features Still Needed
- `MF-033` `Missing` Step-by-step beginner learning path (from zero to PCB).
- `MF-034` `Missing` Guided “first circuit” interactive tutorial with checks.
- `MF-035` `Missing` Guided “first PCB” interactive tutorial with checks.
- `MF-036` `Missing` Lesson mode that locks UI to only needed controls.
- `MF-037` `Missing` Progress tracking for learning milestones.
- `MF-038` `Missing` Skill-level adaptive hints (beginner/intermediate/advanced).
- `MF-039` `Missing` In-context electronics glossary tooltips.
- `MF-040` `Missing` Instant “why this rule matters” explanations in DRC/ERC output.
- `MF-041` `Missing` Lab/assignment templates for educators.
- `MF-042` `Missing` Classroom mode (teacher dashboard + student submissions).
- `MF-043` `Missing` Interactive troubleshooting wizard for common circuit mistakes.
- `MF-044` `Missing` Component pinout quick-view overlay.
- `MF-045` `Missing` Pattern library (“good decoupling”, “proper pull-up”, etc.).
- `MF-046` `Missing` AI design review mode that gives senior-engineer style critique.

## D) Schematic + PCB Core Features Still Needed
- `MF-047` `Missing` True push-and-shove interactive PCB router.
- `MF-048` `Missing` Differential pair routing tools with constraints.
- `MF-049` `Missing` Length matching and serpentine tuning tools.
- `MF-050` `Missing` Controlled impedance routing support.
- `MF-051` `Missing` Stackup editor with dielectric/copper definitions.
- `MF-052` `Missing` Advanced keep-out/keep-in region editor.
- `MF-053` `Missing` Board cutouts/slots/internal milling editor.
- `MF-054` `Missing` Via stitching automation.
- `MF-055` `Missing` Teardrop generation.
- `MF-056` `Missing` Copper pour workflows fully tied to DRC/manufacturing rules.
- `MF-057` `Missing` Domain-level electrical class templates (USB, DDR, power, RF).
- `MF-058` `Missing` Interactive cross-probing between schematic and PCB views.
- `MF-059` `Missing` Net highlighting synced across all views.
- `MF-060` `Missing` Better multi-sheet schematic hierarchy management.
- `MF-061` `Missing` Reusable schematic blocks across projects.
- `MF-062` `Missing` Footprint mapping assistant with validation.
- `MF-063` `Missing` Live pin-compatibility checks for replacements.
- `MF-064` `Missing` Automatic decoupling and power network placement suggestions.
- `MF-065` `Missing` Real design assistant for placement optimization.

## E) Simulation + Analysis Features Still Needed
- `MF-066` `Missing` Full transient simulation UX that is safe and robust.
- `MF-067` `Missing` DC operating point analysis as first-class workflow.
- `MF-068` `Missing` Monte Carlo tolerance analysis.
- `MF-069` `Missing` Worst-case corner analysis.
- `MF-070` `Missing` Mixed-signal simulation (analog + digital logic).
- `MF-071` `Missing` Power integrity analysis workflows.
- `MF-072` `Missing` Signal integrity analysis (crosstalk/reflections/eye-style checks).
- `MF-073` `Missing` EMI/EMC pre-check workflows.
- `MF-074` `Missing` Thermal map overlay directly on PCB view.
- `MF-075` `Missing` Current density visualization on traces/pours.
- `MF-076` `Missing` Simulation scenario manager with presets.
- `MF-077` `Missing` Simulation compare mode (before/after design changes).
- `MF-078` `Missing` Shared unit/scale contract across all sim + DRC engines.
- `MF-079` `Missing` Safe simulation resource guardrails (time, memory, output size).
- `MF-080` `Missing` Interactive live simulation experience (EveryCircuit-style flow).

## F) Hardware + Firmware Integration Features Still Needed
- `MF-081` `Missing` End-to-end Web Serial workflow in main product UX.
- `MF-082` `Missing` Multi-board support (Arduino, ESP32, RP2040, STM32 profiles).
- `MF-083` `Missing` Board auto-detect + port profile matching.
- `MF-084` `Missing` Firmware compile/upload loop from inside ProtoPulse.
- `MF-085` `Missing` Serial monitor with saved presets and decode helpers.
- `MF-086` `Missing` Protocol helpers (I2C/SPI/UART monitor/decode tools).
- `MF-087` `Missing` Pin conflict checker between design and firmware mapping.
- `MF-088` `Missing` One-click firmware scaffold tied to actual design netlist/pins.
- `MF-089` `Missing` Hardware session recorder (logs + actions + replay).
- `MF-090` `Missing` Robust reconnect manager with backoff + state recovery.
- `MF-091` `Missing` Live telemetry panel for connected hardware.
- `MF-092` `Missing` Safe command sandbox for device interaction.
- `MF-093` `Missing` Board package/library manager integration.
- `MF-094` `Missing` In-app flashing progress/error diagnostics.
- `MF-095` `Missing` Integration tests that hit real Web Serial contract paths.

## G) Inventory + Component Intelligence Features Still Needed
- `MF-096` `Missing` Camera-based component identification.
- `MF-097` `Missing` Multi-angle photo follow-up loop for uncertain IDs.
- `MF-098` `Missing` Confidence score output for AI component identification.
- `MF-099` `Missing` Barcode/QR scanning for component lookup.
- `MF-100` `Missing` Physical storage location tracking (bin/drawer/shelf).
- `MF-101` `Missing` Inventory quantity tracking tied to BOM consumption.
- `MF-102` `Missing` Low-stock alerts and reorder suggestions.
- `MF-103` `Missing` Equivalent/alternate part finder with compatibility checks.
- `MF-104` `Missing` Automated datasheet fetch + parse + pin extraction.
- `MF-105` `Missing` Favorite/starred components workflow.
- `MF-106` `Missing` Fuzzy search for component libraries (typo tolerant).
- `MF-107` `Missing` Scan/import history for physical part ingestion.
- `MF-108` `Missing` Component condition checks (damaged pin/corrosion notes).
- `MF-109` `Missing` Inventory health scoring dashboard.
- `MF-110` `Missing` Dead-stock analysis and cleanup insights.

## H) Collaboration + Team Workflow Features Still Needed
- `MF-111` `Missing` True multi-user live editing with cursor presence.
- `MF-112` `Missing` Fine-grained roles (owner/editor/reviewer/viewer).
- `MF-113` `Missing` Shared project permissions UI.
- `MF-114` `Missing` Spatial review comments pinned to schematic/PCB coordinates.
- `MF-115` `Missing` Review resolution workflow (open/resolved/blocked).
- `MF-116` `Missing` Approval gates before release/export to manufacturing.
- `MF-117` `Missing` Formal ECO workflow (propose/review/approve/apply).
- `MF-118` `Missing` Branching model for design revisions.
- `MF-119` `Missing` Safe merge tooling for branch diffs.
- `MF-120` `Missing` Activity feed for team actions and design-impact events.
- `MF-121` `Missing` Mentions/notifications for comments and approvals.
- `MF-122` `Missing` Team templates and reusable standards packs.
- `MF-123` `Missing` Conflict resolution UX for offline + concurrent edits.
- `MF-124` `Missing` Full audit trail for important design state changes.
- `MF-125` `Missing` Time-travel restore at view/object granularity.

## I) Manufacturing + Supply Chain Integrations Still Needed
- `MF-126` `Missing` One-click fab ordering integration (starting with JLCPCB/LCSC flow).
- `MF-127` `Missing` Instant manufacturing quote integration in export flow.
- `MF-128` `Missing` Live distributor stock/pricing APIs (DigiKey, Mouser, LCSC, Farnell).
- `MF-129` `Missing` Automatic MPN normalization and dedupe in BOM.
- `MF-130` `Missing` Alternate-part sourcing suggestions by lead time and cost.
- `MF-131` `Missing` Assembly cost estimator (SMT/THT/setup/yield).
- `MF-132` `Missing` Panelization tool with tab/v-score/fiducial support.
- `MF-133` `Missing` Pick-and-place validation and preview tooling.
- `MF-134` `Missing` DFM checks beyond simple DRC (annular ring, solder mask, paste rules).
- `MF-135` `Missing` Manufacturing package validator before download.
- `MF-136` `Missing` 3D board manufacturing preview.
- `MF-137` `Missing` Build-time risk score (cost + supply + assembly risk).
- `MF-138` `Missing` AML/approved-vendor-list enforcement for enterprise teams.
- `MF-139` `Missing` Lifecycle/end-of-life component warnings.
- `MF-140` `Missing` Quote and order history tracking per project.

## J) AI Capability Features Still Needed
- `MF-141` `Missing` AI confidence scores and confidence-based review queues.
- `MF-142` `Missing` Strong model/tool route allowlists per endpoint/task.
- `MF-143` `Missing` Better guardrails against fake-success AI actions.
- `MF-144` `Missing` AI plan mode that previews risky changes before execution.
- `MF-145` `Missing` AI safety mode for beginners (extra confirmations + teaching mode).
- `MF-146` `Missing` AI context grounding with project ownership-safe retrieval.
- `MF-147` `Missing` Built-in datasheet RAG for grounded suggestions.
- `MF-148` `Missing` AI-generated testbench suggestions for simulation.
- `MF-149` `Missing` AI BOM optimization assistant (cost/performance/availability goals).
- `MF-150` `Missing` AI placement/routing copilot with explainable reasoning.
- `MF-151` `Missing` AI design review scorecard with action priorities.
- `MF-152` `Missing` AI incident/debug assistant for hardware bring-up.
- `MF-153` `Missing` AI explain mode in simple language for non-experts.
- `MF-154` `Missing` AI model fallback policy with clear user-visible status.
- `MF-155` `Missing` AI action dry-run mode with impact preview.

## K) Interop + Data Exchange Features Still Needed
- `MF-156` `Missing` First-class KiCad import (not just export).
- `MF-157` `Missing` First-class Eagle import (not just export).
- `MF-158` `Missing` First-class EasyEDA import.
- `MF-159` `Missing` First-class Altium import bridge.
- `MF-160` `Missing` Robust Fritzing parts library import (FZPZ full pipeline parity).
- `MF-161` `Missing` Cross-tool mapping validator (net, layer, footprint parity checks).
- `MF-162` `Missing` Import repair assistant for broken/incomplete upstream files.
- `MF-163` `Missing` Shareable simulation links with frozen settings.
- `MF-164` `Missing` Public embed API for schematic/PCB views with access controls.
- `MF-165` `Missing` Versioned API contract docs synced from live routes/schema.

## L) Platform, Security, and Ops Features Still Needed
- `MF-166` `Missing` Full CORS allowlist hardening and deployment-safe defaults.
- `MF-167` `Missing` Tight CSP policy parity across dev/prod for critical flows.
- `MF-168` `Missing` Auth hardening for admin operations (timing-safe compare + throttling).
- `MF-169` `Missing` Rate limit strategy per route risk profile.
- `MF-170` `Missing` Background job durability store (not in-memory only).
- `MF-171` `Missing` Full observability stack (structured logs, traces, alerts, SLOs).
- `MF-172` `Missing` Health/readiness checks tied to real dependencies.
- `MF-173` `Missing` Error taxonomy with stable error codes for client handling.
- `MF-174` `Missing` Data retention policies and per-project cleanup tooling.
- `MF-175` `Missing` Backup integrity verification and restore drills.
- `MF-176` `Missing` SSO/OIDC support for team and org deployments.
- `MF-177` `Missing` RBAC + org/team tenancy model.
- `MF-178` `Missing` Audit log explorer UI for security/compliance events.
- `MF-179` `Missing` Deployment profiles (local/dev/staging/prod) with strict config validation.
- `MF-180` `Missing` Coverage gates and test quality thresholds in CI.

## M) Developer + Power User Features Still Needed
- `MF-181` `Missing` Public API + webhook platform for automations.
- `MF-182` `Missing` Plugin/extension SDK.
- `MF-183` `Missing` Macro recorder/player for repeated actions.
- `MF-184` `Missing` Custom keybinding editor.
- `MF-185` `Missing` Scriptable command palette actions.
- `MF-186` `Missing` Design parameterization UI tied to variables engine.
- `MF-187` `Missing` Reusable organization-level rule packs.
- `MF-188` `Missing` CLI tooling for headless validation/export pipelines.
- `MF-189` `Missing` Git-native design diff/merge workflow.
- `MF-190` `Missing` Open telemetry/events export for external dashboards.

## N) UX + Access Features Still Needed
- `MF-191` `Missing` Mobile-first UI mode for quick review/edit tasks.
- `MF-192` `Missing` Light theme and OLED-black theme options.
- `MF-193` `Missing` Full keyboard accessibility in editor-heavy surfaces.
- `MF-194` `Missing` Accessibility audits enforced in CI for core pages.
- `MF-195` `Missing` User-facing reliability/status page for core subsystems.
- `MF-196` `Missing` In-app docs hub with searchable reference.
- `MF-197` `Missing` Contextual “what changed” summaries after AI actions.
- `MF-198` `Missing` Better failure UX with actionable fix steps.
- `MF-199` `Missing` Smart defaults wizard for new project setup.
- `MF-200` `Missing` Cross-view sync inspector to debug mismatches fast.

## Recommended First Slice (if we only do a few things first)
- `MF-001` through `MF-020` (critical foundation safety).
- `MF-021` through `MF-032` (make product behavior truthful).
- `MF-081` through `MF-095` (real hardware workflow).
- `MF-126` through `MF-140` (manufacturing path to “build real boards”).
- `MF-033` through `MF-046` (learning path to grow adoption).

