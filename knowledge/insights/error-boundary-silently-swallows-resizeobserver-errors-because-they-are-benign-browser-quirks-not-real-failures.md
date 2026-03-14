---
summary: The ErrorBoundary deliberately returns { hasError: false } for ResizeObserver loop errors in getDerivedStateFromError, preventing false-positive crash screens from a benign browser timing quirk
category: gotcha
areas: ["[[index]]"]
related insights:
  - "[[errorboundary-suppresses-resizeobserver-loop-errors-by-regex-matching-the-error-message]] — this is the same insight; verify no overlap"
type: insight
source: extraction
created: 2026-03-14
status: active
evidence:
  - errorboundary-suppresses-resizeobserver-loop-errors-by-regex-matching-the-error-message.md
---

The `ErrorBoundary` component (`client/src/components/ErrorBoundary.tsx`) contains a regex check in `getDerivedStateFromError` that matches `ResizeObserver loop (limit exceeded|completed with undelivered notifications)` and returns `{ hasError: false, error: null }` — effectively swallowing the error. The same regex guard in `componentDidCatch` prevents console logging for these errors.

This pattern exists because ResizeObserver loop errors are a browser timing artifact, not a real application failure. They occur when a ResizeObserver callback triggers layout changes that in turn trigger more resize observations within the same animation frame. Chrome and Firefox throttle this cycle and report it as a "loop limit exceeded" error, but it's harmless — the observations are simply deferred to the next frame.

The non-obvious consequence: any real rendering error whose message happens to match this regex pattern will also be silently swallowed. The regex is specific enough that this is unlikely in practice, but it means the ErrorBoundary is not a 100% reliable crash reporter for ResizeObserver-related layout code.

The ErrorBoundary also has three recovery actions: "Try Again" (reset error state), "Clear Cache" (calls `queryClient.clear()` — nuclear option that drops all React Query cache), and "Settings" (programmatically clicks the chat settings button via `document.querySelector('[data-testid="chat-settings-button"]')` — a DOM coupling that will silently fail if the test ID changes).

## Topics

- [[index]]
