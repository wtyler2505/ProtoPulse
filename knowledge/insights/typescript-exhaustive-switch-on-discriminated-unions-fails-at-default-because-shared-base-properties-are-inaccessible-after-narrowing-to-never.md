---
summary: TypeScript exhaustive switch on discriminated unions narrows the default case to never, making shared base properties inaccessible — extract base properties before the switch
areas: ["[[index]]"]
created: 2026-03-13
---

When switching exhaustively on a discriminated union's tag, TypeScript narrows the variable to `never` in the `default` case. This is intentional — it catches unhandled variants at compile time. But it also means any shared base properties (like `x`, `y`, `width`, `height` from a `BaseShape` interface) become inaccessible in the default case. ProtoPulse's `ShapeCanvas.tsx` hit this: all `Shape` variants extend `BaseShape`, but accessing `shape.x` in the default case failed because `shape` was narrowed to `never`. The fix is to extract all shared base properties into local variables *before* the switch statement, so they're available in every branch including default.

## Topics

- [[index]]
