import { describe, it, expect } from 'vitest';
import {
  calculatePanel,
  autoPanel,
  createDefaultPanelConfig,
  STANDARD_PANEL_SIZES,
} from '../panelization';
import type {
  PanelConfig,
  PanelResult,
  SeparationType,
  BoardPosition,
  PanelFeature,
  AutoPanelResult,
} from '../panelization';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<PanelConfig> = {}): PanelConfig {
  return {
    boardWidth: 20,
    boardHeight: 30,
    separationType: 'v-score',
    boardGap: 0,
    fiducials: { enabled: false, diameter: 1, clearance: 2, inset: 3 },
    toolingHoles: { enabled: false, diameter: 3.175, inset: 5, plated: false },
    rails: { enabled: false, width: 5, sides: [] },
    ...overrides,
  };
}

function featuresByType(result: PanelResult, type: string): PanelFeature[] {
  return result.features.filter((f) => f.type === type);
}

function warningCodes(result: PanelResult): string[] {
  return result.warnings.map((w) => w.code);
}

// ===========================================================================
// STANDARD_PANEL_SIZES
// ===========================================================================

describe('STANDARD_PANEL_SIZES', () => {
  it('contains at least 3 standard sizes', () => {
    expect(STANDARD_PANEL_SIZES.length).toBeGreaterThanOrEqual(3);
  });

  it('includes 100x100, 160x100, 200x150', () => {
    const names = STANDARD_PANEL_SIZES.map((s) => s.name);
    expect(names).toContain('100x100');
    expect(names).toContain('160x100');
    expect(names).toContain('200x150');
  });

  it('all sizes have positive dimensions', () => {
    for (const size of STANDARD_PANEL_SIZES) {
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    }
  });

  it('sizes are ordered by area (ascending)', () => {
    for (let i = 1; i < STANDARD_PANEL_SIZES.length; i++) {
      const prevArea = STANDARD_PANEL_SIZES[i - 1].width * STANDARD_PANEL_SIZES[i - 1].height;
      const currArea = STANDARD_PANEL_SIZES[i].width * STANDARD_PANEL_SIZES[i].height;
      expect(currArea).toBeGreaterThanOrEqual(prevArea);
    }
  });
});

// ===========================================================================
// calculatePanel — layout basics
// ===========================================================================

