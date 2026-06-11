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
import { useToast } from '@/hooks/use-toast';
import { useDeviceShadow } from '@/lib/digital-twin/device-shadow';
import { DeviceShadow } from '@/lib/digital-twin/device-shadow';
import type { ChannelState, ShadowState } from '@/lib/digital-twin/device-shadow';
import { compareCircuit, overallHealth, defaultComparisonConfig } from '@/lib/digital-twin/comparison-engine';
import type { ComparisonResult, ComparisonConfig, ComparisonStatus } from '@/lib/digital-twin/comparison-engine';
import { generateFirmware, boardPinCount } from '@/lib/digital-twin/firmware-templates';
import type { FirmwareConfig, BoardType, PinConfig } from '@/lib/digital-twin/firmware-templates';
import { TelemetryLogger } from '@/lib/digital-twin/telemetry-logger';
import { TelemetryShadowBridge } from '@/lib/telemetry-shadow-bridge';
import { WebSerialManager } from '@/lib/web-serial';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useValidation } from '@/lib/contexts/validation-context';
import {
  publishViewer3DBridgeTarget,
  publishViewer3DRepairTarget,
  type Viewer3DDigitalTwinChannel,
  type Viewer3DRepairDestination,
  type Viewer3DRepairTarget,
} from '@/lib/viewer-3d-bridge';
import { cn } from '@/lib/utils';
import { NumberInput } from '@/components/ui/number-input';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ConnectionBar({
  state,
  onConnect,
  onDisconnect,
  serialSupported = true,
}: {
  state: ShadowState;
  onConnect: () => void;
  onDisconnect: () => void;
  serialSupported?: boolean;
}) {
  const boardName = state.manifest?.board ?? 'No device';
  const firmware = state.manifest?.firmware ?? '';

  return (
    <div
      className="flex items-center justify-between rounded-md border border-border bg-card p-2"
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
            'rounded-md px-3.5 py-2 text-sm font-medium',
            !serialSupported && !state.connected
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : state.connected
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : 'bg-primary text-primary-foreground hover:bg-primary/90',
          )}
          onClick={state.connected ? onDisconnect : onConnect}
          disabled={!serialSupported && !state.connected}
          title={!serialSupported ? 'Web Serial API not supported — use Chrome or Edge' : undefined}
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
        'rounded-md border border-border bg-card p-3',
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
          className="mt-2 rounded bg-muted px-2.5 py-1.5 text-xs"
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

interface DigitalTwinPreviewSummary {
  channelCount: number;
  liveChannelCount: number;
  staleChannelCount: number;
  pinCount: number;
  netCount: number;
  stateConfidence: 'live' | 'stale' | 'manifest-only' | 'unconfigured';
  healthStatus: ComparisonStatus | 'no-comparison';
}

interface DigitalTwinNextAction {
  id: 'firmware' | 'breadboard' | 'viewer-3d' | 'component-editor';
  label: string;
  description: string;
}

function getDigitalTwinPreviewSummary(
  state: ShadowState,
  comparisonResults: ComparisonResult[],
): DigitalTwinPreviewSummary {
  const channels = Array.from(state.reported.values());
  const manifestChannels = state.manifest?.channels ?? [];
  const channelCount = manifestChannels.length > 0 ? manifestChannels.length : channels.length;
  const liveChannelCount = channels.filter((channel) => !channel.stale).length;
  const staleChannelCount = channels.filter((channel) => channel.stale).length;
  const pinCount = new Set(manifestChannels.map((channel) => channel.pin).filter((pin): pin is number => typeof pin === 'number')).size;
  const health = comparisonResults.length > 0 ? overallHealth(comparisonResults).status : 'no-comparison';

  let stateConfidence: DigitalTwinPreviewSummary['stateConfidence'] = 'unconfigured';
  if (liveChannelCount > 0 && staleChannelCount === 0) {
    stateConfidence = 'live';
  } else if (liveChannelCount > 0 || staleChannelCount > 0) {
    stateConfidence = 'stale';
  } else if (channelCount > 0) {
    stateConfidence = 'manifest-only';
  }

  return {
    channelCount,
    liveChannelCount,
    staleChannelCount,
    pinCount,
    netCount: comparisonResults.length,
    stateConfidence,
    healthStatus: health,
  };
}

