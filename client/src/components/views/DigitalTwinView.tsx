/**
 * DigitalTwinView — Live hardware monitoring and sim-vs-actual comparison
 *
 * Four-section layout:
 *   1. Connection bar: device info, connect/disconnect, frame rate
 *   2. Live values grid: channel cards with current value + staleness
 *   3. Comparison table: sim vs actual with color-coded status
 *   4. Firmware generator dialog
 *
 * Uses the useDeviceShadow() hook for state; does NOT import WebSerialManager directly.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useDeviceShadow } from '@/lib/digital-twin/device-shadow';
import { DeviceShadow } from '@/lib/digital-twin/device-shadow';
import type { ChannelState, ShadowState } from '@/lib/digital-twin/device-shadow';
import { compareCircuit, overallHealth, defaultComparisonConfig } from '@/lib/digital-twin/comparison-engine';
import type { ComparisonResult, ComparisonConfig } from '@/lib/digital-twin/comparison-engine';
import { generateFirmware, boardPinCount } from '@/lib/digital-twin/firmware-templates';
import type { FirmwareConfig, BoardType, PinConfig } from '@/lib/digital-twin/firmware-templates';
import { TelemetryLogger } from '@/lib/digital-twin/telemetry-logger';
import { TelemetryShadowBridge } from '@/lib/telemetry-shadow-bridge';
import { WebSerialManager } from '@/lib/web-serial';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionBar({
  state,
  onConnect,
  onDisconnect,
}: {
  state: ShadowState;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const boardName = state.manifest?.board ?? 'No device';
  const firmware = state.manifest?.firmware ?? '';

  return (
    <div
      className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
      data-testid="connection-bar"
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'h-3 w-3 rounded-full',
            state.connected ? 'bg-green-500' : 'bg-red-500',
          )}
          data-testid="connection-indicator"
        />
        <div>
          <div className="text-sm font-medium" data-testid="device-name">
            {boardName}
          </div>
          {firmware && (
            <div className="text-xs text-muted-foreground" data-testid="firmware-version">
              Firmware: {firmware}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {state.connected && state.frameRate > 0 && (
          <span className="text-xs text-muted-foreground" data-testid="frame-rate">
            {state.frameRate.toFixed(1)} Hz
          </span>
        )}
        <button
          className={cn(
            'rounded-md px-3 py-1.5 text-sm font-medium',
            state.connected
              ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
              : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
          onClick={state.connected ? onDisconnect : onConnect}
          data-testid={state.connected ? 'disconnect-button' : 'connect-button'}
        >
          {state.connected ? 'Disconnect' : 'Connect'}
        </button>
      </div>
    </div>
  );
}

function ChannelCard({
  channelId,
  channelState,
  channelName,
  onSetDesired,
}: {
  channelId: string;
  channelState: ChannelState;
  channelName: string;
  onSetDesired: (value: number | boolean) => void;
}) {
  const displayValue = typeof channelState.value === 'boolean'
    ? (channelState.value ? 'HIGH' : 'LOW')
    : typeof channelState.value === 'number'
      ? channelState.value.toFixed(2)
      : channelState.value;

  return (
    <div
      className={cn(
        'rounded-lg border border-border bg-card p-3',
        channelState.stale && 'opacity-50',
      )}
      data-testid={`channel-card-${channelId}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{channelName}</span>
        {channelState.stale && (
          <span className="text-xs text-yellow-500" data-testid={`stale-indicator-${channelId}`}>
            STALE
          </span>
        )}
      </div>
      <div className="mt-1 text-2xl font-mono font-bold" data-testid={`channel-value-${channelId}`}>
        {displayValue}
      </div>
      {typeof channelState.value === 'boolean' && (
        <button
          className="mt-2 rounded bg-muted px-2 py-1 text-xs"
          onClick={() => onSetDesired(!channelState.value)}
          data-testid={`toggle-${channelId}`}
        >
          Toggle
        </button>
      )}
    </div>
  );
}

function LiveValuesGrid({
  state,
  onSetDesired,
}: {
  state: ShadowState;
  onSetDesired: (channel: string, value: number | boolean) => void;
}) {
  const channels = Array.from(state.reported.entries());

  if (channels.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground" data-testid="no-channels">
        No channels available. Connect a device to see live values.
      </div>
    );
  }

  // Look up channel names from manifest
  const nameMap = new Map<string, string>();
  if (state.manifest) {
    for (const ch of state.manifest.channels) {
      nameMap.set(ch.id, ch.name);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" data-testid="live-values-grid">
      {channels.map(([id, channelState]) => (
        <ChannelCard
          key={id}
          channelId={id}
          channelState={channelState}
          channelName={nameMap.get(id) ?? id}
          onSetDesired={(value) => onSetDesired(id, value)}
        />
      ))}
    </div>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case 'match':
      return 'text-green-500';
    case 'warn':
      return 'text-yellow-500';
    case 'fail':
      return 'text-red-500';
    default:
      return 'text-muted-foreground';
  }
}

function statusBadge(status: string): string {
  switch (status) {
    case 'match':
      return 'PASS';
    case 'warn':
      return 'WARN';
    case 'fail':
      return 'FAIL';
    default:
      return 'N/A';
  }
}

function ComparisonTable({
  results,
}: {
  results: ComparisonResult[];
}) {
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center text-muted-foreground" data-testid="no-comparison">
        No comparison data. Run a simulation and connect a device to compare.
      </div>
    );
  }

  const health = overallHealth(results);

  return (
    <div data-testid="comparison-table">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-medium">Overall:</span>
        <span className={cn('text-sm font-bold', statusColor(health.status))} data-testid="overall-health">
          {statusBadge(health.status)}
        </span>
        <span className="text-xs text-muted-foreground">
          ({health.passCount} pass, {health.warnCount} warn, {health.failCount} fail)
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted-foreground">
            <th className="pb-2 pr-3">Channel</th>
            <th className="pb-2 pr-3">Simulated</th>
            <th className="pb-2 pr-3">Measured</th>
            <th className="pb-2 pr-3">Deviation</th>
            <th className="pb-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.channelId} className="border-b border-border/50" data-testid={`comparison-row-${r.channelId}`}>
              <td className="py-1.5 pr-3 font-medium">{r.channelName}</td>
              <td className="py-1.5 pr-3 font-mono">
                {r.simulated !== null ? r.simulated.toFixed(3) : '—'}
              </td>
              <td className="py-1.5 pr-3 font-mono">
                {r.measured !== null ? r.measured.toFixed(3) : '—'}
              </td>
              <td className="py-1.5 pr-3 font-mono">
                {r.deviationPercent !== null ? `${r.deviationPercent.toFixed(1)}%` : '—'}
              </td>
              <td className={cn('py-1.5 font-bold', statusColor(r.status))}>
                {statusBadge(r.status)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FirmwareDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [board, setBoard] = useState<BoardType>('arduino_uno');
  const [baudRate, setBaudRate] = useState(115200);
  const [sampleRate, setSampleRate] = useState(10);
  const [pins, setPins] = useState<PinConfig[]>([]);
  const [generated, setGenerated] = useState<string | null>(null);

  const pinInfo = useMemo(() => boardPinCount(board), [board]);

  const addPin = useCallback(() => {
    setPins((prev) => [
      ...prev,
      {
        pin: 0,
        id: `pin_${prev.length}`,
        name: `Pin ${prev.length}`,
        type: 'digital_in' as const,
      },
    ]);
  }, []);

  const removePin = useCallback((index: number) => {
    setPins((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleGenerate = useCallback(() => {
    const config: FirmwareConfig = {
      board,
      baudRate,
      sampleRateHz: sampleRate,
      pins,
      includeManifest: true,
      includeDesiredHandler: true,
    };
    setGenerated(generateFirmware(config));
  }, [board, baudRate, sampleRate, pins]);

  const handleCopy = useCallback(() => {
    if (generated) {
      void navigator.clipboard.writeText(generated);
    }
  }, [generated]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="firmware-dialog">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Generate Firmware</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="close-firmware-dialog">
            X
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Board</label>
            <select
              value={board}
              onChange={(e) => setBoard(e.target.value as BoardType)}
              className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm"
              data-testid="board-select"
            >
              <option value="arduino_uno">Arduino Uno</option>
              <option value="arduino_mega">Arduino Mega 2560</option>
              <option value="arduino_nano">Arduino Nano</option>
              <option value="esp32">ESP32-DevKit</option>
              <option value="esp32_s3">ESP32-S3</option>
            </select>
            <span className="text-xs text-muted-foreground">
              {pinInfo.digital} digital, {pinInfo.analog} analog, {pinInfo.pwm} PWM
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Baud Rate</label>
              <select
                value={baudRate}
                onChange={(e) => setBaudRate(Number(e.target.value))}
                className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm"
                data-testid="baud-rate-select"
              >
                <option value={9600}>9600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Sample Rate (Hz)</label>
              <input
                type="number"
                value={sampleRate}
                onChange={(e) => setSampleRate(Number(e.target.value))}
                min={1}
                max={100}
                className="mt-1 block w-full rounded-md border border-border bg-background p-2 text-sm"
                data-testid="sample-rate-input"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Pins ({pins.length})</label>
              <button
                onClick={addPin}
                className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
                data-testid="add-pin-button"
              >
                Add Pin
              </button>
            </div>
            {pins.map((pin, i) => (
              <div key={i} className="mt-2 flex items-center gap-2">
                <input
                  value={pin.id}
                  onChange={(e) => {
                    const updated = [...pins];
                    updated[i] = { ...updated[i], id: e.target.value };
                    setPins(updated);
                  }}
                  className="w-20 rounded border border-border bg-background p-1 text-xs"
                  placeholder="ID"
                  data-testid={`pin-id-${i}`}
                />
                <input
                  type="number"
                  value={pin.pin}
                  onChange={(e) => {
                    const updated = [...pins];
                    updated[i] = { ...updated[i], pin: Number(e.target.value) };
                    setPins(updated);
                  }}
                  className="w-16 rounded border border-border bg-background p-1 text-xs"
                  placeholder="Pin"
                  data-testid={`pin-number-${i}`}
                />
                <select
                  value={pin.type}
                  onChange={(e) => {
                    const updated = [...pins];
                    updated[i] = { ...updated[i], type: e.target.value as PinConfig['type'] };
                    setPins(updated);
                  }}
                  className="rounded border border-border bg-background p-1 text-xs"
                  data-testid={`pin-type-${i}`}
                >
                  <option value="digital_in">Digital In</option>
                  <option value="digital_out">Digital Out</option>
                  <option value="analog_in">Analog In</option>
                  <option value="pwm_out">PWM Out</option>
                </select>
                <button
                  onClick={() => removePin(i)}
                  className="text-xs text-destructive"
                  data-testid={`remove-pin-${i}`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            className="w-full rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground"
            data-testid="generate-firmware-button"
          >
            Generate Sketch
          </button>

          {generated && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">Generated Code</span>
                <button
                  onClick={handleCopy}
                  className="text-xs text-primary"
                  data-testid="copy-firmware-button"
                >
                  Copy
                </button>
              </div>
              <pre
                className="max-h-64 overflow-y-auto rounded-md bg-muted p-3 font-mono text-xs"
                data-testid="firmware-code"
              >
                {generated}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export default function DigitalTwinView() {
  const shadowState = useDeviceShadow();
  const [showFirmware, setShowFirmware] = useState(false);
  const [simulationResults] = useState<Map<string, number>>(() => new Map());
  const [comparisonConfig] = useState<ComparisonConfig>(defaultComparisonConfig);
  const bridgeInitialized = useRef(false);

  // Initialize TelemetryShadowBridge to persist telemetry to IndexedDB
  useEffect(() => {
    if (bridgeInitialized.current) {
      return;
    }
    bridgeInitialized.current = true;

    const shadow = DeviceShadow.getInstance();
    const logger = TelemetryLogger.getInstance();
    const bridge = TelemetryShadowBridge.getInstance();

    void bridge.connectLogger(shadow, logger);

    return () => {
      bridge.disconnect();
      bridgeInitialized.current = false;
    };
  }, []);

  // Compute comparison results
  const comparisonResults = useMemo(() => {
    return compareCircuit(
      {
        reported: shadowState.reported,
        manifest: shadowState.manifest,
      },
      simulationResults,
      comparisonConfig,
    );
  }, [shadowState.reported, shadowState.manifest, simulationResults, comparisonConfig]);

  const handleConnect = useCallback(async () => {
    if (!WebSerialManager.isSupported()) {
      return;
    }
    const manager = WebSerialManager.getInstance();
    const portOk = await manager.requestPort();
    if (!portOk) {
      return;
    }
    const connected = await manager.connect({ baudRate: 115200 });
    if (connected) {
      shadowState.attachSerial(manager);
    }
  }, [shadowState]);

  const handleDisconnect = useCallback(() => {
    shadowState.detachSerial();
  }, [shadowState]);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4" data-testid="digital-twin-view">
      {/* Section 1: Connection bar */}
      <ConnectionBar
        state={shadowState}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Section 2: Live values */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-medium">Live Channel Values</h3>
          <button
            onClick={() => setShowFirmware(true)}
            className="rounded bg-muted px-2 py-1 text-xs"
            data-testid="open-firmware-dialog"
          >
            Generate Firmware
          </button>
        </div>
        <LiveValuesGrid
          state={shadowState}
          onSetDesired={shadowState.setDesired}
        />
      </div>

      {/* Section 3: Comparison table */}
      <div>
        <h3 className="mb-2 text-sm font-medium">Simulation vs Actual</h3>
        <ComparisonTable results={comparisonResults} />
      </div>

      {/* Section 4: Firmware dialog */}
      <FirmwareDialog open={showFirmware} onClose={() => setShowFirmware(false)} />
    </div>
  );
}
