# Revisit Actions — Deep Guidance and Examples

Detailed methodology for the five revisit actions, the claim evaluation tests, the interactive proposal format, and the philosophy behind revisiting. The workflow contract lives in SKILL.md; this file carries the examples and extended guidance.

## Philosophy (extended)

**{vocabulary.note_plural} are living documents, not finished artifacts.**

A {vocabulary.note} written last month was written with last month's understanding. Since then:
- New {vocabulary.note_plural} exist that relate to it
- Understanding of the topic deepened
- The claim might need sharpening or challenging
- What was one idea might now be three
- Connections that were not obvious then are obvious now

Revisiting is not just "add backward links." It is completely reconsidering the {vocabulary.note} based on current knowledge. Ask: **"If I wrote this {vocabulary.note} today, what would be different?"**

> "The {vocabulary.note} you wrote yesterday is a hypothesis. Today's knowledge is the test."

Revisiting is NOT just Phase 4 of /connect applied backward. It is a full reconsideration.

### The Network Lives Through Evolution

{vocabulary.note_plural} written yesterday do not know about today. {vocabulary.note_plural} written with old understanding do not reflect new understanding. Without revisiting, the vault becomes a graveyard of outdated thinking that happens to be organized.

Revisiting is how knowledge stays alive. Not just connecting, but questioning, sharpening, splitting, rewriting. Every {vocabulary.note} is a hypothesis. Every revisit is a test.

The network compounds through evolution, not just accumulation.

### What Success Looks Like

Successful revisiting:
- {vocabulary.note} reflects current understanding, not historical understanding
- Claim is sharp enough to disagree with
- Connections exist to relevant newer content
- {vocabulary.note} participates actively in the network
- Someone reading it today gets the best version

The test: **if this {vocabulary.note} were written today with everything you know, would it be meaningfully different?** If yes and you did not change it, revisiting failed.

## Claim Evaluation Tests (Phase 3 detail)

**The Sharpening Test:**

Read the title. Ask: could someone disagree with this specific claim?
- If yes, the claim is sharp enough
- If no, it is too vague and needs sharpening

Example:
- Vague: "context matters" (who would disagree?)
- Sharp: "explicit context beats automatic memory" (arguable position)

**The Split Test:**

Does this {vocabulary.note} make multiple claims that could stand alone?
- If the {vocabulary.note} connects to 5+ topics across different domains, it probably needs splitting
- If you would want to link to part of it but not all, it is a split candidate

## The Five Revisit Actions

### 1. Add Connections

The simplest action. Newer {vocabulary.note_plural} exist that should be referenced.

**Inline connections (preferred):**
```markdown
# before
The constraint shifts from capture to curation.

# after
The constraint shifts from capture to curation, and since [[throughput matters more than accumulation]], the question becomes who does the selecting.
```

**Footer connections:**
```yaml
relevant_notes:
  - "[[newer note]] — extends this by adding temporal dimension"
```

### 2. Rewrite Content

Understanding evolved. The prose should reflect current thinking, not historical thinking.

**When to rewrite:**
- Reasoning is clearer now
- Better examples exist
- Phrasing was awkward
- Important nuance was missing

**How to rewrite:**
- Preserve the core claim (unless challenging it)
- Improve the path to the conclusion
- Incorporate new connections as prose
- Maintain the {vocabulary.note}'s voice

### 3. Sharpen the Claim

Vague claims cannot be built on. Sharpen means making the claim more specific and arguable.

**Sharpening patterns:**

| Vague | Sharp |
|-------|-------|
| "X is important" | "X matters because Y, which enables Z" |
| "consider doing X" | "X works when [condition] because [mechanism]" |
| "there are tradeoffs" | "[specific tradeoff]: gaining X costs Y" |

**When sharpening, also update:**
- Title (if claim changed) — rename manually:
  ```bash
  git mv "knowledge/old title.md" "knowledge/new title.md"
  # update every wiki link to the old title
  rg -lF '[[old title]]' knowledge/ | xargs -r sed -i 's/\[\[old title\]\]/[[new title]]/g'
  ```
- Description (must match new claim)
- Body (reasoning must support sharpened claim)

### 4. Split the {vocabulary.note}

One {vocabulary.note} became multiple ideas over time. Splitting creates focused, composable pieces.

**Split indicators:**
- Connects to 5+ topics across different domains
- Makes multiple distinct claims
- You would want to link to part but not all
- Different sections could be referenced independently

**Split process:**

1. Identify the distinct claims
2. Create new {vocabulary.note_plural} for each claim
3. Each new {vocabulary.note} gets:
   - Focused title (the claim)
   - Own description
   - Relevant subset of content
   - Appropriate connections
4. Original {vocabulary.note} either:
   - Becomes a synthesis linking to the splits
   - Gets archived if splits fully replace it
   - Retains one claim and links to others

**Example split:**

Original: "knowledge systems need both structure and flexibility"

Splits:
- [[structure enables retrieval at scale]]
- [[flexibility allows organic growth]]
- [[structure and flexibility create tension]] (links to both)

**When NOT to split:**
- {vocabulary.note} is genuinely about one thing that touches many areas
- Connections are all variations of the same relationship
- Splitting would create {vocabulary.note_plural} too thin to stand alone

### 5. Challenge the Claim

New evidence contradicts the original. Do not silently "fix" — acknowledge the evolution.

**Challenge patterns:**

```markdown
# if partially wrong
The original insight was [X]. However, [[newer evidence]] suggests [Y]. The refined claim is [Z].

# if tension exists
This argues [X]. But [[contradicting note]] argues [Y]. The tension remains unresolved — possibly [X] applies in context A while [Y] applies in context B.

# if significantly wrong
This note originally claimed [X]. Based on [[evidence]], the claim is revised: [new claim].
```

**Always log challenges:** When a claim is challenged or revised, this is a significant event. Note it in the task file Revisit section with the original claim, the new evidence, and the revised position.

## Revisit Proposal Format (interactive mode)

For interactive execution (no --handoff), present this proposal before applying changes:

```markdown
## Revisit Proposal: [[target note]]

**Last modified:** YYYY-MM-DD
**Current knowledge evaluated:** N newer {vocabulary.note_plural}, M backlinks

### Claim Assessment

[Does the claim hold? Need sharpening? Splitting? Revision?]

### Proposed Changes

**1. [change type]: [description]**

Current:
> [existing text]

Proposed:
> [new text]

Rationale: [why this change]

**2. [change type]: [description]**
...

### Connections to Add

- [[newer note A]] — [relationship]: [specific reason]
- [[newer note B]] — [relationship]: [specific reason]

### Connections to Verify (other {vocabulary.note_plural} should link here)

- [[note X]] might benefit from referencing this because...

### Not Changing

- [What was considered but rejected, and why]

---

Apply these changes? (yes/no/modify)
```
