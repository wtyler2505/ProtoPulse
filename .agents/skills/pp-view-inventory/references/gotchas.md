# Inventory Gotchas

## Common Risks

- Passing tests do not prove the layout is good.
- A page can be reachable by URL while the rendered view fails to change.
- Fixed heights and nested overflow can create scroll traps.
- Mocked tests can hide runtime warnings.
- View-specific changes can still affect workspace navigation.
- The Inventory Confidence Gate treats missing inventory lines as a hard blocker, but estimated quantities and BOM shortfalls are warning-only review states.
- Label printing is gated by hard blockers; warning-only review states should keep the action reachable.

## Before Finishing

- Run the nearest tests.
- Run this skill's inspector.
- Check visible UI in a browser when layout changed.
- Update `references/self-improvement-log.md` with durable lessons.
