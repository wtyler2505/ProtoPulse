---
version: alpha
name: ProtoPulse
description: Dark-first AI-assisted electronics design workbench combining engineering rigor, neon-cyan energy, and accessible high-density tooling.
colors:
  primary: "#00B7DB"
  primary-foreground: "#060709"
  secondary: "#884DFF"
  secondary-foreground: "#FFFFFF"
  background: "#060709"
  foreground: "#E0E6EB"
  foreground-muted: "#929EAF"
  surface: "#0A0C0F"
  surface-muted: "#16181D"
  border: "#2D3039"
  sidebar: "#08090C"
  editor-accent: "#00F0FF"
  brand: "#00B7DB"
  power: "#F9B11F"
  signal: "#33DDFF"
  data: "#B87BF4"
  warning: "#FFCC33"
  success: "#36E27E"
  info: "#6EA7F7"
  error: "#EE2B2B"
  focus-ring: "#FFFFFF"
typography:
  display-hero:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.03em
  display-title:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: 2rem
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: 1.5rem
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: -0.015em
  headline-md:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: 1.125rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.01em
  body-lg:
    fontFamily: "Inter, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.6
    letterSpacing: 0em
  body-md:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0em
  body-sm:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0.01em
  label-md:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: 0em
  label-sm-caps:
    fontFamily: "Inter, sans-serif"
    fontSize: 0.75rem
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: 0.1em
  data-md:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: 0em
    fontFeature: '"tnum" 1, "liga" 0'
  data-sm:
    fontFamily: "JetBrains Mono, monospace"
    fontSize: 0.75rem
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0em
    fontFeature: '"tnum" 1, "liga" 0'
  kpi-lg:
    fontFamily: "Rajdhani, sans-serif"
    fontSize: 3rem
    fontWeight: 700
    lineHeight: 1
    letterSpacing: -0.03em
rounded:
  none: 0px
  sm: 0px
  md: 0px
  lg: 0px
  xl: 0px
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  '2xl': 48px
  '3xl': 64px
  card-padding-sm: 12px
  card-padding-md: 16px
  card-padding-lg: 24px
  header-row: 40px
  workspace-header: 80px
  sidebar-min: 180px
  sidebar-max: 480px
  chat-min: 280px
  chat-max: 600px
  grid-unit: 20px
  command-center-columns: "5"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 36px
    typography: "{typography.label-md}"
  button-primary-hover:
    backgroundColor: "{colors.editor-accent}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 36px
    typography: "{typography.label-md}"
  button-primary-focus:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 36px
    typography: "{typography.label-md}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 36px
    typography: "{typography.label-md}"
  button-destructive:
    backgroundColor: "{colors.error}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 36px
    typography: "{typography.label-md}"
  input-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 36px
    typography: "{typography.body-md}"
  card-default:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: 24px
    typography: "{typography.body-md}"
  card-dense:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: 16px
    typography: "{typography.body-sm}"
  sidebar-panel:
    backgroundColor: "{colors.sidebar}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    padding: 16px
    typography: "{typography.body-md}"
  tabs-list:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.foreground-muted}"
    rounded: "{rounded.none}"
    padding: 4px
    height: 36px
    typography: "{typography.label-md}"
  tabs-trigger:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.foreground-muted}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 32px
    typography: "{typography.label-md}"
  tabs-trigger-active:
    backgroundColor: "{colors.background}"
    textColor: "{colors.primary}"
    rounded: "{rounded.none}"
    padding: 12px
    height: 32px
    typography: "{typography.label-md}"
  badge-power:
    backgroundColor: "{colors.power}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.label-sm-caps}"
  badge-signal:
    backgroundColor: "{colors.signal}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.label-sm-caps}"
  badge-data:
    backgroundColor: "{colors.data}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.label-sm-caps}"
  badge-warning:
    backgroundColor: "{colors.warning}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.label-sm-caps}"
  badge-success:
    backgroundColor: "{colors.success}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.label-sm-caps}"
  badge-info:
    backgroundColor: "{colors.info}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.label-sm-caps}"
  badge-error:
    backgroundColor: "{colors.error}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.label-sm-caps}"
  brand-mark:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.none}"
    padding: 8px
    typography: "{typography.label-sm-caps}"
  rule-divider:
    backgroundColor: "{colors.border}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.none}"
    height: 4px
    width: 32px
    typography: "{typography.body-sm}"
  focus-indicator:
    backgroundColor: "{colors.focus-ring}"
    textColor: "{colors.background}"
    rounded: "{rounded.none}"
    height: 4px
    width: 32px
    typography: "{typography.body-sm}"
  code-inline:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.signal}"
    rounded: "{rounded.none}"
    padding: 4px
    typography: "{typography.data-sm}"
