import { describe, expect, it } from 'vitest';

import { reducer } from '@/hooks/use-toast';

describe('toast reducer', () => {
  it('returns the same state when dismissing an already closed toast', () => {
    const state = {
      toasts: [
        {
          id: 'toast-1',
          open: false,
          title: 'Closed toast',
        },
      ],
    };

    const nextState = reducer(state, {
      type: 'DISMISS_TOAST',
      toastId: 'toast-1',
    });

    expect(nextState).toBe(state);
  });

  it('returns the same state when removing a toast that does not exist', () => {
    const state = {
      toasts: [
        {
          id: 'toast-1',
          open: true,
          title: 'Live toast',
        },
      ],
    };

    const nextState = reducer(state, {
      type: 'REMOVE_TOAST',
      toastId: 'missing-toast',
    });

    expect(nextState).toBe(state);
  });

  it('returns the same state when clearing an empty toast list', () => {
    const state = { toasts: [] };

    const nextState = reducer(state, {
      type: 'REMOVE_TOAST',
    });

    expect(nextState).toBe(state);
  });
});
