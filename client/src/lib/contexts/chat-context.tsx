import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ChatMessage } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';

export interface ChatBranch {
  branchId: string;
  parentMessageId: number | null;
  messageCount: number;
  createdAt: string | null;
}

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage | string) => void;
  isGenerating: boolean;
  setIsGenerating: (bg: boolean) => void;
  activeBranchId: string | null;
  setActiveBranchId: (branchId: string | null) => void;
  branches: ChatBranch[];
  createBranch: (parentMessageId: number) => Promise<{ branchId: string }>;
  isBranchesLoading: boolean;
}

const ChatContext = createContext<ChatState | undefined>(undefined);

export function ChatProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const projectId = useProjectId();
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

  const chatQueryKey = activeBranchId
    ? `/api/projects/${projectId}/chat?branchId=${activeBranchId}`
    : `/api/projects/${projectId}/chat`;

  const chatQuery = useQuery({
    queryKey: [chatQueryKey],
    enabled: seeded,
    select: (response: { data: Array<{ id: number | string; role: string; content: string; timestamp: string; mode?: ChatMessage['mode'] }>; total: number }) => response.data.map((msg): ChatMessage => ({
      id: String(msg.id),
      role: msg.role as ChatMessage['role'],
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
      mode: msg.mode,
    })),
  });

  const branchesQuery = useQuery({
    queryKey: [`/api/projects/${projectId}/chat/branches`],
    enabled: seeded,
    select: (response: { data: ChatBranch[]; total: number }) => response.data,
  });

  const addChatMutation = useMutation({
    mutationFn: async (msg: { role: string; content: string; mode?: string; branchId?: string | null }) => {
      await apiRequest('POST', `/api/projects/${projectId}/chat`, msg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [chatQueryKey] });
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/chat/branches`] });
    },
  });

  const createBranchMutation = useMutation({
    mutationFn: async (parentMessageId: number) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/chat/branches`, { parentMessageId });
      return res.json() as Promise<{ branchId: string; parentMessageId: number }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/chat/branches`] });
    },
  });

  const addMessage = useCallback((msg: ChatMessage | string) => {
    if (typeof msg === 'string') {
      addChatMutation.mutate({ role: 'user', content: msg, branchId: activeBranchId });
    } else {
      addChatMutation.mutate({ role: msg.role, content: msg.content, mode: msg.mode, branchId: activeBranchId });
    }
  }, [addChatMutation, activeBranchId]);

  const createBranch = useCallback(async (parentMessageId: number) => {
    const result = await createBranchMutation.mutateAsync(parentMessageId);
    setActiveBranchId(result.branchId);
    return { branchId: result.branchId };
  }, [createBranchMutation]);

  const messages = chatQuery.data ?? [];
  const branches = branchesQuery.data ?? [];

  const contextValue = useMemo(() => ({
    messages,
    addMessage,
    isGenerating,
    setIsGenerating,
    activeBranchId,
    setActiveBranchId,
    branches,
    createBranch,
    isBranchesLoading: branchesQuery.isLoading,
  }), [messages, addMessage, isGenerating, setIsGenerating, activeBranchId, setActiveBranchId, branches, createBranch, branchesQuery.isLoading]);

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
}
