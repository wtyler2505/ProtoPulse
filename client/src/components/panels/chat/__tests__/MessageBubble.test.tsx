import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MessageBubble from '../MessageBubble';
import type { ChatMessage } from '@/lib/project-context';
import type { PendingActionReview } from '../chat-types';

// Mock react-markdown and plugins to avoid ESM issues in tests
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <p>{children}</p>,
}));
vi.mock('remark-gfm', () => ({ default: () => undefined }));
vi.mock('rehype-sanitize', () => ({ default: () => undefined }));
vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/ui/ConfidenceBadge', () => ({
  default: () => <span data-testid="confidence-badge" />,
}));

const baseMsg: ChatMessage = {
  id: 'msg-1',
  role: 'assistant',
  content: 'Hello from AI',
  timestamp: Date.now(),
};

const defaultProps = {
  copiedId: null,
  onCopy: vi.fn(),
  isLast: false,
  pendingActions: null,
  onAcceptActions: vi.fn(),
  onRejectActions: vi.fn(),
};

describe('MessageBubble', () => {
  it('renders assistant message content', () => {
    render(<MessageBubble msg={baseMsg} {...defaultProps} />);
    expect(screen.getByText('Hello from AI')).toBeTruthy();
  });

  it('shows model info when modelId is present on message', () => {
    const msgWithModel = { ...baseMsg, modelId: 'claude-haiku-4-5-20251001' } as ChatMessage & { modelId: string };
    render(<MessageBubble msg={msgWithModel} {...defaultProps} />);
    const modelInfo = screen.getByTestId('msg-model-info');
    expect(modelInfo).toBeTruthy();
    expect(modelInfo.textContent).toContain('claude-haiku-4-5-20251001');
  });

  it('does not show model info when modelId is absent', () => {
    render(<MessageBubble msg={baseMsg} {...defaultProps} />);
    expect(screen.queryByTestId('msg-model-info')).toBeNull();
  });

  it('does not show model info for user messages even with modelId', () => {
    const userMsg = { ...baseMsg, role: 'user' as const, modelId: 'claude-haiku-4-5-20251001' } as ChatMessage & { modelId: string };
    render(<MessageBubble msg={userMsg} {...defaultProps} />);
    expect(screen.queryByTestId('msg-model-info')).toBeNull();
  });

  it('shows token info when provided', () => {
    render(
      <MessageBubble
        msg={baseMsg}
        {...defaultProps}
        tokenInfo={{ input: 100, output: 50, cost: 0.0015 }}
      />,
    );
    const tokenEl = screen.getByTestId('text-token-info');
    expect(tokenEl.textContent).toContain('150 tokens');
  });

  it('renders the AI action trust receipt inside pending review blocks', () => {
    const pendingActions: PendingActionReview = {
      messageId: baseMsg.id,
      actions: [{ type: 'update_node', label: 'Rename controller' }],
      trustReceipt: {
        title: 'AI action review receipt',
        status: 'ready',
        label: 'Review-first',
        summary: 'This proposal is staged for review before apply.',
        facts: [{ label: 'Proposed actions', value: '1' }],
        warnings: ['Grounded evidence attached.'],
        nextStep: 'Review the action list, then apply if it matches your intent.',
      },
    };

    render(
      <MessageBubble
        msg={{ ...baseMsg, actions: pendingActions.actions }}
        {...defaultProps}
        pendingActions={pendingActions}
      />,
    );

    expect(screen.getByTestId('trust-receipt-pending-actions')).toHaveTextContent('AI action review receipt');
    expect(screen.getByTestId('trust-receipt-pending-actions')).toHaveTextContent('Review-first');
  });
});
