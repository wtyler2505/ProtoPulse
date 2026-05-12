/**
 * R5 #2 — frontend adapter for tauri-plugin-store backed storage.
 *
 * Architecture (per Codex R3 ratified):
 * - Backend-only plugin use. This adapter calls generated `commands.*` only;
 *   never imports `@tauri-apps/plugin-store`.
 * - JSON.stringify / JSON.parse is hidden from consumers; they see typed
 *   JS values.
 * - Browser fallback: localStorage with the same API surface.
 * - The 3 bootstrap-read keys (`protopulse-high-contrast`,
 *   `protopulse-gpu-blur-override`, `protopulse-theme`) are NOT migrated to
 *   plugin-store in R5 #2 — they stay in localStorage. See the
 *   Bootstrap-Storage Restructure follow-up wave.
 */

import { isTauri } from '@/lib/tauri-api';
import { commands } from '@/lib/bindings';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unwrapResult<T>(
  result: { status: 'ok'; data: T } | { status: 'error'; error: unknown },
): T {
  if (result.status === 'ok') return result.data;
  throw new Error(
    typeof result.error === 'string' ? result.error : String(result.error),
  );
}

function parseJsonOrNull(s: string | null): unknown {
  if (s === null) return null;
  try {
    return JSON.parse(s);
  } catch {
    return s; // legacy localStorage values that weren't JSON-stringified
  }
}

// ─── User-settings store ─────────────────────────────────────────────────────

export interface UserSettingStore {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
}

function tauriUserSettingStore(): UserSettingStore {
  return {
    get: async <T = unknown>(key: string): Promise<T | null> => {
      const raw = unwrapResult(await commands.readUserSetting(key));
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    set: async (key, value) => {
      unwrapResult(await commands.writeUserSetting(key, JSON.stringify(value)));
    },
  };
}

function browserUserSettingStore(): UserSettingStore {
  return {
    get: async <T = unknown>(key: string): Promise<T | null> => {
      const raw = localStorage.getItem(key);
      return raw === null ? null : (parseJsonOrNull(raw) as T);
    },
    set: async (key, value) => {
      localStorage.setItem(key, JSON.stringify(value));
    },
  };
}

let _userSettingStore: UserSettingStore | undefined;
export function getUserSettingStore(): UserSettingStore {
  if (_userSettingStore) return _userSettingStore;
  _userSettingStore = isTauri ? tauriUserSettingStore() : browserUserSettingStore();
  return _userSettingStore;
}

// ─── Kanban-state store (SINGLETON per Codex R3) ────────────────────────────

export interface KanbanStateStore {
  get<T = unknown>(): Promise<T | null>;
  set(value: unknown): Promise<void>;
}

/** Legacy localStorage key — preserves naming for browser fallback. */
const KANBAN_STATE_LOCALSTORAGE_KEY = 'protopulse-kanban-board';

function tauriKanbanStateStore(): KanbanStateStore {
  return {
    get: async <T = unknown>(): Promise<T | null> => {
      const raw = unwrapResult(await commands.readKanbanState());
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    set: async (value) => {
      unwrapResult(await commands.writeKanbanState(JSON.stringify(value)));
    },
  };
}

function browserKanbanStateStore(): KanbanStateStore {
  return {
    get: async <T = unknown>(): Promise<T | null> => {
      const raw = localStorage.getItem(KANBAN_STATE_LOCALSTORAGE_KEY);
      return raw === null ? null : (parseJsonOrNull(raw) as T);
    },
    set: async (value) => {
      localStorage.setItem(KANBAN_STATE_LOCALSTORAGE_KEY, JSON.stringify(value));
    },
  };
}

let _kanbanStateStore: KanbanStateStore | undefined;
export function getKanbanStateStore(): KanbanStateStore {
  if (_kanbanStateStore) return _kanbanStateStore;
  _kanbanStateStore = isTauri ? tauriKanbanStateStore() : browserKanbanStateStore();
  return _kanbanStateStore;
}

// ─── Design-variables store (per-project) ───────────────────────────────────

export interface DesignVariablesStore {
  get<T = unknown>(projectId: string): Promise<T | null>;
  set(projectId: string, value: unknown): Promise<void>;
}

/** Legacy localStorage key prefix — browser fallback. */
const DESIGN_VARS_LOCALSTORAGE_PREFIX = 'protopulse:design-variables:project:';

function tauriDesignVariablesStore(): DesignVariablesStore {
  return {
    get: async <T = unknown>(projectId: string): Promise<T | null> => {
      const raw = unwrapResult(await commands.readProjectDesignVariables(projectId));
      return raw === null ? null : (JSON.parse(raw) as T);
    },
    set: async (projectId, value) => {
      unwrapResult(
        await commands.writeProjectDesignVariables(projectId, JSON.stringify(value)),
      );
    },
  };
}

function browserDesignVariablesStore(): DesignVariablesStore {
  return {
    get: async <T = unknown>(projectId: string): Promise<T | null> => {
      const raw = localStorage.getItem(`${DESIGN_VARS_LOCALSTORAGE_PREFIX}${projectId}`);
      return raw === null ? null : (parseJsonOrNull(raw) as T);
    },
    set: async (projectId, value) => {
      localStorage.setItem(
        `${DESIGN_VARS_LOCALSTORAGE_PREFIX}${projectId}`,
        JSON.stringify(value),
      );
    },
  };
}

let _designVariablesStore: DesignVariablesStore | undefined;
export function getDesignVariablesStore(): DesignVariablesStore {
  if (_designVariablesStore) return _designVariablesStore;
  _designVariablesStore = isTauri
    ? tauriDesignVariablesStore()
    : browserDesignVariablesStore();
  return _designVariablesStore;
}

// ─── Test helpers ────────────────────────────────────────────────────────────

/**
 * Reset cached store instances. Tests only — production code never calls this.
 */
export function __resetStoresForTesting(): void {
  _userSettingStore = undefined;
  _kanbanStateStore = undefined;
  _designVariablesStore = undefined;
}
