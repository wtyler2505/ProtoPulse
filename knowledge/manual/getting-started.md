---
summary: First session guide — creating your first insight and building connections
type: manual
generated_from: "arscontexta-1.0.0"
---

# Getting Started

## What to Expect

Your knowledge system is ready to capture everything about the ProtoPulse codebase. Here's what a typical session looks like:

1. **Orient** — Read `self/goals.md` to remember what you're working on. Check for pending captures and maintenance triggers.
2. **Work** — Build features, fix bugs, explore code. Whenever something non-obvious comes up (a gotcha, a design decision, a pattern), capture it.
3. **Persist** — Before ending, write any new insights, update goals, let the session capture hook save your state.

## Creating Your First Insight

Say you just discovered that `drizzle-orm 0.45+` requires Zod v4 and ProtoPulse is pinned to Zod v3. That's a dependency-knowledge insight:

```markdown
---
summary: drizzle-orm 0.45 and drizzle-zod 0.8 depend on Zod v4 internal _zod property
category: dependency-knowledge
wave: "39"
affected_files: ["package.json"]
confidence: proven
areas: [dependencies]
---

# drizzle-orm 0.45+ requires Zod v4 which blocks upgrading from Zod v3

drizzle-orm 0.45+ and drizzle-zod 0.8+ use Zod's internal `_zod` property...

---

Related Insights:

Areas:
- [[dependencies]]
```

Save it in `knowledge/insights/`. The title IS the filename (kebab-case): `drizzle-orm-0.45-requires-zod-v4-which-blocks-upgrading-from-zod-v3.md`

## How Connections Work

Wiki links create edges in the knowledge graph. When you write `[[convention X]]` inside an insight, that creates a navigable connection. Topic maps (like `[[dependencies]]`, `[[architecture]]`) organize insights into browsable areas.

## The Session Rhythm

Orient (read state) -> Work (do the thing, capture observations) -> Persist (save insights, update goals)

The SessionStart hook reminds you of vault state. The Stop hook captures session metadata.

## Next Steps

- Read [[workflows]] for the full processing pipeline
- Read [[skills]] for all available commands
- Try `/arscontexta:help` to see what's available
