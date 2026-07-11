/**
 * ARIA contract tests for ScenarioManagerPanel's NumberInput migration
 * (BL-0781 — docs/audits/bl-0781-number-input-audit.md).
 *
 * All 6 instances (temperature, AC sweep start/end/points, transient
 * time-span/time-step) are OMIT-MAX with no min per the audit table — none of
 * them gets a min or max bound, so the migration adds zero observable DOM
 * attributes. A raw `<input type="number">` and a bare `<NumberInput>` are
 * DOM-identical in happy-dom for unset attributes (the Chromium
 * `aria-valuemax="0"` bug is accessibility-tree synthesis in the real
 * browser, which happy-dom doesn't reproduce). These assertions are contract
 * locks, not RED->GREEN witnesses — see BL-0781 migration report.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { ScenarioManagerPanel } from '../ScenarioManagerPanel';

function assertNoBounds(el: HTMLElement) {
  expect(el.hasAttribute('aria-valuemax')).toBe(false);
  expect(el.hasAttribute('max')).toBe(false);
  expect(el.hasAttribute('aria-valuemin')).toBe(false);
  expect(el.hasAttribute('min')).toBe(false);
}

async function openNewScenarioForm(user: ReturnType<typeof userEvent.setup>) {
  render(<ScenarioManagerPanel />);
  await user.click(screen.getByTestId('scenario-new-button'));
}

describe('ScenarioManagerPanel — NumberInput ARIA contract (BL-0781)', () => {
  it('DC temperature field (default sim type) omits all aria-value bounds', async () => {
    const user = userEvent.setup();
    await openNewScenarioForm(user);
    assertNoBounds(screen.getByTestId('scenario-form-temperature'));
  });

  it('AC sweep start/end/points fields omit all aria-value bounds', async () => {
    const user = userEvent.setup();
    await openNewScenarioForm(user);
    await user.click(screen.getByTestId('scenario-form-simtype'));
    await user.click(await screen.findByRole('option', { name: 'AC Sweep' }));

    assertNoBounds(screen.getByTestId('scenario-form-freq-start'));
    assertNoBounds(screen.getByTestId('scenario-form-freq-end'));
    assertNoBounds(screen.getByTestId('scenario-form-freq-points'));
  });

  it('Transient time-span/time-step fields omit all aria-value bounds', async () => {
    const user = userEvent.setup();
    await openNewScenarioForm(user);
    await user.click(screen.getByTestId('scenario-form-simtype'));
    // getByText('Transient') collides with the unrelated "power-on-transient"
    // preset badge elsewhere on the page — scope to the open listbox's option
    // role, which the preset badge (a plain <div>) doesn't have.
    await user.click(await screen.findByRole('option', { name: 'Transient' }));

    assertNoBounds(screen.getByTestId('scenario-form-timespan'));
    assertNoBounds(screen.getByTestId('scenario-form-timestep'));
  });
});
