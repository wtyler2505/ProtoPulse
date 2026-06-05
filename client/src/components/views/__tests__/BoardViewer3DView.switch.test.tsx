/**
 * BoardViewer3DView feature-flag switch tests (PP3D-1).
 *
 * Verifies the `viewer3dEngine` flag routes to the correct implementation:
 *   - default / `'css'` → CSS viewer (renders the `board-3d-scene` DOM).
 *   - `'webgl'`         → the lazy WebGL viewer (renders a real `<Canvas>`,
 *                          mocked here to a `<div>` per the repo's R3F mock
 *                          pattern, since jsdom/happy-dom have no WebGL).
 *
 * The R3F + drei surface is mocked widely enough to cover everything the WebGL
 * path mounts: Canvas, CameraControls, GizmoHelper/GizmoViewcube, Bounds.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
import { ProjectIdProvider } from '@/lib/contexts/project-id-context';

// ---------------------------------------------------------------------------
// Mocks — board-viewer data hook (CSS path needs it; reuse the shape from the
// sibling suite) and the WebGL/R3F surface (WebGL path).
// ---------------------------------------------------------------------------

const mockBoard = { width: 100, height: 80, thickness: 1.6, cornerRadius: 2 };

vi.mock('@/lib/board-viewer-3d', () => ({
  useBoardViewer3D: () => ({
    board: mockBoard,
    setBoard: vi.fn(),
    components: [],
    addComponent: vi.fn(),
    removeComponent: vi.fn(),
    vias: [],
    traces: [],
    drillHoles: [],
    scene: { board: mockBoard, layers: [], components: [], vias: [], traces: [], drillHoles: [] },
    cameraForView: vi.fn(),
    renderOptions: {
      backgroundColor: '#1a1a2e',
      boardColor: '#2d5016',
      solderMaskColor: '#1a6b1a',
    },
    setRenderOptions: vi.fn(),
    layerVisibility: [],
    measureDistance: vi.fn(),
    packageModels: [],
    exportScene: vi.fn().mockReturnValue('{}'),
    importScene: vi.fn(),
  }),
  BoardViewer3D: {
    getInstance: () => ({ getVisibleLayers: () => [], setLayerVisible: vi.fn() }),
  },
}));

vi.mock('@/lib/pcb/footprint-library', () => ({
  FootprintLibrary: { getFootprint: () => null },
}));

// R3F: Canvas → div; passthrough children so we can assert nested testids.
vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
    React.createElement(
      'div',
      { 'data-testid': (props['data-testid'] as string) ?? 'three-canvas' },
      children,
    ),
  useThree: () => ({ camera: {}, scene: {}, gl: { setClearColor: vi.fn() } }),
  useFrame: vi.fn(),
  extend: vi.fn(),
}));

// The scene composes raw R3F intrinsics (<mesh>, <group>, <boxGeometry>, …)
// which only mean something inside a real WebGL reconciler — rendering them as
// DOM under the Canvas-as-div mock emits "unrecognized tag" warnings. Mock the
// scene to a DOM-friendly stand-in that still surfaces the navigation cube, so
// the switch assertions stay meaningful without the noise.
vi.mock('@/components/views/board-viewer-3d/scene/BoardScene', () => ({
  __esModule: true,
  default: () => React.createElement('div', { 'data-testid': 'board-scene' },
    React.createElement('div', { 'data-testid': 'gizmo-viewcube' })),
  BoardScene: () => React.createElement('div', { 'data-testid': 'board-scene' },
    React.createElement('div', { 'data-testid': 'gizmo-viewcube' })),
}));

import BoardViewer3DView from '@/components/views/BoardViewer3DView';

function renderWith(engine?: 'css' | 'webgl') {
  const qc = createTestQueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <ProjectIdProvider projectId={0}>
        <BoardViewer3DView engine={engine} />
      </ProjectIdProvider>
    </QueryClientProvider>,
  );
}

describe('BoardViewer3DView engine switch', () => {
  it('defaults to the CSS engine when no prop or query param is set', () => {
    renderWith();
    expect(screen.getByTestId('board-3d-scene')).toBeDefined();
    expect(screen.queryByTestId('board-3d-canvas')).toBeNull();
  });

  it('renders the CSS engine when engine="css"', () => {
    renderWith('css');
    expect(screen.getByTestId('board-3d-scene')).toBeDefined();
    expect(screen.queryByTestId('board-3d-canvas')).toBeNull();
  });

  it('renders the WebGL engine (real Canvas + cube) when engine="webgl"', async () => {
    renderWith('webgl');
    // Lazy-loaded; wait for the dynamic import (+ three.js parse) to resolve.
    await waitFor(
      () => {
        expect(screen.getByTestId('board-3d-canvas')).toBeDefined();
      },
      { timeout: 10_000 },
    );
    // No CSS scene in the WebGL path.
    expect(screen.queryByTestId('board-3d-scene')).toBeNull();
    // The navigation gizmo cube mounted inside the canvas.
    expect(screen.getByTestId('gizmo-viewcube')).toBeDefined();
  });
});
