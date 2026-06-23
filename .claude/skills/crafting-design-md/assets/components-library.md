# Components Library

Canonical `components:` entries you can lift directly into a DESIGN.md.
Every entry uses token references, exists in the flat key-plus-suffix
variant style the spec prefers, and passes WCAG AA when paired with
sensible color tokens.

**How to use:** Copy the blocks you need into your `components:` map.
Adjust the referenced token paths (e.g., `{colors.primary}` →
whatever matches your palette). Delete anything you don't plan to
ship.

## Contents

- Buttons
- Inputs & Forms
- Navigation
- Data Display
- Feedback
- Overlays
- Content Containers
- Typography Specials
- State Suffixes Reference

---

## Buttons

### Primary button (filled)

```yaml
button-primary:
  backgroundColor: "{colors.primary}"
  textColor: "{colors.on-primary}"
  rounded: "{rounded.md}"
  padding: 12px
  typography: "{typography.label-md}"
button-primary-hover:
  backgroundColor: "{colors.primary-dim}"
button-primary-active:
  backgroundColor: "{colors.primary-deep}"
button-primary-disabled:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-neutral-muted}"
button-primary-focus:
  backgroundColor: "{colors.primary}"
```

### Secondary button (outlined / subdued)

```yaml
button-secondary:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.primary}"
  rounded: "{rounded.md}"
  padding: 12px
  typography: "{typography.label-md}"
button-secondary-hover:
  backgroundColor: "{colors.neutral}"
button-secondary-disabled:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-neutral-muted}"
```

### Tertiary / ghost button

```yaml
button-tertiary:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.primary}"
  rounded: "{rounded.md}"
  padding: 8px
  typography: "{typography.label-md}"
button-tertiary-hover:
  backgroundColor: "{colors.neutral}"
```

### Destructive button

```yaml
button-destructive:
  backgroundColor: "{colors.error}"
  textColor: "{colors.on-error}"
  rounded: "{rounded.md}"
  padding: 12px
  typography: "{typography.label-md}"
button-destructive-hover:
  backgroundColor: "{colors.error-dim}"
```

### Icon button (square)

```yaml
button-icon:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.sm}"
  padding: 8px
  size: 40px
button-icon-hover:
  backgroundColor: "{colors.neutral}"
```

### Pill-shape button (consumer / friendly)

```yaml
button-pill:
  backgroundColor: "{colors.primary}"
  textColor: "{colors.on-primary}"
  rounded: "{rounded.full}"
  padding: 16px
  typography: "{typography.label-md}"
```

---

## Inputs & Forms

### Default input

```yaml
input-default:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 12px
  typography: "{typography.body-md}"
input-focus:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
input-disabled:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-neutral-muted}"
input-error:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
```

### Textarea (same base, relaxed padding)

```yaml
textarea-default:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
  typography: "{typography.body-md}"
```

### Search input (rounded pill variant)

```yaml
input-search:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.full}"
  padding: 12px
  typography: "{typography.body-md}"
```

### Select / dropdown trigger

```yaml
select-default:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 12px
  typography: "{typography.body-md}"
```

### Checkbox / radio

```yaml
checkbox-default:
  backgroundColor: "{colors.surface}"
  rounded: "{rounded.sm}"
  size: 20px
checkbox-checked:
  backgroundColor: "{colors.primary}"
  rounded: "{rounded.sm}"
  size: 20px
```

### Toggle switch

```yaml
toggle-off:
  backgroundColor: "{colors.neutral}"
  rounded: "{rounded.full}"
  height: 24px
  width: 44px
toggle-on:
  backgroundColor: "{colors.primary}"
  rounded: "{rounded.full}"
  height: 24px
  width: 44px
```

### Form label

```yaml
label-field:
  textColor: "{colors.on-surface}"
  typography: "{typography.label-md}"
```

### Helper / error message

```yaml
helper-text:
  textColor: "{colors.on-surface-muted}"
  typography: "{typography.body-sm}"
helper-error:
  textColor: "{colors.error}"
  typography: "{typography.body-sm}"
```

---

## Navigation

### Top-nav link (inactive / active)

```yaml
nav-link:
  textColor: "{colors.on-surface-muted}"
  typography: "{typography.label-md}"
  padding: 8px
nav-link-active:
  textColor: "{colors.on-surface}"
  typography: "{typography.label-md}"
  padding: 8px
nav-link-hover:
  textColor: "{colors.on-surface}"
```

### Sidebar item

```yaml
sidebar-item:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface-muted}"
  rounded: "{rounded.md}"
  padding: 12px
  typography: "{typography.label-md}"
sidebar-item-active:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.primary}"
  rounded: "{rounded.md}"
  padding: 12px
```