describe('calculatePanel — layout', () => {
  it('computes correct board count for columns x rows', () => {
    const config = makeConfig({ columns: 3, rows: 4 });
    const result = calculatePanel(config);
    expect(result.boardCount).toBe(12);
    expect(result.columns).toBe(3);
    expect(result.rows).toBe(4);
    expect(result.boards).toHaveLength(12);
  });

  it('computes panel dimensions from columns/rows', () => {
    const config = makeConfig({ columns: 2, rows: 3, boardWidth: 25, boardHeight: 20, boardGap: 2 });
    const result = calculatePanel(config);
    // 2 boards * 25mm + 1 gap * 2mm = 52mm wide
    expect(result.panelWidth).toBe(52);
    // 3 boards * 20mm + 2 gaps * 2mm = 64mm tall
    expect(result.panelHeight).toBe(64);
  });

  it('fits boards into specified panel dimensions', () => {
    const config = makeConfig({ panelWidth: 100, panelHeight: 100, boardWidth: 20, boardHeight: 30 });
    const result = calculatePanel(config);
    // 100 / 20 = 5 columns, 100 / 30 = 3 rows
    expect(result.columns).toBe(5);
    expect(result.rows).toBe(3);
    expect(result.boardCount).toBe(15);
  });

  it('fits boards with gap into panel dimensions', () => {
    const config = makeConfig({
      panelWidth: 100,
      panelHeight: 100,
      boardWidth: 20,
      boardHeight: 30,
      boardGap: 2,
    });
    const result = calculatePanel(config);
    // (100 + 2) / (20 + 2) = 4.636 → 4 columns
    // (100 + 2) / (30 + 2) = 3.1875 → 3 rows
    expect(result.columns).toBe(4);
    expect(result.rows).toBe(3);
    expect(result.boardCount).toBe(12);
  });

  it('board positions are correctly offset', () => {
    const config = makeConfig({ columns: 2, rows: 2, boardWidth: 10, boardHeight: 15, boardGap: 5 });
    const result = calculatePanel(config);
    const positions = result.boards.map((b) => ({ x: b.x, y: b.y }));
    expect(positions).toEqual([
      { x: 0, y: 0 },
      { x: 15, y: 0 },
      { x: 0, y: 20 },
      { x: 15, y: 20 },
    ]);
  });

  it('board positions include correct dimensions', () => {
    const config = makeConfig({ columns: 2, rows: 1, boardWidth: 30, boardHeight: 20 });
    const result = calculatePanel(config);
    for (const board of result.boards) {
      expect(board.width).toBe(30);
      expect(board.height).toBe(20);
    }
  });

  it('single board panel works', () => {
    const config = makeConfig({ columns: 1, rows: 1, boardWidth: 50, boardHeight: 50 });
    const result = calculatePanel(config);
    expect(result.boardCount).toBe(1);
    expect(result.boards[0].x).toBe(0);
    expect(result.boards[0].y).toBe(0);
  });

  it('board column/row indices are correct', () => {
    const config = makeConfig({ columns: 3, rows: 2 });
    const result = calculatePanel(config);
    expect(result.boards[0]).toMatchObject({ column: 0, row: 0 });
    expect(result.boards[1]).toMatchObject({ column: 1, row: 0 });
    expect(result.boards[2]).toMatchObject({ column: 2, row: 0 });
    expect(result.boards[3]).toMatchObject({ column: 0, row: 1 });
    expect(result.boards[4]).toMatchObject({ column: 1, row: 1 });
    expect(result.boards[5]).toMatchObject({ column: 2, row: 1 });
  });
});

// ===========================================================================
// calculatePanel — utilization
// ===========================================================================

describe('calculatePanel — utilization', () => {
  it('computes utilization as ratio of board area to panel area', () => {
    const config = makeConfig({ columns: 2, rows: 2, boardWidth: 10, boardHeight: 10, boardGap: 0 });
    const result = calculatePanel(config);
    // 4 * 100 / (20 * 20) = 1.0
    expect(result.utilization).toBeCloseTo(1.0, 5);
  });

  it('utilization decreases with gaps', () => {
    const config = makeConfig({ columns: 2, rows: 2, boardWidth: 10, boardHeight: 10, boardGap: 10 });
    const result = calculatePanel(config);
    // 4 * 100 / (30 * 30) = 0.444
    expect(result.utilization).toBeLessThan(0.5);
  });

  it('utilization is capped at 1.0', () => {
    const config = makeConfig({ columns: 1, rows: 1, boardWidth: 50, boardHeight: 50 });
    const result = calculatePanel(config);
    expect(result.utilization).toBeLessThanOrEqual(1.0);
  });

  it('warns when utilization is below 50%', () => {
    const config = makeConfig({
      panelWidth: 200,
      panelHeight: 200,
      boardWidth: 10,
      boardHeight: 10,
    });
    const result = calculatePanel(config);
    // Many small boards in large panel — but utilization = (20*10*10) / (200*200) = 0.05
    // Actually: floor((200+0)/(10+0)) = 20 cols, 20 rows = 400 boards, 400*100/40000 = 1.0
    // Let's check with large gap instead
    const config2 = makeConfig({
      panelWidth: 200,
      panelHeight: 200,
      boardWidth: 10,
      boardHeight: 10,
      boardGap: 30,
    });
    const result2 = calculatePanel(config2);
    // (200+30)/(10+30) = 5.75 → 5 cols, 5 rows = 25 boards, 25*100/40000 = 0.0625
    expect(warningCodes(result2)).toContain('LOW_UTILIZATION');
  });
});

// ===========================================================================
// calculatePanel — validation / warnings
// ===========================================================================

