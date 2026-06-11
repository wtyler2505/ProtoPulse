import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
import { ProjectIdProvider } from '@/lib/contexts/project-id-context';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

// ---------------------------------------------------------------------------
// Package heights export (must match the module under test)
// ---------------------------------------------------------------------------

const EXPECTED_PACKAGE_HEIGHTS: Record<string, number> = {
  'DIP-8': 5.0,
  'DIP-14': 5.0,
  'DIP-16': 5.0,
  'DIP-28': 5.0,
  'DIP-40': 5.0,
  'SOIC-8': 1.75,
  'SOIC-14': 1.75,
  'SOIC-16': 1.75,
  'SOT-23': 1.1,
  'SOT-23-5': 1.1,
  'SOT-23-6': 1.1,
  'QFP-44': 1.6,
  'QFP-64': 1.6,
  'QFP-100': 1.6,
  'QFP-144': 1.6,
  'QFN-16': 0.85,
  'QFN-32': 0.85,
  'QFN-48': 0.85,
  'SOP-8': 1.75,
  'TO-220': 4.5,
  'TO-92': 4.5,
  'TO-263': 2.5,
  '0402': 0.5,
  '0603': 0.6,
  '0805': 0.7,
  '1206': 0.8,
  'SOD-123': 1.1,
  'SOD-323': 0.6,
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
let mockDrillHoles: Array<{
  id: string;
  position: { x: number; y: number };
  diameter: number;
  plated: boolean;
}> = [];
let mockCircuitDesigns: Array<{ id: number; name: string; projectId: number }> = [];
let mockCircuitInstances: unknown[] = [];
let mockCircuitVias: unknown[] = [];
let mockCircuitWires: unknown[] = [];
let mockCircuitNets: unknown[] = [];

const mockSetBoard = vi.fn();
const mockExportScene = vi.fn().mockReturnValue('{}');
const mockImportScene = vi.fn().mockReturnValue({ success: true, errors: [] });
const mockClear3DScene = vi.fn();
const mockSetActiveView = vi.fn();
const mockToast = vi.fn();

// Mock FootprintLibrary
const mockGetFootprint = vi.fn();
vi.mock('@/lib/pcb/footprint-library', () => ({
  FootprintLibrary: {
    getFootprint: (...args: unknown[]) => mockGetFootprint(...args),
  },
}));

vi.mock('@/hooks/useProjectBoard', () => ({
  useProjectBoard: () => ({
    board: {
      id: 1,
      projectId: 0,
      widthMm: 100,
      heightMm: 80,
      thicknessMm: 1.6,
      cornerRadiusMm: 2,
      layers: 2,
      copperWeightOz: 1,
      finish: 'HASL',
      solderMaskColor: 'green',
      silkscreenColor: 'white',
      minTraceWidthMm: 0.2,
      minDrillSizeMm: 0.3,
      castellatedHoles: false,
      impedanceControl: false,
      viaInPad: false,
      goldFingers: false,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    },
    updateBoard: vi.fn(),
  }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: mockCircuitDesigns }),
  useCircuitInstances: () => ({ data: mockCircuitInstances }),
  useCircuitVias: () => ({ data: mockCircuitVias }),
  useCircuitWires: () => ({ data: mockCircuitWires }),
  useCircuitNets: () => ({ data: mockCircuitNets }),
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    setActiveView: mockSetActiveView,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

vi.mock('three', () => ({
  MathUtils: {
    degToRad: (deg: number) => (deg * Math.PI) / 180,
  },
  Vector3: class Vector3 {
    constructor(
      public x: number,
      public y: number,
      public z: number,
    ) {}
  },
  CatmullRomCurve3: class CatmullRomCurve3 {
    constructor(public points: unknown[]) {}
  },
}));

vi.mock('@react-three/fiber', () => ({
  Canvas: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', {
      'data-testid': props['data-testid'] ?? 'mock-r3f-canvas',
      'data-frameloop': props.frameloop,
      'data-dpr': Array.isArray(props.dpr) ? props.dpr.join(',') : undefined,
    }),
  useThree: () => ({
    invalidate: vi.fn(),
    gl: {
      domElement: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        getBoundingClientRect: () => ({ width: 100, height: 80 }),
      },
      setSize: vi.fn(),
    },
  }),
}));

