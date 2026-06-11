import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RadialMarkingPreview from '@/components/ui/RadialMarkingPreview';

describe('RadialMarkingPreview', () => {
  it('renders the selected direction and command label', () => {
    render(
      <RadialMarkingPreview
        preview={{
          origin: { x: 100, y: 140 },
          current: { x: 100, y: 60 },
          slot: 0,
          commandId: 'add_node',
          label: 'Add Node',
        }}
      />,
    );

    expect(screen.getByTestId('radial-marking-preview')).toBeDefined();
    expect(screen.getByTestId('radial-marking-chip')).toHaveTextContent('N');
    expect(screen.getByTestId('radial-marking-label')).toHaveTextContent('Add Node');
  });

  it('shows an unavailable slot without crashing', () => {
    render(
      <RadialMarkingPreview
        preview={{
          origin: { x: 100, y: 140 },
          current: { x: 150, y: 190 },
          slot: 3,
          disabled: true,
        }}
      />,
    );

    expect(screen.getByTestId('radial-marking-chip')).toHaveTextContent('SE');
    expect(screen.getByTestId('radial-marking-label')).toHaveTextContent('No command');
  });
});
