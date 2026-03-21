// ---------------------------------------------------------------------------
// Panelization Tool — BL-0468
// Computes PCB panel layouts with tab routing, v-score, mouse-bite separation,
// fiducials, tooling holes, and rails.
// ---------------------------------------------------------------------------

export type SeparationType = 'tab' | 'v-score' | 'mouse-bite';

export interface TabRouteConfig {
  /** Tab width in mm */
  width: number;
  /** Number of tabs per board edge */
  count: number;
  /** Perforation hole diameter (mm) for breakaway */
  perforationDiameter: number;
  /** Number of perforation holes per tab */
  perforationCount: number;
}

export interface VScoreConfig {
  /** Remaining material thickness (mm) — typically 0.3-0.5mm */
  remainingThickness: number;
  /** Score offset from board edge (mm) */
  offset: number;
}

export interface MouseBiteConfig {
  /** Hole diameter (mm) — typically 0.5mm */
  holeDiameter: number;
  /** Spacing between holes (mm) */
  holeSpacing: number;
  /** Number of holes per segment */
  holesPerSegment: number;
  /** Bridge width between boards (mm) */
  bridgeWidth: number;
}

export interface FiducialConfig {
  /** Enable fiducials */
  enabled: boolean;
  /** Fiducial pad diameter (mm) — typically 1.0mm */
  diameter: number;
  /** Clearance ring diameter (mm) — typically 2.0mm */
  clearance: number;
  /** Inset from panel edge (mm) */
  inset: number;
}

export interface ToolingHoleConfig {
  /** Enable tooling holes */
  enabled: boolean;
  /** Hole diameter (mm) — typically 2.5 or 3.175mm (1/8 inch) */
  diameter: number;
  /** Inset from panel edge (mm) */
  inset: number;
  /** Whether to add plating */
  plated: boolean;
}

export interface RailConfig {
  /** Enable rails */
  enabled: boolean;
  /** Rail width (mm) — typically 5-10mm */
  width: number;
  /** Which sides have rails */
  sides: ('top' | 'bottom' | 'left' | 'right')[];
}