vi.mock('@react-three/drei', () => ({
  Bvh: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': 'mock-r3f-bvh' }, props.children),
  Bounds: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': 'mock-r3f-bounds' }, props.children),
  CameraControls: React.forwardRef<unknown, Record<string, unknown>>((props, ref) => {
    React.useImperativeHandle(ref, () => ({
      dolly: vi.fn().mockResolvedValue(undefined),
      reset: vi.fn().mockResolvedValue([]),
      rotate: vi.fn().mockResolvedValue(undefined),
      saveState: vi.fn(),
      setLookAt: vi.fn().mockResolvedValue(undefined),
    }));
    return React.createElement('div', {
      'data-testid': 'mock-r3f-camera-controls',
      'data-make-default': props.makeDefault ? 'true' : 'false',
    });
  }),
  ContactShadows: () => React.createElement('div', { 'data-testid': 'mock-r3f-contact-shadows' }),
  Environment: () => React.createElement('div', { 'data-testid': 'mock-r3f-environment' }),
  GizmoHelper: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': 'mock-r3f-gizmo-helper' }, props.children),
  GizmoViewcube: () => React.createElement('div', { 'data-testid': 'mock-r3f-gizmo-viewcube' }),
  Html: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': 'mock-r3f-html' }, props.children),
  Line: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': 'mock-r3f-line' }, props.children),
  Outlines: () => React.createElement('div', { 'data-testid': 'mock-r3f-outlines' }),
  Tube: (props: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement('div', { 'data-testid': 'mock-r3f-tube' }, props.children),
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
    drillHoles: mockDrillHoles,
    scene: mockScene,
    cameraForView: vi.fn(),
    renderOptions: mockRenderOptions,
    setRenderOptions: vi.fn(),
    layerVisibility: [
      'top-copper',
      'bottom-copper',
      'substrate',
      'top-silk',
      'bottom-silk',
      'top-mask',
      'bottom-mask',
      'internal',
    ],
    measureDistance: vi.fn(),
    packageModels: [],
    exportScene: mockExportScene,
    importScene: mockImportScene,
  }),
  BoardViewer3D: {
    getInstance: () => ({
      clear: mockClear3DScene,
      getVisibleLayers: () => [
        'top-copper',
        'bottom-copper',
        'substrate',
        'top-silk',
        'bottom-silk',
        'top-mask',
        'bottom-mask',
        'internal',
      ],
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
      onChange: () => {
        (props.onCheckedChange as () => void)?.();
      },
    }),
}));

// ---------------------------------------------------------------------------
// Import under test (MUST come after mocks)
// ---------------------------------------------------------------------------

import BoardViewer3DView, { PACKAGE_HEIGHTS } from '@/components/views/BoardViewer3DView';
import { VIEWER_3D_ENGINE_STORAGE_KEY } from '@/components/views/board-viewer-3d/viewer3d-engine';
import {
  BREADBOARD_3D_BRIDGE_EVENT,
  type Breadboard3DBridgeTarget,
  writeBreadboard3DBridgeTarget,
} from '@/lib/breadboard-3d-bridge';
import {
  VIEWER_3D_BRIDGE_EVENT,
  VIEWER_3D_REPAIR_STORAGE_KEY,
  type Viewer3DBridgeTarget,
  writeViewer3DBridgeTarget,
} from '@/lib/viewer-3d-bridge';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';

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

function makeBreadboardTarget(overrides: Partial<Breadboard3DBridgeTarget> = {}): Breadboard3DBridgeTarget {
  return {
    sourceView: 'breadboard',
    projectId: 1,
    circuitId: 7,
    instanceId: 42,
    refDes: 'U1',
    title: 'ATmega328P DIP',
    trustTier: 'connector-defined',
    verificationLevel: 'community-only',
    verificationStatus: 'candidate',
    pinMapConfidence: 'exact',
    readyNow: true,
    createdAt: 123,
    ...overrides,
  };
}

