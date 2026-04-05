import { getScopedStorageKey } from '@/lib/client-state-scope';

const HIDDEN_PROJECTS_KEY = 'protopulse-hidden-projects';

function parseHiddenProjectIds(raw: string | null): number[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as number[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
  } catch {
    return [];
  }
}

function persistHiddenProjectIds(ids: number[]): void {
  try {
    localStorage.setItem(getHiddenProjectStorageKey(), JSON.stringify(ids));
  } catch {
    // localStorage unavailable
  }
}

export function getHiddenProjectStorageKey(): string {
  return getScopedStorageKey(HIDDEN_PROJECTS_KEY);
}

export function getHiddenProjectIds(): number[] {
  try {
    return Array.from(new Set(parseHiddenProjectIds(localStorage.getItem(getHiddenProjectStorageKey())))).sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export function hideProjectFromPicker(projectId: number): void {
  const next = new Set(getHiddenProjectIds());
  next.add(projectId);
  persistHiddenProjectIds(Array.from(next).sort((a, b) => a - b));
}

export function showProjectInPicker(projectId: number): void {
  const next = new Set(getHiddenProjectIds());
  next.delete(projectId);
  persistHiddenProjectIds(Array.from(next).sort((a, b) => a - b));
}

export function pruneHiddenProjectIds(validProjectIds: Iterable<number>): number {
  const valid = new Set(validProjectIds);
  const existing = getHiddenProjectIds();
  const next = existing.filter((projectId) => valid.has(projectId));
  if (next.length !== existing.length) {
    persistHiddenProjectIds(next);
  }
  return existing.length - next.length;
}
