import {
  decodeBundle,
  encodeBundle,
  MAIN_BRANCH,
  PPX_FORMAT_VERSION,
  type DesignBundle,
} from '@protopulse/graph';
import type { SessionCore } from './session.js';

/**
 * Persistence: debounced localStorage autosave of the DesignBundle,
 * .ppx.json file export/import, and the boot fixture. Storage is
 * injectable so node tests can run without a DOM.
 */

export const STORAGE_KEY = 'pp-design';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function defaultStorage(): StorageLike | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** Snapshot the session core into a serializable bundle. */
export function bundleFromCore(core: SessionCore, head: string): DesignBundle {
  return {
    format: 'ppx-bundle',
    version: PPX_FORMAT_VERSION,
    designId: core.designId,
    head,
    branches: core.log.entries(),
  };
}

export function saveBundle(bundle: DesignBundle, storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, encodeBundle(bundle));
  } catch (err) {
    console.warn('autosave failed', err);
  }
}

export function loadBundle(storage: StorageLike | null = defaultStorage()): DesignBundle | null {
  if (!storage) return null;
  try {
    const text = storage.getItem(STORAGE_KEY);
    if (!text) return null;
    return decodeBundle(text);
  } catch (err) {
    console.warn('saved design is unreadable — starting fresh', err);
    return null;
  }
}

export interface Autosaver {
  /** Call on any session change; persists after the debounce window. */
  schedule(): void;
  /** Persist immediately (beforeunload). */
  flush(): void;
  dispose(): void;
}

export function createAutosave(
  getBundle: () => DesignBundle,
  storage: StorageLike | null = defaultStorage(),
  delayMs = 1000,
): Autosaver {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return {
    schedule() {
      clear();
      timer = setTimeout(() => {
        timer = null;
        saveBundle(getBundle(), storage);
      }, delayMs);
    },
    flush() {
      clear();
      saveBundle(getBundle(), storage);
    },
    dispose: clear,
  };
}

/** Trigger a browser download of arbitrary text. */
export function downloadText(filename: string, text: string, mime = 'application/octet-stream'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Download the design as a .ppx.json bundle. */
export function exportFile(bundle: DesignBundle): void {
  downloadText(`${bundle.designId}.ppx.json`, encodeBundle(bundle), 'application/json');
}

/** Parse an imported .ppx.json file. Throws on malformed input. */
export async function importFile(file: { text(): Promise<string> }): Promise<DesignBundle> {
  return decodeBundle(await file.text());
}

/** Starter design for first boot: an empty main branch. */
export function loadFixture(): DesignBundle {
  return {
    format: 'ppx-bundle',
    version: PPX_FORMAT_VERSION,
    designId: 'pp-starter',
    head: MAIN_BRANCH,
    branches: [{ name: MAIN_BRANCH, base: { branch: null, opCount: 0 }, ops: [] }],
  };
}
