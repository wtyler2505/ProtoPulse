import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DesignComment } from '@shared/schema';

import { CommentsPanel } from '../CommentsPanel';

const queryState = vi.hoisted(() => ({
  comments: [] as DesignComment[],
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  getQueryFn: vi.fn(() => async () => ({ data: queryState.comments, total: queryState.comments.length })),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: { children: ReactNode }) => <div {...props}>{children}</div>,
}));

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <CommentsPanel projectId={1} />
    </QueryClientProvider>,
  );
}

function makeComment(overrides: Partial<DesignComment> = {}): DesignComment {
  return {
    id: 1,
    projectId: 1,
    userId: 1,
    parentId: null,
    targetType: 'general',
    targetId: null,
    spatialX: null,
    spatialY: null,
    spatialView: null,
    content: 'Looks good',
    status: 'open',
    statusUpdatedBy: null,
    statusUpdatedAt: null,
    createdAt: new Date('2026-05-24T12:00:00.000Z'),
    updatedAt: new Date('2026-05-24T12:00:00.000Z'),
    ...overrides,
  };
}

describe('CommentsPanel accessibility', () => {
  beforeEach(() => {
    queryState.comments = [];
  });

  it('names the icon-only submit action and keeps shortcut help readable', async () => {
    renderPanel();

    expect(await screen.findByTestId('comments-empty')).toBeTruthy();

    expect(screen.getByRole('button', { name: 'Submit comment' })).toBeDisabled();
    expect(screen.getByTestId('comments-shortcut-hint').className).toContain('text-zinc-400');
  });

  it('renders spatial PCB anchors and exposes them in target filters', async () => {
    queryState.comments = [
      makeComment({
        id: 17,
        targetType: 'spatial',
        spatialView: 'pcb',
        spatialX: 42.25,
        spatialY: 128.5,
        content: 'Move this trace away from the mounting hole.',
      }),
    ];

    renderPanel();

    expect(await screen.findByTestId('comment-spatial-anchor-17')).toHaveTextContent('PCB canvas (42.3, 128.5)');
    expect(screen.getByTestId('comment-target-badge-17')).toHaveTextContent('Anchor');

    fireEvent.click(screen.getByTestId('comments-filter-toggle'));
    expect(screen.getByTestId('comments-filter-target-spatial')).toHaveTextContent('Anchors');
  });
});
