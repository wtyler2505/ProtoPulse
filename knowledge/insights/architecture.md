---
summary: Design decisions, trade-offs, and system structure patterns in ProtoPulse
type: moc
---

# Architecture

How ProtoPulse is structured and why — from monolithic context to barrel files to hybrid firmware runtime.

## Insights

- [[five-architecture-decisions-block-over-30-downstream-features-each]] — 5 unresolved decisions each block 30+ features
- [[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — barrel files preserve public API during decomposition
- [[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] — extract modules, keep thin orchestrator
- [[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — 30+ managers use singleton+subscribe
- [[projectprovider-is-known-tech-debt-because-monolithic-context-forces-full-tree-rerenders-on-any-state-change]] — monolithic Context is known debt
- [[browser-based-eda-hits-a-platform-boundary-at-firmware-execution]] — firmware forces hybrid architecture
- [[the-hybrid-runtime-architecture-for-firmware-is-the-only-viable-path-because-browser-only-wasm-and-pure-local-approaches-each-sacrifice-a-core-value-proposition]] — hybrid browser+local is the only viable path **(SUPERSEDED)**
- [[pure-local-desktop-app-chosen-over-hybrid-because-installation-friction-is-better-than-compromised-hardware-access]] — pure-local desktop app chosen: installation friction is a one-time cost, compromised hardware access is a permanent ceiling
- [[cross-tool-integration-is-the-hardest-category-because-it-requires-shared-source-of-truth-decisions]] — integration forces data ownership decisions
- [[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — automated CI enforcement for IDOR prevention
- [[localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage]] — 5-step migration pattern for localStorage-to-server
