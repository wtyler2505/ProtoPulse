import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrustBadge } from '@/components/ui/TrustBadge';

describe('TrustBadge', () => {
  it('renders default estimated label', () => {
    render(<TrustBadge kind="estimated" />);
    expect(screen.getByText('ESTIMATED')).toBeDefined();
  });

  it('renders default verified label', () => {
    render(<TrustBadge kind="verified" />);
    expect(screen.getByText('VERIFIED')).toBeDefined();
  });

  it('renders custom label override', () => {
    render(<TrustBadge kind="unverified" label="NEEDS REVIEW" />);
    expect(screen.getByText('NEEDS REVIEW')).toBeDefined();
  });
});

