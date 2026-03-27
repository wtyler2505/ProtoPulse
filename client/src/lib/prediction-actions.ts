import type { AIAction } from '@/components/panels/chat/chat-types';

function readString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function humanizeComponentName(component: string): string {
  return component.replace(/[-_]+/g, ' ').trim();
}

export function getPredictionComponentLabel(payload: Record<string, unknown>): string {
  const explicitLabel = readString(payload, 'label');
  if (explicitLabel) {
    return explicitLabel;
  }

  const parts = [
    readString(payload, 'value'),
    readString(payload, 'type'),
    readString(payload, 'component'),
  ].filter((part): part is string => Boolean(part));

  if (parts.length === 0) {
    return 'Suggested Component';
  }

  return parts
    .map((part, index) => (index === parts.length - 1 ? humanizeComponentName(part) : part))
    .join(' ');
}

export function getPredictionComponentCount(payload: Record<string, unknown>): number {
  const rawCount = payload.count;
  if (typeof rawCount !== 'number' || !Number.isFinite(rawCount)) {
    return 1;
  }

  const count = Math.floor(rawCount);
  return count > 0 ? count : 1;
}

export function buildPredictionAddNodeActions(payload: Record<string, unknown>): AIAction[] {
  const component = readString(payload, 'component') ?? 'component';
  const label = getPredictionComponentLabel(payload);
  const count = getPredictionComponentCount(payload);

  return Array.from({ length: count }, () => ({
    type: 'add_node',
    nodeType: component,
    label,
  }));
}
