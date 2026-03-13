---
summary: AI architecture-to-schematic expansion uses each part's first pin as a placeholder connection, producing visually wrong schematics that train users to distrust the feature
category: bug-pattern
areas: ["[[index]]"]
related insights:
  - "[[manufacturing-trust-requires-real-data-because-fake-confidence-is-worse-than-no-confidence]] — the same trust erosion pattern: authoritative-looking output that is actually wrong"
  - "[[the-maker-to-professional-spectrum-is-the-fundamental-ux-tension]] — beginners cannot detect wrong pin assignments, making this actively harmful for the primary audience"
  - "[[five-architecture-decisions-block-over-30-downstream-features-each]] — proper pin-mapping depends on the component pinout system architecture decision"
  - "[[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — parallel trust erosion patterns: placeholder pins make AI output look wrong, invisible sim results make real capability look absent"
created: 2026-03-13
---

ProtoPulse's architecture-to-schematic expansion route converts high-level block diagrams into circuit schematics by mapping architecture edges to component connections. The current implementation warns that it uses each component's first pin as a placeholder — meaning a resistor might connect through pin 1 regardless of which pin the circuit actually requires. The result is schematics that are logically connected (the right components exist and link to each other) but electrically wrong (the specific pin connections are meaningless). For a tool targeting makers who are learning electronics, this is actively harmful: it produces output that looks authoritative but is incorrect, training users to either distrust the feature entirely or (worse) trust wrong connections. The fix requires actual pin-mapping logic that understands component pinouts and connection semantics.

## Topics

- [[index]]
