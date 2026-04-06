---
description: "setInterval calls in arduino, agent, and chat routes are never assigned to variables for clearInterval — closures leak memory until OOM"
type: debt-note
source: "conductor/comprehensive-audit.md §13"
confidence: proven
topics: ["[[architecture-decisions]]"]
related_components: ["server/routes/arduino.ts", "server/routes/agent.ts", "server/routes/chat.ts"]
---

# setInterval calls are never cleared creating a memory ratchet pattern that leaks until OOM

The codebase contains numerous `setInterval` calls in `server/routes/arduino.ts`, `server/routes/agent.ts`, and `server/routes/chat.ts` that are created per-connection or globally but never assigned to a variable for `clearInterval()`. This creates the "Ratchet Pattern" where memory grows during activity but the GC can never reclaim the closures. Over time, these dangling intervals leak memory until the Node process crashes.

---

Relevant Notes:
- [[genkit-abort-signal-creates-zombie-streams-that-leak-api-quota]] -- both are resource leak vectors: intervals leak closures, zombie streams leak API quota
- [[scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter]] -- gradual leak + burst allocation = two OOM paths
- [[execsync-in-arduino-service-blocks-entire-express-event-loop]] -- both degrade the Express server: intervals via memory, execSync via event loop blocking

Topics:
- [[architecture-decisions]]
