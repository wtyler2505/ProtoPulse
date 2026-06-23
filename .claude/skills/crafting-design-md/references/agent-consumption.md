# Agent Consumption

What AI coding agents actually do with a DESIGN.md. Load this when
tuning a DESIGN.md for agent-driven UI generation, or when an agent
is ignoring parts of a DESIGN.md you thought were important.

## Contents

- The Reading Order
- What Agents Parse vs. What They Skim
- How References Resolve at Generation Time
- Why Variants Matter
- Prose as Fallback
- Token Density and Context Windows
- Why Some DESIGN.md Files "Don't Stick"
- Tuning for Specific Agents

## The Reading Order

When a modern AI coding agent (Claude Code, Cursor, Stitch, Windsurf,
recent Copilot) loads a DESIGN.md, it runs roughly this pipeline:

1. **Front matter parse.** The YAML is loaded into a structured token
   tree. This is mechanical — any parser error here and the whole
   file may be silently dropped.
2. **Section heading scan.** The body is walked for `##` headings,
   matched against the canonical list. Known sections (Overview,
   Colors, Typography, Layout, Elevation & Depth, Shapes, Components,
   Do's and Don'ts) become indexed prose blocks.
3. **Reference resolution.** Every `{path.to.token}` in the token
   tree is resolved at this stage, once. Broken references are
   flagged but often treated as "token not found; fall through to
   prose" rather than hard errors.
4. **Context injection.** The parsed tree + indexed prose become
   part of the agent's system context (or its tool-callable
   reference pool, depending on the agent).
5. **Prompt-time retrieval.** When the user asks for UI, the agent
   pulls the relevant slice — usually the token tree plus the
   Components and Do's and Don'ts sections — into the generation
   prompt.

Agents that do *not* natively parse DESIGN.md treat it as ordinary
markdown and rely on context-window retrieval to surface the
relevant parts at generation time.

## What Agents Parse vs. What They Skim

Not all parts of a DESIGN.md have equal weight in generated output.

| DESIGN.md element          | Weight    | Why                                                                                         |
|----------------------------|-----------|---------------------------------------------------------------------------------------------|
| `colors:` tokens           | **high**  | Direct input to generated CSS / style values                                                |
| `typography:` tokens       | **high**  | Direct input to generated typography styles                                                 |
| `components:` entries      | **high**  | Contracts that generated components are expected to honor                                   |
| `rounded:` / `spacing:`    | **high**  | Direct input; less contested than colors                                                    |
| Component variant suffixes | high      | Agents learn state pairings (`-hover`, `-active`) from naming                               |
| Overview prose             | medium    | Fallback for judgment calls when tokens are ambiguous                                       |
| Colors prose               | medium    | Usage rules ("primary only for CTA") — often missed by agents                               |
| Do's and Don'ts            | medium    | Agents read; enforcement is inconsistent                                                    |
| Typography prose           | low–medium| Role assignment ("uppercase for labels") — usually followed; rare quirks often missed       |
| Layout prose               | low       | Spacing tokens dominate; prose is mostly guidance for responsive behavior                   |
| Elevation & Depth prose    | low       | Shadow values aren't tokenized; prose is all agents have, and they default to conservative  |
| Shapes prose               | low       | `rounded:` tokens dominate; prose repeats what tokens encode                                |

**Upshot:** If you want an agent to follow a rule reliably, put it
into `components:` as a token. If it can't be encoded as a token,
write it as an imperative line in Do's and Don'ts. Overview-level
prose is the weakest lever.

## How References Resolve at Generation Time

Token references (`{colors.primary}`) are resolved when the agent
generates code, not only at parse time. The practical consequence:

- **Editing a color propagates instantly.** Change `colors.primary`,
  and every component that references it generates with the new
  value on the next request.
- **Adding a component with references auto-inherits variants.**
  Because references are string paths, a new `card-featured` that
  sets `backgroundColor: "{colors.primary}"` picks up whatever
  primary is at the moment of generation.
- **Breaking a reference breaks silently.** The agent still emits
  code — often falling back to a sensible default — but the
  connection to your tokens is lost. This is why `broken-ref` is an
  error, not a warning.

## Why Variants Matter

A component without variants gets a single static style. A component
with suffixed variants (`button-primary-hover`, `-active`,
`-disabled`, `-focus`) gets a full interaction model.

**Without variants:**

```yaml
button-primary:
  backgroundColor: "{colors.primary}"
  textColor: "{colors.on-primary}"
```

Agent generates:

```tsx
<button style={{ background: theme.colors.primary, color: theme.colors.onPrimary }}>
  Submit
</button>
```

No hover. No focus ring. No disabled state. Usable but bare.

**With variants:**

```yaml
button-primary:
  backgroundColor: "{colors.primary}"
  textColor: "{colors.on-primary}"
button-primary-hover:
  backgroundColor: "{colors.primary-dim}"
button-primary-focus:
  backgroundColor: "{colors.primary}"
  borderColor: "{colors.accent}"
button-primary-disabled:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-neutral-muted}"
```

Agent generates:

```tsx
<button
  className="
    bg-primary text-on-primary
    hover:bg-primary-dim
    focus:ring-2 focus:ring-accent
    disabled:bg-neutral disabled:text-on-neutral-muted
  "
>
  Submit
</button>
```

**Rule of thumb:** For every component you define, define the
`-hover` and `-focus` variants at minimum. `-active` and
`-disabled` are worth adding when the component has real
interaction states (buttons, inputs, links).

