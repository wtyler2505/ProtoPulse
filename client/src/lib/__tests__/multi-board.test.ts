import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MultiBoardManager } from '../multi-board';
import type {
  BoardDefinition,
  InterBoardLink,
  PowerBudget,
  SignalTrace,
  TopologyValidation,
  SystemDiagram,
  SystemCostEstimate,
} from '../multi-board';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBoard(overrides?: Partial<BoardDefinition>): BoardDefinition {
  return {
    id: overrides?.id ?? 'board-1',
    name: overrides?.name ?? 'Main Board',
    role: overrides?.role ?? 'main',
    description: overrides?.description ?? 'Main controller board',
    widthMm: overrides?.widthMm ?? 80,
    heightMm: overrides?.heightMm ?? 60,
    componentCount: overrides?.componentCount ?? 50,
    powerConsumptionW: overrides?.powerConsumptionW ?? 2.5,
    estimatedCostUsd: overrides?.estimatedCostUsd ?? 15.0,
    layers: overrides?.layers ?? 4,
    metadata: overrides?.metadata ?? {},
  };
}

function makeLink(overrides?: Partial<InterBoardLink>): InterBoardLink {
  return {
    id: overrides?.id ?? 'link-1',
    name: overrides?.name ?? 'Main-to-Sensor',
    fromBoardId: overrides?.fromBoardId ?? 'board-1',
    toBoardId: overrides?.toBoardId ?? 'board-2',
    linkType: overrides?.linkType ?? 'connector',
    signalType: overrides?.signalType ?? 'digital',
    pinCount: overrides?.pinCount ?? 10,
    signals: overrides?.signals ?? ['SDA', 'SCL', 'VCC', 'GND'],
    connectorPartNumber: overrides?.connectorPartNumber,
    cableLengthMm: overrides?.cableLengthMm,
    bidirectional: overrides?.bidirectional ?? true,
  };
}

function setupTwoBoards(mgr: MultiBoardManager): void {
  mgr.addBoard(makeBoard({ id: 'board-1', name: 'Main Board', role: 'main' }));
  mgr.addBoard(makeBoard({ id: 'board-2', name: 'Sensor Board', role: 'sensor', powerConsumptionW: 0.5 }));
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeEach(() => {
  MultiBoardManager.resetInstance();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('MultiBoardManager — singleton', () => {
  it('returns the same instance', () => {
    const a = MultiBoardManager.getInstance();
    const b = MultiBoardManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance clears the singleton', () => {
    const a = MultiBoardManager.getInstance();
    MultiBoardManager.resetInstance();
    const b = MultiBoardManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// System metadata
// ---------------------------------------------------------------------------

describe('System metadata', () => {
  it('defaults to Untitled System', () => {
    const mgr = new MultiBoardManager();
    expect(mgr.getSystemName()).toBe('Untitled System');
  });

  it('sets system name', () => {
    const mgr = new MultiBoardManager();
    mgr.setSystemName('Rover System');
    expect(mgr.getSystemName()).toBe('Rover System');
  });

  it('sets total power supply', () => {
    const mgr = new MultiBoardManager();
    mgr.setTotalPowerSupply(12);
    expect(mgr.getTotalPowerSupply()).toBe(12);
  });
});

// ---------------------------------------------------------------------------
// Board management
// ---------------------------------------------------------------------------

describe('Board management', () => {
  it('adds a board', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'board-1' }));
    expect(mgr.getBoard('board-1')).toBeDefined();
    expect(mgr.getBoardCount()).toBe(1);
  });

  it('updates a board', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'board-1', name: 'Original' }));
    expect(mgr.updateBoard('board-1', { name: 'Updated' })).toBe(true);
    expect(mgr.getBoard('board-1')!.name).toBe('Updated');
  });

  it('rejects updating non-existent board', () => {
    const mgr = new MultiBoardManager();
    expect(mgr.updateBoard('nope', { name: 'X' })).toBe(false);
  });

  it('removes a board and its links', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'link-1', fromBoardId: 'board-1', toBoardId: 'board-2' }));
    expect(mgr.removeBoard('board-2')).toBe(true);
    expect(mgr.getBoard('board-2')).toBeUndefined();
    expect(mgr.getAllLinks()).toHaveLength(0);
  });

  it('rejects removing non-existent board', () => {
    const mgr = new MultiBoardManager();
    expect(mgr.removeBoard('nope')).toBe(false);
  });

  it('getAllBoards returns copies', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'board-1' }));
    const all = mgr.getAllBoards();
    all[0].name = 'MODIFIED';
    expect(mgr.getBoard('board-1')!.name).not.toBe('MODIFIED');
  });

  it('getBoardsByRole filters correctly', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', role: 'main' }));
    mgr.addBoard(makeBoard({ id: 'b2', role: 'sensor' }));
    mgr.addBoard(makeBoard({ id: 'b3', role: 'sensor' }));
    expect(mgr.getBoardsByRole('sensor')).toHaveLength(2);
    expect(mgr.getBoardsByRole('main')).toHaveLength(1);
  });

  it('getRoleLabel returns labels', () => {
    const mgr = new MultiBoardManager();
    expect(mgr.getRoleLabel('main')).toBe('Main Controller');
    expect(mgr.getRoleLabel('power')).toBe('Power Supply');
  });

  it('updateBoard updates all fields', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'board-1' }));
    mgr.updateBoard('board-1', {
      name: 'New',
      role: 'power',
      description: 'Power board',
      widthMm: 100,
      heightMm: 80,
      componentCount: 20,
      powerConsumptionW: 1.0,
      estimatedCostUsd: 10.0,
      layers: 2,
      metadata: { rev: '2' },
    });
    const b = mgr.getBoard('board-1')!;
    expect(b.name).toBe('New');
    expect(b.role).toBe('power');
    expect(b.widthMm).toBe(100);
    expect(b.layers).toBe(2);
    expect(b.metadata.rev).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// Link management
