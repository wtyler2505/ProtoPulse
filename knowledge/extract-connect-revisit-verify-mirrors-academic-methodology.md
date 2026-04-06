---
description: The vault processing pipeline (extract-connect-revisit-verify) maps directly to the academic reduce-reflect-reweave-verify methodology from Ars Contexta
type: concept
source: "ops/derivation-manifest.md vocabulary mappings"
confidence: proven
topics: ["[[claude-code-skills]]", "[[methodology]]"]
related_components: ["ops/derivation-manifest.md"]
---

# extract connect revisit verify mirrors academic methodology

The derivation manifest explicitly maps domain vocabulary to universal terms: reduce -> extract, reflect -> connect, reweave -> revisit, verify -> verify. This is not coincidence -- the ProtoPulse knowledge system was generated from the Ars Contexta methodology, and its skill pipeline preserves the academic processing phases under domain-specific names.

The four phases serve distinct cognitive functions:

1. **Extract (reduce)**: Decompose source material into atomic claims. The goal is granularity -- one insight per note, no bundling.
2. **Connect (reflect)**: Find relationships between notes, update topic maps. The goal is graph density -- isolated notes are wasted.
3. **Revisit (reweave)**: The backward pass that /connect doesn't do. Return to older notes and update them with new connections discovered later. This is what prevents knowledge decay.
4. **Verify (verify)**: Challenge claims against evidence. The goal is truth -- confidence ratings must be earned, not assumed.

The pipeline is designed to be run in order but each phase is independently invocable. The `/pipeline` skill automates the full sequence; `/ralph` adds fault isolation by spawning fresh context per phase so corruption doesn't cascade.

---

Relevant Notes:
- [[knowledge-pipeline-has-ten-skills-covering-the-full-lifecycle]] -- the full 10-skill pipeline
- [[extract-is-the-largest-skill-at-1128-lines]] -- why extraction is the most complex phase

Topics:
- [[claude-code-skills]]
- [[methodology]]
