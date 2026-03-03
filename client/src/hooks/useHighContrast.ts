import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'protopulse-high-contrast';
const CLASS_NAME = 'high-contrast';

/**
 * Manages high-contrast accessibility mode.
 * Persists preference in localStorage and toggles the .high-contrast
 * class on document.documentElement.
 */
export function useHighContrast() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add(CLASS_NAME);
    } else {
      root.classList.remove(CLASS_NAME);
    }
    try {
      localStorage.setItem(STORAGE_KEY, String(enabled));
    } catch {
      // localStorage unavailable — gracefully degrade
    }
  }, [enabled]);

  const toggle = useCallback(() => {
    setEnabled((prev) => !prev);
  }, []);

  return { enabled, toggle } as const;
}
