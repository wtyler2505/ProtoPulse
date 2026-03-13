---
summary: Making backlog stats generated-not-manual eliminates drift but requires tooling investment — manual maintenance creates trust issues but is zero-cost to start
type: tension
created: 2026-03-13
---

ProtoPulse's MASTER_BACKLOG.md Quick Stats must be updated atomically with individual item status changes. Manual maintenance inevitably drifts — agents update items without updating the summary, creating a single source of truth that lies about its own contents. The solution is generating MASTER_BACKLOG.md from a structured JSON/YAML source, making stats computed rather than manually maintained. But this requires building and maintaining a generation pipeline, adding a new dependency to every wave's workflow. The tension: manual maintenance is free to start but accumulates trust debt; automated generation requires upfront investment but eliminates an entire class of errors.
