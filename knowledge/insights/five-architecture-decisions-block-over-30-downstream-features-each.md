---
summary: Four of five architecture-blocking decisions have been resolved through implementation, revealing hardware debugger interface as the sole remaining long-pole
category: architectural-decision
areas: ["[[architecture]]", "[[index]]"]
related insights:
  - "[[browser-based-eda-hits-a-platform-boundary-at-firmware-execution]] — the platform constraint behind the firmware execution decision"
  - "[[the-hybrid-runtime-architecture-for-firmware-is-the-only-viable-path-because-browser-only-wasm-and-pure-local-approaches-each-sacrifice-a-core-value-proposition]] — the initial resolution (hybrid), now superseded"
  - "[[pure-local-desktop-app-chosen-over-hybrid-because-installation-friction-is-better-than-compromised-hardware-access]] — the final resolution: pure-local desktop, resolving both firmware runtime and multi-platform scope in one pivot"
  - "[[phased-collaboration-delivery-must-sequence-session-hardening-before-membership-before-branching-because-each-layer-depends-on-the-one-below]] — the delivery sequence for the collaboration architecture decision"
  - "[[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — collaboration was implemented (Wave 41) but the membership layer remains incomplete, showing that resolving a blocking decision does not mean resolving it well"
  - "[[complexity-ratings-measure-decision-surface-area-not-effort]] — these items are C5 because they have maximum decision surface area, not maximum effort"
  - "[[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — blocking decisions are the root cause of deferred integration work"
  - "[[the-arduino-workbench-schema-is-the-only-domain-that-bridges-database-records-to-the-host-filesystem-via-rootPath]] — the Arduino schema encodes the pure-local desktop assumption, proving the firmware/platform decision has been enacted at the data layer"
  - "[[design-agent-hardcodes-confirmed-true-bypassing-destructive-tool-confirmation-enforcement]] — the agentic AI loop shows how resolved architecture decisions (AI tool system) create new second-order risks"
created: 2026-03-13
updated: 2026-03-14
---

Five architecture decisions originally acted as bottlenecks across the backlog: browser-only vs local helper for firmware, hardware debug interface choice, collaboration data model, supplier API trust level, and multi-platform scope (desktop app vs browser-only). Each blocked a chain of 5+ dependent features. The backlog explicitly marked these as requiring spike-first ADRs before implementation could begin.

**As of Wave 79, four of the five have been resolved:**

1. **Firmware runtime + Multi-platform scope** (resolved together): The [[pure-local-desktop-app-chosen-over-hybrid-because-installation-friction-is-better-than-compromised-hardware-access|pure-local desktop pivot]] resolved both at once. The hybrid approach was initially chosen but superseded — installation friction is a one-time cost, compromised hardware access is permanent. The [[the-arduino-workbench-schema-is-the-only-domain-that-bridges-database-records-to-the-host-filesystem-via-rootPath|Arduino workbench schema]] now stores filesystem paths directly, encoding the pure-local assumption at the data layer.

2. **Collaboration data model** (partially resolved): WebSocket collaboration shipped in Wave 41 with CRDT merge semantics, role enforcement, and entity locking. However, [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls|the membership table is missing]] — non-owners get editor role by default. Resolving a blocking decision does not guarantee resolving it well.

3. **Supplier API trust level** (resolved): Supplier APIs shipped in Wave 36 with 7 distributor integrations, BOM quoting, stock alerts, and currency conversion. The trust question was answered with DEMO badges distinguishing mock from real data.

4. **Hardware debug interface** (unresolved): This remains the only genuinely blocking architecture decision. No ADR exists for how ProtoPulse will expose hardware debugging (JTAG/SWD/serial debug protocols) to users.

The pattern that emerged: blocking architecture decisions rarely stay unresolved forever. Implementation pressure forces them. But speed of resolution inversely correlates with how many implementation paths the decision leaves open — firmware runtime (3 options) resolved faster than hardware debug (open-ended design space). The lesson is that the original "five blockers" framing was useful for identifying decision surface area, but the blockers don't resolve in parallel — they cascade. The desktop pivot resolved two decisions simultaneously because they shared a root cause (platform boundary). Collaboration's partial resolution shows that "unblocked" and "correctly resolved" are different things.

## Topics

- [[architecture]]
- [[index]]