describe('calculatePanel — validation', () => {
  it('rejects zero board width', () => {
    const config = makeConfig({ boardWidth: 0, columns: 1, rows: 1 });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('INVALID_BOARD_SIZE');
    expect(result.boardCount).toBe(0);
  });

  it('rejects negative board height', () => {
    const config = makeConfig({ boardHeight: -5, columns: 1, rows: 1 });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('INVALID_BOARD_SIZE');
    expect(result.boardCount).toBe(0);
  });

  it('rejects negative board gap', () => {
    const config = makeConfig({ boardGap: -1, columns: 1, rows: 1 });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('NEGATIVE_GAP');
  });

  it('warns about v-score with non-zero gap', () => {
    const config = makeConfig({ separationType: 'v-score', boardGap: 2, columns: 2, rows: 2 });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('VSCORE_GAP');
  });

  it('rejects panel smaller than board', () => {
    const config = makeConfig({ panelWidth: 5, panelHeight: 100, boardWidth: 20, boardHeight: 30 });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('PANEL_TOO_SMALL_WIDTH');
  });

  it('rejects zero columns', () => {
    const config = makeConfig({ columns: 0, rows: 1 });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('INVALID_COLUMNS');
    expect(result.boardCount).toBe(0);
  });

  it('warns about narrow rails', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      rails: { enabled: true, width: 2, sides: ['top'] },
    });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('RAIL_TOO_NARROW');
  });

  it('warns about narrow mouse-bite bridge', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      boardGap: 2,
      separationType: 'mouse-bite',
      mouseBite: {
        holeDiameter: 0.5,
        holeSpacing: 0.8,
        holesPerSegment: 5,
        bridgeWidth: 0.8, // less than 2 * 0.5
      },
    });
    const result = calculatePanel(config);
    expect(warningCodes(result)).toContain('MOUSE_BITE_BRIDGE_NARROW');
  });

  it('returns empty result when no boards fit', () => {
    const config = makeConfig({
      panelWidth: 100,
      panelHeight: 100,
      boardWidth: 20,
      boardHeight: 30,
      rails: { enabled: true, width: 50, sides: ['top', 'bottom', 'left', 'right'] },
    });
    const result = calculatePanel(config);
    expect(result.boardCount).toBe(0);
    expect(warningCodes(result)).toContain('NO_FIT');
  });
});

// ===========================================================================
// calculatePanel — v-score separation
// ===========================================================================

describe('calculatePanel — v-score', () => {
  it('generates horizontal v-score lines between rows', () => {
    const config = makeConfig({ columns: 2, rows: 3, separationType: 'v-score' });
    const result = calculatePanel(config);
    const hScores = featuresByType(result, 'v-score-line').filter(
      (f) => f.metadata['direction'] === 'horizontal',
    );
    // 3 rows → 2 horizontal score lines
    expect(hScores).toHaveLength(2);
  });

  it('generates vertical v-score lines between columns', () => {
    const config = makeConfig({ columns: 3, rows: 2, separationType: 'v-score' });
    const result = calculatePanel(config);
    const vScores = featuresByType(result, 'v-score-line').filter(
      (f) => f.metadata['direction'] === 'vertical',
    );
    // 3 columns → 2 vertical score lines
    expect(vScores).toHaveLength(2);
  });

  it('v-score lines span full panel width/height', () => {
    const config = makeConfig({ columns: 2, rows: 2, separationType: 'v-score', boardWidth: 50, boardHeight: 40 });
    const result = calculatePanel(config);
    const hScores = featuresByType(result, 'v-score-line').filter(
      (f) => f.metadata['direction'] === 'horizontal',
    );
    const vScores = featuresByType(result, 'v-score-line').filter(
      (f) => f.metadata['direction'] === 'vertical',
    );
    expect(hScores[0].width).toBe(result.panelWidth);
    expect(vScores[0].height).toBe(result.panelHeight);
  });

  it('single board generates no v-score lines', () => {
    const config = makeConfig({ columns: 1, rows: 1, separationType: 'v-score' });
    const result = calculatePanel(config);
    const scores = featuresByType(result, 'v-score-line');
    expect(scores).toHaveLength(0);
  });

  it('v-score lines have correct Y for horizontal lines', () => {
    const config = makeConfig({ columns: 1, rows: 3, separationType: 'v-score', boardHeight: 20 });
    const result = calculatePanel(config);
    const hScores = featuresByType(result, 'v-score-line')
      .filter((f) => f.metadata['direction'] === 'horizontal')
      .sort((a, b) => a.y - b.y);
    expect(hScores[0].y).toBe(20);
    expect(hScores[1].y).toBe(40);
  });
});

