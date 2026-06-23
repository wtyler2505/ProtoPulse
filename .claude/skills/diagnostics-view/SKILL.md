---
name: diagnostics-view
description: |
  System Diagnostics page - logs, performance metrics, WebSocket status, thermal heatmaps, 
  oscilloscopes, troubleshooting guides, component health monitoring. 621 CCN total complexity.
  Use when working on diagnostic panels, system health visualization, log filtering, test execution,
  or fault management.
  Triggers on "diagnostics", "system logs", "performance metrics", "troubleshoot", "WebSocket status",
  "thermal", "oscilloscope", "heatmap", "fault", "test execution", "IndexedDB", "24h history".
version: 1.1.0
auto-trigger-paths:
  - components/UnifiedDiagnostics.tsx
  - components/UnifiedDiagnostics/**
  - contexts/DiagnosticContext.tsx
  - hooks/useDiagnostic*
  - services/diagnosticStorageService.ts
---

# System Diagnostics View

## Quick Reference

| Item | Value |
|------|-------|
| Main Component | `components/UnifiedDiagnostics.tsx` (~1800 lines) |
| State Context | `contexts/DiagnosticContext.tsx` (1052 lines) |
| Storage Service | `services/diagnosticStorageService.ts` (IndexedDB) |
| Sub-Components | `components/UnifiedDiagnostics/` (15 files) |
| Keyboard Shortcut | `D` |
| Total Complexity | 621 CCN |

## When to Use This Skill

- Adding new diagnostic panels or visualizations
- Working on log filtering and display
- Implementing test execution features
- Modifying fault detection or simulation
- Adding new telemetry visualizations
- Working on IndexedDB persistence (24h history)

## When NOT to Use This Skill

| Instead of... | Use this skill... |
|--------------|-------------------|
| Telemetry charting | `telemetry-view` |
| WebSocket protocol | `websocket-patterns` |
| Safety thresholds | `safety-systems` |
| General UI styling | `frontend-patterns` |

## Visual Reference

Screenshot: `screenshots/diagnostics-overview.png`
- System health summary bar
- Tab navigation (Overview, Telemetry, Logs, Devices)
- Component status cards with VIEW LOGS
- Thermal heatmap and power chart

## Common Tasks

### Add new diagnostic panel
**File:** `components/UnifiedDiagnostics/`
```typescript
export const MyPanel: React.FC<{ data: MyData }> = ({ data }) => (
  <div className="p-4 rounded-lg border border-[var(--border-color)]">
    <h3 className="text-sm font-bold uppercase tracking-wider mb-3">PANEL TITLE</h3>
    {/* content */}
  </div>
);
```

### Add new test type
**File:** `contexts/DiagnosticContext.tsx`
```typescript
type TestType = '...' | 'my_new_test';
// Add handler in runTest function
```

### Add new fault type
**File:** `components/UnifiedDiagnostics/types.ts`
```typescript
type FaultType = '...' | 'my_new_fault';
```

### Export diagnostics to file
```typescript
await diagnosticStorageService.downloadDiagnostics({ format: 'json' });
```

## Troubleshooting

### Canvas oscilloscope not rendering
**Cause:** Canvas context not available or data array empty
**Fix:** Check `canvasRef.current` and verify data has >1 points

### IndexedDB quota exceeded
**Cause:** 24h buffer grew too large
**Fix:** `diagnosticStorageService` auto-cleans, but check storage quota

### Test execution hangs
**Cause:** Promise not resolving or async error
**Fix:** Check `runTest()` implementation, add timeout handling

### Faults not clearing
**Cause:** Simulated faults mixed with real faults
**Fix:** Check `faultSimulationEnabled` state, use `clearSimulatedFaults()`

### Log filter not updating
**Cause:** Filter state not triggering re-render
**Fix:** Verify `useMemo` dependencies in `useDiagnosticLogs`

## Complexity Hotspots

| File | CCN | Action Required |
|------|-----|-----------------| 
| UnifiedDiagnostics.tsx | 621 | 🔴 EXTREME: Extract 10+ components |
| Line 1545 anonymous | 35 | 🔴 HIGH: Extract tab renderer |
| ReadingIndicator | 25 | 🔴 HIGH: Extract to file |
| Line 1124 anonymous | 23 | 🟡 Extract axis generator |
| PerformanceMetricsPanel | 9 | ✅ GOOD |

See `./references/05-refactoring-hotspots.md` for 65% complexity reduction plan.

## Gotchas & Warnings

1. **1800-line main file** - Most content should be in subdirectory
2. **Canvas redraws every update** - Throttle for high-frequency data
3. **IndexedDB async** - All storage operations return Promises
4. **Simulation mode** - Check `telemetrySource` before trusting data
5. **Test auto-creates faults** - Failed tests add to `activeFaults`
6. **Temperature thresholds** - <50 green, >50 yellow, >70 amber, >80 red+pulse

## Reference Files

| File | Contents |
|------|----------|
| `./references/01-component-architecture.md` | File map, hierarchy, state flow |
| `./references/02-types-and-patterns.md` | LogEntry, FaultRecord, thresholds |
| `./references/03-code-snippets.md` | Oscilloscope, HeatMap, IndexedDB |
| `./references/04-diagnostic-context.md` | Full DiagnosticContext API |
| `./references/05-refactoring-hotspots.md` | Decomposition plan, 65% reduction |

## Related Skills

- `telemetry-view` - Related chart patterns
- `websocket-patterns` - Real-time data handling
- `safety-systems` - Hardware threshold monitoring
- `frontend-patterns` - Cyberpunk styling

## Last Synced

Date: 2025-12-13
