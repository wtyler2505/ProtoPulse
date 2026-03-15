import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          // scrypt-based auth tests need headroom — each hash is ~2-3s at N=16384
          testTimeout: 15000,
        },
      },
      {
        extends: true,
        test: {
          name: 'client',
          environment: 'happy-dom',
          include: ['client/**/*.test.ts', 'client/**/*.test.tsx'],
          setupFiles: ['client/src/test-setup.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'shared',
          environment: 'node',
          include: ['shared/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'electron',
          environment: 'node',
          include: ['electron/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'scripts',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['server/**/*.ts', 'client/src/**/*.ts', 'client/src/**/*.tsx', 'shared/**/*.ts'],
      exclude: [
        'server/__tests__/**',
        'server/index.ts',
        'client/src/test-setup.ts',
        '**/*.test.ts',
        '**/*.test.tsx',
      ],
    },
  },
});