// ===========================================================================
// calculatePanel — tab separation
// ===========================================================================

describe('calculatePanel — tab', () => {
  it('generates tab features between boards', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      separationType: 'tab',
      boardGap: 3,
      tabRoute: { width: 3, count: 2, perforationDiameter: 0.5, perforationCount: 3 },
    });
    const result = calculatePanel(config);
    const tabs = featuresByType(result, 'tab');
    // Horizontal: (rows-1) * columns * count = 1*2*2 = 4
    // Vertical: rows * (columns-1) * count = 2*1*2 = 4
    expect(tabs).toHaveLength(8);
  });

  it('generates perforation holes for tabs', () => {
    const config = makeConfig({
      columns: 2,
      rows: 1,
      separationType: 'tab',
      boardGap: 3,
      tabRoute: { width: 3, count: 1, perforationDiameter: 0.5, perforationCount: 4 },
    });
    const result = calculatePanel(config);
    const perfs = featuresByType(result, 'perforation-hole');
    // 1 vertical tab * 4 perforations = 4
    expect(perfs).toHaveLength(4);
  });

  it('tabs have mechanical layer', () => {
    const config = makeConfig({
      columns: 2,
      rows: 1,
      separationType: 'tab',
      boardGap: 3,
    });
    const result = calculatePanel(config);
    const tabs = featuresByType(result, 'tab');
    for (const tab of tabs) {
      expect(tab.layer).toBe('mechanical');
    }
  });

  it('no tabs for single board', () => {
    const config = makeConfig({ columns: 1, rows: 1, separationType: 'tab', boardGap: 3 });
    const result = calculatePanel(config);
    expect(featuresByType(result, 'tab')).toHaveLength(0);
  });

  it('zero perforation count produces no perforation holes', () => {
    const config = makeConfig({
      columns: 2,
      rows: 1,
      separationType: 'tab',
      boardGap: 3,
      tabRoute: { width: 3, count: 2, perforationDiameter: 0.5, perforationCount: 0 },
    });
    const result = calculatePanel(config);
    expect(featuresByType(result, 'perforation-hole')).toHaveLength(0);
  });
});

// ===========================================================================
// calculatePanel — mouse-bite separation
// ===========================================================================

describe('calculatePanel — mouse-bite', () => {
  it('generates mouse-bite holes between boards', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      separationType: 'mouse-bite',
      boardGap: 2,
      mouseBite: { holeDiameter: 0.5, holeSpacing: 0.8, holesPerSegment: 5, bridgeWidth: 2 },
    });
    const result = calculatePanel(config);
    const holes = featuresByType(result, 'mouse-bite-hole');
    expect(holes.length).toBeGreaterThan(0);
  });

  it('mouse-bite holes have correct diameter', () => {
    const config = makeConfig({
      columns: 2,
      rows: 1,
      separationType: 'mouse-bite',
      boardGap: 2,
      mouseBite: { holeDiameter: 0.6, holeSpacing: 0.8, holesPerSegment: 3, bridgeWidth: 2 },
    });
    const result = calculatePanel(config);
    const holes = featuresByType(result, 'mouse-bite-hole');
    for (const hole of holes) {
      expect(hole.width).toBe(0.6);
      expect(hole.height).toBe(0.6);
    }
  });

  it('mouse-bite holes are on all layers', () => {
    const config = makeConfig({
      columns: 2,
      rows: 1,
      separationType: 'mouse-bite',
      boardGap: 2,
    });
    const result = calculatePanel(config);
    const holes = featuresByType(result, 'mouse-bite-hole');
    for (const hole of holes) {
      expect(hole.layer).toBe('all');
    }
  });

  it('no mouse-bite holes for single board', () => {
    const config = makeConfig({ columns: 1, rows: 1, separationType: 'mouse-bite', boardGap: 2 });
    const result = calculatePanel(config);
    expect(featuresByType(result, 'mouse-bite-hole')).toHaveLength(0);
  });
});

