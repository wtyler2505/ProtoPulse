---
description: "AbortSignal from client disconnect is not passed into ai.generateStream(), causing background Gemini requests to run until completion"
type: debt-note
source: "conductor/comprehensive-audit.md §1"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/ai.ts", "server/routes/chat.ts"]
---

# Genkit abort signal is not forwarded so closed tabs create zombie streams that leak API quota

When a user closes their browser tab mid-generation, the Express SSE handler fires `req.on('close')` but the `abortSignal` is never passed into the `ai.generateStream()` config inside `executeStreamForProvider`. The Gemini HTTP request continues running in the background, consuming API tokens and Node.js memory until the model finishes generating. At scale, this creates "zombie streams" that silently eat quota.

Modern Genkit patterns recommend passing the abort signal directly and/or migrating to a durable stream backend (FirestoreStreamManager or Redis) so clients can reconnect if their network drops.

---

Relevant Notes:
- [[ai-prompt-scaling-is-linear-and-will-hit-token-limits]] -- zombie streams compound the token cost problem
- [[ai-is-the-moat-lean-into-it]] -- AI reliability is table stakes if it's the moat

Topics:
- [[architecture-decisions]]
