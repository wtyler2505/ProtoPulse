# Diagnostics Types and Patterns

## Core Interfaces

### LogEntry

```typescript
interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  message: string;
  source: string;
}
```

### PerformanceMetrics

```typescript
interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  memoryUsage: number;
  wsLatency: number;
}
```

### DiagnosticSnapshot

```typescript
interface DiagnosticSnapshot {
  id: string;
  timestamp: number;
  label: string;
  status: SystemStatus;
  logCount: number;
  wsState: string;
  queueLength: number;
  metrics: PerformanceMetrics;
}
```

### TroubleshootingStep

```typescript
interface TroubleshootingStep {
  id: string;
  description: string;
  checkAction?: string;
  expectedResult?: string;
  remediation?: string;
  completed?: boolean;
}

interface TroubleshootingGuide {
  id: string;
  title: string;
  description: string;
  steps: TroubleshootingStep[];
  targetComponent?: string;
}
```

### FaultRecord

```typescript
interface FaultRecord {
  id: string;
  componentId: string;
  type: FaultType;
  severity: 'warning' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
}

type FaultType = 
  | 'over_voltage'
  | 'under_voltage'
  | 'over_current'
  | 'over_temperature'
  | 'communication_failure'
  | 'sensor_failure'
  | 'motor_stall';
```

### ComponentTelemetry

```typescript
interface ComponentTelemetry {
  componentId: string;
  status: Status;
  temperature?: number;
  voltage?: number;
  current?: number;
  cpuPercent?: number;
  memoryPercent?: number;
  wifiStrength?: number;
  lastUpdate: number;
}
```

## DiagnosticContext Action Types

```typescript
type DiagnosticAction =
  // Fault operations
  | { type: 'ADD_FAULT'; fault: FaultRecord }
  | { type: 'RESOLVE_FAULT'; faultId: string }
  | { type: 'CLEAR_ALL_FAULTS' }
  
  // Test operations
  | { type: 'START_TEST'; componentId: string; testType: TestType }
  | { type: 'COMPLETE_TEST'; result: TestExecutionResult }
  
  // Telemetry updates
  | { type: 'UPDATE_COMPONENT_TELEMETRY'; componentId: string; telemetry: ComponentTelemetry }
  | { type: 'UPDATE_SIGNAL_TELEMETRY'; edgeId: string; telemetry: SignalTelemetry }
  | { type: 'ADD_TELEMETRY_SNAPSHOT'; snapshot: TelemetrySnapshot }
  
  // Connection diagnostics
  | { type: 'UPDATE_CONNECTION_DIAGNOSTICS'; connectionId: string; diagnostics: ConnectionDiagnostics }
  | { type: 'ADD_DIAGNOSTIC_EVENT'; event: DiagnosticEvent }
  
  // Simulation controls
  | { type: 'TOGGLE_FAULT_SIMULATION'; enabled: boolean }
  | { type: 'INJECT_SIMULATED_FAULT'; componentId: string; fault: FaultRecord }
  | { type: 'CLEAR_SIMULATED_FAULTS' }
  
  // Animation controls
  | { type: 'SET_ANIMATION_ENABLED'; enabled: boolean }
  | { type: 'SET_ANIMATION_SPEED'; speed: number }
  | { type: 'SET_SHOW_PACKET_DETAILS'; show: boolean }
  
  // Data source
  | { type: 'SET_TELEMETRY_SOURCE'; source: 'simulation' | 'live' | 'offline' }
  | { type: 'SET_CONNECTION_STATUS'; status: ConnectionStatus };
```

## Common Patterns

### Status Color Mapping

```typescript
const statusToVariant = (status: Status): StatusVariant => {
  const map: Record<Status, StatusVariant> = {
    NOMINAL: 'nominal',
    WARNING: 'warning',
    CRITICAL: 'critical',
    IDLE: 'standby',
  };
  return map[status] || 'offline';
};
```

### Temperature Color Scale

```typescript
const getTempColorClass = (temp: number): string => {
  if (temp > 80) return 'bg-red-500/20 border-red-500/50 text-red-400 animate-pulse';
  if (temp > 70) return 'bg-amber-500/20 border-amber-500/50 text-amber-400';
  if (temp > 50) return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
  return 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400';
};
```

### Log Level Styling

```typescript
const logLevelStyles: Record<LogLevel, string> = {
  info: 'text-[var(--primary-color)]',
  warn: 'text-amber-400',
  error: 'text-red-400',
};

const logLevelIcons: Record<LogLevel, string> = {
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
};
```

### Test Status Display

```typescript
const testStatusStyles: Record<TestStatus, { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'PENDING' },
  running: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'RUNNING' },
  passed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'PASSED' },
  failed: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'FAILED' },
};
```

### Threshold Constants

```typescript
const DIAGNOSTIC_THRESHOLDS = {
  temperature: { warning: 70, critical: 80 },
  voltage: { low_warning: 32, low_critical: 30, high_warning: 40, high_critical: 42 },
  current: { warning: 15, critical: 20 },
  cpu: { warning: 80, critical: 95 },
  memory: { warning: 85, critical: 95 },
  wifi: { warning: -70, critical: -80 },  // dBm (more negative = worse)
};
```

### Time Formatting

```typescript
const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
};
```
