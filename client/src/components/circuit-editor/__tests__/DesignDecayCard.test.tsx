import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import DesignDecayCard from '@/components/circuit-editor/DesignDecayCard';

describe('DesignDecayCard', () => {
  it('renders the single next-best action and metadata', () => {
    render(
      <DesignDecayCard
        recommendation={{
          consequenceSpeed: 'session',
          score: 120,
          action: 'Resolve competing output drivers on the same net.',
          violation: {
            id: 'erc-1',
            ruleType: 'driver-conflict',
            severity: 'error',
            message: 'Two outputs drive NET_MAIN',
            location: { x: 5, y: 8 },
          },
        }}
      />,
    );

    expect(screen.getByTestId('design-decay-card')).toBeInTheDocument();
    expect(screen.getByTestId('design-decay-message').textContent).toContain('Two outputs drive NET_MAIN');
    expect(screen.getByTestId('design-decay-action').textContent).toContain('Resolve competing output drivers');
    expect(screen.getByTestId('design-decay-score').textContent).toContain('120');
  });
});

