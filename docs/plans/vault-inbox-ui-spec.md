# VaultInbox "Suggest a note" — HTTP route + UI spec

> **STATUS: NOT IMPLEMENTED.** This is a design spec, not documentation of shipped
> behavior. As of 2026-06-11 there is no `POST /api/vault/suggest` route in
> `server/routes/knowledge-vault.ts`, no `<VaultInboxCta>` component, and
> `ops/queue/user-suggestions.md` has never received a row. The spec was extracted
> from the retired `vault-inbox` skill (2026-06-11 skill audit, Cluster 5); the
> shipped CLI half now lives in `.claude/skills/vault-gap/SKILL.md` as the
> `--source user` mode. The shipped `<VaultExplainer>` component
> (`client/src/components/ui/vault-explainer.tsx`) already exposes an
> `onSuggestNote` callback on 404 — this spec describes the backend + modal that
> callback would feed.

## Concept

When a `<VaultHoverCard>` / `<VaultExplainer>` hits a 404 (no vault note for that
slug), the client shows a modal letting the user describe the missing note. POSTing
writes `inbox/YYYY-MM-DD-user-suggested-<slug>.md`, which `/extract` later processes.
Turns every gap into a potential contribution.

## Client trigger

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

For `<VaultExplainer>`, wire the existing `onSuggestNote(slug)` prop to open the
same `<VaultInboxCta>` modal.

## Server route (would add to `server/routes/knowledge-vault.ts`)

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

The slug derivation MUST match `.claude/skills/vault-gap/scripts/derive-slug.sh`
(lowercase, non-alphanumeric → dash, collapse/trim dashes, 80-char word-boundary cap,
reject anything outside `[a-z0-9-]`) so UI and CLI submissions produce identical
slugs and collision checks work across both surfaces.

## Rate limits + abuse controls

| Control | Value | Reason |
|---|---|---|
| Per-user rate limit | 10 submissions / hour | Prevents flooding |
| Description length | ≤500 chars | Stub, not an essay |
| Allowed characters | printable ASCII + common Unicode; no control chars, no HTML tags | Prevents XSS in rendered preview |
| Topic length | ≤120 chars before slug derivation | Reasonable title |
| Authentication | Required | Submitter identity is traceable |
| Origin check | If `origin_slug` is provided, must match an existing OR recently-queried slug | Prevents random spam |

## Security posture

- **Never trust user input for filenames** — always derive slug server-side, never pass user text to shell or fs paths.
- **Never execute user content** — stubs are markdown, read as text.
- **Path-traversal guard** — reject any slug containing `..`, `/`, `\`.
- **Size cap** — 4KB total stub body including frontmatter.
- **Auth required** — no anonymous submissions on web; CLI uses `$USER`.

## Moderation workflow

- Suggestions land in `inbox/` with `triage_status: pending-review`.
- `/extract` processes AUTHORITATIVE content (datasheets, standards) first.
- `user-suggested` stubs get a lower-priority class unless `unblocks:` points at a pending plan.
- Weekly moderation pass: review new suggestions, either promote to real extract pipeline or archive spam.

## Stub template

The stub template ships with the CLI mode:
`.claude/skills/vault-gap/templates/user-suggested-stub.md`. The server route would
render the same template with `origin_surface: ui`.

## Implementation checklist (when this ships)

- [ ] `suggestionSchema` (zod) + `sanitizeSuggestion` in `server/routes/knowledge-vault.ts`
- [ ] `POST /api/vault/suggest` with auth + rate limiting
- [ ] Server-side `deriveSlug` mirroring `derive-slug.sh`
- [ ] `<VaultInboxCta>` modal component
- [ ] Wire `<VaultExplainer onSuggestNote>` and `<VaultHoverCard>` 404 fallback to the modal
- [ ] E2E test: 404 → suggest → stub lands in `inbox/` + row in `ops/queue/user-suggestions.md`
