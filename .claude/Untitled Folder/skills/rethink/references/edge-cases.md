# Edge Cases (Reference for /rethink)

> Read when any of these situations applies: missing evidence directories, nothing pending, drift suggesting /reseed, fewer than 5 items, single-item triage, conflicting proposals, or a 20+ item backlog.

### No ops/observations/ or ops/tensions/

These directories are part of the operational learning loop kernel primitive. If they do not exist:
1. Report the structural gap
2. Recommend creating them: "The operational learning loop requires `ops/observations/` and `ops/tensions/`. Create these directories and their MOC files to begin capturing system friction."
3. Do not attempt to run rethink without evidence sources

### Nothing Pending

Report clean state:
```
--=={ rethink — Clean State }==--

  No pending observations or tensions.
  The system has no accumulated friction to process.

  Continue capturing observations during normal work.
  Run /rethink again when signals accumulate.
```

### Evidence Suggests /reseed

If 3+ drift signals are detected (vocabulary mismatch, structural misalignment, threshold disconnect between what the system expects and what the user actually does):
- Report the drift pattern
- Recommend /reseed over patching: "Drift signals suggest the system's fundamental configuration may need re-derivation, not incremental patching. Consider running /architect for a configuration review."
- Do not attempt to patch drift signals — they indicate the system's premises need re-evaluation, not its implementation

### < 5 Total Items

Run triage normally but note that pattern detection requires more data:
```
  Note: [N] items is below the threshold for reliable pattern detection.
  Triage completed. Pattern analysis will be more reliable after more
  observations accumulate. This is expected early in the system lifecycle.
```

### Single Item Triage

When target is a specific filename:
1. Read only that item
2. Present single-item triage recommendation
3. Execute on approval
4. Skip pattern detection (single items do not make patterns)

### Conflicting Proposals

If two proposals would contradict each other (e.g., one suggests adding complexity, another suggests simplifying the same area):
1. Present both with explicit conflict flagging
2. Ask the user to choose one or synthesize
3. Do not implement both — conflicting changes compound confusion

### Large Evidence Backlog (20+ items)

If the evidence pool is very large:
1. Triage in batches of 10
2. Present each batch for approval before continuing
3. This prevents overwhelming the user with a 30-item triage table
4. Run pattern detection after all batches are triaged
