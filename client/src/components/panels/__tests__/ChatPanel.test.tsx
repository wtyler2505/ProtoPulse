import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// -------------------------------------------------------------------
// Mocks — ChatPanel uses many contexts and sub-components
// -------------------------------------------------------------------

const mockAddMessage = vi.fn();
const mockSetIsGenerating = vi.fn();
const mockRunValidation = vi.fn();
const mockAddValidationIssue = vi.fn();
const mockDeleteValidationIssue = vi.fn();
const mockSetNodes = vi.fn();
const mockSetEdges = vi.fn();
const mockCaptureSnapshot = vi.fn();
const mockGetChangeDiff = vi.fn().mockReturnValue('');
const mockAddBomItem = vi.fn();
const mockDeleteBomItem = vi.fn();
const mockUpdateBomItem = vi.fn();
const mockSetActiveView = vi.fn();
const mockSetActiveSheetId = vi.fn();
const mockSetProjectName = vi.fn();
const mockSetProjectDescription = vi.fn();
const mockAddToHistory = vi.fn();
const mockAddOutputLog = vi.fn();
const mockExecuteAIActions = vi.fn();

let mockMessages: Array<{
  id: string;
  role: string;
  content: string;
  timestamp: number;
  isError?: boolean;
}> = [];
let mockIsGenerating = false;

vi.mock('@/lib/contexts/chat-context', () => ({
  useChat: () => ({
    messages: mockMessages,
    addMessage: mockAddMessage,
    isGenerating: mockIsGenerating,
    setIsGenerating: mockSetIsGenerating,
  }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({
    runValidation: mockRunValidation,
    addValidationIssue: mockAddValidationIssue,
    deleteValidationIssue: mockDeleteValidationIssue,
    issues: [],
  }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    nodes: [],
    edges: [],
    selectedNodeId: null,
    captureSnapshot: mockCaptureSnapshot,
    getChangeDiff: mockGetChangeDiff,
  }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({
    bom: [],
    addBomItem: mockAddBomItem,
    deleteBomItem: mockDeleteBomItem,
    updateBomItem: mockUpdateBomItem,
  }),
}));

vi.mock('@/lib/contexts/project-meta-context', () => ({
  useProjectMeta: () => ({
    activeView: 'architecture',
    setActiveView: mockSetActiveView,
    activeSheetId: 'top',
    setActiveSheetId: mockSetActiveSheetId,
    projectName: 'TestProject',
    setProjectName: mockSetProjectName,
    projectDescription: 'Test description',
    setProjectDescription: mockSetProjectDescription,
  }),
}));

vi.mock('@/lib/contexts/history-context', () => ({
  useHistory: () => ({
    addToHistory: mockAddToHistory,
  }),
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({
    addOutputLog: mockAddOutputLog,
  }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/hooks/useChatSettings', () => ({
  useChatSettings: () => ({
    aiProvider: 'anthropic',
    setAiProvider: vi.fn(),
    aiModel: 'claude-sonnet-4-5-20250514',
    setAiModel: vi.fn(),
    aiTemperature: 0.7,
    setAiTemperature: vi.fn(),
    customSystemPrompt: '',
    setCustomSystemPrompt: vi.fn(),
    routingStrategy: 'user',
    setRoutingStrategy: vi.fn(),
  }),
}));

vi.mock('@/lib/clipboard', () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock('@/lib/queryClient', () => ({
  queryClient: { invalidateQueries: vi.fn() },
}));

// Mock the action executor
vi.mock('@/components/panels/chat/hooks/useActionExecutor', () => ({
  useActionExecutor: () => mockExecuteAIActions,
}));

// Mock parseLocalIntent
vi.mock('@/components/panels/chat/parseLocalIntent', () => ({
  parseLocalIntent: vi.fn().mockReturnValue({ actions: [], response: 'Local response' }),
}));

// Mock virtualizer since happy-dom lacks layout
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 120,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        start: i * 120,
        size: 120,
        key: i,
      })),
    measureElement: vi.fn(),
    scrollToIndex: vi.fn(),
  }),
}));

// Mock sub-components to reduce coupling
vi.mock('@/components/panels/chat/ChatHeader', () => ({
  default: ({
    onSearch,
    onSettings,
    onClose,
    onExport,
  }: {
    onSearch: () => void;
    onSettings: () => void;
    onClose: () => void;
    onExport: () => void;
  }) => (
    <div data-testid="chat-header">
      <button data-testid="chat-search-toggle" onClick={onSearch}>Search</button>
      <button data-testid="settings-button" onClick={onSettings}>Settings</button>
      <button data-testid="chat-close" onClick={onClose}>Close</button>
      <button data-testid="chat-export" onClick={onExport}>Export</button>
    </div>
  ),
}));

vi.mock('@/components/panels/chat/ChatSearchBar', () => ({
  default: ({
    value,
    onChange,
    visible,
  }: {
    value: string;
    onChange: (v: string) => void;
    visible: boolean;
  }) =>
    visible ? (
      <input
        data-testid="chat-search-bar"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ) : null,
}));

