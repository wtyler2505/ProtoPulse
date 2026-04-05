import { useState, useRef, useEffect, useCallback, useSyncExternalStore, useMemo, lazy, Suspense } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useArduino } from '@/lib/contexts/arduino-context';
import {
  useWebSerial,
  COMMON_BAUD_RATES,
  KNOWN_BOARD_FILTERS,
} from '@/lib/web-serial';
import { buildSerialTrustReceipt } from '@/lib/trust-receipts';
import { assessSerialDevicePreflight } from '@/lib/arduino/serial-device-preflight';
import type {
  LineEnding,
  SerialMonitorLine,
} from '@/lib/web-serial';
import { SerialLogger } from '@/lib/arduino/serial-logger';
import { TelemetryStore, parseLine } from '@/lib/arduino/telemetry-parser';
import { DeviceShadow } from '@/lib/digital-twin/device-shadow';
import DeviceCommandSandbox from '@/components/arduino/DeviceCommandSandbox';
import { detectEspException, parseEspException } from '@/lib/arduino/esp-exception-decoder';
import { detectBaudMismatch, nonPrintableRatio } from '@/lib/arduino/baud-detector';
import { buildHardwareCoDebugReadiness } from '@/lib/arduino/hardware-co-debug';
import type { EspExceptionResult } from '@/lib/arduino/esp-exception-decoder';
import type { BaudMismatchResult } from '@/lib/arduino/baud-detector';
import type { SerialContext } from '@/lib/arduino/serial-troubleshooter';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import TrustReceiptCard from '@/components/ui/TrustReceiptCard';
import {
  Zap,
  ZapOff,
  Trash2,
  Send,
  RotateCcw,
  Plug,
  Unplug,
  AlertTriangle,
  Save,
  FolderOpen,
  X,
  Circle,
  Download,
  Bug,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  HelpCircle,
  Activity,
  Wand2,
  Loader2,
} from 'lucide-react';

const TroubleshootWizard = lazy(() => import('@/components/arduino/TroubleshootWizard'));
const TelemetryDashboard = lazy(() => import('@/components/arduino/TelemetryDashboard'));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINE_ENDING_OPTIONS: { value: LineEnding; label: string }[] = [
  { value: 'none', label: 'No line ending' },
  { value: 'cr', label: 'CR (\\r)' },
  { value: 'lf', label: 'LF (\\n)' },
  { value: 'crlf', label: 'CR+LF (\\r\\n)' },
];

const PRESETS_STORAGE_KEY = 'protopulse-serial-presets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SavedPreset {
  name: string;
  baudRate: number;
  lineEnding: LineEnding;
  dtr: boolean;
  rts: boolean;
  boardProfile?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 } as Intl.DateTimeFormatOptions);
}

function loadPresets(): SavedPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (p): p is SavedPreset =>
        typeof p === 'object' &&
        p !== null &&
        typeof (p as Record<string, unknown>).name === 'string' &&
        typeof (p as Record<string, unknown>).baudRate === 'number',
    );
  } catch {
    return [];
  }
}

