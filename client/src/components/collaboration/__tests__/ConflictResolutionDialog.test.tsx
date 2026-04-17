/**
 * BL-0524: UI tests for ConflictResolutionDialog.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Conflict } from '@shared/collaboration';
import { ConflictResolutionDialog } from '../ConflictResolutionDialog';

function makeConflict(id = 'c1'): Conflict {
  return {
    id,
    projectId: 1,
    kind: 'lww-update',
    path: ['nodes'],
    key: 'n1',
    yourOp: {
      op: 'update', path: ['nodes'], key: 'n1',
      value: { label: 'mine' }, timestamp: 5, clientId: 42,
    },
    theirOp: {
      op: 'update', path: ['nodes'], key: 'n1',
      value: { label: 'theirs' }, timestamp: 10, clientId: 2,
    },
    detectedAt: 10,
  };
}

describe('ConflictResolutionDialog', () => {
  it('renders your version and their version side-by-side', () => {
    render(
      <ConflictResolutionDialog
        conflicts={[makeConflict()]}
        open
        onOpenChange={() => { /* noop */ }}
        onResolve={() => { /* noop */ }}
      />,
    );

    expect(screen.getByTestId('conflict-resolution-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-your-version').textContent).toContain('mine');
    expect(screen.getByTestId('conflict-their-version').textContent).toContain('theirs');
  });

  it('invokes onResolve with mine when Accept mine is clicked', () => {
    const onResolve = vi.fn();
    render(
      <ConflictResolutionDialog
        conflicts={[makeConflict('c1')]}
        open
        onOpenChange={() => { /* noop */ }}
        onResolve={onResolve}
      />,
    );
    fireEvent.click(screen.getByTestId('conflict-accept-mine'));
    expect(onResolve).toHaveBeenCalledWith('c1', 'mine');
  });

  it('invokes onResolve with theirs when Accept theirs is clicked', () => {
    const onResolve = vi.fn();
    render(
      <ConflictResolutionDialog
        conflicts={[makeConflict('c2')]}
        open
        onOpenChange={() => { /* noop */ }}
        onResolve={onResolve}
      />,
    );
    fireEvent.click(screen.getByTestId('conflict-accept-theirs'));
    expect(onResolve).toHaveBeenCalledWith('c2', 'theirs');
  });

  it('invokes onResolve with merge and the parsed custom value', () => {
    const onResolve = vi.fn();
    render(
      <ConflictResolutionDialog
        conflicts={[makeConflict('c3')]}
        open
        onOpenChange={() => { /* noop */ }}
        onResolve={onResolve}
      />,
    );
    const draft = screen.getByTestId('conflict-merge-draft') as HTMLTextAreaElement;
    fireEvent.change(draft, { target: { value: '{"label":"merged"}' } });
    fireEvent.click(screen.getByTestId('conflict-custom-merge'));
    expect(onResolve).toHaveBeenCalledWith('c3', 'merge', { label: 'merged' });
  });

  it('renders nothing when there are no conflicts', () => {
    const { container } = render(
      <ConflictResolutionDialog
        conflicts={[]}
        open
        onOpenChange={() => { /* noop */ }}
        onResolve={() => { /* noop */ }}
      />,
    );
    expect(container.textContent).toBe('');
  });
});