export interface PanelConfig {
  /** Individual board width (mm) */
  boardWidth: number;
  /** Individual board height (mm) */
  boardHeight: number;
  /** Panel width (mm) — if not set, auto-calculated */
  panelWidth?: number;
  /** Panel height (mm) — if not set, auto-calculated */
  panelHeight?: number;
  /** Number of columns — if not set, auto-calculated */
  columns?: number;
  /** Number of rows — if not set, auto-calculated */
  rows?: number;
  /** Separation type between boards */
  separationType: SeparationType;
  /** Gap between boards (mm) — used for tab and mouse-bite */
  boardGap: number;
  /** Tab route configuration */
  tabRoute?: TabRouteConfig;
  /** V-score configuration */
  vScore?: VScoreConfig;
  /** Mouse-bite configuration */
  mouseBite?: MouseBiteConfig;
  /** Fiducial configuration */
  fiducials: FiducialConfig;
  /** Tooling hole configuration */
  toolingHoles: ToolingHoleConfig;
  /** Rail configuration */
  rails: RailConfig;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface BoardPosition {
  /** Column index (0-based) */
  column: number;
  /** Row index (0-based) */
  row: number;
  /** X position of board origin (mm) */
  x: number;
  /** Y position of board origin (mm) */
  y: number;
  /** Board width (mm) */
  width: number;
  /** Board height (mm) */
  height: number;
}

export type FeatureType =
  | 'tab'
  | 'v-score-line'
  | 'mouse-bite-hole'
  | 'perforation-hole'
  | 'fiducial'
  | 'tooling-hole'
  | 'rail';

export interface PanelFeature {
  type: FeatureType;
  /** X position (mm) */
  x: number;
  /** Y position (mm) */
  y: number;
  /** Width for rectangular features, diameter for circular */
  width: number;
  /** Height for rectangular features, same as width for circular */
  height: number;
  /** Layer hint */
  layer: 'all' | 'front' | 'back' | 'mechanical';
  /** Additional metadata */
  metadata: Record<string, string | number | boolean>;
}

export interface PanelWarning {
  code: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface PanelResult {
  /** Computed panel width (mm) */
  panelWidth: number;
  /** Computed panel height (mm) */
  panelHeight: number;
  /** Number of columns */
  columns: number;
  /** Number of rows */
  rows: number;
  /** Total number of boards */
  boardCount: number;
  /** Board positions within the panel */
  boards: BoardPosition[];
  /** Panel features (tabs, scores, fiducials, etc.) */
  features: PanelFeature[];
  /** Panel utilization as a fraction (0-1) */
  utilization: number;
  /** Warnings generated during layout */
  warnings: PanelWarning[];
  /** Board gap used (mm) */
  boardGap: number;
  /** Separation type used */
  separationType: SeparationType;
}

// ---------------------------------------------------------------------------
// Standard panel sizes (mm)
// ---------------------------------------------------------------------------

export interface StandardPanelSize {
  name: string;
  width: number;
  height: number;
}

export const STANDARD_PANEL_SIZES: StandardPanelSize[] = [
  { name: '100x100', width: 100, height: 100 },
  { name: '160x100', width: 160, height: 100 },
  { name: '200x150', width: 200, height: 150 },
  { name: '250x200', width: 250, height: 200 },
  { name: '300x200', width: 300, height: 200 },
  { name: '450x300', width: 450, height: 300 },
];

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_TAB_ROUTE: TabRouteConfig = {
  width: 3,
  count: 3,
  perforationDiameter: 0.5,
  perforationCount: 5,
};

const DEFAULT_V_SCORE: VScoreConfig = {
  remainingThickness: 0.4,
  offset: 0,
};

const DEFAULT_MOUSE_BITE: MouseBiteConfig = {
  holeDiameter: 0.5,
  holeSpacing: 0.8,
  holesPerSegment: 5,
  bridgeWidth: 2,
};

const DEFAULT_FIDUCIALS: FiducialConfig = {
  enabled: true,
  diameter: 1.0,
  clearance: 2.0,
  inset: 3.0,
};

const DEFAULT_TOOLING_HOLES: ToolingHoleConfig = {
  enabled: true,
  diameter: 3.175,
  inset: 5.0,
  plated: false,
};

const DEFAULT_RAILS: RailConfig = {
  enabled: true,
  width: 5,
  sides: ['top', 'bottom'],
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateConfig(config: PanelConfig): PanelWarning[] {
  const warnings: PanelWarning[] = [];

  if (config.boardWidth <= 0 || config.boardHeight <= 0) {
    warnings.push({
      code: 'INVALID_BOARD_SIZE',
      message: 'Board dimensions must be positive',
      severity: 'error',
    });
  }

  if (config.boardGap < 0) {
    warnings.push({
      code: 'NEGATIVE_GAP',
      message: 'Board gap cannot be negative',
      severity: 'error',
    });
  }

  if (config.separationType === 'v-score' && config.boardGap > 0) {
    warnings.push({
      code: 'VSCORE_GAP',
      message: 'V-score separation typically uses zero gap between boards',
      severity: 'info',
    });
  }

  if (config.panelWidth !== undefined && config.panelWidth < config.boardWidth) {
    warnings.push({
      code: 'PANEL_TOO_SMALL_WIDTH',
      message: 'Panel width is smaller than a single board',
      severity: 'error',
    });
  }

  if (config.panelHeight !== undefined && config.panelHeight < config.boardHeight) {
    warnings.push({
      code: 'PANEL_TOO_SMALL_HEIGHT',
      message: 'Panel height is smaller than a single board',
      severity: 'error',
    });
  }

  if (config.columns !== undefined && config.columns < 1) {
    warnings.push({
      code: 'INVALID_COLUMNS',
      message: 'Column count must be at least 1',
      severity: 'error',
    });
  }

  if (config.rows !== undefined && config.rows < 1) {
    warnings.push({
      code: 'INVALID_ROWS',
      message: 'Row count must be at least 1',
      severity: 'error',
    });
  }

  if (config.separationType === 'mouse-bite') {
    const mb = config.mouseBite ?? DEFAULT_MOUSE_BITE;
    if (mb.bridgeWidth < mb.holeDiameter * 2) {
      warnings.push({
        code: 'MOUSE_BITE_BRIDGE_NARROW',
        message: 'Mouse bite bridge width is less than 2x hole diameter — may weaken panel',
        severity: 'warning',
      });
    }
  }

  if (config.rails.enabled) {
    if (config.rails.width < 3) {
      warnings.push({
        code: 'RAIL_TOO_NARROW',
        message: 'Rail width under 3mm may not provide adequate support for pick-and-place',
        severity: 'warning',
      });
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Rail dimension helpers
// ---------------------------------------------------------------------------

function getRailDimensions(rails: RailConfig): { top: number; bottom: number; left: number; right: number } {
  if (!rails.enabled) {
    return { top: 0, bottom: 0, left: 0, right: 0 };
  }
  return {
    top: rails.sides.includes('top') ? rails.width : 0,
    bottom: rails.sides.includes('bottom') ? rails.width : 0,
    left: rails.sides.includes('left') ? rails.width : 0,
    right: rails.sides.includes('right') ? rails.width : 0,
  };
}

// ---------------------------------------------------------------------------
// Layout computation
// ---------------------------------------------------------------------------

function computeLayout(config: PanelConfig): {
  columns: number;
  rows: number;
  panelWidth: number;
  panelHeight: number;
  warnings: PanelWarning[];
} {
  const warnings: PanelWarning[] = [];
  const railDims = getRailDimensions(config.rails);

  // If columns and rows are specified, compute panel size
  if (config.columns !== undefined && config.rows !== undefined) {
    const cols = Math.max(1, Math.floor(config.columns));
    const rws = Math.max(1, Math.floor(config.rows));
    const totalGapX = Math.max(0, cols - 1) * config.boardGap;
    const totalGapY = Math.max(0, rws - 1) * config.boardGap;
    const pw = railDims.left + cols * config.boardWidth + totalGapX + railDims.right;
    const ph = railDims.top + rws * config.boardHeight + totalGapY + railDims.bottom;
    return { columns: cols, rows: rws, panelWidth: pw, panelHeight: ph, warnings };
  }

  // If panel size is specified, compute how many boards fit
  if (config.panelWidth !== undefined && config.panelHeight !== undefined) {
    const availW = config.panelWidth - railDims.left - railDims.right;
    const availH = config.panelHeight - railDims.top - railDims.bottom;

    if (availW < config.boardWidth || availH < config.boardHeight) {
      warnings.push({
        code: 'NO_FIT',
        message: 'No boards fit in the specified panel dimensions after accounting for rails',
        severity: 'error',
      });
      return { columns: 0, rows: 0, panelWidth: config.panelWidth, panelHeight: config.panelHeight, warnings };
    }

    // First board doesn't need a gap, subsequent boards need boardWidth + gap
    const cols = Math.floor((availW + config.boardGap) / (config.boardWidth + config.boardGap));
    const rws = Math.floor((availH + config.boardGap) / (config.boardHeight + config.boardGap));

    if (cols < 1 || rws < 1) {
      warnings.push({
        code: 'NO_FIT',
        message: 'No boards fit in the specified panel dimensions',
        severity: 'error',
      });
      return { columns: 0, rows: 0, panelWidth: config.panelWidth, panelHeight: config.panelHeight, warnings };
    }

    return { columns: cols, rows: rws, panelWidth: config.panelWidth, panelHeight: config.panelHeight, warnings };
  }

  // Shouldn't reach here — autoPanel or caller should set dimensions
  warnings.push({
    code: 'INCOMPLETE_CONFIG',
    message: 'Either panel dimensions or column/row counts must be specified',
    severity: 'error',
  });
  return { columns: 1, rows: 1, panelWidth: config.boardWidth, panelHeight: config.boardHeight, warnings };
}

// ---------------------------------------------------------------------------
// Board placement
// ---------------------------------------------------------------------------

function computeBoardPositions(
  columns: number,
  rows: number,
  boardWidth: number,
  boardHeight: number,
  boardGap: number,
  rails: RailConfig,
): BoardPosition[] {
  const railDims = getRailDimensions(rails);
  const boards: BoardPosition[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      boards.push({
        column: col,
        row,
        x: railDims.left + col * (boardWidth + boardGap),
        y: railDims.top + row * (boardHeight + boardGap),
        width: boardWidth,
        height: boardHeight,
      });
    }
  }

  return boards;
}

// ---------------------------------------------------------------------------
// Separation feature generation
// ---------------------------------------------------------------------------

function generateTabFeatures(
  boards: BoardPosition[],
  columns: number,
  rows: number,
  boardWidth: number,
  boardHeight: number,
  tabConfig: TabRouteConfig,
): PanelFeature[] {
  const features: PanelFeature[] = [];

  // Horizontal tabs (between rows)
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns; col++) {
      const board = boards[row * columns + col];
      const tabSpacing = boardWidth / (tabConfig.count + 1);

      for (let t = 0; t < tabConfig.count; t++) {
        const tabX = board.x + tabSpacing * (t + 1) - tabConfig.width / 2;
        const tabY = board.y + boardHeight;

        features.push({
          type: 'tab',
          x: tabX,
          y: tabY,
          width: tabConfig.width,
          height: 0,
          layer: 'mechanical',
          metadata: { direction: 'horizontal', row, col },
        });

        // Perforation holes along tab
        if (tabConfig.perforationCount > 0) {
          const perfSpacing = tabConfig.width / (tabConfig.perforationCount + 1);
          for (let p = 0; p < tabConfig.perforationCount; p++) {
            features.push({
              type: 'perforation-hole',
              x: tabX + perfSpacing * (p + 1),
              y: tabY,
              width: tabConfig.perforationDiameter,
              height: tabConfig.perforationDiameter,
              layer: 'all',
              metadata: { tabIndex: t, holeIndex: p },
            });
          }
        }
      }
    }
  }

  // Vertical tabs (between columns)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const board = boards[row * columns + col];
      const tabSpacing = boardHeight / (tabConfig.count + 1);

      for (let t = 0; t < tabConfig.count; t++) {
        const tabX = board.x + boardWidth;
        const tabY = board.y + tabSpacing * (t + 1) - tabConfig.width / 2;

        features.push({
          type: 'tab',
          x: tabX,
          y: tabY,
          width: 0,
          height: tabConfig.width,
          layer: 'mechanical',
          metadata: { direction: 'vertical', row, col },
        });

        // Perforation holes along tab
        if (tabConfig.perforationCount > 0) {
          const perfSpacing = tabConfig.width / (tabConfig.perforationCount + 1);
          for (let p = 0; p < tabConfig.perforationCount; p++) {
            features.push({
              type: 'perforation-hole',
              x: tabX,
              y: tabY + perfSpacing * (p + 1),
              width: tabConfig.perforationDiameter,
              height: tabConfig.perforationDiameter,
              layer: 'all',
              metadata: { tabIndex: t, holeIndex: p },
            });
          }
        }
      }
    }
  }

