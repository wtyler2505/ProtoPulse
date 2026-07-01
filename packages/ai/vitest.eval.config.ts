import { defineConfig } from 'vitest/config';

/**
 * Separate gated runner for the golden-regression eval (BL-0902). Disjoint
 * from the unit config by directory: unit tests live under `src`, evals under
 * `evals`. `npm run test:packages` never runs these; `npm run eval:ai` runs
 * only these.
 */
export default defineConfig({
  test: {
    name: 'ai-evals',
    environment: 'node',
    include: ['evals/**/*.eval.ts', 'evals/**/*.test.ts'],
  },
});
