---
type: manual
generated_from: "arscontexta-1.0.0"
---

# Getting Started

Your first 10 minutes with the ProtoPulse knowledge system. By the end, you'll have created a note, connected it, and seen it appear in a topic map.

## Step 1: Understand the Layout

```
knowledge/          -- Your knowledge notes live here
  index.md          -- Hub topic map linking to all domain areas
inbox/              -- Raw source material waiting for extraction
archive/            -- Processed sources
self/               -- Agent identity, methodology, goals
ops/                -- System operations (sessions, observations, config)
templates/          -- Note templates (knowledge-note, topic-map, source-capture, observation)
manual/             -- You are here
```

## Step 2: Capture Something

Drop raw material into `inbox/` using the source-capture template:

```
/seed inbox/some-datasheet.md
```

Or create a knowledge note directly if you already know what the claim is:

```
Write a file to knowledge/decoupling-caps-placement-matters.md using the knowledge-note template
```

The title should be a complete claim: "Decoupling capacitors must be within 5mm of IC power pins" -- not "Decoupling Capacitors."

## Step 3: Fill in the Frontmatter

Every knowledge note needs at minimum:
- `description`: One sentence adding context beyond the title
- `type`: claim, decision, concept, insight, pattern, debt-note, or need
- `topics`: Array of wiki links to topic maps like `[[pcb-layout]]`

Optional but valuable:
- `source`: Where this knowledge came from
- `confidence`: proven, likely, experimental, or outdated
- `related_components`: ProtoPulse components this knowledge affects

## Step 4: Connect It

Add wiki links in the body to related notes:

```markdown
Relevant Notes:
- [[bypass-cap-values-depend-on-frequency]] -- frequency determines effective capacitance
- [[ic-power-pin-routing-guidelines]] -- placement is part of the broader routing strategy

Topics:
- [[pcb-layout]]
- [[component-placement]]
```

## Step 5: Check the Topic Map

Open the topic map you linked to (e.g., `knowledge/pcb-layout.md`). Add your new note to its Notes section. If the topic map doesn't exist yet, create one from the topic-map template.

## What's Next?

- Process more captures: `/extract` pulls knowledge from inbox sources
- Find connections: `/connect` surfaces relationships between notes
- Check vault health: `/arscontexta:health` runs diagnostics
- See all commands: [[skills]]

---

Topics:
- [[manual]]
