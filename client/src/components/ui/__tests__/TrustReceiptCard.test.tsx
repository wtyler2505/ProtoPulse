import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import TrustReceiptCard from '@/components/ui/TrustReceiptCard';

describe('TrustReceiptCard', () => {
  it('renders label, summary, facts, warnings, and next step', () => {
    render(
      <TrustReceiptCard
        receipt={{
          title: 'Simulation trust ladder',
          status: 'caution',
          label: 'Model-limited',
          summary: 'Use this for comparison, not sign-off.',
          facts: [
            { label: 'Circuit', value: 'Main Board' },
            { label: 'Analysis', value: 'Transient' },
          ],
          warnings: ['No external verification yet.'],
          nextStep: 'Bench-test the critical nodes.',
        }}
        data-testid="trust-card"
      />,
    );

    expect(screen.getByTestId('trust-card')).toBeInTheDocument();
    expect(screen.getByText('Simulation trust ladder')).toBeInTheDocument();
    expect(screen.getByText('Model-limited')).toBeInTheDocument();
    expect(screen.getByText('Use this for comparison, not sign-off.')).toBeInTheDocument();
    expect(screen.getByText('Circuit')).toBeInTheDocument();
    expect(screen.getByText('Main Board')).toBeInTheDocument();
    expect(screen.getByText('- No external verification yet.')).toBeInTheDocument();
    expect(screen.getByText('Next step: Bench-test the critical nodes.')).toBeInTheDocument();
  });
});
