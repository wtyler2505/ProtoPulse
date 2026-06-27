# design-sync NOTES — ProtoPulse

ProtoPulse is an **app**, not a published component library. Its design system is the
shadcn/ui (new-york) set under `client/src/components/ui/` styled with **Tailwind v4**
(`client/src/index.css`: `@import "tailwindcss"` + non-inline `@theme` tokens + class-based
dark mode). There is no built `dist/` of the components — so this sync runs in a controlled
**`--entry`** mode, not auto-synth.

## How the build is wired (read before touching config)
- **`cfg.entry` = `.design-sync/entry.tsx`** — a GENERATED controlled entry that `export *`s
  each scoped `ui/*` file (+ `export { default as <Name> }` for default-exported customs) so
  esbuild assembles one IIFE on `window.ProtoPulse`. Regenerate with the tmp scripts
  (`gen-scope.mjs` → `emit-entry.mjs`) if scope changes. `cfg.entry` is **cwd-relative** — run
  the converter from the worktree/repo root.
- **`pkg: "rest-express"`** (the root package name). With `cfg.entry` set, `PKG_DIR` walks up
  from the entry to the repo root, so `componentSrcMap`/`cssEntry`/`srcDir` paths resolve
  repo-relative. `node_modules/rest-express` does not exist — that's fine (fallback `{name}`).
- **`--node-modules ./node_modules`** — a SYMLINK to the main checkout's node_modules
  (`ln -sfn /home/wtyler/Projects/ProtoPulse/node_modules ./node_modules`). Recreate per clone
  (gitignored). Identical HEAD ⇒ versions match; avoids a multi-GB reinstall in the worktree.
- **`tsconfig: "tsconfig.json"`** — esbuild's tsconfigPathsPlugin resolves `@/* → client/src/*`
  and `@shared/* → shared/*` for the entry + transitive component imports.

## Tailwind CSS (cssEntry) — MUST be recompiled when component classes change
- `cfg.cssEntry = .design-sync/ds-tailwind.css` is a COMPILED artifact (gitignored), produced by:
  `npx @tailwindcss/cli@4.2.2 -i .design-sync/tw-input.css -o .design-sync/ds-tailwind.css`
  `.design-sync/tw-input.css` `@import`s the real `client/src/index.css` and `@source`s
  `../client/src` so every utility the components use is emitted (~400KB).
- The compiled CSS carries the `@theme` tokens (cyberpunk dark palette, `--color-primary`
  = `hsl(190 100% 43%)` cyan). Dark-first: static cards render dark with no ThemeProvider —
  that's on-brand. **Re-sync risk:** if you skip the Tailwind recompile, new component utility
  classes render unstyled.

## Fonts — shipped, do not "fix" away
- Brand families **Inter / Rajdhani / JetBrains Mono** load at runtime from Google Fonts (the
  app uses a `<link>` in `client/index.html`). We ship them as real `@font-face` rules via
  `cfg.extraFonts = [".design-sync/brand-fonts.css"]`. `brand-fonts.css` is the Google Fonts
  `css2` response fetched with a Chrome UA (49 `@font-face` rules, gstatic woff2 URLs);
  `extractFonts` keeps remote `url()`s as-is → `fonts/fonts.css` → `@import`ed by `styles.css`.
  **Re-sync risk:** gstatic URLs in `brand-fonts.css` can rot (font version bumps); re-fetch the
  `css2` URL with a modern browser UA if fonts stop loading. Refetch command in this file's git
  history / the fonts step.
- `[FONT_MISSING] "Cambria"` is EXPECTED and accepted — it's a system serif fallback in
  `--font-serif`, not a brand font. Do not chase it.

## tokensGlob does nothing without tokensPkg
- `copyTokens` returns early without `cfg.tokensPkg`. Font/remote-`@import` injection therefore
  goes through `extraFonts` (@font-face), NOT `tokensGlob`. The package shape never scrapes
  remote `@import url()` (that path is storybook-only).

## Config choices
- `guidelinesGlob: []` — ProtoPulse's `docs/` are project docs, not design guidelines (one is
  7.2 MB and over the 5 MB upload cap). Ship none; the conventions header carries the guidance.
- `docsDir: ".design-sync/component-docs"` (empty) — shadcn components have no per-component
  docs; prompts synthesize from `.d.ts` + authored previews. Pointing at the repo `docs/`
  mis-matched unrelated files.