// ---------------------------------------------------------------------------

describe('Link management', () => {
  it('adds a link between existing boards', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    expect(mgr.addLink(makeLink())).toBe(true);
    expect(mgr.getLink('link-1')).toBeDefined();
  });

  it('rejects link to non-existent board', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'board-1' }));
    expect(mgr.addLink(makeLink({ fromBoardId: 'board-1', toBoardId: 'no-board' }))).toBe(false);
  });

  it('rejects self-link', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'board-1' }));
    expect(mgr.addLink(makeLink({ fromBoardId: 'board-1', toBoardId: 'board-1' }))).toBe(false);
  });

  it('updates a link', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'link-1', name: 'Original' }));
    expect(mgr.updateLink('link-1', { name: 'Updated' })).toBe(true);
    expect(mgr.getLink('link-1')!.name).toBe('Updated');
  });

  it('rejects updating non-existent link', () => {
    const mgr = new MultiBoardManager();
    expect(mgr.updateLink('nope', { name: 'X' })).toBe(false);
  });

  it('rejects updating link to non-existent board', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'link-1' }));
    expect(mgr.updateLink('link-1', { fromBoardId: 'no-board' })).toBe(false);
  });

  it('removes a link', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'link-1' }));
    expect(mgr.removeLink('link-1')).toBe(true);
    expect(mgr.getLink('link-1')).toBeUndefined();
  });

  it('rejects removing non-existent link', () => {
    const mgr = new MultiBoardManager();
    expect(mgr.removeLink('nope')).toBe(false);
  });

  it('getLinksForBoard returns all links for a board', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    mgr.addBoard(makeBoard({ id: 'b2' }));
    mgr.addBoard(makeBoard({ id: 'b3' }));
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'b1', toBoardId: 'b2' }));
    mgr.addLink(makeLink({ id: 'l2', fromBoardId: 'b1', toBoardId: 'b3' }));
    mgr.addLink(makeLink({ id: 'l3', fromBoardId: 'b2', toBoardId: 'b3' }));
    expect(mgr.getLinksForBoard('b1')).toHaveLength(2);
    expect(mgr.getLinksForBoard('b3')).toHaveLength(2);
  });

  it('getLinksBetween returns links between two boards', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    mgr.addBoard(makeBoard({ id: 'b2' }));
    mgr.addBoard(makeBoard({ id: 'b3' }));
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'b1', toBoardId: 'b2' }));
    mgr.addLink(makeLink({ id: 'l2', fromBoardId: 'b2', toBoardId: 'b1' }));
    mgr.addLink(makeLink({ id: 'l3', fromBoardId: 'b1', toBoardId: 'b3' }));
    expect(mgr.getLinksBetween('b1', 'b2')).toHaveLength(2);
    expect(mgr.getLinksBetween('b1', 'b3')).toHaveLength(1);
  });

  it('getAllLinks returns copies', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'link-1' }));
    const all = mgr.getAllLinks();
    all[0].name = 'MODIFIED';
    expect(mgr.getLink('link-1')!.name).not.toBe('MODIFIED');
  });
});

