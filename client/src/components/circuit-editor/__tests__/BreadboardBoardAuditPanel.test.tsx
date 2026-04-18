/**
 * Smoke tests for BreadboardBoardAuditPanel (audit finding #336).
 * Covers: initial empty state, renders audit score, severity counts, Audit button triggers callback.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import BreadboardBoardAuditPanel from '../BreadboardBoardAuditPanel';
import type { BoardAuditSummary } from '@/lib/breadboard-board-audit';

function buildAudit(overrides: Partial<BoardAuditSummary> = {}): BoardAuditSummary {
  return {
    score: 80,
    label: 'Healthy',
    issues: [],
    stats: {
      totalInstances: 3,
      totalWires: 5,
      instancesWithIssues: 0,
      missingDecoupling: 0,
      restrictedPinUsage: 0,
      strappingPinConflicts: 0,
      wireCrossings: 0,
    },
    ...overrides,
  };
}

describe('BreadboardBoardAuditPanel', () => {
  it('renders the panel container', () => {
    render(<BreadboardBoardAuditPanel audit={null} onRunAudit={() => {}} />);
    expect(screen.getByTestId('breadboard-board-audit-panel')).toBeInTheDocument();
  });

  it('shows the empty-state prompt when no audit has been run', () => {
    render(<BreadboardBoardAuditPanel audit={null} onRunAudit={() => {}} />);
    expect(screen.getByText(/Run an audit to check board health/i)).toBeInTheDocument();
    expect(screen.queryByTestId('audit-score-badge')).toBeNull();
  });

  it('renders score badge + label when audit result provided', () => {
    const audit = buildAudit({ score: 92, label: 'Excellent' });
    render(<BreadboardBoardAuditPanel audit={audit} onRunAudit={() => {}} />);
    const badge = screen.getByTestId('audit-score-badge');
    expect(badge).toHaveTextContent('92');
    expect(screen.getByTestId('audit-label')).toHaveTextContent('Excellent');
  });

  it('fires onRunAudit when the Audit button is clicked', () => {
    const onRunAudit = vi.fn();
    render(<BreadboardBoardAuditPanel audit={null} onRunAudit={onRunAudit} />);
    fireEvent.click(screen.getByTestId('button-run-audit'));
    expect(onRunAudit).toHaveBeenCalledTimes(1);
  });

  it('renders severity counts when issues exist', () => {
    const audit = buildAudit({
      issues: [
        {
          id: 'i1',
          severity: 'critical',
          category: 'power',
          title: 'No power rails',
          detail: 'Add power',
          affectedInstanceIds: [],
          affectedPinIds: [],
        },
      ],
    });
    render(<BreadboardBoardAuditPanel audit={audit} onRunAudit={() => {}} />);
    expect(screen.getByTestId('audit-severity-counts')).toBeInTheDocument();
  });
});
