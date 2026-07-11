# Diagnostics Refactoring Hotspots

## Complexity Summary

| File | CCN | Severity |
|------|-----|----------|
| UnifiedDiagnostics.tsx (total) | 621 | 🔴 EXTREME |
| Line 1545 anonymous | 35 | 🔴 HIGH |
| ReadingIndicator | 25 | 🔴 HIGH |
| Line 1124 anonymous | 23 | 🟡 MODERATE |
| XAxis component | 15 | 🟡 MODERATE |
| PerformanceMetricsPanel.tsx | 9 | ✅ GOOD |

## UnifiedDiagnostics.tsx Analysis

### Current State: ~1800 lines, 621 CCN

The main file contains too many inline components and anonymous functions:

**Inline Components (should be extracted):**
- Oscilloscope (~100 lines)
- HeatMap (~50 lines)
- PowerSystemChart (~150 lines)
- ReadingIndicator (~90 lines)
- ComponentCard (~80 lines)
- TabContent sections (~400 lines)

**Anonymous Functions (should be named):**
- Line 1545: Tab content renderer (35 CCN)
- Line 1124: Chart axis generator (23 CCN)
- Various event handlers

## Decomposition Plan

### Phase 1: Extract Visualization Components

**Oscilloscope.tsx** (~15 CCN)
```typescript
// Extract canvas-based waveform display
export const Oscilloscope: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  label?: string;
  color?: string;
}> = memo(({ ... }) => { ... });
```

**ThermalHeatMap.tsx** (~10 CCN)
```typescript
// Extract temperature grid display
export const ThermalHeatMap: React.FC<{
  components: ComponentTemp[];
}> = memo(({ ... }) => { ... });
```

**PowerSystemChart.tsx** (~20 CCN)
```typescript
// Extract dual-axis SVG chart
export const PowerSystemChart: React.FC<{
  history: PowerHistoryPoint[];
  events?: ChartEvent[];
}> = memo(({ ... }) => { ... });
```

### Phase 2: Extract Tab Content

**OverviewTab.tsx** (~25 CCN)
```typescript
export const OverviewTab: React.FC<{
  systemStatus: SystemStatus;
  components: ComponentStatus[];
}> = ({ ... }) => { ... };
```

**TelemetryTab.tsx** (~20 CCN)
```typescript
export const TelemetryTab: React.FC<{
  history: TelemetryHistory;
  oscilloscopeData: number[];
}> = ({ ... }) => { ... };
```

**LogsTab.tsx** (~15 CCN)
```typescript
export const LogsTab: React.FC<{
  logs: LogEntry[];
  onFilter: (filter: LogFilter) => void;
}> = ({ ... }) => { ... };
```

**DevicesTab.tsx** (~20 CCN)
```typescript
export const DevicesTab: React.FC<{
  components: ComponentStatus[];
  onRunTest: (id: string, type: TestType) => void;
}> = ({ ... }) => { ... };
```

### Phase 3: Extract Helper Components

**ComponentCard.tsx** (~12 CCN)
```typescript
export const ComponentCard: React.FC<{
  component: ComponentStatus;
  onViewLogs: () => void;
  onRunTest: () => void;
}> = ({ ... }) => { ... };
```

**ReadingIndicator.tsx** (~15 CCN)
```typescript
export const ReadingIndicator: React.FC<{
  label: string;
  value: number;
  unit: string;
  thresholds: { warning: number; critical: number };
}> = ({ ... }) => { ... };
```

**SystemHealthSummary.tsx** (~10 CCN)
```typescript
export const SystemHealthSummary: React.FC<{
  status: SystemStatus;
}> = ({ ... }) => { ... };
```

### Phase 4: Extract Hooks

**useDiagnosticTabs.ts** (~8 CCN)
```typescript
export function useDiagnosticTabs() {
  const [activeTab, setActiveTab] = useState<DiagnosticTab>('overview');
  // Tab switching logic
  return { activeTab, setActiveTab, tabContent };
}
```

**useOscilloscopeData.ts** (~10 CCN)
```typescript
export function useOscilloscopeData(source: TelemetrySource) {
  // Data buffering for oscilloscope
  return { data, push, clear };
}
```

### Expected Structure After Refactoring

```
components/UnifiedDiagnostics/
├── index.tsx                    # Main orchestrator (~150 lines, ~20 CCN)
├── types.ts                     # Type definitions
├── tabs/
│   ├── OverviewTab.tsx          (~25 CCN)
│   ├── TelemetryTab.tsx         (~20 CCN)
│   ├── LogsTab.tsx              (~15 CCN)
│   └── DevicesTab.tsx           (~20 CCN)
├── visualizations/
│   ├── Oscilloscope.tsx         (~15 CCN)
│   ├── ThermalHeatMap.tsx       (~10 CCN)
│   └── PowerSystemChart.tsx     (~20 CCN)
├── components/
│   ├── ComponentCard.tsx        (~12 CCN)
│   ├── ReadingIndicator.tsx     (~15 CCN)
│   ├── SystemHealthSummary.tsx  (~10 CCN)
│   └── DiagnosticHeader.tsx     (~8 CCN)
├── hooks/
│   ├── useDiagnosticTabs.ts     (~8 CCN)
│   ├── useOscilloscopeData.ts   (~10 CCN)
│   └── useDiagnosticLogs.ts     (existing)
└── utils/
    └── logHelpers.ts            (existing)
```

## Expected Complexity Reduction

| Component | Before | After |
|-----------|--------|-------|
| UnifiedDiagnostics.tsx | 621 | ~20 (orchestrator) |
| Visualization components | - | ~45 total |
| Tab components | - | ~80 total |
| Helper components | - | ~45 total |
| Hooks | - | ~28 total |
| **Total** | 621 | ~218 |

**Reduction: ~65%**

## Migration Strategy

1. **Week 1**: Extract visualization components (Oscilloscope, HeatMap, PowerChart)
2. **Week 2**: Extract tab content into separate components
3. **Week 3**: Extract helper components (ComponentCard, ReadingIndicator)
4. **Week 4**: Extract custom hooks
5. **Week 5**: Simplify main UnifiedDiagnostics.tsx to orchestrator

## Testing Requirements

### Before Extraction
- Capture screenshots of all tabs
- Document all interactive behaviors
- Create integration tests for data flow

### After Extraction
- Unit tests for each extracted component
- Props interface validation
- Visual regression tests
- Performance benchmarks for canvas rendering

## Priority Sequence

1. **Oscilloscope** - Isolated canvas component, easy win
2. **Tab Content** - Large complexity reduction, clear boundaries
3. **ReadingIndicator** - Used in multiple places, high reuse value
4. **PowerSystemChart** - Complex SVG, needs careful testing
5. **Main File Cleanup** - Final orchestrator simplification
