// @vitest-environment happy-dom

/**
 * BL-0781 — DRCPanel ARIA spinbutton contract.
 *
 * The rule-param input (originally a raw numeric input at L168) must mirror
 * its min/max constraints onto aria-valuemin/aria-valuemax so assistive tech
 * reports the actual upper bound rather than Chromium's synthesized
 * valuemax="0".
 *
 * Audit row (docs/audits/bl-0781-number-input-audit.md): ADD-MIN={0},
 * ADD-MAX={1_000_000}.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import type { DRCRule } from '@shared/component-types';

import DRCPanel from '@/components/views/component-editor/DRCPanel';

function makeRule(overrides: Partial<DRCRule> = {}): DRCRule {
  return {
    type: 'min-clearance',
    params: { clearance: 0.2 },
    severity: 'error',
    enabled: true,
    ...overrides,
  };
}

function renderPanel(rules: DRCRule[] = [makeRule()]) {
  return render(
    <DRCPanel
      violations={[]}
      onRunDRC={vi.fn()}
      showOverlays={false}
      onToggleOverlays={vi.fn()}
      onHighlight={vi.fn()}
      rules={rules}
      onUpdateRule={vi.fn()}
    />,
  );
}

describe('DRCPanel — BL-0781 ARIA spinbutton contract', () => {
  it('rule-param input mirrors min/max to aria-valuemin/aria-valuemax', async () => {
    const user = await import('@testing-library/user-event').then(m => m.default.setup());
    renderPanel();

    // Expand the rules section so the parameter inputs render.
    await user.click(screen.getByTestId('button-toggle-drc-rules'));

    const input = screen.getByTestId('input-rule-min-clearance-clearance');
    expect(input.getAttribute('aria-valuemin')).toBe('0');
    expect(input.getAttribute('aria-valuemax')).toBe('1000000');
    // HTML constraint attrs also present so Chromium does not synthesize valuemax=0.
    expect(input.getAttribute('min')).toBe('0');
    expect(input.getAttribute('max')).toBe('1000000');
  });
});
