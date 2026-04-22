import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardView from '../DashboardView';

/**
 * E2E-015 regression: the Dashboard's "All Checks Passing" indicator MUST NOT
 * render on an empty project. Empty designs have nothing to validate, so the
 * correct state is "No design to validate yet — add components to begin".
 *
 * The fix derives `hasDesign` from architecture nodes + BOM items, and gates
 * `allPassing` on it. A new `noDesign` state renders a neutral message.
 */

// Mock all contexts DashboardView depends on. Per-test override via vi.mocked().
const mockUseArchitecture = vi.fn();
const mockUseBom = vi.fn();
const mockUseValidation = vi.fn();
const mockUseHistory = vi.fn();
const mockUseProjectMeta = vi.fn();

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => mockUseArchitecture(),
}));
vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => mockUseBom(),
}));
vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => mockUseValidation(),
}));
vi.mock('@/lib/contexts/history-context', () => ({
  useHistory: () => mockUseHistory(),
}));
vi.mock('@/lib/project-context', () => ({
  useProjectMeta: () => mockUseProjectMeta(),
}));

function seedDefaults({
  nodes = [] as Array<{ id: string; data: Record<string, unknown> }>,
  bom = [] as Array<{ quantity: number; totalPrice: number; status: 'In Stock' | 'Low Stock' | 'Out of Stock' | 'On Order' }>,
  issues = [] as Array<{ severity: 'error' | 'warning' | 'info' }>,
} = {}) {
  mockUseArchitecture.mockReturnValue({ nodes, edges: [] });
  mockUseBom.mockReturnValue({ bom });
  mockUseValidation.mockReturnValue({ issues });
  mockUseHistory.mockReturnValue({ history: [] });
  mockUseProjectMeta.mockReturnValue({
    projectName: 'Test Project',
    projectDescription: '',
    setActiveView: vi.fn(),
  });
}

describe('DashboardView validation indicator (E2E-015)', () => {
  it('shows "No design to validate yet" on an empty project (no nodes, no BOM, no issues)', () => {
    seedDefaults();
    render(<DashboardView />);
    const indicator = screen.getByTestId('validation-status-indicator');
    expect(indicator.textContent).toMatch(/no design to validate yet/i);
    expect(indicator.textContent).not.toMatch(/all checks passing/i);
  });

  it('shows "All Checks Passing" only when design exists AND issues are empty', () => {
    seedDefaults({
      nodes: [{ id: 'n1', data: { type: 'microcontroller' } }],
      issues: [],
    });
    render(<DashboardView />);
    const indicator = screen.getByTestId('validation-status-indicator');
    expect(indicator.textContent).toMatch(/all checks passing/i);
  });

  it('shows "Issues Found" when design exists AND errors are present', () => {
    seedDefaults({
      nodes: [{ id: 'n1', data: { type: 'microcontroller' } }],
      issues: [{ severity: 'error' }],
    });
    render(<DashboardView />);
    const indicator = screen.getByTestId('validation-status-indicator');
    expect(indicator.textContent).toMatch(/issues found/i);
  });

  it('also treats BOM-only projects as "has design" (no nodes but BOM items present)', () => {
    seedDefaults({
      bom: [{ quantity: 1, totalPrice: 0.5, status: 'In Stock' }],
      issues: [],
    });
    render(<DashboardView />);
    const indicator = screen.getByTestId('validation-status-indicator');
    expect(indicator.textContent).toMatch(/all checks passing/i);
  });
});
