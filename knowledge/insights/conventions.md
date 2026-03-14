---
summary: Code style, naming, and project-specific patterns in ProtoPulse
type: moc
---

# Conventions

Patterns that have become standard practice — follow these when adding new code.

## Insights

- [[barrel-files-enable-incremental-decomposition-because-they-preserve-the-public-api-while-splitting-internal-modules]] — barrel files for decomposition
- [[large-component-decomposition-follows-a-consistent-pattern-of-extracting-domain-modules-while-keeping-the-original-file-as-a-thin-orchestrator]] — decomposition: extract + thin orchestrator
- [[singleton-subscribe-became-the-universal-client-state-primitive-because-useSyncExternalStore-makes-any-class-a-hook]] — singleton+subscribe is the standard client state pattern
- [[definition-of-done-must-include-cross-tool-link-verification]] — DoD includes cross-tool verification
- [[backlog-summary-statistics-must-be-updated-atomically-with-individual-item-status-changes-or-the-single-source-of-truth-becomes-untrustworthy]] — Quick Stats must be updated atomically
- [[a-ci-gate-for-route-ownership-middleware-would-break-the-idor-recurrence-cycle]] — CI gate enforcing ownership middleware on all routes
- [[localstorage-features-follow-an-identical-five-step-migration-to-server-scoped-storage]] — reusable 5-step localStorage migration playbook
- [[the-schema-insert-pattern-uses-omit-plus-extend-to-create-a-strict-write-contract-while-the-select-type-remains-permissive]] — every table uses omit+extend for strict write contracts
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — serial PK for DB, text UUID for canvas — always be explicit about which ID
- [[storage-error-maps-postgresql-error-codes-to-http-status-giving-routes-structured-error-semantics-without-db-coupling]] — centralized PG → HTTP error translation for all routes
- [[the-build-script-uses-an-allowlist-inversion-to-bundle-frequently-imported-deps-while-externalizing-everything-else-reducing-cold-start-syscalls]] — bundle allowlist inversion: new deps auto-externalize, only allowlisted deps bundle
