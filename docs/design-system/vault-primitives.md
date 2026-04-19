# Vault Primitives — `<VaultHoverCard>` / `<VaultExplainer>` / `useVaultQuickFetch`

> **Status:** shipped 2026-04-19 (16-design-system Phase 8).
> **Plan:** `docs/superpowers/plans/2026-04-18-e2e-walkthrough/16-design-system.md` §Phase 8.
> **Gate:** every per-tab plan that cites a vault slug MUST consume these primitives; direct `useVaultNote` / `useVaultSearch` usage is blocked by `scripts/ci/check-vault-primitive.sh`.

## Why

The Ars Contexta vault is our pedagogical source of truth — 743 atomic notes + 65 MOCs (and growing). Surfacing those notes in-context across the UI had been ad-hoc: a HoverCard in one view, a dialog in another, inline markdown in a third. That drift meant every feature reinvented the loading/error/404 story and drifted away from the vault's canonical slugs.

Phase 8 consolidates the surface into three components:

| Primitive | When to use | Reach |
|-----------|-------------|-------|
| `<VaultHoverCard>` | On-hover, tooltip-grade pedagogy. Breadboard pins, BOM row chips, ERC rule badges. | 140-char summary. |
| `<VaultExplainer>` | Inline expandable panel. Component Editor field help, simulation disabled-reason callouts, DRC "Why?". | Full body with audience-tier filtering. |
| `useVaultQuickFetch(slug)` | Custom UI that doesn't fit either primitive. Rare. | Hook-level access. |

Everything else bypasses the pattern and drifts the system — the CI guard catches that.

## Quick-start

### Hover card on a breadboard pin

```tsx
import { VaultHoverCard } from '@/components/ui/vault-hover-card';

<VaultHoverCard
  slug="esp32-gpio12-must-be-low-at-boot-or-module-crashes"
  onOpenInVault={(s) => navigate(`/vault?slug=${s}`)}
>
  <BoardPin data-pin="GPIO12" />
</VaultHoverCard>
```

### Explainer in a DRC row

```tsx
import { VaultExplainer } from '@/components/ui/vault-explainer';

<DrcRow severity="error">
  <span>{rule.message}</span>
  <VaultExplainer slug={rule.vaultSlug} tier={workspaceMode}>
    Why is this wrong?
  </VaultExplainer>
</DrcRow>
```

### Topic-driven lookup (no hard-coded slug)

```tsx
<VaultHoverCard topic={edge.protocol}>
  <EdgeLine />
</VaultHoverCard>
```

`topic` is slugified on the fly (`lowercase` + non-alphanumeric → `-`). Prefer `slug` when you have a canonical one — it's exact.

## States

| State | Visual |
|-------|--------|
| `loading` | Spinner + `Loading <slug>…` |
| `success` | Title + topics + 140-char summary + optional "Read more in Vault →" |
| `404 notFound` | `No vault note yet` + optional "Suggest a note" CTA (routes to `/vault-inbox`) |
| `error` (non-404) | Diagnostic string — shown in dev, hidden from users via error boundary |

The 404 CTA is wired via the `onSuggestNote?: (slug: string) => void` prop. Leave it undefined to suppress. When provided, consumers typically route to a VaultInbox dialog that seeds `inbox/<slug>.md` via the `/vault-inbox` skill template.

## Audience tiers

`<VaultExplainer>` inspects the note body for tier markers and renders only the matching section:

```markdown
### [beginner]
One-sentence analogy. Gentle framing.

### [intermediate]
Mechanism. Worked example. Derivation sketch.

### [expert]
Real-world caveats. Tolerance / parasitic / thermal.
```

Pass `tier="beginner"` / `"intermediate"` / `"expert"`. Future work wires this to `useWorkspaceMode()` (see `17-shell-header-nav.md` Phase 7.2 "Appearance > Workspace mode"). Until that lands, pass it explicitly.

Notes without tier markers render their full body as-is.

## Slug conventions

Every note under `knowledge/<slug>.md` is addressable by its filename stem:

- **Preferred:** exact slug. `esp32-gpio12-must-be-low-at-boot-or-module-crashes`.
- **Convenience:** topic-slugified. `edge.protocol === 'i2c'` resolves to `i2c`.

If the slug doesn't resolve, the primitive renders the 404 state — this is expected during plan execution as new notes extract from `inbox/`. Do not fabricate slugs. If you need a note that doesn't exist:

1. File an inbox stub via `/vault-gap "<topic>"` (see `.claude/skills/vault-gap/SKILL.md`).
2. Reference the prospective slug in the plan's Vault Integration subsection with `🟡 seed gap`.
3. The next `/extract` pass will land the note; the primitive starts resolving automatically.

**Never write directly to `knowledge/`.** The content pipeline is `inbox/ → /extract → knowledge/`.

## Performance

- Every fetch is React-Query-backed via `useVaultNote`. `staleTime: 5 min` — a slug hovered repeatedly in the same session hits the cache.
- The hover card only fetches on open (`enabled: open && slug`). An unmounted card never burns a request.
- `<VaultExplainer>` only fetches when expanded.

## CI enforcement

`scripts/ci/check-vault-primitive.sh` runs in CI and grep-scans `client/src` for direct `useVaultNote` / `useVaultSearch` imports. The whitelist is intentionally short. If you believe you need to bypass the primitive, append your file to the whitelist with a one-line justification — the review signal is worth the friction.

## Testing

- Hook: `client/src/hooks/__tests__/useVaultQuickFetch.test.tsx` (summary truncation, 404 normalization, error passthrough).
- Components: Radix HoverCard behavior is covered by the Radix test suite — our tests mock `fetch` via `vi.stubGlobal` and verify our state-rendering + CTA logic.
- Storybook stories (see `stories/` once Phase 7 Storybook lands) demonstrate loading / success / 404 / error states for visual regression.

## Related

- `16-design-system.md` Phase 8 — the originating plan.
- `.claude/skills/vault-validate/SKILL.md` — frontmatter v2 schema every note respects.
- `.claude/skills/vault-inbox/SKILL.md` — "Suggest a note" 404 target.
- `.claude/skills/extract/SKILL.md` Queue-Aware Batch Mode — how user-suggestions become real notes.
- `server/routes/knowledge-vault.ts` — the HTTP layer the primitives fetch from (rate-limited 60 req/min, whitelisted in `PUBLIC_API_PATHS`).
