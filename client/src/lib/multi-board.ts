/**
 * BL-0454 — Multi-Board System Orchestrator
 *
 * Manages systems composed of multiple interconnected PCBs.  Provides system
 * topology, inter-board links (connectors, cables, flex), power budget
 * calculation, signal tracing across boards, topology validation, system
 * diagram generation, and cost estimation.
 *
 * Singleton + Subscribe pattern.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BoardRole =
  | 'main'
  | 'power'
  | 'sensor'
  | 'actuator'
  | 'communication'
  | 'display'
  | 'io_expansion'
  | 'custom';

export type LinkType = 'connector' | 'cable' | 'flex' | 'wireless' | 'stacking';

export type SignalType = 'power' | 'ground' | 'digital' | 'analog' | 'high_speed' | 'mixed';

export interface BoardDefinition {
  id: string;
  name: string;
  role: BoardRole;
  description: string;
  /** Board dimensions (mm). */
  widthMm: number;
  heightMm: number;
  /** Estimated component count. */
  componentCount: number;
  /** Per-board power consumption (watts). */
  powerConsumptionW: number;
  /** Per-board estimated cost (USD). */
  estimatedCostUsd: number;
  /** Layer count. */
  layers: number;
  /** Custom metadata. */
  metadata: Record<string, string>;
}

export interface InterBoardLink {
  id: string;
  name: string;
  /** Source board ID. */
  fromBoardId: string;
  /** Target board ID. */
  toBoardId: string;
  linkType: LinkType;
  signalType: SignalType;
  /** Number of pins/conductors in this link. */
  pinCount: number;
  /** Signal names carried by this link. */
  signals: string[];
  /** Connector part number, if applicable. */
  connectorPartNumber?: string;
  /** Cable length in mm, if applicable. */
  cableLengthMm?: number;
  /** Whether this link is bidirectional. */
  bidirectional: boolean;
}

export interface PowerBudget {
  totalSupplyW: number;
  totalConsumptionW: number;
  marginW: number;
  marginPercent: number;
  perBoard: Array<{
    boardId: string;
    boardName: string;
    consumptionW: number;
    percentOfTotal: number;
  }>;
  withinBudget: boolean;
}

export interface SignalTrace {
  signalName: string;
  path: Array<{
    boardId: string;
    boardName: string;
    linkId?: string;
    linkName?: string;
  }>;
  crossesBoardCount: number;
}

export interface TopologyValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface SystemDiagramNode {
  id: string;
  label: string;
  role: BoardRole;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SystemDiagramEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  linkType: LinkType;
}

export interface SystemDiagram {
  nodes: SystemDiagramNode[];
  edges: SystemDiagramEdge[];
}

export interface SystemCostEstimate {
  pcbFabricationUsd: number;
  componentsUsd: number;
  connectorsUsd: number;
  cablesUsd: number;
  assemblyUsd: number;
  totalUsd: number;
  perBoardBreakdown: Array<{
    boardId: string;
    boardName: string;
    pcbUsd: number;
    componentsUsd: number;
  }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<BoardRole, string> = {
  main: 'Main Controller',
  power: 'Power Supply',
  sensor: 'Sensor Module',
  actuator: 'Actuator Driver',
  communication: 'Communication Module',
  display: 'Display Board',
  io_expansion: 'I/O Expansion',
  custom: 'Custom Board',
};

/** Rough per-layer PCB cost factor (USD per cm²). */
const PCB_COST_PER_CM2_PER_LAYER = 0.015;

/** Rough connector cost estimate per pin (USD). */
const CONNECTOR_COST_PER_PIN = 0.05;

/** Rough cable cost per meter (USD). */
const CABLE_COST_PER_METER = 0.50;

/** Assembly cost per board (USD, flat fee for low volume). */
const ASSEMBLY_COST_PER_BOARD = 5.0;

// ---------------------------------------------------------------------------
// MultiBoardManager — singleton
// ---------------------------------------------------------------------------

export class MultiBoardManager {
  private static instance: MultiBoardManager | null = null;

  private boards: Map<string, BoardDefinition> = new Map();
  private links: Map<string, InterBoardLink> = new Map();
  private systemName = 'Untitled System';
  private totalPowerSupplyW = 0;
  private subscribers = new Set<() => void>();

