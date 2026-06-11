# Digital Twin Gotchas

## Common Risks

- Passing tests do not prove the layout is good.
- A page can be reachable by URL while the rendered view fails to change.
- Fixed heights and nested overflow can create scroll traps.
- Mocked tests can hide runtime warnings.
- View-specific changes can still affect workspace navigation.
- Digital Twin live-state previews must not imply physical certainty when the manifest is missing, channels are stale, or no sim comparison exists.
- The 3D bridge payload is a handoff context, not canonical telemetry storage.

## Before Finishing

- Run the nearest tests.
- Run this skill's inspector.
- Check visible UI in a browser when layout changed.
- Update `references/self-improvement-log.md` with durable lessons.
