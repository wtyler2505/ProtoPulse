import { createContext, useContext, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ChatMessage } from '@/lib/project-context';

const PROJECT_ID = 1;

interface ChatState {
  messages: ChatMessage[];
  addMessage: (msg: ChatMessage | string) => void;
  isGenerating: boolean;
  setIsGenerating: (bg: boolean) => void;
}

const ChatContext = createContext<ChatState | undefined>(undefined);

export function ChatProvider({ seeded, children }: { seeded: boolean; children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const chatQuery = useQuery({
    queryKey: [`/api/projects/${PROJECT_ID}/chat`],
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
      await apiRequest('POST', `/api/projects/${PROJECT_ID}/chat`, msg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${PROJECT_ID}/chat`] });
    },
  });

  const addMessage = useCallback((msg: ChatMessage | string) => {
    if (typeof msg === 'string') {
      addChatMutation.mutate({ role: 'user', content: msg });
    } else {
      addChatMutation.mutate({ role: msg.role, content: msg.content, mode: msg.mode });
    }
  }, [addChatMutation]);

  return (
    <ChatContext.Provider value={{
      messages: chatQuery.data ?? [],
      addMessage,
      isGenerating,
      setIsGenerating,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within ChatProvider');
  return context;
}