---

## Overview

ProtoPulse should feel like an engineering workbench, not a marketing dashboard. The product exists to take a maker from "I have an idea" to "I have a manufacturable design" without forcing context switches across half a dozen tools. The interface therefore needs to communicate seriousness, velocity, and technical trust. It should feel like a modern lab console with AI assistance embedded into the workflow, not layered on top of it.

The canonical visual identity is the default Neon Cyan dark theme verified in the app's runtime tokens. Near-black surfaces create long-session comfort, neon cyan provides the brand pulse, violet adds strategic separation, and semantic hardware colors carry meaning across architecture, schematic, breadboard, PCB, validation, and BOM views. Alternate dark presets are allowed as skins, and light mode / high-contrast mode are valid accommodations, but generated UI should treat the neon-cyan dark palette as the source-of-truth aesthetic.

ProtoPulse is dense by design. It is for people who are actively building, debugging, comparing, validating, and exporting. Use progressive disclosure to reduce overwhelm, but do not flatten the product into a toy. Dense surfaces are acceptable when the hierarchy is explicit, labels are disciplined, and interaction states are unmistakable.

## Colors

ProtoPulse color is functional before it is decorative. The palette is organized around three jobs: identity, interaction, and engineering semantics. Brand cyan says "this is ProtoPulse." Interactive emphasis says "this is the thing you can act on now." Semantic status colors say "this is power, signal, data, warning, success, info, or error." Do not collapse those jobs into a single accent.

- **Primary (`#00B7DB`)**: The main interactive emphasis. Use for primary actions, active states, selected controls, key icons, and edge glows. It should feel energetic and precise, never soft.
- **Primary foreground (`#060709`)**: The preferred text/icon color on bright cyan fills. New generated UI should use this rather than light text on cyan.
- **Secondary (`#884DFF`)**: Distinct supporting emphasis. Use when a surface needs to be meaningfully different from cyan without reading as danger or hardware state.
- **Secondary foreground (`#FFFFFF`)**: Use pure white on violet in new generated surfaces so normal-weight interface text clears WCAG AA.
- **Background (`#060709`)**: The deepest application plane. This is the baseline field for the workspace and should remain visually calm.
- **Surface (`#0A0C0F`)**: Standard card, panel, popover, and modal surface. Slightly lifted from background through tone rather than large shadows.
- **Surface muted (`#16181D`)**: Utility surface for tabs, inactive controls, code chips, segmented containers, and subtle fills.
- **Foreground (`#E0E6EB`)**: Primary readable text on dark surfaces. Use for most titles, data labels, and interactive content.
- **Foreground muted (`#929EAF`)**: Metadata, helper text, timestamps, inactive icons, and non-critical labels.
- **Border (`#2D3039`)**: Structural separation. Borders are a primary hierarchy mechanism in ProtoPulse and should appear more often than ornamental shadows.
- **Sidebar (`#08090C`)**: Dedicated chrome plane for navigation rails and persistent side structures.
- **Editor accent (`#00F0FF`)**: The hottest cyan in the system. Reserve for highlighted project cards, editor callouts, counts, or moments that should feel electrically alive.
- **Brand (`#00B7DB`)**: Identity cyan. Use for the ProtoPulse wordmark, signature brand moments, and recognizable product chrome.
- **Power (`#F9B11F`)**: Electrical power domain meaning. Use for rails, supply indicators, power nets, or power-related badges.
- **Signal (`#33DDFF`)**: Data and signal flow meaning. Use for signal traces, live-path emphasis, and technical motion surfaces.
- **Data (`#B87BF4`)**: Quantitative information, measured values, highlighted IDs, or non-interactive data emphasis.
- **Warning (`#FFCC33`)**: Advisory state. Important, but not fatal.
- **Success (`#36E27E`)**: Positive verification, pass states, and ready-to-run conditions.
- **Info (`#6EA7F7`)**: Informational guidance, neutral-helpful pedagogy, and explanation surfaces.
- **Error (`#EE2B2B`)**: Critical failure, destructive actions, and blocking issues. Prefer dark text on the red fill for buttons and compact labels.
- **Focus ring (`#FFFFFF`)**: Palette-independent focus treatment for dark mode. Focus visibility must remain legible even when the active surface is already cyan.

