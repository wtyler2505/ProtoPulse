import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NetBrowserPanel from '../NetBrowserPanel';
import type { CircuitNetRow, CircuitInstanceRow } from '@shared/schema';

// Mock net-colors to avoid localStorage issues
vi.mock('@/lib/circuit-editor/net-colors', () => ({
  netColorManager: {
    getNetColor: vi.fn().mockReturnValue(undefined),
    getDefaultColor: vi.fn().mockReturnValue('#06b6d4'),
    subscribe: vi.fn().mockReturnValue(() => {}),
    getAllColors: vi.fn().mockReturnValue([]),
    version: 0,
  },
}));

function makeNet(overrides: Partial<CircuitNetRow> = {}): CircuitNetRow {
  return {
    id: 1,
    circuitId: 1,
    name: 'VCC',
    netType: 'power',
    voltage: null,
    busWidth: null,
    segments: [
      { fromInstanceId: 1, fromPin: 'pin1', toInstanceId: 2, toPin: 'pin2' },
    ],
    labels: [],
    style: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitNetRow;
}

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: 1,
    subDesignId: null,
    referenceDesignator: 'U1',
    schematicX: 0,
    schematicY: 0,
    schematicRotation: 0,
    breadboardRow: null,
    breadboardCol: null,
    breadboardOrientation: null,
    pcbX: null,
    pcbY: null,
    pcbRotation: null,
    pcbSide: 'front',
    properties: {},
    createdAt: new Date(),
    ...overrides,
  } as CircuitInstanceRow;
}

const defaultProps = {
  selectedNetName: null,
  onSelectNet: vi.fn(),
};

describe('NetBrowserPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the panel with header', () => {
    render(<NetBrowserPanel nets={[]} instances={[]} {...defaultProps} />);
    expect(screen.getByTestId('net-browser-panel')).toBeDefined();
    expect(screen.getByText('Nets (0)')).toBeDefined();
  });

  it('shows empty state when no nets', () => {
    render(<NetBrowserPanel nets={[]} instances={[]} {...defaultProps} />);
    expect(screen.getByTestId('net-browser-empty')).toBeDefined();
    expect(screen.getByText('No nets in this design')).toBeDefined();
  });

  it('lists nets with name and type', () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC', netType: 'power' }),
      makeNet({ id: 2, name: 'GND', netType: 'ground' }),
    ];
    const instances = [
      makeInstance({ id: 1, referenceDesignator: 'U1' }),
      makeInstance({ id: 2, referenceDesignator: 'R1' }),
    ];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    expect(screen.getByText('Nets (2)')).toBeDefined();
    expect(screen.getByText('VCC')).toBeDefined();
    expect(screen.getByText('GND')).toBeDefined();
  });

  it('shows pin count per net', () => {
    const nets = [
      makeNet({
        id: 1,
        name: 'SIG',
        netType: 'signal',
        segments: [
          { fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' },
          { fromInstanceId: 2, fromPin: 'p3', toInstanceId: 3, toPin: 'p4' },
        ],
      }),
    ];
    const instances = [
      makeInstance({ id: 1, referenceDesignator: 'U1' }),
      makeInstance({ id: 2, referenceDesignator: 'R1' }),
      makeInstance({ id: 3, referenceDesignator: 'C1' }),
    ];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    expect(screen.getByText('4 pins')).toBeDefined();
  });

  it('shows connected instance ref designators', () => {
    const nets = [makeNet({ id: 1, name: 'VCC', segments: [{ fromInstanceId: 1, fromPin: 'p1', toInstanceId: 2, toPin: 'p2' }] })];
    const instances = [
      makeInstance({ id: 1, referenceDesignator: 'U1' }),
      makeInstance({ id: 2, referenceDesignator: 'R1' }),
    ];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    expect(screen.getByText('R1, U1')).toBeDefined();
  });

  it('calls onSelectNet when a net is clicked', async () => {
    const onSelectNet = vi.fn();
    const nets = [makeNet({ id: 1, name: 'VCC' })];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} selectedNetName={null} onSelectNet={onSelectNet} />);
    await userEvent.click(screen.getByTestId('net-browser-item-1'));
    expect(onSelectNet).toHaveBeenCalledWith('VCC');
  });

  it('deselects net when clicking already selected net', async () => {
    const onSelectNet = vi.fn();
    const nets = [makeNet({ id: 1, name: 'VCC' })];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} selectedNetName="VCC" onSelectNet={onSelectNet} />);
    await userEvent.click(screen.getByTestId('net-browser-item-1'));
    expect(onSelectNet).toHaveBeenCalledWith(null);
  });

  it('filters nets by search query', async () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC', netType: 'power' }),
      makeNet({ id: 2, name: 'SDA', netType: 'signal' }),
    ];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    const search = screen.getByTestId('net-browser-search');
    await userEvent.type(search, 'SDA');

    // Should show SDA but not VCC
    expect(screen.getByText('SDA')).toBeDefined();
    expect(screen.queryByText('VCC')).toBeNull();
  });

  it('filters nets by type', async () => {
    const nets = [
      makeNet({ id: 1, name: 'VCC', netType: 'power' }),
      makeNet({ id: 2, name: 'SDA', netType: 'signal' }),
    ];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    const typeFilter = screen.getByTestId('net-browser-type-filter');
    fireEvent.change(typeFilter, { target: { value: 'signal' } });

    expect(screen.getByText('SDA')).toBeDefined();
    expect(screen.queryByText('VCC')).toBeNull();
  });

  it('sorts nets by name', () => {
    const nets = [
      makeNet({ id: 2, name: 'ZZZ', netType: 'signal' }),
      makeNet({ id: 1, name: 'AAA', netType: 'signal' }),
    ];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    const items = screen.getAllByText(/AAA|ZZZ/);
    expect(items[0].textContent).toBe('AAA');
    expect(items[1].textContent).toBe('ZZZ');
  });

  it('shows color indicator for each net', () => {
    const nets = [makeNet({ id: 1, name: 'VCC', netType: 'power' })];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    // BL-0490: color indicator is now a clickable color picker button
    expect(screen.getByTestId('net-color-picker-1')).toBeDefined();
  });

  it('shows search empty state', async () => {
    const nets = [makeNet({ id: 1, name: 'VCC' })];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} {...defaultProps} />);
    const search = screen.getByTestId('net-browser-search');
    await userEvent.type(search, 'nonexistent');

    expect(screen.getByText('No nets match your search')).toBeDefined();
  });

  it('has correct aria attributes', () => {
    const nets = [makeNet({ id: 1, name: 'VCC' })];
    const instances = [makeInstance({ id: 1 }), makeInstance({ id: 2 })];

    render(<NetBrowserPanel nets={nets} instances={instances} selectedNetName="VCC" onSelectNet={vi.fn()} />);
    const item = screen.getByTestId('net-browser-item-1');
    expect(item.getAttribute('aria-pressed')).toBe('true');
  });
});
