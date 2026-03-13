---
summary: Processing pipeline, maintenance cycle, and session rhythm
type: manual
generated_from: "arscontexta-1.0.0"
---

# Workflows

## The Processing Pipeline

Content flows through phases. Never write directly to `insights/`.

```
captures/ --> /extract --> insights/ --> /connect --> /verify --> done
                                                       |
                                          (when code changes)
                                                       v
                                                   /revisit
```

### 1. Capture
Drop raw observations into `captures/`. Low ceremony — just get it down. Session captures, code review notes, bug investigation observations.

### 2. Extract (/arscontexta:reduce)
Pull atomic insights from captures. One insight per file, prose-as-title, proper schema. Each insight must pass the composability test.

### 3. Connect (/arscontexta:reflect)
Find relationships between new and existing insights. Add wiki links. Update topic maps. This is where the graph gets its value.

### 4. Verify (/arscontexta:verify)
Check schema compliance, summary quality, link health, composability test. Quality gates prevent drift.

### 5. Revisit (/arscontexta:reweave)
When code changes, review related insights. Update or mark as outdated. ProtoPulse moves fast — old insights need regular attention.

## Session Rhythm

### Orient
- Read `self/goals.md`
- Check maintenance conditions (orphans, captures overflow, pending observations)
- Check `ops/reminders.md` for due items

### Work
- Do the actual task
- Capture observations as you go
- If something non-obvious comes up, write it down immediately

### Persist
- Write new insights (through the pipeline)
- Update topic maps
- Update `self/goals.md`
- Session capture hook handles the rest

## Maintenance Cycle

Condition-based, not scheduled. The system surfaces work when conditions fire:

- Orphan insights > 5 -> connect them
- Captures > 20 -> process them
- Pending observations > 10 -> triage with /rethink
- Stale insights (30+ days, sparse connections) -> revisit

See [[configuration]] for adjusting thresholds.
