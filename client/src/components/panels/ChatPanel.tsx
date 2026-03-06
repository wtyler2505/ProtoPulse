import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bot, Sparkles, ArrowDown, Search } from 'lucide-react';
import { useChat } from '@/lib/contexts/chat-context';
import { useValidation } from '@/lib/contexts/validation-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useHistory } from '@/lib/contexts/history-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { type ChatMessage, type ViewMode } from '@/lib/project-context';
import { cn } from '@/lib/utils';

import { copyToClipboard } from '@/lib/clipboard';
import { AI_MODELS, DESTRUCTIVE_ACTIONS, COPY_FEEDBACK_DURATION, LOCAL_COMMAND_DELAY } from './chat/constants';
import MessageBubble from './chat/MessageBubble';
import SettingsPanel from './chat/SettingsPanel';
import ChatHeader from './chat/ChatHeader';
import ChatSearchBar from './chat/ChatSearchBar';
import StreamingIndicator from './chat/StreamingIndicator';
import FollowUpSuggestions from './chat/FollowUpSuggestions';
import MessageInput from './chat/MessageInput';
import { useChatSettings } from '@/hooks/useChatSettings';
import { useApiKeyStatus } from '@/hooks/useApiKeyStatus';
import { queryClient } from '@/lib/queryClient';
import ApiKeySetupDialog from './chat/ApiKeySetupDialog';
import type { AIAction } from './chat/chat-types';
import { useActionExecutor } from './chat/hooks/useActionExecutor';
import { parseLocalIntent } from './chat/parseLocalIntent';
import { mapErrorToUserMessage, mapStreamErrorToUserMessage } from '@/lib/error-messages';
import { useMultimodalInput } from '@/lib/multimodal-input';
import type { InputType, ProcessingStatus } from '@/lib/multimodal-input';
import DesignAgentPanel from './chat/DesignAgentPanel';

/** Maximum number of SSE reconnection attempts on network failure. */
const SSE_MAX_RETRIES = 3;
const API_KEY_STORAGE_KEYS = {
  anthropic: 'protopulse-ai-api-key-anthropic',
  gemini: 'protopulse-ai-api-key-gemini',
} as const;

// CAPX-PERF-01: Static style objects extracted to module scope to avoid
// creating new references on every render.
const VERTICAL_TEXT_STYLE: React.CSSProperties = { writingMode: 'vertical-rl' };

// ---------------------------------------------------------------------------
// CAPX-PERF-10: Memoized message list component.
// Receives copiedId so that ChatPanel itself does NOT re-render when a message
// is copied — only this isolated sub-tree re-renders.
// ---------------------------------------------------------------------------
interface MessageListProps {
  filteredMessages: ChatMessage[];
  allMessages: ChatMessage[];
  copiedId: string | null;
  copyMessage: (id: string, content: string) => void;
  handleRegenerate: () => void;
  handleRetry: (lastUserMessage: string) => void;
  lastUserMessage: string;
  pendingActions: { actions: AIAction[]; messageId: string } | null;
  acceptPendingActions: () => void;
  rejectPendingActions: () => void;
  tokenInfo: { input: number; output: number; cost: number } | null;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  isGenerating: boolean;
  streamingContent: string;
  cancelRequest: () => void;
  chatSearch: string;
  handleSendSuggestion: (cmd: string) => void;
  createBranch: (parentMessageId: number) => Promise<{ branchId: string }>;
  onOpenSettings: () => void;
}

