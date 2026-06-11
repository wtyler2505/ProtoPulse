/// <reference lib="dom" />

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

/**
 * BL-0781 ARIA spinbutton contract for GenerativeDesignView.
 *
 * Audit row mapping (docs/audits/bl-0781-number-input-audit.md, T4 section):
 *   L221 population-size-input min=2, max=20 KEEP (raw <input> → NumberInput)
 *   L242 generations-input     min=1, max=50 KEEP (raw <input> → NumberInput)
 *
 * Both inputs are top-level form fields, no dialog gating needed. The view
 * uses 3 hooks (useGenerativeDesign, useArchitecture, useProjectMeta) — all
 * mocked to no-op state.
 */

vi.mock('@/lib/generative-design/generative-engine', () => ({
  useGenerativeDesign: () => ({
    state: 'idle',
    results: [],
    run: vi.fn(),
    cancel: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    nodes: [],
    edges: [],
    setNodes: vi.fn(),
    setEdges: vi.fn(),
    pushUndoState: vi.fn(),
  }),
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({ setActiveView: vi.fn() }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 44,
}));

vi.mock('@/hooks/use-toast', () => ({
  toast: vi.fn(),
  useToast: () => ({ toast: vi.fn() }),
}));

// VaultInfoIcon pulls vault data via tanstack-query. We don't need that here.
// Stub the icon to a no-op span so the form renders without QueryClientProvider.
vi.mock('@/components/ui/vault-info-icon', () => ({
  VaultInfoIcon: () => null,
}));

import GenerativeDesignView from '../GenerativeDesignView';

describe('GenerativeDesignView — BL-0781 ARIA spinbutton contract', () => {
  it('mirrors min/max on population-size-input (KEEP: 2..20)', () => {
    render(<GenerativeDesignView />);
    const input = screen.getByTestId('population-size-input') as HTMLInputElement;
    expect(input.getAttribute('aria-valuemin')).toBe('2');
    expect(input.getAttribute('aria-valuemax')).toBe('20');
    expect(input.getAttribute('min')).toBe('2');
    expect(input.getAttribute('max')).toBe('20');
  });

  it('mirrors min/max on generations-input (KEEP: 1..50)', () => {
    render(<GenerativeDesignView />);
    const input = screen.getByTestId('generations-input') as HTMLInputElement;
    expect(input.getAttribute('aria-valuemin')).toBe('1');
    expect(input.getAttribute('aria-valuemax')).toBe('50');
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('50');
  });
});
