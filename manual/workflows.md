---
type: manual
generated_from: "arscontexta-1.0.0"
---

# Workflows

Common multi-step workflows for the ProtoPulse knowledge system.

## Processing a Datasheet

When you find a datasheet with useful information (component specs, timing diagrams, thermal characteristics):

1. **Capture**: Save the PDF or key excerpts to `inbox/` with the source-capture template. Note the specific sections that matter.
2. **Seed**: `/seed inbox/atmega328p-datasheet.md` -- queues it for extraction.
3. **Extract**: `/extract` -- pull out individual claims. Each claim gets its own knowledge note. "ATmega328P has 32KB flash with 10,000 write cycle endurance" is one note. "ATmega328P ADC is 10-bit with 15kSPS max" is another.
4. **Connect**: Link new notes to relevant topic maps (`[[microcontrollers]]`, `[[adc-fundamentals]]`) and to each other where claims relate.
5. **Archive**: The source moves to `archive/` once fully extracted.

**Key rule**: Transform, don't copy. Your knowledge note should explain why the claim matters for ProtoPulse, not just repeat the datasheet verbatim.

## Capturing an Architecture Decision

When a design decision is made during development:

1. **Write the note directly** in `knowledge/` using the knowledge-note template with `type: decision`.
2. **Title it as a claim**: "React Query replaces Redux because ProtoPulse only needs server state management" -- not "State Management Decision."
3. **Include trade-offs** in the body: what was considered, what was rejected, why.
4. **Set confidence**: Usually `proven` for decisions already implemented, `experimental` for decisions being tested.
5. **Link to related**: Connect to implementation pattern notes, tech debt notes, or domain concepts that informed the decision.
6. **Connect**: Run `/connect` to find notes the decision affects.

## Processing a Competitor Analysis

After exploring how Fritzing, KiCad, Wokwi, or TinkerCad handles a feature:

1. **Capture**: Source-capture in `inbox/` with screenshots, notes, and observations.
2. **Extract per-insight**: "Fritzing's breadboard view maps physical positions to schematic nets automatically" is one note (type: insight). "KiCad's DRC catches unrouted nets but not antenna length violations" is another (type: claim).
3. **Tag with confidence**: `likely` if from observation, `proven` if from their docs.
4. **Connect to ProtoPulse features**: Link to notes about our breadboard view, our DRC, our export system.
5. **Surface gaps**: If the competitor does something we don't, create a `type: need` note.

## Running a Full Pipeline Pass

When the inbox is piling up and you need to process a batch:

1. **Check pressure**: `/stats` -- how many items in inbox? How many orphans?
2. **Triage**: Quickly scan inbox items and prioritize by relevance to current development work.
3. **Batch process**: `/ralph 5` -- processes 5 items with fresh context per phase.
4. **Connect pass**: `/connect` -- find relationships across the newly created notes.
5. **Revisit pass**: `/revisit` -- update older notes affected by new knowledge.
6. **Health check**: `/arscontexta:health` -- verify the batch didn't create orphans or schema violations.

## Daily Knowledge Rhythm

A lightweight routine to keep the vault healthy:

1. **Orient**: The session-orient hook runs automatically. Check its output for warnings.
2. **Capture**: As you work on ProtoPulse, drop interesting discoveries into `inbox/` immediately. Don't stop to process -- just capture and move on.
3. **Process**: When you have a natural break, run `/next` to see what's most valuable to work on.
4. **Close**: The session-capture hook saves session state automatically.

---

Topics:
- [[manual]]