When generating themed variants, preserve the semantic map even if the hue family changes. For example, a Forest or Amber preset can recolor `primary`, but `power` must still read as electrical power and `signal` must still read as live connectivity. Theme changes may alter mood; they must not erase meaning.

## Typography

ProtoPulse uses a three-family typography system with strict role separation.

Rajdhani is the display voice. Use it for page titles, dashboard KPIs, workspace identity, and section headers that need engineered confidence. It brings a condensed, technical posture without turning into sci-fi parody. Rajdhani should feel like instrumentation lettering: assertive, compact, and clean.

Inter is the working text voice. Use it for body copy, control labels, helper text, empty states, dialog content, and general UI scaffolding. Most application reading happens here, so it should stay calm and highly legible. ProtoPulse is dense enough already; the body system must not add noise.

JetBrains Mono is for technical truth. Use it for net names, pin labels, part numbers, IDs, code snippets, logs, measurements, exported values, and any data the user may need to compare character-by-character. Prefer tabular numerals and disable decorative ligatures in generated code-like surfaces.

Case policy matters as much as size. Use title case for view titles and dialog headers. Use sentence case for body copy, buttons, and helper text. Use all caps sparingly for compact status pills, panel eyebrows, and other meta-labels where a compressed signal is useful. Never use all caps for multi-line prose.

Typographic density should scale with task type. Explanatory and educational panels can open up toward `body-lg`; inspectors, toolbars, tables, and technical overlays should remain at `body-md`, `body-sm`, or the mono styles. Generated UI should respect ProtoPulse's font-scaling settings by avoiding layouts that only work at one fixed text size.

## Layout

ProtoPulse is a desktop-first, high-density workbench organized around a three-panel mental model: navigation on the left, active design surface in the center, and assistance or context on the right. This structure should remain recognizable across workspace features. When space gets tight, collapse or dock secondary regions before sacrificing the main design surface.

The spacing system is a 4px base grid. Use `8px`, `12px`, `16px`, and `24px` as the dominant working increments. `16px` is the default utility spacing, while `24px` is the canonical primary card padding. Dense technical surfaces may compress to `12px`, but anything below that should be treated as special-case instrumentation UI rather than a general layout norm.

Headers in the main workspace are modular rather than monolithic. The verified shell uses two `40px` rows to form an `80px` workspace header. That modularity should continue: identity, tabs, health, tutoring, imports, and AI affordances can coexist as clusters, but they need crisp separation and predictable row logic.

The center canvas should usually feel infinite or field-like rather than boxed in. Dot grids, substrate patterns, radial gradients, and subtle technical textures are valid when they support orientation. They must stay quiet enough that nodes, wires, chips, text, and measurement overlays remain dominant.

Responsive behavior should preserve utility, not merely shrink everything. On smaller screens, turn the system into a sequence of focused surfaces: mobile header, collapsible navigation, toggled AI assistant, and clear entry points back into the active task. The product should still feel like a toolbench, just one that packs itself intelligently.

## Elevation & Depth

ProtoPulse is mostly flat in geometry but not visually flat in hierarchy. Depth should come primarily from tonal layering, borders, backdrop blur, edge glow, and contrast shifts. Large soft shadows are not the house style. When shadows exist, they should read as a compact separation aid, not a consumer-app card flourish.

Use borders aggressively and intentionally. A surface usually earns its hierarchy through one of these combinations:

- A darker or lighter tonal plane against the background.
- A precise border in `border`.
- A localized glow from `primary` or `editor-accent`.
- A blur-backed overlay for temporary or floating context.

Transient layers like prediction panels, slide-over activity feeds, dialogs, and teaching overlays can use stronger blur, stronger edge light, and tighter shadow stacks. Persistent structures like sidebars, cards, tab bars, and inspectors should stay mostly border-and-tone driven.

