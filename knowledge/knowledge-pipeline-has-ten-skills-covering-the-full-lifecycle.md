---
description: Ten dedicated project skills cover the complete knowledge lifecycle from ingestion through verification, forming a coherent processing chain
type: claim
source: ".claude/skills/ in ProtoPulse"
confidence: proven
topics: ["[[claude-code-skills]]", "[[methodology]]"]
related_components: [".claude/skills/seed/", ".claude/skills/extract/", ".claude/skills/connect/", ".claude/skills/revisit/", ".claude/skills/verify/"]
---

# knowledge pipeline has ten skills covering the full lifecycle

The knowledge vault processing pipeline uses 10 dedicated skills arranged in a processing chain:

1. **Ingestion**: `/seed` (add source to queue), `/learn` (research a topic and grow the graph)
2. **Processing**: `/extract` (reduce raw material to atomic notes), `/connect` (find relationships, update MOCs)
3. **Maintenance**: `/revisit` (backward pass -- update old notes with new connections), `/rethink` (challenge system assumptions)
4. **Quality**: `/validate` (schema compliance), `/verify` (combined: recite + validate + review)
5. **Execution**: `/pipeline` (end-to-end batch: seed through verify), `/ralph` (queue processing with fresh context per phase)

This is an unusually complete skill coverage for a single domain. Most skill ecosystems have gaps between stages. Here, every transition is covered: raw source -> structured note -> connected graph -> verified claim. The `/pipeline` skill even automates the entire chain, and `/ralph` provides fault isolation by spawning fresh context per phase (so one bad extraction doesn't corrupt the connection phase).

The pipeline totals ~5,500 lines of skill instructions across these 10 files, making it the most heavily invested workflow in the entire skill ecosystem.

---

Relevant Notes:
- [[extract-is-the-largest-skill-at-1128-lines]] -- the most complex single skill
- [[extract-connect-revisit-verify-mirrors-academic-methodology]] -- the academic roots
- [[vault-skills-outnumber-project-skills-seven-to-one]] -- why so many vault skills

Topics:
- [[claude-code-skills]]
- [[methodology]]