### Breadcrumb item

```yaml
breadcrumb-item:
  textColor: "{colors.on-surface-muted}"
  typography: "{typography.body-sm}"
breadcrumb-item-current:
  textColor: "{colors.on-surface}"
  typography: "{typography.body-sm}"
```

### Tab

```yaml
tab-default:
  textColor: "{colors.on-surface-muted}"
  padding: 12px
  typography: "{typography.label-md}"
tab-active:
  textColor: "{colors.on-surface}"
  padding: 12px
  typography: "{typography.label-md}"
```

### Pagination button

```yaml
page-button:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 8px
  size: 40px
page-button-active:
  backgroundColor: "{colors.primary}"
  textColor: "{colors.on-primary}"
  rounded: "{rounded.md}"
  size: 40px
```

---

## Data Display

### Default card

```yaml
card-default:
  backgroundColor: "{colors.surface}"
  rounded: "{rounded.md}"
  padding: 24px
```

### Elevated / featured card

```yaml
card-elevated:
  backgroundColor: "{colors.surface-raised}"
  rounded: "{rounded.lg}"
  padding: 24px
```

### Compact list-row card

```yaml
card-row:
  backgroundColor: "{colors.surface}"
  rounded: "{rounded.md}"
  padding: 16px
```

### Table row (header + body)

```yaml
table-header:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  padding: 12px
  typography: "{typography.label-md}"
table-row:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  padding: 12px
  typography: "{typography.body-sm}"
table-row-hover:
  backgroundColor: "{colors.neutral}"
```

### Tag / chip

```yaml
chip-default:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.full}"
  padding: 4px
  typography: "{typography.label-sm}"
chip-selected:
  backgroundColor: "{colors.primary}"
  textColor: "{colors.on-primary}"
  rounded: "{rounded.full}"
  padding: 4px
chip-tag:
  backgroundColor: "{colors.tertiary}"
  textColor: "{colors.on-tertiary}"
  rounded: "{rounded.full}"
  padding: 4px
  typography: "{typography.label-sm}"
```

### Badge (small status pill)

```yaml
badge-default:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.full}"
  padding: 2px
  typography: "{typography.label-sm}"
badge-success:
  backgroundColor: "{colors.success}"
  textColor: "{colors.on-success}"
badge-warning:
  backgroundColor: "{colors.warning}"
  textColor: "{colors.on-warning}"
badge-error:
  backgroundColor: "{colors.error}"
  textColor: "{colors.on-error}"
```

### Avatar (user initials placeholder)

```yaml
avatar-sm:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.full}"
  size: 24px
avatar-md:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.full}"
  size: 40px
avatar-lg:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.full}"
  size: 56px
```

### Progress bar

```yaml
progress-track:
  backgroundColor: "{colors.neutral}"
  rounded: "{rounded.full}"
  height: 8px
progress-fill:
  backgroundColor: "{colors.primary}"
  rounded: "{rounded.full}"
  height: 8px
```

---

## Feedback

### Alert banner

```yaml
alert-info:
  backgroundColor: "{colors.info-soft}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
alert-success:
  backgroundColor: "{colors.success-soft}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
alert-warning:
  backgroundColor: "{colors.warning-soft}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
alert-error:
  backgroundColor: "{colors.error-soft}"
  textColor: "{colors.error}"
  rounded: "{rounded.md}"
  padding: 16px
```

### Toast notification

```yaml
toast-default:
  backgroundColor: "{colors.surface-raised}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
  typography: "{typography.body-sm}"
```

### Loading spinner (wrapper — the spinner itself is SVG)

```yaml
spinner-wrapper:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.primary}"
  rounded: "{rounded.full}"
  size: 24px
```

### Skeleton placeholder

```yaml
skeleton:
  backgroundColor: "{colors.neutral}"
  rounded: "{rounded.md}"
  height: 16px
```

---

## Overlays

### Modal / dialog container

```yaml
modal-default:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.lg}"
  padding: 32px
```

### Popover / tooltip

```yaml
tooltip-default:
  backgroundColor: "{colors.surface-raised}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.sm}"
  padding: 8px
  typography: "{typography.label-sm}"
popover-default:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
```

### Dropdown menu

```yaml
menu-default:
  backgroundColor: "{colors.surface}"
  rounded: "{rounded.md}"
  padding: 8px
menu-item:
  backgroundColor: "{colors.surface}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.sm}"
  padding: 8px
  typography: "{typography.body-md}"
menu-item-hover:
  backgroundColor: "{colors.neutral}"
```

