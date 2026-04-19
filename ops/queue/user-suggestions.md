# User-Suggested Inbox Queue

Ordered append-only log of user-submitted vault suggestions captured by `.claude/skills/vault-inbox/`.

`/extract` processes AUTHORITATIVE content (datasheets, standards) first per T15 ranking. User-suggested stubs get a **lower priority class** than agent-detected gaps in `ops/queue/gap-stubs.md`, unless `unblocks:` in the stub frontmatter points at a pending plan.

Weekly moderation pass: review new rows, either promote to real extract pipeline or archive as spam.

Managed by skill `.claude/skills/vault-inbox/SKILL.md`.

| timestamp | topic | slug | submitter | origin_slug | surface | inbox_path | status |
|-----------|-------|------|-----------|-------------|---------|------------|--------|
| 2026-04-19T06:08:00Z | wire vault-inbox user-suggestions queue into /extract priority ranking | wire-vault-inbox-user-suggestions-queue-into-extract-priority-ranking | tyler | extract-integration | cli | inbox/2026-04-19-user-suggested-wire-vault-inbox-user-suggestions-queue-into-extract-priority-ranking.md | pending-review |
