import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { InspectorPanel } from '../InspectorPanel';

import type { SelectionDetails } from '../../model/scene-lookup';

const COMPONENT_DETAILS: SelectionDetails = {
  kind: 'component',
  title: 'U1',
  subtitle: 'SOIC-8',
  fields: [
    { label: 'Reference', value: 'U1' },
    { label: 'Package', value: 'SOIC-8' },
    { label: 'Value', value: '10k' },
    { label: 'Datasheet', value: 'open datasheet', href: 'https://example.com/ds.pdf' },
  ],
};

describe('InspectorPanel', () => {
  it('renders nothing without details', () => {
    render(<InspectorPanel details={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('inspector-panel')).toBeNull();
  });

  it('renders title, subtitle, and fields for a picked component', () => {
    render(<InspectorPanel details={COMPONENT_DETAILS} onClose={vi.fn()} />);
    expect(screen.getByTestId('inspector-title').textContent).toBe('U1');
    expect(screen.getByTestId('inspector-subtitle').textContent).toBe('SOIC-8');
    expect(screen.getByTestId('inspector-field-value').textContent).toContain('10k');
    expect(screen.getByTestId('inspector-field-reference').textContent).toContain('U1');
  });

  it('renders href fields as external links', () => {
    render(<InspectorPanel details={COMPONENT_DETAILS} onClose={vi.fn()} />);
    const link = screen.getByRole('link', { name: 'open datasheet' });
    expect(link.getAttribute('href')).toBe('https://example.com/ds.pdf');
    expect(link.getAttribute('target')).toBe('_blank');
  });

  it('invokes onClose from the close button', () => {
    const onClose = vi.fn();
    render(<InspectorPanel details={COMPONENT_DETAILS} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('inspector-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes an accessible region labelled by the selection', () => {
    render(<InspectorPanel details={COMPONENT_DETAILS} onClose={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'Inspector: U1' })).toBeTruthy();
  });
});
