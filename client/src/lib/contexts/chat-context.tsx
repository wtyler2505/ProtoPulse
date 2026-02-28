import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ChatMessage } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage | string) => void;
  isGenerating: boolean;
  setIsGenerating: (bg: boolean) => void;
}

const ChatContext = createContext<ChatState | undefined>(undefined);

export function ChatProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const projectId = useProjectId();
  const [isGenerating, setIsGenerating] = useState(false);

  const chatQuery = useQuery({
    queryKey: [`/api/projects/${projectId}/chat`],
    enabled: seeded,
    select: (data: Array<{ id: number | string; role: string; content: string; timestamp: string; mode?: ChatMessage['mode'] }>) => data.map((msg): ChatMessage => ({
      id: String(msg.id),
      role: msg.role as ChatMessage['role'],
      content: msg.content,
      timestamp: new Date(msg.timestamp).getTime(),
      mode: msg.mode,
    })),
  });

  const addChatMutation = useMutation({
    mutationFn: async (msg: { role: string; content: string; mode?: string }) => {
      await apiRequest('POST', `/api/projects/${projectId}/chat`, msg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/chat`] });
    },
  });

  const addMessage = useCallback((msg: ChatMessage | string) => {
    if (typeof msg === 'string') {
      addChatMutation.mutate({ role: 'user', content: msg });
    } else {
      addChatMutation.mutate({ role: msg.role, content: msg.content, mode: msg.mode });
    }
  }, [addChatMutation]);

  const messages = chatQuery.data ?? [];

  const contextValue = useMemo(() => ({
    messages,
    addMessage,
    isGenerating,
    setIsGenerating,
  }), [messages, addMessage, isGenerating, setIsGenerating]);

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