### Backdrop / scrim (use a semi-transparent color — spec only takes
opaque hex, so pair this with CSS opacity in implementation)

```yaml
backdrop:
  backgroundColor: "{colors.primary}"
  # Opacity handled in implementation; 0.4–0.6 is the usual range
```

---

## Content Containers

### Blockquote

```yaml
blockquote:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 24px
  typography: "{typography.body-md}"
```

### Callout / aside

```yaml
callout:
  backgroundColor: "{colors.info-soft}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
```

### Code block (prose)

```yaml
code-block:
  backgroundColor: "{colors.surface-raised}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.md}"
  padding: 16px
  typography: "{typography.code-block}"
```

### Inline code

```yaml
code-inline:
  backgroundColor: "{colors.neutral}"
  textColor: "{colors.primary}"
  rounded: "{rounded.sm}"
  padding: 2px
  typography: "{typography.code-inline}"
```

### Keyboard key

```yaml
kbd:
  backgroundColor: "{colors.surface-raised}"
  textColor: "{colors.on-surface}"
  rounded: "{rounded.sm}"
  padding: 2px
  typography: "{typography.code-inline}"
```

### Divider / separator (used via border; no background)

```yaml
divider:
  backgroundColor: "{colors.border}"
  height: 1px
```

---

## Typography Specials

Entries that aren't interactive elements but deserve component treatment
so agents apply them consistently.

### Link

```yaml
link:
  textColor: "{colors.primary}"
  typography: "{typography.body-md}"
link-hover:
  textColor: "{colors.primary-dim}"
link-visited:
  textColor: "{colors.primary}"
```

### Headline emphasis (display treatment)

```yaml
eyebrow:
  textColor: "{colors.on-surface-muted}"
  typography: "{typography.label-caps}"
```

### Metadata timestamp / caption

```yaml
metadata:
  textColor: "{colors.on-surface-muted}"
  typography: "{typography.caption}"
```

---

## State Suffixes Reference

Every component variant uses the spec's related-key convention. The
common suffixes:

| Suffix       | When                                                          |
|--------------|---------------------------------------------------------------|
| `-hover`     | Pointer hover                                                 |
| `-active`    | Pointer-down / press                                          |
| `-focus`     | Keyboard focus                                                |
| `-disabled`  | Inert / greyed out                                            |
| `-error`     | Input in error state                                          |
| `-selected`  | Tab, chip, row selected                                       |
| `-checked`   | Checkbox / radio / toggle checked                             |
| `-expanded`  | Collapsible in open state                                     |
| `-loading`   | Interactive element while async work is in-flight             |

Agents interpret these suffixes as variants of the base component. Only
define the properties that differ from the base — anything unspecified
is inherited.

---

## Size Suffixes Reference

Scale variants live as separate keys:

| Suffix  | Common use                                                  |
|---------|-------------------------------------------------------------|
| `-sm`   | Dense tables, chips, secondary actions                      |
| `-md`   | Default — omit the suffix when this is the canonical size   |
| `-lg`   | Hero CTAs, featured cards                                   |
| `-xl`   | Rare; landing-page heroes, empty-state illustrations        |

Example:

```yaml
button-primary:          # default (md)
  padding: 12px
button-primary-sm:
  padding: 8px
button-primary-lg:
  padding: 16px
```

---

## Quick Reference: Token Names This Library Assumes

The components above reference these tokens. If your palette uses
different names, find-and-replace before using the library.

```yaml
colors:
  primary: "#…"
  primary-dim: "#…"        # hover / active variant of primary
  primary-deep: "#…"       # active / pressed
  on-primary: "#…"         # text color on primary background
  neutral: "#…"            # subdued background for hover / chip fills
  surface: "#…"            # card / panel
  surface-raised: "#…"     # elevated card
  on-surface: "#…"         # default text
  on-surface-muted: "#…"   # secondary text
  error: "#…"
  error-dim: "#…"
  error-soft: "#…"         # tinted alert background
  on-error: "#…"
  warning: "#…"
  warning-soft: "#…"
  on-warning: "#…"
  success: "#…"
  success-soft: "#…"
  on-success: "#…"
  info-soft: "#…"
  border: "#…"
  tertiary: "#…"
  on-tertiary: "#…"

typography:
  label-sm:     { … }
  label-md:     { … }
  label-caps:   { … }
  body-sm:      { … }
  body-md:      { … }
  caption:      { … }
  code-inline:  { … }
  code-block:   { … }

rounded:
  sm: …
  md: …
  lg: …
  full: 9999px
```

Not every design system needs every token. Drop what doesn't fit your
palette; agents gracefully fall back when a reference is missing, but
`broken-ref` is an error, so tighten the references you keep.