// ===========================================================================
// calculatePanel — fiducials
// ===========================================================================

describe('calculatePanel — fiducials', () => {
  it('generates 3 fiducials at corners when enabled', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      fiducials: { enabled: true, diameter: 1, clearance: 2, inset: 3 },
    });
    const result = calculatePanel(config);
    const fids = featuresByType(result, 'fiducial');
    expect(fids).toHaveLength(3);
  });

  it('fiducials are inset from panel edges', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      boardWidth: 50,
      boardHeight: 50,
      fiducials: { enabled: true, diameter: 1, clearance: 2, inset: 5 },
    });
    const result = calculatePanel(config);
    const fids = featuresByType(result, 'fiducial');
    for (const f of fids) {
      expect(f.x).toBeGreaterThanOrEqual(5);
      expect(f.y).toBeGreaterThanOrEqual(5);
      expect(f.x).toBeLessThanOrEqual(result.panelWidth - 5);
      expect(f.y).toBeLessThanOrEqual(result.panelHeight - 5);
    }
  });

  it('no fiducials when disabled', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      fiducials: { enabled: false, diameter: 1, clearance: 2, inset: 3 },
    });
    const result = calculatePanel(config);
    expect(featuresByType(result, 'fiducial')).toHaveLength(0);
  });

  it('fiducials are on front layer', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      fiducials: { enabled: true, diameter: 1, clearance: 2, inset: 3 },
    });
    const result = calculatePanel(config);
    const fids = featuresByType(result, 'fiducial');
    for (const f of fids) {
      expect(f.layer).toBe('front');
    }
  });

  it('fiducial metadata includes clearance', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      fiducials: { enabled: true, diameter: 1.5, clearance: 3, inset: 5 },
    });
    const result = calculatePanel(config);
    const fids = featuresByType(result, 'fiducial');
    for (const f of fids) {
      expect(f.metadata['clearance']).toBe(3);
    }
  });
});

// ===========================================================================
// calculatePanel — tooling holes
// ===========================================================================

describe('calculatePanel — tooling holes', () => {
  it('generates 4 tooling holes at corners when enabled', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      toolingHoles: { enabled: true, diameter: 3.175, inset: 5, plated: false },
    });
    const result = calculatePanel(config);
    const holes = featuresByType(result, 'tooling-hole');
    expect(holes).toHaveLength(4);
  });

  it('no tooling holes when disabled', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      toolingHoles: { enabled: false, diameter: 3.175, inset: 5, plated: false },
    });
    const result = calculatePanel(config);
    expect(featuresByType(result, 'tooling-hole')).toHaveLength(0);
  });

  it('tooling holes are on all layers', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      toolingHoles: { enabled: true, diameter: 3.175, inset: 5, plated: false },
    });
    const result = calculatePanel(config);
    const holes = featuresByType(result, 'tooling-hole');
    for (const h of holes) {
      expect(h.layer).toBe('all');
    }
  });

  it('tooling hole metadata includes plated flag', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      toolingHoles: { enabled: true, diameter: 2.5, inset: 5, plated: true },
    });
    const result = calculatePanel(config);
    const holes = featuresByType(result, 'tooling-hole');
    for (const h of holes) {
      expect(h.metadata['plated']).toBe(true);
    }
  });
});

// ===========================================================================
// calculatePanel — rails
// ===========================================================================

