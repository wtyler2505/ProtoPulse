import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Bot, Sparkles, ArrowDown, Search } from 'lucide-react';
import {
  useArchitecture,
  useBom,
  useChat,
  useHistory,
  useOutput,
  useProjectId,
  useProjectMeta,
  useValidation,
} from '@/lib/project-context';
import { type ChatMessage, type ViewMode, type ToolCallInfo, type ToolSource, type ConfidenceScore } from '@/lib/project-context';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

import { copyToClipboard } from '@/lib/clipboard';
import { AI_MODELS, DESTRUCTIVE_ACTIONS, COPY_FEEDBACK_DURATION, LOCAL_COMMAND_DELAY } from './chat/constants';
import {
  validateMessageInput,
  buildChatRequestBody,
  reduceStreamEvent,
  initialStreamAccumulator,
  decideRoute,
  mapAbortToMessage,
  NAVIGATIONAL_ACTIONS,
  type StreamAccumulator,
  type StreamEvent,
} from './chat/lib/handleSendHelpers';
import MessageBubble from './chat/MessageBubble';
import SettingsPanel from './chat/SettingsPanel';
import ChatHeader from './chat/ChatHeader';
import ChatSearchBar from './chat/ChatSearchBar';
import StreamingIndicator from './chat/StreamingIndicator';
import FollowUpSuggestions from './chat/FollowUpSuggestions';
import MessageInput from './chat/MessageInput';
import { useChatSettings } from '@/hooks/useChatSettings';
import { useApiKeyStatus } from '@/hooks/useApiKeyStatus';
import { useApiKeys } from '@/hooks/useApiKeys';
import { useGoogleWorkspaceToken } from '@/hooks/useGoogleWorkspaceToken';
import { queryClient } from '@/lib/queryClient';
import { invalidateAfterToolCalls } from '@/lib/chat-cache-invalidation';
import ApiKeySetupDialog from './chat/ApiKeySetupDialog';
import type { AIAction } from './chat/chat-types';
import type { PendingActionReview } from './chat/chat-types';
import { useActionExecutor } from './chat/hooks/useActionExecutor';
import useChatPanelUI from './chat/hooks/useChatPanelUI';
import useChatMessaging from './chat/hooks/useChatMessaging';
import useMultimodalState from './chat/hooks/useMultimodalState';
import { parseLocalIntent } from './chat/parseLocalIntent';
import { mapErrorToUserMessage, mapStreamErrorToUserMessage } from '@/lib/error-messages';
import { useMultimodalInput } from '@/lib/multimodal-input';
import type { InputType } from '@/lib/multimodal-input';
import DesignAgentPanel from './chat/DesignAgentPanel';
import { AISafetyModeManager, useAISafetyMode } from '@/lib/ai-safety-mode';
import { useReviewQueue } from '@/lib/ai-review-queue';
import { ACTION_LABELS } from './chat/constants';
import SafetyConfirmDialog from './SafetyConfirmDialog';
import { buildChatActionTrustReceipt } from '@/lib/trust-receipts';
import { logger } from '@/lib/logger';

