/**
 * viewer3d-engine — feature flag for the 3D board viewer rendering engine.
 *
 * PP3D-1 (Phase 1): the 3D viewer is migrating from a CSS-3D DOM implementation
 * to a real WebGL (@react-three/fiber) scene. While both implementations
 * coexist, a feature flag selects which one renders. The default is `'css'`
 * so user-facing behavior stays unchanged until the WebGL path reaches parity
 * (Phase 4 flips the default).
 *
 * Resolution order (first match wins):
 *   1. Explicit `engine` prop passed to {@link BoardViewer3DView} (test seam).
 *   2. `?viewer3dEngine=webgl|css` query parameter (manual preview seam).
 *   3. `localStorage['viewer3dEngine']` (persisted preference + e2e seam — a
 *      clean URL avoids the workspace router's query-string deep-link parsing).
 *   4. Default `'css'`.
 */

export type Viewer3dEngine = 'css' | 'webgl';

export const DEFAULT_VIEWER_3D_ENGINE: Viewer3dEngine = 'css';

/** Query-string key honored by {@link resolveViewer3dEngine}. */
export const VIEWER_3D_ENGINE_PARAM = 'viewer3dEngine';

/** localStorage key honored by {@link resolveViewer3dEngine}. */
export const VIEWER_3D_ENGINE_STORAGE_KEY = 'viewer3dEngine';

/** Narrow an arbitrary string to a valid {@link Viewer3dEngine}, or `null`. */
export function parseViewer3dEngine(value: string | null | undefined): Viewer3dEngine | null {
  if (value === 'css' || value === 'webgl') {
    return value;
  }
  return null;
}

/**
 * Resolve the active engine: query param, then persisted `localStorage`
 * preference, then {@link DEFAULT_VIEWER_3D_ENGINE}. Safe to call outside the
 * browser (SSR / tests with no `window`) — returns the default in that case.
 * All reads are defensive so a hostile/throwing storage never breaks the view.
 */
export function resolveViewer3dEngine(): Viewer3dEngine {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return DEFAULT_VIEWER_3D_ENGINE;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = parseViewer3dEngine(params.get(VIEWER_3D_ENGINE_PARAM));
    if (fromQuery) {
      return fromQuery;
    }
  } catch {
    // ignore malformed search and fall through to storage/default
  }

  try {
    const fromStorage = parseViewer3dEngine(
      window.localStorage.getItem(VIEWER_3D_ENGINE_STORAGE_KEY),
    );
    if (fromStorage) {
      return fromStorage;
    }
  } catch {
    // localStorage access can throw (privacy mode, disabled storage) — ignore.
  }

  return DEFAULT_VIEWER_3D_ENGINE;
}
