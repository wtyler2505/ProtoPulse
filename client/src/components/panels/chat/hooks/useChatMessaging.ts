import { useReducer, useCallback } from 'react';

import type { AIAction } from '../chat-types';

interface TokenInfo {
  input: number;
  output: number;
  cost: number;
}

interface PendingActions {
  actions: AIAction[];
  messageId: string;
}

interface ChatMessagingState {
  input: string;
  chatSearch: string;
  lastUserMessage: string;
  streamingContent: string;
  pendingActions: PendingActions | null;
  copiedId: string | null;
  tokenInfo: TokenInfo | null;
}

type ChatMessagingAction =
  | { type: 'SET_INPUT'; payload: string }
  | { type: 'SET_INPUT_FN'; payload: (prev: string) => string }
  | { type: 'SET_CHAT_SEARCH'; payload: string }
  | { type: 'SET_LAST_USER_MESSAGE'; payload: string }
  | { type: 'SET_STREAMING_CONTENT'; payload: string }
  | { type: 'SET_PENDING_ACTIONS'; payload: PendingActions | null }
  | { type: 'SET_COPIED_ID'; payload: string | null }
  | { type: 'SET_TOKEN_INFO'; payload: TokenInfo | null }
  | { type: 'RESET_MESSAGING' };

const initialState: ChatMessagingState = {
  input: '',
  chatSearch: '',
  lastUserMessage: '',
  streamingContent: '',
  pendingActions: null,
  copiedId: null,
  tokenInfo: null,
};

function chatMessagingReducer(state: ChatMessagingState, action: ChatMessagingAction): ChatMessagingState {
  switch (action.type) {
    case 'SET_INPUT':
      return state.input === action.payload ? state : { ...state, input: action.payload };
    case 'SET_INPUT_FN':
      return { ...state, input: action.payload(state.input) };
    case 'SET_CHAT_SEARCH':
      return state.chatSearch === action.payload ? state : { ...state, chatSearch: action.payload };
    case 'SET_LAST_USER_MESSAGE':
      return state.lastUserMessage === action.payload ? state : { ...state, lastUserMessage: action.payload };
    case 'SET_STREAMING_CONTENT':
      return state.streamingContent === action.payload ? state : { ...state, streamingContent: action.payload };
    case 'SET_PENDING_ACTIONS':
      return { ...state, pendingActions: action.payload };
    case 'SET_COPIED_ID':
      return state.copiedId === action.payload ? state : { ...state, copiedId: action.payload };
    case 'SET_TOKEN_INFO':
      return { ...state, tokenInfo: action.payload };
    case 'RESET_MESSAGING':
      return { ...initialState };
  }
}

export default function useChatMessaging() {
  const [state, dispatch] = useReducer(chatMessagingReducer, initialState);

  const setInput = useCallback((value: string | ((prev: string) => string)) => {
    if (typeof value === 'function') {
      dispatch({ type: 'SET_INPUT_FN', payload: value });
    } else {
      dispatch({ type: 'SET_INPUT', payload: value });
    }
  }, []);

  const setChatSearch = useCallback((value: string) => dispatch({ type: 'SET_CHAT_SEARCH', payload: value }), []);
  const setLastUserMessage = useCallback((value: string) => dispatch({ type: 'SET_LAST_USER_MESSAGE', payload: value }), []);
  const setStreamingContent = useCallback((value: string) => dispatch({ type: 'SET_STREAMING_CONTENT', payload: value }), []);
  const setPendingActions = useCallback((value: PendingActions | null) => dispatch({ type: 'SET_PENDING_ACTIONS', payload: value }), []);
  const setCopiedId = useCallback((value: string | null) => dispatch({ type: 'SET_COPIED_ID', payload: value }), []);
  const setTokenInfo = useCallback((value: TokenInfo | null) => dispatch({ type: 'SET_TOKEN_INFO', payload: value }), []);
  const resetMessaging = useCallback(() => dispatch({ type: 'RESET_MESSAGING' }), []);

  return {
    ...state,
    setInput,
    setChatSearch,
    setLastUserMessage,
    setStreamingContent,
    setPendingActions,
    setCopiedId,
    setTokenInfo,
    resetMessaging,
  };
}
