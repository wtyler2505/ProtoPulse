/**
 * PinoutHoverCard Component Tests
 *
 * Tests for client/src/components/circuit-editor/PinoutHoverCard.tsx.
 * Covers rendering, pin display, interactions, and fallbacks.
 *
 * Runs in client project config (happy-dom environment).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinoutHoverCard } from '../PinoutHoverCard';
import type { PinoutHoverCardProps } from '../PinoutHoverCard';
import type { Connector, PartMeta, PartProperty } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultProps(overrides?: Partial<PinoutHoverCardProps>): PinoutHoverCardProps {
  return {
    componentName: 'NE555',
    position: { x: 100, y: 100 },
    onClose: vi.fn(),
    ...overrides,
  };
}

function makeConnectors(count: number): Connector[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `conn-${i + 1}`,
    name: `Pin${i + 1}`,
    connectorType: 'pad' as const,
    shapeIds: {},
    terminalPositions: {},
  }));
}

function makePartMeta(overrides?: Partial<PartMeta>): PartMeta {
  return {
    title: 'Test Part',
    tags: [],
    mountingType: 'tht',
    properties: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — rendering', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the hover card container', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-hover-card')).toBeDefined();
  });

  it('renders the component name in header', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-component-name').textContent).toBe('NE555');
  });

  it('renders the package type', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-package').textContent).toBe('DIP-8');
  });

  it('renders the family', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-family').textContent).toBe('555 Timer');
  });

  it('renders the pin count', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-pin-count').textContent).toBe('8 pins');
  });

  it('renders the description when available', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    const desc = screen.getByTestId('pinout-description');
    expect(desc.textContent).toContain('precision timer');
  });

  it('renders the pin diagram SVG', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-diagram')).toBeDefined();
    expect(screen.getByTestId('pinout-diagram-svg')).toBeDefined();
  });

  it('renders the pin table', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-pin-table')).toBeDefined();
  });

  it('renders correct number of pin rows', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    // NE555 has 8 pins
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByTestId(`pin-row-${i}`)).toBeDefined();
    }
  });

  it('renders pin type badges for each pin', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByTestId(`pin-type-badge-${i}`)).toBeDefined();
    }
  });

  it('renders the pin type legend', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-legend')).toBeDefined();
  });

  it('renders the close button', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-close-button')).toBeDefined();
  });

  it('renders pin diagram pins for DIP package', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    // NE555 DIP-8 should have 8 diagram pins
    for (let i = 1; i <= 8; i++) {
      expect(screen.getByTestId(`diagram-pin-${i}`)).toBeDefined();
    }
  });

  it('renders the header section', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pinout-header')).toBeDefined();
  });

  it('renders pin table column headers', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.getByTestId('pin-table-header-pin')).toBeDefined();
    expect(screen.getByTestId('pin-table-header-name')).toBeDefined();
    expect(screen.getByTestId('pin-table-header-function')).toBeDefined();
    expect(screen.getByTestId('pin-table-header-type')).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Pin type color coding
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — pin type colors', () => {
  it('applies correct badge text for ground pin', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    // NE555 pin 1 is GND (ground)
    const badge = screen.getByTestId('pin-type-badge-1');
    expect(badge.textContent).toBe('GND');
  });

  it('applies correct badge text for power pin', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    // NE555 pin 8 is VCC (power)
    const badge = screen.getByTestId('pin-type-badge-8');
    expect(badge.textContent).toBe('PWR');
  });

  it('applies correct badge text for io pin', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    // NE555 pin 2 is TRIG (io)
    const badge = screen.getByTestId('pin-type-badge-2');
    expect(badge.textContent).toBe('I/O');
  });

  it('applies correct badge text for analog pin', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    // NE555 pin 5 is CTRL (analog)
    const badge = screen.getByTestId('pin-type-badge-5');
    expect(badge.textContent).toBe('ANA');
  });

  it('applies correct badge text for special pin', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    // NE555 pin 4 is RESET (special)
    const badge = screen.getByTestId('pin-type-badge-4');
    expect(badge.textContent).toBe('SPL');
  });
});

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — interactions', () => {
  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<PinoutHoverCard {...defaultProps({ onClose })} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<PinoutHoverCard {...defaultProps({ onClose })} />);
    fireEvent.click(screen.getByTestId('pinout-close-button'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the card', () => {
    const onClose = vi.fn();
    render(
      <div>
        <div data-testid="outside">outside</div>
        <PinoutHoverCard {...defaultProps({ onClose })} />
      </div>,
    );
    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onClose when clicking inside the card', () => {
    const onClose = vi.fn();
    render(<PinoutHoverCard {...defaultProps({ onClose })} />);
    fireEvent.mouseDown(screen.getByTestId('pinout-hover-card'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Datasheet link
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — datasheet', () => {
  it('renders datasheet link for known component', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    const link = screen.getByTestId('pinout-datasheet-link');
    expect(link).toBeDefined();
    expect(link.textContent).toBe('View Datasheet');
  });

  it('datasheet link has target="_blank"', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    const link = screen.getByTestId('pinout-datasheet-link');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('datasheet link has rel="noopener noreferrer"', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    const link = screen.getByTestId('pinout-datasheet-link');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('datasheet link has correct href', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    const link = screen.getByTestId('pinout-datasheet-link');
    expect(link.getAttribute('href')).toContain('ti.com');
  });

  it('uses partMeta datasheetUrl when provided', () => {
    const meta = makePartMeta({ datasheetUrl: 'https://example.com/datasheet.pdf' });
    render(<PinoutHoverCard {...defaultProps({ partMeta: meta })} />);
    const link = screen.getByTestId('pinout-datasheet-link');
    expect(link.getAttribute('href')).toBe('https://example.com/datasheet.pdf');
  });
});

// ---------------------------------------------------------------------------
// Generic / fallback pinout
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — fallback', () => {
  it('falls back to generic pinout for unknown component', () => {
    render(
      <PinoutHoverCard
        {...defaultProps({
          componentName: 'Unknown Chip XYZ',
          connectors: makeConnectors(6),
        })}
      />,
    );
    expect(screen.getByTestId('pinout-component-name').textContent).toBe('Unknown Component');
    expect(screen.getByTestId('pinout-pin-count').textContent).toBe('6 pins');
  });

  it('uses connector count for generic pin count', () => {
    render(
      <PinoutHoverCard
        {...defaultProps({
          componentName: 'Mystery Part',
          connectors: makeConnectors(10),
        })}
      />,
    );
    expect(screen.getByTestId('pinout-pin-count').textContent).toBe('10 pins');
  });

  it('uses partMeta packageType for generic pinout', () => {
    const meta = makePartMeta({ packageType: 'QFP-44' });
    render(
      <PinoutHoverCard
        {...defaultProps({
          componentName: 'Unknown',
          connectors: makeConnectors(4),
          partMeta: meta,
        })}
      />,
    );
    expect(screen.getByTestId('pinout-package').textContent).toBe('QFP-44');
  });

  it('tries partMeta title for lookup before falling back', () => {
    const meta = makePartMeta({ title: 'NE555' });
    render(
      <PinoutHoverCard
        {...defaultProps({
          componentName: 'Some Unknown Name',
          partMeta: meta,
        })}
      />,
    );
    // Should find NE555 via partMeta.title
    expect(screen.getByTestId('pinout-component-name').textContent).toBe('NE555');
  });

  it('tries partMeta mpn for lookup before falling back', () => {
    const meta = makePartMeta({ mpn: 'ATMEGA328P-PU' });
    render(
      <PinoutHoverCard
        {...defaultProps({
          componentName: 'Some Generic IC',
          partMeta: meta,
        })}
      />,
    );
    // Should find ATmega328P via mpn alias
    expect(screen.getByTestId('pinout-component-name').textContent).toBe('ATmega328P');
  });
});

// ---------------------------------------------------------------------------
// Key specs
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — key specs', () => {
  it('renders key specs when partMeta has properties', () => {
    const properties: PartProperty[] = [
      { key: 'Voltage', value: '5V' },
      { key: 'Current', value: '1A' },
    ];
    const meta = makePartMeta({ properties });
    render(<PinoutHoverCard {...defaultProps({ partMeta: meta })} />);
    expect(screen.getByTestId('pinout-key-specs')).toBeDefined();
    expect(screen.getByTestId('spec-Voltage')).toBeDefined();
    expect(screen.getByTestId('spec-Current')).toBeDefined();
  });

  it('does not render key specs when partMeta has no properties', () => {
    const meta = makePartMeta({ properties: [] });
    render(<PinoutHoverCard {...defaultProps({ partMeta: meta })} />);
    expect(screen.queryByTestId('pinout-key-specs')).toBeNull();
  });

  it('does not render key specs when no partMeta provided', () => {
    render(<PinoutHoverCard {...defaultProps()} />);
    expect(screen.queryByTestId('pinout-key-specs')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Positioning
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — positioning', () => {
  it('applies position via inline style', () => {
    render(<PinoutHoverCard {...defaultProps({ position: { x: 200, y: 300 } })} />);
    const card = screen.getByTestId('pinout-hover-card');
    const style = card.getAttribute('style') ?? '';
    expect(style).toContain('left');
    expect(style).toContain('top');
  });

  it('applies custom className', () => {
    render(<PinoutHoverCard {...defaultProps({ className: 'custom-test-class' })} />);
    const card = screen.getByTestId('pinout-hover-card');
    expect(card.className).toContain('custom-test-class');
  });
});

// ---------------------------------------------------------------------------
// Different package types
// ---------------------------------------------------------------------------

describe('PinoutHoverCard — package rendering', () => {
  it('renders TO-220 package (LM7805) with small package diagram', () => {
    render(<PinoutHoverCard {...defaultProps({ componentName: 'LM7805' })} />);
    expect(screen.getByTestId('pinout-component-name').textContent).toBe('LM7805');
    expect(screen.getByTestId('pinout-package').textContent).toBe('TO-220');
    expect(screen.getByTestId('pinout-diagram-svg')).toBeDefined();
  });

  it('renders module package (ESP32) with module diagram', () => {
    render(<PinoutHoverCard {...defaultProps({ componentName: 'ESP32' })} />);
    expect(screen.getByTestId('pinout-component-name').textContent).toBe('ESP32-WROOM-32');
    expect(screen.getByTestId('pinout-diagram-svg')).toBeDefined();
  });

  it('renders DIP-16 package (L293D)', () => {
    render(<PinoutHoverCard {...defaultProps({ componentName: 'L293D' })} />);
    expect(screen.getByTestId('pinout-component-name').textContent).toBe('L293D');
    expect(screen.getByTestId('pinout-package').textContent).toBe('DIP-16');
  });
});
