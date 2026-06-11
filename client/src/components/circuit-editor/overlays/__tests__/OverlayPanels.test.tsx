import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TldrawOverlayPanel from '@/components/circuit-editor/overlays/TldrawOverlayPanel';
import ThreeOverlayPanel from '@/components/circuit-editor/overlays/ThreeOverlayPanel';

describe('TSCircuit overlay panels', () => {
  it('renders tldraw overlay container', () => {
    render(<TldrawOverlayPanel />);
    expect(screen.getByTestId('tscircuit-tldraw-overlay')).toBeInTheDocument();
  });

  it('renders three overlay container', () => {
    render(<ThreeOverlayPanel />);
    expect(screen.getByTestId('tscircuit-three-overlay')).toBeInTheDocument();
  });
});
