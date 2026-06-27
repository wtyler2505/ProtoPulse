# ProtoPulse design system — how to build with it

These are real, compiled React components from the ProtoPulse app (a browser-based
EDA / hardware-prototyping platform). Style them with **Tailwind v4 utility classes**
bound to **semantic CSS-variable tokens** — never hardcode hex/rgb.

## Setup — dark-first, no provider needed
The system is **dark by default** (cyberpunk palette; `--color-background` is near-black).
Components have transparent/foreground-colored styling, so they are invisible on a white
page. **Always render inside a `bg-background text-foreground` root**, e.g.:

```jsx
<div className="bg-background text-foreground font-sans min-h-screen p-6">
  <Button>Run Simulation</Button>
  <Badge variant="outline">SMD 0603</Badge>
</div>
```

No ThemeProvider is required for dark. (A light theme exists via a `.light` class on a
parent, but dark is the canonical brand surface — build dark unless asked otherwise.)
Corners are **sharp** (`--radius* = 0`); do not add `rounded-*` expecting curves.

## Styling idiom — semantic token utilities (use these names verbatim)
| Purpose | Utility classes |
|---|---|
| Surfaces | `bg-background`, `bg-card`, `bg-popover`, `bg-muted`, `bg-sidebar` |
| Text | `text-foreground`, `text-muted-foreground`, `text-card-foreground` |
| Interactive emphasis | `bg-primary text-primary-foreground` (cyan), `bg-secondary text-secondary-foreground` (violet), `bg-accent` |
| Status | `bg-destructive`/`text-destructive` (red), `text-success` (green), `text-warning` (amber), `text-info` (blue) |
| Borders / inputs | `border-border`, `border-input`, `ring-ring`, `ring-focus-ring` |
| Brand identity | `text-brand`/`bg-brand` (the ProtoPulse cyan wordmark color — NOT for hover/active state; that's `primary`) |
| **EDA semantics** | `text-power`/`bg-power` (amber — VCC/power rails), `text-signal` (bright cyan — GPIO/digital traces), `text-data` (violet — data/bus) |
| Type | `font-sans` (Inter, body), `font-display` (Rajdhani, headings), `font-mono` (JetBrains Mono, code/SPICE) |

Component variants are props, not classes: `<Button variant="default|secondary|destructive|outline|ghost|link" size="default|sm|lg|icon">`, `<Badge variant="default|secondary|destructive|outline">`, `<Alert variant="default|destructive">`. Read each component's `.d.ts` for its full prop API and `.prompt.md` for usage.

## Where the truth lives
- `styles.css` (and its `@import` closure: brand fonts + `_ds_bundle.css`) — the full token + component stylesheet. Read it before inventing any class.
- Per component: `<Name>.d.ts` (prop contract) and `<Name>.prompt.md` (usage + examples).

## Idiomatic example
```jsx
<div className="bg-background text-foreground font-sans p-6 space-y-4">
  <h2 className="font-display text-2xl">Bill of Materials</h2>
  <Card>
    <CardHeader>
      <CardTitle>ATmega328P-PU</CardTitle>
      <CardDescription>8-bit AVR · 28-pin DIP</CardDescription>
    </CardHeader>
    <CardContent className="flex gap-2">
      <Badge>In stock</Badge>
      <Badge variant="outline">5V</Badge>
      <Badge className="text-power border-power">VCC</Badge>
    </CardContent>
  </Card>
</div>
```

# ProtoPulse (rest-express@1.0.0)

This design system is the published rest-express React library, bundled as a single
browser global. All 76 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.ProtoPulse`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.ProtoPulse.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { Accordion } = window.ProtoPulse;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<Accordion />);
```

Wrap the tree in the provider — most components read theme/i18n from context:

```jsx
<TooltipProvider><ToastProvider>{children}</ToastProvider></TooltipProvider>
```

## Tokens

359 CSS custom properties from rest-express. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (199): `--color-red-50`, `--color-red-200`, `--color-red-300`, …
- **spacing** (9): `--spacing-card-padding-sm`, `--spacing-card-padding-md`, `--spacing-card-padding-lg`, …
- **typography** (22): `--font-sans`, `--font-serif`, `--font-mono`, …
- **radius** (6): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (9): `--shadow-xs`, `--drop-shadow-md`, `--tw-shadow-alpha`, …
- **other** (114): `--spacing`, `--breakpoint-xl`, `--container-xs`, …

## Components

### general
- `Accordion`
- `AddToBomPrompt`
- `Alert`
- `AlertDialog`
- `AspectRatio`
- `Avatar`
- `Badge`
- `Breadcrumb`
- `Button`
- `ButtonGroup`
- `Calendar`
- `Card`
- `Carousel`
- `ChartContainer`
- `Checkbox`
- `Collapsible`
- `Command`
- `ConfidenceBadge`
- `ConfirmDialog`
- `ContextMenu`
- `Dialog`
- `Drawer`
- `DropdownMenu`
- `EmbedDialog`
- `Empty`
- `EmptyState`
- `FeatureMaturityBadge`
- `Field`
- `Form`
- `HoverCard`
- `Input`
- `InputGroup`
- `InputOTP`
- `InteractiveCard`
- `Item`
- `Kbd`
- `Label`
- `LessonModeOverlay`
- `LibrarySuggestPopover`
- `MentionBadge`
- `Menubar`
- `NavigationMenu`
- `NumberInput`
- `Pagination`
- `PanelSkeleton`
- `Popover`
- `PredictionCard`
- `PredictionPanel`
- `Progress`
- `ProjectLoadingSkeleton`
- `RadialMenu`
- `RadioGroup`
- `ReleaseConfidenceCard`
- `ResizablePanelGroup`
- `RolePresetSelector`
- `ScrollArea`
- `Select`
- `Separator`
- `Sheet`
- `Sidebar`
- `Skeleton`
- `Slider`
- `SmartHintToast`
- `Spinner`
- `StyledTooltip`
- `Switch`
- `Table`
- `Tabs`
- `Textarea`
- `Toast`
- `Toaster`
- `Toggle`
- `ToggleGroup`
- `Tooltip`
- `TrustReceiptCard`
- `ViewOnboardingHint`