  return features;
}

function generateVScoreFeatures(
  boards: BoardPosition[],
  columns: number,
  rows: number,
  boardWidth: number,
  boardHeight: number,
  panelWidth: number,
  panelHeight: number,
  vScoreConfig: VScoreConfig,
): PanelFeature[] {
  const features: PanelFeature[] = [];

  // Horizontal v-score lines between rows
  for (let row = 0; row < rows - 1; row++) {
    const board = boards[row * columns]; // first board in this row
    const scoreY = board.y + boardHeight + vScoreConfig.offset;
    features.push({
      type: 'v-score-line',
      x: 0,
      y: scoreY,
      width: panelWidth,
      height: 0,
      layer: 'mechanical',
      metadata: {
        direction: 'horizontal',
        remainingThickness: vScoreConfig.remainingThickness,
        row,
      },
    });
  }

  // Vertical v-score lines between columns
  for (let col = 0; col < columns - 1; col++) {
    const board = boards[col]; // first row, this column
    const scoreX = board.x + boardWidth + vScoreConfig.offset;
    features.push({
      type: 'v-score-line',
      x: scoreX,
      y: 0,
      width: 0,
      height: panelHeight,
      layer: 'mechanical',
      metadata: {
        direction: 'vertical',
        remainingThickness: vScoreConfig.remainingThickness,
        col,
      },
    });
  }

  return features;
}

function generateMouseBiteFeatures(
  boards: BoardPosition[],
  columns: number,
  rows: number,
  boardWidth: number,
  boardHeight: number,
  mouseBiteConfig: MouseBiteConfig,
): PanelFeature[] {
  const features: PanelFeature[] = [];
  const segmentWidth = mouseBiteConfig.holesPerSegment * mouseBiteConfig.holeSpacing;
  const segmentsPerHorizontalEdge = Math.max(1, Math.floor(boardWidth / (segmentWidth * 2)));
  const segmentsPerVerticalEdge = Math.max(1, Math.floor(boardHeight / (segmentWidth * 2)));

  // Horizontal mouse bites (between rows)
  for (let row = 0; row < rows - 1; row++) {
    for (let col = 0; col < columns; col++) {
      const board = boards[row * columns + col];
      const segSpacing = boardWidth / (segmentsPerHorizontalEdge + 1);

      for (let s = 0; s < segmentsPerHorizontalEdge; s++) {
        const segCenterX = board.x + segSpacing * (s + 1);
        const segY = board.y + boardHeight + mouseBiteConfig.bridgeWidth / 2;

        for (let h = 0; h < mouseBiteConfig.holesPerSegment; h++) {
          const holeX = segCenterX - segmentWidth / 2 + h * mouseBiteConfig.holeSpacing + mouseBiteConfig.holeSpacing / 2;
          features.push({
            type: 'mouse-bite-hole',
            x: holeX,
            y: segY,
            width: mouseBiteConfig.holeDiameter,
            height: mouseBiteConfig.holeDiameter,
            layer: 'all',
            metadata: { direction: 'horizontal', segment: s, hole: h },
          });
        }
      }
    }
  }

  // Vertical mouse bites (between columns)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns - 1; col++) {
      const board = boards[row * columns + col];
      const segSpacing = boardHeight / (segmentsPerVerticalEdge + 1);

      for (let s = 0; s < segmentsPerVerticalEdge; s++) {
        const segCenterY = board.y + segSpacing * (s + 1);
        const segX = board.x + boardWidth + mouseBiteConfig.bridgeWidth / 2;

        for (let h = 0; h < mouseBiteConfig.holesPerSegment; h++) {
          const holeY = segCenterY - segmentWidth / 2 + h * mouseBiteConfig.holeSpacing + mouseBiteConfig.holeSpacing / 2;
          features.push({
            type: 'mouse-bite-hole',
            x: segX,
            y: holeY,
            width: mouseBiteConfig.holeDiameter,
            height: mouseBiteConfig.holeDiameter,
            layer: 'all',
            metadata: { direction: 'vertical', segment: s, hole: h },
          });
        }
      }
    }
  }

  return features;
}

