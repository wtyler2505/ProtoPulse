# ProtoPulse — Baseline Metrics

> Collected: 2026-07-18
> Stack: TypeScript 5.6, React 19.2, Express 5, PostgreSQL/Drizzle, Vite 7, Vitest 4, Tauri 2, npm workspaces
> Domain: electronics design automation for makers

## Scope and Counting Rules

The trusted baseline is scoped to the live product surfaces: `client/src`, `server`, `shared`, `packages`, and `src-tauri`. Generated output, dependency folders, coverage, and Rust build artifacts are excluded. Repository-wide counts are not used as the headline because ProtoPulse also contains its Ars Contexta knowledge system, large design bundles, historical records, and other non-product material.

The product has two coexisting layers: the shipping legacy application (`client`, `server`, `shared`) and the 16-package graph/op-log engine (`packages`). Counts below include both.

## Summary Table

| Metric | Value |
|---|---:|
| Files counted by `scc` | 2,527 |
| Code-like files (`ts`, `tsx`, `js`, `jsx`, `rs`, styles, HTML) | 2,466 |
| Total code (`scc`, all counted languages) | 701,993 lines |
| Total code (`tokei`) | 703,214 lines |
| Main language | TypeScript/TSX |
| TypeScript code (`scc`) | 680,423 lines |
| Test files | 874 |
| Approximate non-test code-like files (including styles/HTML) | 1,592 |
| Approximate test:non-test file ratio | 0.55:1 |
| `scc` aggregate complexity | 98,541 |
| `scc` COCOMO model output | $26.3M / 47.65 months / 49.06 people |
| Git commits, last 30 days | 389 |
| Git commits, last 90 days | 1,048 |
| Git contributors, all history | 3 |
| Open GitHub issues / PRs | 0 / 0 |
| GitHub stars / forks | 1 / 0 |
| Root production dependencies | 100 |
| Root development dependencies | 49 |
| npm workspace packages | 16 engine packages plus `tools/golden` |
| PostgreSQL tables declared with `pgTable` | 47 |
| Server route-handler declarations (raw grep) | 829 |
| TODO/FIXME/HACK/XXX markers in product code | 90 |

The COCOMO figures are `scc`'s formula output. They are useful only as a size signal; they are not a valuation, staffing recommendation, or schedule forecast.

## Project Structure

```text
ProtoPulse/
├── client/src/            legacy shipping React application
├── server/                Express API, auth, collaboration, and frozen legacy AI
├── shared/                database schema and shared domain logic
├── packages/              16-package graph/op-log engine and new editor
│   ├── graph/             canonical design graph and typed operations
│   ├── parts/             part library and seed data
│   ├── erc/ drc/ route/   electrical, physical, and routing engines
│   ├── sim/ emu/ cosim/   simulation and emulation
│   ├── export/            manufacturing/export pipeline
│   ├── ai/                provider-independent crew runtime
│   ├── renderer/ app/     new WebGL editor
│   ├── review/ relay/     review and collaboration services
│   └── cli/ content/      command line and learning content
├── src-tauri/             desktop shell
├── tools/golden/          export-contract fixtures
├── docs/                  current docs plus point-in-time records
├── knowledge/ inbox/ ops/ Ars Contexta knowledge system
└── .ref/                  generated live project map and DNA
```

### Code-like files by area

```text
client/src  1,683
server        336
shared        104
packages      335
src-tauri       8
total       2,466
```

## `scc` Output

```text
Language                 Files     Lines   Blanks  Comments     Code Complexity
TypeScript                2451    869487   100095     88969   680423      98396
JSON                        41     17800       12         0    17788          0
TOML                        14       232       37        52      143          1
Rust                         8      1961      182       300     1479        144
Markdown                     5       512      105         0      407          0
CSS                          4      2457      332       398     1727          0
XML                          2         9        0         0        9          0
HTML                         1        17        0         0       17          0
TypeScript Typings           1         1        0         1        0          0
Total                     2527    892476   100763     89720   701993      98541

Estimated Cost to Develop (organic) $26,317,506
Estimated Schedule Effort (organic) 47.65 months
Estimated People Required (organic) 49.06
```

## `tokei` Output