describe('calculatePanel — rails', () => {
  it('adds rails on specified sides', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      rails: { enabled: true, width: 5, sides: ['top', 'bottom'] },
    });
    const result = calculatePanel(config);
    const rails = featuresByType(result, 'rail');
    expect(rails).toHaveLength(2);
  });

  it('rails offset board positions', () => {
    const config = makeConfig({
      columns: 1,
      rows: 1,
      boardWidth: 20,
      boardHeight: 30,
      rails: { enabled: true, width: 5, sides: ['top', 'left'] },
    });
    const result = calculatePanel(config);
    expect(result.boards[0].x).toBe(5);
    expect(result.boards[0].y).toBe(5);
    expect(result.panelWidth).toBe(25);
    expect(result.panelHeight).toBe(35);
  });

  it('four-sided rails increase panel dimensions', () => {
    const config = makeConfig({
      columns: 1,
      rows: 1,
      boardWidth: 20,
      boardHeight: 30,
      rails: { enabled: true, width: 10, sides: ['top', 'bottom', 'left', 'right'] },
    });
    const result = calculatePanel(config);
    expect(result.panelWidth).toBe(40);
    expect(result.panelHeight).toBe(50);
  });

  it('no rails when disabled', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      rails: { enabled: false, width: 5, sides: ['top', 'bottom'] },
    });
    const result = calculatePanel(config);
    expect(featuresByType(result, 'rail')).toHaveLength(0);
  });

  it('rail features have correct dimensions', () => {
    const config = makeConfig({
      columns: 1,
      rows: 1,
      boardWidth: 50,
      boardHeight: 40,
      rails: { enabled: true, width: 8, sides: ['top'] },
    });
    const result = calculatePanel(config);
    const rails = featuresByType(result, 'rail');
    expect(rails).toHaveLength(1);
    expect(rails[0].width).toBe(result.panelWidth);
    expect(rails[0].height).toBe(8);
    expect(rails[0].y).toBe(0);
  });
});

// ===========================================================================
// calculatePanel — separation type metadata
// ===========================================================================

describe('calculatePanel — result metadata', () => {
  it('reports separation type in result', () => {
    const config = makeConfig({ columns: 2, rows: 2, separationType: 'tab', boardGap: 3 });
    const result = calculatePanel(config);
    expect(result.separationType).toBe('tab');
  });

  it('reports board gap in result', () => {
    const config = makeConfig({ columns: 2, rows: 2, boardGap: 2.5 });
    const result = calculatePanel(config);
    expect(result.boardGap).toBe(2.5);
  });
});

// ===========================================================================
// autoPanel
// ===========================================================================

describe('autoPanel', () => {
  it('auto-selects a standard panel size for small boards', () => {
    const result = autoPanel(20, 30);
    expect(result.boardCount).toBeGreaterThan(1);
    expect(result.panelSizeName).toBeTruthy();
  });

  it('maximizes board count', () => {
    const result = autoPanel(10, 10);
    // On any standard panel, more than 4 boards of 10x10 should fit
    expect(result.boardCount).toBeGreaterThan(4);
  });

  it('uses v-score separation by default', () => {
    const result = autoPanel(20, 30);
    expect(result.separationType).toBe('v-score');
  });

  it('uses zero board gap for v-score', () => {
    const result = autoPanel(20, 30);
    expect(result.boardGap).toBe(0);
  });

  it('uses specified panel dimensions when provided', () => {
    const result = autoPanel(20, 30, 100, 100);
    expect(result.panelWidth).toBe(100);
    expect(result.panelHeight).toBe(100);
  });

  it('includes fiducials by default', () => {
    const result = autoPanel(20, 30);
    const fids = result.features.filter((f) => f.type === 'fiducial');
    expect(fids.length).toBeGreaterThan(0);
  });

  it('includes tooling holes by default', () => {
    const result = autoPanel(20, 30);
    const holes = result.features.filter((f) => f.type === 'tooling-hole');
    expect(holes.length).toBeGreaterThan(0);
  });

  it('includes rails by default', () => {
    const result = autoPanel(20, 30);
    const rails = result.features.filter((f) => f.type === 'rail');
    expect(rails.length).toBeGreaterThan(0);
  });

  it('considers rotated orientation', () => {
    // A long narrow board may fit better rotated
    const result = autoPanel(90, 10);
    // Should find a good fit somewhere
    expect(result.boardCount).toBeGreaterThanOrEqual(1);
  });

  it('falls back to custom single-board panel for very large boards', () => {
    const result = autoPanel(500, 500);
    expect(result.panelSizeName).toBe('custom');
    expect(result.boardCount).toBe(1);
  });

  it('returns panelSizeName with custom dimensions', () => {
    const result = autoPanel(20, 30, 150, 120);
    expect(result.panelSizeName).toBe('150x120');
  });
});