function formatDigitalTwinChannelValue(value: ChannelState['value'], unit?: string): string {
  const formatted = typeof value === 'boolean'
    ? (value ? 'HIGH' : 'LOW')
    : typeof value === 'number'
      ? value.toFixed(2)
      : value;
  return unit ? `${formatted}${unit}` : String(formatted);
}

function optionalDigitalTwinMetadata(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function inferDigitalTwinRefDes(...values: Array<string | undefined>): string | undefined {
  for (const value of values) {
    if (!value) {
      continue;
    }
    const explicit = value.match(/\[([A-Z]{1,3}\d+[A-Z]?)\]/i) ??
      value.match(/(?:^|[\s])(?:component|part|ref)\s+([A-Z]{1,3}\d+[A-Z]?)(?:\b|$)/i) ??
      value.match(/^([A-Z]{1,3}\d+[A-Z]?)[.:/#_-]/i) ??
      value.match(/\b([A-Z]{1,3}\d+[A-Z]?)\s+(?:pin|channel|net|signal)\b/i);
    if (explicit?.[1]) {
      return explicit[1].toUpperCase();
    }
  }
  return undefined;
}

function inferDigitalTwinPinLabel(id: string, pin?: number): string | undefined {
  const suffix = id.match(/^[A-Z]{1,3}\d+[A-Z]?[.:/#_-]([A-Z0-9_-]+)$/i)?.[1];
  if (suffix) {
    return suffix.toUpperCase();
  }
  return typeof pin === 'number' ? `P${pin}` : undefined;
}

function getDigitalTwinLiveChannels(state: ShadowState): Viewer3DDigitalTwinChannel[] {
  const manifestChannels = state.manifest?.channels ?? [];
  if (manifestChannels.length === 0) {
    return Array.from(state.reported.entries()).map(([id, channel]) => ({
      id,
      name: id,
      value: formatDigitalTwinChannelValue(channel.value),
      state: channel.stale ? 'stale' : 'live',
      refDes: inferDigitalTwinRefDes(id),
      pinLabel: inferDigitalTwinPinLabel(id),
    }));
  }

  return manifestChannels.map((channel) => {
    const reported = state.reported.get(channel.id);
    const metadata = channel as typeof channel & {
      refDes?: unknown;
      pinLabel?: unknown;
      netName?: unknown;
    };
    return {
      id: channel.id,
      name: channel.name,
      value: reported ? formatDigitalTwinChannelValue(reported.value, channel.unit) : 'waiting',
      state: reported ? (reported.stale ? 'stale' : 'live') : 'waiting',
      pin: channel.pin,
      unit: channel.unit,
      refDes: optionalDigitalTwinMetadata(metadata.refDes) ?? inferDigitalTwinRefDes(channel.id, channel.name),
      pinLabel: optionalDigitalTwinMetadata(metadata.pinLabel) ?? inferDigitalTwinPinLabel(channel.id, channel.pin),
      netName: optionalDigitalTwinMetadata(metadata.netName),
    };
  });
}

function getDigitalTwinRepairChannel(channels: Viewer3DDigitalTwinChannel[]): Viewer3DDigitalTwinChannel | undefined {
  return channels.find((channel) => channel.state !== 'live' && (channel.refDes || channel.pinLabel || channel.netName)) ??
    channels.find((channel) => channel.refDes || channel.pinLabel || channel.netName) ??
    channels[0];
}

function buildDigitalTwinRepairTarget({
  destination,
  projectId,
  boardName,
  summary,
  channels,
}: {
  destination: Viewer3DRepairDestination;
  projectId: number;
  boardName?: string;
  summary: DigitalTwinPreviewSummary;
  channels: Viewer3DDigitalTwinChannel[];
}): Omit<Viewer3DRepairTarget, 'createdAt'> {
  const channel = getDigitalTwinRepairChannel(channels);
  const title = channel
    ? `${channel.name} repair context`
    : `${boardName ?? 'Digital Twin'} repair context`;
  const status = `${String(summary.liveChannelCount)}/${String(summary.channelCount)} live channels · health ${summary.healthStatus.replace(/_/g, ' ')}`;

  return {
    sourceView: 'digital-twin',
    destination,
    projectId,
    refDes: channel?.refDes,
    title,
    summary: channel
      ? `${status} · ${channel.refDes ? `${channel.refDes} ` : ''}${channel.pinLabel ?? channel.id}${channel.netName ? ` on ${channel.netName}` : ''}`
      : status,
    trustTier: summary.stateConfidence === 'live' ? 'live-telemetry' : 'telemetry-preview',
    verificationLevel: summary.stateConfidence,
    verificationStatus: summary.healthStatus,
    channelCount: summary.channelCount,
    liveChannelCount: summary.liveChannelCount,
    pinCount: summary.pinCount,
    netCount: summary.netCount,
    healthStatus: summary.healthStatus,
    stateConfidence: summary.stateConfidence,
    channel,
  };
}

function getDigitalTwinNextActions(summary: DigitalTwinPreviewSummary): DigitalTwinNextAction[] {
  const actions: DigitalTwinNextAction[] = [];

  if (summary.stateConfidence === 'unconfigured' || summary.stateConfidence === 'manifest-only') {
    actions.push({
      id: 'firmware',
      label: 'Generate firmware manifest',
      description: 'Map pins and channels before trusting live hardware state.',
    });
  }

  if (summary.staleChannelCount > 0) {
    actions.push({
      id: 'breadboard',
      label: 'Check stale channels on Breadboard',
      description: `${summary.staleChannelCount} channel${summary.staleChannelCount === 1 ? '' : 's'} need wiring or telemetry review.`,
    });
  }

  if (summary.healthStatus === 'warn' || summary.healthStatus === 'fail') {
    actions.push({
      id: 'viewer-3d',
      label: 'Inspect live state in 3D',
      description: 'Review geometry, pins, and telemetry context together.',
    });
    actions.push({
      id: 'component-editor',
      label: 'Re-verify component data',
      description: 'Check exact-part metadata before trusting this comparison.',
    });
  }

  return actions.slice(0, 3);
}

function DigitalTwin3DPreview({
  summary,
  liveChannels,
  onOpen3D,
  onOpenBreadboard,
  onOpenComponentEditor,
  onOpenFirmware,
}: {
  summary: DigitalTwinPreviewSummary;
  liveChannels: Viewer3DDigitalTwinChannel[];
  onOpen3D: () => void;
  onOpenBreadboard: () => void;
  onOpenComponentEditor: () => void;
  onOpenFirmware: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const visibleRows = liveChannels.slice(0, 5);
  const nextActions = getDigitalTwinNextActions(summary);
  const runNextAction = useCallback((actionId: DigitalTwinNextAction['id']) => {
    if (actionId === 'firmware') {
      onOpenFirmware();
      return;
    }
    if (actionId === 'breadboard') {
      onOpenBreadboard();
      return;
    }
    if (actionId === 'viewer-3d') {
      onOpen3D();
      return;
    }
    onOpenComponentEditor();
  }, [onOpen3D, onOpenBreadboard, onOpenComponentEditor, onOpenFirmware]);

  return (
    <section
      className="max-h-[min(32rem,calc(100dvh-8rem))] resize-y overflow-auto rounded-md border border-border bg-card/80 p-3"
      data-collapsed={String(collapsed)}
      data-resizable="true"
      data-testid="digital-twin-3d-preview"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">3D Behavior Preview</h3>
          <span className="rounded border border-cyan-400/40 bg-cyan-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-cyan-100">
            {summary.stateConfidence.replace(/-/g, ' ')}
          </span>
          <span className="rounded border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
            health {summary.healthStatus.replace(/_/g, ' ')}
          </span>
        </div>
        <button
          type="button"
          className="rounded-sm border border-border px-2.5 py-1.5 text-[11px] font-medium"
          data-testid="digital-twin-3d-preview-toggle"
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>

      {!collapsed ? (
        <div
          className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]"
          data-testid="digital-twin-3d-preview-body"
        >
          <div className="min-w-0">
            <div className="relative min-h-36 overflow-hidden rounded-md border border-cyan-400/20 bg-[linear-gradient(135deg,rgba(8,18,28,0.92),rgba(14,15,26,0.96))] p-3">
              <div className="absolute inset-x-8 bottom-6 top-8 rotate-[-3deg] rounded-lg border border-cyan-300/30 bg-cyan-300/8 shadow-[0_0_30px_rgba(34,211,238,0.12)]" />
              <div className="relative grid h-full min-h-28 grid-cols-2 gap-2 sm:grid-cols-3">
                {visibleRows.length > 0 ? visibleRows.map((channel) => {
                  const live = channel.state === 'live';
                  return (
                    <div
                      key={channel.id}
                      className="rounded border border-border/70 bg-background/80 p-2 text-xs"
                      data-testid={`digital-twin-preview-channel-${channel.id}`}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className={cn('h-2 w-2 rounded-full', live ? 'bg-green-400' : 'bg-yellow-400')} />
                        <span className="truncate font-medium">{channel.name}</span>
                      </div>
                      <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
                        {channel.value}
                        {typeof channel.pin === 'number' ? ` / pin ${String(channel.pin)}` : ''}
                        {channel.refDes ? ` / ${channel.refDes}` : ''}
                      </div>
                    </div>
                  );
                }) : (
                  <div className="col-span-full flex items-center justify-center rounded border border-dashed border-border/70 p-5 text-xs text-muted-foreground">
                    No manifest yet. Generate firmware or connect a board to map pins into 3D.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex min-w-0 flex-col justify-between gap-3">
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded border border-border bg-background/70 p-2">
                <div className="text-lg font-semibold" data-testid="digital-twin-live-channel-count">{summary.liveChannelCount}</div>
                <div className="text-muted-foreground">live</div>
              </div>
              <div className="rounded border border-border bg-background/70 p-2">
                <div className="text-lg font-semibold" data-testid="digital-twin-pin-count">{summary.pinCount}</div>
                <div className="text-muted-foreground">pins</div>
              </div>
              <div className="rounded border border-border bg-background/70 p-2">
                <div className="text-lg font-semibold" data-testid="digital-twin-net-count">{summary.netCount}</div>
                <div className="text-muted-foreground">nets</div>
              </div>
            </div>
            {nextActions.length > 0 && (
              <div
                className="space-y-2 rounded-md border border-yellow-400/25 bg-yellow-400/5 p-2"
                data-testid="digital-twin-next-actions"
              >
                <div className="text-[11px] font-semibold uppercase tracking-wide text-yellow-100">
                  Next action
                </div>
                <div className="space-y-1.5">
                  {nextActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      className="block w-full rounded-sm border border-border/80 bg-background/70 px-2 py-1.5 text-left hover:bg-muted/70"
                      onClick={() => runNextAction(action.id)}
                      data-testid={`digital-twin-next-action-${action.id}`}
                    >
                      <span className="block text-[11px] font-medium">{action.label}</span>
                      <span className="block text-[10px] text-muted-foreground">{action.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
                onClick={onOpen3D}
                data-testid="digital-twin-open-3d"
              >
                Open in 3D
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-xs font-medium"
                onClick={onOpenBreadboard}
                data-testid="digital-twin-fix-breadboard"
              >
                Fix in Breadboard
              </button>
              <button
                type="button"
                className="rounded-md border border-border px-3 py-2 text-xs font-medium"
                onClick={onOpenComponentEditor}
                data-testid="digital-twin-fix-component-editor"
              >
                Refine Component
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
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
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground" data-testid="close-firmware-dialog">
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
              <NumberInput
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
                className="rounded bg-primary px-2.5 py-1.5 text-xs text-primary-foreground"
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
                  className="w-24 rounded border border-border bg-background p-1.5 text-xs"
                  placeholder="ID"
                  data-testid={`pin-id-${i}`}
                />
                <NumberInput
                  value={pin.pin}
                  onChange={(e) => {
                    const updated = [...pins];
                    updated[i] = { ...updated[i], pin: Number(e.target.value) };
                    setPins(updated);
                  }}
                  min={0}
                  max={99}
                  className="w-20 rounded border border-border bg-background p-1.5 text-xs"
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
                  className="rounded border border-border bg-background p-1.5 text-xs"
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
            className="w-full rounded-md bg-primary py-2.5 text-sm font-medium text-primary-foreground"
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
  const projectId = useProjectId();
  const shadowState = useDeviceShadow();
  const { addValidationIssue, issues } = useValidation();
  const { setActiveView } = useProjectMeta();
  const [showFirmware, setShowFirmware] = useState(false);
  const [simulationResults] = useState<Map<string, number>>(() => new Map());
  const [comparisonConfig] = useState<ComparisonConfig>(defaultComparisonConfig);
  const bridgeInitialized = useRef(false);
  const { toast } = useToast();

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

  // BL-0577: Digital Twin -> out-of-spec telemetry creates validation issues
  useEffect(() => {
    if (!shadowState.manifest) return;

    for (const channel of shadowState.manifest.channels) {
      const state = shadowState.reported.get(channel.id);
      if (!state || state.stale || typeof state.value !== 'number') continue;

      const value = state.value;
      const min = channel.min;
      const max = channel.max;

      let isOutOfBounds = false;
      let reason = '';

      if (max !== undefined && value > max) {
        isOutOfBounds = true;
        reason = `exceeds maximum bound of ${max}`;
      } else if (min !== undefined && value < min) {
        isOutOfBounds = true;
        reason = `is below minimum bound of ${min}`;
      }

      if (isOutOfBounds) {
        const msg = `Hardware telemetry on ${channel.name} (${value.toFixed(2)}${channel.unit || ''}) ${reason}.`;
        // Only add if not already in issues list
        if (!issues.some(i => i.message === msg)) {
          addValidationIssue({
            severity: 'warning',
            message: msg,
            suggestion: `Check physical hardware limits or adjust expected bounds for ${channel.name}.`,
          });
        }
      }
    }
  }, [shadowState.reported, shadowState.manifest, issues, addValidationIssue]);

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
  const previewSummary = useMemo(
    () => getDigitalTwinPreviewSummary(shadowState, comparisonResults),
    [comparisonResults, shadowState],
  );
  const previewChannels = useMemo(
    () => getDigitalTwinLiveChannels(shadowState),
    [shadowState],
  );

  const handleOpenIn3D = useCallback(() => {
    publishViewer3DBridgeTarget({
      sourceView: 'digital-twin',
      projectId,
      title: shadowState.manifest?.board ? `${shadowState.manifest.board} telemetry` : 'Digital Twin telemetry',
      subtitle: `${String(previewSummary.liveChannelCount)} live of ${String(previewSummary.channelCount)} channel${previewSummary.channelCount === 1 ? '' : 's'}`,
      trustTier: previewSummary.stateConfidence === 'live' ? 'live-telemetry' : 'telemetry-preview',
      verificationLevel: previewSummary.stateConfidence,
      verificationStatus: previewSummary.healthStatus,
      readyNow: previewSummary.liveChannelCount > 0,
      channelCount: previewSummary.channelCount,
      liveChannelCount: previewSummary.liveChannelCount,
      pinCount: previewSummary.pinCount,
      netCount: previewSummary.netCount,
      healthStatus: previewSummary.healthStatus,
      stateConfidence: previewSummary.stateConfidence,
      liveChannels: previewChannels,
      modelKind: 'behavior-preview',
    });
    setActiveView('viewer_3d');
    toast({
      title: 'Opening 3D View',
      description: 'Digital Twin live-state context was sent to the 3D preview.',
    });
  }, [previewChannels, previewSummary, projectId, setActiveView, shadowState.manifest?.board, toast]);

  const publishRepairContext = useCallback((destination: Viewer3DRepairDestination) => {
    const target = publishViewer3DRepairTarget(buildDigitalTwinRepairTarget({
      destination,
      projectId,
      boardName: shadowState.manifest?.board,
      summary: previewSummary,
      channels: previewChannels,
    }));
    toast({
      title: destination === 'breadboard' ? 'Opening Breadboard repair' : 'Opening Component repair',
      description: target.summary ?? 'Digital Twin repair context was sent with the view change.',
    });
  }, [previewChannels, previewSummary, projectId, shadowState.manifest?.board, toast]);

  const handleOpenBreadboardRepair = useCallback(() => {
    publishRepairContext('breadboard');
    setActiveView('breadboard');
  }, [publishRepairContext, setActiveView]);

  const handleOpenComponentRepair = useCallback(() => {
    publishRepairContext('component-editor');
    setActiveView('component_editor');
  }, [publishRepairContext, setActiveView]);

  const handleConnect = useCallback(async () => {
    if (!WebSerialManager.isSupported()) {
      toast({ title: 'Web Serial not supported', description: 'Your browser does not support Web Serial API. Use Chrome or Edge to connect to hardware.', variant: 'destructive' });
      return;
    }
    const manager = WebSerialManager.getInstance();
    const portOk = await manager.requestPort();
    if (!portOk) {
      toast({ title: 'No port selected', description: 'Select a serial port to connect to your device.' });
      return;
    }
    const connected = await manager.connect({ baudRate: 115200 });
    if (connected) {
      shadowState.attachSerial(manager);
      toast({ title: 'Connected', description: 'Device connected successfully.' });
    } else {
      toast({ title: 'Connection failed', description: 'Could not open serial port. Check your device connection.', variant: 'destructive' });
    }
  }, [shadowState, toast]);

  const handleDisconnect = useCallback(() => {
    shadowState.detachSerial();
  }, [shadowState]);

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto p-3" data-testid="digital-twin-view">
      {/* Section 1: Connection bar */}
      <ConnectionBar
        state={shadowState}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
        serialSupported={WebSerialManager.isSupported()}
      />

      <DigitalTwin3DPreview
        summary={previewSummary}
        liveChannels={previewChannels}
        onOpen3D={handleOpenIn3D}
        onOpenBreadboard={handleOpenBreadboardRepair}
        onOpenComponentEditor={handleOpenComponentRepair}
        onOpenFirmware={() => setShowFirmware(true)}
      />

      {/* Section 2: Live values */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Live Channel Values</h3>
          <button
            onClick={() => setShowFirmware(true)}
            className="rounded-sm bg-muted px-2.5 py-1.5 text-[11px]"
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
        <h3 className="mb-2 text-sm font-semibold">Simulation vs Actual</h3>
        <ComparisonTable results={comparisonResults} />
      </div>

      {/* Section 4: Firmware dialog */}
      <FirmwareDialog open={showFirmware} onClose={() => setShowFirmware(false)} />
    </div>
  );
}
