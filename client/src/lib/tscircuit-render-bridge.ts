import type { ERCViolation } from '@shared/circuit-types';

export interface TSCircuitSceneInput {
  circuitId: number;
  circuitName: string;
  instanceCount: number;
  netCount: number;
  ercCount: number;
  ercViolations: ERCViolation[];
  overlayMode?: 'none' | 'tldraw' | 'three';
}

export interface TSCircuitSceneHandle {
  dispose: () => void;
}

/**
 * Phase-1 bridge: sets up a concrete handoff boundary between ProtoPulse data
 * and future tscircuit rendering. Today it renders simple diagnostic content
 * so the adapter has a live mount lifecycle with deterministic cleanup.
 */
export function createTSCircuitScene(host: HTMLElement, input: TSCircuitSceneInput): TSCircuitSceneHandle {
  host.innerHTML = '';

  const root = document.createElement('div');
  root.setAttribute('data-testid', 'tscircuit-scene-root');
  root.className = 'h-full w-full rounded border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground';
  root.textContent = `TSCircuit scene bridge active for ${input.circuitName} (instances ${String(input.instanceCount)}, nets ${String(input.netCount)}, ERC ${String(input.ercCount)}).`;
  host.appendChild(root);

  const cleanupCallbacks: Array<() => void> = [];

  return {
    dispose: () => {
      for (const cb of cleanupCallbacks) {
        cb();
      }
      if (host.contains(root)) {
        host.removeChild(root);
      }
    },
  };
}
