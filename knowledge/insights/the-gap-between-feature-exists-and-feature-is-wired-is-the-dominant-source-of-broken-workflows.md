---
summary: Features implemented as isolated libraries but never connected to UI or cross-tool flows cause the majority of user-visible broken workflows
category: architectural-decision
areas: ["[[index]]"]
related insights:
  - "[[wave-based-development-enables-rapid-shipping-but-creates-integration-debt]] — the development model that produces this gap systematically"
  - "[[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — a third form of integration debt where features ARE wired but aren't durable"
  - "[[definition-of-done-must-include-cross-tool-link-verification]] — the DoD expansion that would catch unwired features before they're marked done"
  - "[[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — the wiring work is hard because it forces data ownership decisions"
  - "[[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — barrel files make wiring easier by preserving stable import paths"
  - "[[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — a concrete example: simulation engine is fully capable but output isn't overlaid on schematics, making real capability invisible"
created: 2026-03-13
---

ProtoPulse's wave-based development ships vertical slices efficiently but systematically defers horizontal integration. Collaboration, breadboard, PCB undo, Arduino serial — all were "implemented" in their waves but broken in practice because they weren't wired into the UI or connected to dependent features. Wave 37 quantifies the cost: 24 unintegrated library modules required 5 new ViewModes (kanban, knowledge, viewer_3d, community, ordering), 8 panel integrations into existing views, and ~6400 lines of pure wiring code with zero new logic.

A third form of integration debt emerged from the gap audit: features that ARE wired to the UI and ARE discoverable, but store state exclusively in localStorage — Kanban boards, design variables, custom DRC scripts, keyboard shortcuts, community library collections, PCB ordering history. These pass visual inspection but silently break on multi-device, collaboration, backup/restore, and project portability scenarios. This is subtler than unwired libraries because it creates a false-positive "done" signal.

The three forms of integration debt: (1) unwired library modules, (2) undiscovered features (nobody knew they existed), (3) [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario|localStorage-only persistence]] (looks complete, breaks at scale). "Feature complete" must mean "wired, reachable, and durable" — not just "module exists." The [[definition-of-done-must-include-cross-tool-link-verification|expanded definition of done]] was created specifically to prevent this pattern.

## Topics

- [[index]]
