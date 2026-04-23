import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { SnippetLibrary } from '@/lib/design-reuse';

import DesignPatternsView from '../DesignPatternsView';

describe('DesignPatternsView', () => {
  beforeEach(() => {
    localStorage.clear();
    SnippetLibrary.resetForTesting();
  });

  it('patterns tab empty-state does not leak into the DOM when patterns are populated (E2E-966)', () => {
    render(<DesignPatternsView />);

    expect(screen.getByTestId('pattern-group-power')).toBeInTheDocument();
    expect(screen.queryByTestId('empty-state-title')).toBeNull();
  });

  // Under full parallel test load (~29k tests), the React render + async waits can exceed the
  // default 5s timeout even though the test completes in ~1.4s when run in isolation. Bumping
  // to 15s removes the flakiness without masking a real bug.
  it('creates a snippet, closes the dialog, and resets the form for the next create flow', { timeout: 15000 }, async () => {
    render(<DesignPatternsView />);

    fireEvent.mouseDown(screen.getByTestId('tab-snippets'), { button: 0 });

    await waitFor(() => {
      expect(screen.getByTestId('snippets-create-btn')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('snippets-create-btn'));

    fireEvent.change(screen.getByTestId('snippet-form-name'), {
      target: { value: 'Audit Test Snippet' },
    });
    fireEvent.change(screen.getByTestId('snippet-form-description'), {
      target: { value: 'Created by the focused Design Patterns test.' },
    });

    fireEvent.click(screen.getByTestId('snippet-form-save'));

    await waitFor(() => {
      expect(screen.queryByTestId('snippet-form-dialog')).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('snippets-grid')).toHaveTextContent('Audit Test Snippet');
    expect(screen.getByText('Showing 6 of 6 snippets')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('snippets-create-btn'));

    expect(screen.getByTestId('snippet-form-name')).toHaveValue('');
    expect(screen.getByTestId('snippet-form-description')).toHaveValue('');
  });
});
