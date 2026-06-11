# BOM Templates Gotchas

## Common Risks

- Passing tests do not prove the layout is good.
- A page can be reachable by URL while the rendered view fails to change.
- Fixed heights and nested overflow can create scroll traps.
- Mocked tests can hide runtime warnings.
- View-specific changes can still affect workspace navigation.
- Template apply must not mutate until the template detail endpoint has loaded and the created/skipped item diff is visible.
- Compare template items against the current project stock by `partId`/BOM item `id`; labels and MPNs are display aids, not identity.

## Before Finishing

- Run the nearest tests.
- Run this skill's inspector.
- Check visible UI in a browser when layout changed.
- Update `references/self-improvement-log.md` with durable lessons.
