import type { MenuContextType, RadialSlot, TargetKind } from '@/lib/radial-menu-actions';

export type RadialTelemetryEventName =
  | 'visible-open'
  | 'keyboard-open'
  | 'visible-mounted'
  | 'visible-select'
  | 'visible-repeat-ai'
  | 'ai-draft'
  | 'ai-send-now'
  | 'destructive-confirm-requested'
  | 'destructive-undo-offered'
  | 'destructive-undo-run'
  | 'customize-open'
  | 'mark-start'
  | 'mark-threshold'
  | 'mark-select'
  | 'mark-confirm-required'
  | 'mark-cancel';

export interface RadialTelemetryEvent {
  name: RadialTelemetryEventName;
  timestamp: number;
  view: MenuContextType;
  target: TargetKind;
  commandId?: string;
  slot?: RadialSlot;
  durationMs?: number;
  distancePx?: number;
  actionCount?: number;
  intent?: string;
  promptChars?: number;
  reason?: string;
}

declare global {
  interface Window {
    __protopulseRadialTelemetry?: {
      events: RadialTelemetryEvent[];
    };
  }
}

const MAX_EVENTS = 120;
const RADIAL_TELEMETRY_EVENT = 'protopulse:radial-telemetry';

function notifyRadialTelemetrySubscribers(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.dispatchEvent(new CustomEvent(RADIAL_TELEMETRY_EVENT));
}

export function recordRadialTelemetry(event: Omit<RadialTelemetryEvent, 'timestamp'>): void {
  if (typeof window === 'undefined' || typeof performance === 'undefined') {
    return;
  }

  const telemetry = window.__protopulseRadialTelemetry ?? { events: [] };
  telemetry.events.push({
    ...event,
    timestamp: performance.now(),
  });

  if (telemetry.events.length > MAX_EVENTS) {
    telemetry.events.splice(0, telemetry.events.length - MAX_EVENTS);
  }

  window.__protopulseRadialTelemetry = telemetry;
  notifyRadialTelemetrySubscribers();
}

export function readRadialTelemetry(): RadialTelemetryEvent[] {
  if (typeof window === 'undefined') {
    return [];
  }
  return [...(window.__protopulseRadialTelemetry?.events ?? [])];
}

export function clearRadialTelemetry(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.__protopulseRadialTelemetry = { events: [] };
  notifyRadialTelemetrySubscribers();
}

export function subscribeRadialTelemetry(listener: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  window.addEventListener(RADIAL_TELEMETRY_EVENT, listener);
  return () => window.removeEventListener(RADIAL_TELEMETRY_EVENT, listener);
}
