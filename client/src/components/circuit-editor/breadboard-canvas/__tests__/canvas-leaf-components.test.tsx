/**
 * Smoke/render tests for the small leaf components extracted from BreadboardCanvas.
 *
 * Covers: CanvasToolbar, CanvasCoordinateReadout, WireColorMenu, CanvasEmptyGuidance.
 * These are thin presentational wrappers — we verify that they render their
 * distinctive testid, respect visibility rules, and wire callbacks correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { CanvasToolbar } from '../CanvasToolbar';
import { CanvasCoordinateReadout } from '../CanvasCoordinateReadout';
import { WireColorMenu } from '../WireColorMenu';
import { CanvasEmptyGuidance } from '../CanvasEmptyGuidance';
import type { BoardAuditSummary } from '@/lib/breadboard-board-audit';
import type { CircuitInstanceRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// CanvasCoordinateReadout
// ---------------------------------------------------------------------------

describe('CanvasCoordinateReadout', () => {
  it('renders nothing when mouseBoardPos is null', () => {
    const { container } = render(<CanvasCoordinateReadout mouseBoardPos={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows X and Y when a position is provided', () => {
    render(<CanvasCoordinateReadout mouseBoardPos={{ x: 12.3, y: 45.6 }} />);
    const readout = screen.getByTestId('coordinate-readout');
    expect(readout.textContent).toContain('12.3');
    expect(readout.textContent).toContain('45.6');
  });
});

// ---------------------------------------------------------------------------
// WireColorMenu
// ---------------------------------------------------------------------------

describe('WireColorMenu', () => {
  it('renders nothing when wireId is null', () => {
    const { container } = render(
      <WireColorMenu
        wireId={null}
        position={{ x: 0, y: 0 }}
        onColorChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when position is null', () => {
    const { container } = render(
      <WireColorMenu
        wireId={7}
        position={null}
        onColorChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the color grid and fires onColorChange with the selected preset', () => {
    const onColorChange = vi.fn();
    render(
      <WireColorMenu
        wireId={42}
        position={{ x: 10, y: 20 }}
        onColorChange={onColorChange}
        onClose={vi.fn()}
      />,
    );
    const menu = screen.getByTestId('wire-color-menu');
    expect(menu).toBeInTheDocument();
    const swatches = menu.querySelectorAll('button');
    expect(swatches.length).toBeGreaterThan(0);
    fireEvent.click(swatches[0]);
    expect(onColorChange).toHaveBeenCalledTimes(1);
    expect(onColorChange).toHaveBeenCalledWith(42, expect.stringMatching(/^#/));
  });

  it('calls onClose when the pointer leaves the menu', () => {
    const onClose = vi.fn();
    render(
      <WireColorMenu
        wireId={1}
        position={{ x: 0, y: 0 }}
        onColorChange={vi.fn()}
        onClose={onClose}
      />,
    );
    fireEvent.mouseLeave(screen.getByTestId('wire-color-menu'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// CanvasEmptyGuidance
// ---------------------------------------------------------------------------

function makeInstance(overrides: Partial<CircuitInstanceRow> = {}): CircuitInstanceRow {
  return {
    id: 1,
    circuitId: 1,
    partId: null,
    referenceDesignator: 'R1',
    properties: null,
    breadboardX: null,
    breadboardY: null,
    benchX: null,
    benchY: null,
    rotation: 0,
    mirrored: false,
    ...overrides,
  } as CircuitInstanceRow;
}

describe('CanvasEmptyGuidance', () => {
  it('shows guidance when no instances exist', () => {
    render(<CanvasEmptyGuidance instances={undefined} />);
    expect(screen.getByTestId('breadboard-empty-guidance')).toBeInTheDocument();
  });

  it('shows guidance when no instance has breadboardX set', () => {
    render(<CanvasEmptyGuidance instances={[makeInstance({ breadboardX: null })]} />);
    expect(screen.getByTestId('breadboard-empty-guidance')).toBeInTheDocument();
  });

  it('hides guidance when at least one instance is placed on the board', () => {
    const { container } = render(
      <CanvasEmptyGuidance instances={[makeInstance({ breadboardX: 10, breadboardY: 10 })]} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});

// ---------------------------------------------------------------------------
// CanvasToolbar
// ---------------------------------------------------------------------------

function makeAudit(overrides: Partial<BoardAuditSummary> = {}): BoardAuditSummary {
  return {
    score: 95,
    issues: [],
    generatedAt: new Date().toISOString(),
    ...overrides,
  } as BoardAuditSummary;
}

describe('CanvasToolbar', () => {
  const baseProps = {
    tool: 'select' as const,
    onToolChange: vi.fn(),
    zoom: 3,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onResetView: vi.fn(),
    showDrc: false,
    onToggleDrc: vi.fn(),
    showConnectivityExplainer: false,
    onToggleConnectivityExplainer: vi.fn(),
    boardAudit: null,
    onRunBoardAudit: vi.fn(),
    hoveredCoord: null,
    wireInProgress: null,
  };

  it('renders the three primary tool buttons', () => {
    render(<CanvasToolbar {...baseProps} />);
    expect(screen.getByTestId('tool-select')).toBeInTheDocument();
    expect(screen.getByTestId('tool-wire')).toBeInTheDocument();
    expect(screen.getByTestId('tool-delete')).toBeInTheDocument();
  });

  it('dispatches onToolChange when a tool is clicked', () => {
    const onToolChange = vi.fn();
    render(<CanvasToolbar {...baseProps} onToolChange={onToolChange} />);
    fireEvent.click(screen.getByTestId('tool-wire'));
    expect(onToolChange).toHaveBeenCalledWith('wire');
  });

  it('shows "Run audit" label when boardAudit is null', () => {
    render(<CanvasToolbar {...baseProps} boardAudit={null} />);
    const button = screen.getByTestId('button-run-audit-inline');
    expect(button.textContent).toContain('Run audit');
  });

  it('shows critical count when critical issues exist', () => {
    const audit = makeAudit({
      issues: [
        { severity: 'critical', id: 'x', title: 't', affectedInstanceIds: [] },
        { severity: 'warning', id: 'y', title: 't', affectedInstanceIds: [] },
      ] as BoardAuditSummary['issues'],
      score: 40,
    });
    render(<CanvasToolbar {...baseProps} boardAudit={audit} />);
    const button = screen.getByTestId('button-run-audit-inline');
    expect(button.textContent).toContain('1 critical');
    expect(button.textContent).toContain('40');
  });

  it('shows "Healthy" when audit has no issues', () => {
    render(<CanvasToolbar {...baseProps} boardAudit={makeAudit({ issues: [] })} />);
    expect(screen.getByTestId('button-run-audit-inline').textContent).toContain('Healthy');
  });
});
