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