// ---------------------------------------------------------------------------
// Power budget
// ---------------------------------------------------------------------------

describe('Power budget', () => {
  it('calculates total consumption', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', powerConsumptionW: 2.0 }));
    mgr.addBoard(makeBoard({ id: 'b2', powerConsumptionW: 1.5 }));
    mgr.setTotalPowerSupply(10);

    const budget = mgr.calculatePowerBudget();
    expect(budget.totalConsumptionW).toBe(3.5);
    expect(budget.marginW).toBe(6.5);
    expect(budget.withinBudget).toBe(true);
  });

  it('detects over-budget', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', powerConsumptionW: 5.0 }));
    mgr.addBoard(makeBoard({ id: 'b2', powerConsumptionW: 6.0 }));
    mgr.setTotalPowerSupply(10);

    const budget = mgr.calculatePowerBudget();
    expect(budget.withinBudget).toBe(false);
    expect(budget.marginW).toBeLessThan(0);
  });

  it('calculates per-board percentage', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', powerConsumptionW: 3.0 }));
    mgr.addBoard(makeBoard({ id: 'b2', powerConsumptionW: 1.0 }));
    mgr.setTotalPowerSupply(10);

    const budget = mgr.calculatePowerBudget();
    const b1 = budget.perBoard.find((p) => p.boardId === 'b1')!;
    expect(b1.percentOfTotal).toBe(75);
  });

  it('handles zero total consumption', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', powerConsumptionW: 0 }));
    mgr.setTotalPowerSupply(10);

    const budget = mgr.calculatePowerBudget();
    expect(budget.totalConsumptionW).toBe(0);
    expect(budget.perBoard[0].percentOfTotal).toBe(0);
  });

  it('handles zero supply', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', powerConsumptionW: 5.0 }));

    const budget = mgr.calculatePowerBudget();
    expect(budget.marginPercent).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Signal tracing
// ---------------------------------------------------------------------------

describe('Signal tracing', () => {
  it('traces a signal across boards', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', name: 'Main' }));
    mgr.addBoard(makeBoard({ id: 'b2', name: 'Sensor' }));
    mgr.addLink(makeLink({
      id: 'l1',
      fromBoardId: 'b1',
      toBoardId: 'b2',
      signals: ['SDA', 'SCL'],
      bidirectional: true,
    }));

    const trace = mgr.traceSignal('SDA');
    expect(trace.signalName).toBe('SDA');
    expect(trace.crossesBoardCount).toBe(2);
    expect(trace.path.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty path for unknown signal', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    const trace = mgr.traceSignal('UNKNOWN');
    expect(trace.path).toHaveLength(0);
    expect(trace.crossesBoardCount).toBe(0);
  });

  it('traces through multiple boards', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', name: 'A' }));
    mgr.addBoard(makeBoard({ id: 'b2', name: 'B' }));
    mgr.addBoard(makeBoard({ id: 'b3', name: 'C' }));
    mgr.addLink(makeLink({
      id: 'l1', fromBoardId: 'b1', toBoardId: 'b2',
      signals: ['CLK'], bidirectional: true,
    }));
    mgr.addLink(makeLink({
      id: 'l2', fromBoardId: 'b2', toBoardId: 'b3',
      signals: ['CLK'], bidirectional: true,
    }));

    const trace = mgr.traceSignal('CLK');
    expect(trace.crossesBoardCount).toBe(3);
  });

  it('getAllSignals returns unique sorted signal names', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    mgr.addBoard(makeBoard({ id: 'b2' }));
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'b1', toBoardId: 'b2', signals: ['SDA', 'SCL', 'VCC'] }));
    mgr.addLink(makeLink({ id: 'l2', fromBoardId: 'b1', toBoardId: 'b2', signals: ['VCC', 'GND'] }));
    const signals = mgr.getAllSignals();
    expect(signals).toEqual(['GND', 'SCL', 'SDA', 'VCC']);
  });
});

// ---------------------------------------------------------------------------
// Topology validation
// ---------------------------------------------------------------------------

