---
summary: Vitest 4 changed vi.fn() from vi.fn<[Args], Return>() to vi.fn<() => Return>(), breaking all typed mock factories — fix with vi.fn() as Mock
areas: ["[[index]]"]
created: 2026-03-13
---

Vitest 4's breaking change to `vi.fn()` generic signatures caused widespread test failures in ProtoPulse. The old signature `vi.fn<[string, number], boolean>()` (two type params: args tuple, return type) became `vi.fn<(s: string, n: number) => boolean>()` (single function type param). When mocking React component props that expect specific callback signatures, the pragmatic fix is `vi.fn() as Mock` with `import type { Mock } from 'vitest'` — this preserves access to `.mockResolvedValue`, `.mockReturnValue`, etc. without fighting the type system.

## Topics

- [[index]]
