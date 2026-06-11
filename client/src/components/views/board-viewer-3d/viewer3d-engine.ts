export type Viewer3DEngine = 'css' | 'webgl';

export const VIEWER_3D_ENGINE_STORAGE_KEY = 'protopulse-viewer3d-engine';

export function isViewer3DEngine(value: unknown): value is Viewer3DEngine {
  return value === 'css' || value === 'webgl';
}

export function readViewer3DEngine(): Viewer3DEngine {
  if (typeof window === 'undefined') {
    return 'css';
  }
  try {
    const stored = window.localStorage.getItem(VIEWER_3D_ENGINE_STORAGE_KEY);
    return isViewer3DEngine(stored) ? stored : 'css';
  } catch {
    return 'css';
  }
}

export function writeViewer3DEngine(engine: Viewer3DEngine): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(VIEWER_3D_ENGINE_STORAGE_KEY, engine);
  } catch {
    // localStorage may be unavailable in private or restricted browser contexts.
  }
}
