---
name: vault-inbox
description: Protocol + server handler spec for the VaultInbox "Suggest a note" UI. When a `<VaultHoverCard>` hits a 404 (no vault note for that slug), the client shows a modal letting the user describe the missing note. POSTing writes `inbox/YYYY-MM-DD-user-suggested-<slug>.md`, which `/extract` later processes. Turns every gap into a potential contribution. Includes a CLI helper that converts a one-line suggestion to an inbox stub without opening the UI. Triggers on "/vault-inbox", "/vault-inbox suggest [topic]", "file a note suggestion", "suggest a vault note".
version: "1.0"
user-invocable: true
context: fork
allowed-tools: Read, Write, Grep, Glob, Bash
argument-hint: "[topic] [--description 'what the note should say'] [--origin-slug slug-hit-404] [--submitter name]"
---

## EXECUTE NOW

**Suggestion: $ARGUMENTS**

Parse flags:
- `--description <text>` — user's description of what the note should claim (≤500 chars).
- `--origin-slug <slug>` — slug of the VaultHoverCard that 404'd, if coming from the UI. Optional.
- `--submitter <name>` — contributor identifier. Defaults to `$USER` or "anonymous".

**Execute these steps:**

1. **Derive slug** — lowercase + dash the topic (reuse vault-gap's `derive-slug.sh`).
2. **Check collisions** — if `inbox/*-user-suggested-<slug>.md` exists, append `-v2`, `-v3` etc.
3. **Write stub** — using `templates/user-suggested-stub.md`. Includes:
   - `source_type: user-suggested`
   - `submitter: <name>`
   - `suggested_at: <timestamp>`
   - `origin_surface: ui|cli`
   - `description: <user-provided>`
4. **Append to queue log** — write a row to `ops/queue/user-suggestions.md` (separate from vault-gap queue; different priority class).
5. **Return confirmation payload** — `{"ok": true, "stub_path": "inbox/...", "queue_row": ...}`.

**Pipeline discipline** — this skill ONLY writes to `inbox/` and `ops/queue/`. Never to `knowledge/`. `/extract` handles knowledge/ writes.

**START NOW.** Reference below defines the client+server protocol, security posture, anti-abuse stance.

---

## Client+server protocol (for the React component in 16-design-system Phase 8)

### Client trigger

```tsx
<VaultHoverCard slug={slug} fallback={
  <VaultInboxCta
    onSubmit={(desc, submitter) => fetch('/api/vault/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: slug, description: desc, origin_slug: slug, submitter }),
    })}
  />
}>
  ...
</VaultHoverCard>
```

### Server route (ProtoPulse — adds to `server/routes/knowledge-vault.ts`)

```typescript
// POST /api/vault/suggest
app.post('/api/vault/suggest', requireAuth, rateLimit('10/hour'), async (req, res) => {
  const { topic, description, origin_slug, submitter } = suggestionSchema.parse(req.body);

  // Sanitize description (≤500 chars, strip control chars, no HTML tags)
  const clean = sanitizeSuggestion(description);

  // Derive slug
  const slug = deriveSlug(topic);

  // Resolve collision-safe filename
  const inboxPath = await resolveCollisionFreePath(
    path.join(process.cwd(), 'inbox', `${today()}-user-suggested-${slug}.md`)
  );

  // Write stub atomically
  const stubContent = renderStub({
    topic, slug, description: clean, origin_slug, submitter: submitter || req.userId,
    surface: 'ui',
  });
  await writeFileAtomic(inboxPath, stubContent);

  // Append to queue log
  await appendToQueue('ops/queue/user-suggestions.md', {
    timestamp: new Date().toISOString(),
    slug,
    origin_slug,
    submitter: submitter || req.userId,
    inboxPath: path.relative(process.cwd(), inboxPath),
  });

  res.json({ ok: true, stub_path: path.relative(process.cwd(), inboxPath) });
});
```

### Rate limits + abuse controls

| Control | Value | Reason |
|---|---|---|
| Per-user rate limit | 10 submissions / hour | Prevents flooding |
| Description length | ≤500 chars | Stub, not an essay |
| Allowed characters | printable ASCII + common Unicode; no control chars, no HTML tags | Prevents XSS in rendered preview |
| Topic length | ≤120 chars before slug derivation | Reasonable title |
| Authentication | Required | Submitter identity is traceable |
| Origin check | If `origin_slug` is provided, must match an existing OR recently-queried slug | Prevents random spam |

### Moderation workflow

- Suggestions land in `inbox/` with `triage_status: pending-review`.
- `/extract` processes AUTHORITATIVE content (datasheets, standards) first per T15 ranking.
- `user-suggested` stubs get a lower-priority class unless `unblocks:` points at a pending plan.
- Weekly moderation pass: review new suggestions, either promote to real extract pipeline or archive spam.

## Stub template

Lives at `templates/user-suggested-stub.md`. Sketch:

```markdown
---
name: "User-suggested note: {{TOPIC}}"
description: "User-submitted suggestion on {{DATE}}. Description: {{TRUNCATED_DESC}}"
captured_date: {{DATE}}
extraction_status: pending
triage_status: pending-review
source_type: user-suggested
submitter: {{SUBMITTER}}
suggested_at: {{TIMESTAMP}}
origin_surface: {{SURFACE}}
origin_slug: {{ORIGIN_SLUG}}
topics:
  - user-suggested
  - inbox
---

## User suggestion

**Topic:** {{TOPIC}}
**Submitted by:** {{SUBMITTER}}
**At:** {{TIMESTAMP}}
**Triggered from:** {{ORIGIN_SLUG}} (404 on `<VaultHoverCard>`)

### Description (verbatim)

{{DESCRIPTION}}

### Moderation notes

- [ ] Reviewed by: _____
- [ ] Outcome: _approve-for-extract | promote-to-gap-stub | archive-as-spam | needs-more-info_
- [ ] Notes:

## For `/extract`

Treat this as a hypothesis about what the vault should cover. Research the topic via qmd + WebSearch. If supported, produce a proper atomic note in `knowledge/`. If not, close with `archive-as-insufficient-information`.
```

## CLI usage (off-UI)

```bash
/vault-inbox "ESP32 strapping pin behavior on deep sleep" \
  --description "Strapping pins are only sampled at cold boot, not on deep-sleep wake" \
  --submitter tyler
```

Creates `inbox/2026-04-18-user-suggested-esp32-strapping-pin-behavior-on-deep-sleep.md` + appends to queue.

## Security posture

- **Never trust user input for filenames** — always derive slug via `derive-slug.sh`, never pass user text to shell or fs paths.
- **Never execute user content** — stubs are markdown, read as text.
- **Path-traversal guard** — reject any slug containing `..`, `/`, `\`.
- **Size cap** — 4KB total stub body including frontmatter.
- **Auth required** — no anonymous submissions on web; CLI uses `$USER`.

## Integration points

- **T1 `/vault-gap`** — parallel queue mechanism; user-suggestions and agent-detected gaps both feed `/extract` but via separate priority classes.
- **T15 `/vault-extract-priority`** — can read `ops/queue/user-suggestions.md` if `--include-user-queue` flag is set (future extension).
- **`16-design-system` Phase 8** — client UI spec lives in that plan; this skill is the server+protocol contract.
- **T7 `/vault-health`** — weekly report includes user-suggestion throughput + rejection rate.

## Anti-patterns

| Anti-Pattern | Why It Fails | Instead |
|---|---|---|
| Write directly to `knowledge/` from this endpoint | Bypasses pipeline; no `/extract` quality gate | Always via inbox/ |
| Trust `--submitter` without auth | Spam / impersonation risk | Server-side: require `req.userId` |
| Store user descriptions verbatim without sanitization | XSS risk when rendering in admin UI | Sanitize to plain text |
| Process user-suggestions at same priority as plan-driven gaps | Plans unblock work; user suggestions are nice-to-have | Lower priority class; re-rank if unblocks a plan |

## Version history

- **1.0 (2026-04-18)** — initial protocol spec + stub template + CLI helper. Server implementation ships via `16-design-system.md` Phase 8 `<VaultInboxCta>` component work.