// ---------------------------------------------------------------------------
// Fiducial generation
// ---------------------------------------------------------------------------

function generateFiducials(
  panelWidth: number,
  panelHeight: number,
  fiducialConfig: FiducialConfig,
): PanelFeature[] {
  if (!fiducialConfig.enabled) {
    return [];
  }

  const inset = fiducialConfig.inset;
  // Three-corner placement (standard for panel fiducials)
  const positions = [
    { x: inset, y: inset, corner: 'top-left' },
    { x: panelWidth - inset, y: inset, corner: 'top-right' },
    { x: inset, y: panelHeight - inset, corner: 'bottom-left' },
  ];

  return positions.map((pos) => ({
    type: 'fiducial' as const,
    x: pos.x,
    y: pos.y,
    width: fiducialConfig.diameter,
    height: fiducialConfig.diameter,
    layer: 'front' as const,
    metadata: {
      corner: pos.corner,
      clearance: fiducialConfig.clearance,
    },
  }));
}

// ---------------------------------------------------------------------------
// Tooling hole generation
// ---------------------------------------------------------------------------

function generateToolingHoles(
  panelWidth: number,
  panelHeight: number,
  toolingConfig: ToolingHoleConfig,
): PanelFeature[] {
  if (!toolingConfig.enabled) {
    return [];
  }

  const inset = toolingConfig.inset;
  // Four corners
  const positions = [
    { x: inset, y: inset, corner: 'top-left' },
    { x: panelWidth - inset, y: inset, corner: 'top-right' },
    { x: inset, y: panelHeight - inset, corner: 'bottom-left' },
    { x: panelWidth - inset, y: panelHeight - inset, corner: 'bottom-right' },
  ];

  return positions.map((pos) => ({
    type: 'tooling-hole' as const,
    x: pos.x,
    y: pos.y,
    width: toolingConfig.diameter,
    height: toolingConfig.diameter,
    layer: 'all' as const,
    metadata: {
      corner: pos.corner,
      plated: toolingConfig.plated,
    },
  }));
}

