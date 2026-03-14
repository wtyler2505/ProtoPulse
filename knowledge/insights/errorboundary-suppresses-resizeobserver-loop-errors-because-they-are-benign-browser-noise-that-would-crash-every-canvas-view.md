---
summary: The ErrorBoundary explicitly filters out ResizeObserver loop errors in getDerivedStateFromError, preventing false crash screens on the Architecture, Schematic, and PCB canvas views
category: gotcha
areas: ["[[gotchas]]", "[[architecture]]"]
wave: "extraction"
---

# ErrorBoundary suppresses ResizeObserver loop errors because they are benign browser noise that would crash every canvas view

In `client/src/components/ErrorBoundary.tsx` (line 22-24), `getDerivedStateFromError` checks for the pattern `ResizeObserver loop (limit exceeded|completed with undelivered notifications)` and returns `{ hasError: false }` — effectively swallowing the error.

This is not a hack — it's a necessary defense against a known browser behavior:
- ResizeObserver fires a "loop limit exceeded" error when an observer callback causes a layout change that triggers another observation in the same frame. This is extremely common in canvas-based views (Architecture uses @xyflow/react, Schematic/PCB use SVG with dynamic sizing).
- The error is **benign**: the observer simply skips that cycle and retries next frame. No data is lost, no layout is broken.
- But React's error boundary mechanism treats any thrown error as a crash. Without this filter, every time a user resizes their browser window while viewing Architecture/Schematic/PCB, the view would show the crash fallback UI.

The same filter exists in `componentDidCatch` (line 29) to prevent console spam.

This is a well-known React + ResizeObserver interop issue. The alternative solutions (wrapping ResizeObserver globally, or using a custom error event handler) are more invasive. The ErrorBoundary filter is surgical and only affects the crash decision.

Every view in ProjectWorkspace is wrapped in its own `<ErrorBoundary>` (28 instances), so this filter applies to all views. A crash in one view shows the retry UI only for that view, not the entire app.

---

Related:
- [[the-perception-gap-between-simulation-capability-and-usability-is-the-biggest-competitive-threat]] — false crash screens would devastate perceived reliability

Areas:
- [[gotchas]]
- [[architecture]]