const MessageList = memo(function MessageList({
  filteredMessages,
  allMessages,
  copiedId,
  copyMessage,
  handleRegenerate,
  handleRetry,
  lastUserMessage,
  pendingActions,
  acceptPendingActions,
  rejectPendingActions,
  tokenInfo,
  scrollRef,
  isGenerating,
  streamingContent,
  cancelRequest,
  chatSearch,
  handleSendSuggestion,
  createBranch,
  onOpenSettings,
}: MessageListProps) {
  // CAPX-PERF-11: Memoize virtualizer callbacks to prevent unnecessary recalculations
  const getScrollElement = useCallback(() => scrollRef.current, [scrollRef]);
  const estimateSize = useCallback(() => 120, []);
  const measureElement = useCallback((el: Element) => el.getBoundingClientRect().height + 16, []);

  const messageVirtualizer = useVirtualizer({
    count: filteredMessages.length,
    getScrollElement,
    estimateSize,
    overscan: 5,
    measureElement,
  });

  const scrollToBottom = useCallback(() => {
    if (filteredMessages.length > 0) {
      messageVirtualizer.scrollToIndex(filteredMessages.length - 1, { align: 'end' });
    }
  }, [filteredMessages.length, messageVirtualizer]);

  useEffect(() => { scrollToBottom(); }, [allMessages, isGenerating, streamingContent, scrollToBottom]);

  const [showScrollBtn, setShowScrollBtn] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
      setShowScrollBtn(!atBottom);
    };
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [scrollRef]);

  const lastMsgId = allMessages.length > 0 ? allMessages[allMessages.length - 1]?.id : undefined;

  return (
    <>
      <div className="flex-1 overflow-y-auto p-4 relative" ref={scrollRef}>
        {filteredMessages.length === 0 && !chatSearch && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
            <Bot className="w-12 h-12 mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">Ask ProtoPulse AI to generate a schematic, optimize costs, or validate your design.</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {['Generate Architecture', 'Project Summary', 'Show Help'].map(cmd => (
                <button
                  key={cmd}
                  onClick={() => handleSendSuggestion(cmd)}
                  data-testid={`empty-suggestion-${cmd.toLowerCase().replace(/\s+/g, '-')}`}
                  className="px-3 py-1.5 bg-muted/40 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}

        {chatSearch && filteredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 opacity-50">
            <Search className="w-8 h-8 mb-3 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No messages matching &quot;{chatSearch}&quot;</p>
          </div>
        )}

        {filteredMessages.length > 0 && (
          <div style={{ height: `${messageVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {messageVirtualizer.getVirtualItems().map((virtualRow) => {
              const msg = filteredMessages[virtualRow.index];
              return (
                <div
                  key={msg.id}
                  ref={messageVirtualizer.measureElement}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: '16px',
                  }}
                >
                  <MessageBubble
                    msg={msg}
                    copiedId={copiedId}
                    onCopy={copyMessage}
                    onRegenerate={msg.role === 'assistant' && msg.id === lastMsgId ? handleRegenerate : undefined}
                    onRetry={msg.isError ? () => handleRetry(lastUserMessage) : undefined}
                    onBranch={(messageId) => { void createBranch(Number(messageId)); }}
                    onOpenSettings={onOpenSettings}
                    isLast={msg.id === lastMsgId}
                    pendingActions={pendingActions?.messageId === msg.id ? pendingActions : null}
                    onAcceptActions={acceptPendingActions}
                    onRejectActions={rejectPendingActions}
                    tokenInfo={msg.role === 'assistant' && msg.id === lastMsgId ? tokenInfo : null}
                  />
                </div>
              );
            })}
          </div>
        )}

        {isGenerating && (
          <StreamingIndicator content={streamingContent} onCancel={cancelRequest} />
        )}
      </div>

      {/* Scroll to bottom */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          data-testid="scroll-to-bottom"
          aria-label="Scroll to bottom"
          className="absolute bottom-32 right-6 w-8 h-8 bg-primary/20 border border-primary/40 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors z-10 shadow-lg"
        >
          <ArrowDown className="w-4 h-4" />
        </button>
      )}
    </>
  );
});

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  collapsed?: boolean;
  width?: number;
  onToggleCollapse?: () => void;
}

export default function ChatPanel({ isOpen, onClose, collapsed = false, width = 350, onToggleCollapse }: ChatPanelProps) {
  const { messages, addMessage, isGenerating, setIsGenerating, branches, activeBranchId, setActiveBranchId, createBranch } = useChat();
  const { runValidation, addValidationIssue, deleteValidationIssue, issues } = useValidation();
  const { setNodes, setEdges, nodes, edges, selectedNodeId, captureSnapshot, getChangeDiff } = useArchitecture();
  const { bom, addBomItem, deleteBomItem, updateBomItem } = useBom();
  const { activeView, setActiveView, activeSheetId, setActiveSheetId, projectName, setProjectName, projectDescription, setProjectDescription } = useProjectMeta();
  const { addToHistory } = useHistory();
  const { addOutputLog } = useOutput();
  const [input, setInput] = useState('');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = useProjectId();
  const { aiProvider, setAiProvider, aiModel, setAiModel, aiTemperature, setAiTemperature, customSystemPrompt, setCustomSystemPrompt, routingStrategy, setRoutingStrategy } = useChatSettings();
  const { status: keyStatus, errorMessage: keyErrorMessage, validate: validateKey, reset: resetKeyStatus } = useApiKeyStatus();
  const [showSetupDialog, setShowSetupDialog] = useState(false);
  // UI-07: Persist AI API key in localStorage (per-provider)
  const [aiApiKey, setAiApiKey] = useState(() => {
    try {
      // Migrate legacy single-key to anthropic if present
      const legacyKey = localStorage.getItem('protopulse-ai-api-key');
      if (legacyKey) {
        localStorage.setItem(API_KEY_STORAGE_KEYS.anthropic, legacyKey);
        localStorage.removeItem('protopulse-ai-api-key');
      }
      return localStorage.getItem(API_KEY_STORAGE_KEYS[aiProvider]) ?? '';
    } catch {
      return '';
    }
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [chatSearch, setChatSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showDesignAgent, setShowDesignAgent] = useState(false);
  const [pendingActions, setPendingActions] = useState<{ actions: AIAction[]; messageId: string } | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [lastUserMessage, setLastUserMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{input: number; output: number; cost: number} | null>(null);
  const [attachedImage, setAttachedImage] = useState<{ base64: string; mimeType: string; name: string; previewUrl: string } | null>(null);

  // Multimodal input integration
  const multimodal = useMultimodalInput();
  const [showMultimodalMenu, setShowMultimodalMenu] = useState(false);
  const [multimodalInputType, setMultimodalInputType] = useState<InputType | null>(null);
  const [multimodalStatus, setMultimodalStatus] = useState<ProcessingStatus>('idle');
  const multimodalFileRef = useRef<HTMLInputElement>(null);

  const handleMultimodalTypeSelect = useCallback((type: InputType) => {
    setMultimodalInputType(type);
    setShowMultimodalMenu(false);
    if (type === 'photo') {
      // For photo, try camera first if available, fallback to file
      if (typeof navigator.mediaDevices?.getUserMedia === 'function') {
        multimodalFileRef.current?.setAttribute('capture', 'environment');
      }
    } else {
      multimodalFileRef.current?.removeAttribute('capture');
    }
    // Trigger file selection
    multimodalFileRef.current?.click();
  }, []);

  const handleMultimodalFile = useCallback((file: File) => {
    setMultimodalStatus('capturing');
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const validation = multimodal.validateImage(dataUrl);
      if (!validation.valid) {
        addOutputLog(`[MULTIMODAL] Validation failed: ${validation.errors.join(', ')}`);
        setMultimodalStatus('error');
        setTimeout(() => setMultimodalStatus('idle'), 3000);
        return;
      }

      const detectedType = multimodalInputType ?? multimodal.detectInputType(dataUrl, file.name);
      setMultimodalStatus('preprocessing');

      const capture = multimodal.captureFromDataUrl(dataUrl, 'file', detectedType);
      const preprocessed = multimodal.preprocessImage(capture.id);

      const base64 = preprocessed.processed.dataUrl.split(',')[1];
      setAttachedImage({
        base64,
        mimeType: file.type || 'image/png',
        name: file.name,
        previewUrl: preprocessed.processed.dataUrl,
      });
      setMultimodalStatus('complete');
      setMultimodalInputType(null);
      addOutputLog(`[MULTIMODAL] Captured ${detectedType}: ${file.name} (${preprocessed.processed.width}x${preprocessed.processed.height})`);
      addToHistory(`Multimodal input: ${detectedType} - ${file.name}`, 'User');
      setTimeout(() => setMultimodalStatus('idle'), 2000);
    };
    reader.onerror = () => {
      setMultimodalStatus('error');
      addOutputLog('[MULTIMODAL] Failed to read file');
      setTimeout(() => setMultimodalStatus('idle'), 3000);
    };
    reader.readAsDataURL(file);
  }, [multimodal, multimodalInputType, addOutputLog, addToHistory]);

  // UI-07: Sync API key to localStorage whenever it changes (per-provider)
  useEffect(() => {
    try {
      if (aiApiKey) {
        localStorage.setItem(API_KEY_STORAGE_KEYS[aiProvider], aiApiKey);
      } else {
        localStorage.removeItem(API_KEY_STORAGE_KEYS[aiProvider]);
      }
    } catch {
      // localStorage may be unavailable (private browsing, storage full)
    }
  }, [aiApiKey, aiProvider]);

  // Load the correct API key when provider changes
  useEffect(() => {
    try {
      setAiApiKey(localStorage.getItem(API_KEY_STORAGE_KEYS[aiProvider]) ?? '');
    } catch {
      setAiApiKey('');
    }
  }, [aiProvider]);

  // Reset key validation status when provider or key changes
  useEffect(() => {
    resetKeyStatus();
  }, [aiApiKey, aiProvider, resetKeyStatus]);

  const clearSavedApiKey = useCallback(() => {
    setAiApiKey('');
    try {
      localStorage.removeItem(API_KEY_STORAGE_KEYS[aiProvider]);
    } catch {
      // Ignore localStorage errors
    }
  }, [aiProvider]);

  const filteredMessages = useMemo(() =>
    chatSearch
      ? messages.filter((m) => m.content.toLowerCase().includes(chatSearch.toLowerCase()))
      : messages,
    [messages, chatSearch]
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const resizeTextarea = useCallback(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    }
  }, []);

  useEffect(() => { resizeTextarea(); }, [input, resizeTextarea]);

  const copyMessage = useCallback((id: string, content: string) => {
    copyToClipboard(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), COPY_FEEDBACK_DURATION);
  }, []);

  // ---------------------------------------------------------------------------
  // Unified local command handling — parseLocalIntent produces AIAction[] that
  // route through the same executeAIActions path the AI tool system uses.
  // ---------------------------------------------------------------------------
  const executeAIActions = useActionExecutor();

  // ---------------------------------------------------------------------------
  // CAPX-PERF-02: Ref that holds the latest values needed by handleSend.
  // handleSend reads from this ref at call time instead of closing over state,
  // reducing the useCallback dependency array from 23 items to 3.
  // ---------------------------------------------------------------------------
  const sendStateRef = useRef<{
    input: string;
    aiApiKey: string;
    aiProvider: 'anthropic' | 'gemini';
    aiModel: string;
    aiTemperature: number;
    customSystemPrompt: string;
    routingStrategy: string;
    activeView: ViewMode;
    activeSheetId: string | null;
    selectedNodeId: string | null;
    projectId: number;
    attachedImage: { base64: string; mimeType: string; name: string; previewUrl: string } | null;
    nodes: typeof nodes;
    edges: typeof edges;
    bom: typeof bom;
    issues: typeof issues;
    projectName: string;
    projectDescription: string;
    addMessage: typeof addMessage;
    setIsGenerating: typeof setIsGenerating;
    executeAIActions: typeof executeAIActions;
    getChangeDiff: typeof getChangeDiff;
    captureSnapshot: typeof captureSnapshot;
    isGenerating: boolean;
  }>(null!);
  sendStateRef.current = {
    input, aiApiKey, aiProvider, aiModel, aiTemperature, customSystemPrompt,
    routingStrategy, activeView, activeSheetId, selectedNodeId, projectId,
    attachedImage, nodes, edges, bom, issues, projectName, projectDescription,
    addMessage, setIsGenerating, executeAIActions, getChangeDiff, captureSnapshot,
    isGenerating,
  };

  const toggleVoiceInput = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      addOutputLog('[SYSTEM] Voice input not supported in this browser');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    /* eslint-disable @typescript-eslint/no-explicit-any -- Web Speech API types unavailable in all TS envs */
    const win = window as Record<string, unknown>;
    const SpeechRecognitionCtor = (win.webkitSpeechRecognition || win.SpeechRecognition) as (new () => {
      continuous: boolean;
      interimResults: boolean;
      lang: string;
      onstart: (() => void) | null;
      onresult: ((event: { results: { [index: number]: { [index: number]: { transcript: string } } } }) => void) | null;
      onerror: (() => void) | null;
      onend: (() => void) | null;
      start: () => void;
    }) | undefined;
    if (!SpeechRecognitionCtor) return;
    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev: string) => prev + transcript);
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  }, [isListening, addOutputLog]);

  const cancelRequest = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsGenerating(false);
    setStreamingContent('');
  }, [setIsGenerating]);

  // CAPX-PERF-02: handleSend reads from sendStateRef at call time to avoid
  // a 23-item dependency array. Only setters and the ref itself are deps.
  const handleSend = useCallback(async (messageOverride?: string) => {
    const s = sendStateRef.current;
    const msgText = messageOverride || s.input;
    if (!msgText.trim()) return;
    if (s.isGenerating) return;

    setInput('');
    setLastUserMessage(msgText);
    // Capture and clear attached image before async work
    const currentImage = s.attachedImage;
    setAttachedImage(null);
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msgText,
      timestamp: Date.now(),
      attachments: currentImage ? [{ type: 'image', name: currentImage.name, url: currentImage.previewUrl }] : undefined,
    };
    s.addMessage(userMsg);
    s.setIsGenerating(true);

    let fetchTimeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!s.aiApiKey) {
        setShowSetupDialog(true);
        setTimeout(() => {
          // Re-read ref for latest state inside setTimeout
          const latest = sendStateRef.current;
          const intent = parseLocalIntent(msgText, {
            nodes: latest.nodes, edges: latest.edges, bom: latest.bom,
            issues: latest.issues, projectName: latest.projectName,
            projectDescription: latest.projectDescription, activeView: latest.activeView,
          });
          if (intent.actions.length > 0) {
            latest.executeAIActions(intent.actions);
          }
          latest.addMessage({
            id: crypto.randomUUID(),
            role: 'assistant',
            content: intent.response ?? "Command executed.",
            timestamp: Date.now(),
          });
          latest.setIsGenerating(false);
        }, LOCAL_COMMAND_DELAY);
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      fetchTimeoutId = setTimeout(() => controller.abort('timeout'), 150_000);

      setStreamingContent('');

      const changeDiff = s.getChangeDiff();

      // CAPX-API-05: SSE fetch with exponential backoff on network errors
      const fetchRequestBody = JSON.stringify({
        message: msgText,
        provider: s.aiProvider,
        model: s.aiModel,
        apiKey: s.aiApiKey,
        projectId: s.projectId,
        temperature: s.aiTemperature,
        customSystemPrompt: s.customSystemPrompt,
        activeView: s.activeView,
        activeSheetId: s.activeSheetId,
        selectedNodeId: s.selectedNodeId,
        changeDiff,
        routingStrategy: s.routingStrategy,
        ...(currentImage ? {
          imageBase64: currentImage.base64,
          imageMimeType: currentImage.mimeType,
        } : {}),
      });

      const fetchWithRetry = async (retries = 0): Promise<Response> => {
        try {
          const response = await fetch('/api/chat/ai/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: fetchRequestBody,
          });
          return response;
        } catch (err: unknown) {
          // Only retry on network errors (TypeError from fetch), NOT on abort or server errors
          if (retries >= SSE_MAX_RETRIES || controller.signal.aborted) {
            throw err;
          }
          // TypeError indicates a network failure (DNS, connection refused, etc.)
          if (err instanceof TypeError) {
            const delay = Math.pow(2, retries) * 1000;
            setStreamingContent(`Reconnecting... (attempt ${String(retries + 2)}/${String(SSE_MAX_RETRIES + 1)})`);
            await new Promise<void>(r => setTimeout(r, delay));
            return fetchWithRetry(retries + 1);
          }
          // Non-network errors (e.g. AbortError) — don't retry
          throw err;
        }
      };

      const response = await fetchWithRetry();

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
        throw new Error(errorData.message || `${String(response.status)}: Server error`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let finalActions: AIAction[] = [];
      let finalToolCalls: Array<{ id: string; name: string; input: Record<string, unknown>; result: { success: boolean; message: string; data?: unknown } }> = [];
      let hasServerToolCalls = false;
      let sseErrorCount = 0;

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'text') {
                // Native tool use: structured text event
                fullText += data.text;
                setStreamingContent(fullText);
              } else if (data.type === 'chunk') {
                // Legacy: raw text chunk (backward compat)
                fullText += data.text;
                setStreamingContent(fullText);
              } else if (data.type === 'tool_call') {
                // AI is calling a tool — show in streaming indicator
                setStreamingContent(fullText + `\n\n_Using tool: ${data.name}..._`);
              } else if (data.type === 'tool_result') {
                // Tool finished — update indicator
                const status = data.result?.success ? 'done' : 'failed';
                setStreamingContent(fullText + `\n\n_Tool ${data.name}: ${status}_`);
                hasServerToolCalls = true;
              } else if (data.type === 'done') {
                fullText = data.message;
                finalActions = data.actions || [];
                finalToolCalls = data.toolCalls || [];
                if (finalToolCalls.length > 0) {
                  hasServerToolCalls = true;
                }
                const inputTokens = Math.ceil(msgText.length / 4);
                const outputTokens = Math.ceil(fullText.length / 4);
                const cost = s.aiProvider === 'anthropic'
                  ? (inputTokens * 0.003 + outputTokens * 0.015) / 1000
                  : (inputTokens * 0.00025 + outputTokens * 0.0005) / 1000;
                setTokenInfo({ input: inputTokens, output: outputTokens, cost });
              } else if (data.type === 'error') {
                const streamErr = mapStreamErrorToUserMessage(
                  (data as { message?: string; code?: string }),
                );
                fullText = `${streamErr.title}: ${streamErr.description}`;
              }
            } catch (parseErr: unknown) {
              sseErrorCount++;
              if (sseErrorCount <= 3) {
                console.warn('[SSE] Failed to parse event:', line.slice(0, 100), parseErr);
              }
            }
          }
        }

        if (sseErrorCount > 0) {
          console.warn(`[SSE] ${String(sseErrorCount)} parse error(s) during stream`);
        }
      }

      setStreamingContent('');

      // Invalidate caches if server executed tools (data may have changed in DB)
      if (hasServerToolCalls) {
        queryClient.invalidateQueries();
      }

      const hasDestructive = finalActions.some((a) => DESTRUCTIVE_ACTIONS.includes(a.type));
      const msgId = crypto.randomUUID();

      // Re-read ref for latest callbacks (state may have changed during streaming)
      const latest = sendStateRef.current;

      if (hasDestructive && finalActions.length > 0) {
        setPendingActions({ actions: finalActions, messageId: msgId });
        latest.addMessage({
          id: msgId,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
          actions: finalActions,
          toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        });
      } else {
        if (finalActions.length > 0) {
          latest.executeAIActions(finalActions);
        }
        latest.addMessage({
          id: msgId,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
          actions: finalActions,
          toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const latest = sendStateRef.current;
      if (err.name === 'AbortError') {
        const isTimeout = abortRef.current?.signal.reason === 'timeout';
        latest.addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: isTimeout
            ? 'AI response timed out after 150 seconds. Please try again.'
            : 'Request was cancelled.',
          timestamp: Date.now(),
          isError: isTimeout,
        });
      } else {
        const mapped = mapErrorToUserMessage(err);
        const isKeyError = /api.?key|authentication/i.test(mapped.title);
        latest.addMessage({
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `${mapped.title}: ${mapped.description}`,
          timestamp: Date.now(),
          isError: true,
          isKeyError,
        });
      }
    } finally {
      if (fetchTimeoutId !== undefined) {
        clearTimeout(fetchTimeoutId);
      }
      const latest = sendStateRef.current;
      latest.setIsGenerating(false);
      setStreamingContent('');
      abortRef.current = null;
      latest.captureSnapshot();
    }
  }, [sendStateRef]);

  const handleRegenerate = useCallback(() => {
    if (lastUserMessage && !isGenerating) {
      handleSend(lastUserMessage);
    }
  }, [lastUserMessage, isGenerating, handleSend]);

  const handleRetry = useCallback((msg: string) => {
    handleSend(msg);
  }, [handleSend]);

  const exportChat = useCallback(() => {
    try {
      const text = messages.map((m) =>
        `[${new Date(m.timestamp).toLocaleString()}] ${m.role === 'user' ? 'You' : 'AI'}: ${m.content}`
      ).join('\n\n');
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = projectName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
      a.download = `${safeName}_chat.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Chat export failed:', err);
      alert('Failed to export chat. Please try again.');
    }
  }, [messages, projectName]);



  const followUpSuggestions = useMemo((): string[] => {
    if (messages.length === 0) return [];
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant') return [];
    const content = last.content.toLowerCase();
    const suggestions: string[] = [];

    if (content.includes('architecture') || content.includes('node') || content.includes('component')) {
      suggestions.push('Run Validation');
      if (nodes.length > 0) suggestions.push('Optimize BOM');
    }
    if (content.includes('bom') || content.includes('part') || content.includes('cost')) {
      suggestions.push('Export BOM CSV');
      suggestions.push('Switch to Procurement');
    }
    if (content.includes('validation') || content.includes('issue') || content.includes('error')) {
      suggestions.push('Fix all issues');
      suggestions.push('Project Summary');
    }
    if (content.includes('generated') || content.includes('created') || content.includes('added')) {
      suggestions.push('Switch to Architecture');
      suggestions.push('Run Validation');
    }

    if (suggestions.length === 0) {
      suggestions.push('Project Summary', 'Show Help');
    }

    return suggestions.slice(0, 3);
  }, [messages, nodes]);

  const acceptPendingActions = useCallback(() => {
    if (pendingActions) {
      executeAIActions(pendingActions.actions);
      setPendingActions(null);
    }
  }, [pendingActions, executeAIActions]);

  const rejectPendingActions = useCallback(() => {
    setPendingActions(null);
    addMessage({
      id: crypto.randomUUID(),
      role: 'assistant',
      content: 'Actions cancelled. No changes were made to your design.',
      timestamp: Date.now(),
    });
  }, [addMessage]);

  const apiKeyValid = useCallback(() => {
    if (!aiApiKey) return true;
    if (aiProvider === 'anthropic') return aiApiKey.startsWith('sk-ant-');
    if (aiProvider === 'gemini') return aiApiKey.length >= 20;
    return true;
  }, [aiApiKey, aiProvider]);

  // CAPX-PERF-01: Memoize panel width style to avoid new object each render
  const panelWidthStyle = useMemo<React.CSSProperties>(() => ({ width }), [width]);

  if (collapsed) {
    return (
      <div
        data-testid="chat-collapsed"
        className="hidden lg:flex flex-col items-center w-10 h-full bg-card/60 backdrop-blur-xl border-l border-border shrink-0 cursor-pointer transition-all duration-300"
        onClick={onToggleCollapse}
      >
        <div className="h-14 flex items-center justify-center border-b border-border w-full">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground" style={VERTICAL_TEXT_STYLE}>
            AI Assistant
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      {isOpen && (
        <div data-testid="chat-backdrop" className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <div
        className={cn(
          "flex flex-col h-full bg-card/60 backdrop-blur-xl border-l border-border shadow-2xl relative shrink-0 overflow-hidden",
          "fixed inset-y-0 right-0 z-50 w-full max-w-[350px] transform transition-transform lg:relative lg:translate-x-0 lg:max-w-none",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={panelWidthStyle}
      >
        <div className="flex flex-col h-full w-full">
          <ChatHeader
            onSearch={() => setShowSearch(!showSearch)}
            onExport={exportChat}
            onSettings={() => setShowSettings(!showSettings)}
            onClose={onClose}
            showSearch={showSearch}
            showSettings={showSettings}
            branches={branches}
            activeBranchId={activeBranchId}
            onBranchSelect={setActiveBranchId}
            keyStatus={keyStatus}
            hasKey={!!aiApiKey}
          />

          {/* Design Agent / Chat tab switcher */}
          <div className="flex border-b border-border text-xs shrink-0">
            <button
              data-testid="chat-tab-chat"
              type="button"
              onClick={() => setShowDesignAgent(false)}
              className={cn(
                'flex-1 py-1.5 text-center transition-colors',
                !showDesignAgent ? 'text-primary border-b border-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Chat
            </button>
            <button
              data-testid="chat-tab-agent"
              type="button"
              onClick={() => setShowDesignAgent(true)}
              className={cn(
                'flex-1 py-1.5 text-center transition-colors flex items-center justify-center gap-1',
                showDesignAgent ? 'text-primary border-b border-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Bot className="w-3 h-3" />
              Design Agent
            </button>
          </div>

          <ChatSearchBar
            value={chatSearch}
            onChange={setChatSearch}
            visible={showSearch && !showDesignAgent}
          />

          {showDesignAgent ? (
            <DesignAgentPanel projectId={projectId} apiKey={aiApiKey} />
          ) : (
          <>
          {/* CAPX-PERF-10: Isolated MessageList — copiedId changes only re-render this sub-tree */}
          <MessageList
            filteredMessages={filteredMessages}
            allMessages={messages}
            copiedId={copiedId}
            copyMessage={copyMessage}
            handleRegenerate={handleRegenerate}
            handleRetry={handleRetry}
            lastUserMessage={lastUserMessage}
            pendingActions={pendingActions}
            acceptPendingActions={acceptPendingActions}
            rejectPendingActions={rejectPendingActions}
            tokenInfo={tokenInfo}
            scrollRef={scrollRef}
            isGenerating={isGenerating}
            streamingContent={streamingContent}
            cancelRequest={cancelRequest}
            chatSearch={chatSearch}
            handleSendSuggestion={handleSend}
            createBranch={createBranch}
            onOpenSettings={() => setShowSettings(true)}
          />

          {!showSettings && (
            <FollowUpSuggestions
              suggestions={followUpSuggestions}
              onSuggest={handleSend}
              isGenerating={isGenerating}
              hasPendingActions={!!pendingActions}
            />
          )}

          {/* Settings slide-over — overlays messages instead of replacing them */}
          {showSettings && (
            <div className="absolute inset-0 top-14 z-20 flex flex-col">
              <div
                className="absolute inset-0 bg-background/60 backdrop-blur-sm"
                onClick={() => setShowSettings(false)}
                data-testid="settings-backdrop"
              />
              <div className="relative z-10 flex-1 overflow-hidden">
                <SettingsPanel
                  aiProvider={aiProvider}
                  setAiProvider={setAiProvider}
                  aiModel={aiModel}
                  setAiModel={setAiModel}
                  aiApiKey={aiApiKey}
                  setAiApiKey={setAiApiKey}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  aiTemperature={aiTemperature}
                  setAiTemperature={setAiTemperature}
                  customSystemPrompt={customSystemPrompt}
                  setCustomSystemPrompt={setCustomSystemPrompt}
                  routingStrategy={routingStrategy}
                  setRoutingStrategy={setRoutingStrategy}
                  apiKeyValid={apiKeyValid}
                  onClearApiKey={clearSavedApiKey}
                  onClose={() => setShowSettings(false)}
                  keyStatus={keyStatus}
                  keyErrorMessage={keyErrorMessage}
                  onValidateKey={() => { void validateKey(aiProvider, aiApiKey); }}
                  isValidating={keyStatus === 'validating'}
                />
              </div>
            </div>
          )}

          <MessageInput
            input={input}
            onInputChange={setInput}
            onSend={() => handleSend()}
            onQuickAction={handleSend}
            isGenerating={isGenerating}
            onToggleQuickActions={() => setShowQuickActions(!showQuickActions)}
            showQuickActions={showQuickActions}
            onVoiceToggle={toggleVoiceInput}
            isListening={isListening}
            aiProvider={aiProvider}
            aiModel={aiModel}
            apiKeyValid={apiKeyValid()}
            aiApiKey={aiApiKey}
            attachedImage={attachedImage}
            onRemoveImage={() => setAttachedImage(null)}
            onFileUpload={(file) => {
              const reader = new FileReader();
              reader.onload = () => {
                const dataUrl = reader.result as string;
                const base64 = dataUrl.split(',')[1];
                setAttachedImage({
                  base64,
                  mimeType: file.type || 'image/png',
                  name: file.name,
                  previewUrl: dataUrl,
                });
              };
              reader.readAsDataURL(file);
              addOutputLog(`[SYSTEM] Image attached: ${file.name}`);
              addToHistory(`Uploaded image: ${file.name}`, 'User');
            }}
            textareaRef={textareaRef}
            fileInputRef={fileInputRef}
            onOpenSettings={() => setShowSettings(true)}
            showMultimodalMenu={showMultimodalMenu}
            onToggleMultimodalMenu={() => setShowMultimodalMenu((prev) => !prev)}
            onMultimodalTypeSelect={handleMultimodalTypeSelect}
            multimodalStatus={multimodalStatus}
            multimodalFileRef={multimodalFileRef}
            onMultimodalFile={handleMultimodalFile}
          />
          </>
          )}
        </div>
      </div>

      <ApiKeySetupDialog
        open={showSetupDialog}
        onOpenChange={setShowSetupDialog}
        aiProvider={aiProvider}
        onApiKeySet={(key) => { setAiApiKey(key); setShowSetupDialog(false); }}
      />
    </>
  );
}
