# ProtoPulse Audit Master Section Map (Codex)

Date: 2026-03-05  
Status: Planning map only. No section audit has started yet.

## Purpose
Define a strict, full-coverage audit/evaluation breakdown so we can review ProtoPulse in controlled sections, discuss each pass, and avoid blind spots.

## Audit Modes
- Strict: Assume nothing, verify behavior against code paths and contracts.
- Open-minded: Flag risk and debt without forcing premature rewrites.
- Evidence-based: Every finding must map to specific files/functions/tests.

## Frontend Sections
| ID | Section | Primary Paths | Primary Focus |
|---|---|---|---|
| FE-01 | App Shell + Routing | `client/src/main.tsx`, `client/src/App.tsx`, `client/src/pages/*` | Boot flow, route correctness, auth gating, crash behavior |
| FE-02 | Workspace Frame + Navigation | `client/src/pages/ProjectWorkspace.tsx`, `client/src/components/layout/*` | 3-panel coordination, navigation state flow, usability friction |
| FE-03 | Core Views | `client/src/components/views/*` | Feature behavior, edge-case UX, state sync issues |
| FE-04 | Design/Editor UI Layer | `client/src/components/circuit-editor/*`, `client/src/components/simulation/*` | Canvas interactions, interaction safety, rendering correctness |
| FE-05 | Shared UI System | `client/src/components/ui/*`, `client/src/index.css` | Component consistency, accessibility, style system health |
| FE-06 | AI Chat UX + Actions | `client/src/components/panels/*`, `client/src/hooks/useRAG.ts`, `client/src/hooks/usePredictions.ts`, `client/src/hooks/useVoiceAI.ts` | Streaming UX, action parsing trust, failure states |
| FE-07 | Global State + Contexts | `client/src/lib/project-context.tsx`, `client/src/lib/contexts/*`, `client/src/lib/auth-context.tsx`, `client/src/lib/theme-context.tsx`, `client/src/lib/tutorial-context.tsx` | State correctness, coupling, stale/race risk |
| FE-08 | Data Fetch + Cache | `client/src/lib/queryClient.ts`, query/mutation usage in `client/src/lib/*` | Cache invalidation, retry semantics, mutation consistency |
| FE-09 | Circuit/EDA Logic (Client) | `client/src/lib/circuit-editor/*`, `client/src/lib/pcb/*`, `client/src/lib/drc-scripting.ts`, `client/src/lib/copper-pour.ts` | Domain correctness, scalability, deterministic behavior |
| FE-10 | Simulation + Analysis Logic | `client/src/lib/simulation/*`, analysis helpers in `client/src/lib/*` | Model assumptions, input validation, numerical reliability |
| FE-11 | Import/Export + Interop UX | `client/src/lib/design-import.ts`, `client/src/lib/design-gateway.ts`, export-related panel code | Format robustness, user-safe error handling |
| FE-12 | Collaboration + Offline/PWA | `client/src/lib/collaboration-client.ts`, `client/src/lib/offline-sync.ts`, `client/src/lib/indexed-db-manager.ts`, `client/src/lib/pwa-manager.ts` | Conflict handling, offline recovery, data loss vectors |
| FE-13 | Hardware/Serial Integration (Client) | `client/src/lib/web-serial.ts`, related hooks/components | Permission flow, disconnect/reconnect, timeout/cancel paths |
| FE-14 | Frontend Security + Test Quality | Client rendering surfaces + client test suites | XSS/unsafe rendering, test realism, gap analysis |

## Backend Sections
| ID | Section | Primary Paths | Primary Focus |
|---|---|---|---|
| BE-01 | Server Boot + Middleware Chain | `server/index.ts`, `server/vite.ts`, `server/static.ts`, boot middleware | Startup safety, middleware order, fail-fast behavior |
| BE-02 | Auth + Session + API Key Security | `server/auth.ts`, `server/routes/auth*.ts` | Auth bypass risk, session lifecycle, key handling/encryption |
| BE-03 | Main REST Route Surface | `server/routes.ts`, `server/routes/*` | Validation rigor, status/response consistency, route hygiene |
| BE-04 | Circuit Route Surface | `server/circuit-routes.ts`, `server/circuit-routes/*` | Contract consistency, circuit CRUD correctness, edge handling |
| BE-05 | AI Core Orchestration | `server/ai.ts`, `server/circuit-ai/*`, `server/component-ai.ts` | Safety rails, prompt/context construction risk, tool orchestration |
| BE-06 | AI Tool Registry + Executors | `server/ai-tools.ts`, `server/ai-tools/*` | Permission boundaries, deterministic tool behavior, error mapping |
| BE-07 | Storage Layer + Interface Integrity | `server/storage.ts`, `server/storage/*` | `IStorage` contract adherence, soft-delete filtering, transaction safety |
| BE-08 | Database + Shared Schema Contracts | `server/db.ts`, `shared/schema.ts`, `shared/api-types.generated.ts` | Schema integrity, relation correctness, migration risk |
| BE-09 | Export Pipeline | `server/export/*`, `server/export-generators.ts`, `server/component-export.ts` | Output correctness, malformed input handling, performance risk |
| BE-10 | Simulation + SPICE Backend | `server/simulation.ts`, `server/spice-import.ts`, related routes | Parse/compute safety, resource controls, error containment |
| BE-11 | Jobs + Background Processing | `server/job-queue.ts`, `server/routes/jobs.ts` | Stuck jobs, retries, cancel/idempotency behavior |
| BE-12 | Collaboration + Realtime | `server/collaboration.ts`, collaboration routes/tests | Race conditions, ordering guarantees, conflict behavior |
| BE-13 | Cache + Metrics + Performance Controls | `server/cache.ts`, `server/lib/lru-cache.ts`, `server/metrics.ts` | Invalidation correctness, memory pressure, observability gaps |
| BE-14 | Errors + Logging + Circuit Breakers | `server/logger.ts`, `server/circuit-breaker.ts`, error utilities | Failure isolation, debugging quality, operational signal |
| BE-15 | Security Hardening | Cross-cutting backend paths | CORS/rate limits/injection/file-path and URL safety |
| BE-16 | Backend Test Reality Check | `server/__tests__/*` | Coverage blind spots, weak assertions, missing failure-mode tests |

## Shared Core Sections
| ID | Section | Primary Paths | Primary Focus |
|---|---|---|---|
| SH-01 | Shared Domain Engines | `shared/drc-engine.ts`, `shared/component-types.ts`, `shared/circuit-types.ts`, `shared/*-diff.ts` | Domain truth, logic consistency between frontend/backend |
| SH-02 | Shared Validation + Standards | `shared/drc-templates.ts`, `shared/standard-library.ts`, `shared/design-variables.ts` | Rule accuracy, standards consistency, drift detection |

## Section Delivery Rules (for each future audit file)
- One section per audit file.
- Required structure: Scope, Findings by severity, Evidence, Risk impact, Recommended fixes, Test gaps, Decision questions.
- No vague claims. Every finding includes file references.
- Separate facts from inference.

## Planned File Naming
- `01_FE-01_app_shell_and_routing_audit.md`
- `02_FE-02_workspace_frame_navigation_audit.md`
- ...
- `NN_BE-16_backend_test_reality_check_audit.md`
- Final roll-up: `zz_master_findings_rollup.md`

## Pre-Audit Alignment (must be discussed first)
- Severity rubric thresholds (P0/P1/P2/P3)
- Evidence standard (code-only vs code+tests vs runtime validation)
- How strict to be on “known debt” versus “shipping blockers”
- Fix recommendation format (minimal patch vs ideal architecture)

