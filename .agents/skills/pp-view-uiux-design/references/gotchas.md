# UI/UX + DESIGN Gotchas

## Theme

- `DESIGN.md` can change before CSS does. Run `npm run design:check`.
- The token drift gate checks the base `@theme` block, not `.light` runtime overrides.
- Darkening backgrounds can make muted text or borders too low-contrast.
- Primary and accent colors should guide attention, not flood the whole screen.

## Layout

- Top bars multiply quickly. Remove, group, or collapse before adding another bar.
- Scroll problems often come from fixed heights combined with nested overflow.
- Cards inside cards make the interface feel heavy.
- Small-height desktop viewports catch many layout failures.

## Components

- Radix menus and dialogs need portal/focus behavior checked.
- Tooltip-only meaning is weak for important actions.
- Custom scroll areas need browser checks, not just unit tests.

## Verification

- Passing tests do not prove good layout.
- Screenshots are required for real UI/UX confidence.
- Console warnings are defects unless explicitly blocked and documented.
