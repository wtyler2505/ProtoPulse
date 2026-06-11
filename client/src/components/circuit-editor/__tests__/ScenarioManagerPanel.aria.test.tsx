/// <reference lib="dom" />

import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { ScenarioManagerPanel } from '../ScenarioManagerPanel';

/**
 * BL-0781 ARIA spinbutton contract for ScenarioManagerPanel.
 *
 * Audit row mapping (docs/audits/bl-0781-number-input-audit.md, T1 section):
 *   L187 scenario-form-temperature      ADD-MIN -273, ADD-MAX 1000  (simType=dc)
 *   L199 scenario-form-freq-start       ADD-MIN 0,    ADD-MAX 1e12 (simType=ac)
 *   L207 scenario-form-freq-end         ADD-MIN 0,    ADD-MAX 1e12 (simType=ac)
 *   L215 scenario-form-freq-points      ADD-MIN 2,    ADD-MAX 100000 (simType=ac)
 *   L228 scenario-form-timespan         ADD-MIN 1e-12, ADD-MAX 86400 (simType=transient)
 *   L237 scenario-form-timestep         ADD-MIN 1e-15, ADD-MAX 1 (simType=transient)
 *
 * The primitive's formatAriaNumber (BL-0881) expands exponential values to
 * full decimal strings to avoid the JS toString '1e-12' representation, which
 * axe + AT cannot interpret.
 */

function openForm(): void {
  fireEvent.click(screen.getByTestId('scenario-new-button'));
}

function setSimType(label: 'DC Analysis' | 'AC Sweep' | 'Transient'): void {
  fireEvent.click(screen.getByTestId('scenario-form-simtype'));
  // The label "Transient" also appears as a preset-badge in the panel
  // (e.g. "Power On Transient"). Narrow to the listbox option by role.
  fireEvent.click(screen.getByRole('option', { name: label }));
}

describe('ScenarioManagerPanel — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors bounds on scenario-form-temperature (simType=dc default)', () => {
    render(<ScenarioManagerPanel />);
    openForm();
    const input = screen.getByTestId('scenario-form-temperature') as HTMLInputElement;
    expect(input.getAttribute('aria-valuemin')).toBe('-273');
    expect(input.getAttribute('aria-valuemax')).toBe('1000');
    expect(input.getAttribute('min')).toBe('-273');
    expect(input.getAttribute('max')).toBe('1000');
  });

  it('mirrors bounds on AC frequency inputs (simType=ac)', () => {
    render(<ScenarioManagerPanel />);
    openForm();
    setSimType('AC Sweep');
    const start = screen.getByTestId('scenario-form-freq-start') as HTMLInputElement;
    const end = screen.getByTestId('scenario-form-freq-end') as HTMLInputElement;
    const points = screen.getByTestId('scenario-form-freq-points') as HTMLInputElement;

    // formatAriaNumber expands 1e12 → '1000000000000'
    expect(start.getAttribute('aria-valuemin')).toBe('0');
    expect(start.getAttribute('aria-valuemax')).toBe('1000000000000');
    expect(end.getAttribute('aria-valuemin')).toBe('0');
    expect(end.getAttribute('aria-valuemax')).toBe('1000000000000');
    expect(points.getAttribute('aria-valuemin')).toBe('2');
    expect(points.getAttribute('aria-valuemax')).toBe('100000');
  });

  it('mirrors bounds on transient time inputs (simType=transient)', () => {
    // Note: audit originally proposed min=1e-12 / 1e-15 (picosecond/femtosecond).
    // BL-0781 follow-up now normalizes ARIA min/max too, but these fields still
    // use the semantic lower bound of 0: time cannot be negative.
    render(<ScenarioManagerPanel />);
    openForm();
    setSimType('Transient');
    const timespan = screen.getByTestId('scenario-form-timespan') as HTMLInputElement;
    const timestep = screen.getByTestId('scenario-form-timestep') as HTMLInputElement;

    expect(timespan.getAttribute('aria-valuemin')).toBe('0');
    expect(timespan.getAttribute('aria-valuemax')).toBe('86400');
    expect(timestep.getAttribute('aria-valuemin')).toBe('0');
    expect(timestep.getAttribute('aria-valuemax')).toBe('1');
  });
});
