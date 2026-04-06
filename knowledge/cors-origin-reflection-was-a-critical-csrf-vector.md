---
description: "Dynamic CORS reflecting any origin with credentials enabled was the highest-severity security finding"
type: debt-note
source: "docs/product-analysis-report.md"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/index.ts"]
---

# CORS dynamically reflecting request origin with credentials enabled was a critical CSRF vector

Batch 7 of the gap analysis found that in dev mode, the Access-Control-Allow-Origin header was set to whatever the browser sent (req.headers.origin) with Allow-Credentials: true. This is a textbook CSRF vulnerability: any malicious website could make authenticated cross-origin API requests on behalf of a logged-in user. The finding was rated P0 Critical — the highest severity in the entire analysis.

This was fixed in Wave E (CORS allowlist), but the finding illustrates a pattern worth internalizing: security defaults in development mode become production vulnerabilities when the dev/prod boundary is blurry. The fix was simple (explicit origin allowlist), but the vulnerability was invisible because it only manifests in cross-origin contexts that normal development does not exercise. Security regression tests (added in Wave E) now verify the allowlist behavior.

---

Relevant Notes:
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- another hidden scaling risk that is invisible under normal development
- [[god-files-create-feature-paralysis-through-complexity]] -- dev shortcuts compound into structural problems
- [[dual-export-system-is-a-maintenance-trap]] -- same pattern: a dev-time convenience that became a production liability

Topics:
- [[architecture-decisions]]
