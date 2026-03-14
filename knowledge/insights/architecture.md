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
- [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling]] — PG error codes → HTTP status translation
- [[job-queue-uses-per-type-watchdog-timeouts-and-exponential-backoff-because-ai-analysis-and-export-generation-have-different-runtime-profiles]] — per-type watchdog timeouts
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — dependency-ordered shutdown orchestration
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — serial PK for DB, text UUID for canvas/AI — two-key identity pattern
- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — omit server fields + extend with Zod enums creates write-strict/read-permissive asymmetry
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — 15+ JSONB columns with no DB validation, Zod as the only type boundary
- [[every-component-must-define-geometry-three-times-because-the-triple-view-architecture-couples-identity-to-representation]] — breadboard + schematic + PCB views force 3x geometry authoring per component
- [[three-diff-engines-share-identical-algorithm-shape-but-are-not-abstracted-creating-a-subtle-maintenance-trap]] — bom-diff/arch-diff/netlist-diff share algorithm but are copy-pasted
- [[crdt-merge-uses-intent-preserving-rules-where-insert-always-beats-concurrent-delete-a-deliberate-philosophical-choice]] — insert beats delete in collaboration merge — domain-aware CRDT
- [[the-build-script-uses-an-allowlist-inversion-to-bundle-frequently-imported-deps-while-externalizing-everything-else-reducing-cold-start-syscalls]] — bundle allowlist inversion reduces cold start syscalls
