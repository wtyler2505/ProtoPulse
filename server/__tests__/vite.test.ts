import { describe, expect, it } from 'vitest';

import { buildViteServerOptions } from '../vite';

describe('buildViteServerOptions', () => {
  it('disables HMR in middleware mode for stability', () => {
    const fakeServer = {} as never;
    const options = buildViteServerOptions(fakeServer);

    expect(options.hmr).toBe(false);
  });
});
