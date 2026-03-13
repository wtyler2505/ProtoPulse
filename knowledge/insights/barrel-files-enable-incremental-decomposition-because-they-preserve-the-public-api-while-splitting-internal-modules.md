---
summary: Barrel files (re-export index modules) enable incremental decomposition by preserving the public import path while splitting internal modules
areas: ["[[index]]"]
related insights:
  - "[[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] — barrel files are the mechanism that makes the thin-orchestrator decomposition pattern safe"
  - "[[the-gap-between-feature-exists-and-feature-is-wired-is-the-dominant-source-of-broken-workflows]] — stable import paths from barrels prevent decomposition from creating new wiring gaps"
created: 2026-03-13
---

ProtoPulse used barrel files as the primary strategy for decomposing monolithic files without breaking callers. `server/routes.ts` became a barrel importing 28 domain routers from `server/routes/`. `server/ai-tools.ts` became a barrel importing 12 tool modules (88 AI tools total). `server/circuit-routes.ts` became a barrel for 13 circuit routers. `server/export-generators.ts` became a barrel for 16 export modules. In every case, the original import path (`import { ... } from './routes'`) continued to work, meaning callers didn't need updating. The barrel pattern turns a risky big-bang refactor into a series of safe, incremental extractions.

## Topics

- [[index]]