// ---------------------------------------------------------------------------
// Rail feature generation
// ---------------------------------------------------------------------------

function generateRailFeatures(
  panelWidth: number,
  panelHeight: number,
  railConfig: RailConfig,
): PanelFeature[] {
  if (!railConfig.enabled) {
    return [];
  }

  const features: PanelFeature[] = [];

  if (railConfig.sides.includes('top')) {
    features.push({
      type: 'rail',
      x: 0,
      y: 0,
      width: panelWidth,
      height: railConfig.width,
      layer: 'mechanical',
      metadata: { side: 'top' },
    });
  }

  if (railConfig.sides.includes('bottom')) {
    features.push({
      type: 'rail',
      x: 0,
      y: panelHeight - railConfig.width,
      width: panelWidth,
      height: railConfig.width,
      layer: 'mechanical',
      metadata: { side: 'bottom' },
    });
  }

  if (railConfig.sides.includes('left')) {
    features.push({
      type: 'rail',
      x: 0,
      y: 0,
      width: railConfig.width,
      height: panelHeight,
      layer: 'mechanical',
      metadata: { side: 'left' },
    });
  }

  if (railConfig.sides.includes('right')) {
    features.push({
      type: 'rail',
      x: panelWidth - railConfig.width,
      y: 0,
      width: railConfig.width,
      height: panelHeight,
      layer: 'mechanical',
      metadata: { side: 'right' },
    });
  }

  return features;
}

