---
summary: Web Serial API mocking in tests requires double-cast (as unknown as MockSerialPort) because the SerialPort class is file-scoped and not importable
areas: ["[[index]]"]
related insights:
  - "[[proxy-based-mock-chains-intercept-then-causing-await-to-hang-so-drizzle-query-mocks-need-explicit-select-chain-stubs]] — another mock pattern requiring type workarounds"
  - "[[vitest-4-changed-vi-fn-generic-signature-from-two-type-params-to-one-function-type-param-breaking-typed-mock-factories]] — all three form a cluster of TypeScript test typing workarounds"
created: 2026-03-13
---

ProtoPulse's `web-serial.ts` uses the browser's Web Serial API, where `SerialPort` is a file-scoped global type not available as an importable class. Tests need to mock `navigator.serial` and the ports it returns, but TypeScript won't allow direct casting from a mock object to `SerialPort` because the types are structurally incompatible (the real `SerialPort` has readonly properties, event handlers, and native methods). The solution is a local `MockSerialPort` interface in the test file that matches only the properties under test, then double-casting: `mockPort as unknown as MockSerialPort`. Similarly, deleting `navigator.serial` for cleanup requires `(navigator as unknown as Record<string, unknown>)` because `navigator` properties are typed as non-optional.

## Topics

- [[index]]
