---
description: "Custom manualChunks forces full download of @xyflow, react-markdown, recharts, codemirror on initial load even for unused routes"
type: debt-note
source: "conductor/comprehensive-audit.md §16"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["vite.config.ts"]
---

# Vite manualChunks strategy defeats dynamic import and tree-shaking creating a bloated initial payload

In `vite.config.ts`, the custom `manualChunks` strategy isolates massive libraries (`@xyflow`, `react-markdown`, `recharts`, `codemirror`) into dedicated vendor chunks. While intended to improve caching, this forces all users to download the entirety of these libraries on initial load — even if they only visit a route that doesn't use them.

This defeats Vite's native dynamic import and tree-shaking optimizations, resulting in a massively bloated initial JS payload. The fix is removing `manualChunks` and relying on Vite's automatic code splitting via dynamic `import()` in route components.

---

Relevant Notes:
- [[reactflow-json-stringify-sync-is-on-per-render-and-breaks-at-10k-nodes]] -- canvas + bundle both hurt initial load

Topics:
- [[architecture-decisions]]