Focus treatment is not optional depth. Keyboard focus must be obvious on every interactive element. Use the palette-independent focus ring instead of assuming the brand color will remain visible against whatever themed surface is underneath.

## Shapes

ProtoPulse's default shape posture is sharp. Buttons, inputs, cards, tabs, handles, and node surfaces should resolve to square corners by default. The system should feel cut, machined, or plotted, not inflated.

Chamfers, clipped corners, corner marks, and edge treatments are part of the brand vocabulary, but they are accent language rather than a blanket rule. Use them where they communicate a control surface, a technical frame, or a high-value panel. Do not apply chamfer treatments to every card in the application, or the whole interface starts competing with itself.

Rounded pills are the only meaningful exception. Compact health badges, status dots, or small workspace chips may use `full` rounding when the goal is to create a dense semantic marker rather than a container. Even then, keep the treatment crisp and restrained.

If you are deciding between soft rounding and a square cut, choose the square cut unless there is a very specific usability reason not to.

## Components

Component styling in ProtoPulse should reinforce tool confidence and scan speed.

- **Primary button**: Bright cyan fill with dark text. This is the "do the main thing" control and should feel electrically live. On hover, it may step up to the hotter editor accent.
- **Secondary button**: Vivid violet fill with white text. Use when the action matters but should remain distinct from the global cyan action track.
- **Destructive button**: Strong red fill with dark text. It should be unmistakable, but still readable and composed.
- **Inputs**: Surface-toned, bordered, and calm. Inputs should not steal attention until focused. Their job is to preserve clarity inside dense tooling.
- **Cards and panels**: Near-black surfaces with disciplined padding and crisp edges. Prefer `card-default` for primary content groupings and `card-dense` for inspectors, technical tables, and utility drawers.
- **Tabs**: The inactive rail should sit in `surface-muted`; the active tab should cut back to the dark background plane with cyan emphasis. Tabs are a routing mechanism, so they should feel precise and index-like.
- **Semantic badges**: Power, signal, data, warning, success, info, and error badges should always map to their semantic colors. These are not decorative chips; they are compact instrumentation labels.
- **Code and inline data**: Use the mono token and signal-toned text against a muted surface. Technical snippets should feel native to the electronics workspace, not pasted from a generic docs site.

ProtoPulse components should also inherit a few interaction rules from the verified app shell:

- Use visible keyboard focus on all interactive elements.
- Favor small but confident motion: around `150ms` for micro-interactions and under `300ms` for larger transitions.
- Provide tactile active states for buttons and controls, but keep them subtle enough for dense toolbars.
- Pair icon-only controls with labels, tooltips, or both.
- Preserve `data-testid` friendliness and clear DOM structure for complex surfaces.

When generating new views, think in clusters: navigation controls, view controls, status chips, primary work surface, and contextual assistant tools. ProtoPulse feels best when each cluster is internally tight and externally separated.

## Do's and Don'ts

- Do default to the neon-cyan dark palette as the canonical ProtoPulse identity, even if alternate presets exist.
- Do use semantic hardware colors by meaning: power for power, signal for signal, data for measured values, warning for advisory state, and so on.
- Do keep the interface sharp, square, and machined-looking; use chamfers as accents, not wallpaper.
- Do use Rajdhani for titles and KPIs, Inter for working UI, and JetBrains Mono for anything technical or comparison-sensitive.
- Do rely on borders, tonal shifts, and compact glows for hierarchy before reaching for large shadows.
- Do preserve strong, palette-independent keyboard focus visibility and respect font scaling, reduced motion, and high-contrast accommodations.
- Don't flood large surfaces with bright cyan. Cyan is a signal, not a background wash.
- Don't turn ProtoPulse into a soft consumer SaaS dashboard with oversized cards, rounded pillows, or generic gradient branding.
- Don't use all caps for body copy, explanations, or long labels.
- Don't reuse brand cyan as a substitute for every status color; it destroys semantic readability.
- Don't hide complexity by removing information users need. Reduce cognitive load with grouping and disclosure, not with oversimplification.
- Don't make blur, glow, or animation carry hierarchy by themselves; always pair them with explicit structure.
