import type { ExactPartDraftSeed } from '@shared/exact-part-resolver';

export const VIEWER_3D_BRIDGE_EVENT = 'protopulse:view-in-3d';
export const VIEWER_3D_BRIDGE_STORAGE_KEY = 'protopulse:pending-view-in-3d';
export const VIEWER_3D_REPAIR_EVENT = 'protopulse:digital-twin-repair';
export const VIEWER_3D_REPAIR_STORAGE_KEY = 'protopulse:pending-digital-twin-repair';

export type Viewer3DBridgeSourceView = 'breadboard' | 'component-editor' | 'community' | 'generative' | 'digital-twin';
export type Viewer3DRepairDestination = 'breadboard' | 'component-editor';

export interface Viewer3DDigitalTwinChannel {
  id: string;
  name: string;
  value: string;
  state: 'live' | 'stale' | 'waiting';
  pin?: number;
  unit?: string;
  refDes?: string;
  pinLabel?: string;
  netName?: string;
}

export interface Viewer3DBridgeTarget {
  sourceView: Viewer3DBridgeSourceView;
  projectId?: number;
  circuitId?: number;
  instanceId?: number;
  sourceId?: string;
  refDes?: string;
  title: string;
  subtitle?: string;
  sourceName?: string;
  sourceTrustScore?: number;
  trustTier: string;
  verificationLevel: string;
  verificationStatus: string;
  pinMapConfidence?: string;
  readyNow: boolean;
  componentCount?: number;
  channelCount?: number;
  liveChannelCount?: number;
  pinCount?: number;
  netCount?: number;
  healthStatus?: string;
  stateConfidence?: string;
  liveChannels?: Viewer3DDigitalTwinChannel[];
  boardHealthScore?: number;
  boardHealthCriticalCount?: number;
  boardHealthWarningCount?: number;
  generatedFrom?: string;
  fitnessScore?: number;
  modelFormat?: string;
  modelKind?: string;
  createdAt: number;
}

export interface Viewer3DRepairTarget {
  sourceView: 'digital-twin';
  destination: Viewer3DRepairDestination;
  projectId?: number;
  circuitId?: number;
  instanceId?: number;
  refDes?: string;
  title: string;
  summary?: string;
  trustTier: string;
  verificationLevel: string;
  verificationStatus: string;
  channelCount?: number;
  liveChannelCount?: number;
  pinCount?: number;
  netCount?: number;
  healthStatus?: string;
  stateConfidence?: string;
  channel?: Viewer3DDigitalTwinChannel;
  createdAt: number;
}

function hasSessionStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function isSourceView(value: unknown): value is Viewer3DBridgeSourceView {
  return value === 'breadboard' ||
    value === 'component-editor' ||
    value === 'community' ||
    value === 'generative' ||
    value === 'digital-twin';
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function optionalDigitalTwinChannelState(value: unknown): Viewer3DDigitalTwinChannel['state'] | undefined {
  return value === 'live' || value === 'stale' || value === 'waiting' ? value : undefined;
}

function optionalRepairDestination(value: unknown): Viewer3DRepairDestination | undefined {
  return value === 'breadboard' || value === 'component-editor' ? value : undefined;
}

function normalizeDigitalTwinChannels(value: unknown): Viewer3DDigitalTwinChannel[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const channels = value
    .map((entry): Viewer3DDigitalTwinChannel | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const parsed = entry as Partial<Viewer3DDigitalTwinChannel>;
      const id = optionalString(parsed.id);
      const name = optionalString(parsed.name);
      if (!id || !name) {
        return null;
      }
      return {
        id,
        name,
        value: optionalString(parsed.value) ?? 'waiting',
        state: optionalDigitalTwinChannelState(parsed.state) ?? 'waiting',
        pin: optionalNumber(parsed.pin),
        unit: optionalString(parsed.unit),
        refDes: optionalString(parsed.refDes),
        pinLabel: optionalString(parsed.pinLabel),
        netName: optionalString(parsed.netName),
      };
    })
    .filter((channel): channel is Viewer3DDigitalTwinChannel => channel !== null);

  return channels.length > 0 ? channels.slice(0, 8) : undefined;
}

