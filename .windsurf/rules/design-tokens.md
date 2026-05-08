---
trigger: model_decision
description: ProtoPulse DESIGN.md is authoritative (Google Labs open format, Apache-2.0). Reference tokens via {colors.X}, {typography.X}, {rounded.X}. Load when generating/styling UI — never hard-code hex values.
---

# Design tokens

`DESIGN.md` at repo root is authoritative (21 KB, Google Labs open
format). When generating or styling UI components, reference tokens
from it:

- `{colors.primary}` — primary/action color
- `{colors.on-surface}` — text on surfaces
- `{colors.surface}`, `{colors.surface-raised}` — container surfaces
- `{typography.body-md}`, `{typography.display-lg}` — text scale
- `{rounded.md}` — corner radii
- etc.

## Rules

- **Never hard-code hex values** in generated components. If a color
  you need isn't in `DESIGN.md`, propose adding it — don't sneak a
  `#hex` into a component.
- **Never hand-edit the sidecar files** (`design_tokens.tailwind.json`,
  `design_tokens.json`, `design_tokens.css`). They're regenerated
  from `DESIGN.md`.
- **Honor component contracts** (`button-primary`, `input-default`,
  etc.) as baselines. Extend via variant suffixes (`-hover`,
  `-active`, `-focus`, `-disabled`) rather than inventing new
  components.

## Validator

The DESIGN.md has an offline validator:

```bash
python3 ~/.claude/skills/crafting-design-md/scripts/validate.py \
  /home/wtyler/Projects/ProtoPulse/DESIGN.md
```

Must exit 0. WCAG AA contrast (4.5:1) is enforced on all shipped
component color pairs.

## Regenerating sidecars

After editing `DESIGN.md`:

```bash
cd /home/wtyler/Projects/ProtoPulse

python3 ~/.claude/skills/crafting-design-md/scripts/export.py \
  DESIGN.md --format tailwind --output design_tokens.tailwind.json
python3 ~/.claude/skills/crafting-design-md/scripts/export.py \
  DESIGN.md --format dtcg     --output design_tokens.json
python3 ~/.claude/skills/crafting-design-md/scripts/export.py \
  DESIGN.md --format css      --output design_tokens.css
```

Commit `DESIGN.md` and all three sidecars together. Never commit one
without the others.
