# DiagnosticContext API Reference

## Provider Setup

```typescript
import { DiagnosticProvider } from '../contexts/DiagnosticContext';

// Wrap app or diagnostic section
<DiagnosticProvider>
  <UnifiedDiagnostics />
</DiagnosticProvider>
```

## Hook Usage

```typescript
const {
  state,
  
  // Test operations
  runTest,
  getTestHistory,
  
  // Fault operations
  addFault,
  resolveFault,
  clearAllFaults,
  getActiveFaults,
  
  // Telemetry operations
  updateComponentTelemetry,
  updateSignalTelemetry,
  
  // Fault simulation
  toggleFaultSimulation,
  injectSimulatedFault,
  clearSimulatedFaults,
  
  // Historical data (24h)
  getTelemetryHistory,
  getDiagnosticEvents,
  downloadDiagnostics,
  
  // Animation controls
  setAnimationEnabled,
  setAnimationSpeed,
  setShowPacketDetails,
  
  // Data source
  setTelemetrySource,
  setConnectionStatus,
} = useDiagnostic();
```

## State Structure

```typescript
interface DiagnosticState {
  // Faults
  activeFaults: FaultRecord[];
  faultSimulationEnabled: boolean;
  simulatedFaults: Record<string, FaultRecord>;
  
  // Tests
  testHistory: TestExecutionResult[];
  runningTests: Set<string>;
  
  // Telemetry
  componentTelemetry: Record<string, ComponentTelemetry>;
  signalTelemetry: Record<string, SignalTelemetry>;
  telemetryHistory: TelemetrySnapshot[];
  
  // Connection
  connectionDiagnostics: Record<string, ConnectionDiagnostics>;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  
  // Events
  diagnosticEvents: DiagnosticEvent[];
  
  // Animation
  animationEnabled: boolean;
  animationSpeed: number;
  showPacketDetails: boolean;
  
  // Source
  telemetrySource: 'simulation' | 'live' | 'offline';
}
```

## Test Operations

### Running a Test

```typescript
// Run connectivity test on Arduino
await runTest('arduino', 'connectivity');

// Run thermal test on motor controller
await runTest('mc1', 'thermal');

// Available test types
type TestType = 'connectivity' | 'thermal' | 'voltage' | 'current' | 'communication';
```

### Getting Test History

```typescript
// All tests
const allTests = getTestHistory();

// Tests for specific component
const arduinoTests = getTestHistory('arduino');

// Filter by result
const failedTests = getTestHistory().filter(t => t.status === 'failed');
```

## Fault Operations

### Adding a Fault

```typescript
addFault({
  id: crypto.randomUUID(),
  componentId: 'mc1',
  type: 'over_temperature',
  severity: 'warning',
  message: 'Motor Controller 1 temperature at 72°C',
  timestamp: Date.now(),
  resolved: false,
});
```

### Resolving a Fault

```typescript
resolveFault('fault-id-123');

// Fault is marked resolved with timestamp
// { ...fault, resolved: true, resolvedAt: Date.now() }
```

### Getting Active Faults

```typescript
// All active faults
const allFaults = getActiveFaults();

// Faults for specific component
const mc1Faults = getActiveFaults('mc1');

// Filter by severity
const criticalFaults = getActiveFaults().filter(f => f.severity === 'critical');
```

## Telemetry Operations

### Updating Component Telemetry

```typescript
updateComponentTelemetry('arduino', {
  componentId: 'arduino',
  status: 'NOMINAL',
  cpuPercent: 45,
  memoryPercent: 62,
  temperature: 38,
  lastUpdate: Date.now(),
});
```

### Updating Signal Telemetry

```typescript
updateSignalTelemetry('arduino-nodemcu', {
  edgeId: 'arduino-nodemcu',
  signalStrength: 0.95,
  latency: 12,
  packetsPerSecond: 50,
  errorRate: 0.001,
});
```

## Fault Simulation

```typescript
// Enable simulation mode
toggleFaultSimulation(true);

// Inject a simulated fault
injectSimulatedFault('mc1', {
  id: 'sim-fault-1',
  componentId: 'mc1',
  type: 'over_temperature',
  severity: 'critical',
  message: 'SIMULATED: Critical temperature',
  timestamp: Date.now(),
  resolved: false,
});

// Clear all simulated faults
clearSimulatedFaults();

// Disable simulation
toggleFaultSimulation(false);
```

## Historical Data

### Getting Telemetry History

```typescript
// Last 24 hours
const history = getTelemetryHistory();

// With options
const filtered = getTelemetryHistory({
  startTime: Date.now() - 6 * 60 * 60 * 1000,  // Last 6 hours
  endTime: Date.now(),
  limit: 500,
  componentId: 'arduino',
});
```

### Getting Diagnostic Events

```typescript
// All events
const events = getDiagnosticEvents();

// Filtered
const faultEvents = getDiagnosticEvents({
  type: 'fault',
  startTime: Date.now() - 3600000,  // Last hour
});
```

### Downloading Diagnostics

```typescript
// Download as JSON
await downloadDiagnostics({ format: 'json' });

// Download as CSV
await downloadDiagnostics({ format: 'csv' });

// With options
await downloadDiagnostics({
  format: 'json',
  includeSnapshots: true,
  includeEvents: true,
  includeTestHistory: true,
  startTime: Date.now() - 86400000,  // Last 24 hours
});
```

## Animation Controls

```typescript
// Enable/disable animations
setAnimationEnabled(true);

// Set animation speed (0.5 = half speed, 2 = double speed)
setAnimationSpeed(1.5);

// Show/hide packet details in animations
setShowPacketDetails(true);
```

## Data Source Control

```typescript
// Switch to live telemetry
setTelemetrySource('live');

// Switch to simulation
setTelemetrySource('simulation');

// Switch to offline (historical data only)
setTelemetrySource('offline');

// Update connection status
setConnectionStatus('connected');
setConnectionStatus('disconnected');
setConnectionStatus('connecting');
```

## Event Types

```typescript
type DiagnosticEventType = 
  | 'fault_added'
  | 'fault_resolved'
  | 'test_started'
  | 'test_completed'
  | 'connection_change'
  | 'threshold_exceeded'
  | 'snapshot_taken'
  | 'simulation_toggled';

interface DiagnosticEvent {
  id: string;
  type: DiagnosticEventType;
  timestamp: number;
  componentId?: string;
  details: Record<string, unknown>;
}
```
