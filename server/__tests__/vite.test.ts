import { describe, expect, it } from 'vitest';

import { buildViteServerOptions } from '../vite';

describe('buildViteServerOptions', () => {
  it('does not hardcode localhost for HMR', () => {
    const fakeServer = {} as never;
    const options = buildViteServerOptions(fakeServer);

    expect(options.hmr.server).toBe(fakeServer);
    expect(options.hmr.host).toBe('');
    expect(options.hmr.clientPort).toBe(5000);
    expect(options.hmr.path).toBe('/vite-hmr');
  });
});
