import { clearStorageEntriesByPrefix, getScopedStorageKey } from '@/lib/client-state-scope';

const LAST_PROJECT_KEY = 'protopulse-last-project';
const LEGACY_LAST_PROJECT_KEY = 'protopulse-last-project';

function parseStoredProjectId(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getLastProjectStorageKey(): string {
  return getScopedStorageKey(LAST_PROJECT_KEY);
}

export function getLastProjectId(): number | null {
  try {
    const scopedKey = getLastProjectStorageKey();
    const scopedValue = parseStoredProjectId(localStorage.getItem(scopedKey));
    if (scopedValue !== null) {
      return scopedValue;
    }

    const legacyValue = parseStoredProjectId(localStorage.getItem(LEGACY_LAST_PROJECT_KEY));
    if (legacyValue !== null) {
      localStorage.setItem(scopedKey, String(legacyValue));
      localStorage.removeItem(LEGACY_LAST_PROJECT_KEY);
      return legacyValue;
    }
  } catch {
    return null;
  }

  return null;
}

export function setLastProjectId(projectId: number): void {
  try {
    localStorage.setItem(getLastProjectStorageKey(), String(projectId));
  } catch {
    // localStorage unavailable
  }
}

export function clearCurrentLastProjectId(): void {
  try {
    localStorage.removeItem(getLastProjectStorageKey());
    localStorage.removeItem(LEGACY_LAST_PROJECT_KEY);
  } catch {
    // localStorage unavailable
  }
}

export function clearLastProjectIds(): void {
  try {
    clearStorageEntriesByPrefix(LAST_PROJECT_KEY);
  } catch {
    // localStorage unavailable
  }
}