// ---------------------------------------------------------------------------
// Utilization calculation
// ---------------------------------------------------------------------------

function computeUtilization(
  boardCount: number,
  boardWidth: number,
  boardHeight: number,
  panelWidth: number,
  panelHeight: number,
): number {
  const panelArea = panelWidth * panelHeight;
  if (panelArea <= 0) {
    return 0;
  }
  const boardArea = boardCount * boardWidth * boardHeight;
  return Math.min(1, boardArea / panelArea);
}

// ---------------------------------------------------------------------------
// Main entry: calculatePanel
// ---------------------------------------------------------------------------

export function calculatePanel(config: PanelConfig): PanelResult {
  const warnings = validateConfig(config);

  // Check for fatal errors
  const hasErrors = warnings.some((w) => w.severity === 'error');
  if (hasErrors) {
    return {
      panelWidth: config.panelWidth ?? 0,
      panelHeight: config.panelHeight ?? 0,
      columns: 0,
      rows: 0,
      boardCount: 0,
      boards: [],
      features: [],
      utilization: 0,
      warnings,
      boardGap: config.boardGap,
      separationType: config.separationType,
    };
  }

  // Compute layout
  const layout = computeLayout(config);
  warnings.push(...layout.warnings);

  if (layout.columns === 0 || layout.rows === 0) {
    return {
      panelWidth: layout.panelWidth,
      panelHeight: layout.panelHeight,
      columns: 0,
      rows: 0,
      boardCount: 0,
      boards: [],
      features: [],
      utilization: 0,
      warnings,
      boardGap: config.boardGap,
      separationType: config.separationType,
    };
  }

  // Compute board positions
  const boards = computeBoardPositions(
    layout.columns,
    layout.rows,
    config.boardWidth,
    config.boardHeight,
    config.boardGap,
    config.rails,
  );

  // Generate features
  const features: PanelFeature[] = [];

  // Separation features
  switch (config.separationType) {
    case 'tab': {
      const tabConfig = config.tabRoute ?? DEFAULT_TAB_ROUTE;
      features.push(
        ...generateTabFeatures(boards, layout.columns, layout.rows, config.boardWidth, config.boardHeight, tabConfig),
      );
      break;
    }
    case 'v-score': {
      const vConfig = config.vScore ?? DEFAULT_V_SCORE;
      features.push(
        ...generateVScoreFeatures(
          boards,
          layout.columns,
          layout.rows,
          config.boardWidth,
          config.boardHeight,
          layout.panelWidth,
          layout.panelHeight,
          vConfig,
        ),
      );
      break;
    }
    case 'mouse-bite': {
      const mbConfig = config.mouseBite ?? DEFAULT_MOUSE_BITE;
      features.push(
        ...generateMouseBiteFeatures(
          boards,
          layout.columns,
          layout.rows,
          config.boardWidth,
          config.boardHeight,
          mbConfig,
        ),
      );
      break;
    }
  }

  // Fiducials
  features.push(...generateFiducials(layout.panelWidth, layout.panelHeight, config.fiducials));

  // Tooling holes
  features.push(...generateToolingHoles(layout.panelWidth, layout.panelHeight, config.toolingHoles));

  // Rails
  features.push(...generateRailFeatures(layout.panelWidth, layout.panelHeight, config.rails));

  // Utilization
  const utilization = computeUtilization(
    boards.length,
    config.boardWidth,
    config.boardHeight,
    layout.panelWidth,
    layout.panelHeight,
  );

  // Low utilization warning
  if (utilization < 0.5 && boards.length > 0) {
    warnings.push({
      code: 'LOW_UTILIZATION',
      message: `Panel utilization is ${(utilization * 100).toFixed(1)}% — consider a smaller panel size`,
      severity: 'warning',
    });
  }

  return {
    panelWidth: layout.panelWidth,
    panelHeight: layout.panelHeight,
    columns: layout.columns,
    rows: layout.rows,
    boardCount: boards.length,
    boards,
    features,
    utilization,
    warnings,
    boardGap: config.boardGap,
    separationType: config.separationType,
  };
}

