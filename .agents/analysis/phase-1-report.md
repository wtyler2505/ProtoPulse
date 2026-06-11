# Phase 1: Current State Inventory -- rest-express

> Generated: 2026-05-17

## Feature Inventory

| Feature | Maturity | Evidence | Notes |
|---------|----------|----------|-------|
| Arduino Console & Board Manager | Functional | `./client/src/components/views/arduino/` | Contains Console, Toolbar, Board Manager, File Explorer, Examples Browser |
| SPICE Simulation & Frequency Analysis | Partial | `./client/src/components/simulation/` | Contains SpiceImportSection, FrequencyAnalysisPanel, ResultHistorySection |
| Parts Procurement | Stub | `./client/src/components/views/ProcurementView.tsx` | View for component sourcing and BOM management |
| Collaboration & Conflict Resolution | Partial | `./client/src/components/collaboration/` | Includes ConflictResolutionDialog |
| Knowledge Base / Docs | Functional | `./client/src/components/views/KnowledgeView.tsx` | Supported by 1873 Markdown/MDX documentation files |
| Desktop Integration (Tauri) | Functional | `./client/src/lib/desktop/desktop-lifecycle-bridge.tsx` | Tauri v2 used for OS-level shell, filesystem, and native dialogs |
| Authentication & Contexts | Mature | `./client/src/lib/auth-context.tsx`, `project-context.tsx` | Handled via React 19 Context API and local state |
| Circuit/PCB Design Capabilities | Mature | `@tscircuit/*` dependencies | Core routing, footprint generation, SVG export, and schematic solvers |

## Data Flow Map

- **Frontend State**: Managed via React 19 Contexts (`project-context.tsx`, `auth-context.tsx`, `theme-context.tsx`, `dnd-context.tsx`) and data fetching layer via `@tanstack/react-query`.
- **Desktop/Native Bridge**: Tauri plugin hooks (`@tauri-apps/plugin-shell`, `@tauri-apps/plugin-fs`) bridge the React application with the Rust backend. The `desktop-lifecycle-bridge.tsx` component orchestrates this inter-process communication.
- **API Routing**: Extensive Express backend (1930 GET routes, 5974 POST routes, 509 router endpoints) handles core application logic, likely orchestrating complex computations, component searches, or compilation.
- **Persistence Layer**: Drizzle ORM (`drizzle-orm`) paired with PostgreSQL handles the database schemas and queries in a type-safe manner.

## Integration Points

| Integration | Type | Status | Location |
|-------------|------|--------|----------|
| Arduino CLI | External | Active | Desktop backend & `ArduinoLibraryManager.tsx` |
| SPICE Engine | External | Active | `SpiceImportSection.tsx` |
| PostgreSQL | Database | Configured | Backend via Drizzle ORM |
| Tauri OS Plugins | API | Active | `desktop-lifecycle-bridge.tsx` and dependencies |
| TSCircuit Modules | Internal Lib | Active | Frontend circuit rendering and routing logic |

## Navigation & Entry Points

- **Workspace / Editor**: The primary workspace view combining `PartUsagePanel` and canvas rendering (using `three` and `@react-three/fiber` for 3D or `@xyflow/react` for 2D schematics).
- **Arduino IDE**: Dedicated view suite for hardware flashing and device monitoring (`ArduinoBoardManager`, `ExamplesBrowser`, `ArduinoConsoleOutput`).
- **Simulation Dashboard**: SPICE netlist import and frequency analysis graphing.
- **Knowledge View**: Centralized documentation, tutorials, and help interface.
- **Procurement**: Bill of materials (BOM) preparation and component ordering.

## Module Breakdown

| Module | Files | LOC | Purpose |
|--------|-------|-----|---------|
| Frontend Client | ~2169 Source | ~500k | React 19 UI, Vite build, Tailwind styling, @tscircuit logic |
| Backend Server | ~8400+ routes | ~600k | Express REST API for orchestration, db operations, and auth |
| Tauri Desktop | Configs/Bridge | N/A | Rust wrapper for cross-platform native OS capabilities |
| Documentation | 1873 Doc | ~100k | High volume of product, design, and technical docs |
| Testing | 814 Test | N/A | Vitest suite validating core solvers and API behaviors |

## Developer Intent Signals

- **Total Markers**: 1481 matches across 122 files (TODO/FIXME/HACK/DEPRECATED).
- **Indication**: Extremely high volume of technical debt or planned future work. Large portions of the codebase are either under active iteration or require refactoring, particularly around complex features like SPICE simulations, Arduino integration, or edge-case handling in the circuit auto-router.