# PP-NLM Chat Configs

The active chat configs are:

- `pp-core.txt`
- `pp-hardware.txt`

Old per-alias files remain as source material for future prompt edits, but they are not applied by default after the 2026-05-09 consolidation. Running `scripts/pp-nlm/apply-chat-configs.sh` without flags is a dry run over the two active hubs.

Apply intentionally:

```bash
bash scripts/pp-nlm/apply-chat-configs.sh --apply
```

The script fails if an active prompt references retired notebook routes such as `pp-cmp-*`, `Tier-3`, or `pp-feat-breadboard-view`.
