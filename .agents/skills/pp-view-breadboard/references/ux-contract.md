# Breadboard UX Contract

The Breadboard page should feel like a usable electronics workbench, not a pile of icons.

## Page Priorities

1. The user can tell how to start within seconds.
2. Starter parts, project-linked parts, stash parts, and exact parts are clearly different.
3. Board health is visible, useful, and not noisy.
4. The selected part inspector helps the user decide what to do next.
5. Hardware inspection is reachable without hunting.
6. The page stays connected to schematic, inventory, validation, and AI workflows.

## Layout Rules

- Keep primary actions close to the work surface.
- Do not crowd the top bars with every possible action.
- Put secondary actions in menus or panels that scroll when content grows.
- Keep buttons stable in size. Hover states should not shift the layout.
- Keep text short inside compact controls.
- Use icons when the meaning is familiar, but use labels for important or unclear actions.
- Do not let panels take over the whole page unless the user intentionally opens them.

## Beginner Rules

- Empty state should offer a real next step, not just an explanation.
- Drag/drop, add part, inspect, and wire flows should be obvious.
- Dangerous or uncertain data should be visibly marked.
- AI output should never look more trusted than verified data.

## Density Rules

- Breadboard can be dense, but it should not be loud.
- Toolbars should prefer grouped actions over repeated one-off buttons.
- If a menu has many actions, it must scroll.
- If a panel has repeated controls, use spacing and section labels so scanning is easy.

## Regression Watch

- Do not recreate the old problem where settings or lower panels eat too much of a sidebar.
- Do not make the Breadboard page depend on a huge fixed viewport height.
- Do not hide the hardware inspection feature behind unclear names.
- Do not add more icons unless they reduce confusion.