// ===========================================================================
// createDefaultPanelConfig
// ===========================================================================

describe('createDefaultPanelConfig', () => {
  it('creates config with specified board dimensions', () => {
    const config = createDefaultPanelConfig(25, 35);
    expect(config.boardWidth).toBe(25);
    expect(config.boardHeight).toBe(35);
  });

  it('defaults to v-score separation', () => {
    const config = createDefaultPanelConfig(20, 30);
    expect(config.separationType).toBe('v-score');
  });

  it('defaults to zero board gap', () => {
    const config = createDefaultPanelConfig(20, 30);
    expect(config.boardGap).toBe(0);
  });

  it('enables fiducials by default', () => {
    const config = createDefaultPanelConfig(20, 30);
    expect(config.fiducials.enabled).toBe(true);
  });

  it('enables tooling holes by default', () => {
    const config = createDefaultPanelConfig(20, 30);
    expect(config.toolingHoles.enabled).toBe(true);
  });

  it('enables rails by default', () => {
    const config = createDefaultPanelConfig(20, 30);
    expect(config.rails.enabled).toBe(true);
  });

  it('allows overrides', () => {
    const config = createDefaultPanelConfig(20, 30, {
      separationType: 'tab',
      boardGap: 3,
    });
    expect(config.separationType).toBe('tab');
    expect(config.boardGap).toBe(3);
  });
});

// ===========================================================================
// Edge cases
// ===========================================================================

describe('calculatePanel — edge cases', () => {
  it('handles very small boards', () => {
    const config = makeConfig({ panelWidth: 100, panelHeight: 100, boardWidth: 1, boardHeight: 1 });
    const result = calculatePanel(config);
    expect(result.boardCount).toBe(10000);
  });

  it('handles large gap relative to board size', () => {
    const config = makeConfig({
      panelWidth: 100,
      panelHeight: 100,
      boardWidth: 10,
      boardHeight: 10,
      boardGap: 20,
    });
    const result = calculatePanel(config);
    // (100+20)/(10+20) = 4 cols, 4 rows = 16
    expect(result.columns).toBe(4);
    expect(result.rows).toBe(4);
  });

  it('fractional board columns are floored', () => {
    const config = makeConfig({
      panelWidth: 100,
      panelHeight: 100,
      boardWidth: 33,
      boardHeight: 33,
    });
    const result = calculatePanel(config);
    expect(result.columns).toBe(3);
    expect(result.rows).toBe(3);
  });

  it('all three separation types produce features for multi-board panels', () => {
    const types: SeparationType[] = ['tab', 'v-score', 'mouse-bite'];
    for (const sep of types) {
      const config = makeConfig({
        columns: 2,
        rows: 2,
        separationType: sep,
        boardGap: sep === 'v-score' ? 0 : 3,
      });
      const result = calculatePanel(config);
      expect(result.features.length).toBeGreaterThan(0);
    }
  });

  it('combined fiducials + tooling holes + rails all appear together', () => {
    const config = makeConfig({
      columns: 2,
      rows: 2,
      separationType: 'v-score',
      fiducials: { enabled: true, diameter: 1, clearance: 2, inset: 3 },
      toolingHoles: { enabled: true, diameter: 3.175, inset: 5, plated: false },
      rails: { enabled: true, width: 5, sides: ['top', 'bottom'] },
    });
    const result = calculatePanel(config);
    expect(featuresByType(result, 'fiducial')).toHaveLength(3);
    expect(featuresByType(result, 'tooling-hole')).toHaveLength(4);
    expect(featuresByType(result, 'rail')).toHaveLength(2);
    expect(featuresByType(result, 'v-score-line').length).toBeGreaterThan(0);
  });
});
