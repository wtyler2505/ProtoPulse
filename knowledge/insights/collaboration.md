---
summary: Real-time editing, membership, branching, access control, and phased delivery
type: moc
---

# Collaboration

ProtoPulse's collaboration system — current gaps, architectural dependencies, and delivery sequencing.

## Insights

- [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — default editor role is an access control gap
- [[phased-collaboration-delivery-must-sequence-session-hardening-before-membership-before-branching-because-each-layer-depends-on-the-one-below]] — collaboration layers have strict dependency ordering
- [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — localStorage features break on collaboration
- [[the-arduino-workbench-schema-is-the-only-domain-that-bridges-database-records-to-the-host-filesystem-via-rootPath]] — filesystem paths are machine-local, creating a hard collaboration limit for Arduino workspaces
- [[e2e-tests-use-playwright-setup-projects-to-share-auth-state-across-specs-via-localstorage-injection-rather-than-cookie-based-session-persistence]] — shared E2E user state mirrors the collaboration access control gap
- [[arduino-job-streams-buffer-all-events-for-late-join-replay-creating-an-sse-catch-up-mechanism]] — Arduino SSE streaming is the only domain with late-join replay; collaboration WebSocket rooms have no equivalent catch-up mechanism
