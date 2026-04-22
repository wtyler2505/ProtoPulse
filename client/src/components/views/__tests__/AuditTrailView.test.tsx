import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import AuditTrailView from '../AuditTrailView';

/**
 * Regression tests for E2E-298 / E2E-460 — Audit Trail cross-project leak.
 *
 * Root cause: AuditTrailView used to render a hardcoded DEMO_ENTRIES constant
 * that included rows attributed to "OmniTrek Nexus", "Motor Controller",
 * "ATmega328P", etc. Those rows appeared on every project (including
 * "Blink LED (Sample)"), which looked exactly like a project-scope leak
 * but was in fact placeholder demo data that never shipped.
 *
 * Until the real backend audit subsystem lands (tracked as BL-0863), the
 * view must render its existing empty-state instead of any hardcoded rows.
 */
describe('AuditTrailView (E2E-298, E2E-460)', () => {
  it('renders the empty-state when no entries are available', () => {
    render(<AuditTrailView />);

    // Empty-state container is present, entries list is not.
    expect(screen.getByTestId('audit-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('audit-entries-list')).not.toBeInTheDocument();
    expect(screen.getByText(/no audit entries found/i)).toBeInTheDocument();
  });

  it('does not render any hardcoded demo-entry labels (no cross-project leak)', () => {
    render(<AuditTrailView />);

    // These strings only existed in the old DEMO_ENTRIES constant. If any of
    // them reappear in the rendered tree, it means a placeholder regressed.
    expect(screen.queryByText(/Motor Controller/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/ATmega328P/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Power Supply/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SPI Bus/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/OmniTrek Nexus/i)).not.toBeInTheDocument();
  });

  it('reports 0 entries in the result count', () => {
    render(<AuditTrailView />);

    const count = screen.getByTestId('audit-result-count');
    expect(count.textContent).toMatch(/0\s+entries/i);
  });

  it('disables the Export CSV button when there are no entries', () => {
    render(<AuditTrailView />);

    const exportBtn = screen.getByTestId('audit-export-csv');
    expect(exportBtn).toBeDisabled();
  });
});
