/**
 * The user's own Anthropic API key, shared by every live agent panel
 * (Analyst, Professor). Stored in localStorage 'pp-anthropic-key' in
 * plain text and sent ONLY to Anthropic, never to a ProtoPulse server.
 */

export const KEY_STORAGE = 'pp-anthropic-key';

export function loadKey(): string {
  try {
    return globalThis.localStorage.getItem(KEY_STORAGE) ?? '';
  } catch {
    return '';
  }
}

export function storeKey(key: string): void {
  try {
    if (key === '') {
      globalThis.localStorage.removeItem(KEY_STORAGE);
    } else {
      globalThis.localStorage.setItem(KEY_STORAGE, key);
    }
  } catch {
    // privacy mode — key stays in-memory for this session only
  }
}
