# Left Sidebar Gotchas

## Sizing

- Fixed heights can break short screens. Prefer bounded flex areas with internal scrolling.
- Settings panels should not push navigation out of reach.
- Menus that work on tall desktop can still fail on laptop-height viewports.

## Navigation

- Sidebar navigation constants can affect routing and active labels.
- URL changes without page changes usually mean view routing and state sync need checked together.
- Mobile navigation may need a separate check even if desktop sidebar looks fine.

## Testing

- Sidebar changes often need both component tests and browser screenshots.
- Do not ignore warning output from mock components.
- Check focus order when changing menus or icon buttons.
