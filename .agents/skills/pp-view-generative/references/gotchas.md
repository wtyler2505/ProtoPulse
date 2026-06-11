# Generative Gotchas

## Common Risks

- Passing tests do not prove the layout is good.
- A page can be reachable by URL while the rendered view fails to change.
- Fixed heights and nested overflow can create scroll traps.
- Mocked tests can hide runtime warnings.
- View-specific changes can still affect workspace navigation.
- Generative candidates must leave the source view as unverified `ai-generated` context. The 3D bridge should mark `readyNow: false` and preserve candidate id, first refdes, component count, and `generatedFrom`.

## Before Finishing

- Run the nearest tests.
- Run this skill's inspector.
- Check visible UI in a browser when layout changed.
- Update `references/self-improvement-log.md` with durable lessons.
