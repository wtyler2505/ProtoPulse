import { useCallback, useEffect, useRef, useState } from 'react';

export const WORKSPACE_PANEL_HOVER_HIDE_DELAY_MS = 180;

interface UseHoverPeekPanelOptions {
  collapsed: boolean;
  isMobile: boolean;
  hideDelayMs?: number;
}

interface UseHoverPeekPanelResult {
  peekVisible: boolean;
  openPeek: () => void;
  closePeek: () => void;
}

export function useHoverPeekPanel({
  collapsed,
  isMobile,
  hideDelayMs = WORKSPACE_PANEL_HOVER_HIDE_DELAY_MS,
}: UseHoverPeekPanelOptions): UseHoverPeekPanelResult {
  const [peekVisible, setPeekVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const openPeek = useCallback(() => {
    if (!collapsed || isMobile) {
      return;
    }
    clearHideTimer();
    setPeekVisible(true);
  }, [clearHideTimer, collapsed, isMobile]);

  const closePeek = useCallback(() => {
    clearHideTimer();

    if (!collapsed || isMobile) {
      setPeekVisible(false);
      return;
    }

    hideTimerRef.current = window.setTimeout(() => {
      setPeekVisible(false);
      hideTimerRef.current = null;
    }, hideDelayMs);
  }, [clearHideTimer, collapsed, hideDelayMs, isMobile]);

  useEffect(() => {
    if (!collapsed || isMobile) {
      clearHideTimer();
      setPeekVisible(false);
    }
  }, [clearHideTimer, collapsed, isMobile]);

  useEffect(() => () => clearHideTimer(), [clearHideTimer]);

  return {
    peekVisible,
    openPeek,
    closePeek,
  };
}
