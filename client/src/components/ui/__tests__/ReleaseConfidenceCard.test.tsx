import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import ReleaseConfidenceCard from '@/components/ui/ReleaseConfidenceCard';
import type { ScorecardResult } from '@/lib/risk-scorecard';

const baseResult: ScorecardResult = {
  overallScore: 84,
  readiness: 'green',
  categories: [],
  timestamp: 0,
  confidence: {
    band: 'review',
    label: 'Review-ready',
    evidenceStrength: 'partial',
    evidenceLabel: 'Evidence partial',
    summary: 'Most visible release signals look healthy.',
    blockers: ['No DRC errors: 1 DRC error found.'],
    nextActions: ['Resolve all DRC errors before ordering.'],
    sourceNote: 'Based on visible workspace signals.',
  },
};

describe('ReleaseConfidenceCard', () => {
  it('renders confidence labels, source notes, and action guidance', () => {
    render(
      <ReleaseConfidenceCard
        result={baseResult}
        title="Export Release Confidence"
        sourceNote="Export-specific source note."
      />,
    );

    expect(screen.getByTestId('release-confidence-title')).toHaveTextContent('Export Release Confidence');
    expect(screen.getByTestId('release-confidence-source')).toHaveTextContent('Export-specific source note.');
    expect(screen.getByTestId('release-confidence-band')).toHaveTextContent('Review-ready');
    expect(screen.getByTestId('release-confidence-evidence')).toHaveTextContent('Evidence partial');
    expect(screen.getByTestId('release-confidence-blockers')).toHaveTextContent('No DRC errors');
    expect(screen.getByTestId('release-confidence-actions')).toHaveTextContent('Resolve all DRC errors');
  });

  it('shows the clean-state copy when there are no major blockers', () => {
    render(
      <ReleaseConfidenceCard
        result={{
          ...baseResult,
          confidence: {
            ...baseResult.confidence,
            blockers: [],
          },
        }}
      />,
    );

    expect(screen.getByTestId('release-confidence-blockers')).toHaveTextContent(
      'No critical or major blockers are currently visible in this workspace snapshot.',
    );
  });
});
