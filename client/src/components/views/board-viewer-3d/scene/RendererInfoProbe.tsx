import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

export interface WebGLRenderStats {
  calls: number;
  triangles: number;
  lines: number;
  points: number;
  geometries: number;
  textures: number;
}

export function RendererInfoProbe({
  signature,
  onStats,
}: {
  signature: string;
  onStats: (stats: WebGLRenderStats) => void;
}) {
  const { gl, invalidate } = useThree();

  useEffect(() => {
    const previousAutoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    gl.info.reset();
    invalidate();

    let firstFrame = 0;
    let secondFrame = 0;
    let retryTimer: number | undefined;
    let restored = false;
    const restoreAutoReset = () => {
      if (!restored) {
        gl.info.autoReset = previousAutoReset;
        restored = true;
      }
    };
    const readStats = () => {
      const info = gl.info;
      onStats({
        calls: info.render.calls,
        triangles: info.render.triangles,
        lines: info.render.lines,
        points: info.render.points,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      });
      restoreAutoReset();
    };
    const readWhenFrameHasRendered = (attempt = 0) => {
      if (gl.info.render.calls > 0 || attempt >= 20) {
        readStats();
        return;
      }
      retryTimer = window.setTimeout(() => readWhenFrameHasRendered(attempt + 1), 50);
    };

    if (typeof window === 'undefined' || typeof window.requestAnimationFrame !== 'function') {
      readStats();
      return undefined;
    }

    firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => readWhenFrameHasRendered());
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(secondFrame);
      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }
      restoreAutoReset();
    };
  }, [gl, invalidate, onStats, signature]);

  return null;
}
