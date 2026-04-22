import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
import { ProjectIdProvider } from '@/lib/contexts/project-id-context';

// ---------------------------------------------------------------------------
// Package heights export (must match the module under test)
// ---------------------------------------------------------------------------

const EXPECTED_PACKAGE_HEIGHTS: Record<string, number> = {
  'DIP-8': 5.0, 'DIP-14': 5.0, 'DIP-16': 5.0, 'DIP-28': 5.0, 'DIP-40': 5.0,
  'SOIC-8': 1.75, 'SOIC-14': 1.75, 'SOIC-16': 1.75,
  'SOT-23': 1.1, 'SOT-23-5': 1.1, 'SOT-23-6': 1.1,
  'QFP-44': 1.6, 'QFP-64': 1.6, 'QFP-100': 1.6, 'QFP-144': 1.6,
  'QFN-16': 0.85, 'QFN-32': 0.85, 'QFN-48': 0.85,
  'SOP-8': 1.75,
  'TO-220': 4.5, 'TO-92': 4.5, 'TO-263': 2.5,
  '0402': 0.5, '0603': 0.6, '0805': 0.7, '1206': 0.8,
  'SOD-123': 1.1, 'SOD-323': 0.6,
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockBoard = {
  width: 100,
  height: 80,
  thickness: 1.6,
  cornerRadius: 2,
};

const mockRenderOptions = {
  showComponents: true,
  showTraces: true,
  showVias: true,
  showDrills: true,
  showSilkscreen: true,
  showSolderMask: true,
  showBoardEdge: true,
  transparentBoard: false,
  componentOpacity: 1.0,
  boardColor: '#2d5016',
  solderMaskColor: '#1a6b1a',
  copperColor: '#b87333',
  silkscreenColor: '#ffffff',
  backgroundColor: '#1a1a2e',
};

const mockScene = {
  board: mockBoard,
  layers: [
    { type: 'top-copper' as const, zOffset: 1.565, thickness: 0.035, color: '#b87333', opacity: 1.0, visible: true },
    { type: 'bottom-copper' as const, zOffset: 0.0, thickness: 0.035, color: '#b87333', opacity: 1.0, visible: true },
    { type: 'substrate' as const, zOffset: 0.035, thickness: 1.53, color: '#2d5016', opacity: 1.0, visible: true },
    { type: 'top-silk' as const, zOffset: 1.61, thickness: 0.01, color: '#ffffff', opacity: 0.9, visible: true },
    { type: 'bottom-silk' as const, zOffset: -0.02, thickness: 0.01, color: '#ffffff', opacity: 0.9, visible: true },
    { type: 'top-mask' as const, zOffset: 1.6, thickness: 0.01, color: '#1a6b1a', opacity: 0.8, visible: true },
    { type: 'bottom-mask' as const, zOffset: -0.01, thickness: 0.01, color: '#1a6b1a', opacity: 0.8, visible: true },
    { type: 'internal' as const, zOffset: 0.5, thickness: 0.035, color: '#b87333', opacity: 1.0, visible: true },
  ],
  components: [],
  vias: [],
  traces: [],
  drillHoles: [],
};

let mockComponents: Array<{
  id: string;
  refDes: string;
  package: string;
  position: { x: number; y: number; z: number };
  rotation: number;
  side: 'top' | 'bottom';
  bodyWidth: number;
  bodyHeight: number;
  bodyDepth: number;
  color: string;
  pins: Array<{ id: string; position: { x: number; y: number }; diameter: number; type: 'through-hole' | 'smd' }>;
  label?: string;
}> = [];

let mockVias: Array<{
  id: string;
  position: { x: number; y: number };
  drillDiameter: number;
  outerDiameter: number;
  startLayer: string;
  endLayer: string;
}> = [];

let mockTraces: Array<{
  id: string;
  points: Array<{ x: number; y: number }>;
  width: number;
  layer: 'top-copper' | 'bottom-copper';
}> = [];

const mockSetBoard = vi.fn();
const mockExportScene = vi.fn().mockReturnValue('{}');
const mockImportScene = vi.fn().mockReturnValue({ success: true, errors: [] });

// Mock FootprintLibrary
const mockGetFootprint = vi.fn();
vi.mock('@/lib/pcb/footprint-library', () => ({
  FootprintLibrary: {
    getFootprint: (...args: unknown[]) => mockGetFootprint(...args),
  },
}));

// Mock the board viewer hook — return our mock data
vi.mock('@/lib/board-viewer-3d', () => ({
  useBoardViewer3D: () => ({
    board: mockBoard,
    setBoard: mockSetBoard,
    components: mockComponents,
    addComponent: vi.fn(),
    removeComponent: vi.fn(),
    vias: mockVias,
    traces: mockTraces,
    drillHoles: [],
    scene: mockScene,
    cameraForView: vi.fn(),
    renderOptions: mockRenderOptions,
    setRenderOptions: vi.fn(),
    layerVisibility: ['top-copper', 'bottom-copper', 'substrate', 'top-silk', 'bottom-silk', 'top-mask', 'bottom-mask', 'internal'],
    measureDistance: vi.fn(),
    packageModels: [],
    exportScene: mockExportScene,
    importScene: mockImportScene,
  }),
  BoardViewer3D: {
    getInstance: () => ({
      getVisibleLayers: () => ['top-copper', 'bottom-copper', 'substrate', 'top-silk', 'bottom-silk', 'top-mask', 'bottom-mask', 'internal'],
      setLayerVisible: vi.fn(),
    }),
  },
}));

// Mock shadcn/ui primitives
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': 'scroll-area', ...props }, children),
}));

