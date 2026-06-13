import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
