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
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts'],
          // api.test.ts uses node:test runner (not Vitest) — exclude to avoid conflicts
          exclude: ['server/__tests__/api.test.ts'],
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
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
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