  constructor() {
    // Empty — call addBoard/addLink to populate
  }

  static getInstance(): MultiBoardManager {
    if (!MultiBoardManager.instance) {
      MultiBoardManager.instance = new MultiBoardManager();
    }
    return MultiBoardManager.instance;
  }

  static resetInstance(): void {
    MultiBoardManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  subscribe(fn: () => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // System metadata
  // -----------------------------------------------------------------------

  setSystemName(name: string): void {
    this.systemName = name;
    this.notify();
  }

  getSystemName(): string {
    return this.systemName;
  }

  setTotalPowerSupply(watts: number): void {
    this.totalPowerSupplyW = watts;
    this.notify();
  }

  getTotalPowerSupply(): number {
    return this.totalPowerSupplyW;
  }

  // -----------------------------------------------------------------------
  // Board management
  // -----------------------------------------------------------------------

  addBoard(board: BoardDefinition): void {
    this.boards.set(board.id, {
      ...board,
      metadata: { ...board.metadata },
    });
    this.notify();
  }

  updateBoard(id: string, updates: Partial<Omit<BoardDefinition, 'id'>>): boolean {
    const b = this.boards.get(id);
    if (!b) { return false; }

    if (updates.name !== undefined) { b.name = updates.name; }
    if (updates.role !== undefined) { b.role = updates.role; }
    if (updates.description !== undefined) { b.description = updates.description; }
    if (updates.widthMm !== undefined) { b.widthMm = updates.widthMm; }
    if (updates.heightMm !== undefined) { b.heightMm = updates.heightMm; }
    if (updates.componentCount !== undefined) { b.componentCount = updates.componentCount; }
    if (updates.powerConsumptionW !== undefined) { b.powerConsumptionW = updates.powerConsumptionW; }
    if (updates.estimatedCostUsd !== undefined) { b.estimatedCostUsd = updates.estimatedCostUsd; }
    if (updates.layers !== undefined) { b.layers = updates.layers; }
    if (updates.metadata !== undefined) { b.metadata = { ...updates.metadata }; }

    this.notify();
    return true;
  }

  removeBoard(id: string): boolean {
    const removed = this.boards.delete(id);
    if (removed) {
      // Remove links referencing this board
      const toDelete: string[] = [];
      this.links.forEach((link, linkId) => {
        if (link.fromBoardId === id || link.toBoardId === id) {
          toDelete.push(linkId);
        }
      });
      toDelete.forEach((linkId) => this.links.delete(linkId));
      this.notify();
    }
    return removed;
  }

  getBoard(id: string): BoardDefinition | undefined {
    const b = this.boards.get(id);
    return b ? { ...b, metadata: { ...b.metadata } } : undefined;
  }

  getAllBoards(): BoardDefinition[] {
    const result: BoardDefinition[] = [];
    this.boards.forEach((b) => {
      result.push({ ...b, metadata: { ...b.metadata } });
    });
    return result;
  }

  getBoardsByRole(role: BoardRole): BoardDefinition[] {
    return this.getAllBoards().filter((b) => b.role === role);
  }

  getBoardCount(): number {
    return this.boards.size;
  }

  getRoleLabel(role: BoardRole): string {
    return ROLE_LABELS[role];
  }

  // -----------------------------------------------------------------------
  // Link management
  // -----------------------------------------------------------------------

  addLink(link: InterBoardLink): boolean {
    // Validate board references
    if (!this.boards.has(link.fromBoardId) || !this.boards.has(link.toBoardId)) {
      return false;
    }
    if (link.fromBoardId === link.toBoardId) {
      return false;
    }
    this.links.set(link.id, {
      ...link,
      signals: [...link.signals],
    });
    this.notify();
    return true;
  }

  updateLink(id: string, updates: Partial<Omit<InterBoardLink, 'id'>>): boolean {
    const l = this.links.get(id);
    if (!l) { return false; }

    if (updates.name !== undefined) { l.name = updates.name; }
    if (updates.fromBoardId !== undefined) {
      if (!this.boards.has(updates.fromBoardId)) { return false; }
      l.fromBoardId = updates.fromBoardId;
    }
    if (updates.toBoardId !== undefined) {
      if (!this.boards.has(updates.toBoardId)) { return false; }
      l.toBoardId = updates.toBoardId;
    }
    if (updates.linkType !== undefined) { l.linkType = updates.linkType; }
    if (updates.signalType !== undefined) { l.signalType = updates.signalType; }
    if (updates.pinCount !== undefined) { l.pinCount = updates.pinCount; }
    if (updates.signals !== undefined) { l.signals = [...updates.signals]; }
    if (updates.connectorPartNumber !== undefined) { l.connectorPartNumber = updates.connectorPartNumber; }
    if (updates.cableLengthMm !== undefined) { l.cableLengthMm = updates.cableLengthMm; }
    if (updates.bidirectional !== undefined) { l.bidirectional = updates.bidirectional; }

    this.notify();
    return true;
  }

  removeLink(id: string): boolean {
    const removed = this.links.delete(id);
    if (removed) { this.notify(); }
    return removed;
  }

  getLink(id: string): InterBoardLink | undefined {
    const l = this.links.get(id);
    return l ? { ...l, signals: [...l.signals] } : undefined;
  }

  getAllLinks(): InterBoardLink[] {
    const result: InterBoardLink[] = [];
    this.links.forEach((l) => {
      result.push({ ...l, signals: [...l.signals] });
    });
    return result;
  }

  getLinksForBoard(boardId: string): InterBoardLink[] {
    return this.getAllLinks().filter(
      (l) => l.fromBoardId === boardId || l.toBoardId === boardId,
    );
  }

  getLinksBetween(boardIdA: string, boardIdB: string): InterBoardLink[] {
    return this.getAllLinks().filter(
      (l) =>
        (l.fromBoardId === boardIdA && l.toBoardId === boardIdB) ||
        (l.fromBoardId === boardIdB && l.toBoardId === boardIdA),
    );
  }

  // -----------------------------------------------------------------------
  // Power budget
  // -----------------------------------------------------------------------

  calculatePowerBudget(): PowerBudget {
    const perBoard: PowerBudget['perBoard'] = [];
    let totalConsumption = 0;

    this.boards.forEach((board) => {
      totalConsumption += board.powerConsumptionW;
      perBoard.push({
        boardId: board.id,
        boardName: board.name,
        consumptionW: board.powerConsumptionW,
        percentOfTotal: 0, // filled below
      });
    });

    perBoard.forEach((entry) => {
      entry.percentOfTotal = totalConsumption === 0
        ? 0
        : round2((entry.consumptionW / totalConsumption) * 100);
    });

    const margin = round2(this.totalPowerSupplyW - totalConsumption);
    const marginPercent = this.totalPowerSupplyW === 0
      ? 0
      : round2((margin / this.totalPowerSupplyW) * 100);

    return {
      totalSupplyW: this.totalPowerSupplyW,
      totalConsumptionW: round2(totalConsumption),
      marginW: margin,
      marginPercent,
      perBoard,
      withinBudget: margin >= 0,
    };
  }

  // -----------------------------------------------------------------------
  // Signal tracing
  // -----------------------------------------------------------------------

  traceSignal(signalName: string): SignalTrace {
    const path: SignalTrace['path'] = [];
    const visitedBoards = new Set<string>();

    // Find all links carrying this signal
    const relevantLinks: InterBoardLink[] = [];
    this.links.forEach((link) => {
      if (link.signals.includes(signalName)) {
        relevantLinks.push(link);
      }
    });

    if (relevantLinks.length === 0) {
      return { signalName, path: [], crossesBoardCount: 0 };
    }

    // BFS from the first link's source board
    const queue: string[] = [relevantLinks[0].fromBoardId];
    visitedBoards.add(relevantLinks[0].fromBoardId);

    while (queue.length > 0) {
      const boardId = queue.shift()!;
      const board = this.boards.get(boardId);
      if (!board) { continue; }

      path.push({ boardId, boardName: board.name });

      // Find links from this board carrying the signal
      relevantLinks.forEach((link) => {
        let nextBoardId: string | null = null;
        if (link.fromBoardId === boardId && !visitedBoards.has(link.toBoardId)) {
          nextBoardId = link.toBoardId;
        } else if (link.bidirectional && link.toBoardId === boardId && !visitedBoards.has(link.fromBoardId)) {
          nextBoardId = link.fromBoardId;
        }
        if (nextBoardId) {
          visitedBoards.add(nextBoardId);
          // Add the link transition to path
          path.push({
            boardId: nextBoardId,
            boardName: this.boards.get(nextBoardId)?.name ?? nextBoardId,
            linkId: link.id,
            linkName: link.name,
          });
          queue.push(nextBoardId);
        }
      });
    }

    return {
      signalName,
      path,
      crossesBoardCount: visitedBoards.size,
    };
  }

  /** Returns all unique signal names across all links. */
  getAllSignals(): string[] {
    const signals = new Set<string>();
    this.links.forEach((link) => {
      link.signals.forEach((s) => signals.add(s));
    });
    return Array.from(signals).sort();
  }

  // -----------------------------------------------------------------------
  // Topology validation
  // -----------------------------------------------------------------------

  validateTopology(): TopologyValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 1. At least one board
    if (this.boards.size === 0) {
      errors.push('System has no boards defined');
      return { valid: false, errors, warnings };
    }

    // 2. All boards should be connected (graph connectivity)
    const connected = this.getConnectedBoardIds();
    if (connected.size < this.boards.size) {
      const isolated: string[] = [];
      this.boards.forEach((_b, id) => {
        if (!connected.has(id)) {
          isolated.push(this.boards.get(id)?.name ?? id);
        }
      });
      if (this.boards.size > 1) {
        errors.push(`Isolated boards not connected to the system: ${isolated.join(', ')}`);
      }
    }

    // 3. Power board check
    let hasPowerBoard = false;
    this.boards.forEach((b) => {
      if (b.role === 'power') { hasPowerBoard = true; }
    });
    if (!hasPowerBoard && this.boards.size > 1) {
      warnings.push('No dedicated power board — ensure power distribution is handled by the main board');
    }

    // 4. Power budget
    if (this.totalPowerSupplyW > 0) {
      const budget = this.calculatePowerBudget();
      if (!budget.withinBudget) {
        errors.push(`Power budget exceeded: ${budget.totalConsumptionW}W consumption > ${budget.totalSupplyW}W supply`);
      } else if (budget.marginPercent < 10) {
        warnings.push(`Low power margin: only ${budget.marginPercent}% headroom`);
      }
    }

    // 5. Self-links (shouldn't exist but defensive)
    this.links.forEach((link) => {
      if (link.fromBoardId === link.toBoardId) {
        errors.push(`Link "${link.name}" connects board to itself`);
      }
    });

    // 6. Orphan links (referencing non-existent boards)
    this.links.forEach((link) => {
      if (!this.boards.has(link.fromBoardId)) {
        errors.push(`Link "${link.name}" references non-existent source board "${link.fromBoardId}"`);
      }
      if (!this.boards.has(link.toBoardId)) {
        errors.push(`Link "${link.name}" references non-existent target board "${link.toBoardId}"`);
      }
    });

    // 7. Duplicate links between same board pair with same signals
    const linkPairs = new Map<string, InterBoardLink[]>();
    this.links.forEach((link) => {
      const key = [link.fromBoardId, link.toBoardId].sort().join('::');
      const existing = linkPairs.get(key) ?? [];
      existing.push(link);
      linkPairs.set(key, existing);
    });
    linkPairs.forEach((pairLinks) => {
      if (pairLinks.length > 3) {
        const boardA = this.boards.get(pairLinks[0].fromBoardId)?.name ?? pairLinks[0].fromBoardId;
        const boardB = this.boards.get(pairLinks[0].toBoardId)?.name ?? pairLinks[0].toBoardId;
        warnings.push(`${pairLinks.length} links between ${boardA} and ${boardB} — consider consolidating`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  /** BFS to find all boards reachable from the first board. */
  private getConnectedBoardIds(): Set<string> {
    const visited = new Set<string>();
    const boardIds = Array.from(this.boards.keys());
    if (boardIds.length === 0) { return visited; }

    const queue: string[] = [boardIds[0]];
    visited.add(boardIds[0]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      this.links.forEach((link) => {
        if (link.fromBoardId === current && !visited.has(link.toBoardId)) {
          visited.add(link.toBoardId);
          queue.push(link.toBoardId);
        }
        if (link.toBoardId === current && !visited.has(link.fromBoardId)) {
          visited.add(link.fromBoardId);
          queue.push(link.fromBoardId);
        }
      });
    }

    return visited;
  }

  // -----------------------------------------------------------------------
  // System diagram generation
  // -----------------------------------------------------------------------

  generateSystemDiagram(): SystemDiagram {
    const nodes: SystemDiagramNode[] = [];
    const edges: SystemDiagramEdge[] = [];

    // Layout boards in a grid
    const boardArr = Array.from(this.boards.values());
    const cols = Math.max(1, Math.ceil(Math.sqrt(boardArr.length)));
    const nodeWidth = 200;
    const nodeHeight = 100;
    const spacing = 80;

    boardArr.forEach((board, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      nodes.push({
        id: board.id,
        label: board.name,
        role: board.role,
        x: col * (nodeWidth + spacing),
        y: row * (nodeHeight + spacing),
        width: nodeWidth,
        height: nodeHeight,
      });
    });

    this.links.forEach((link) => {
      edges.push({
        id: link.id,
        source: link.fromBoardId,
        target: link.toBoardId,
        label: link.name,
        linkType: link.linkType,
      });
    });

    return { nodes, edges };
  }

  // -----------------------------------------------------------------------
  // Cost estimation
  // -----------------------------------------------------------------------

  estimateSystemCost(): SystemCostEstimate {
    let pcbFabTotal = 0;
    let componentsTotal = 0;
    let connectorsTotal = 0;
    let cablesTotal = 0;
    let assemblyTotal = 0;
    const perBoard: SystemCostEstimate['perBoardBreakdown'] = [];

    this.boards.forEach((board) => {
      const areaCm2 = (board.widthMm / 10) * (board.heightMm / 10);
      const pcbCost = round2(areaCm2 * board.layers * PCB_COST_PER_CM2_PER_LAYER);
      pcbFabTotal += pcbCost;
      componentsTotal += board.estimatedCostUsd;
      assemblyTotal += ASSEMBLY_COST_PER_BOARD;

      perBoard.push({
        boardId: board.id,
        boardName: board.name,
        pcbUsd: pcbCost,
        componentsUsd: board.estimatedCostUsd,
      });
    });

    this.links.forEach((link) => {
      // Connector costs (both ends)
      connectorsTotal += round2(link.pinCount * CONNECTOR_COST_PER_PIN * 2);
      // Cable costs
      if (link.cableLengthMm) {
        cablesTotal += round2((link.cableLengthMm / 1000) * CABLE_COST_PER_METER);
      }
    });

    const totalUsd = round2(pcbFabTotal + componentsTotal + connectorsTotal + cablesTotal + assemblyTotal);

    return {
      pcbFabricationUsd: round2(pcbFabTotal),
      componentsUsd: round2(componentsTotal),
      connectorsUsd: round2(connectorsTotal),
      cablesUsd: round2(cablesTotal),
      assemblyUsd: round2(assemblyTotal),
      totalUsd,
      perBoardBreakdown: perBoard,
    };
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Returns boards sorted by power consumption (descending). */
  getBoardsByPowerConsumption(): BoardDefinition[] {
    return this.getAllBoards().sort((a, b) => b.powerConsumptionW - a.powerConsumptionW);
  }

  /** Returns the total component count across all boards. */
  getTotalComponentCount(): number {
    let total = 0;
    this.boards.forEach((b) => { total += b.componentCount; });
    return total;
  }

  /** Returns the total board area in mm². */
  getTotalBoardAreaMm2(): number {
    let total = 0;
    this.boards.forEach((b) => { total += b.widthMm * b.heightMm; });
    return round2(total);
  }

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  reset(): void {
    this.boards.clear();
    this.links.clear();
    this.systemName = 'Untitled System';
    this.totalPowerSupplyW = 0;
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
