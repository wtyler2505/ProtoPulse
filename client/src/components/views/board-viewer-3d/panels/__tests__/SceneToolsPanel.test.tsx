import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SceneToolsPanel } from '../SceneToolsPanel';

function renderPanel(overrides: Partial<ComponentProps<typeof SceneToolsPanel>> = {}) {
  const props: ComponentProps<typeof SceneToolsPanel> = {
    measureActive: false,
    measurePending: false,
    measureSegmentCount: 0,
    latestMeasureDistanceMm: null,
    sectionEnabled: false,
    sectionConstant: 0,
    sectionRange: { min: -50, max: 50 },
    exploded: false,
    explodeProgress: 0,
    explodeAnimating: false,
    cameraPreset: 'home',
    cameraStatus: 'Home view',
    onToggleMeasure: vi.fn(),
    onClearMeasures: vi.fn(),
    onToggleSection: vi.fn(),
    onSetSectionConstant: vi.fn(),
    onToggleExploded: vi.fn(),
    onCameraPreset: vi.fn(),
    ...overrides,
  };
  render(<SceneToolsPanel {...props} />);
  return props;
}

describe('SceneToolsPanel', () => {
  it('renders measure and section state', () => {
    renderPanel({
      measureActive: true,
      measurePending: true,
      measureSegmentCount: 2,
      latestMeasureDistanceMm: 12.345,
      sectionEnabled: true,
      sectionConstant: 8.5,
      exploded: true,
      explodeProgress: 0.66,
      explodeAnimating: true,
      cameraPreset: 'iso',
      cameraStatus: 'Iso view',
    });

    expect(screen.getByTestId('viewer-3d-webgl-tools-panel').getAttribute('data-measure-active')).toBe('true');
    expect(screen.getByTestId('viewer-3d-webgl-tools-panel').getAttribute('data-section-enabled')).toBe('true');
    expect(screen.getByTestId('viewer-3d-webgl-tools-panel').getAttribute('data-exploded')).toBe('true');
    expect(screen.getByTestId('viewer-3d-webgl-camera-panel-status').textContent).toContain('Iso view');
    expect(screen.getByTestId('viewer-3d-webgl-explode-status').textContent).toContain('66% moving');
    expect(screen.getByTestId('viewer-3d-webgl-measure-status').textContent).toContain('Point A');
    expect(screen.getByTestId('viewer-3d-webgl-measure-status').textContent).toContain('12.35 mm');
    expect(screen.getByText('8.5 mm')).toBeInTheDocument();
  });

  it('calls measure and section handlers', () => {
    const onCameraPreset = vi.fn();
    const onToggleExploded = vi.fn();
    const onToggleMeasure = vi.fn();
    const onClearMeasures = vi.fn();
    const onToggleSection = vi.fn();
    const onSetSectionConstant = vi.fn();
    renderPanel({
      measureSegmentCount: 1,
      sectionEnabled: true,
      onCameraPreset,
      onToggleExploded,
      onToggleMeasure,
      onClearMeasures,
      onToggleSection,
      onSetSectionConstant,
    });

    fireEvent.click(screen.getByTestId('viewer-3d-webgl-camera-iso'));
    fireEvent.click(screen.getByTestId('viewer-3d-webgl-camera-flip'));
    fireEvent.click(screen.getByTestId('viewer-3d-webgl-explode-toggle'));
    fireEvent.click(screen.getByTestId('viewer-3d-webgl-measure-toggle'));
    fireEvent.click(screen.getByTestId('viewer-3d-webgl-measure-clear'));
    fireEvent.click(screen.getByTestId('viewer-3d-webgl-section-toggle'));
    fireEvent.change(screen.getByTestId('viewer-3d-webgl-section-slider'), { target: { value: '17.5' } });

    expect(onCameraPreset).toHaveBeenCalledWith('iso');
    expect(onCameraPreset).toHaveBeenCalledWith('flip');
    expect(onToggleExploded).toHaveBeenCalledTimes(1);
    expect(onToggleMeasure).toHaveBeenCalledTimes(1);
    expect(onClearMeasures).toHaveBeenCalledTimes(1);
    expect(onToggleSection).toHaveBeenCalledTimes(1);
    expect(onSetSectionConstant).toHaveBeenCalledWith(17.5);
  });

  it('collapses without removing the reachable panel header', () => {
    renderPanel();

    fireEvent.click(screen.getByTestId('viewer-3d-webgl-tools-panel-collapse'));

    expect(screen.getByTestId('viewer-3d-webgl-tools-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('viewer-3d-webgl-section-row')).toBeNull();
  });
});
