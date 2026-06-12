import { PPX_FORMAT_VERSION } from '@protopulse/graph';
import { describe, expect, it } from 'vitest';

import { decodeShareFragment, encodeShareFragment, shareUrl } from './share.js';

import type { DesignBundle, OpEnvelope } from '@protopulse/graph';

function bundle(): DesignBundle {
  const ops: OpEnvelope[] = [
    { actor: 'a', lamport: 1, ts: 0, op: { kind: 'add_component', id: 'r1', ref: 'R1', partId: 'core:resistor', partRev: 1, value: '330' } },
    { actor: 'a', lamport: 2, ts: 0, op: { kind: 'connect', port: 'r1:1', newNetId: 'n1' } },
    { actor: 'a', lamport: 3, ts: 0, op: { kind: 'rename_net', netId: 'n1', name: 'VCC' } },
  ];
  return {
    format: 'ppx-bundle',
    version: PPX_FORMAT_VERSION,
    designId: 'share-test',
    head: 'main',
    branches: [
      { name: 'main', base: { branch: null, opCount: 0 }, ops },
      { name: 'alt', base: { branch: 'main', opCount: 3 }, ops: [] },
    ],
  };
}

describe('share links', () => {
  it('round-trips a bundle through the fragment, branches intact', async () => {
    const original = bundle();
    const fragment = await encodeShareFragment(original);
    expect(fragment.startsWith('d=')).toBe(true);
    // base64url payload: no '+', '/', '=' that would need %-escaping
    expect(fragment.slice('d='.length)).not.toMatch(/[+/=]/);
    const decoded = await decodeShareFragment(`#${fragment}`);
    expect(decoded).toEqual(original);
  });

  it('accepts the hash with or without the leading #', async () => {
    const fragment = await encodeShareFragment(bundle());
    expect(await decodeShareFragment(fragment)).toEqual(bundle());
    expect(await decodeShareFragment(`#${fragment}`)).toEqual(bundle());
  });

  it('returns null when there is no payload', async () => {
    expect(await decodeShareFragment('')).toBeNull();
    expect(await decodeShareFragment('#')).toBeNull();
    expect(await decodeShareFragment('#other=1')).toBeNull();
    expect(await decodeShareFragment('#d=')).toBeNull();
  });

  it('throws on a corrupt payload instead of returning garbage', async () => {
    await expect(decodeShareFragment('#d=not!valid@base64')).rejects.toThrow();
  });

  it('compresses: the fragment is smaller than the raw JSON', async () => {
    // Pad the log so compression has something to chew on.
    const b = bundle();
    const main = b.branches[0]!;
    for (let i = 4; i < 60; i++) {
      main.ops.push({
        actor: 'a',
        lamport: i,
        ts: 0,
        op: { kind: 'rename_net', netId: 'n1', name: `NET_NAME_${String(i)}` },
      });
    }
    const fragment = await encodeShareFragment(b);
    expect(fragment.length).toBeLessThan(JSON.stringify(b).length);
  });

  it('shareUrl builds a full link for the page', async () => {
    const url = await shareUrl(bundle(), { origin: 'http://localhost:5174', pathname: '/' });
    expect(url.startsWith('http://localhost:5174/#d=')).toBe(true);
  });
});
