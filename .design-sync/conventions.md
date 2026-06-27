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
