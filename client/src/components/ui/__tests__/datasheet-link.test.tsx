import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock lucide-react icons to simple SVG elements
vi.mock('lucide-react', () => ({
  ExternalLink: (props: Record<string, unknown>) => <svg data-testid="icon-external-link" {...props} />,
  Search: (props: Record<string, unknown>) => <svg data-testid="icon-search" {...props} />,
}));

import DatasheetLink from '@/components/ui/DatasheetLink';

describe('DatasheetLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a link when datasheetUrl is provided', () => {
    render(<DatasheetLink datasheetUrl="https://example.com/datasheet.pdf" />);

    const link = screen.getByTestId('datasheet-link');
    expect(link).toBeDefined();
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('https://example.com/datasheet.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Datasheet')).toBeDefined();
  });

  it('renders link with noopener noreferrer rel attribute', () => {
    render(<DatasheetLink datasheetUrl="https://example.com/datasheet.pdf" />);

    const link = screen.getByTestId('datasheet-link');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders "No datasheet" when no URL is provided', () => {
    render(<DatasheetLink />);

    expect(screen.getByText('No datasheet')).toBeDefined();
    expect(screen.queryByTestId('datasheet-link')).toBeNull();
  });

  it('renders "No datasheet" when datasheetUrl is null', () => {
    render(<DatasheetLink datasheetUrl={null} />);

    expect(screen.getByText('No datasheet')).toBeDefined();
    expect(screen.queryByTestId('datasheet-link')).toBeNull();
  });

  it('does not render Find button when onLookup is not provided', () => {
    render(<DatasheetLink />);

    expect(screen.queryByTestId('datasheet-find-button')).toBeNull();
  });

  it('renders Find button when onLookup is provided and no URL', () => {
    const onLookup = vi.fn();
    render(<DatasheetLink onLookup={onLookup} />);

    const findBtn = screen.getByTestId('datasheet-find-button');
    expect(findBtn).toBeDefined();
    expect(screen.getByText('Find')).toBeDefined();
  });

  it('calls onLookup when Find button is clicked', () => {
    const onLookup = vi.fn();
    render(<DatasheetLink onLookup={onLookup} />);

    const findBtn = screen.getByTestId('datasheet-find-button');
    fireEvent.click(findBtn);
    expect(onLookup).toHaveBeenCalledTimes(1);
  });

  it('does not render Find button when datasheetUrl is set (even if onLookup provided)', () => {
    const onLookup = vi.fn();
    render(<DatasheetLink datasheetUrl="https://example.com/ds.pdf" onLookup={onLookup} />);

    expect(screen.queryByTestId('datasheet-find-button')).toBeNull();
    expect(screen.getByTestId('datasheet-link')).toBeDefined();
  });
});
