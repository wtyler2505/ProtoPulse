/**
 * Tauri Desktop API Bridge
 *
 * Drop-in replacement for the Electron preload API (ElectronAPI interface).
 * Uses Tauri v2 JS bindings (@tauri-apps/api + plugins) plus the generated
 * tauri-specta bindings (`@/lib/bindings`) for custom Rust commands: file
 * dialogs, filesystem I/O, app info, menu events.
 *
 * Phase 2.1 (Native Authority): `spawnProcess` was REMOVED from this bridge.
 * The backing `spawn_process(command, args)` Rust command was a generic
 * process primitive (full RCE from the webview) and is excluded from the
 * `AppManifest::commands` allowlist in src-tauri/build.rs. Typed, scoped
 * replacements (e.g. arduino_* commands) arrive per
 * docs/decisions/2026-05-12-adr-arduino-typed-commands.md.
 *
 * Usage:
 *   import { getDesktopAPI, isTauri } from '@/lib/tauri-api';
 *   const api = getDesktopAPI();
 *   if (api) { await api.writeFile('/tmp/out.txt', data); }
 */

import { listen } from '@tauri-apps/api/event';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';
import { save as saveDialog, open as openDialog } from '@tauri-apps/plugin-dialog';
import { commands } from '@/lib/bindings';

/**
 * Unwrap a tauri-specta `typedError` result into a resolved value or a
 * thrown Error, matching the plain-promise DesktopAPI/ElectronAPI contract.
 */
function unwrap<T>(result: { status: 'ok'; data: T } | { status: 'error'; error: string }): T {
  if (result.status === 'error') {
    throw new Error(result.error);
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Environment detection
// ---------------------------------------------------------------------------

/**
 * `true` when running inside a Tauri webview (v2).
 * Tauri v2 injects `__TAURI_INTERNALS__` on the window object before any
 * user JS executes, so this check is reliable from module-load time.
 */
export const isTauri: boolean =
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

// ---------------------------------------------------------------------------
// DesktopAPI — mirrors ElectronAPI from electron/preload.ts
// ---------------------------------------------------------------------------

export interface DesktopAPI {
  platform: string;
  openExternal: (url: string) => Promise<void>;
  showSaveDialog: (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }) => Promise<{ canceled: boolean; filePaths: string[] }>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, data: string) => Promise<void>;
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  onMenuAction: (callback: (action: string) => void) => () => void;
}

// ---------------------------------------------------------------------------
// Menu action channels — must match the Rust side emit names and the
// PRELOAD_IPC_ON_CHANNELS from electron/config.ts
// ---------------------------------------------------------------------------

const MENU_CHANNELS = [
  'menu:new-project',
  'menu:open-project',
  'menu:save',
] as const;

// ---------------------------------------------------------------------------
// Tauri implementation
// ---------------------------------------------------------------------------

/** Cached platform string — resolved once on first call to getDesktopAPI(). */
let cachedPlatform: string | undefined;

function buildTauriAPI(): DesktopAPI {
  const api: DesktopAPI = {
    // Resolved lazily in getDesktopAPI() before returning
    platform: cachedPlatform ?? 'unknown',

    // ── Shell ──────────────────────────────────────────────────────────
    openExternal: async (url: string): Promise<void> => {
      await openUrl(url);
    },

    // ── Dialogs ────────────────────────────────────────────────────────
    showSaveDialog: async (options) => {
      const filePath = await saveDialog({
        title: options.title,
        defaultPath: options.defaultPath,
        filters: options.filters,
      });
      return {
        canceled: filePath === null,
        filePath: filePath ?? undefined,
      };
    },

    showOpenDialog: async (options) => {
      const directory = options.properties?.includes('openDirectory') ?? false;
      const multiple = options.properties?.includes('multiSelections') ?? false;

      const result = await openDialog({
        title: options.title,
        defaultPath: options.defaultPath,
        filters: options.filters,
        directory,
        multiple,
      });

      if (result === null) {
        return { canceled: true, filePaths: [] };
      }

      // openDialog returns string | string[] depending on `multiple`
      const filePaths = Array.isArray(result) ? result : [result];
      return { canceled: false, filePaths };
    },

    // ── Filesystem ─────────────────────────────────────────────────────
    // Generated tauri-specta bindings — command names can never drift from
    // src-tauri/src/lib.rs (Phase 1.3 / Phase 2.1).
    readFile: async (filePath: string): Promise<string> => {
      return unwrap(await commands.readFile(filePath));
    },

    writeFile: async (filePath: string, data: string): Promise<void> => {
      unwrap(await commands.writeFile(filePath, data));
    },

    // ── App info ───────────────────────────────────────────────────────
    getVersion: async (): Promise<string> => {
      return commands.getVersion();
    },

    getPlatform: async (): Promise<string> => {
      return commands.getPlatform();
    },

    // ── Menu events ────────────────────────────────────────────────────
    onMenuAction: (callback: (action: string) => void): (() => void) => {
      const unlisteners: UnlistenFn[] = [];
      const setupPromises: Array<Promise<void>> = [];

      for (const channel of MENU_CHANNELS) {
        const p = listen<void>(channel, () => {
          callback(channel);
        }).then((unlisten: UnlistenFn) => {
          unlisteners.push(unlisten);
        });
        setupPromises.push(p);
      }

      // Return synchronous unsubscribe — matches ElectronAPI contract.
      // If called before all listeners are registered the pending ones
      // will be cleaned up once their promises resolve.
      let tornDown = false;
      return () => {
        tornDown = true;
        for (const unlisten of unlisteners) {
          unlisten();
        }
        // Handle any listeners that registered after teardown was called
        void Promise.all(setupPromises).then(() => {
          if (tornDown) {
            for (const unlisten of unlisteners) {
              unlisten();
            }
          }
        });
      };
    },
  };

  return api;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

let cachedAPI: DesktopAPI | null | undefined;

/**
 * Returns a `DesktopAPI` when running inside Tauri, or `null` in a browser.
 * The instance is created once and cached for the lifetime of the page.
 */
export function getDesktopAPI(): DesktopAPI | null {
  if (cachedAPI !== undefined) {
    return cachedAPI;
  }

  if (!isTauri) {
    cachedAPI = null;
    return null;
  }

  // Resolve platform eagerly — invoke is async but we cache the result
  // so subsequent accesses are synchronous.
  const api = buildTauriAPI();

  void commands.getPlatform().then((p) => {
    cachedPlatform = p;
    // Patch the already-built API object so callers that read `.platform`
    // after the first tick get the real value.
    api.platform = p;
  });

  cachedAPI = api;
  return cachedAPI;
}
