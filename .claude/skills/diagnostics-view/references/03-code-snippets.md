# Diagnostics Code Snippets

## Import Pattern

```typescript
import { useDiagnostic, DiagnosticProvider } from '../contexts/DiagnosticContext';
import {
  LogEntry,
  PerformanceMetrics,
  DiagnosticSnapshot,
  TroubleshootingGuide,
} from './UnifiedDiagnostics/types';
import { diagnosticStorageService } from '../services/diagnosticStorageService';
```

## Canvas-based Oscilloscope

```typescript
const Oscilloscope: React.FC<{
  data: number[];
  width?: number;
  height?: number;
  label?: string;
  color?: string;
}> = memo(({ data, width = 600, height = 150, label = 'Signal', color = '#29ffc6' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, width, height);

    // Draw grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (width / 10) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw waveform with glow
    if (data.length > 1) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 5;
      ctx.shadowColor = color;
      ctx.beginPath();

      const min = Math.min(...data);
      const max = Math.max(...data);
      const range = max - min || 1;

      data.forEach((value, i) => {
        const x = (width / (data.length - 1)) * i;
        const y = height - ((value - min) / range) * (height - 20) - 10;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    // Draw label
    ctx.shadowBlur = 0;
    ctx.fillStyle = color;
    ctx.font = '12px monospace';
    ctx.fillText(label, 10, 20);
  }, [data, width, height, color, label]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="rounded border border-[var(--border-color)]"
    />
  );
});
```

## Thermal HeatMap

```typescript
const HeatMap: React.FC<{ 
  components: { id: string; temp: number; label: string }[] 
}> = memo(({ components }) => {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      {components.map(c => {
        let bgClass = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
        if (c.temp > 80) {
          bgClass = 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse';
        } else if (c.temp > 70) {
          bgClass = 'bg-amber-500/20 border-amber-500/50 text-amber-400';
        } else if (c.temp > 50) {
          bgClass = 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
        }

        return (
          <div
            key={c.id}
            className={`p-3 rounded border ${bgClass} transition-colors`}
          >
            <div className="text-xs opacity-60 uppercase">{c.label}</div>
            <div className="text-xl font-mono">{c.temp.toFixed(1)}°C</div>
          </div>
        );
      })}
    </div>
  );
});
```

## SVG Power Chart with Dual Y-Axes

```typescript
const PowerSystemChart: React.FC<{
  history: PowerHistoryPoint[];
  events?: ChartEvent[];
}> = memo(({ history, events = [] }) => {
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 60, bottom: 30, left: 60 };

  const xRange = [padding.left, width - padding.right];
  const yRange = [height - padding.bottom, padding.top];

  const scale = (value: number, domain: [number, number], range: [number, number]) => {
    const [d0, d1] = domain;
    const [r0, r1] = range;
    return r0 + ((value - d0) / (d1 - d0)) * (r1 - r0);
  };

  const createPath = (dataField: 'voltage' | 'current') => {
    const domain: [number, number] = dataField === 'voltage' ? [32, 42] : [0, 20];
    return history.map((p, i) => {
      const x = scale(i, [0, history.length - 1], xRange);
      const y = scale(p[dataField], domain, yRange);
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
  };

  return (
    <svg width={width} height={height} className="bg-black/20 rounded">
      {/* Voltage line (cyan) */}
      <path
        d={createPath('voltage')}
        fill="none"
        stroke="var(--primary-color)"
        strokeWidth="2"
      />
      {/* Current line (amber) */}
      <path
        d={createPath('current')}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
      />
      {/* Left Y-axis label (Voltage) */}
      <text x={10} y={height / 2} fill="var(--primary-color)" fontSize="12" textAnchor="middle" transform={`rotate(-90, 10, ${height / 2})`}>
        Voltage (V)
      </text>
      {/* Right Y-axis label (Current) */}
      <text x={width - 10} y={height / 2} fill="#f59e0b" fontSize="12" textAnchor="middle" transform={`rotate(90, ${width - 10}, ${height / 2})`}>
        Current (A)
      </text>
    </svg>
  );
});
```

## IndexedDB Persistence

```typescript
// Initialize database
await diagnosticStorageService.initDB();

// Store telemetry snapshot
const snapshot: TelemetrySnapshot = {
  id: crypto.randomUUID(),
  timestamp: Date.now(),
  systemStatus: currentStatus,
  metrics: performanceMetrics,
};
await diagnosticStorageService.storeTelemetrySnapshot(snapshot);

// Retrieve 24h history
const history = await diagnosticStorageService.getTelemetryHistory({
  startTime: Date.now() - 24 * 60 * 60 * 1000,
  limit: 1000,
});

// Export diagnostics
await diagnosticStorageService.downloadDiagnostics({
  format: 'json', // or 'csv'
  includeSnapshots: true,
  includeEvents: true,
});
```

## Adding New Diagnostic Panel

```typescript
// 1. Create panel component in UnifiedDiagnostics/
export const MyDiagnosticPanel: React.FC<{ data: MyData }> = ({ data }) => {
  return (
    <div className="p-4 rounded-lg border border-[var(--border-color)] bg-[var(--surface-color)]">
      <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-[var(--primary-color)]">
        MY DIAGNOSTIC PANEL
      </h3>
      {/* Panel content */}
    </div>
  );
};

// 2. Export from index.ts
export { MyDiagnosticPanel } from './MyDiagnosticPanel';

// 3. Import and use in UnifiedDiagnostics.tsx
import { MyDiagnosticPanel } from './UnifiedDiagnostics';
```

## Log Filtering

```typescript
const useDiagnosticLogs = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<{
    level?: LogLevel;
    source?: string;
    search?: string;
  }>({});

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filter.level && log.level !== filter.level) return false;
      if (filter.source && log.source !== filter.source) return false;
      if (filter.search && !log.message.toLowerCase().includes(filter.search.toLowerCase())) return false;
      return true;
    });
  }, [logs, filter]);

  return { logs, filteredLogs, setFilter, addLog };
};
```

## Troubleshooting Guide Execution

```typescript
const useTroubleshootingGuide = (guide: TroubleshootingGuide) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const markStepComplete = (stepId: string) => {
    setCompletedSteps(prev => new Set([...prev, stepId]));
    if (currentStep < guide.steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const isComplete = completedSteps.size === guide.steps.length;
  const progress = (completedSteps.size / guide.steps.length) * 100;

  return { currentStep, completedSteps, markStepComplete, isComplete, progress };
};
```