function savePresetsToStorage(presets: SavedPreset[]): void {
  try {
    localStorage.setItem(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // localStorage may be unavailable
  }
}

function loadLastUsedPreset(): string | null {
  try {
    return localStorage.getItem('protopulse-serial-last-preset');
  } catch {
    return null;
  }
}

function saveLastUsedPreset(name: string): void {
  try {
    localStorage.setItem('protopulse-serial-last-preset', name);
  } catch {
    // localStorage may be unavailable
  }
}

function formatRecordingDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function formatRecordingSize(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SerialMonitorPanelProps {
  code?: string;
  projectId?: number;
}

function normalizeBoardFilterValue(value: string | null | undefined): string {
  if (!value || value === 'any') {
    return '';
  }
  return value;
}

export default function SerialMonitorPanel({ code = '', projectId }: SerialMonitorPanelProps) {
  const contextProjectId = useProjectId();
  const resolvedProjectId = projectId ?? contextProjectId;
  const {
    state,
    requestPort,
    connect,
    disconnect,
    send,
    setSignals,
    resetBoard,
    setBaudRate,
    setLineEnding,
    clearMonitor,
    isSupported,
  } = useWebSerial();
  const { profiles } = useArduino();

  const [sendValue, setSendValue] = useState('');
  const [selectedBoardProfile, setSelectedBoardProfile] = useState<string>('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const monitorEndRef = useRef<HTMLDivElement>(null);
  const sendInputRef = useRef<HTMLInputElement>(null);

  // Preset management state
  const [presets, setPresets] = useState<SavedPreset[]>(() => loadPresets());
  const [presetName, setPresetName] = useState('');
  const [showPresetSave, setShowPresetSave] = useState(false);

  // ESP Exception Decoder
  const [espException, setEspException] = useState<EspExceptionResult | null>(null);
  const [showEspDecode, setShowEspDecode] = useState(false);
  const [espExpanded, setEspExpanded] = useState(false);

  // Baud mismatch detection
  const [baudMismatch, setBaudMismatch] = useState<BaudMismatchResult | null>(null);
  const [baudWarningDismissed, setBaudWarningDismissed] = useState(false);
  const baudCheckDoneRef = useRef(false);

  // Troubleshoot wizard
  const [showTroubleshootHint, setShowTroubleshootHint] = useState(false);
  const [showTroubleshootWizard, setShowTroubleshootWizard] = useState(false);
  const troubleshootTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // AI Hardware Copilot
  const [copilotResult, setCopilotResult] = useState<string | null>(null);
  const coDebugReadiness = useMemo(
    () => buildHardwareCoDebugReadiness({ code, monitor: state.monitor }),
    [code, state.monitor],
  );
  const copilotMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/projects/${resolvedProjectId}/arduino/co-debug`, {
        code: coDebugReadiness.code,
        serialLogs: coDebugReadiness.serialLogs,
      });
      const data = await res.json();
      return data.result as string;
    },
    onSuccess: (data) => setCopilotResult(data),
  });

  // Tab: 'monitor' | 'dashboard'
  const [activeTab, setActiveTab] = useState<'monitor' | 'dashboard'>('monitor');

  // Hardware Session Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayData, setReplayData] = useState<SerialMonitorLine[]>([]);
  const replayFileRef = useRef<HTMLInputElement>(null);
  const replayTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const normalizedBoardFilter = normalizeBoardFilterValue(selectedBoardProfile);
  const defaultArduinoProfile = useMemo(
    () => profiles.find((profile) => profile.isDefault) ?? profiles[0],
    [profiles],
  );

  // Telemetry store
  const telemetryStoreRef = useRef(TelemetryStore.getInstance());

  // Serial recording
  const serialLoggerRef = useRef(SerialLogger.getInstance());
  const loggerSnap = useSyncExternalStore(
    serialLoggerRef.current.subscribe,
    serialLoggerRef.current.getSnapshot,
  );
  const prevMonitorLenRef = useRef(state.monitor.length);

  // Feed incoming serial data to logger + telemetry store
  useEffect(() => {
    const prevLen = prevMonitorLenRef.current;
    const curLen = state.monitor.length;
    prevMonitorLenRef.current = curLen;

    if (curLen > prevLen) {
      for (let i = prevLen; i < curLen; i++) {
        const line = state.monitor[i];
        if (line) {
          // Feed logger (only when recording)
          if (serialLoggerRef.current.isRecording()) {
            serialLoggerRef.current.appendData(line.data + '\n');
          }
          // Feed telemetry store (always, for RX lines)
          if (line.direction === 'rx') {
            telemetryStoreRef.current.ingest(line.data);
            
            // BL-0518: Route parsed telemetry to Digital Twin
            const parsed = parseLine(line.data);
            if (parsed) {
              const ch: Record<string, number> = {};
              for (const [key, val] of Array.from(parsed.values.entries())) {
                ch[key] = val;
              }
              DeviceShadow.getInstance().processFrame({
                type: 'telemetry',
                ts: Date.now(),
                ch,
              });
            }
          }
        }
      }
    }
  }, [state.monitor.length, state.monitor]);

  // ESP exception auto-detection — scan new RX lines for crash patterns
  useEffect(() => {
    if (state.monitor.length === 0) {
      return;
    }
    // Combine last 50 lines of RX for detection (crash output spans multiple lines)
    const recentRx = state.monitor
      .slice(-50)
      .filter((l) => l.direction === 'rx')
      .map((l) => l.data)
      .join('\n');

    if (detectEspException(recentRx)) {
      setShowEspDecode(true);
    } else {
      setShowEspDecode(false);
      setEspException(null);
      setEspExpanded(false);
    }
  }, [state.monitor.length, state.monitor]);

  // Baud mismatch detection — run once after ~100 bytes received
  useEffect(() => {
    if (baudCheckDoneRef.current || baudWarningDismissed) {
      return;
    }
    if (state.bytesReceived < 100) {
      return;
    }
    baudCheckDoneRef.current = true;

    // Collect recent RX data for analysis
    const rxData = state.monitor
      .filter((l) => l.direction === 'rx')
      .map((l) => l.data)
      .join('');

    if (rxData.length < 32) {
      return;
    }

    const result = detectBaudMismatch(rxData, state.baudRate);
    if (result.detected) {
      setBaudMismatch(result);
    }
  }, [state.bytesReceived, state.monitor, state.baudRate, baudWarningDismissed]);

  // Reset baud check when disconnecting or changing baud rate
  useEffect(() => {
    baudCheckDoneRef.current = false;
    setBaudMismatch(null);
    setBaudWarningDismissed(false);
  }, [state.baudRate, state.connectionState]);

  // Troubleshoot hint — show after 10s of being connected with no RX data
  useEffect(() => {
    if (troubleshootTimerRef.current) {
      clearTimeout(troubleshootTimerRef.current);
      troubleshootTimerRef.current = null;
    }

    // Only start timer when connected and no data yet
    if (state.connectionState === 'connected' && state.bytesReceived === 0) {
      troubleshootTimerRef.current = setTimeout(() => {
        setShowTroubleshootHint(true);
      }, 10_000);
    } else {
      setShowTroubleshootHint(false);
      setShowTroubleshootWizard(false);
    }

    return () => {
      if (troubleshootTimerRef.current) {
        clearTimeout(troubleshootTimerRef.current);
        troubleshootTimerRef.current = null;
      }
    };
  }, [state.connectionState, state.bytesReceived]);

  // Recording duration ticker
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!loggerSnap.recording) {
      return;
    }
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [loggerSnap.recording]);

  const handleToggleRecording = useCallback(() => {
    const logger = serialLoggerRef.current;
    if (logger.isRecording()) {
      logger.stopRecording();
    } else {
      logger.startRecording();
    }
  }, []);

  const handleDownloadRecording = useCallback(() => {
    serialLoggerRef.current.downloadAsFile();
  }, []);

  const handleStopReplay = useCallback(() => {
    setIsReplaying(false);
    replayTimeoutsRef.current.forEach(clearTimeout);
    replayTimeoutsRef.current = [];
    setReplayData([]);
  }, []);

  const handleLoadReplay = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.entries && Array.isArray(parsed.entries)) {
          clearMonitor(); // Clear current monitor
          setIsReplaying(true);
          setReplayData([]);
          
          const entries = parsed.entries as SerialMonitorLine[];
          
          // Replay lines with their original relative timing
          entries.forEach((entry, idx) => {
            const timeoutId = setTimeout(() => {
              setReplayData(prev => {
                const next = [...prev, entry];
                // Keep only the last 1000 lines for performance
                if (next.length > 1000) {
                  return next.slice(next.length - 1000);
                }
                return next;
              });
              
              // Feed to telemetry store for dashboard playback
              if (entry.direction === 'rx') {
                telemetryStoreRef.current.ingest(entry.data);
                const parsedLine = parseLine(entry.data);
                if (parsedLine) {
                  const ch: Record<string, number> = {};
                  for (const [key, val] of Array.from(parsedLine.values.entries())) {
                    ch[key] = val;
                  }
                  DeviceShadow.getInstance().processFrame({
                    type: 'telemetry',
                    ts: Date.now(),
                    ch,
                  });
                }
              }
            }, entry.timestamp); // Use the original timestamp offset
            replayTimeoutsRef.current.push(timeoutId);
          });
        }
      } catch (err) {
        console.error('Failed to parse replay file', err);
      }
      
      // Reset input
      if (replayFileRef.current) {
        replayFileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  }, [clearMonitor]);

  // Auto-load last-used preset on mount
  useEffect(() => {
    const lastName = loadLastUsedPreset();
    if (lastName) {
        const preset = presets.find((p) => p.name === lastName);
        if (preset) {
          setBaudRate(preset.baudRate);
          setLineEnding(preset.lineEnding);
          void setSignals({ dtr: preset.dtr, rts: preset.rts });
          if (preset.boardProfile) {
            setSelectedBoardProfile(normalizeBoardFilterValue(preset.boardProfile));
          }
        }
      }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll to bottom when new monitor lines arrive
  useEffect(() => {
    if (autoScroll && monitorEndRef.current) {
      monitorEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.monitor.length, autoScroll]);

  const handleConnect = useCallback(async () => {
    const boardFilter = KNOWN_BOARD_FILTERS.find((p) => p.label === normalizedBoardFilter);
    const filters = boardFilter ? [{ usbVendorId: boardFilter.usbVendorId, ...(boardFilter.usbProductId !== undefined ? { usbProductId: boardFilter.usbProductId } : {}) }] : undefined;
    const gotPort = await requestPort(filters);
    if (gotPort) {
      await connect({ baudRate: state.baudRate });
    }
  }, [requestPort, connect, normalizedBoardFilter, state.baudRate]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  const handleSend = useCallback(async () => {
    const trimmed = sendValue.trim();
    if (!trimmed) {
      return;
    }
    const ok = await send(trimmed);
    if (ok) {
      setSendValue('');
      sendInputRef.current?.focus();
    }
  }, [send, sendValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void handleSend();
      }
    },
    [handleSend],
  );

  const handleResetBoard = useCallback(async () => {
    await resetBoard();
  }, [resetBoard]);

  // Preset management
  const handleSavePreset = useCallback(() => {
    const name = presetName.trim();
    if (!name) {
      return;
    }
    const newPreset: SavedPreset = {
      name,
      baudRate: state.baudRate,
      lineEnding: state.lineEnding,
      dtr: state.dtr,
      rts: state.rts,
      boardProfile: normalizedBoardFilter || undefined,
    };
    const updated = [...presets.filter((p) => p.name !== name), newPreset];
    setPresets(updated);
    savePresetsToStorage(updated);
    saveLastUsedPreset(name);
    setPresetName('');
    setShowPresetSave(false);
  }, [normalizedBoardFilter, presetName, state.baudRate, state.lineEnding, state.dtr, state.rts, presets]);

  const handleLoadPreset = useCallback(
    (preset: SavedPreset) => {
      setBaudRate(preset.baudRate);
      setLineEnding(preset.lineEnding);
      void setSignals({ dtr: preset.dtr, rts: preset.rts });
      if (preset.boardProfile) {
        setSelectedBoardProfile(normalizeBoardFilterValue(preset.boardProfile));
      }
      saveLastUsedPreset(preset.name);
    },
    [setBaudRate, setLineEnding, setSignals],
  );

  const handleDeletePreset = useCallback(
    (name: string) => {
      const updated = presets.filter((p) => p.name !== name);
      setPresets(updated);
      savePresetsToStorage(updated);
    },
    [presets],
  );

  // ESP exception decode handler
  const handleDecodeException = useCallback(() => {
    const recentRx = state.monitor
      .slice(-50)
      .filter((l) => l.direction === 'rx')
      .map((l) => l.data)
      .join('\n');
    const result = parseEspException(recentRx);
    setEspException(result);
    setEspExpanded(true);
  }, [state.monitor]);

  // Baud switch handler
  const handleBaudSwitch = useCallback(
    (newBaud: number) => {
      setBaudRate(newBaud);
      setBaudMismatch(null);
      setBaudWarningDismissed(true);
    },
    [setBaudRate],
  );

  const handleDismissBaudWarning = useCallback(() => {
    setBaudMismatch(null);
    setBaudWarningDismissed(true);
  }, []);

  // Unsupported browser
  const serialDevicePreflight = useMemo(
    () =>
      assessSerialDevicePreflight({
        connectionState: state.connectionState,
        normalizedBoardFilter,
        portInfo: state.portInfo,
        selectedProfile: defaultArduinoProfile,
      }),
    [defaultArduinoProfile, normalizedBoardFilter, state.connectionState, state.portInfo],
  );

  const serialTrustReceipt = useMemo(
    () =>
      buildSerialTrustReceipt({
        baudRate: state.baudRate,
        bytesReceived: state.bytesReceived,
        bytesSent: state.bytesSent,
        connectionState: state.connectionState,
        devicePreflight: serialDevicePreflight,
        error: state.error,
        isSupported,
        portInfo: state.portInfo,
        selectedBoardProfile: normalizedBoardFilter,
        showTroubleshootHint,
      }),
    [
      isSupported,
      normalizedBoardFilter,
      serialDevicePreflight,
      showTroubleshootHint,
      state.baudRate,
      state.bytesReceived,
      state.bytesSent,
      state.connectionState,
      state.error,
      state.portInfo,
    ],
  );

  if (!isSupported) {
    return (
      <div data-testid="serial-monitor-unsupported" className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-yellow-500" />
        <h2 className="text-lg font-semibold text-foreground">Web Serial Not Supported</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          The Web Serial API is only available in Chrome and Edge browsers. Please switch to a supported browser to use the Serial Monitor.
        </p>
      </div>
    );
  }

  const isConnected = state.connectionState === 'connected';
  const isConnecting = state.connectionState === 'connecting';

  return (
    <div data-testid="serial-monitor-panel" className="flex flex-col h-full overflow-hidden">
      {/* Header / Connection Controls */}
      <div className="border-b border-border bg-card/60 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-[#00F0FF]" />
            <h2 className="text-sm font-semibold text-foreground">Serial Monitor</h2>
            <span
              data-testid="serial-connection-status"
              className={cn(
                'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
                isConnected && 'bg-emerald-500/15 text-emerald-400',
                isConnecting && 'bg-yellow-500/15 text-yellow-400',
                state.connectionState === 'disconnected' && 'bg-muted/50 text-muted-foreground',
                state.connectionState === 'error' && 'bg-destructive/15 text-destructive',
              )}
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isConnected && 'bg-emerald-400',
                  isConnecting && 'bg-yellow-400 animate-pulse',
                  state.connectionState === 'disconnected' && 'bg-muted-foreground',
                  state.connectionState === 'error' && 'bg-destructive',
                )}
              />
              {state.connectionState === 'connected' && 'Connected'}
              {state.connectionState === 'connecting' && 'Connecting...'}
              {state.connectionState === 'disconnected' && 'Disconnected'}
              {state.connectionState === 'error' && 'Error'}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {isConnected ? (
              <Button
                data-testid="serial-disconnect-btn"
                variant="destructive"
                size="sm"
                onClick={() => void handleDisconnect()}
                className="h-7 text-xs gap-1"
              >
                <Unplug className="w-3 h-3" />
                Disconnect
              </Button>
            ) : (
              <Button
                data-testid="serial-connect-btn"
                variant="default"
                size="sm"
                onClick={() => void handleConnect()}
                disabled={isConnecting}
                className="h-7 text-xs gap-1"
              >
                <Plug className="w-3 h-3" />
                Connect
              </Button>
            )}
          </div>
        </div>

        {/* Monitor / Dashboard tab switcher */}
        <div data-testid="serial-tab-switcher" className="flex items-center gap-1">
          <button
            data-testid="serial-tab-monitor"
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              activeTab === 'monitor'
                ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
            )}
            onClick={() => setActiveTab('monitor')}
          >
            <Zap className="w-3 h-3" />
            Monitor
          </button>
          <button
            data-testid="serial-tab-dashboard"
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors',
              activeTab === 'dashboard'
                ? 'bg-[#00F0FF]/15 text-[#00F0FF]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/30',
            )}
            onClick={() => setActiveTab('dashboard')}
          >
            <Activity className="w-3 h-3" />
            Dashboard
          </button>
        </div>

        {/* Configuration Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Board Profile */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Board:</Label>
            <Select
              value={normalizedBoardFilter || 'any'}
              onValueChange={(value) => setSelectedBoardProfile(normalizeBoardFilterValue(value))}
            >
              <SelectTrigger data-testid="serial-board-select" className="h-7 w-[160px] text-xs">
                <SelectValue placeholder="Any device" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any device</SelectItem>
                {KNOWN_BOARD_FILTERS.map((board) => (
                  <SelectItem key={board.label} value={board.label}>
                    {board.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Baud Rate */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Baud:</Label>
            <Select
              value={String(state.baudRate)}
              onValueChange={(v) => setBaudRate(Number(v))}
            >
              <SelectTrigger data-testid="serial-baud-select" className="h-7 w-[100px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_BAUD_RATES.map((rate) => (
                  <SelectItem key={rate} value={String(rate)}>
                    {rate.toLocaleString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Line Ending */}
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-muted-foreground whitespace-nowrap">Ending:</Label>
            <Select
              value={state.lineEnding}
              onValueChange={(v) => setLineEnding(v as LineEnding)}
            >
              <SelectTrigger data-testid="serial-line-ending-select" className="h-7 w-[130px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LINE_ENDING_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* DTR/RTS + Presets Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Switch
              data-testid="serial-dtr-toggle"
              id="serial-dtr"
              checked={state.dtr}
              onCheckedChange={(checked) => void setSignals({ dtr: checked })}
              className="h-4 w-7"
            />
            <Label htmlFor="serial-dtr" className="text-xs text-muted-foreground cursor-pointer">DTR</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch
              data-testid="serial-rts-toggle"
              id="serial-rts"
              checked={state.rts}
              onCheckedChange={(checked) => void setSignals({ rts: checked })}
              className="h-4 w-7"
            />
            <Label htmlFor="serial-rts" className="text-xs text-muted-foreground cursor-pointer">RTS</Label>
          </div>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-1.5">
            <Switch
              data-testid="serial-autoscroll-toggle"
              id="serial-autoscroll"
              checked={autoScroll}
              onCheckedChange={setAutoScroll}
              className="h-4 w-7"
            />
            <Label htmlFor="serial-autoscroll" className="text-xs text-muted-foreground cursor-pointer">Auto-scroll</Label>
          </div>

          <div className="flex items-center gap-1.5">
            <Switch
              data-testid="serial-timestamps-toggle"
              id="serial-timestamps"
              checked={showTimestamps}
              onCheckedChange={setShowTimestamps}
              className="h-4 w-7"
            />
            <Label htmlFor="serial-timestamps" className="text-xs text-muted-foreground cursor-pointer">Timestamps</Label>
          </div>

          <div className="h-4 w-px bg-border" />

          {/* Preset buttons */}
          <Button
            data-testid="serial-save-preset-btn"
            variant="ghost"
            size="sm"
            className="h-6 text-xs gap-1 px-2"
            onClick={() => setShowPresetSave(!showPresetSave)}
          >
            <Save className="w-3 h-3" />
            Save
          </Button>

          {presets.length > 0 && (
            <Select
              value=""
              onValueChange={(name) => {
                const preset = presets.find((p) => p.name === name);
                if (preset) {
                  handleLoadPreset(preset);
                }
              }}
            >
              <SelectTrigger data-testid="serial-load-preset-select" className="h-6 w-[120px] text-xs">
                <span className="flex items-center gap-1">
                  <FolderOpen className="w-3 h-3" />
                  Load Preset
                </span>
              </SelectTrigger>
              <SelectContent>
                {presets.map((p) => (
                  <div key={p.name} className="flex items-center justify-between px-2 py-1 hover:bg-muted/50 group">
                    <SelectItem value={p.name} className="flex-1 p-0 text-xs">
                      {p.name} ({p.baudRate.toLocaleString()})
                    </SelectItem>
                    <button
                      data-testid={`serial-delete-preset-${p.name}`}
                      className="ml-2 p-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePreset(p.name);
                      }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Preset Save Input (collapsible) */}
        {showPresetSave && (
          <div data-testid="serial-preset-save-form" className="flex items-center gap-2">
            <Input
              data-testid="serial-preset-name-input"
              type="text"
              placeholder="Preset name..."
              aria-label="Preset name"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSavePreset();
                }
                if (e.key === 'Escape') {
                  setShowPresetSave(false);
                }
              }}
              className="h-7 text-xs flex-1"
              autoFocus
            />
            <Button
              data-testid="serial-preset-save-confirm"
              variant="default"
              size="sm"
              className="h-7 text-xs"
              onClick={handleSavePreset}
              disabled={!presetName.trim()}
            >
              Save
            </Button>
            <Button
              data-testid="serial-preset-save-cancel"
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowPresetSave(false)}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Error Display */}
        {state.error && (
          <div data-testid="serial-error" className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            <span className="truncate">{state.error}</span>
          </div>
        )}

        <TrustReceiptCard
          receipt={serialTrustReceipt}
          data-testid="trust-receipt-serial"
        />

        {/* Baud Mismatch Warning */}
        {baudMismatch?.detected && !baudWarningDismissed && (
          <div
            data-testid="baud-mismatch-warning"
            className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-500/10 border border-yellow-500/20 rounded px-2 py-1.5"
          >
            <ArrowRightLeft className="w-3 h-3 shrink-0" />
            <span className="flex-1">
              Baud rate mismatch detected ({Math.round(baudMismatch.confidence * 100)}% confidence). Try {baudMismatch.likelyBaud.toLocaleString()}.
            </span>
            <Button
              data-testid="baud-switch-button"
              variant="outline"
              size="sm"
              className="h-5 text-[10px] px-2 border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20"
              onClick={() => handleBaudSwitch(baudMismatch.likelyBaud)}
            >
              Switch to {baudMismatch.likelyBaud.toLocaleString()}
            </Button>
            <button
              data-testid="baud-mismatch-dismiss"
              className="p-0.5 text-yellow-400/60 hover:text-yellow-300 transition-colors"
              onClick={handleDismissBaudWarning}
              aria-label="Dismiss baud mismatch warning"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Crash Doctor Detection */}
        {showEspDecode && (
          <div data-testid="esp-exception-banner" className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded px-2 py-1.5">
              <Bug className="w-3 h-3 shrink-0" />
              <span className="flex-1">Hardware crash detected in serial output</span>
              <Button
                data-testid="esp-decode-button"
                variant="outline"
                size="sm"
                className="h-5 text-[10px] px-2 border-orange-500/30 text-orange-300 hover:bg-orange-500/20"
                onClick={handleDecodeException}
              >
                {espException ? 'Re-diagnose' : 'Diagnose Crash'}
              </Button>
            </div>

            {/* Decoded exception result */}
            {espException?.decoded && (
              <div
                data-testid="esp-decoded-result"
                className="text-xs bg-card/80 border border-border rounded overflow-hidden"
              >
                <button
                  data-testid="esp-decoded-toggle"
                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-muted/30 transition-colors text-left"
                  onClick={() => setEspExpanded(!espExpanded)}
                  aria-label={espExpanded ? 'Collapse decoded exception' : 'Expand decoded exception'}
                >
                  {espExpanded ? (
                    <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  )}
                  <span className="font-semibold text-orange-300">{espException.crashType}</span>
                  <span className="text-muted-foreground">&mdash;</span>
                  <span className="text-foreground/80 truncate">{espException.description}</span>
                </button>

                {espExpanded && (
                  <div className="px-2 pb-2 space-y-2 border-t border-border/50">
                    {/* Stack frames */}
                    {espException.stackFrames.length > 0 && (
                      <div className="mt-1.5">
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Backtrace</span>
                        <div className="mt-0.5 font-mono space-y-0.5">
                          {espException.stackFrames.map((frame, i) => (
                            <div
                              key={`frame-${String(i)}`}
                              className="flex items-center gap-2 text-[11px] px-1 py-0.5 rounded hover:bg-muted/20"
                            >
                              <span className="text-muted-foreground w-4 text-right select-none">#{String(i)}</span>
                              <span className="text-[#00F0FF]">{frame.address}</span>
                              {frame.function && <span className="text-foreground">{frame.function}</span>}
                              {frame.file && (
                                <span className="text-muted-foreground">
                                  {frame.file}{frame.line !== undefined ? `:${String(frame.line)}` : ''}
                                </span>
                              )}
                              {!frame.function && !frame.file && (
                                <span className="text-muted-foreground/50 italic">addr2line available with native desktop</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Register dump */}
                    {espException.registers && (
                      <div>
                        <span className="text-muted-foreground text-[10px] uppercase tracking-wider">Registers</span>
                        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px]">
                          {Object.entries(espException.registers).map(([name, value]) => (
                            <span key={name}>
                              <span className="text-muted-foreground">{name}:</span>{' '}
                              <span className="text-foreground/80">{value}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Troubleshoot Hint — appears after 10s of no data */}
        {showTroubleshootHint && !showTroubleshootWizard && (
          <div
            data-testid="troubleshoot-hint-banner"
            className="flex items-center gap-2 text-xs text-[#00F0FF] bg-[#00F0FF]/5 border border-[#00F0FF]/20 rounded px-2 py-1.5"
          >
            <HelpCircle className="w-3 h-3 shrink-0" />
            <span className="flex-1">No data received for 10 seconds.</span>
            <Button
              data-testid="troubleshoot-open-btn"
              variant="outline"
              size="sm"
              className="h-5 text-[10px] px-2 border-[#00F0FF]/30 text-[#00F0FF] hover:bg-[#00F0FF]/10"
              onClick={() => setShowTroubleshootWizard(true)}
            >
              Troubleshoot
            </Button>
            <button
              data-testid="troubleshoot-hint-dismiss"
              className="p-0.5 text-[#00F0FF]/50 hover:text-[#00F0FF] transition-colors"
              onClick={() => setShowTroubleshootHint(false)}
              aria-label="Dismiss troubleshoot hint"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Troubleshoot Wizard */}
        {showTroubleshootWizard && (
          <Suspense fallback={<div className="p-3 text-xs text-muted-foreground">Loading troubleshooter...</div>}>
            <TroubleshootWizard
              context={{
                isConnected: isConnected,
                baudRate: state.baudRate,
                baudMismatchDismissed: baudWarningDismissed,
                bytesReceived: state.bytesReceived,
                hasGarbledData: state.bytesReceived > 0 && state.monitor.length > 0
                  && nonPrintableRatio(
                    state.monitor
                      .filter((l) => l.direction === 'rx')
                      .map((l) => l.data)
                      .join(''),
                  ) > 0.3,
                detectedDeviceLabel: serialDevicePreflight.detectedDeviceLabel,
                arduinoProfileLabel: serialDevicePreflight.arduinoProfileLabel,
                boardSafetyLabel: serialDevicePreflight.boardSafetyLabel,
                boardBlockerReason: serialDevicePreflight.blockerReason,
                selectedBoard: normalizedBoardFilter || undefined,
              } satisfies SerialContext}
              onClose={() => {
                setShowTroubleshootWizard(false);
                setShowTroubleshootHint(false);
              }}
            />
          </Suspense>
        )}
      </div>

      {/* Monitor Output (visible when monitor tab active) */}
      {activeTab === 'monitor' && (
        <ScrollArea className="flex-1 min-h-0">
          {copilotResult && (
            <div className="m-2 p-3 bg-primary/10 border border-primary/20 rounded-md relative text-foreground">
              <Button 
                variant="ghost" 
                size="sm" 
                className="absolute top-1 right-1 h-6 w-6 p-0 hover:bg-primary/20 text-muted-foreground"
                onClick={() => setCopilotResult(null)}
              >
                <X className="w-3 h-3" />
              </Button>
              <div className="flex items-center gap-2 mb-2 text-primary font-bold text-xs uppercase tracking-wider">
                <Wand2 className="w-4 h-4" />
                Hardware Co-Debug Analysis
              </div>
              <div className="text-xs prose prose-invert prose-p:leading-snug prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 max-w-none">
                {/* For safety in a text area, we just render the raw string, or use a markdown component if available. We will just render simple text blocks. */}
                {copilotResult.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </div>
          )}
          <div
            data-testid="serial-monitor-output"
            className="p-2 font-mono text-xs leading-relaxed"
          >
            {(!isReplaying && state.monitor.length === 0) || (isReplaying && replayData.length === 0) ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                {isConnected || isReplaying ? (
                  <ZapOff className="w-8 h-8 opacity-50" />
                ) : (
                  <Zap className="w-8 h-8 opacity-50" />
                )}
                <span className="text-sm">
                  {isReplaying
                    ? 'Waiting for replay data...'
                    : isConnected
                    ? 'Waiting for data...'
                    : 'Connect to a device to start monitoring'}
                </span>
              </div>
            ) : (
              (isReplaying ? replayData : state.monitor).map((line: SerialMonitorLine, i: number) => (
                <div
                  key={`${String(line.timestamp)}-${String(i)}`}
                  className={cn(
                    'flex gap-2 py-0.5 hover:bg-muted/30 rounded-sm px-1',
                    line.direction === 'tx' && 'text-[#00F0FF]',
                    line.direction === 'rx' && 'text-emerald-300',
                  )}
                >
                  {showTimestamps && (
                    <span className="text-muted-foreground shrink-0 tabular-nums select-none">
                      [{formatTimestamp(line.timestamp)}]
                    </span>
                  )}
                  <span className="text-muted-foreground shrink-0 select-none w-4 text-center">
                    {line.direction === 'tx' ? '>' : '<'}
                  </span>
                  <span className="break-all whitespace-pre-wrap">{line.data}</span>
                </div>
              ))
            )}
            <div ref={monitorEndRef} />
          </div>
        </ScrollArea>
      )}

      {/* Telemetry Dashboard (visible when dashboard tab active) */}
      {activeTab === 'dashboard' && (
        <Suspense fallback={<div className="flex-1 flex items-center justify-center text-xs text-muted-foreground">Loading dashboard...</div>}>
          <TelemetryDashboard />
        </Suspense>
      )}

      {/* Stats Bar + Recording Controls */}
      {isConnected && (
        <div data-testid="serial-stats-bar" className="border-t border-b border-border bg-card/40 px-3 py-1 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>RX: {state.bytesReceived.toLocaleString()} B</span>
          <span>TX: {state.bytesSent.toLocaleString()} B</span>
          <span>{state.monitor.length} lines</span>

          <div className="h-3 w-px bg-border" />

          <Button
            data-testid="serial-record-btn"
            variant="ghost"
            size="sm"
            className={cn(
              'h-5 text-[10px] gap-1 px-1.5',
              loggerSnap.recording && 'text-red-400 hover:text-red-300',
            )}
            onClick={handleToggleRecording}
            title={loggerSnap.recording ? 'Stop recording' : 'Start recording serial output'}
          >
            <Circle
              className={cn(
                'w-2.5 h-2.5',
                loggerSnap.recording ? 'fill-red-500 text-red-500 animate-pulse' : 'text-muted-foreground',
              )}
            />
            {loggerSnap.recording ? 'Stop' : 'Record'}
          </Button>

          {loggerSnap.recording && (
            <>
              <span data-testid="serial-record-duration" className="text-red-400 tabular-nums">
                {formatRecordingDuration(serialLoggerRef.current.getRecordingDuration())}
              </span>
              <span data-testid="serial-record-size" className="text-red-400 tabular-nums">
                {formatRecordingSize(loggerSnap.size)}
              </span>
            </>
          )}

          {!loggerSnap.recording && loggerSnap.hasData && (
            <Button
              data-testid="serial-download-recording-btn"
              variant="ghost"
              size="sm"
              className="h-5 text-[10px] gap-1 px-1.5 text-[#00F0FF] hover:text-[#00F0FF]/80"
              onClick={handleDownloadRecording}
              title="Download recorded serial output"
            >
              <Download className="w-2.5 h-2.5" />
              Download
            </Button>
          )}

          {!loggerSnap.recording && (
            <>
              <input
                type="file"
                accept=".json"
                ref={replayFileRef}
                style={{ display: 'none' }}
                onChange={handleLoadReplay}
              />
              {!isReplaying ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] gap-1 px-1.5 text-emerald-400 hover:text-emerald-300"
                  onClick={() => replayFileRef.current?.click()}
                  title="Load and replay a recorded session"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Replay
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] gap-1 px-1.5 text-red-400 hover:text-red-300"
                  onClick={handleStopReplay}
                  title="Stop playback"
                >
                  <X className="w-2.5 h-2.5" />
                  Stop Replay
                </Button>
              )}
            </>
          )}
        </div>
      )}

      {/* Command Sandbox */}
      <DeviceCommandSandbox 
        onSendCommand={(cmd) => {
          setSendValue(cmd);
          // Small delay to ensure state updates before sending
          setTimeout(() => {
            const btn = document.querySelector('[data-testid="serial-send-btn"]') as HTMLButtonElement;
            if (btn) btn.click();
          }, 50);
        }} 
        disabled={!isConnected} 
      />

      {/* Send Input + Actions */}
      <div className="border-t border-border bg-card/60 p-2 flex items-center gap-2">
        <Input
          ref={sendInputRef}
          data-testid="serial-send-input"
          type="text"
          placeholder={isConnected ? 'Type a message and press Enter...' : 'Connect to a device first'}
          aria-label="Serial message"
          value={sendValue}
          onChange={(e) => setSendValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={!isConnected}
          className="h-8 text-xs font-mono flex-1"
        />
        <Button
          data-testid="serial-send-btn"
          variant="default"
          size="sm"
          onClick={() => void handleSend()}
          disabled={!isConnected || !sendValue.trim()}
          className="h-8 text-xs gap-1"
        >
          <Send className="w-3 h-3" />
          Send
        </Button>
        <Button
          data-testid="serial-reset-btn"
          variant="outline"
          size="sm"
          onClick={() => void handleResetBoard()}
          disabled={!isConnected}
          className="h-8 text-xs gap-1"
          title="Reset board (toggle DTR)"
        >
          <RotateCcw className="w-3 h-3" />
        </Button>
        <Button
          data-testid="serial-clear-btn"
          variant="outline"
          size="sm"
          onClick={clearMonitor}
          className="h-8 text-xs gap-1"
          title="Clear monitor"
        >
          <Trash2 className="w-3 h-3" />
        </Button>
        <Button
          data-testid="serial-copilot-btn"
          variant="secondary"
          size="sm"
          onClick={() => copilotMutation.mutate()}
          disabled={copilotMutation.isPending || !coDebugReadiness.canRun}
          className="h-8 text-xs gap-1 bg-primary/10 text-primary hover:bg-primary/20"
          title={coDebugReadiness.blockedReason ?? coDebugReadiness.title}
        >
          {copilotMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
          AI Copilot
        </Button>
      </div>
    </div>
  );
}