function makeGenerativeTarget(overrides: Partial<Viewer3DBridgeTarget> = {}): Viewer3DBridgeTarget {
  return {
    sourceView: 'generative',
    sourceId: 'cand-1',
    refDes: 'U5',
    title: 'Boost converter candidate',
    subtitle: 'Fitness 91.0%',
    sourceName: 'Generative design engine',
    trustTier: 'ai-generated',
    verificationLevel: 'generated',
    verificationStatus: 'candidate',
    readyNow: false,
    componentCount: 4,
    generatedFrom: 'generative-design',
    fitnessScore: 0.91,
    createdAt: 456,
    ...overrides,
  };
}

function makeDigitalTwinTarget(overrides: Partial<Viewer3DBridgeTarget> = {}): Viewer3DBridgeTarget {
  return {
    sourceView: 'digital-twin',
    title: 'ESP32 telemetry',
    subtitle: '2 live of 3 channels',
    trustTier: 'live-telemetry',
    verificationLevel: 'live',
    verificationStatus: 'no-comparison',
    readyNow: true,
    channelCount: 3,
    liveChannelCount: 2,
    pinCount: 2,
    netCount: 1,
    healthStatus: 'warn',
    stateConfidence: 'live',
    modelKind: 'behavior-preview',
    liveChannels: [
      {
        id: 'D2',
        name: 'Button',
        value: 'HIGH',
        state: 'live',
        pin: 2,
        refDes: 'U1',
        pinLabel: 'D2',
        netName: 'BUTTON',
      },
      { id: 'PWM3', name: 'Motor PWM', value: '0.00', state: 'stale', pin: 3 },
    ],
    createdAt: 789,
    ...overrides,
  };
}

