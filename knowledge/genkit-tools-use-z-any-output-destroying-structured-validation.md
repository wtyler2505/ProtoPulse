---
description: "All dynamically generated Genkit tools use outputSchema: z.any(), bypassing structured output validation and letting malformed LLM JSON crash the backend"
type: debt-note
source: "conductor/comprehensive-audit.md §1"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/genkit.ts"]
---

# Genkit tool output schemas are all z.any which destroys structured validation guarantees

In `server/genkit.ts`, every dynamically generated Genkit tool uses `outputSchema: z.any()`. This actively defeats the structured output validation that Genkit provides — hallucinatory or malformed JSON payloads from the LLM will crash the backend execution logic instead of being caught and retried by the framework.

Additionally, `inputSchema: toolDef.parameters as any` in the same file bypasses TypeScript safety at the boundary between Genkit execution and tool definitions, meaning invalid LLM outputs may slip through to database mutations.

---

Relevant Notes:
- [[all-procurement-data-is-ai-fabricated]] -- fabricated data compounds when output isn't validated

Topics:
- [[architecture-decisions]]
