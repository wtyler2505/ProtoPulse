import { decodeBundle, encodeBundle } from '@protopulse/graph';

import type { DesignBundle } from '@protopulse/graph';

/**
 * Serverless share links (Vol III §4 spirit, zero infrastructure): the
 * whole DesignBundle deflate-compressed and base64url-encoded into the
 * URL fragment — `#d=…`. The fragment never leaves the browser (servers
 * don't see it), nothing is uploaded anywhere, and anyone with the link
 * gets the full op-log, branches and all. The design IS its op-log, so
 * the link IS the design.
 *
 * Uses the native CompressionStream API (browsers + Node 18+) — no
 * dependency, and op-log JSON deflates extremely well (repetitive keys).
 */

export const FRAGMENT_KEY = 'd';

async function deflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    new CompressionStream('deflate-raw'),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(
    new DecompressionStream('deflate-raw'),
  );
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Bundle → the URL fragment payload (`d=…`, no leading '#'). */
export async function encodeShareFragment(bundle: DesignBundle): Promise<string> {
  const json = new TextEncoder().encode(encodeBundle(bundle));
  return `${FRAGMENT_KEY}=${toBase64Url(await deflate(json))}`;
}

/**
 * Parse a location.hash (with or without the leading '#'). Returns the
 * decoded bundle, or null when the hash carries no share payload.
 * Throws on a present-but-corrupt payload — callers tell the user.
 */
export async function decodeShareFragment(hash: string): Promise<DesignBundle | null> {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(raw);
  const payload = params.get(FRAGMENT_KEY);
  if (payload === null || payload === '') return null;
  const json = new TextDecoder().decode(await inflate(fromBase64Url(payload)));
  return decodeBundle(json);
}

/** Full shareable URL for the current page. */
export async function shareUrl(
  bundle: DesignBundle,
  location: { origin: string; pathname: string },
): Promise<string> {
  return `${location.origin}${location.pathname}#${await encodeShareFragment(bundle)}`;
}