function dispatchModel3DRadialCommand(commandId: string, targetId?: string): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'model_3d',
      target: 'model',
      targetId,
      targetLabel: targetId,
    },
    source: 'radial-menu',
  };
  act(() => {
    window.dispatchEvent(new CustomEvent(RADIAL_COMMAND_EVENT, { detail }));
  });
  return detail;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BoardViewer3DView', () => {
  beforeEach(() => {
    mockComponents = [];
    mockVias = [];
    mockTraces = [];
    mockDrillHoles = [];
    mockCircuitDesigns = [];
    mockCircuitInstances = [];
    mockCircuitVias = [];
    mockCircuitWires = [];
    mockCircuitNets = [];
    mockGetFootprint.mockReset();
    mockSetActiveView.mockClear();
    mockToast.mockClear();
    mockClear3DScene.mockClear();
    window.sessionStorage.clear();
    window.localStorage.removeItem(VIEWER_3D_ENGINE_STORAGE_KEY);
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
      mockComponents = [
        {
          id: 'comp-visible',
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
        },
      ];
      renderView();
      expect(screen.getByTestId('board-substrate')).toBeDefined();
    });

    it('uses the CSS 3D engine by default', () => {
      renderView();

      expect(screen.getByTestId('viewer-3d-engine-css').getAttribute('data-active')).toBe('true');
      expect(screen.getByTestId('viewer-3d-engine-webgl').getAttribute('data-active')).toBe('false');
      expect(screen.queryByTestId('viewer-3d-webgl-engine')).toBeNull();
    });

    it('renders the WebGL engine when the persisted feature flag is enabled', () => {
      window.localStorage.setItem(VIEWER_3D_ENGINE_STORAGE_KEY, 'webgl');

      renderView();

      expect(screen.getByTestId('viewer-3d-engine-css').getAttribute('data-active')).toBe('false');
      expect(screen.getByTestId('viewer-3d-engine-webgl').getAttribute('data-active')).toBe('true');
      expect(screen.getByTestId('viewer-3d-webgl-engine')).toBeDefined();
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('data-pad-count')).toBe('0');
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('data-render-call-budget')).toBe('96');
      expect(screen.getByTestId('viewer-3d-webgl-canvas').getAttribute('data-frameloop')).toBe('demand');
      expect(screen.getByTestId('viewer-3d-webgl-canvas').getAttribute('data-dpr')).toBe('1,2');
      expect(screen.getByTestId('viewer-3d-webgl-layer-panel')).toBeDefined();
      expect(screen.getByTestId('viewer-3d-webgl-tools-panel')).toBeDefined();
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('data-measure-segment-count')).toBe('0');
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('data-section-enabled')).toBe('false');
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('data-exploded')).toBe('false');
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('data-camera-preset')).toBe('home');
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('role')).toBe('application');
      expect(screen.getByTestId('viewer-3d-webgl-engine').getAttribute('aria-label')).toContain('arrow keys');
      expect(screen.getByTestId('viewer-3d-webgl-camera-status').textContent).toContain('Home view');
      expect(screen.getByTestId('viewer-3d-webgl-empty-hint')).toBeDefined();
    });

    it('switches to the WebGL engine from the visible engine control', () => {
      renderView();

      fireEvent.click(screen.getByTestId('viewer-3d-engine-webgl'));

      expect(screen.getByTestId('viewer-3d-engine-css').getAttribute('data-active')).toBe('false');
      expect(screen.getByTestId('viewer-3d-engine-webgl').getAttribute('data-active')).toBe('true');
      expect(window.localStorage.getItem(VIEWER_3D_ENGINE_STORAGE_KEY)).toBe('webgl');
      expect(screen.getByTestId('viewer-3d-webgl-engine')).toBeDefined();
    });
  });

  describe('breadboard bridge target', () => {
    it('renders pending Breadboard selection context from session storage', () => {
      writeBreadboard3DBridgeTarget(makeBreadboardTarget());

      renderView();

      expect(screen.getByTestId('viewer-breadboard-bridge-card').textContent).toContain('Breadboard selection');
      expect(screen.getByTestId('viewer-breadboard-bridge-card').textContent).toContain('U1');
      expect(screen.getByTestId('viewer-breadboard-bridge-card').textContent).toContain('ATmega328P DIP');
      expect(screen.getByTestId('viewer-breadboard-bridge-trust').textContent).toContain('connector defined');
      expect(screen.getByTestId('viewer-breadboard-bridge-status').textContent).toContain('Awaiting 3D placement');
    });

    it('updates Breadboard selection context from the bridge event', () => {
      renderView();

      act(() => {
        window.dispatchEvent(
          new CustomEvent(BREADBOARD_3D_BRIDGE_EVENT, {
            detail: makeBreadboardTarget({ refDes: 'U2', title: 'Sensor Module', readyNow: false }),
          }),
        );
      });

      expect(screen.getByTestId('viewer-breadboard-bridge-card').textContent).toContain('U2');
      expect(screen.getByTestId('viewer-breadboard-bridge-card').textContent).toContain('Sensor Module');
      expect(screen.getByTestId('viewer-breadboard-bridge-card').textContent).toContain('needs review');
    });

    it('highlights the matching 3D component by reference designator', () => {
      writeBreadboard3DBridgeTarget(makeBreadboardTarget({ refDes: 'U1' }));
      mockComponents = [
        {
          id: 'comp-match',
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
        },
      ];

      renderView();

      expect(screen.getByTestId('viewer-breadboard-bridge-status').textContent).toContain('Matched in 3D scene');
      expect(screen.getByTestId('component-3d-comp-match').getAttribute('data-highlighted')).toBe('true');
    });

    it('renders generic source context from session storage', () => {
      writeViewer3DBridgeTarget(makeGenerativeTarget());

      renderView();

      const card = screen.getByTestId('viewer-breadboard-bridge-card');
      expect(card.textContent).toContain('Generative candidate');
      expect(card.textContent).toContain('Boost converter candidate');
      expect(card.textContent).toContain('ai generated');
      expect(screen.getByTestId('viewer-3d-source-name').textContent).toContain('Generative design engine');
      expect(screen.getByTestId('viewer-3d-fitness-score').textContent).toContain('fitness 91.0%');
      expect(card.textContent).toContain('4 components');
      expect(screen.getByTestId('viewer-breadboard-bridge-status').textContent).toContain(
        'Context ready for 3D review',
      );
    });

    it('updates generic source context from the bridge event', () => {
      renderView();

      act(() => {
        window.dispatchEvent(
          new CustomEvent(VIEWER_3D_BRIDGE_EVENT, {
            detail: makeGenerativeTarget({ title: 'Motor driver candidate', componentCount: 6 }),
          }),
        );
      });

      const card = screen.getByTestId('viewer-breadboard-bridge-card');
      expect(card.textContent).toContain('Motor driver candidate');
      expect(card.textContent).toContain('6 components');
    });

    it('renders community source identity and trust score from session storage', () => {
      writeViewer3DBridgeTarget({
        sourceView: 'community',
        sourceId: 'seed-dip8',
        title: 'DIP-8 3D Package',
        sourceName: '3DModelPro',
        sourceTrustScore: 78,
        trustTier: 'community',
        verificationLevel: 'community-only',
        verificationStatus: 'candidate',
        readyNow: true,
        modelFormat: 'STEP',
        modelKind: '3d-model',
        createdAt: 457,
      });

      renderView();

      const card = screen.getByTestId('viewer-breadboard-bridge-card');
      expect(card.textContent).toContain('Community 3D model');
      expect(screen.getByTestId('viewer-3d-source-name').textContent).toContain('source 3DModelPro');
      expect(screen.getByTestId('viewer-3d-source-trust-score').textContent).toContain('reputation 78');
      expect(card.textContent).toContain('STEP');
    });

    it('renders Digital Twin live-state context from session storage', () => {
      writeViewer3DBridgeTarget(makeDigitalTwinTarget());
      mockComponents = [
        {
          id: 'comp-live-channel',
          refDes: 'U1',
          package: 'SOIC-8',
          position: { x: 50, y: 40, z: 1.6 },
          rotation: 0,
          side: 'top',
          bodyWidth: 5.0,
          bodyHeight: 5.0,
          bodyDepth: 1.75,
          color: '#1a1a1a',
          pins: [
            { id: 'D2', position: { x: 0, y: 0 }, diameter: 1.0, type: 'smd' },
            { id: 'D3', position: { x: 2, y: 0 }, diameter: 1.0, type: 'smd' },
          ],
        },
      ];

      renderView();

      const card = screen.getByTestId('viewer-breadboard-bridge-card');
      expect(card.textContent).toContain('Digital Twin state');
      expect(card.textContent).toContain('ESP32 telemetry');
      expect(screen.getByTestId('viewer-3d-live-channels').textContent).toContain('2/3 live channels');
      expect(screen.getByTestId('viewer-3d-health-status').textContent).toContain('health warn');
      expect(card.textContent).toContain('2 pins');
      expect(card.textContent).toContain('1 net');

      const overlay = screen.getByTestId('viewer-3d-digital-twin-overlay');
      expect(overlay.textContent).toContain('Digital Twin live-state');
      expect(screen.getByTestId('viewer-3d-live-overlay-channels').textContent).toContain('2/3');
      expect(screen.getByTestId('viewer-3d-live-overlay-pins').textContent).toContain('2');
      expect(screen.getByTestId('viewer-3d-live-overlay-nets').textContent).toContain('1');
      expect(screen.getByTestId('viewer-3d-live-overlay-confidence').textContent).toContain('live');
      expect(screen.getByTestId('viewer-3d-live-overlay-health').textContent).toContain('health warn');
      expect(screen.getByTestId('viewer-3d-live-overlay-model').textContent).toContain('behavior preview');
      expect(screen.getByTestId('viewer-3d-live-overlay-channel-list').textContent).toContain('Button');
      expect(screen.getByTestId('viewer-3d-live-overlay-channel-D2').textContent).toContain('HIGH');
      expect(screen.getByTestId('viewer-3d-live-overlay-channel-D2').textContent).toContain('U1');
      expect(screen.getByTestId('viewer-3d-live-overlay-channel-D2').textContent).toContain('D2');
      expect(screen.getByTestId('viewer-3d-live-overlay-channel-D2').textContent).toContain('BUTTON');
      expect(screen.getByTestId('viewer-3d-live-overlay-channel-PWM3').textContent).toContain('P3');
      expect(screen.getByTestId('component-3d-comp-live-channel').getAttribute('data-highlighted')).toBe('true');
      const pinHotspot = screen.getByTestId('component-3d-pin-hotspot-comp-live-channel-D2');
      expect(pinHotspot.getAttribute('data-state')).toBe('live');
      expect(pinHotspot.getAttribute('aria-label')).toContain('U1 D2 live telemetry: Button HIGH');
      const netBadge = screen.getByTestId('viewer-3d-net-state-BUTTON-D2');
      expect(netBadge.getAttribute('data-state')).toBe('live');
      expect(netBadge.textContent).toContain('BUTTON');
      expect(netBadge.textContent).toContain('U1:D2 HIGH');
      expect(netBadge.getAttribute('aria-label')).toContain('BUTTON net live: U1:D2 Button HIGH');
    });

    it('routes Digital Twin bridge repairs back to source work surfaces', () => {
      writeViewer3DBridgeTarget(makeDigitalTwinTarget());

      renderView();

      fireEvent.click(screen.getByTestId('viewer-3d-open-digital-twin'));
      fireEvent.click(screen.getByTestId('viewer-3d-fix-breadboard'));
      fireEvent.click(screen.getByTestId('viewer-3d-fix-component-editor'));

      expect(mockSetActiveView).toHaveBeenCalledWith('digital_twin');
      expect(mockSetActiveView).toHaveBeenCalledWith('breadboard');
      expect(mockSetActiveView).toHaveBeenCalledWith('component_editor');

      const stored = JSON.parse(window.sessionStorage.getItem(VIEWER_3D_REPAIR_STORAGE_KEY) ?? '{}') as {
        destination?: string;
        refDes?: string;
        channel?: { id?: string; pinLabel?: string; netName?: string };
      };
      expect(stored.destination).toBe('component-editor');
      expect(stored.refDes).toBe('U1');
      expect(stored.channel?.id).toBe('D2');
      expect(stored.channel?.pinLabel).toBe('D2');
      expect(stored.channel?.netName).toBe('BUTTON');
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

      mockComponents = [
        {
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
        },
      ];

      renderView();
      const comp = screen.getByTestId('component-3d-comp-1');
      expect(comp).toBeDefined();
      // Footprint boundingBox width=6.0, board width=100 => 6% width
      // The style should use footprint dimensions, not the original 5.0
      expect(comp.style.width).toBe('6%');
    });

    it('falls back to original dimensions when no footprint data', () => {
      mockGetFootprint.mockReturnValue(null);

      mockComponents = [
        {
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
        },
      ];

      renderView();
      const comp = screen.getByTestId('component-3d-comp-2');
      expect(comp).toBeDefined();
      // No footprint, falls back to component.bodyWidth=3.0, board=100 => 3%
      expect(comp.style.width).toBe('3%');
    });

    it('uses PACKAGE_HEIGHTS for body depth when package is known', () => {
      mockGetFootprint.mockReturnValue(null);

      mockComponents = [
        {
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
        },
      ];

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

    it('exposes component model metadata for radial targeting', () => {
      mockGetFootprint.mockReturnValue(null);
      mockComponents = [
        {
          id: 'comp-radial',
          refDes: 'U7',
          package: 'SOIC-8',
          position: { x: 20, y: 20, z: 1.6 },
          rotation: 0,
          side: 'top',
          bodyWidth: 5,
          bodyHeight: 4,
          bodyDepth: 1.75,
          color: '#1a1a1a',
          pins: [],
        },
      ];

      renderView();
      const component = screen.getByTestId('component-3d-comp-radial');
      expect(component).toHaveAttribute('data-model-id', 'comp-radial');
      expect(component).toHaveAttribute('data-model-label', 'U7');
    });
  });

  describe('radial command adapter', () => {
    beforeEach(() => {
      mockGetFootprint.mockReturnValue(null);
      mockComponents = [
        {
          id: 'comp-a',
          refDes: 'U1',
          package: 'SOIC-8',
          position: { x: 20, y: 20, z: 1.6 },
          rotation: 0,
          side: 'top',
          bodyWidth: 5,
          bodyHeight: 4,
          bodyDepth: 1.75,
          color: '#1a1a1a',
          pins: [],
        },
        {
          id: 'comp-b',
          refDes: 'U2',
          package: 'SOIC-8',
          position: { x: 60, y: 40, z: 1.6 },
          rotation: 0,
          side: 'top',
          bodyWidth: 5,
          bodyHeight: 4,
          bodyDepth: 1.75,
          color: '#1a1a1a',
          pins: [],
        },
      ];
    });

    it('isolates a targeted 3D model from a radial command', () => {
      renderView();

      const detail = dispatchModel3DRadialCommand('isolate_model', 'comp-b');

      expect(detail.handled).toBe(true);
      expect(screen.queryByTestId('component-3d-comp-a')).toBeNull();
      expect(screen.getByTestId('component-3d-comp-b')).toHaveAttribute('data-highlighted', 'true');
    });

    it('cross-probes a radial 3D target back to PCB', () => {
      renderView();

      const detail = dispatchModel3DRadialCommand('cross_probe', 'comp-a');

      expect(detail.handled).toBe(true);
      expect(mockSetActiveView).toHaveBeenCalledWith('pcb');
    });

    it('clears the 3D scene from a radial command', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

      try {
        renderView();

        const detail = dispatchModel3DRadialCommand('clear_3d_scene', 'comp-a');

        expect(detail.handled).toBe(true);
        expect(mockClear3DScene).toHaveBeenCalledTimes(1);
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: '3D scene cleared',
          }),
        );
      } finally {
        logSpy.mockRestore();
      }
    });

    it('drafts bounded 3D fit context to AI chat from a radial command', () => {
      mockTraces = [
        {
          id: 'trace-a',
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 20 },
          ],
          width: 0.25,
          layer: 'top-copper',
        },
      ];
      mockVias = [
        {
          id: 'via-a',
          position: { x: 40, y: 30 },
          drillDiameter: 0.3,
          outerDiameter: 0.7,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
      ];
      mockDrillHoles = [
        {
          id: 'hole-a',
          position: { x: 6, y: 7 },
          diameter: 2.4,
          plated: true,
        },
      ];
      writeViewer3DBridgeTarget(
        makeDigitalTwinTarget({
          refDes: 'U1',
          boardHealthScore: 78,
        }),
      );
      const chatOpenListener = vi.fn();
      const chatDraftListener = vi.fn();
      window.addEventListener('protopulse:open-chat-panel', chatOpenListener);
      window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);

      try {
        renderView();

        const detail = dispatchModel3DRadialCommand('ai_3d_fit_inspection', 'comp-a');

        expect(detail.handled).toBe(true);
        expect(chatOpenListener).toHaveBeenCalledTimes(1);
        expect((chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean }>).detail.designAgent).toBe(
          false,
        );
        expect(chatDraftListener).toHaveBeenCalledTimes(1);
        const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
        expect(message).toContain('AI intent: inspect_3d_fit.');
        expect(message).toContain(
          '3D fit inspection: 2 component(s), 1 trace(s), 1 via(s), 1 drill hole(s), board 100mm x 80mm x 1.6mm.',
        );
        expect(message).toContain('Target: model "comp-a"');
        expect(message).toContain('Target model: U1 id=comp-a');
        expect(message).toContain('Board: width=100mm height=80mm thickness=1.6mm cornerRadius=2mm');
        expect(message).toContain('3D components:');
        expect(message).toContain('U1 id=comp-a');
        expect(message).toContain('3D traces:');
        expect(message).toContain('trace trace-a layer=top-copper width=0.25 points=2');
        expect(message).toContain('3D vias:');
        expect(message).toContain('via via-a x=40 y=30 drill=0.3 outer=0.7 top-copper->bottom-copper');
        expect(message).toContain('Drill holes:');
        expect(message).toContain('hole hole-a x=6 y=7 diameter=2.4 plated=yes');
        expect(message).toContain('Layer and guide state:');
        expect(message).toContain('Bridge provenance:');
        expect(message).toContain('Source: digital-twin');
        expect(message).toContain('Board health score: 78');
        expect(message).toContain('Live channels: 2/3');
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'AI 3D Fit Drafted',
            description: 'Drafted comp-a 3D prompt in AI chat.',
          }),
        );
      } finally {
        window.removeEventListener('protopulse:open-chat-panel', chatOpenListener);
        window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
      }
    });
  });

  // =========================================================================
  // Trace rendering
  // =========================================================================

  describe('trace rendering', () => {
    it('renders trace segments as visual elements', () => {
      mockTraces = [
        {
          id: 'trace-1',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'top-copper',
        },
      ];

      renderView();
      expect(screen.getByTestId('trace-3d-trace-1')).toBeDefined();
    });

    it('renders multiple traces', () => {
      mockTraces = [
        {
          id: 'trace-1',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'top-copper',
        },
        {
          id: 'trace-2',
          points: [
            { x: 20, y: 60 },
            { x: 70, y: 60 },
          ],
          width: 0.5,
          layer: 'bottom-copper',
        },
      ];

      renderView();
      expect(screen.getByTestId('trace-3d-trace-1')).toBeDefined();
      expect(screen.getByTestId('trace-3d-trace-2')).toBeDefined();
    });

    it('applies copper-red color for front layer traces', () => {
      mockTraces = [
        {
          id: 'trace-front',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'top-copper',
        },
      ];

      renderView();
      const segment = screen.getByTestId('trace-segment-trace-front-0');
      expect(segment.style.backgroundColor).toBe('#cc5533');
    });

    it('applies copper-blue color for back layer traces', () => {
      mockTraces = [
        {
          id: 'trace-back',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'bottom-copper',
        },
      ];

      renderView();
      const segment = screen.getByTestId('trace-segment-trace-back-0');
      expect(segment.style.backgroundColor).toBe('#3366bb');
    });

    it('renders multi-segment traces with multiple segments', () => {
      mockTraces = [
        {
          id: 'trace-multi',
          points: [
            { x: 10, y: 10 },
            { x: 30, y: 10 },
            { x: 30, y: 50 },
          ],
          width: 0.3,
          layer: 'top-copper',
        },
      ];

      renderView();
      const container = screen.getByTestId('trace-3d-trace-multi');
      expect(container).toBeDefined();
      // Multiple segments inside
      const segments = container.querySelectorAll('[data-testid^="trace-segment-"]');
      expect(segments.length).toBe(2); // 3 points = 2 segments
    });

    it('positions front traces at board top surface', () => {
      mockTraces = [
        {
          id: 'trace-top',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'top-copper',
        },
      ];

      renderView();
      const segment = screen.getByTestId('trace-segment-trace-top-0');
      // boardThickness=1.6, scale=2 => z=3.2
      expect(segment.style.transform).toContain('translateZ(3.2px)');
    });

    it('positions back traces at board bottom surface', () => {
      mockTraces = [
        {
          id: 'trace-bot',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'bottom-copper',
        },
      ];

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
      mockVias = [
        {
          id: 'via-1',
          position: { x: 40, y: 40 },
          drillDiameter: 0.3,
          outerDiameter: 0.6,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
      ];

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
      mockVias = [
        {
          id: 'via-parts',
          position: { x: 40, y: 40 },
          drillDiameter: 0.3,
          outerDiameter: 0.6,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
      ];

      renderView();
      expect(screen.getByTestId('via-outer-via-parts')).toBeDefined();
      expect(screen.getByTestId('via-hole-via-parts')).toBeDefined();
    });

    it('applies copper color to outer ring', () => {
      mockVias = [
        {
          id: 'via-color',
          position: { x: 40, y: 40 },
          drillDiameter: 0.3,
          outerDiameter: 0.6,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
      ];

      renderView();
      const outer = screen.getByTestId('via-outer-via-color');
      expect(outer.style.backgroundColor).toBe('#b87333');
    });

    it('applies dark color to drill hole', () => {
      mockVias = [
        {
          id: 'via-hole-color',
          position: { x: 40, y: 40 },
          drillDiameter: 0.3,
          outerDiameter: 0.6,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
      ];

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
      expect(screen.getByText('3D View is empty')).toBeDefined();
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
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'top-copper',
        },
        {
          id: 'trace-b',
          points: [
            { x: 10, y: 50 },
            { x: 50, y: 50 },
          ],
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
      mockComponents = [
        {
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
        },
      ];
      mockVias = [
        {
          id: 'via-tid',
          position: { x: 30, y: 30 },
          drillDiameter: 0.3,
          outerDiameter: 0.6,
          startLayer: 'top-copper',
          endLayer: 'bottom-copper',
        },
      ];
      mockTraces = [
        {
          id: 'trace-tid',
          points: [
            { x: 10, y: 10 },
            { x: 50, y: 10 },
          ],
          width: 0.25,
          layer: 'top-copper',
        },
      ];

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
