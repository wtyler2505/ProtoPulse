import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BoardScene } from '@/lib/board-viewer-3d';
import { LayerPanel } from '../LayerPanel';
import type { WebGLLayerSettings } from '../../layer-settings';

const layers: BoardScene['layers'] = [
  {
    type: 'substrate',
    zOffset: 0,
    thickness: 1.6,
    color: '#2d5016',
    opacity: 1,
    visible: true,
  },
  {
    type: 'top-copper',
    zOffset: 1.64,
    thickness: 0.035,
    color: '#b87333',
    opacity: 0.85,
    visible: true,
  },
];

const settings: WebGLLayerSettings = {
  substrate: { visible: true, opacity: 1 },
  'top-copper': { visible: false, opacity: 0.55 },
};

describe('LayerPanel', () => {
  it('renders layer visibility and opacity controls', () => {
    render(<LayerPanel layers={layers} settings={settings} onToggleLayer={vi.fn()} onSetLayerOpacity={vi.fn()} />);

    expect(screen.getByTestId('viewer-3d-webgl-layer-panel').getAttribute('data-visible-layer-count')).toBe('1');
    expect(screen.getByText('Substrate')).toBeInTheDocument();
    expect(screen.getByText('Top copper')).toBeInTheDocument();
    expect(screen.getByTestId('viewer-3d-webgl-layer-row-top-copper').getAttribute('data-visible')).toBe('false');
    expect(screen.getByTestId('viewer-3d-webgl-layer-row-top-copper').getAttribute('data-opacity')).toBe('0.55');
  });

  it('calls visibility and opacity handlers', () => {
    const onToggleLayer = vi.fn();
    const onSetLayerOpacity = vi.fn();
    render(
      <LayerPanel
        layers={layers}
        settings={settings}
        onToggleLayer={onToggleLayer}
        onSetLayerOpacity={onSetLayerOpacity}
      />,
    );

    fireEvent.click(screen.getByTestId('viewer-3d-webgl-layer-toggle-substrate'));
    fireEvent.change(screen.getByTestId('viewer-3d-webgl-layer-opacity-substrate'), { target: { value: '65' } });

    expect(onToggleLayer).toHaveBeenCalledWith('substrate');
    expect(onSetLayerOpacity).toHaveBeenCalledWith('substrate', 0.65);
  });

  it('collapses without removing the reachable panel header', () => {
    render(<LayerPanel layers={layers} settings={settings} onToggleLayer={vi.fn()} onSetLayerOpacity={vi.fn()} />);

    fireEvent.click(screen.getByTestId('viewer-3d-webgl-layer-panel-collapse'));

    expect(screen.getByTestId('viewer-3d-webgl-layer-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-3d-webgl-layer-row-substrate')).toBeNull();
  });
});
