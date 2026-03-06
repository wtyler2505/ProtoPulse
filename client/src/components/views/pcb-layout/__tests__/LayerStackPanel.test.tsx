/**
 * LayerStackPanel — Tests
 *
 * Verifies the board stackup visualization panel:
 *   - Layer rendering (copper + dielectric)
 *   - Active layer highlighting + selection
 *   - Collapse/expand toggle
 *   - Preset application
 *   - Empty state
 *   - data-testid coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LayerStackPanel } from '../LayerStackPanel';
import type { LayerStackPanelProps } from '../LayerStackPanel';
import { useBoardStackup } from '@/lib/board-stackup';
import type { Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mock useBoardStackup
// ---------------------------------------------------------------------------

vi.mock('@/lib/board-stackup', () => ({
  useBoardStackup: vi.fn(),
}));

const mockedUseBoardStackup = useBoardStackup as Mock;

// ---------------------------------------------------------------------------
// Shared mock data — 4-layer stackup
// ---------------------------------------------------------------------------

const mock4Layer = {
  layers: [
    {
      id: '1',
      name: 'Top (Signal)',
      type: 'signal' as const,
      material: 'FR4' as const,
      thickness: 1.4,
      copperWeight: '1oz' as const,
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 0,
    },
    {
      id: '2',
      name: 'Inner 1 (Ground)',
      type: 'ground' as const,
      material: 'FR4' as const,
      thickness: 1.4,
      copperWeight: '1oz' as const,
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 2,
    },
    {
      id: '3',
      name: 'Inner 2 (Power)',
      type: 'power' as const,
      material: 'FR4' as const,
      thickness: 1.4,
      copperWeight: '1oz' as const,
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 4,
    },
    {
      id: '4',
      name: 'Bottom (Signal)',
      type: 'signal' as const,
      material: 'FR4' as const,
      thickness: 1.4,
      copperWeight: '1oz' as const,
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 6,
    },
  ],
  dielectrics: [
    {
      id: 'd1',
      name: 'Prepreg 1',
      material: 'FR4' as const,
      thickness: 8,
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 1,
    },
    {
      id: 'd2',
      name: 'Core',
      material: 'FR4' as const,
      thickness: 40,
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 3,
    },
    {
      id: 'd3',
      name: 'Prepreg 2',
      material: 'FR4' as const,
      thickness: 8,
      dielectricConstant: 4.4,
      lossTangent: 0.02,
      order: 5,
    },
  ],
  totalThickness: 62,
  surfaceFinish: 'HASL' as const,
  presets: [
    { name: '2-layer', description: 'Standard 2-layer' },
    { name: '4-layer', description: 'Standard 4-layer' },
    { name: '6-layer', description: 'High-performance 6-layer' },
  ],
  applyPreset: vi.fn(),
  addLayer: vi.fn(),
  removeLayer: vi.fn(),
  updateLayer: vi.fn(),
  reorderLayer: vi.fn(),
  calculateImpedance: vi.fn(),
  setSurfaceFinish: vi.fn(),
  validate: vi.fn(),
  exportStackup: vi.fn(),
  importStackup: vi.fn(),
};

// ---------------------------------------------------------------------------
// Default props helper
// ---------------------------------------------------------------------------

function defaultProps(overrides: Partial<LayerStackPanelProps> = {}): LayerStackPanelProps {
  return {
    activeLayer: 'front',
    onLayerSelect: vi.fn(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LayerStackPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseBoardStackup.mockReturnValue({ ...mock4Layer, applyPreset: vi.fn() });
  });

  // -----------------------------------------------------------------------
  // 1. Renders panel with layer stack header
  // -----------------------------------------------------------------------
  it('renders panel with layer stack header', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    expect(screen.getByTestId('layer-stack-panel')).toBeDefined();
    expect(screen.getByTestId('layer-stack-header')).toBeDefined();
    expect(screen.getByText('Layer Stack')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 2. Shows all copper layers from stackup
  // -----------------------------------------------------------------------
  it('shows all copper layers from stackup', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    expect(screen.getByTestId('copper-layer-1')).toBeDefined();
    expect(screen.getByTestId('copper-layer-2')).toBeDefined();
    expect(screen.getByTestId('copper-layer-3')).toBeDefined();
    expect(screen.getByTestId('copper-layer-4')).toBeDefined();
    expect(screen.getByText('Top (Signal)')).toBeDefined();
    expect(screen.getByText('Inner 1 (Ground)')).toBeDefined();
    expect(screen.getByText('Inner 2 (Power)')).toBeDefined();
    expect(screen.getByText('Bottom (Signal)')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 3. Shows dielectric layers between copper layers
  // -----------------------------------------------------------------------
  it('shows dielectric layers between copper layers', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    expect(screen.getByTestId('dielectric-layer-d1')).toBeDefined();
    expect(screen.getByTestId('dielectric-layer-d2')).toBeDefined();
    expect(screen.getByTestId('dielectric-layer-d3')).toBeDefined();
    expect(screen.getByText('Prepreg 1')).toBeDefined();
    expect(screen.getByText('Core')).toBeDefined();
    expect(screen.getByText('Prepreg 2')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 4. Highlights the active layer (front)
  // -----------------------------------------------------------------------
  it('highlights the active layer (front)', () => {
    render(<LayerStackPanel {...defaultProps({ activeLayer: 'F.Cu' })} />);
    const topLayer = screen.getByTestId('copper-layer-1');
    expect(topLayer.className).toContain('border-primary');
  });

  // -----------------------------------------------------------------------
  // 5. Highlights the active layer (back)
  // -----------------------------------------------------------------------
  it('highlights the active layer (back)', () => {
    render(<LayerStackPanel {...defaultProps({ activeLayer: 'B.Cu' })} />);
    const bottomLayer = screen.getByTestId('copper-layer-4');
    expect(bottomLayer.className).toContain('border-primary');
  });

  // -----------------------------------------------------------------------
  // 6. Calls onLayerSelect('front') when clicking top copper layer
  // -----------------------------------------------------------------------
  it('calls onLayerSelect with F.Cu when clicking top copper layer', () => {
    const onLayerSelect = vi.fn();
    render(<LayerStackPanel {...defaultProps({ onLayerSelect })} />);
    fireEvent.click(screen.getByTestId('copper-layer-1'));
    expect(onLayerSelect).toHaveBeenCalledWith('F.Cu');
  });

  // -----------------------------------------------------------------------
  // 7. Calls onLayerSelect('back') when clicking bottom copper layer
  // -----------------------------------------------------------------------
  it('calls onLayerSelect with B.Cu when clicking bottom copper layer', () => {
    const onLayerSelect = vi.fn();
    render(<LayerStackPanel {...defaultProps({ onLayerSelect })} />);
    fireEvent.click(screen.getByTestId('copper-layer-4'));
    expect(onLayerSelect).toHaveBeenCalledWith('B.Cu');
  });

  // -----------------------------------------------------------------------
  // 8. Inner layers are selectable as active layer (multi-layer support)
  // -----------------------------------------------------------------------
  it('inner layers trigger onLayerSelect with standard names', () => {
    const onLayerSelect = vi.fn();
    render(<LayerStackPanel {...defaultProps({ onLayerSelect })} />);
    fireEvent.click(screen.getByTestId('copper-layer-2'));
    expect(onLayerSelect).toHaveBeenCalledWith('In1.Cu');
    fireEvent.click(screen.getByTestId('copper-layer-3'));
    expect(onLayerSelect).toHaveBeenCalledWith('In2.Cu');
  });

  // -----------------------------------------------------------------------
  // 9. Shows total thickness
  // -----------------------------------------------------------------------
  it('shows total thickness', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    expect(screen.getByTestId('total-thickness')).toBeDefined();
    expect(screen.getByText(/62/)).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 10. Shows surface finish
  // -----------------------------------------------------------------------
  it('shows surface finish', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    expect(screen.getByTestId('surface-finish')).toBeDefined();
    expect(screen.getByText(/HASL/)).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 11. Collapsed state shows only header
  // -----------------------------------------------------------------------
  it('collapsed state shows only header', () => {
    render(<LayerStackPanel {...defaultProps({ collapsed: true })} />);
    expect(screen.getByTestId('layer-stack-panel')).toBeDefined();
    expect(screen.getByTestId('layer-stack-header')).toBeDefined();
    expect(screen.queryByTestId('layer-stack-body')).toBeNull();
  });

  // -----------------------------------------------------------------------
  // 12. Toggle collapse button works
  // -----------------------------------------------------------------------
  it('toggle collapse button calls onToggleCollapse', () => {
    const onToggleCollapse = vi.fn();
    render(<LayerStackPanel {...defaultProps({ onToggleCollapse })} />);
    fireEvent.click(screen.getByTestId('layer-stack-toggle'));
    expect(onToggleCollapse).toHaveBeenCalledTimes(1);
  });

  // -----------------------------------------------------------------------
  // 13. Empty state when no layers configured
  // -----------------------------------------------------------------------
  it('shows empty state when no layers are configured', () => {
    mockedUseBoardStackup.mockReturnValue({
      ...mock4Layer,
      layers: [],
      dielectrics: [],
      totalThickness: 0,
      applyPreset: vi.fn(),
    });
    render(<LayerStackPanel {...defaultProps()} />);
    expect(screen.getByTestId('layer-stack-empty')).toBeDefined();
    expect(screen.getByText(/No stackup configured/)).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 14. Preset buttons call applyPreset
  // -----------------------------------------------------------------------
  it('preset buttons call applyPreset', () => {
    const applyPreset = vi.fn();
    mockedUseBoardStackup.mockReturnValue({ ...mock4Layer, applyPreset });
    render(<LayerStackPanel {...defaultProps()} />);

    const btn2 = screen.getByTestId('preset-2-layer');
    const btn4 = screen.getByTestId('preset-4-layer');
    const btn6 = screen.getByTestId('preset-6-layer');

    fireEvent.click(btn2);
    expect(applyPreset).toHaveBeenCalledWith('2-layer');

    fireEvent.click(btn4);
    expect(applyPreset).toHaveBeenCalledWith('4-layer');

    fireEvent.click(btn6);
    expect(applyPreset).toHaveBeenCalledWith('6-layer');

    expect(applyPreset).toHaveBeenCalledTimes(3);
  });

  // -----------------------------------------------------------------------
  // 15. Layer type colors are correct
  // -----------------------------------------------------------------------
  it('layer type colors are correct (signal=yellow, ground=green, power=red)', () => {
    render(<LayerStackPanel {...defaultProps()} />);

    const signalDot = screen.getByTestId('layer-type-dot-1');
    expect(signalDot.className).toContain('bg-yellow-500');

    const groundDot = screen.getByTestId('layer-type-dot-2');
    expect(groundDot.className).toContain('bg-green-500');

    const powerDot = screen.getByTestId('layer-type-dot-3');
    expect(powerDot.className).toContain('bg-red-500');
  });

  // -----------------------------------------------------------------------
  // 16. Shows copper weight for each layer
  // -----------------------------------------------------------------------
  it('shows copper weight for each layer', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    const copperWeights = screen.getAllByText('1oz');
    expect(copperWeights.length).toBe(4);
  });

  // -----------------------------------------------------------------------
  // 17. Shows thickness for each layer/dielectric
  // -----------------------------------------------------------------------
  it('shows thickness for each layer and dielectric', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    // 4 copper layers at 1.4 mil
    const copperThickness = screen.getAllByText(/1\.4\s*mil/);
    expect(copperThickness.length).toBe(4);
    // Dielectrics: 8.0 mil appears twice (Prepreg 1 and Prepreg 2)
    const eightMil = screen.getAllByText(/8\.0\s*mil/);
    expect(eightMil.length).toBe(2);
    // Core at 40.0 mil appears once
    const fortyMil = screen.getAllByText(/40\.0\s*mil/);
    expect(fortyMil.length).toBe(1);
  });

  // -----------------------------------------------------------------------
  // 18. data-testid attributes present on all elements
  // -----------------------------------------------------------------------
  it('has data-testid on all interactive and display elements', () => {
    render(<LayerStackPanel {...defaultProps()} />);

    // Panel structure
    expect(screen.getByTestId('layer-stack-panel')).toBeDefined();
    expect(screen.getByTestId('layer-stack-header')).toBeDefined();
    expect(screen.getByTestId('layer-stack-toggle')).toBeDefined();
    expect(screen.getByTestId('layer-stack-body')).toBeDefined();

    // Copper layers
    expect(screen.getByTestId('copper-layer-1')).toBeDefined();
    expect(screen.getByTestId('copper-layer-2')).toBeDefined();
    expect(screen.getByTestId('copper-layer-3')).toBeDefined();
    expect(screen.getByTestId('copper-layer-4')).toBeDefined();

    // Dielectric layers
    expect(screen.getByTestId('dielectric-layer-d1')).toBeDefined();
    expect(screen.getByTestId('dielectric-layer-d2')).toBeDefined();
    expect(screen.getByTestId('dielectric-layer-d3')).toBeDefined();

    // Type dots
    expect(screen.getByTestId('layer-type-dot-1')).toBeDefined();
    expect(screen.getByTestId('layer-type-dot-2')).toBeDefined();
    expect(screen.getByTestId('layer-type-dot-3')).toBeDefined();
    expect(screen.getByTestId('layer-type-dot-4')).toBeDefined();

    // Summary
    expect(screen.getByTestId('total-thickness')).toBeDefined();
    expect(screen.getByTestId('surface-finish')).toBeDefined();
    expect(screen.getByTestId('layer-count')).toBeDefined();

    // Preset buttons
    expect(screen.getByTestId('preset-2-layer')).toBeDefined();
    expect(screen.getByTestId('preset-4-layer')).toBeDefined();
    expect(screen.getByTestId('preset-6-layer')).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // Edge: Empty state has apply-preset button
  // -----------------------------------------------------------------------
  it('empty state provides a button to apply 2-layer preset', () => {
    const applyPreset = vi.fn();
    mockedUseBoardStackup.mockReturnValue({
      ...mock4Layer,
      layers: [],
      dielectrics: [],
      totalThickness: 0,
      applyPreset,
    });
    render(<LayerStackPanel {...defaultProps()} />);
    const btn = screen.getByTestId('empty-apply-preset');
    fireEvent.click(btn);
    expect(applyPreset).toHaveBeenCalledWith('2-layer');
  });

  // -----------------------------------------------------------------------
  // Edge: Mixed layer type renders purple dot
  // -----------------------------------------------------------------------
  it('renders purple dot for mixed layer type', () => {
    mockedUseBoardStackup.mockReturnValue({
      ...mock4Layer,
      layers: [
        {
          id: 'm1',
          name: 'Mixed Layer',
          type: 'mixed' as const,
          material: 'FR4' as const,
          thickness: 1.4,
          copperWeight: '1oz' as const,
          dielectricConstant: 4.4,
          lossTangent: 0.02,
          order: 0,
        },
      ],
      dielectrics: [],
      totalThickness: 1.4,
    });
    render(<LayerStackPanel {...defaultProps()} />);
    const dot = screen.getByTestId('layer-type-dot-m1');
    expect(dot.className).toContain('bg-purple-500');
  });

  // -----------------------------------------------------------------------
  // Edge: Internal collapse state when no callback provided
  // -----------------------------------------------------------------------
  it('manages collapse internally when no onToggleCollapse provided', () => {
    render(<LayerStackPanel {...defaultProps()} />);
    // Body should be visible initially (collapsed defaults to false)
    expect(screen.getByTestId('layer-stack-body')).toBeDefined();

    // Click toggle
    fireEvent.click(screen.getByTestId('layer-stack-toggle'));
    // Without onToggleCollapse, internal state should toggle — body hidden
    expect(screen.queryByTestId('layer-stack-body')).toBeNull();

    // Click again to expand
    fireEvent.click(screen.getByTestId('layer-stack-toggle'));
    expect(screen.getByTestId('layer-stack-body')).toBeDefined();
  });
});