/** Maximum number of SSE reconnection attempts on network failure. */
const SSE_MAX_RETRIES = 3;

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
  pendingActions: PendingActionReview | null;
  acceptPendingActions: () => void;
  rejectPendingActions: () => void;
  tokenInfo: { input: number; output: number; cost: number; estimated: boolean } | null;
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
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <Bot className="w-10 h-10 mb-4 text-primary/50" />
            <p className="text-sm font-medium mb-1">ProtoPulse AI Assistant</p>
            <p className="text-xs text-muted-foreground mb-6 max-w-[250px]">
              Describe what you want to build, or choose a template below to get started.
            </p>
            
            <div className="grid grid-cols-1 gap-2 w-full max-w-[280px]">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1 text-left">Design & Architecture</div>
              <button
                onClick={() => handleSendSuggestion('Generate a complete architecture for a new IoT sensor node.')}
                className="px-3 py-2 bg-muted/20 border border-border/50 text-xs text-left text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                Generate new architecture
              </button>
              
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-3 mb-1 text-left">Review & Optimization</div>
              <button
                onClick={() => handleSendSuggestion('Analyze my current BOM and suggest cost cuts without sacrificing quality.')}
                className="px-3 py-2 bg-muted/20 border border-border/50 text-xs text-left text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Find BOM cost cuts
              </button>
              <button
                onClick={() => handleSendSuggestion('Review my schematic for missing decoupling capacitors or floating pins.')}
                className="px-3 py-2 bg-muted/20 border border-border/50 text-xs text-left text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                Review schematic errors
              </button>

              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-3 mb-1 text-left">Testing & Validation</div>
              <button
                onClick={() => handleSendSuggestion('Generate a comprehensive test plan for this board.')}
                className="px-3 py-2 bg-muted/20 border border-border/50 text-xs text-left text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                Generate test plan
              </button>
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
                    pendingActions={pendingActions?.messageId === (msg.clientId ?? msg.id) ? pendingActions : null}
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
  const { toast } = useToast();
  // BL-0026: Consolidated UI visibility state (8 booleans → 1 useReducer)
  const {
    showSettings, showApiKey, showSetupDialog, showSearch,
    showDesignAgent, showQuickActions, showScrollBtn, showMultimodalMenu,
    toggleSettings, toggleApiKey, toggleSearch, toggleDesignAgent,
    toggleQuickActions, toggleMultimodalMenu,
    setShowScrollBtn, setShowSettings, setShowApiKey, setShowSetupDialog,
    setShowSearch, setShowDesignAgent, setShowQuickActions, setShowMultimodalMenu,
  } = useChatPanelUI();

  // BL-0026: Consolidated messaging state (7 values → 1 useReducer)
  const {
    input, chatSearch, lastUserMessage, streamingContent,
    pendingActions, copiedId, tokenInfo,
    setInput, setChatSearch, setLastUserMessage, setStreamingContent,
    setPendingActions, setCopiedId, setTokenInfo,
  } = useChatMessaging();

  // BL-0026: Consolidated multimodal state (3 values → 1 useReducer)
  const {
    multimodalInputType, multimodalStatus, attachedImage,
    setMultimodalInputType, setMultimodalStatus, setAttachedImage,
  } = useMultimodalState();

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const projectId = useProjectId();
  const {
    aiProvider, setAiProvider,
    aiModel, setAiModel,
    aiTemperature, setAiTemperature,
    customSystemPrompt, setCustomSystemPrompt,
    routingStrategy, setRoutingStrategy,
    previewAiChanges, setPreviewAiChanges,
  } = useChatSettings();
  // BL-audit-#60: Google Workspace OAuth token is encrypted server-side (AES-256-GCM via
  // api_keys); sessionStorage scratch for pre-auth. Never round-trips through request bodies.
  const { token: googleWorkspaceToken, setToken: setGoogleWorkspaceToken } = useGoogleWorkspaceToken();
  const { status: keyStatus, errorMessage: keyErrorMessage, validate: validateKey, reset: resetKeyStatus } = useApiKeyStatus();
  // BL-0005 / audit #60: API keys managed by useApiKeys — server-side (AES-256-GCM) when authenticated, sessionStorage scratch otherwise
  const { apiKey: aiApiKey, updateLocalKey: setApiKeyForProvider, clearApiKey: clearApiKeyForProvider } = useApiKeys();
  const setAiApiKey = useCallback((key: string) => { setApiKeyForProvider(aiProvider, key); }, [setApiKeyForProvider, aiProvider]);
  const [isListening, setIsListening] = useState(false);
  const [designAgentSeed, setDesignAgentSeed] = useState<string | null>(null);
  const { enabled: safetyModeEnabled } = useAISafetyMode();
  const { stats: reviewStats, threshold: reviewThreshold } = useReviewQueue();

  // BL-0161: AI safety mode — intercepts caution/destructive actions for beginner confirmation
  const safetyManager = useMemo(() => AISafetyModeManager.getInstance(), []);
  const [safetyPending, setSafetyPending] = useState<{
    action: AIAction;
    remainingActions: AIAction[];
    allActions: AIAction[];
    msgId: string;
    fullText: string;
    toolCalls: ToolCallInfo[];
    sources: ToolSource[];
    confidence: ConfidenceScore | undefined;
  } | null>(null);

  // Multimodal input integration
  const multimodal = useMultimodalInput();
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

  // Reset key validation status when provider or key changes
  useEffect(() => {
    resetKeyStatus();
  }, [aiApiKey, aiProvider, resetKeyStatus]);

  const clearSavedApiKey = useCallback(() => {
    clearApiKeyForProvider(aiProvider);
  }, [clearApiKeyForProvider, aiProvider]);

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

  const buildPendingActionReview = useCallback((actions: AIAction[], messageId: string, confidence: ConfidenceScore | undefined, sources: ToolSource[]): PendingActionReview => {
    const strongestSafetyClassification = actions.reduce<ReturnType<typeof safetyManager.classifyAction>>((strongest, action) => {
      const next = safetyManager.classifyAction(action.type);
      if (strongest === 'destructive' || next === strongest) {
        return strongest;
      }
      if (next === 'destructive' || (next === 'caution' && strongest === 'safe')) {
        return next;
      }
      return strongest;
    }, 'safe');

    return {
      actions,
      messageId,
      trustReceipt: buildChatActionTrustReceipt({
        actionCount: actions.length,
        confidenceScore: confidence?.score,
        previewAiChanges,
        reviewPendingCount: reviewStats.pending,
        reviewThreshold,
        safetyModeEnabled,
        sourceCount: sources.length,
        strongestSafetyClassification,
      }),
    };
  }, [previewAiChanges, reviewStats.pending, reviewThreshold, safetyManager, safetyModeEnabled]);

  // ---------------------------------------------------------------------------
  // CAPX-PERF-02: Ref that holds the latest values needed by handleSend.
  // handleSend reads from this ref at call time instead of closing over state,
  // reducing the useCallback dependency array from 23 items to 3.
  // ---------------------------------------------------------------------------
  const sendStateRef = useRef<{
    input: string;
    aiApiKey: string;
    aiProvider: 'gemini';
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

  // AI-AUDIT #191: Abort any in-flight stream on unmount / route change.
  // Prevents orphaned tool calls and wasted tokens when the user navigates
  // away mid-stream. The ref is captured only for the cleanup closure — we
  // intentionally leave the deps array empty so this runs only on unmount.
  useEffect(() => {
    const ref = abortRef;
    return () => {
      if (ref.current) {
        ref.current.abort('unmount');
        ref.current = null;
      }
    };
  }, []);

  // CAPX-PERF-02: handleSend reads from sendStateRef at call time to avoid
  // a 23-item dependency array. Only setters and the ref itself are deps.
  const handleSend = useCallback(async (messageOverride?: string) => {
    const s = sendStateRef.current;
    const msgText = messageOverride ?? s.input;
    const validation = validateMessageInput(msgText, { isGenerating: s.isGenerating });
    if (!validation.valid) return;

    setInput('');
    setLastUserMessage(msgText);
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
      // --- No-API-key branch: fall back to local intent parsing -------------
      if (!s.aiApiKey) {
        setShowSetupDialog(true);
        setTimeout(() => {
          const latest = sendStateRef.current;
          const intent = parseLocalIntent(msgText, {
            nodes: latest.nodes, edges: latest.edges, bom: latest.bom,
            issues: latest.issues, projectName: latest.projectName,
            projectDescription: latest.projectDescription, activeView: latest.activeView,
          });
          if (intent.actions.length > 0) {
            latest.executeAIActions(intent.actions);
          }
          const responseId = crypto.randomUUID();
          latest.addMessage({
            id: responseId,
            clientId: responseId,
            role: 'assistant',
            content: intent.response ?? "Command executed.",
            timestamp: Date.now(),
          });
          latest.setIsGenerating(false);
        }, LOCAL_COMMAND_DELAY);
        return;
      }

      // --- Set up abort + timeout ------------------------------------------
      const controller = new AbortController();
      abortRef.current = controller;
      fetchTimeoutId = setTimeout(() => controller.abort('timeout'), 150_000);
      setStreamingContent('');

      // --- Build request body (pure helper) --------------------------------
      const hasSession = !!localStorage.getItem('protopulse-session-id');
      const fetchRequestBody = buildChatRequestBody(
        {
          aiProvider: s.aiProvider,
          aiModel: s.aiModel,
          aiApiKey: s.aiApiKey,
          aiTemperature: s.aiTemperature,
          projectId: s.projectId,
          customSystemPrompt: s.customSystemPrompt,
          activeView: s.activeView,
          activeSheetId: s.activeSheetId,
          selectedNodeId: s.selectedNodeId,
          routingStrategy: s.routingStrategy,
          changeDiff: s.getChangeDiff(),
        },
        msgText,
        currentImage,
        hasSession,
      );

      // --- Fetch with exponential-backoff retry on network errors ----------
      const fetchWithRetry = async (retries = 0): Promise<Response> => {
        try {
          return await fetch('/api/chat/ai/stream', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Session-Id': localStorage.getItem('protopulse-session-id') ?? '',
            },
            signal: controller.signal,
            body: fetchRequestBody,
          });
        } catch (err: unknown) {
          if (retries >= SSE_MAX_RETRIES || controller.signal.aborted) throw err;
          if (err instanceof TypeError) {
            const delay = Math.pow(2, retries) * 1000;
            setStreamingContent(`Reconnecting... (attempt ${String(retries + 2)}/${String(SSE_MAX_RETRIES + 1)})`);
            await new Promise<void>(r => setTimeout(r, delay));
            return fetchWithRetry(retries + 1);
          }
          throw err;
        }
      };

      const response = await fetchWithRetry();
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Unknown error' })) as { message?: string };
        throw new Error(errorData.message || `${String(response.status)}: Server error`);
      }

      // --- Drive the SSE stream through the pure reducer -------------------
      let accum: StreamAccumulator = initialStreamAccumulator();
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let sseErrorCount = 0;

      if (reader) {
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const event = JSON.parse(line.slice(6)) as StreamEvent;
              const { accum: next, streamingDisplay } = reduceStreamEvent(
                event,
                accum,
                msgText,
                mapStreamErrorToUserMessage,
              );
              accum = next;
              if (streamingDisplay !== null) setStreamingContent(streamingDisplay);
              if (event.type === 'done' && accum.tokenInfo) {
                setTokenInfo(accum.tokenInfo);
              }
            } catch (parseErr: unknown) {
              sseErrorCount++;
              if (sseErrorCount <= 3) {
                logger.warn('[SSE] Failed to parse event:', line.slice(0, 100), parseErr);
              }
            }
          }
        }
        if (sseErrorCount > 0) {
          logger.warn(`[SSE] ${String(sseErrorCount)} parse error(s) during stream`);
        }
      }

      setStreamingContent('');

      const { fullText, finalActions, finalToolCalls, finalSources, finalConfidence, hasServerToolCalls } = accum;

      // --- Cache invalidation for server-side tool effects -----------------
      if (hasServerToolCalls) {
        invalidateAfterToolCalls(queryClient, projectId, finalToolCalls);
      }

      // --- Route decision (pure helper) ------------------------------------
      const safetyMgr = AISafetyModeManager.getInstance();
      const route = decideRoute(finalActions, {
        destructiveActions: DESTRUCTIVE_ACTIONS,
        previewAiChanges,
        needsSafetyConfirmation: (t) => safetyMgr.needsConfirmation(t),
      });
      const msgId = crypto.randomUUID();
      const latest = sendStateRef.current;
      const assistantMessage: ChatMessage = {
        id: msgId,
        clientId: msgId,
        role: 'assistant',
        content: fullText,
        timestamp: Date.now(),
        actions: finalActions,
        toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
        sources: finalSources.length > 0 ? finalSources : undefined,
        confidence: finalConfidence,
      };

      if (route.kind === 'confirm') {
        setPendingActions(buildPendingActionReview(finalActions, msgId, finalConfidence, finalSources));
        latest.addMessage(assistantMessage);
        const hasDestructive = finalActions.some((a) => DESTRUCTIVE_ACTIONS.includes(a.type));
        const hasNonNavigational = finalActions.some((a) => !NAVIGATIONAL_ACTIONS.has(a.type));
        if (previewAiChanges && hasNonNavigational && !hasDestructive) {
          toast({
            title: 'Review required',
            description: 'The AI has proposed changes to your design. Please review and confirm.',
          });
        }
      } else if (route.kind === 'safety') {
        setSafetyPending({
          action: route.firstUnsafe,
          remainingActions: route.remaining,
          allActions: finalActions,
          msgId,
          fullText,
          toolCalls: finalToolCalls,
          sources: finalSources,
          confidence: finalConfidence,
        });
        latest.addMessage(assistantMessage);
      } else {
        if (finalActions.length > 0) latest.executeAIActions(finalActions);
        latest.addMessage(assistantMessage);
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      const latest = sendStateRef.current;
      if (err.name === 'AbortError') {
        const { content, isError } = mapAbortToMessage(abortRef.current?.signal.reason);
        const responseId = crypto.randomUUID();
        latest.addMessage({
          id: responseId,
          clientId: responseId,
          role: 'assistant',
          content,
          timestamp: Date.now(),
          isError,
        });
      } else {
        const mapped = mapErrorToUserMessage(err);
        const isKeyError = /api.?key|authentication/i.test(mapped.title);
        const responseId = crypto.randomUUID();
        latest.addMessage({
          id: responseId,
          clientId: responseId,
          role: 'assistant',
          content: `${mapped.title}: ${mapped.description}`,
          timestamp: Date.now(),
          isError: true,
          isKeyError,
        });
      }
    } finally {
      if (fetchTimeoutId !== undefined) clearTimeout(fetchTimeoutId);
      const latest = sendStateRef.current;
      latest.setIsGenerating(false);
      setStreamingContent('');
      abortRef.current = null;
      latest.captureSnapshot();
    }
  }, [sendStateRef, previewAiChanges, buildPendingActionReview, projectId, toast]);

  const handleRegenerate = useCallback(() => {
    if (lastUserMessage && !isGenerating) {
      handleSend(lastUserMessage);
    }
  }, [lastUserMessage, isGenerating, handleSend]);

  const handleRetry = useCallback((msg: string) => {
    handleSend(msg);
  }, [handleSend]);

  // Listen for cross-view chat-send events (e.g., "Generate Architecture" from ArchitectureView)
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ message: string }>).detail;
      if (detail?.message) {
        void handleSend(detail.message);
      }
    };
    window.addEventListener('protopulse:chat-send', handler);
    return () => window.removeEventListener('protopulse:chat-send', handler);
  }, [handleSend]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ designAgent?: boolean; prompt?: string }>).detail;
      if (detail?.designAgent) {
        setShowDesignAgent(true);
        if (detail.prompt && detail.prompt.trim().length > 0) {
          setDesignAgentSeed(detail.prompt);
        }
      } else {
        setShowDesignAgent(false);
      }
    };

    window.addEventListener('protopulse:open-chat-panel', handler);
    return () => window.removeEventListener('protopulse:open-chat-panel', handler);
  }, [setShowDesignAgent]);

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
      logger.warn('Chat export failed:', err);
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
      suggestions.push('Help me fix these issues');
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
      // Notify AI that actions were accepted (so it knows the state updated)
      addMessage("[System: User accepted proposed actions]");
      toast({
        title: 'Actions applied',
        description: `Successfully executed ${pendingActions.actions.length} action(s).`,
      });
    }
  }, [pendingActions, executeAIActions, addMessage, toast]);

  const rejectPendingActions = useCallback(() => {
    if (pendingActions) {
      setPendingActions(null);
      // Notify AI that actions were rejected
      addMessage("[System: User discarded proposed actions]");
      toast({
        title: 'Actions discarded',
        description: 'No changes were made to your design.',
      });
    }
  }, [pendingActions, addMessage, toast]);

  // BL-0161: AI safety mode confirmation handlers
  const handleSafetyConfirm = useCallback((dismiss: boolean) => {
    if (!safetyPending) {
      return;
    }
    if (dismiss) {
      safetyManager.dismissAction(safetyPending.action.type);
    }
    // Execute all actions (the confirmed one + remaining)
    executeAIActions(safetyPending.allActions);
    setSafetyPending(null);
    toast({
      title: 'Actions applied',
      description: `Successfully executed ${safetyPending.allActions.length} action(s).`,
    });
  }, [safetyPending, safetyManager, executeAIActions, toast]);

  const handleSafetyCancel = useCallback(() => {
    if (!safetyPending) {
      return;
    }
    setSafetyPending(null);
    addMessage('[System: User cancelled action via safety mode]');
    toast({
      title: 'Action cancelled',
      description: 'No changes were made to your design.',
    });
  }, [safetyPending, addMessage, toast]);

  const apiKeyValid = useCallback(() => {
    if (!aiApiKey) return true;
    // Sentinel '********' means server has the real key — always valid
    if (aiApiKey === '********' || aiApiKey === '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022') return true;
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
        <div data-testid="chat-backdrop" role="button" tabIndex={-1} aria-label="Close chat panel" className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') { onClose(); } }} />
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
            <DesignAgentPanel
              projectId={projectId}
              apiKey={aiApiKey}
              apiKeyValid={apiKeyValid()}
              previewAiChanges={previewAiChanges}
              seedPrompt={designAgentSeed}
              onConsumeSeed={() => setDesignAgentSeed(null)}
            />
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
                  googleWorkspaceToken={googleWorkspaceToken}
                  setGoogleWorkspaceToken={setGoogleWorkspaceToken}
                  showApiKey={showApiKey}
                  setShowApiKey={setShowApiKey}
                  aiTemperature={aiTemperature}
                  setAiTemperature={setAiTemperature}
                  customSystemPrompt={customSystemPrompt}
                  setCustomSystemPrompt={setCustomSystemPrompt}
                  routingStrategy={routingStrategy}
                  setRoutingStrategy={setRoutingStrategy}
                  previewAiChanges={previewAiChanges}
                  setPreviewAiChanges={setPreviewAiChanges}
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
            onToggleMultimodalMenu={toggleMultimodalMenu}
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

      {/* BL-0161: AI safety mode confirmation dialog */}
      {safetyPending && (() => {
        const info = safetyManager.getSafetyInfo(safetyPending.action.type);
        const label = ACTION_LABELS[safetyPending.action.type] ?? safetyPending.action.type.replace(/_/g, ' ');
        return (
          <SafetyConfirmDialog
            open={true}
            actionType={safetyPending.action.type}
            actionLabel={label}
            classification={info.classification}
            explanation={info.explanation}
            consequences={info.consequences}
            onConfirm={handleSafetyConfirm}
            onCancel={handleSafetyCancel}
          />
        );
      })()}
    </>
  );
}
