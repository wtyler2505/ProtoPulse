---
summary: Should ProtoPulse require a local helper app for all hardware features, or maintain graceful degradation to browser-only?
type: open-question
created: 2026-03-13
relates-to: "[[browser-based-eda-hits-a-platform-boundary-at-firmware-execution]]"
status: pending
---

The C5 firmware runtime plan recommends a hybrid architecture (browser UX + local helper for native toolchains). But the UX cost of "install this companion app" for a tool whose value proposition is "browser-based, zero install" is unresolved. Options: (1) Require the helper for all hardware features — simple but contradicts the zero-install promise. (2) Graceful degradation — browser-only mode works for everything except upload, with clear messaging about what the helper enables. (3) Progressive enhancement — start browser-only, prompt for helper only when a hardware action is attempted. The choice affects onboarding, documentation, marketing positioning, and user expectations.
