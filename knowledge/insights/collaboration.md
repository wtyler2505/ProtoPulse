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
