import { describe, expect, it } from 'vitest';
import { createTSCircuitScene } from '@/lib/tscircuit-render-bridge';

function makeHost(): HTMLElement {
  const host = document.createElement('div');
  document.body.appendChild(host);
  return host;
}

describe('createTSCircuitScene', () => {
  it('renders base scene bridge and disposes cleanly', () => {
    const host = makeHost();
    const handle = createTSCircuitScene(host, {
      circuitId: 1,
      circuitName: 'Test Circuit',
      instanceCount: 1,
      netCount: 1,
      ercCount: 0,
      ercViolations: [],
      overlayMode: 'tldraw',
    });

    expect(host.querySelector('[data-testid="tscircuit-scene-root"]')).not.toBeNull();
    // Overlay libraries now render in React panels (adapter), not in bridge DOM.
    const overlay = host.querySelector('[data-testid="tscircuit-tldraw-overlay"]') as HTMLElement | null;
    expect(overlay).toBeNull();
    const nodeA = host.querySelector('[data-testid="tscircuit-tldraw-node-a"]') as HTMLElement | null;
    expect(nodeA).toBeNull();
    expect(host.querySelector('[data-testid="tscircuit-three-overlay"]')).toBeNull();

    handle.dispose();
    expect(host.querySelector('[data-testid="tscircuit-scene-root"]')).toBeNull();
  });
});
