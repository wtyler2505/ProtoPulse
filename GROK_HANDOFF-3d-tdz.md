## Lane Reservation
- Active channels: GROK_HANDOFF-3d-tdz.md
- Claimed files: ["client/src/components/views/BoardViewer3DView.tsx"]
- Forbidden files: []
- Round type: debug + minimal surgical fix
- Agent cap status: 1/6 (this Codex peer)
- Target: Unblock the 3D Wiring Guides view (the entire "ALL IN on 3D" campaign is dead right now)

## Crash (user just reproduced after clean `npm run dev`)

**ReferenceError: Cannot access 'wiringGuideMode' before initialization**

```
at BoardViewer3DView (BoardViewer3DView.tsx:700:37)
...
ErrorBoundary caught: Cannot access 'wiringGuideMode' before initialization
    at BoardViewer3DView (BoardViewer3DView.tsx:692:7)
```

The entire 3D view (BoardViewer3DView) now fails to mount. The lazy chunk loads but the component throws on first render. User sees the ErrorBoundary instead of the beautiful 3D board + R3F ratsnest/airwires we have been building for days.

## Root Cause (diagnosed)

During the "resume" performance pass, the expensive IIFE that built the R3F airwire elements was extracted into a `useMemo` called `airwireElements`.

That useMemo (and its callback) was inserted in source order **before** the `useState` declarations for the wiring guide UI state:

```tsx
// airwireElements useMemo is here (early, ~line 559-700)
const airwireElements = useMemo(() => {
  ...
  if (wiringGuideMode === 'chain') ...
  ...
}, [..., wiringGuideMode, showAirwires]);   // <-- references the state vars
```

The actual declarations are much later (~881-883):

```tsx
const [showWiringGuides, setShowWiringGuides] = useState(true);
const [showAirwires, setShowAirwires] = useState(true);
const [wiringGuideMode, setWiringGuideMode] = useState<'chain' | 'mesh' | 'star'>('chain');
```

Because `const` has Temporal Dead Zone (TDZ), any reference to `wiringGuideMode` (or `showAirwires`) during the evaluation of the earlier useMemo throws on every render.

This is a pure ordering bug introduced while extracting the IIFE for perf (to kill the 600ms+ RAF violations the user originally reported).

## Task for Codex (you)

1. Read `client/src/components/views/BoardViewer3DView.tsx` (it is ~1408 LOC).
2. Confirm the exact locations of:
   - The `airwireElements` useMemo (the one with `wiringGuideMode` in its deps and body).
   - The three `useState` lines for the wiring panel.
   - Any other early hooks that close over or list those three state variables.
3. Produce the **minimal, safe reorder**:
   - Move the three wiring-guide `useState` calls as early as possible in the component (right after the first batch of `useState`/`useContext` that have no dependency on them).
   - Keep **all** hook call order identical on every render (no new hooks before existing ones, no conditional hooks).
   - The `airwireElements` useMemo and its logic can stay where they are.
4. Make the smallest possible diff.
5. Write `TEAM_DONE-3d-tdz.md` (or update this handoff) with the standard convergence block:

```
---
ROUND_STATUS: fixed
OPEN_CRITIQUES: none
SIGNOFF: Codex
OWNERSHIP: Grok (apply + restart dev server + pp-view-3d self-improvement-log)
NEXT_ROUND: verify 3D view boots + airwires render + no new TDZ
---
```

Make your reasoning, file reads, and the edit visible in the TUI so the main Grok session can watch live.

This is blocking the entire 3D wiring guides effort the user has been screaming "LETS GO ALL IN" on. Get the view loading again with the performance win and net-aware guides still intact.

You have workspace-write on the claimed file. Work carefully — we are under the strict pp-view-3d skill contract (inspector already run, log must be appended after the fix).