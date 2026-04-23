import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SnippetLibrary } from '@/lib/design-reuse';

import DesignPatternsView from '../DesignPatternsView';

describe('DesignPatternsView empty-state regressions (E2E-966)', () => {
  beforeEach(() => {
    localStorage.clear();
    SnippetLibrary.resetForTesting();
  });

  it('snippets tab empty-state does not leak into the DOM when snippets are populated', async () => {
    render(<DesignPatternsView />);

    fireEvent.mouseDown(screen.getByTestId('tab-snippets'), { button: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('snippets-grid')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('empty-state-title')).toBeNull();
  });
});
