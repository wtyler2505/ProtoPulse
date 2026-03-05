import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DrcConstraintOverlay } from '../pcb-layout/DrcConstraintOverlay';
import { DrcConstraintToggle } from '../pcb-layout/DrcConstraintToggle';
import type { DrcConstraintOverlayProps, ClearanceRule } from '../pcb-layout/DrcConstraintOverlay';
import type { DRCViolation } from '@shared/component-types';
import type { CircuitInstanceRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    designId: 1,
    componentId: 'comp-1',
    referenceDesignator: 'U1',
    x: 100,
    y: 100,
    rotation: 0,
    mirror: false,
    pcbX: 50,
    pcbY: 60,
    pcbRotation: 0,
    pcbSide: 'front',
    pcbLocked: false,
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

function makeViolation(overrides: Partial<DRCViolation> = {}): DRCViolation {
  return {
    id: 'v1',
    ruleType: 'min-clearance',
    severity: 'error',
    message: 'Clearance violation',
    shapeIds: ['1'],
    view: 'pcb',
    location: { x: 50, y: 60 },
    ...overrides,
  };
}

function makeRule(overrides: Partial<ClearanceRule> = {}): ClearanceRule {
  return {
    clearance: 5,
    ...overrides,
  };
}

const defaultProps: DrcConstraintOverlayProps = {
  instances: [],
  violations: [],
  selectedInstanceId: null,
  nets: [],
  boardWidth: 500,
  boardHeight: 400,
  scale: 1.5,
  offsetX: 40,
  offsetY: 40,
  clearanceRules: [makeRule()],
  visible: true,
};

function renderOverlay(overrides: Partial<DrcConstraintOverlayProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(
    <svg>
      <DrcConstraintOverlay {...props} />
    </svg>,
  );
}

// ---------------------------------------------------------------------------
// DrcConstraintOverlay tests
// ---------------------------------------------------------------------------

describe('DrcConstraintOverlay', () => {
  it('renders without crashing with no components', () => {
    renderOverlay();
    expect(screen.getByTestId('drc-constraint-overlay')).toBeDefined();
  });

  it('renders nothing when visible is false', () => {
    renderOverlay({ visible: false });
    expect(screen.queryByTestId('drc-constraint-overlay')).toBeNull();
  });

  it('renders board edge clearance zone', () => {
    renderOverlay();
    expect(screen.getByTestId('drc-board-edge-clearance')).toBeDefined();
  });

  it('renders board edge clearance with default size', () => {
    renderOverlay({ clearanceRules: [] });
    const edgeRect = screen.getByTestId('drc-board-edge-clearance');
    // Default edge clearance = 10
    expect(edgeRect.getAttribute('x')).toBe('10');
    expect(edgeRect.getAttribute('y')).toBe('10');
  });

  it('renders board edge clearance from rule', () => {
    renderOverlay({
      clearanceRules: [makeRule({ clearance: 20, ruleType: 'board_edge_clearance' })],
    });
    const edgeRect = screen.getByTestId('drc-board-edge-clearance');
    expect(edgeRect.getAttribute('x')).toBe('20');
    expect(edgeRect.getAttribute('y')).toBe('20');
  });

  it('renders clearance rings for placed components', () => {
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2, pcbX: 100, pcbY: 100 })];
    renderOverlay({ instances });
    const rings = screen.getAllByTestId('drc-clearance-ring');
    expect(rings).toHaveLength(2);
  });

  it('does not render clearance rings for unplaced components', () => {
    const instances = [
      makeInstance({ id: 1 }),
      makeInstance({ id: 2, pcbX: null, pcbY: null }),
    ];
    renderOverlay({ instances });
    const rings = screen.getAllByTestId('drc-clearance-ring');
    expect(rings).toHaveLength(1);
  });

  it('uses clearance radius from rules', () => {
    const instances = [makeInstance({ id: 1 })];
    renderOverlay({
      instances,
      clearanceRules: [makeRule({ clearance: 10 })],
    });
    const ring = screen.getByTestId('drc-clearance-ring');
    // FOOTPRINT_HALF_W(4) + clearance(10) = 14, width = 28
    expect(ring.getAttribute('width')).toBe('28');
  });

  it('uses default clearance when no rules', () => {
    const instances = [makeInstance({ id: 1 })];
    renderOverlay({ instances, clearanceRules: [] });
    const ring = screen.getByTestId('drc-clearance-ring');
    // FOOTPRINT_HALF_W(4) + default(5) = 9, width = 18
    expect(ring.getAttribute('width')).toBe('18');
  });

  it('renders clearance ring with dashed stroke', () => {
    const instances = [makeInstance()];
    renderOverlay({ instances });
    const ring = screen.getByTestId('drc-clearance-ring');
    expect(ring.getAttribute('stroke-dasharray')).toBe('2,1.5');
  });

  it('renders clearance ring with correct fill color', () => {
    const instances = [makeInstance()];
    renderOverlay({ instances });
    const ring = screen.getByTestId('drc-clearance-ring');
    expect(ring.getAttribute('fill')).toBe('rgba(251,191,36,0.15)');
  });

  it('renders clearance ring with correct stroke color', () => {
    const instances = [makeInstance()];
    renderOverlay({ instances });
    const ring = screen.getByTestId('drc-clearance-ring');
    expect(ring.getAttribute('stroke')).toBe('rgba(251,191,36,0.6)');
  });

  // --- Violation highlights ---

  it('renders violation highlights for components with violations', () => {
    const instances = [makeInstance({ id: 1 })];
    const violations = [makeViolation({ shapeIds: ['1'] })];
    renderOverlay({ instances, violations });
    expect(screen.getByTestId('drc-violation-highlight')).toBeDefined();
  });

  it('does not render violation highlight when no violations', () => {
    const instances = [makeInstance({ id: 1 })];
    renderOverlay({ instances, violations: [] });
    expect(screen.queryByTestId('drc-violation-highlight')).toBeNull();
  });

  it('renders error violation with red fill', () => {
    const instances = [makeInstance({ id: 1 })];
    const violations = [makeViolation({ shapeIds: ['1'], severity: 'error' })];
    renderOverlay({ instances, violations });
    const highlight = screen.getByTestId('drc-violation-highlight');
    expect(highlight.getAttribute('fill')).toBe('rgba(239,68,68,0.3)');
    expect(highlight.getAttribute('stroke')).toBe('rgb(239,68,68)');
  });

  it('renders warning violation with amber fill', () => {
    const instances = [makeInstance({ id: 1 })];
    const violations = [makeViolation({ shapeIds: ['1'], severity: 'warning' })];
    renderOverlay({ instances, violations });
    const highlight = screen.getByTestId('drc-violation-highlight');
    expect(highlight.getAttribute('fill')).toBe('rgba(251,191,36,0.2)');
    expect(highlight.getAttribute('stroke')).toBe('rgba(251,191,36,0.8)');
  });

  it('renders violation highlight with pulsing animation', () => {
    const instances = [makeInstance({ id: 1 })];
    const violations = [makeViolation({ shapeIds: ['1'] })];
    renderOverlay({ instances, violations });
    const highlight = screen.getByTestId('drc-violation-highlight');
    const animate = highlight.querySelector('animate');
    expect(animate).toBeDefined();
    expect(animate?.getAttribute('attributeName')).toBe('opacity');
  });

  it('renders violations for multiple components', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
    ];
    const violations = [
      makeViolation({ id: 'v1', shapeIds: ['1'] }),
      makeViolation({ id: 'v2', shapeIds: ['2'] }),
    ];
    renderOverlay({ instances, violations });
    const highlights = screen.getAllByTestId('drc-violation-highlight');
    expect(highlights).toHaveLength(2);
  });

  it('matches violations by proximity when shapeIds do not match', () => {
    const instances = [makeInstance({ id: 1, pcbX: 50, pcbY: 60 })];
    const violations = [
      makeViolation({
        shapeIds: ['999'],
        location: { x: 52, y: 62 },
      }),
    ];
    renderOverlay({ instances, violations });
    expect(screen.getByTestId('drc-violation-highlight')).toBeDefined();
  });

  // --- Net highlighting ---

  it('renders net highlights for connected components when one is selected', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
    ];
    const nets = [
      {
        id: 1,
        name: 'VCC',
        segments: [{ fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' }],
      },
    ];
    renderOverlay({ instances, nets, selectedInstanceId: 1 });
    const highlights = screen.getAllByTestId('drc-net-highlight');
    // Instance 2 is connected to selected instance 1
    expect(highlights).toHaveLength(1);
  });

  it('does not render net highlights when no instance selected', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
    ];
    const nets = [
      {
        id: 1,
        name: 'VCC',
        segments: [{ fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' }],
      },
    ];
    renderOverlay({ instances, nets, selectedInstanceId: null });
    expect(screen.queryByTestId('drc-net-highlight')).toBeNull();
  });

  it('renders net highlight with neon cyan color', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
    ];
    const nets = [
      {
        id: 1,
        name: 'VCC',
        segments: [{ fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' }],
      },
    ];
    renderOverlay({ instances, nets, selectedInstanceId: 1 });
    const highlight = screen.getByTestId('drc-net-highlight');
    expect(highlight.getAttribute('fill')).toBe('#00F0FF');
    expect(highlight.getAttribute('fill-opacity')).toBe('0.4');
  });

  it('highlights all connected instances across nets', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
      makeInstance({ id: 3, pcbX: 150, pcbY: 150 }),
      makeInstance({ id: 4, pcbX: 200, pcbY: 200 }),
    ];
    const nets = [
      {
        id: 1,
        name: 'VCC',
        segments: [
          { fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' },
          { fromInstanceId: 1, fromPin: 'p3', toInstanceId: 3, toPin: 'p4' },
        ],
      },
    ];
    renderOverlay({ instances, nets, selectedInstanceId: 1 });
    const highlights = screen.getAllByTestId('drc-net-highlight');
    // Instance 2 and 3 connected to selected 1
    expect(highlights).toHaveLength(2);
  });

  it('does not highlight the selected instance itself', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
    ];
    const nets = [
      {
        id: 1,
        name: 'VCC',
        segments: [{ fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' }],
      },
    ];
    renderOverlay({ instances, nets, selectedInstanceId: 1 });
    const highlights = screen.getAllByTestId('drc-net-highlight');
    // Only instance 2, not instance 1 (selected)
    expect(highlights).toHaveLength(1);
  });

  it('does not highlight unconnected instances', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
      makeInstance({ id: 3, pcbX: 200, pcbY: 200 }),
    ];
    const nets = [
      {
        id: 1,
        name: 'VCC',
        segments: [{ fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' }],
      },
    ];
    renderOverlay({ instances, nets, selectedInstanceId: 1 });
    const highlights = screen.getAllByTestId('drc-net-highlight');
    expect(highlights).toHaveLength(1); // Only instance 2
  });

  // --- Component transform ---

  it('applies rotation transform to clearance ring', () => {
    const instances = [makeInstance({ id: 1, pcbRotation: 45 })];
    renderOverlay({ instances });
    const ring = screen.getByTestId('drc-clearance-ring');
    expect(ring.getAttribute('transform')).toContain('rotate(45)');
  });

  it('applies position transform to clearance ring', () => {
    const instances = [makeInstance({ id: 1, pcbX: 75, pcbY: 85 })];
    renderOverlay({ instances });
    const ring = screen.getByTestId('drc-clearance-ring');
    expect(ring.getAttribute('transform')).toContain('translate(75, 85)');
  });

  // --- Edge cases ---

  it('handles empty violations array', () => {
    const instances = [makeInstance()];
    renderOverlay({ instances, violations: [] });
    expect(screen.queryByTestId('drc-violation-highlight')).toBeNull();
    expect(screen.getByTestId('drc-clearance-ring')).toBeDefined();
  });

  it('handles empty instances array', () => {
    renderOverlay({ instances: [] });
    expect(screen.queryByTestId('drc-clearance-ring')).toBeNull();
    expect(screen.getByTestId('drc-board-edge-clearance')).toBeDefined();
  });

  it('handles null pcbRotation gracefully', () => {
    const instances = [makeInstance({ id: 1, pcbRotation: null })];
    renderOverlay({ instances });
    const ring = screen.getByTestId('drc-clearance-ring');
    expect(ring.getAttribute('transform')).toContain('rotate(0)');
  });

  it('uses max clearance when multiple rules provided', () => {
    const instances = [makeInstance()];
    renderOverlay({
      instances,
      clearanceRules: [makeRule({ clearance: 3 }), makeRule({ clearance: 8 })],
    });
    const ring = screen.getByTestId('drc-clearance-ring');
    // FOOTPRINT_HALF_W(4) + max(3,8)=8 = 12, width = 24
    expect(ring.getAttribute('width')).toBe('24');
  });

  it('renders all layers: edge, clearance, violation, net', () => {
    const instances = [
      makeInstance({ id: 1, pcbX: 50, pcbY: 60 }),
      makeInstance({ id: 2, pcbX: 100, pcbY: 100 }),
    ];
    const violations = [makeViolation({ shapeIds: ['1'] })];
    const nets = [
      {
        id: 1,
        name: 'GND',
        segments: [{ fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' }],
      },
    ];
    renderOverlay({ instances, violations, nets, selectedInstanceId: 1 });

    expect(screen.getByTestId('drc-board-edge-clearance')).toBeDefined();
    expect(screen.getAllByTestId('drc-clearance-ring')).toHaveLength(2);
    expect(screen.getByTestId('drc-violation-highlight')).toBeDefined();
    expect(screen.getByTestId('drc-net-highlight')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// DrcConstraintToggle tests
// ---------------------------------------------------------------------------

describe('DrcConstraintToggle', () => {
  it('renders the toggle button', () => {
    render(<DrcConstraintToggle visible={true} onToggle={() => {}} />);
    expect(screen.getByTestId('drc-constraint-toggle')).toBeDefined();
  });

  it('displays "DRC Zones" label', () => {
    render(<DrcConstraintToggle visible={true} onToggle={() => {}} />);
    expect(screen.getByText('DRC Zones')).toBeDefined();
  });

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn();
    render(<DrcConstraintToggle visible={true} onToggle={onToggle} />);
    fireEvent.click(screen.getByTestId('drc-constraint-toggle'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('shows active styling when visible', () => {
    render(<DrcConstraintToggle visible={true} onToggle={() => {}} />);
    const btn = screen.getByTestId('drc-constraint-toggle');
    expect(btn.className).toContain('bg-amber-500/20');
    expect(btn.className).toContain('text-amber-400');
  });

  it('shows inactive styling when not visible', () => {
    render(<DrcConstraintToggle visible={false} onToggle={() => {}} />);
    const btn = screen.getByTestId('drc-constraint-toggle');
    expect(btn.className).toContain('bg-muted/50');
    expect(btn.className).toContain('text-muted-foreground');
  });

  it('shows "Hide DRC zones" title when visible', () => {
    render(<DrcConstraintToggle visible={true} onToggle={() => {}} />);
    expect(screen.getByTitle('Hide DRC zones')).toBeDefined();
  });

  it('shows "Show DRC zones" title when not visible', () => {
    render(<DrcConstraintToggle visible={false} onToggle={() => {}} />);
    expect(screen.getByTitle('Show DRC zones')).toBeDefined();
  });

  it('toggles multiple times', () => {
    const onToggle = vi.fn();
    render(<DrcConstraintToggle visible={true} onToggle={onToggle} />);
    const btn = screen.getByTestId('drc-constraint-toggle');
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(3);
  });
});
