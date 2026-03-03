import { useRef, useCallback, useEffect } from 'react';

export function useDragGhost() {
  const dragGhostRef = useRef<HTMLDivElement | null>(null);

  const cleanupDragGhost = useCallback(() => {
    if (dragGhostRef.current && dragGhostRef.current.parentNode) {
      document.body.removeChild(dragGhostRef.current);
      dragGhostRef.current = null;
    }
  }, []);

  const handleDragStart = useCallback((
    event: React.DragEvent,
    assetName: string,
    onDragStart: () => void,
  ) => {
    cleanupDragGhost();
    const dragEl = document.createElement('div');
    dragEl.style.cssText =
      'position:absolute;top:-1000px;left:-1000px;padding:6px 12px;' +
      'background:#1a1a2e;border:1px solid #06b6d4;color:#e2e8f0;' +
      'font-size:12px;font-family:monospace;display:flex;align-items:center;' +
      'gap:6px;z-index:9999;';
    const icon = document.createElement('span');
    icon.style.color = '#06b6d4';
    icon.textContent = '◆';
    const label = document.createTextNode(` ${assetName}`);
    dragEl.appendChild(icon);
    dragEl.appendChild(label);
    document.body.appendChild(dragEl);
    dragGhostRef.current = dragEl;
    event.dataTransfer.setDragImage(dragEl, 60, 16);
    onDragStart();
  }, [cleanupDragGhost]);

  const handleDragEnd = useCallback(() => {
    cleanupDragGhost();
  }, [cleanupDragGhost]);

  useEffect(() => {
    return () => {
      cleanupDragGhost();
    };
  }, [cleanupDragGhost]);

  return { handleDragStart, handleDragEnd };
}
