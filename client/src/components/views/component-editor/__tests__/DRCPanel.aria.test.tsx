/**
 * DRCPanel — NumberInput ARIA-contract migration test (BL-0781).
 *
 * DRCPanel's rule-param input (`input-rule-${rule.type}-${key}`) migrated from a raw
 * `<input type="number">` to the `NumberInput` primitive. Per the BL-0781 audit
 * (docs/audits/bl-0781-number-input-audit.md, "Component-editor + views" table,
 * DRCPanel.tsx row), the Action is OMIT-MAX — no coded ceiling exists for DRC rule
 * parameters (clearance/trace-width/etc), so both `max`/`aria-valuemax` and
 * `min`/`aria-valuemin` must be absent, which is itself the E2E-236/271/284 fix
 * (Chromium no longer synthesizes `aria-valuemax="0"`).
 */

// @vitest-environment happy-dom

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DRCRule, DRCViolation } from '@shared/component-types';

import DRCPanel from '../DRCPanel';

function makeRule(overrides: Partial<DRCRule> = {}): DRCRule {
  return {
    type: 'min-clearance',
    params: { clearance: 0.2 },
    severity: 'error',
    enabled: true,
    ...overrides,
  };
}

function renderPanel(rules: DRCRule[], violations: DRCViolation[] = []) {
  return render(
    <DRCPanel
      violations={violations}
      onRunDRC={vi.fn()}
      showOverlays={false}
      onToggleOverlays={vi.fn()}
      onHighlight={vi.fn()}
      rules={rules}
      onUpdateRule={vi.fn()}
    />,
  );
}

describe('DRCPanel — rule param NumberInput ARIA contract (BL-0781)', () => {
  it('renders the rule param input as a spinbutton (input[type="number"])', () => {
    renderPanel([makeRule()]);
    fireEvent.click(screen.getByTestId('button-toggle-drc-rules'));
    const el = screen.getByTestId('input-rule-min-clearance-clearance');
    expect(el.getAttribute('type')).toBe('number');
  });

  it('OMIT-MAX: omits aria-valuemax and the HTML max attribute (no coded ceiling)', () => {
    renderPanel([makeRule()]);
    fireEvent.click(screen.getByTestId('button-toggle-drc-rules'));
    const el = screen.getByTestId('input-rule-min-clearance-clearance');
    expect(el.hasAttribute('aria-valuemax')).toBe(false);
    expect(el.hasAttribute('max')).toBe(false);
  });

  it('OMIT-MAX: omits aria-valuemin and the HTML min attribute (no bound passed)', () => {
    renderPanel([makeRule()]);
    fireEvent.click(screen.getByTestId('button-toggle-drc-rules'));
    const el = screen.getByTestId('input-rule-min-clearance-clearance');
    expect(el.hasAttribute('aria-valuemin')).toBe(false);
    expect(el.hasAttribute('min')).toBe(false);
  });

  it('mirrors the current param value onto aria-valuenow', () => {
    renderPanel([makeRule({ params: { clearance: 0.35 } })]);
    fireEvent.click(screen.getByTestId('button-toggle-drc-rules'));
    const el = screen.getByTestId('input-rule-min-clearance-clearance');
    expect(el.getAttribute('aria-valuenow')).toBe('0.35');
  });

  it('regression guard: never coerces the missing max to aria-valuemax="0"', () => {
    renderPanel([makeRule()]);
    fireEvent.click(screen.getByTestId('button-toggle-drc-rules'));
    const el = screen.getByTestId('input-rule-min-clearance-clearance');
    expect(el.getAttribute('aria-valuemax')).not.toBe('0');
  });

  it('preserves the tight toolbar className (w-12 h-4 text-[9px]) — visual-risk instance', () => {
    renderPanel([makeRule()]);
    fireEvent.click(screen.getByTestId('button-toggle-drc-rules'));
    const el = screen.getByTestId('input-rule-min-clearance-clearance');
    expect(el.className).toContain('w-12');
    expect(el.className).toContain('h-4');
    expect(el.className).toContain('text-[9px]');
  });
});
