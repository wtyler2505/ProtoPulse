import { useCallback, useEffect, useRef, useState } from 'react';

const EXPLODE_ANIMATION_MS = 380;

function easeOutCubic(value: number): number {
  const inverse = 1 - value;
  return 1 - inverse * inverse * inverse;
}

export function useExplodedView() {
  const [exploded, setExploded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [animating, setAnimating] = useState(false);
  const progressRef = useRef(0);
  const frameRef = useRef<number | null>(null);

  const toggleExploded = useCallback(() => {
    setExploded((current) => !current);
  }, []);

  useEffect(() => {
    const start = progressRef.current;
    const end = exploded ? 1 : 0;
    if (Math.abs(start - end) < 0.001) {
      progressRef.current = end;
      setProgress(end);
      setAnimating(false);
      return;
    }

    const startedAt = performance.now();
    setAnimating(true);

    const tick = (now: number) => {
      const elapsed = Math.min(1, (now - startedAt) / EXPLODE_ANIMATION_MS);
      const next = start + (end - start) * easeOutCubic(elapsed);
      progressRef.current = next;
      setProgress(next);

      if (elapsed < 1) {
        frameRef.current = window.requestAnimationFrame(tick);
      } else {
        progressRef.current = end;
        setProgress(end);
        setAnimating(false);
        frameRef.current = null;
      }
    };

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [exploded]);

  return { exploded, progress, animating, toggleExploded };
}