describe('Topology validation', () => {
  it('reports error when no boards', () => {
    const mgr = new MultiBoardManager();
    const v = mgr.validateTopology();
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('no boards'))).toBe(true);
  });

  it('reports isolated boards', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    mgr.addBoard(makeBoard({ id: 'b2' }));
    mgr.addBoard(makeBoard({ id: 'b3' }));
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'b1', toBoardId: 'b2' }));
    // b3 is isolated
    const v = mgr.validateTopology();
    expect(v.valid).toBe(false);
    expect(v.errors.some((e) => e.includes('Isolated'))).toBe(true);
  });

  it('valid when all boards are connected', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', role: 'power' }));
    mgr.addBoard(makeBoard({ id: 'b2', role: 'main' }));
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'b1', toBoardId: 'b2' }));
    mgr.setTotalPowerSupply(20);

    const v = mgr.validateTopology();
    expect(v.valid).toBe(true);
  });

  it('warns about missing power board', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', role: 'main' }));
    mgr.addBoard(makeBoard({ id: 'b2', role: 'sensor' }));
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'b1', toBoardId: 'b2' }));

    const v = mgr.validateTopology();
    expect(v.warnings.some((w) => w.includes('power board'))).toBe(true);
  });

  it('reports power budget exceeded', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', role: 'power', powerConsumptionW: 15 }));
    mgr.setTotalPowerSupply(10);

    const v = mgr.validateTopology();
    expect(v.errors.some((e) => e.includes('Power budget exceeded'))).toBe(true);
  });

  it('warns about low power margin', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', role: 'power', powerConsumptionW: 9.5 }));
    mgr.setTotalPowerSupply(10);

    const v = mgr.validateTopology();
    expect(v.warnings.some((w) => w.includes('margin'))).toBe(true);
  });

  it('warns about too many links between same pair', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    mgr.addBoard(makeBoard({ id: 'b2' }));
    for (let i = 0; i < 4; i++) {
      mgr.addLink(makeLink({ id: `l${i}`, fromBoardId: 'b1', toBoardId: 'b2' }));
    }
    const v = mgr.validateTopology();
    expect(v.warnings.some((w) => w.includes('consolidating'))).toBe(true);
  });

  it('single board passes validation', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', role: 'main' }));
    const v = mgr.validateTopology();
    expect(v.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// System diagram
// ---------------------------------------------------------------------------

describe('System diagram', () => {
  it('generates nodes and edges', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'board-1', toBoardId: 'board-2' }));

    const diagram = mgr.generateSystemDiagram();
    expect(diagram.nodes).toHaveLength(2);
    expect(diagram.edges).toHaveLength(1);
  });

  it('diagram nodes have correct labels', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', name: 'MCU Board' }));
    const diagram = mgr.generateSystemDiagram();
    expect(diagram.nodes[0].label).toBe('MCU Board');
  });

  it('diagram edges reference correct boards', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'board-1', toBoardId: 'board-2' }));

    const diagram = mgr.generateSystemDiagram();
    expect(diagram.edges[0].source).toBe('board-1');
    expect(diagram.edges[0].target).toBe('board-2');
  });

  it('empty system produces empty diagram', () => {
    const mgr = new MultiBoardManager();
    const diagram = mgr.generateSystemDiagram();
    expect(diagram.nodes).toHaveLength(0);
    expect(diagram.edges).toHaveLength(0);
  });

  it('grid layout spaces nodes correctly', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    mgr.addBoard(makeBoard({ id: 'b2' }));
    mgr.addBoard(makeBoard({ id: 'b3' }));
    mgr.addBoard(makeBoard({ id: 'b4' }));

    const diagram = mgr.generateSystemDiagram();
    // 4 boards → 2x2 grid
    const xValues = new Set(diagram.nodes.map((n) => n.x));
    const yValues = new Set(diagram.nodes.map((n) => n.y));
    expect(xValues.size).toBe(2);
    expect(yValues.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Cost estimation
// ---------------------------------------------------------------------------

describe('Cost estimation', () => {
  it('estimates system cost', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({
      id: 'b1', widthMm: 80, heightMm: 60, layers: 4, estimatedCostUsd: 15,
    }));
    mgr.addBoard(makeBoard({
      id: 'b2', widthMm: 40, heightMm: 30, layers: 2, estimatedCostUsd: 5,
    }));
    mgr.addLink(makeLink({
      id: 'l1', fromBoardId: 'b1', toBoardId: 'b2',
      pinCount: 10, cableLengthMm: 200,
    }));

    const cost = mgr.estimateSystemCost();
    expect(cost.totalUsd).toBeGreaterThan(0);
    expect(cost.pcbFabricationUsd).toBeGreaterThan(0);
    expect(cost.componentsUsd).toBe(20); // 15 + 5
    expect(cost.connectorsUsd).toBeGreaterThan(0);
    expect(cost.cablesUsd).toBeGreaterThan(0);
    expect(cost.assemblyUsd).toBe(10); // 2 boards * $5
    expect(cost.perBoardBreakdown).toHaveLength(2);
  });

  it('no cables cost when cableLengthMm not set', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    mgr.addLink(makeLink({ id: 'l1', fromBoardId: 'board-1', toBoardId: 'board-2' }));
    const cost = mgr.estimateSystemCost();
    expect(cost.cablesUsd).toBe(0);
  });

  it('per-board breakdown includes correct IDs', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', name: 'Main' }));
    const cost = mgr.estimateSystemCost();
    expect(cost.perBoardBreakdown[0].boardId).toBe('b1');
    expect(cost.perBoardBreakdown[0].boardName).toBe('Main');
  });

  it('empty system has zero cost', () => {
    const mgr = new MultiBoardManager();
    const cost = mgr.estimateSystemCost();
    expect(cost.totalUsd).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

describe('Queries', () => {
  it('getBoardsByPowerConsumption sorts descending', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', powerConsumptionW: 1.0 }));
    mgr.addBoard(makeBoard({ id: 'b2', powerConsumptionW: 5.0 }));
    mgr.addBoard(makeBoard({ id: 'b3', powerConsumptionW: 2.5 }));

    const sorted = mgr.getBoardsByPowerConsumption();
    expect(sorted[0].id).toBe('b2');
    expect(sorted[1].id).toBe('b3');
    expect(sorted[2].id).toBe('b1');
  });

  it('getTotalComponentCount sums all boards', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', componentCount: 50 }));
    mgr.addBoard(makeBoard({ id: 'b2', componentCount: 30 }));
    expect(mgr.getTotalComponentCount()).toBe(80);
  });

  it('getTotalBoardAreaMm2 sums all board areas', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1', widthMm: 80, heightMm: 60 }));
    mgr.addBoard(makeBoard({ id: 'b2', widthMm: 40, heightMm: 30 }));
    expect(mgr.getTotalBoardAreaMm2()).toBe(6000); // 4800 + 1200
  });
});

