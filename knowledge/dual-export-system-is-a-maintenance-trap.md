---
description: "Two parallel export implementations with overlapping generators require double bug fixes"
type: debt-note
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/export/", "server/export-generators.ts"]
---

# The dual export system forces every bug fix to be applied twice across divergent implementations

The product analysis revealed a critical architectural finding: the export system existed as two parallel implementations. The legacy monolith (export-generators.ts, 1,209 LOC) was imported by ai-tools.ts for AI tool execution. The modular system (server/export/, 11+ files) was imported by circuit-routes.ts for REST endpoints. Seven generators overlapped with different function signatures. Both were active — the monolith was not dead code.

This pattern is a maintenance trap because it violates the single-source-of-truth principle in a subtle way: a developer fixing a Gerber generation bug in one system has no indication that the same bug exists in the other. The AI and the REST API could produce different outputs for the same circuit. This has since been substantially addressed through barrel refactoring, but the pattern is worth remembering any time "we'll keep the old one around for compatibility" is proposed.

---

Relevant Notes:
- [[god-files-create-feature-paralysis-through-complexity]] -- the monolith that spawned this
- [[exports-are-only-accessible-via-ai-chat]] -- UX consequence of having two systems with no unified UI
- [[cors-origin-reflection-was-a-critical-csrf-vector]] -- same anti-pattern: a dev-time shortcut that became a production liability

Topics:
- [[architecture-decisions]]
