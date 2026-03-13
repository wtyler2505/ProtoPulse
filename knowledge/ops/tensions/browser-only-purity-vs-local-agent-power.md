---
summary: Browser-only preserves zero-install accessibility but limits capability — a local helper adds power but breaks the accessibility story
type: tension
created: 2026-03-13
---

ProtoPulse's browser-only architecture is a core value proposition: no installation, works anywhere, instant access. But firmware compilation, hardware debugging, and file system access require native capabilities browsers cannot provide. A local helper agent (like Arduino IDE's agent) adds these capabilities but introduces installation friction, platform-specific builds, and a "works on my machine" failure mode that contradicts the accessibility mission.
