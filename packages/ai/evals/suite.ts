/**
 * Thin Vitest binding for golden scenarios (BL-0902). Kept separate from
 * `harness.ts` so the harness stays Vitest-free and unit-testable. Each
 * per-persona `*.eval.ts` calls `describeGolden(persona, scenarios, adapter)`.
 */
import { describe, it } from 'vitest';

import { assertGolden } from './harness.js';

import type { GoldenScenario, PersonaAdapter } from './schema.js';

export function describeGolden(
  persona: string,
  scenarios: GoldenScenario[],
  adapter: PersonaAdapter,
): void {
  describe(`${persona} golden eval`, () => {
    it.each(scenarios.map((s) => [s.id, s] as const))('%s', async (_id, scenario) => {
      const run = await adapter(scenario);
      assertGolden(scenario, run);
    });
  });
}