// ---------------------------------------------------------------------------
// Auto-panelization
// ---------------------------------------------------------------------------

export interface AutoPanelResult extends PanelResult {
  /** The standard panel size used */
  panelSizeName: string;
}

export function autoPanel(
  boardWidth: number,
  boardHeight: number,
  panelWidth?: number,
  panelHeight?: number,
): AutoPanelResult {
  const separationType: SeparationType = 'v-score';
  const boardGap = 0; // v-score uses zero gap

  const fiducials = { ...DEFAULT_FIDUCIALS };
  const toolingHoles = { ...DEFAULT_TOOLING_HOLES };
  const rails: RailConfig = { ...DEFAULT_RAILS };

  // If panel dimensions specified, use those
  if (panelWidth !== undefined && panelHeight !== undefined) {
    const config: PanelConfig = {
      boardWidth,
      boardHeight,
      panelWidth,
      panelHeight,
      separationType,
      boardGap,
      fiducials,
      toolingHoles,
      rails,
    };

    const result = calculatePanel(config);
    return {
      ...result,
      panelSizeName: `${panelWidth}x${panelHeight}`,
    };
  }

  // Try all standard sizes and pick the one with the best utilization
  let bestResult: PanelResult | null = null;
  let bestSizeName = '';
  let bestUtilization = -1;

  for (const size of STANDARD_PANEL_SIZES) {
    const config: PanelConfig = {
      boardWidth,
      boardHeight,
      panelWidth: size.width,
      panelHeight: size.height,
      separationType,
      boardGap,
      fiducials,
      toolingHoles,
      rails,
    };

    const result = calculatePanel(config);

    // Skip sizes that can't fit any boards
    if (result.boardCount === 0) {
      continue;
    }

    // Also try rotated board orientation
    const configRotated: PanelConfig = {
      boardWidth: boardHeight,
      boardHeight: boardWidth,
      panelWidth: size.width,
      panelHeight: size.height,
      separationType,
      boardGap,
      fiducials,
      toolingHoles,
      rails,
    };

    const resultRotated = calculatePanel(configRotated);

    // Pick the orientation with more boards (or better utilization if same count)
    const candidates: Array<{ result: PanelResult; sizeName: string }> = [];
    if (result.boardCount > 0) {
      candidates.push({ result, sizeName: size.name });
    }
    if (resultRotated.boardCount > 0) {
      candidates.push({ result: resultRotated, sizeName: `${size.name} (rotated)` });
    }

    for (const candidate of candidates) {
      // Prefer more boards; break ties by better utilization
      if (
        bestResult === null ||
        candidate.result.boardCount > bestResult.boardCount ||
        (candidate.result.boardCount === bestResult.boardCount && candidate.result.utilization > bestUtilization)
      ) {
        bestResult = candidate.result;
        bestSizeName = candidate.sizeName;
        bestUtilization = candidate.result.utilization;
      }
    }
  }

  if (bestResult === null) {
    // No standard size fits — fall back to single board panel
    const config: PanelConfig = {
      boardWidth,
      boardHeight,
      columns: 1,
      rows: 1,
      separationType,
      boardGap,
      fiducials,
      toolingHoles,
      rails,
    };

    const result = calculatePanel(config);
    return {
      ...result,
      panelSizeName: 'custom',
    };
  }

  return {
    ...bestResult,
    panelSizeName: bestSizeName,
  };
}

// ---------------------------------------------------------------------------
// Default config factory
// ---------------------------------------------------------------------------

export function createDefaultPanelConfig(
  boardWidth: number,
  boardHeight: number,
  overrides?: Partial<PanelConfig>,
): PanelConfig {
  return {
    boardWidth,
    boardHeight,
    separationType: 'v-score',
    boardGap: 0,
    fiducials: { ...DEFAULT_FIDUCIALS },
    toolingHoles: { ...DEFAULT_TOOLING_HOLES },
    rails: { ...DEFAULT_RAILS },
    ...overrides,
  };
}
