/**
 * React hook for the CanvasAnnouncer — manages lifecycle automatically.
 *
 * BL-0326: Screen-reader labels for canvas actions
 */

import { useEffect, useRef, useCallback } from 'react';
import { CanvasAnnouncer } from './canvas-accessibility';

/**
 * Hook that creates a CanvasAnnouncer on mount and destroys it on unmount.
 * Returns a stable `announce` function that can be called to send messages
 * to the aria-live region.
 */
export function useCanvasAnnouncer(): (message: string) => void {
  const announcerRef = useRef<CanvasAnnouncer | null>(null);

  useEffect(() => {
    announcerRef.current = new CanvasAnnouncer();
    return () => {
      announcerRef.current?.destroy();
      announcerRef.current = null;
    };
  }, []);

  const announce = useCallback((message: string) => {
    announcerRef.current?.announce(message);
  }, []);

  return announce;
}
