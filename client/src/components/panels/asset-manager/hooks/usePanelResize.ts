import { useState, useRef, useCallback, useEffect } from 'react';

interface UsePanelResizeOptions {
  minWidth?: number;
  maxWidth?: number;
}

export function usePanelResize({
  minWidth = 200,
  maxWidth = 400,
}: UsePanelResizeOptions = {}) {
  const [panelWidth, setPanelWidth] = useState(256);
  const resizing = useRef(false);

  const handleResize = useCallback((e: MouseEvent) => {
    if (!resizing.current) return;
    const newWidth = Math.min(maxWidth, Math.max(minWidth, e.clientX));
    setPanelWidth(newWidth);
  }, [minWidth, maxWidth]);

  const stopResize = useCallback(() => {
    resizing.current = false;
    document.removeEventListener('mousemove', handleResize);
    document.removeEventListener('mouseup', stopResize);
  }, [handleResize]);

  const startResize = useCallback(() => {
    resizing.current = true;
    document.addEventListener('mousemove', handleResize);
    document.addEventListener('mouseup', stopResize);
  }, [handleResize, stopResize]);

  useEffect(() => {
    return () => {
      if (resizing.current) {
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        resizing.current = false;
      }
    };
  }, [handleResize, stopResize]);

  return { panelWidth, startResize };
}