function normalizeDigitalTwinChannel(value: unknown): Viewer3DDigitalTwinChannel | undefined {
  return normalizeDigitalTwinChannels(value == null ? [] : [value])?.[0];
}

export function parseViewer3DBridgeTarget(raw: string | null): Viewer3DBridgeTarget | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<Viewer3DBridgeTarget>;
    return normalizeViewer3DBridgeTarget(parsed);
  } catch {
    return null;
  }
}

export function normalizeViewer3DBridgeTarget(value: unknown): Viewer3DBridgeTarget | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<Viewer3DBridgeTarget>;
  if (!isSourceView(parsed.sourceView) || typeof parsed.title !== 'string' || parsed.title.trim().length === 0) {
    return null;
  }
  return {
    sourceView: parsed.sourceView,
    projectId: optionalNumber(parsed.projectId),
    circuitId: optionalNumber(parsed.circuitId),
    instanceId: optionalNumber(parsed.instanceId),
    sourceId: optionalString(parsed.sourceId),
    refDes: optionalString(parsed.refDes),
    title: parsed.title,
    subtitle: optionalString(parsed.subtitle),
    sourceName: optionalString(parsed.sourceName),
    sourceTrustScore: optionalNumber(parsed.sourceTrustScore),
    trustTier: optionalString(parsed.trustTier) ?? 'unknown',
    verificationLevel: optionalString(parsed.verificationLevel) ?? 'unknown',
    verificationStatus: optionalString(parsed.verificationStatus) ?? 'unknown',
    pinMapConfidence: optionalString(parsed.pinMapConfidence),
    readyNow: parsed.readyNow === true,
    componentCount: optionalNumber(parsed.componentCount),
    channelCount: optionalNumber(parsed.channelCount),
    liveChannelCount: optionalNumber(parsed.liveChannelCount),
    pinCount: optionalNumber(parsed.pinCount),
    netCount: optionalNumber(parsed.netCount),
    healthStatus: optionalString(parsed.healthStatus),
    stateConfidence: optionalString(parsed.stateConfidence),
    liveChannels: normalizeDigitalTwinChannels(parsed.liveChannels),
    boardHealthScore: optionalNumber(parsed.boardHealthScore),
    boardHealthCriticalCount: optionalNumber(parsed.boardHealthCriticalCount),
    boardHealthWarningCount: optionalNumber(parsed.boardHealthWarningCount),
    generatedFrom: optionalString(parsed.generatedFrom),
    fitnessScore: optionalNumber(parsed.fitnessScore),
    modelFormat: optionalString(parsed.modelFormat),
    modelKind: optionalString(parsed.modelKind),
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
  };
}

export function normalizeViewer3DRepairTarget(value: unknown): Viewer3DRepairTarget | null {
  if (!value || typeof value !== 'object') return null;
  const parsed = value as Partial<Viewer3DRepairTarget>;
  const destination = optionalRepairDestination(parsed.destination);
  if (parsed.sourceView !== 'digital-twin' || !destination || typeof parsed.title !== 'string' || parsed.title.trim().length === 0) {
    return null;
  }
  return {
    sourceView: 'digital-twin',
    destination,
    projectId: optionalNumber(parsed.projectId),
    circuitId: optionalNumber(parsed.circuitId),
    instanceId: optionalNumber(parsed.instanceId),
    refDes: optionalString(parsed.refDes),
    title: parsed.title,
    summary: optionalString(parsed.summary),
    trustTier: optionalString(parsed.trustTier) ?? 'telemetry-preview',
    verificationLevel: optionalString(parsed.verificationLevel) ?? 'unknown',
    verificationStatus: optionalString(parsed.verificationStatus) ?? 'unknown',
    channelCount: optionalNumber(parsed.channelCount),
    liveChannelCount: optionalNumber(parsed.liveChannelCount),
    pinCount: optionalNumber(parsed.pinCount),
    netCount: optionalNumber(parsed.netCount),
    healthStatus: optionalString(parsed.healthStatus),
    stateConfidence: optionalString(parsed.stateConfidence),
    channel: normalizeDigitalTwinChannel(parsed.channel),
    createdAt: typeof parsed.createdAt === 'number' ? parsed.createdAt : Date.now(),
  };
}

