# Diagnostics Component Architecture

## File Map

```
components/UnifiedDiagnostics.tsx          # Main component (1800+ lines, 621 CCN)
components/UnifiedDiagnostics/
├── index.ts                                # Barrel exports
├── types.ts                                # Shared type definitions
├── DebugInfoPanel.tsx                      # Debug information panel
├── PerformanceMetricsPanel.tsx             # FPS, memory, render time
├── SystemLogsPanel.tsx                     # Log viewer with filters
├── WebSocketStatusPanel.tsx                # Connection status display
├── hooks/
│   ├── useDiagnosticLogs.ts               # Log management hook
│   ├── useDiagnosticSnapshots.ts          # State capture hook
│   ├── useTelemetryHistory.ts             # 24h history access
│   ├── useConnectionHistory.ts            # WebSocket history
│   └── useTroubleshootingGuide.ts         # Guided troubleshooting
└── utils/
    └── logHelpers.ts                       # Log formatting utilities

contexts/DiagnosticContext.tsx             # Reducer-based state (1052 lines)
services/diagnosticStorageService.ts       # IndexedDB for 24h history
```

## Code Statistics

| Metric | Value |
|--------|-------|
| Files | 15 |
| Lines | 5,112 |
| Code | 4,425 |
| Comments | 311 |
| Blanks | 376 |
| Total CCN | 621 |

## Component Hierarchy

```
UnifiedDiagnostics
├── Header (title + action buttons)
│   ├── Take Snapshot button
│   ├── Troubleshooting Guides button
│   └── Export Diagnostics button
├── System Health Summary
│   ├── Status badge (NOMINAL/WARNING/CRITICAL)
│   ├── Power reading
│   ├── Arduino CPU %
│   ├── NodeMCU WiFi dBm
│   └── Motor temp °C
├── Tab Navigation
│   ├── 📊 Overview
│   ├── 📈 Telemetry
│   ├── 📋 Logs
│   └── 🔧 Devices
├── Component Status Cards
│   ├── Arduino Mega (CPU, Memory, VIEW LOGS)
│   ├── NodeMCU (CPU, WiFi RSSI, VIEW LOGS)
│   ├── Motor Controller #1 (Status, Temp, VIEW LOGS)
│   └── Motor Controller #2 (Status, Temp, VIEW LOGS)
├── Thermal Heatmap (HeatMap component)
├── Power Chart (PowerSystemChart - SVG)
├── Oscilloscope (Canvas-based waveform)
└── Extracted Sub-panels
    ├── WebSocketStatusPanel
    ├── PerformanceMetricsPanel
    └── DebugInfoPanel
```

## State Flow

```
DiagnosticContext (reducer pattern)
    │
    ├── activeFaults: FaultRecord[]
    ├── testHistory: TestExecutionResult[]
    ├── componentTelemetry: Record<id, ComponentTelemetry>
    ├── signalTelemetry: Record<id, SignalTelemetry>
    ├── connectionDiagnostics: Record<id, ConnectionDiagnostics>
    ├── telemetryHistory: TelemetrySnapshot[]  (24h buffer)
    ├── diagnosticEvents: DiagnosticEvent[]
    ├── faultSimulationEnabled: boolean
    ├── simulatedFaults: Record<id, FaultRecord>
    ├── animationEnabled/Speed/showPacketDetails
    ├── telemetrySource: 'simulation' | 'live' | 'offline'
    └── connectionStatus: 'connected' | 'disconnected' | 'connecting'
         │
         ▼
    diagnosticStorageService (IndexedDB)
         │
         ├── telemetry_snapshots store
         └── diagnostic_events store
```

## Data Sources

### Real-time Telemetry
- WebSocket connection provides live data every 2 seconds
- System status from useSystemStatus()
- Rover telemetry from useRover()

### Historical Data
- IndexedDB stores 24 hours of snapshots
- diagnosticStorageService handles persistence
- Automatic cleanup of old data

### Simulated Data
- Fault simulation mode for testing
- Can inject faults into any component
- Toggle via `telemetrySource` state

## Tab Content

### Overview Tab
- System health summary
- Component status cards
- Thermal heatmap
- Power chart

### Telemetry Tab
- Oscilloscope waveforms
- Historical data charts
- Real-time metrics

### Logs Tab
- Filterable log viewer
- Source and level filtering
- Search functionality
- Export options

### Devices Tab
- Individual component details
- Test execution
- Fault history
- Connection diagnostics
