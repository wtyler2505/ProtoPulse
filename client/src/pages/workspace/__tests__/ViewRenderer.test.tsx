import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ViewLoadingFallback } from '@/pages/workspace/ViewRenderer';

describe('ViewLoadingFallback', () => {
  it('shows a named loading state for lazy workspace views', () => {
    render(<ViewLoadingFallback activeView="architecture" />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent('Loading Architecture...');
    expect(screen.getByTestId('panel-skeleton-spinner')).toBeInTheDocument();
  });

  it('supports explicit labels for nested lazy panels', () => {
    render(<ViewLoadingFallback label="Loading activity feed..." />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading activity feed...');
  });
});
