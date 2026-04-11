---
description: Resource-leak bugs found in the comprehensive audit — zombie streams, setInterval memory ratchet, scrypt memory bursts before rate-limiting
type: moc
topics:
  - "[[gaps-and-opportunities]]"
  - "[[architecture-decisions]]"
---

# resource-leaks-debt

Resource-leak patterns identified in the April 2026 comprehensive audit. These bugs share a signature: memory or process state accumulates faster than it releases. Left unpatched they produce gradual OOMs, hanging connections, or burst-OOM-before-ratelimit denial-of-service vectors.

## The Pattern: Accumulation Without Cleanup

```
Request / event
  → allocates scrypt buffer, sets interval, opens Gemini stream
  → handler returns / user closes tab / abort signal fires
  → cleanup path missing or incomplete
  → memory/stream/timer persists
  → N parallel requests compound linearly → OOM or API quota exhaustion
```

## Notes

- [[setinterval-never-cleared-creates-memory-ratchet-in-server-routes]] -- dangling intervals leak memory until OOM crash (cross-listed in security-debt)
- [[genkit-abort-signal-creates-zombie-streams-that-leak-api-quota]] -- unhandled abort = zombie Gemini requests (cross-listed in ai-system-debt)
- [[scrypt-64mb-per-request-enables-oom-dos-before-rate-limiter]] -- 10 concurrent logins = 640MB RSS spike before rate-limiter engages (cross-listed in security-debt)

## Related Debt

- [[security-debt]] -- scrypt burst is the DoS entry, setInterval leak feeds memory exhaustion
- [[ai-system-debt]] -- zombie Gemini streams are a resource-leak side-effect of the broader AI stream-management gap

---

Topics:
- [[gaps-and-opportunities]]
- [[architecture-decisions]]