```text
Language            Files        Lines         Code     Comments       Blanks
CSS                     4         2457         1727          398          332
JSON                   41        17800        17788            0           12
TOML                   14          232          143           52           37
TSX                   604       152472       130611         8478        13383
TypeScript           1849       717043       551446        79206        86391
HTML                    1           15           15            0            0
Markdown                5          500            0          395          105
Rust                    8         1799         1475          146          178
Total                2528       892327       703214        88675       100438
```

## `lizard` Top Functions

The skill's stock repository-wide scan was discarded after it traversed the 26 GB `src-tauri/target` build cache. Six bounded source-only runs produced the reproducible table in `phase-4-report.md`. Leading reported areas were:

```text
CCN 459  client/src/components/circuit-editor/breadboard-canvas/index.tsx:355
CCN 253  packages/app/src/editor/CanvasHost.tsx:95
CCN 204  client/src/lib/simulation/transient-analysis.ts:553
CCN  97  client/src/lib/simulation/circuit-solver.ts:340
CCN  93  client/src/components/circuit-editor/PCBLayoutView.tsx:281
CCN  50  packages/emu/src/esp32s3.ts:1069 (sha256BlockInto)
CCN  43  server/ai.ts:650 (legacy AI closure area)
CCN  23  shared/drc-engine.ts:995
```

`lizard` folds some nested TypeScript/React callbacks into a reported closure, so these values identify high-control-flow source spans; they are not a direct bug count.

## Git Activity

```text
commits_30d=389
commits_90d=1048
contributors_all=3
latest_commit=fbd2f76e|2026-07-10T23:22:06-05:00|backlog: BL-0913
```

The most-touched top-level paths in the last 30 days were `ds-bundle`, `.claude`, `ops`, `packages`, and `docs`. Commit volume therefore measures the whole knowledge-and-product repository, not only application code.

## GitHub Health

```text
repository=https://github.com/wtyler2505/ProtoPulse
visibility=PUBLIC
default_branch=main
open_issues=0
open_pull_requests=0
latest_CI=success
latest_Packages_CI=success
latest_Tauri_build_matrix=failure
```

The latest three sampled pushes all passed the main and package workflows while the Tauri matrix failed. The latest failed run (`29139503578`) built all five platform packages, then failed its Linux x64 supply-chain step. A current local `cargo audit` identifies the two blockers as `RUSTSEC-2026-0194` and `RUSTSEC-2026-0195` through `quick-xml@0.38.4`, plus 23 warnings. The dependency lane needs remediation or precise time-boxed exceptions before desktop delivery can be called healthy.

## Dependency Manifest

```text
root dependencies=100
root devDependencies=49
root scripts=29
root workspaces=["packages/*", "tools/golden"]
engine packages=16
```

These are root-manifest counts. Workspace-local dependencies are intentionally not added because summing manifests would double-count shared packages.

## Large File Signals

```text
451.6 KiB  packages/emu/src/esp32s3.test.ts
395.5 KiB  packages/emu/src/esp32s3.ts
156.2 KiB  packages/parts/src/seed/index.ts
 63.8 KiB  server/ai.ts
 59.4 KiB  shared/schema.ts
 56.1 KiB  client/src/components/circuit-editor/PCBLayoutView.tsx
 55.2 KiB  client/src/components/views/ArchitectureView.tsx
 52.8 KiB  client/src/components/circuit-editor/breadboard-canvas/index.tsx
```

## Observations

- The February product-analysis artifacts are not a usable current map. The live product is roughly 702k code lines, 47 tables, and two major application layers.
- Tests are extensive by file count, but file count cannot establish behavioral coverage. Package-level test wiring and meaningful scenario coverage need separate inspection.
- The new engine is no longer a small prototype. It is a substantial second product surface whose migration into the shipping application remains unfinished.
- Root dependency breadth is high enough that maintenance, security, and ownership checks need to include workspace boundaries rather than inspect only `package.json`.
- GitHub's issue and PR queues are empty while the canonical local backlog has hundreds of open findings. GitHub is therefore not the planning source of truth.
- Current CI evidence is mixed: browser/server and package workflows pass, while desktop packaging is repeatedly red.
- The 90 intent markers and several very large implementation files are investigation pointers, not automatic defects.
- Framework behavior was checked against current React 19.2, Express 5.1, and Vite 7.3 documentation through Context7 before analysis.