vi.mock('@/components/panels/chat/StreamingIndicator', () => ({
  default: ({ onCancel }: { onCancel: () => void }) => (
    <div data-testid="streaming-indicator">
      <button data-testid="cancel-request" onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

vi.mock('@/components/panels/chat/FollowUpSuggestions', () => ({
  default: ({
    suggestions,
    onSuggest,
  }: {
    suggestions: string[];
    onSuggest: (s: string) => void;
  }) => (
    <div data-testid="follow-up-suggestions">
      {suggestions.map((s: string) => (
        <button key={s} data-testid={`suggestion-${s.toLowerCase().replace(/\s+/g, '-')}`} onClick={() => onSuggest(s)}>
          {s}
        </button>
      ))}
    </div>
  ),
}));

vi.mock('@/components/panels/chat/MessageBubble', () => ({
  default: ({ msg }: { msg: { id: string; role: string; content: string } }) => (
    <div data-testid={`message-${msg.id}`} data-role={msg.role}>
      {msg.content}
    </div>
  ),
}));

vi.mock('@/components/panels/chat/MessageInput', () => ({
  default: ({
    input,
    onInputChange,
    onSend,
    isGenerating: isGen,
    onOpenSettings,
  }: {
    input: string;
    onInputChange: (v: string) => void;
    onSend: () => void;
    isGenerating: boolean;
    onOpenSettings?: () => void;
  }) => (
    <div data-testid="message-input">
      <textarea
        data-testid="chat-input"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
      />
      <button data-testid="send-button" onClick={onSend} disabled={isGen || !input.trim()}>
        Send
      </button>
      {onOpenSettings && (
        <button data-testid="configure-api-key-link" onClick={onOpenSettings}>
          Configure
        </button>
      )}
    </div>
  ),
}));

vi.mock('@/components/panels/chat/SettingsPanel', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="settings-panel">
      <button data-testid="close-settings" onClick={onClose}>Close</button>
    </div>
  ),
}));

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

import ChatPanel from '@/components/panels/ChatPanel';

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

function renderChatPanel(props: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
  const qc = createTestQueryClient();
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    collapsed: false,
    width: 350,
    onToggleCollapse: vi.fn(),
  };
  return render(
    <QueryClientProvider client={qc}>
      <ChatPanel {...defaultProps} {...props} />
    </QueryClientProvider>,
  );
}

// -------------------------------------------------------------------
// Tests
// -------------------------------------------------------------------

describe('ChatPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMessages = [];
    mockIsGenerating = false;
  });

  it('renders collapsed state with "AI Assistant" label', () => {
    renderChatPanel({ collapsed: true });
    expect(screen.getByTestId('chat-collapsed')).toBeDefined();
    expect(screen.getByText('AI Assistant')).toBeDefined();
  });

  it('clicking collapsed chat calls onToggleCollapse', () => {
    const onToggle = vi.fn();
    renderChatPanel({ collapsed: true, onToggleCollapse: onToggle });
    fireEvent.click(screen.getByTestId('chat-collapsed'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders expanded panel with header, message input, and empty state', () => {
    renderChatPanel();
    expect(screen.getByTestId('chat-header')).toBeDefined();
    expect(screen.getByTestId('message-input')).toBeDefined();
    // Empty state should show suggestion buttons
    expect(screen.getByText(/Ask ProtoPulse AI/)).toBeDefined();
  });

  it('shows mobile backdrop when open and calls onClose on click', () => {
    const onClose = vi.fn();
    renderChatPanel({ onClose });
    const backdrop = screen.getByTestId('chat-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('typing in textarea and pressing Enter triggers handleSend', () => {
    renderChatPanel();
    const textarea = screen.getByTestId('chat-input');
    fireEvent.change(textarea, { target: { value: 'Hello AI' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    // handleSend should add a user message (via the mock)
    expect(mockAddMessage).toHaveBeenCalled();
    expect(mockSetIsGenerating).toHaveBeenCalledWith(true);
  });

  it('renders message bubbles when messages exist', () => {
    mockMessages = [
      { id: 'msg-1', role: 'user', content: 'Hi there', timestamp: Date.now() },
      { id: 'msg-2', role: 'assistant', content: 'Hello!', timestamp: Date.now() },
    ];
    renderChatPanel();
    expect(screen.getByTestId('message-msg-1')).toBeDefined();
    expect(screen.getByTestId('message-msg-2')).toBeDefined();
    expect(screen.getByText('Hi there')).toBeDefined();
    expect(screen.getByText('Hello!')).toBeDefined();
  });

  it('shows streaming indicator when isGenerating is true', () => {
    mockIsGenerating = true;
    renderChatPanel();
    expect(screen.getByTestId('streaming-indicator')).toBeDefined();
  });

  it('settings toggle opens settings panel', () => {
    renderChatPanel();
    expect(screen.queryByTestId('settings-panel')).toBeNull();
    const settingsBtn = screen.getByTestId('settings-button');
    fireEvent.click(settingsBtn);
    expect(screen.getByTestId('settings-panel')).toBeDefined();
  });

  it('settings panel close button hides settings', () => {
    renderChatPanel();
    fireEvent.click(screen.getByTestId('settings-button'));
    expect(screen.getByTestId('settings-panel')).toBeDefined();
    fireEvent.click(screen.getByTestId('close-settings'));
    expect(screen.queryByTestId('settings-panel')).toBeNull();
  });

  it('search toggle shows search bar', () => {
    renderChatPanel();
    expect(screen.queryByTestId('chat-search-bar')).toBeNull();
    fireEvent.click(screen.getByTestId('chat-search-toggle'));
    expect(screen.getByTestId('chat-search-bar')).toBeDefined();
  });

  it('empty state suggestion buttons trigger handleSend', () => {
    renderChatPanel();
    const genBtn = screen.getByTestId('empty-suggestion-generate-architecture');
    fireEvent.click(genBtn);
    expect(mockAddMessage).toHaveBeenCalled();
    expect(mockSetIsGenerating).toHaveBeenCalledWith(true);
  });
});
