const SESSION_STORAGE_KEY = 'protopulse-session-id';
const ANONYMOUS_SCOPE = 'anonymous';

function hasLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getCurrentClientStateScope(): string {
  if (!hasLocalStorage()) {
    return ANONYMOUS_SCOPE;
  }

  const sessionId = window.localStorage.getItem(SESSION_STORAGE_KEY);
  return sessionId && sessionId.trim().length > 0 ? sessionId : ANONYMOUS_SCOPE;
}

export function getScopedStorageKey(baseKey: string, scope: string = getCurrentClientStateScope()): string {
  return `${baseKey}:${scope}`;
}

export function getProjectScopedStorageKey(
  baseKey: string,
  projectId: number,
  scope: string = getCurrentClientStateScope(),
): string {
  return `${getScopedStorageKey(baseKey, scope)}:${String(projectId)}`;
}

export function clearStorageEntriesByPrefix(prefix: string): void {
  if (!hasLocalStorage()) {
    return;
  }

  const keysToRemove: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key && (key === prefix || key.startsWith(`${prefix}:`))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    window.localStorage.removeItem(key);
  }
}
