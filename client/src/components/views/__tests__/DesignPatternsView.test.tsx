import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import DesignPatternsView from '../DesignPatternsView';
import { SnippetLibrary } from '@/lib/design-reuse';

describe('DesignPatternsView', () => {
  beforeEach(() => {
    localStorage.clear();
    SnippetLibrary.resetForTesting();
  });

  it('creates a snippet, closes the dialog, and resets the form for the next create flow', async () => {
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
