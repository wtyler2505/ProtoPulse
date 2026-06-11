import {
  normalizeViewer3DBridgeTarget,
  publishViewer3DBridgeTarget,
  readViewer3DBridgeTarget,
  writeViewer3DBridgeTarget,
  type Viewer3DBridgeTarget,
} from '@/lib/viewer-3d-bridge';

export const BREADBOARD_3D_BRIDGE_EVENT = 'protopulse:breadboard-view-in-3d';

export type Breadboard3DBridgeTarget = Viewer3DBridgeTarget & {
  sourceView: 'breadboard';
  projectId: number;
  circuitId: number;
  instanceId: number;
  refDes: string;
  pinMapConfidence: string;
};

function isBreadboardTarget(target: Viewer3DBridgeTarget | null): target is Breadboard3DBridgeTarget {
  return target?.sourceView === 'breadboard' &&
    typeof target.projectId === 'number' &&
    typeof target.circuitId === 'number' &&
    typeof target.instanceId === 'number' &&
    typeof target.refDes === 'string' &&
    typeof target.pinMapConfidence === 'string';
}

export function readBreadboard3DBridgeTarget(): Breadboard3DBridgeTarget | null {
  const target = readViewer3DBridgeTarget();
  return isBreadboardTarget(target) ? target : null;
}

export function writeBreadboard3DBridgeTarget(target: Breadboard3DBridgeTarget): void {
  writeViewer3DBridgeTarget(target);
}

export function normalizeBreadboard3DBridgeTarget(value: unknown): Breadboard3DBridgeTarget | null {
  const target = normalizeViewer3DBridgeTarget(value);
  return isBreadboardTarget(target) ? target : null;
}

export function publishBreadboard3DBridgeTarget(target: Omit<Breadboard3DBridgeTarget, 'createdAt'>): Breadboard3DBridgeTarget {
  return publishViewer3DBridgeTarget(target, {
    additionalEvents: [BREADBOARD_3D_BRIDGE_EVENT],
  }) as Breadboard3DBridgeTarget;
}