## Scope (deterministic) — 62 SAFE now; RISKY tier pending
- Rule: every `ui/*.tsx` whose imports aren't app-coupled. Classified by `gen-scope.mjs`:
  - **SAFE (62)**: pure primitives + clean customs (ConfidenceBadge, EmptyState, PanelSkeleton,
    ProjectLoadingSkeleton, InteractiveCard, NumberInput, ConfirmDialog, StyledTooltip,
    VaultInfoIcon). Imports only react/radix/cva/utils. THIS BUNDLE.
  - **RISKY (~19, next batches)**: import `@/lib/<feature>` data modules; render from props
    (FeatureMaturityBadge, LifecycleBadge, MentionBadge, ReleaseConfidenceCard, TrustReceiptCard,
    PredictionCard/Panel, RolePresetSelector, ViewOnboardingHint, SmartHintToast, EmbedDialog,
    RadialMenu, LessonModeOverlay, LibrarySuggestPopover, VaultExplainer, VaultHoverCard, Sidebar,
    CalcApplyButtons, AddToBomPrompt). Add in small batches so a transitive resolution failure
    isolates. Some are context-coupled → may floor-card.
  - **EXCLUDE (13)**: context-coupled app features + search glue + build-breakers
    (FirstRunChecklist[4 contexts], TutorialOverlay/Menu, ShortcutsOverlay, ExplainPanelButton,
    GlobalSearchDialog, UnifiedComponentSearch, DatasheetLink, ShareProjectButton[collab graph],
    WhatsNewPanel[imports `CHANGELOG.md?raw` — esbuild can't resolve], command-palette,
    keyboard-shortcuts-modal, theme-toggle). NOT design-system primitives.
- **Name collision:** `Toaster` is exported by both `sonner.tsx` (kept) and `toaster.tsx`
  (dropped — duplicate `export *` breaks esbuild). Keep sonner's.

## Known render warns (triaged legitimate)
- Un-authored primitives auto-render blank/thin (no props/children) — NOT failures; fixed by
  authoring `.design-sync/previews/<Name>.tsx`. 36 show the honest typographic floor card.

## Re-sync risks (watch-list)
- Tailwind recompile + Google-Fonts refetch are MANUAL pre-converter steps (see above).
- `entry.tsx` + `componentSrcMap` are generated from `tmp/*.mjs` (not committed to repo;
  the generated `entry.tsx` IS committed). If new `ui/*` components land, re-run the classifier.
- `--radius` and a few `--*-outline`/`--border-subtle` vars are runtime-set or intentionally
  0px (sharp cyberpunk corners) — `[TOKENS_MISSING]` for them is expected, not a regression.

## Authoring learnings (calibration: Button/Badge/Card/Alert graded good)
- **Preview pattern**: wrap each cell in a dark surface `<div className="bg-background text-foreground" style={{padding:24}}>` (DS is dark-first; components are invisible on white). Named-export functions = story cells (2–6 per component). Realistic EDA/hardware content ("Run Simulation", "ATmega328P", "DRC failed", "SMD 0603"), never foo/bar.
- **Imports**: components via `@/components/ui/<file>` (maps to window.ProtoPulse). Icons via `import { X } from "lucide-react"` — works because lucide-react is in cfg.extraEntries (bundled once on the global). Use canonical lucide v0.545 names (TriangleAlert, not AlertTriangle).
- **GOTCHA — lucide icon as direct child of Alert breaks capture**: a lucide `<svg>` as the FIRST child of `<Alert>` (which has `[&>svg]:absolute`) makes capture report "no exports / __dsCells empty". Author Alert WITHOUT a leading icon (title+description only). Icons inside Button/other components are fine.
- **Avoid a cell named `Default`** (collides with default-export handling) — use Standard/Primary/etc.
- **lucide perf**: NEVER author previews that import lucide without lucide-react in extraEntries — esbuild re-bundles the full icon barrel per preview (~1min each). With extraEntries it's instant.
- **Build/capture loop**: `package-build.mjs` (full) compiles authored previews; then `package-capture.mjs --components A,B` screenshots cells → grade from `_screenshots/review/<group>__<Name>.png`. `preview-rebuild.mjs --components` is the fast targeted rebuild but REQUIRES a prior full package-build (needs .stories-map.json).
- **Write preview files via Desktop Commander** (`mcp__desktop-commander__write_file`) — the claudekit `typecheck-changed` PostToolUse hook OOM-blocks the built-in Write tool on these standalone .tsx files.

## Grading triage (full 81-author pass) — final roster 76
- **Render-check `bad`/`empty` flags are NOISY** — judge from the contact sheets, not the flag. ~71/81 authored previews rendered great despite many `✗ empty` flags (PNG-size/cell-height heuristic over-fires on tall/short cards).
- **5 EXCLUDED from roster** (data-fetching/app-context, not design primitives; they throw at render with no provider): CalcApplyButtons (useBom→BomProvider+QueryClient+projectId+/api), LifecycleBadge + VaultExplainer/VaultHoverCard/VaultInfoIcon (unconditional useQuery → QueryClient). Added to `DATA_EXCLUDE` in tmp/emit-entry.mjs. Roster 81→76.
- **Tooltip/Toast cluster fix** (Tooltip, StyledTooltip, ConfidenceBadge, MentionBadge, Toast): the GLOBAL cfg.provider (TooltipProvider>ToastProvider) does NOT reach authored open-state previews. Fix = wrap each preview's Surface in an **in-cell** `<TooltipProvider>` (or `<ToastProvider>`+`<ToastViewport>` for Toast), imported from the same `@/components/ui/*`. ConfidenceBadge/MentionBadge need it too (internal styled-tooltip).
- **`cfg.overrides.<Name>.skip` is an ARRAY of story names, NOT `true`** — `skip:true` crashes the build (`new Set(true)`, emit.mjs:368). Don't use it to skip a whole component; exclude from componentSrcMap/entry instead.
- **`__dsCells empty` capture bug**: triggered by a lucide `<Icon/>` rendered inside a radix-portal component (Alert with `[&>svg]:absolute`, Tooltip content). Fix = drop the lucide icon from that specific preview (icons as plain button/badge children are fine). Cost me real time on Alert + Tooltip.