// ---------------------------------------------------------------------------
// Subscribe
// ---------------------------------------------------------------------------

describe('Subscribe', () => {
  it('notifies on board add', () => {
    const mgr = new MultiBoardManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.addBoard(makeBoard());
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on board update', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.updateBoard('b1', { name: 'New' });
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on board remove', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard({ id: 'b1' }));
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.removeBoard('b1');
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on link add', () => {
    const mgr = new MultiBoardManager();
    setupTwoBoards(mgr);
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.addLink(makeLink());
    expect(fn).toHaveBeenCalled();
  });

  it('notifies on system name change', () => {
    const mgr = new MultiBoardManager();
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.setSystemName('New Name');
    expect(fn).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const mgr = new MultiBoardManager();
    const fn = vi.fn();
    const unsub = mgr.subscribe(fn);
    unsub();
    mgr.addBoard(makeBoard());
    expect(fn).not.toHaveBeenCalled();
  });

  it('notifies on reset', () => {
    const mgr = new MultiBoardManager();
    mgr.addBoard(makeBoard());
    const fn = vi.fn();
    mgr.subscribe(fn);
    mgr.reset();
    expect(fn).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Reset
// ---------------------------------------------------------------------------

describe('Reset', () => {
  it('clears all state', () => {
    const mgr = new MultiBoardManager();
    mgr.setSystemName('My System');
    mgr.setTotalPowerSupply(12);
    setupTwoBoards(mgr);
    mgr.addLink(makeLink());

    mgr.reset();

    expect(mgr.getSystemName()).toBe('Untitled System');
    expect(mgr.getTotalPowerSupply()).toBe(0);
    expect(mgr.getAllBoards()).toHaveLength(0);
    expect(mgr.getAllLinks()).toHaveLength(0);
  });
});
