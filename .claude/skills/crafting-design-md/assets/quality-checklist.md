# Quality Checklist

Run this before delivering any DESIGN.md. The goal is not perfection —
it's *predictable agent behavior*. A DESIGN.md that passes every check
below will generate consistent, accessible, on-brand UI across Stitch,
Claude Code, Cursor, Windsurf, and Copilot.

## Pre-Flight Structure

- [ ] **File name is `DESIGN.md`** (uppercase, canonical) at repo root.
- [ ] **YAML front matter is present**, delimited by `---` fences on
  lines 1 and N.
- [ ] **YAML parses cleanly** — run
  `python3 scripts/validate.py DESIGN.md`. No parse errors.
- [ ] **No duplicate `##` section headings.** Linter treats these as
  hard rejections.
- [ ] **Sections appear in canonical order.** Overview → Colors →
  Typography → Layout → Elevation & Depth → Shapes → Components →
  Do's and Don'ts. Any subset is fine; order matters for the ones
  present.
- [ ] **No unknown top-level YAML keys.** Valid top-level keys:
  `version`, `name`, `description`, `colors`, `typography`,
  `rounded`, `spacing`, `components`.

## Front Matter Tokens

### Required bar

- [ ] **`name:` is set.** Spec-required.
- [ ] **At least one color token.** Empty `colors:` is a smell.
- [ ] **`primary:` color exists** if any colors are defined. Missing
  it triggers `missing-primary` warning and agents auto-generate one.
- [ ] **At least one typography token** if any colors are defined.
  Missing triggers `missing-typography` warning.

### Correctness

- [ ] **Every color value is a quoted hex string in sRGB:**
  `"#D64F27"`. Unquoted `#D64F27` breaks YAML (parses as a comment).
  Shorthand `#FFF` works but prefer 6-digit for clarity.
- [ ] **Every dimension has a unit** (`px`, `em`, `rem`) *except*
  `lineHeight` (unitless multiplier allowed) and `spacing` scale
  levels (unitless numbers allowed for counts / ratios).
- [ ] **Token references use `{path.to.token}` syntax**, quoted:
  `"{colors.primary}"` — not `${colors.primary}`, not `@colors.primary`.
- [ ] **Every token reference resolves.** Zero `broken-ref` findings
  from the validator. This is the only hard-error rule.
- [ ] **No nested `states:` blocks inside components.** Use flat
  suffixed keys (`button-primary-hover`) instead.
- [ ] **Component property keys are from the supported set:**
  `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`,
  `size`, `height`, `width`. Unknown properties are accepted with a
  warning — use sparingly.

## Prose

- [ ] **Every present section has at least one paragraph of
  rationale.** Token-only sections (no prose) fall back to defaults
  when edge cases hit.
- [ ] **Prose is rationale, not re-stated hex codes.** Delete any line
  that just says "Primary is #D64F27."
- [ ] **Overview names the vibe, audience, and emotional posture.**
  Two or three short paragraphs.
- [ ] **Colors prose assigns a role to each color.** "Primary is used
  exclusively for the single most important action per screen."
- [ ] **Typography prose names the font families and their roles.**
  Which family carries display vs. body vs. label.
- [ ] **Do's and Don'ts has 4–8 items** — imperative, practical,
  specific to this design system.

## Accessibility

- [ ] **Every `components:` entry with both `backgroundColor` and
  `textColor` passes WCAG AA (4.5:1 for normal text).** Use
  `scripts/contrast.py <bg> <fg>` or the validator's
  `contrast-ratio` rule.
- [ ] **All hover / active / focus variants checked for contrast.**
  Inherited properties can silently drift below AA when only the
  background changes.
- [ ] **Focus states are visible.** At least one of: outline,
  background shift, or border color change.
- [ ] **Error / warning / success states have non-color signals**
  mentioned in the prose (icons, shapes, text — not color alone).

## Token Hygiene

- [ ] **Every color token is referenced by at least one component**
  (or explicitly documented as prose-only). Orphans trigger the
  `orphaned-tokens` warning.
- [ ] **Literal values in components are justified.** If a hex
  appears twice, promote to a color token.
- [ ] **`on-*` variants exist for every background color used as a
  component surface.** If `colors.primary` is a button background,
  `colors.on-primary` should exist for its text.
- [ ] **Token names are semantic, not visual.** `primary` beats
  `orange-500`; `on-surface-muted` beats `gray-600`.

## Integration

- [ ] **DESIGN.md is at repo root** — not in `/docs` or
  `/design-system` without a root symlink.
- [ ] **Agent config file points at DESIGN.md** — check `AGENTS.md`,
  `CLAUDE.md`, `.cursorrules`, or `.windsurfrules` contains a one-line
  pointer.
- [ ] **No tokens duplicated in agent config.** Config points; DESIGN.md
  defines.
- [ ] **If a Tailwind / DTCG export exists, it's generated, not
  hand-edited.** A comment at the top of the generated file should
  say "auto-generated from DESIGN.md; do not edit."

## Final Pre-Ship

- [ ] **`python3 scripts/validate.py DESIGN.md` returns exit code 0**
  (zero errors; warnings are acceptable but reviewed).
- [ ] **`npx @google/design.md lint DESIGN.md` agrees** with the
  offline validator (if npx is available in the environment).
- [ ] **Token count is reasonable.** Under 100 tokens total across all
  categories; anything larger should be a conscious choice, not
  accidental sprawl.
- [ ] **File is under 30 KB.** Larger files compete for agent context
  windows.
- [ ] **One sample prompt verified.** In a fresh session of the target
  agent, ask for "a primary button per our design system" and confirm
  the output references tokens and matches the shape / color posture.

---

## Severity Decisions

Some checks are hard blockers, others are strong recommendations. Use
this table when deciding whether to ship a partially-passing DESIGN.md:

| Check failure                                  | Action                                 |
|------------------------------------------------|----------------------------------------|
| YAML parse error                               | **Block ship** — file is malformed     |
| Duplicate section heading                      | **Block ship** — spec-level rejection  |
| `broken-ref`                                   | **Block ship** — only hard error rule  |
| Missing `name:`                                | **Block ship** — spec-required         |
| `contrast-ratio` below AA on a shipped state   | **Block ship** — accessibility debt    |
| `missing-primary` with multiple colors         | **Fix before ship** — cheap to resolve |
| `missing-typography` with any colors           | **Fix before ship** — cheap to resolve |
| `section-order` warning                        | **Fix before ship** — reorder sections |
| `orphaned-tokens` with 1–2 tokens              | **Ship with note** — document or delete|
| `orphaned-tokens` with many tokens             | **Fix before ship** — signal of sprawl |
| `contrast-ratio` on a non-shipped state (e.g.  | **Ship with note** — document the      |
|   disabled text in `## Do's and Don'ts`)       |   reservation                          |
| `missing-sections` (info)                      | Ship — sections are optional           |
| `token-summary` (info)                         | Ship — informational only              |

---

## Post-Ship Maintenance

After shipping:

- [ ] **Pre-commit hook installed** — see
  `references/integration-guide.md` for the snippet. The hook should
  block commits that reintroduce errors.
- [ ] **CI validation added** — GitHub Actions / GitLab / CircleCI
  runs the validator on every PR touching `DESIGN.md`.
- [ ] **Version the file.** Use the spec's `version:` field (`alpha`
  as of this writing). Track team-level revisions via git history or
  an internal comment, not by inventing non-spec version strings.
- [ ] **Re-audit on major brand refresh.** Not every palette change
  warrants re-running every check; new components always do.
