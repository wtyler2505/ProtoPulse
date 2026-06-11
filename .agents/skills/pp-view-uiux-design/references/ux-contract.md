# UI/UX + DESIGN UX Contract

ProtoPulse should feel like a focused engineering tool.

## Visual Direction

- Quiet, useful, and hardware-workbench focused.
- Dark theme with clear contrast.
- Primary cyan and secondary purple should be accents, not wallpaper.
- Do not turn the app into a one-color theme.
- Avoid decorative blobs, orbs, and empty visual noise.

## Interaction Rules

- Use clear labels when an icon is not obvious.
- Group secondary actions instead of spreading icons across multiple bars.
- Menus with many items must scroll.
- Text must fit inside buttons and panels.
- Focus states must be visible.
- Hover states must not shift layout.

## Layout Rules

- Page sections should not be nested cards.
- Tool surfaces can be framed, but full pages should breathe.
- Dense does not mean cramped.
- Responsive layout must work on laptop-height screens, not only large desktop.

## Regression Watch

- Too many upper bars made the app feel loud.
- Sidebar settings got too large.
- Some pages had scroll traps.
- White-screen reloads and Vite cache failures should not be confused with UI regressions.
