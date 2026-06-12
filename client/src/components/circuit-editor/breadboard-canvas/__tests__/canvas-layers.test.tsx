/**
 * Tests for the SVG layer components extracted from BreadboardCanvas (W1.12b,
 * audit #32 phase 2): WireLayer, OverlayLayer, CoachLayer.
 *
 * These are presentational SVG layers — we verify their distinctive testids,
 * visibility rules, and callback wiring, mirroring canvas-leaf-components.test.tsx.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { WireLayer } from '../WireLayer';
import { OverlayLayer } from '../OverlayLayer';
import { CoachLayer } from '../CoachLayer';
import type { WireInProgress } from '../canvas-helpers';
import type { CircuitInstanceRow, CircuitWireRow } from '@shared/schema';
import type { ComponentVisualState, WireVisualState } from '@/lib/simulation/visual-state';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWire(overrides: Partial<CircuitWireRow> = {}): CircuitWireRow {
  return {
    id: 1,
    circuitId: 1,
    netId: 10,
    view: 'breadboard',
    points: [
      { x: 10, y: 10 },
      { x: 50, y: 10 },
    ],
    color: '#3498db',
    width: 1.5,
    wireType: 'wire',
    provenance: 'manual',
    endpointMeta: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CircuitWireRow;
}

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    subDesignId: null,
    referenceDesignator: 'D1',
    schematicX: null,
    schematicY: null,
    breadboardX: 100,
    breadboardY: 80,
    benchX: null,
    benchY: null,
    rotation: 0,
    properties: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

function renderSvg(ui: React.ReactElement) {
  return render(<svg>{ui}</svg>);
}

// ---------------------------------------------------------------------------
// WireLayer
// ---------------------------------------------------------------------------

describe('WireLayer', () => {
  const baseProps = {
    wires: [makeWire()],
    isLive: false,
    wireVisualStates: new Map<string, WireVisualState>(),
    selectedWireId: null,
    onSelectWire: vi.fn(),
    onWireContextMenu: vi.fn(),
    wireInProgress: null,
  };

  it('renders a static wire path with its testid', () => {
    renderSvg(<WireLayer {...baseProps} />);
    expect(screen.getByTestId('wire-1')).toBeDefined();
  });

  it('skips wires with fewer than 2 points', () => {
    renderSvg(<WireLayer {...baseProps} wires={[makeWire({ points: [{ x: 1, y: 1 }] })]} />);
    expect(screen.queryByTestId('wire-1')).toBeNull();
  });

  it('selects a wire on click', () => {
    const onSelectWire = vi.fn();
    renderSvg(<WireLayer {...baseProps} onSelectWire={onSelectWire} />);
    fireEvent.click(screen.getByTestId('wire-1'));
    expect(onSelectWire).toHaveBeenCalledWith(1);
  });

  it('opens the context menu on right-click', () => {
    const onWireContextMenu = vi.fn();
    renderSvg(<WireLayer {...baseProps} onWireContextMenu={onWireContextMenu} />);
    fireEvent.contextMenu(screen.getByTestId('wire-1'));
    expect(onWireContextMenu).toHaveBeenCalled();
    expect(onWireContextMenu.mock.calls[0][1]).toBe(1);
  });

  it('renders jumper endpoint connectors for jumper wires', () => {
    const { container } = renderSvg(
      <WireLayer {...baseProps} wires={[makeWire({ provenance: 'jumper' })]} />,
    );
    expect(container.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2);
    const path = screen.getByTestId('wire-1');
    expect(path.getAttribute('stroke')).toBe('#f59e0b');
  });

  it('renders animated wire with sim current label when live', () => {
    const states = new Map<string, WireVisualState>([
      ['10', {
        currentMagnitude: 0.02,
        currentDirection: 1,
        animationSpeed: 4,
        intensity: 1,
        sourceVoltage: 5,
        targetVoltage: 0,
      } as WireVisualState],
    ]);
    renderSvg(<WireLayer {...baseProps} isLive wireVisualStates={states} />);
    expect(screen.getByTestId('wire-animated-1')).toBeDefined();
    expect(screen.getByTestId('wire-sim-label-1')).toBeDefined();
  });

  it('renders the wire-in-progress polyline', () => {
    const wip: WireInProgress = {
      netId: 10,
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
      ],
      coordPath: [],
      endpointPath: [null, null],
      color: '#22c55e',
    };
    renderSvg(<WireLayer {...baseProps} wireInProgress={wip} />);
    expect(screen.getByTestId('wire-in-progress')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// OverlayLayer
// ---------------------------------------------------------------------------

describe('OverlayLayer', () => {
  const baseProps = {
    cursor: { col: 'a' as const, row: 1, active: false },
    isLive: false,
    componentVisualStates: new Map<string, ComponentVisualState>(),
    instances: [] as CircuitInstanceRow[],
    selectedInstanceModel: null,
    hoveredInspectorPinId: null,
  };

  it('renders nothing distinctive when idle', () => {
    renderSvg(<OverlayLayer {...baseProps} />);
    expect(screen.queryByTestId('breadboard-keyboard-cursor')).toBeNull();
  });

  it('renders the keyboard cursor when active', () => {
    renderSvg(<OverlayLayer {...baseProps} cursor={{ col: 'c', row: 5, active: true }} />);
    expect(screen.getByTestId('breadboard-keyboard-cursor')).toBeDefined();
  });

  it('renders a glowing LED overlay for simulated LEDs', () => {
    const states = new Map<string, ComponentVisualState>([
      ['D1', { type: 'led', glowing: true, color: 'red', brightness: 1 } as ComponentVisualState],
    ]);
    renderSvg(
      <OverlayLayer {...baseProps} isLive componentVisualStates={states} instances={[makeInstance()]} />,
    );
    expect(screen.getByTestId('sim-bb-led-D1')).toBeDefined();
  });

  it('renders switch ON/OFF state overlay', () => {
    const states = new Map<string, ComponentVisualState>([
      ['SW1', { type: 'switch', closed: true } as ComponentVisualState],
    ]);
    renderSvg(
      <OverlayLayer
        {...baseProps}
        isLive
        componentVisualStates={states}
        instances={[makeInstance({ referenceDesignator: 'SW1' })]}
      />,
    );
    expect(screen.getByTestId('sim-bb-switch-SW1')).toBeDefined();
    expect(screen.getByTestId('sim-bb-switch-SW1').textContent).toContain('ON');
  });

  it('skips simulation overlays for unplaced instances', () => {
    const states = new Map<string, ComponentVisualState>([
      ['D1', { type: 'led', glowing: true, color: 'red', brightness: 1 } as ComponentVisualState],
    ]);
    renderSvg(
      <OverlayLayer
        {...baseProps}
        isLive
        componentVisualStates={states}
        instances={[makeInstance({ breadboardX: null, breadboardY: null })]}
      />,
    );
    expect(screen.queryByTestId('sim-bb-led-D1')).toBeNull();
  });

  it('highlights the hovered inspector pin', () => {
    const model = {
      pins: [
        {
          id: 'pin-1',
          label: 'GND',
          coordLabel: 'a5',
          pixel: { x: 30, y: 40 },
        },
      ],
    } as unknown as BreadboardSelectedPartModel;
    renderSvg(
      <OverlayLayer {...baseProps} selectedInstanceModel={model} hoveredInspectorPinId="pin-1" />,
    );
    const highlight = screen.getByTestId('breadboard-pin-highlight');
    expect(highlight).toBeDefined();
    expect(highlight.textContent).toContain('GND');
  });

  it('renders no pin highlight when the hovered pin is unknown', () => {
    const model = {
      pins: [{ id: 'pin-1', label: 'GND', coordLabel: 'a5', pixel: { x: 30, y: 40 } }],
    } as unknown as BreadboardSelectedPartModel;
    renderSvg(
      <OverlayLayer {...baseProps} selectedInstanceModel={model} hoveredInspectorPinId="pin-404" />,
    );
    expect(screen.queryByTestId('breadboard-pin-highlight')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CoachLayer
// ---------------------------------------------------------------------------

describe('CoachLayer', () => {
  const baseProps = {
    selectedInstanceModel: null,
    hoveredInspectorPinId: null,
    coachPlanVisible: false,
    coachPlan: null,
    preparedCoachHookups: [],
    preparedCoachBridges: [],
    stagedCoachSuggestions: [],
    resolvedCoachSuggestions: [],
    onApplyRemediation: vi.fn(),
  };

  it('renders nothing without a selected model', () => {
    const { container } = renderSvg(<CoachLayer {...baseProps} />);
    expect(container.querySelector('[data-testid="breadboard-pin-anchor-overlay"]')).toBeNull();
    expect(container.querySelector('[data-testid="breadboard-coach-plan-overlay"]')).toBeNull();
  });

  it('renders the pin anchor overlay when a model with pins is selected', () => {
    const model = {
      pins: [
        {
          id: 'pin-1',
          label: 'GND',
          coordLabel: 'a5',
          pixel: { x: 30, y: 40 },
          role: 'ground',
          confidence: 'exact',
          isCritical: false,
        },
      ],
    } as unknown as BreadboardSelectedPartModel;
    renderSvg(<CoachLayer {...baseProps} selectedInstanceModel={model} />);
    expect(screen.getByTestId('breadboard-pin-anchor-overlay')).toBeDefined();
    // Coach plan overlay stays hidden until toggled visible with a plan
    expect(screen.queryByTestId('breadboard-coach-plan-overlay')).toBeNull();
  });

  it('renders the coach plan overlay when visible with a plan', () => {
    const model = {
      pins: [],
    } as unknown as BreadboardSelectedPartModel;
    const coachPlan = {
      corridorHints: [],
      highlightedPinIds: [],
      suggestions: [],
      hookups: [],
      railBridges: [],
    } as never;
    renderSvg(
      <CoachLayer
        {...baseProps}
        selectedInstanceModel={model}
        coachPlanVisible
        coachPlan={coachPlan}
      />,
    );
    expect(screen.getByTestId('breadboard-coach-plan-overlay')).toBeDefined();
  });
});
