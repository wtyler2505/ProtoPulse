import type { RefObject, CSSProperties } from 'react';
import { Send, Plus, AlertTriangle, Mic, ImagePlus, Cpu, Cloud } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { AI_MODELS } from './constants';
import QuickActionsBar from './QuickActionsBar';

// CAPX-PERF-01: Static style extracted to module scope to avoid new object each render
const TEXTAREA_STYLE: CSSProperties = { minHeight: '44px', maxHeight: '120px' };

interface MessageInputProps {
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onQuickAction: (action: string) => void;
  isGenerating: boolean;
  onToggleQuickActions: () => void;
  showQuickActions: boolean;
  onVoiceToggle: () => void;
  isListening: boolean;
  aiProvider: 'anthropic' | 'gemini';
  aiModel: string;
  apiKeyValid: boolean;
  aiApiKey: string;
  onFileUpload: (file: File) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  attachedImage?: { base64: string; mimeType: string; name: string; previewUrl: string } | null;
  onRemoveImage?: () => void;
  onOpenSettings?: () => void;
}

export default function MessageInput({
  input,
  onInputChange,
  onSend,
  onQuickAction,
  isGenerating,
  onToggleQuickActions,
  showQuickActions,
  onVoiceToggle,
  isListening,
  aiProvider,
  aiModel,
  apiKeyValid,
  aiApiKey,
  onFileUpload,
  textareaRef,
  fileInputRef,
  attachedImage,
  onRemoveImage,
  onOpenSettings,
}: MessageInputProps) {
  return (
    <div className="p-4 border-t border-border bg-card/40 backdrop-blur shrink-0 min-w-0 overflow-hidden">
      {!apiKeyValid && aiApiKey && (
        <div className="flex items-center gap-2 text-[10px] text-amber-400/80 mb-2 px-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>API key format looks incorrect for {aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'}</span>
        </div>
      )}
      {attachedImage && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="relative group/img">
            <img
              src={attachedImage.previewUrl}
              alt={attachedImage.name}
              className="w-16 h-16 object-cover border border-border"
              data-testid="attached-image-preview"
            />
            {onRemoveImage && (
              <button
                onClick={onRemoveImage}
                data-testid="remove-attached-image"
                aria-label="Remove image"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] font-bold opacity-60 hover:opacity-100 transition-opacity"
              >
                &times;
              </button>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">{attachedImage.name}</span>
        </div>
      )}
      <div className="relative">
        <label htmlFor="chat-message-input" className="sr-only">Chat message</label>
        <textarea
          id="chat-message-input"
          ref={textareaRef}
          data-testid="chat-input"
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              onSend();
            }
          }}
          placeholder="Describe your system... (Shift+Enter for new line)"
          rows={1}
          className="w-full bg-muted/30 border border-border focus:border-primary pr-[6.5rem] pl-10 py-3 shadow-inner resize-none text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none min-w-0"
          style={TEXTAREA_STYLE}
        />
        <div className="absolute left-3 top-3">
          <StyledTooltip content="Quick actions" side="top">
              <button type="button" data-testid="toggle-quick-actions" aria-label="Toggle quick actions" className="flex items-center justify-center" onClick={onToggleQuickActions}>
                <Plus className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer" />
              </button>
          </StyledTooltip>
        </div>
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          <label htmlFor="chat-image-upload" className="sr-only">Upload image</label>
          <input
            id="chat-image-upload"
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
            className="hidden"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onFileUpload(file);
              }
            }}
            data-testid="input-image-upload"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => fileInputRef.current?.click()}
            data-testid="button-image-upload"
            aria-label="Upload image"
            title="Upload image"
          >
            <ImagePlus className="h-4 w-4" />
          </Button>
          {('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-8 w-8", isListening ? 'text-red-400 animate-pulse' : 'text-muted-foreground hover:text-foreground')}
            onClick={onVoiceToggle}
            data-testid="button-voice-input"
            aria-label="Voice input"
            title={isListening ? 'Stop listening' : 'Voice input'}
          >
            <Mic className="h-4 w-4" />
          </Button>
          )}
          <StyledTooltip content="Send (Enter)" side="top">
              <Button
                size="icon"
                onClick={onSend}
                disabled={isGenerating || !input.trim()}
                data-testid="send-button"
                aria-label="Send message"
                className="w-8 h-8 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </Button>
          </StyledTooltip>
        </div>
      </div>

      <QuickActionsBar
        onAction={onQuickAction}
        isVisible={showQuickActions}
        isGenerating={isGenerating}
      />

      <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70 mt-2 font-mono" data-testid="chat-status-line">
        {aiApiKey ? (
          <>
            <StyledTooltip content="AI Mode: natural language understanding, 80 tools, architecture generation, code analysis, multi-model routing" side="top">
              <span className="inline-flex items-center gap-1 cursor-help" data-testid="mode-indicator-api">
                <Cloud className="w-3 h-3 text-primary/70" />
                <span>API</span>
              </span>
            </StyledTooltip>
            <span className="text-muted-foreground/40">—</span>
            <span>{aiProvider === 'anthropic' ? 'Anthropic' : 'Gemini'} {AI_MODELS[aiProvider].find(m => m.id === aiModel)?.label || aiModel}</span>
          </>
        ) : (
          <>
            <StyledTooltip content="Local Mode: navigation, project settings, add/remove/connect components, BOM management, validation, export — no AI key needed" side="top">
              <span className="inline-flex items-center gap-1 cursor-help" data-testid="mode-indicator-local">
                <Cpu className="w-3 h-3 text-amber-400/70" />
                <span>Local</span>
              </span>
            </StyledTooltip>
            {onOpenSettings && (
              <>
                <span className="text-muted-foreground/40">—</span>
                <button
                  onClick={onOpenSettings}
                  data-testid="configure-api-key-link"
                  className="text-primary/70 hover:text-primary underline transition-colors"
                >
                  Add API key for AI
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
