import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// happy-dom ships a real ResizeObserver, but unlike browsers it can fire
// callbacks synchronously/eagerly rather than batching per frame. Radix
// primitives (Select, ScrollArea, Popover, ...) re-measure on every
// ResizeObserver callback via useLayoutEffect state updates — under
// happy-dom's eager firing that becomes an infinite render loop ("Maximum
// update depth exceeded") the instant one of those primitives mounts, with
// no relation to what's actually being tested. Stub it as an inert no-op so
// components that merely render a Radix primitive don't trip this.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        new Response('null', {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    ),
  );
});

afterEach(() => {
  cleanup();
  // Many legacy browser-focused suites install file-level globals (localStorage,
  // crypto, AudioContext, Worker) and reset their backing stores in beforeEach.
  // Clearing call history preserves those stable fakes without leaking calls.
  vi.clearAllMocks();
});