## Prose as Fallback

When an agent can't find a relevant token, it reaches for prose. The
cascade is roughly:

1. Look for a component token that matches the request.
2. If no component, compose one from `colors:`, `typography:`,
   `rounded:`, `spacing:` primitives.
3. If primitives are ambiguous (e.g., three color options that could
   all fit), disambiguate using prose from the relevant section —
   usually Colors or Components.
4. If prose doesn't disambiguate either, fall back to Overview for
   the overall vibe and pick.

This means prose is most valuable at steps 3 and 4. Use it to
**disambiguate**, not to decorate. A paragraph that says "primary is
used exclusively for the single most important action per screen"
actively steers agents; a paragraph that says "primary embodies the
brand's confident, forward-looking posture" does not.

## Token Density and Context Windows

Agents have finite context. A DESIGN.md that's 40 KB of prose plus a
thin YAML block competes for context with the rest of the
conversation. Dense YAML beats sprawling prose because:

- Tokens compress: a line like `primary: "#D64F27"` carries a fact
  the agent would otherwise need a paragraph to infer.
- Structured data is cheaper to retrieve: some agents can fetch
  specific tokens without loading the whole file.
- Prose can be summarized away; tokens cannot.

**Target shape for a production DESIGN.md:**

- YAML front matter: 60–150 lines (roughly 40–100 tokens including
  components and variants)
- Prose body: 150–400 lines
- Total file size: under 30 KB

Anything larger is a smell that either the design system has too
many tokens (Tailwind-scale numerics: consider flattening) or the
prose has too much decoration.

## Why Some DESIGN.md Files "Don't Stick"

User complaint: "I wrote a DESIGN.md but the agent keeps using
random colors."

The common causes, in rough order of frequency:

1. **File isn't at repo root.** Agent scanned root, found nothing,
   moved on. See `references/integration-guide.md`.
2. **Agent config doesn't point at DESIGN.md.** The agent read
   CLAUDE.md / .cursorrules / AGENTS.md but that config didn't
   mention DESIGN.md. Add the pointer.
3. **YAML parse errors.** The whole file was silently dropped because
   `#D64F27` wasn't quoted or a dimension was missing a unit. Run
   `python3 scripts/validate.py DESIGN.md` to catch.
4. **Components section is empty or missing.** Without concrete
   component contracts, agents generate styles from primitives and
   often pick "close enough" values that don't match the tokens.
   Add at least `button-primary` and `input-default`.
5. **Tokens exist but prose contradicts them.** Overview says "dark
   minimal terminal" while `colors.primary` is warm ivory. Agent
   averages the two into something that matches neither. Align prose
   and tokens.
6. **Too many options at the same level.** Fifteen colors with no
   `primary` → agent picks one semi-randomly every generation. Add
   a clear `primary` and demote the rest.
7. **The agent doesn't natively parse DESIGN.md.** GPT-based tools
   in particular treat it as ordinary markdown and rely on retrieval.
   In that case, the `## Components` prose must name tokens
   explicitly: "button-primary uses colors.primary as background and
   colors.on-primary as text."

## Tuning for Specific Agents

**Claude Code / Sonnet / Opus:** Parses DESIGN.md structurally when
pointed at it. Responds strongly to Components tokens and Do's and
Don'ts prose. Honors references. Tuning suggestion: define
components tightly; keep Do's and Don'ts as imperative sentences.

**Cursor:** Reads `.cursor/rules/*.mdc` on session start and samples
markdown files during generation. Responds well to tokens but may
default to literal hex in generated code unless explicitly told to
use references. Tuning suggestion: in `.cursor/rules/design-system.mdc`,
add: "Always use token references (`colors.primary`) in generated
code; never literal hex values."

**Stitch (Google):** Native DESIGN.md parser; the reference
implementation. Follows the spec exactly. Tuning suggestion: treat
linter warnings as authoritative; Stitch is what the linter models.

**Windsurf / Cascade:** Reads `global_rules.md` and samples the
repo. Strong on tokens, weaker on variants. Tuning suggestion: add
a line in `global_rules.md` that names specific variants the agent
should honor (`button-primary-hover`, etc.).

**GitHub Copilot:** Does not natively parse DESIGN.md. Relies on
sampling at generation time. Prose matters more here than for
native parsers. Tuning suggestion: in `.github/copilot-instructions.md`,
include a short cheat sheet that names the 3–5 most important
tokens inline.

**Gemini CLI / Codex CLI:** Reads AGENTS.md. Performance parity with
Claude Code when AGENTS.md points at DESIGN.md.

**GPT-based agents without a dedicated parser:** Retrieval-driven.
Put the key tokens and component contracts in the first 30 lines of
the file so sampling catches them reliably.

## Quick Self-Test

To verify an agent is actually consuming your DESIGN.md, after
integration:

1. Open a fresh chat in the agent.
2. Prompt: *"Generate a primary button component using our design
   system."*
3. Check the output for:
   - A color value that matches `colors.primary` (exact hex or
     Tailwind class that maps to it)
   - Padding / rounded values that match your tokens
   - For a full-credit pass: the agent *names* the token
     (`colors.primary`) rather than hard-coding the hex

If the output is generic, tighten the pointer in your agent config
and re-test. If the output uses the right values but the wrong
token names, the agent is parsing DESIGN.md but generating literals
— add a directive in the agent config to prefer references.