export function isViewer3DBridgeTarget(value: unknown): value is Viewer3DBridgeTarget {
  return normalizeViewer3DBridgeTarget(value) !== null;
}

export function readViewer3DBridgeTarget(): Viewer3DBridgeTarget | null {
  if (!hasSessionStorage()) return null;
  return parseViewer3DBridgeTarget(window.sessionStorage.getItem(VIEWER_3D_BRIDGE_STORAGE_KEY));
}

export function readViewer3DRepairTarget(): Viewer3DRepairTarget | null {
  if (!hasSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(VIEWER_3D_REPAIR_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeViewer3DRepairTarget(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeViewer3DBridgeTarget(target: Viewer3DBridgeTarget): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(VIEWER_3D_BRIDGE_STORAGE_KEY, JSON.stringify(target));
  } catch {
    // Session storage is a bridge convenience, not the source of truth.
  }
}

export function writeViewer3DRepairTarget(target: Viewer3DRepairTarget): void {
  if (!hasSessionStorage()) return;
  try {
    window.sessionStorage.setItem(VIEWER_3D_REPAIR_STORAGE_KEY, JSON.stringify(target));
  } catch {
    // Session storage is a bridge convenience, not the source of truth.
  }
}

export function publishViewer3DBridgeTarget(
  target: Omit<Viewer3DBridgeTarget, 'createdAt'>,
  options: { additionalEvents?: string[] } = {},
): Viewer3DBridgeTarget {
  const payload: Viewer3DBridgeTarget = {
    ...target,
    createdAt: Date.now(),
  };
  writeViewer3DBridgeTarget(payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VIEWER_3D_BRIDGE_EVENT, { detail: payload }));
    for (const eventName of options.additionalEvents ?? []) {
      window.dispatchEvent(new CustomEvent(eventName, { detail: payload }));
    }
  }
  return payload;
}

export function publishViewer3DRepairTarget(target: Omit<Viewer3DRepairTarget, 'createdAt'>): Viewer3DRepairTarget {
  const payload: Viewer3DRepairTarget = {
    ...target,
    createdAt: Date.now(),
  };
  writeViewer3DRepairTarget(payload);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(VIEWER_3D_REPAIR_EVENT, { detail: payload }));
  }
  return payload;
}

export function buildViewer3DRepairExactPartSeed(target: Viewer3DRepairTarget): ExactPartDraftSeed {
  const channel = target.channel;
  const subject = target.refDes ?? channel?.refDes ?? target.title;
  const channelDetails = [
    channel?.name ? `channel ${channel.name}` : undefined,
    channel?.id ? `id ${channel.id}` : undefined,
    channel?.pinLabel ? `pin ${channel.pinLabel}` : undefined,
    channel?.netName ? `net ${channel.netName}` : undefined,
    channel?.value ? `value ${channel.value}` : undefined,
  ].filter((value): value is string => Boolean(value));

  return {
    description: [
      `Digital Twin repair context for ${subject}.`,
      target.summary ? `Observed state: ${target.summary}.` : undefined,
      channelDetails.length > 0 ? `Telemetry target: ${channelDetails.join(', ')}.` : undefined,
      'Draft or refine the exact board/module part so real pin labels, connector positions, breadboard anchors, and 3D model geometry can be verified before wiring changes are trusted.',
    ].filter((value): value is string => Boolean(value)).join(' '),
  };
}
