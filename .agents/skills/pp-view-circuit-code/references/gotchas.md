# Circuit Code Gotchas

## Common Risks

- Passing tests do not prove the layout is good.
- A page can be reachable by URL while the rendered view fails to change.
- Fixed heights and nested overflow can create scroll traps.
- Mocked tests can hide runtime warnings.
- View-specific changes can still affect workspace navigation.
- Circuit Code apply creates real canonical circuit data. Do not post to `/circuits/apply-code` until the consequence preview is visible and explicitly confirmed.
- Source trust must remain visible near the code/apply path; this is a generated-code surface even when the current source is local editor text.

## Before Finishing

- Run the nearest tests.
- Run this skill's inspector.
- Check visible UI in a browser when layout changed.
- Update `references/self-improvement-log.md` with durable lessons.
