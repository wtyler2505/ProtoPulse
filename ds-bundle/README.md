# ProtoPulse (rest-express@1.0.0)

This design system is the published rest-express React library, bundled as a single
browser global. All 81 components are the real upstream code.

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

356 CSS custom properties from rest-express. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (199): `--color-red-50`, `--color-red-200`, `--color-red-300`, …
- **spacing** (9): `--spacing-card-padding-sm`, `--spacing-card-padding-md`, `--spacing-card-padding-lg`, …
- **typography** (22): `--font-sans`, `--font-serif`, `--font-mono`, …
- **radius** (6): `--radius-sm`, `--radius-md`, `--radius-lg`, …
- **shadow** (9): `--shadow-xs`, `--drop-shadow-md`, `--tw-shadow-alpha`, …
- **other** (111): `--spacing`, `--breakpoint-xl`, `--container-xs`, …

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
- `CalcApplyButtons`
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
- `LifecycleBadge`
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
- `VaultExplainer`
- `VaultHoverCard`
- `VaultInfoIcon`
- `ViewOnboardingHint`
