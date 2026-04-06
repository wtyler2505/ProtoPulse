---
type: self
created: 2026-04-05
---

# Methodology

How this knowledge system works, in ProtoPulse terms.

## Principles

**Prose-as-title.** Note titles are complete claims or insights, not topic labels. "Decoupling capacitors should be placed within 5mm of IC power pins" beats "Decoupling Capacitors." The title IS the knowledge -- the body provides evidence and context.

**Wiki links as graph edges.** Every `[[link]]` is a deliberate connection between ideas. Links aren't decoration -- they're the structure that makes knowledge findable and composable. When you link two notes, you're saying "these ideas inform each other."

**Topic maps as attention managers.** Topic maps (MOCs) aren't folders -- they're curated views into the graph. A topic map for `[[pcb-layout]]` surfaces the notes that matter for PCB work without hiding anything. They're how you navigate 500 notes without drowning.

**Capture fast, process slow.** Drop raw material in `inbox/` immediately. Don't try to write perfect notes in the moment. The extraction pipeline exists precisely so you can be sloppy during capture and rigorous during processing.

## The Processing Cycle

### Extract
Take raw source material from `inbox/` and pull out individual knowledge notes. Each note gets one atomic idea with proper frontmatter (type, confidence, topics). This is where you transform someone else's words into your own understanding. Verbatim quotes are for source captures, not knowledge notes.

### Connect
Find relationships between notes. Update topic maps. Add `Relevant Notes` links. This is where isolated facts become a knowledge graph. The question to ask: "What does this note change about how I understand the notes around it?"

### Revisit
The backward pass. Go back to older notes and update them with new connections, new evidence, or new confidence levels. A note written three months ago might need `superseded_by` or might gain a connection to something just discovered. This is how knowledge stays alive instead of rotting.

### Verify
Challenge claims against evidence. Does this still hold? Has the datasheet been updated? Did the implementation prove or disprove the theory? Update `confidence` fields. Mark `outdated` when appropriate. Link to the note that supersedes.

## In Practice

The cycle isn't linear. You might extract three notes from a datasheet, immediately connect two of them to existing topic maps, and flag one for verification because it contradicts an existing claim. That's fine. The phases are thinking modes, not a rigid pipeline.

Condition-based maintenance kicks in when the vault gets unhealthy -- too many orphans, too many unprocessed captures, too many stale notes. The hooks and health checks surface these signals so you can respond before drift compounds.
