# Left Sidebar UX Contract

The left sidebar should make the app easier to use, not smaller and louder.

## Must Hold True

- Project settings must not take over the bottom half of the sidebar.
- Navigation labels should be easy to scan.
- Icon-only controls need a clear reason and a tooltip.
- More menus and flyouts must scroll when content is taller than the viewport.
- Collapsed state must still be understandable.
- The sidebar must not cover main work without a clear way back.

## Layout Rules

- Keep settings compact.
- Prefer one clear active state over multiple competing highlights.
- Keep panel heights bounded.
- Use internal scrolling for long panel content.
- Do not put cards inside cards.
- Avoid adding another top bar unless it removes more clutter than it adds.

## Regression Watch

- The project settings box previously felt too large. Check this after every sidebar pass.
- The app has felt too loud from too many icons and bars. Remove or group controls before adding more.
- Small-height screens reveal sidebar problems faster than wide desktop screenshots.
