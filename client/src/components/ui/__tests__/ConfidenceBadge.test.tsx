import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConfidenceBadge from '@/components/ui/ConfidenceBadge';

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('ConfidenceBadge', () => {
  it('renders score percent', () => {
    render(<ConfidenceBadge confidence={{ score: 88, explanation: 'Strong grounding', factors: [] }} />);
    expect(screen.getByTestId('confidence-badge').textContent).toContain('88%');
  });

  it('maps high score to VERIFIED trust', () => {
    render(<ConfidenceBadge confidence={{ score: 95, explanation: 'Strong grounding', factors: [] }} />);
    expect(screen.getByTestId('confidence-trust').textContent).toContain('VERIFIED');
  });

  it('maps medium score to ESTIMATED trust', () => {
    render(<ConfidenceBadge confidence={{ score: 60, explanation: 'Partial grounding', factors: [] }} />);
    expect(screen.getByTestId('confidence-trust').textContent).toContain('ESTIMATED');
  });

  it('maps low score to UNVERIFIED trust', () => {
    render(<ConfidenceBadge confidence={{ score: 20, explanation: 'Weak grounding', factors: [] }} />);
    expect(screen.getByTestId('confidence-trust').textContent).toContain('UNVERIFIED');
  });
});

