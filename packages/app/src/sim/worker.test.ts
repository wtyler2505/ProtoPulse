import { describe, expect, it } from 'vitest';

import { handleSimWorkerRequest } from './sim.worker.js';
import { SimWorkerClient } from './worker.js';

import type { EngineLike } from './sim.worker.js';
import type { SimResult } from './types.js';
import type { SimWorkerRequest, SimWorkerResponse, WorkerLike } from './worker.js';

/**
 * The worker pair's streaming protocol, end to end without a DOM: the
 * pure handler emits one progress frame per completed batch deck, and
 * the client surfaces them through onProgress while still resolving
 * the final result exactly once.
 */

const RESULT: SimResult = {
  analysis: { kind: 'op' },
  vectors: [],
  manifest: { entries: [], worstTier: 'ideal' },
} as unknown as SimResult;

function fakeEngine(): EngineLike {
  return { run: () => Promise.resolve(RESULT) };
}

describe('handleSimWorkerRequest streaming', () => {
  it('emits one progress frame per batch deck, none for single simulate', async () => {
    const frames: SimWorkerResponse[] = [];
    const emit = (f: SimWorkerResponse) => frames.push(f);

    const batch = await handleSimWorkerRequest(
      { id: 7, kind: 'mc', netlistBodies: ['a', 'b', 'c'], analysis: { kind: 'op' } },
      fakeEngine(),
      emit,
    );
    expect(batch).toMatchObject({ id: 7, ok: true });
    expect(frames).toEqual([
      { id: 7, kind: 'progress', done: 1, total: 3 },
      { id: 7, kind: 'progress', done: 2, total: 3 },
      { id: 7, kind: 'progress', done: 3, total: 3 },
    ]);

    frames.length = 0;
    await handleSimWorkerRequest(
      { id: 8, kind: 'simulate', netlistBody: 'a', analysis: { kind: 'op' } },
      fakeEngine(),
      emit,
    );
    expect(frames).toEqual([]);
  });
});

describe('SimWorkerClient streaming', () => {
  it('routes progress frames to onProgress and resolves the final batch once', async () => {
    // A shim worker that runs the real pure handler inline.
    let onMessage: ((event: { data: SimWorkerResponse }) => void) | null = null;
    const shim: WorkerLike = {
      postMessage: (message: SimWorkerRequest) => {
        void handleSimWorkerRequest(message, fakeEngine(), (frame) => {
          onMessage?.({ data: frame });
        }).then((response) => {
          onMessage?.({ data: response });
        });
      },
      addEventListener: (type, listener) => {
        if (type === 'message') onMessage = listener as (event: { data: SimWorkerResponse }) => void;
      },
      terminate: () => undefined,
    };

    const client = new SimWorkerClient(() => shim);
    const seen: [number, number][] = [];
    const results = await client.runBatch('step', ['a', 'b'], { kind: 'op' }, (done, total) => {
      seen.push([done, total]);
    });
    expect(results).toHaveLength(2);
    expect(seen).toEqual([
      [1, 2],
      [2, 2],
    ]);
  });
});