vi.mock('@/components/ui/checkbox', () => ({
  Checkbox: (props: Record<string, unknown>) =>
    React.createElement('input', {
      type: 'checkbox',
      'data-testid': props['data-testid'],
      checked: props.checked as boolean,
      onChange: () => { (props.onCheckedChange as () => void)?.(); },
    }),
}));

// ---------------------------------------------------------------------------
// Import under test (MUST come after mocks)
// ---------------------------------------------------------------------------

import BoardViewer3DView, { PACKAGE_HEIGHTS } from '@/components/views/BoardViewer3DView';

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderView() {
  // Plan 02 Phase 4: view now consumes useProjectBoard() which requires
  // ProjectIdProvider + a QueryClient. With projectId=0 the hook short-circuits
  // (no network) while still exposing a populated default board.
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ProjectIdProvider projectId={0}>
        <BoardViewer3DView />
      </ProjectIdProvider>
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardViewer3DView', () => {
  beforeEach(() => {
    mockComponents = [];
    mockVias = [];
    mockTraces = [];
    mockGetFootprint.mockReset();
  });

  // =========================================================================
  // PACKAGE_HEIGHTS map
  // =========================================================================

  describe('PACKAGE_HEIGHTS', () => {
    it('has entries for all expected DIP packages', () => {
      expect(PACKAGE_HEIGHTS['DIP-8']).toBe(5.0);
      expect(PACKAGE_HEIGHTS['DIP-14']).toBe(5.0);
      expect(PACKAGE_HEIGHTS['DIP-16']).toBe(5.0);
      expect(PACKAGE_HEIGHTS['DIP-28']).toBe(5.0);
      expect(PACKAGE_HEIGHTS['DIP-40']).toBe(5.0);
    });

    it('has entries for SOIC packages', () => {
      expect(PACKAGE_HEIGHTS['SOIC-8']).toBe(1.75);
      expect(PACKAGE_HEIGHTS['SOIC-14']).toBe(1.75);
      expect(PACKAGE_HEIGHTS['SOIC-16']).toBe(1.75);
    });

    it('has entries for SOT packages', () => {
      expect(PACKAGE_HEIGHTS['SOT-23']).toBe(1.1);
      expect(PACKAGE_HEIGHTS['SOT-23-5']).toBe(1.1);
      expect(PACKAGE_HEIGHTS['SOT-23-6']).toBe(1.1);
    });

    it('has entries for QFP and QFN packages', () => {
      expect(PACKAGE_HEIGHTS['QFP-44']).toBe(1.6);
      expect(PACKAGE_HEIGHTS['QFP-100']).toBe(1.6);
      expect(PACKAGE_HEIGHTS['QFN-16']).toBe(0.85);
      expect(PACKAGE_HEIGHTS['QFN-32']).toBe(0.85);
    });

    it('has entries for passive chip packages', () => {
      expect(PACKAGE_HEIGHTS['0402']).toBe(0.5);
      expect(PACKAGE_HEIGHTS['0603']).toBe(0.6);
      expect(PACKAGE_HEIGHTS['0805']).toBe(0.7);
      expect(PACKAGE_HEIGHTS['1206']).toBe(0.8);
    });

    it('has entries for TO packages', () => {
      expect(PACKAGE_HEIGHTS['TO-220']).toBe(4.5);
      expect(PACKAGE_HEIGHTS['TO-92']).toBe(4.5);
      expect(PACKAGE_HEIGHTS['TO-263']).toBe(2.5);
    });

    it('has entries for diode packages', () => {
      expect(PACKAGE_HEIGHTS['SOD-123']).toBe(1.1);
      expect(PACKAGE_HEIGHTS['SOD-323']).toBe(0.6);
    });

    it('covers all expected package types', () => {
      const expected = Object.keys(EXPECTED_PACKAGE_HEIGHTS);
      expected.forEach((key) => {
        expect(PACKAGE_HEIGHTS[key]).toBe(EXPECTED_PACKAGE_HEIGHTS[key]);
      });
    });
  });

  // =========================================================================
  // Basic rendering
  // =========================================================================

  describe('basic rendering', () => {
    it('renders the 3D board viewer container', () => {
      renderView();
      expect(screen.getByTestId('board-viewer-3d-view')).toBeDefined();
    });

    it('renders title and component count', () => {
      renderView();
      expect(screen.getByTestId('viewer-title').textContent).toBe('3D Board Viewer');
      expect(screen.getByTestId('component-count').textContent).toContain('0 components');
    });

    it('renders view angle buttons', () => {
      renderView();
      expect(screen.getByTestId('view-angle-buttons')).toBeDefined();
      expect(screen.getByTestId('view-angle-isometric')).toBeDefined();
      expect(screen.getByTestId('view-angle-top')).toBeDefined();
    });

    it('renders board substrate', () => {
      renderView();
      expect(screen.getByTestId('board-substrate')).toBeDefined();
    });
  });

  // =========================================================================
  // Component rendering with real footprint data
  // =========================================================================

  describe('component rendering with footprint data', () => {
    it('uses footprint boundingBox for dimensions when available', () => {
      mockGetFootprint.mockReturnValue({
        packageType: 'SOIC-8',
        boundingBox: { x: 0, y: 0, width: 6.0, height: 5.0 },
        pads: [],
        courtyard: { x: 0, y: 0, width: 7.0, height: 6.0 },
        silkscreen: [],
        mountingType: 'smd',
        pinCount: 8,
      });

      mockComponents = [{
        id: 'comp-1',
        refDes: 'U1',
        package: 'SOIC-8',
        position: { x: 50, y: 40, z: 1.6 },
        rotation: 0,
        side: 'top',
        bodyWidth: 5.0,
        bodyHeight: 5.0,
        bodyDepth: 2.0,
        color: '#1a1a1a',
        pins: [],
      }];

      renderView();
      const comp = screen.getByTestId('component-3d-comp-1');
      expect(comp).toBeDefined();
      // Footprint boundingBox width=6.0, board width=100 => 6% width
      // The style should use footprint dimensions, not the original 5.0
      expect(comp.style.width).toBe('6%');
    });

    it('falls back to original dimensions when no footprint data', () => {
      mockGetFootprint.mockReturnValue(null);

      mockComponents = [{
        id: 'comp-2',
        refDes: 'R1',
        package: 'UNKNOWN-PKG',
        position: { x: 30, y: 20, z: 1.6 },
        rotation: 0,
        side: 'top',
        bodyWidth: 3.0,
        bodyHeight: 2.0,
        bodyDepth: 1.5,
        color: '#8b7355',
        pins: [],
      }];

      renderView();
      const comp = screen.getByTestId('component-3d-comp-2');
      expect(comp).toBeDefined();
      // No footprint, falls back to component.bodyWidth=3.0, board=100 => 3%
      expect(comp.style.width).toBe('3%');
    });

    it('uses PACKAGE_HEIGHTS for body depth when package is known', () => {
      mockGetFootprint.mockReturnValue(null);

      mockComponents = [{
        id: 'comp-soic',
        refDes: 'U2',
        package: 'SOIC-8',
        position: { x: 50, y: 40, z: 1.6 },
        rotation: 0,
        side: 'top',
        bodyWidth: 5.0,
        bodyHeight: 4.0,
        bodyDepth: 99.0, // should be overridden by PACKAGE_HEIGHTS
        color: '#1a1a1a',
        pins: [],
      }];

      renderView();
      const comp = screen.getByTestId('component-3d-comp-soic');
      expect(comp).toBeDefined();
      // PACKAGE_HEIGHTS['SOIC-8'] = 1.75, scale = 2, boardThickness=1.6
      // zOffset for top = 1.6 * 2 = 3.2
      // depth = 1.75 * 2 = 3.5
      expect(comp.style.transform).toContain('translateZ(3.2px)');
    });

    it('renders multiple components', () => {
      mockGetFootprint.mockReturnValue(null);

      mockComponents = [
        {
          id: 'comp-a',
          refDes: 'U1',
          package: 'DIP-8',
          position: { x: 20, y: 20, z: 1.6 },
          rotation: 0,
          side: 'top',
          bodyWidth: 9.53,
          bodyHeight: 6.35,
          bodyDepth: 5.0,
          color: '#1a1a1a',
          pins: [],
        },
        {
          id: 'comp-b',
          refDes: 'C1',
          package: '0805',
          position: { x: 60, y: 40, z: 1.6 },
          rotation: 45,
          side: 'top',
          bodyWidth: 2.0,
          bodyHeight: 1.25,
          bodyDepth: 0.7,
          color: '#8b7355',
          pins: [],
        },
      ];

      renderView();
      expect(screen.getByTestId('component-3d-comp-a')).toBeDefined();
      expect(screen.getByTestId('component-3d-comp-b')).toBeDefined();
    });
  });

  // =========================================================================
  // Trace rendering
  // =========================================================================

  describe('trace rendering', () => {
    it('renders trace segments as visual elements', () => {
      mockTraces = [{
        id: 'trace-1',
        points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
        width: 0.25,
        layer: 'top-copper',
      }];

      renderView();
      expect(screen.getByTestId('trace-3d-trace-1')).toBeDefined();
    });

    it('renders multiple traces', () => {
      mockTraces = [
        {
          id: 'trace-1',
          points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
          width: 0.25,
          layer: 'top-copper',
        },
        {
          id: 'trace-2',
          points: [{ x: 20, y: 60 }, { x: 70, y: 60 }],
          width: 0.5,
          layer: 'bottom-copper',
        },
      ];

      renderView();
      expect(screen.getByTestId('trace-3d-trace-1')).toBeDefined();
      expect(screen.getByTestId('trace-3d-trace-2')).toBeDefined();
    });

    it('applies copper-red color for front layer traces', () => {
      mockTraces = [{
        id: 'trace-front',
        points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
        width: 0.25,
        layer: 'top-copper',
      }];

      renderView();
      const segment = screen.getByTestId('trace-segment-trace-front-0');
      expect(segment.style.backgroundColor).toBe('#cc5533');
    });

    it('applies copper-blue color for back layer traces', () => {
      mockTraces = [{
        id: 'trace-back',
        points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
        width: 0.25,
        layer: 'bottom-copper',
      }];

      renderView();
      const segment = screen.getByTestId('trace-segment-trace-back-0');
      expect(segment.style.backgroundColor).toBe('#3366bb');
    });

    it('renders multi-segment traces with multiple segments', () => {
      mockTraces = [{
        id: 'trace-multi',
        points: [{ x: 10, y: 10 }, { x: 30, y: 10 }, { x: 30, y: 50 }],
        width: 0.3,
        layer: 'top-copper',
      }];

      renderView();
      const container = screen.getByTestId('trace-3d-trace-multi');
      expect(container).toBeDefined();
      // Multiple segments inside
      const segments = container.querySelectorAll('[data-testid^="trace-segment-"]');
      expect(segments.length).toBe(2); // 3 points = 2 segments
    });

    it('positions front traces at board top surface', () => {
      mockTraces = [{
        id: 'trace-top',
        points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
        width: 0.25,
        layer: 'top-copper',
      }];

      renderView();
      const segment = screen.getByTestId('trace-segment-trace-top-0');
      // boardThickness=1.6, scale=2 => z=3.2
      expect(segment.style.transform).toContain('translateZ(3.2px)');
    });

    it('positions back traces at board bottom surface', () => {
      mockTraces = [{
        id: 'trace-bot',
        points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
        width: 0.25,
        layer: 'bottom-copper',
      }];

      renderView();
      const segment = screen.getByTestId('trace-segment-trace-bot-0');
      // bottom-copper => z=0
      expect(segment.style.transform).toContain('translateZ(0px)');
    });

    it('does not crash with empty traces array', () => {
      mockTraces = [];
      renderView();
      expect(screen.getByTestId('board-3d-viewport')).toBeDefined();
    });
  });

  // =========================================================================
  // Via rendering
  // =========================================================================

  describe('via rendering', () => {
    it('renders via elements', () => {
      mockVias = [{
        id: 'via-1',
        position: { x: 40, y: 40 },
        drillDiameter: 0.3,
        outerDiameter: 0.6,
        startLayer: 'top-copper',
        endLayer: 'bottom-copper',
      }];

      renderView();
      expect(screen.getByTestId('via-3d-via-1')).toBeDefined();
    });

    it('renders multiple vias', () => {
      mockVias = [
        {
          id: 'via-a',
          position: { x: 20, y: 30 },
          drillDiameter: 0.3,
          outerDiameter: 0.6,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
        {
          id: 'via-b',
          position: { x: 60, y: 50 },
          drillDiameter: 0.4,
          outerDiameter: 0.8,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
      ];

      renderView();
      expect(screen.getByTestId('via-3d-via-a')).toBeDefined();
      expect(screen.getByTestId('via-3d-via-b')).toBeDefined();
    });

    it('renders outer copper ring and inner drill hole', () => {
      mockVias = [{
        id: 'via-parts',
        position: { x: 40, y: 40 },
        drillDiameter: 0.3,
        outerDiameter: 0.6,
        startLayer: 'top-copper',
        endLayer: 'bottom-copper',
      }];

      renderView();
      expect(screen.getByTestId('via-outer-via-parts')).toBeDefined();
      expect(screen.getByTestId('via-hole-via-parts')).toBeDefined();
    });

    it('applies copper color to outer ring', () => {
      mockVias = [{
        id: 'via-color',
        position: { x: 40, y: 40 },
        drillDiameter: 0.3,
        outerDiameter: 0.6,
        startLayer: 'top-copper',
        endLayer: 'bottom-copper',
      }];

      renderView();
      const outer = screen.getByTestId('via-outer-via-color');
      expect(outer.style.backgroundColor).toBe('#b87333');
    });

    it('applies dark color to drill hole', () => {
      mockVias = [{
        id: 'via-hole-color',
        position: { x: 40, y: 40 },
        drillDiameter: 0.3,
        outerDiameter: 0.6,
        startLayer: 'top-copper',
        endLayer: 'bottom-copper',
      }];

      renderView();
      const hole = screen.getByTestId('via-hole-via-hole-color');
      expect(hole.style.backgroundColor).toBe('#1a1a1a');
    });

    it('does not crash with empty vias array', () => {
      mockVias = [];
      renderView();
      expect(screen.getByTestId('board-3d-viewport')).toBeDefined();
    });
  });

  // =========================================================================
  // Empty board
  // =========================================================================

  describe('empty board', () => {
    it('renders without crash with no components, traces, or vias', () => {
      mockComponents = [];
      mockTraces = [];
      mockVias = [];

      renderView();
      expect(screen.getByTestId('board-viewer-3d-view')).toBeDefined();
      expect(screen.getByTestId('board-substrate')).toBeDefined();
      expect(screen.getByTestId('component-count').textContent).toContain('0 components');
    });
  });

  // =========================================================================
  // Layer colors
  // =========================================================================

  describe('layer colors', () => {
    it('uses different colors for front and back trace segments', () => {
      mockTraces = [
        {
          id: 'trace-f',
          points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
          width: 0.25,
          layer: 'top-copper',
        },
        {
          id: 'trace-b',
          points: [{ x: 10, y: 50 }, { x: 50, y: 50 }],
          width: 0.25,
          layer: 'bottom-copper',
        },
      ];

      renderView();
      const frontSegment = screen.getByTestId('trace-segment-trace-f-0');
      const backSegment = screen.getByTestId('trace-segment-trace-b-0');
      expect(frontSegment.style.backgroundColor).not.toBe(backSegment.style.backgroundColor);
    });
  });

  // =========================================================================
  // data-testid coverage
  // =========================================================================

  describe('data-testid coverage', () => {
    it('has test IDs on all major elements', () => {
      mockComponents = [{
        id: 'comp-tid',
        refDes: 'U1',
        package: 'SOIC-8',
        position: { x: 50, y: 40, z: 1.6 },
        rotation: 0,
        side: 'top',
        bodyWidth: 5.0,
        bodyHeight: 5.0,
        bodyDepth: 1.75,
        color: '#1a1a1a',
        pins: [],
      }];
      mockVias = [{
        id: 'via-tid',
        position: { x: 30, y: 30 },
        drillDiameter: 0.3,
        outerDiameter: 0.6,
        startLayer: 'top-copper',
        endLayer: 'bottom-copper',
      }];
      mockTraces = [{
        id: 'trace-tid',
        points: [{ x: 10, y: 10 }, { x: 50, y: 10 }],
        width: 0.25,
        layer: 'top-copper',
      }];

      renderView();
      expect(screen.getByTestId('board-viewer-3d-view')).toBeDefined();
      expect(screen.getByTestId('board-3d-viewport')).toBeDefined();
      expect(screen.getByTestId('board-3d-scene')).toBeDefined();
      expect(screen.getByTestId('board-substrate')).toBeDefined();
      expect(screen.getByTestId('component-3d-comp-tid')).toBeDefined();
      expect(screen.getByTestId('via-3d-via-tid')).toBeDefined();
      expect(screen.getByTestId('trace-3d-trace-tid')).toBeDefined();
      expect(screen.getByTestId('viewer-title')).toBeDefined();
      expect(screen.getByTestId('component-count')).toBeDefined();
      expect(screen.getByTestId('viewer-export')).toBeDefined();
      expect(screen.getByTestId('viewer-import')).toBeDefined();
    });
  });
});
