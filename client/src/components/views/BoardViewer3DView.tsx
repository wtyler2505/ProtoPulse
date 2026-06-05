/**
 * BoardViewer3DView — feature-flag switch for the 3D PCB board viewer (PP3D-1).
 *
 * The 3D viewer is migrating from a CSS-3D DOM implementation to a real WebGL
 * (@react-three/fiber) scene. This component is a thin switch on the
 * `viewer3dEngine` flag:
 *   - `'css'`   → {@link CssBoardViewer} (the original implementation; default).
 *   - `'webgl'` → {@link WebGLBoardViewer} (new, lazy-loaded so three.js stays
 *                 out of the default code path).
 *
 * The default is `'css'`, so user-facing behavior is unchanged until the WebGL
 * path reaches parity (Phase 4 flips the default). The active engine resolves
 * from (1) an explicit `engine` prop, then (2) the `?viewer3dEngine=` query
 * param, then (3) the default — see {@link resolveViewer3dEngine}.
 *
 * `PACKAGE_HEIGHTS` is re-exported here for backward compatibility with the
 * existing component test suite, which imports it from this module path.
 */

import { lazy, Suspense, useMemo } from 'react';

import CssBoardViewer, { PACKAGE_HEIGHTS } from './board-viewer-3d/CssBoardViewer';
import { resolveViewer3dEngine } from './board-viewer-3d/viewer3d-engine';

import type { Viewer3dEngine } from './board-viewer-3d/viewer3d-engine';

// Re-export so existing importers (and the test suite) keep working.
export { PACKAGE_HEIGHTS };
export type { Viewer3dEngine };

// Lazy so three.js / R3F only load when the WebGL engine is actually selected.
const WebGLBoardViewer = lazy(() => import('./board-viewer-3d/WebGLBoardViewer'));

export interface BoardViewer3DViewProps {
  /**
   * Force a specific engine, bypassing query-param/default resolution.
   * Primarily a test seam; production mounts pass nothing and get the default.
   */
  engine?: Viewer3dEngine;
}

export default function BoardViewer3DView({ engine }: BoardViewer3DViewProps = {}) {
  const activeEngine = useMemo<Viewer3dEngine>(
    () => engine ?? resolveViewer3dEngine(),
    [engine],
  );

  if (activeEngine === 'webgl') {
    return (
      <Suspense
        fallback={
          <div
            data-testid="board-viewer-3d-loading"
            className="flex h-full items-center justify-center text-sm text-muted-foreground"
          >
            Loading 3D viewer…
          </div>
        }
      >
        <WebGLBoardViewer />
      </Suspense>
    );
  }

  return <CssBoardViewer />;
}
