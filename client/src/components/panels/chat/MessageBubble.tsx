import { memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeSanitize from 'rehype-sanitize';
import { Bot, User, Copy, Check, RefreshCw, AlertTriangle, CheckCircle2, Wrench, XCircle, GitBranch, Settings2, Play, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import TrustReceiptCard from '@/components/ui/TrustReceiptCard';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import ConfidenceBadge from '@/components/ui/ConfidenceBadge';
import ActionPreviewList from './ActionPreviewList';
import AnswerSourcePanel from './AnswerSourcePanel';
import type { ConfidenceScore } from '@/components/ui/ConfidenceBadge';
import { ACTION_LABELS, DESTRUCTIVE_ACTIONS } from './constants';
import type { ChatMessage, ToolCallInfo } from '@/lib/project-context';
import type { PendingActionReview } from './chat-types';

/** Type guard — checks if unknown data contains a valid ConfidenceScore shape. */
function isConfidenceScore(data: unknown): data is ConfidenceScore {
  if (typeof data !== 'object' || data === null) { return false; }
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.score === 'number' &&
    typeof obj.explanation === 'string' &&
    Array.isArray(obj.factors)
  );
}

/** Extract the highest-priority confidence score from tool call results. */
function extractConfidence(toolCalls: ToolCallInfo[] | undefined): ConfidenceScore | null {
  if (!toolCalls || toolCalls.length === 0) { return null; }
  for (const tc of toolCalls) {
    const d = tc.result.data;
    // Direct confidence object
    if (isConfidenceScore(d)) { return d; }
    // Nested under a "confidence" key
    if (typeof d === 'object' && d !== null && 'confidence' in d) {
      const nested = (d as Record<string, unknown>).confidence;
      if (isConfidenceScore(nested)) { return nested; }
    }
  }
  return null;
}

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-bold text-primary/90">{children}</strong>,
        em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
        h1: ({ children }) => <h1 className="text-base font-bold text-foreground mb-2 mt-3 first:mt-0">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-foreground mb-1.5 mt-2 first:mt-0">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mb-1 mt-2 first:mt-0">{children}</h3>,
        code: ({ children, className }) => {
          const isBlock = className?.includes('language-');
          if (isBlock) {
            return (
              <pre className="bg-background/60 border border-border p-2 my-2 overflow-x-auto text-[11px] font-mono">
                <code>{children}</code>
              </pre>
            );
          }
          return <code className="bg-primary/10 text-primary px-1 py-0.5 text-[11px] font-mono">{children}</code>;
        },
        pre: ({ children }) => <>{children}</>,
        ul: ({ children }) => <ul className="list-disc list-inside space-y-0.5 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside space-y-0.5 mb-2">{children}</ol>,
        li: ({ children }) => <li className="text-sm">{children}</li>,
        a: ({ href, children }) => {
          const safeHref = href && /^https?:\/\//i.test(href) ? href : undefined;
          return <a href={safeHref} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:text-primary/80">{children}</a>;
        },
        table: ({ children }) => <div className="overflow-x-auto my-2"><table className="w-full text-xs border border-border">{children}</table></div>,
        thead: ({ children }) => <thead className="bg-muted/30">{children}</thead>,
        th: ({ children }) => <th className="border border-border px-2 py-1 text-left font-bold">{children}</th>,
        td: ({ children }) => <td className="border border-border px-2 py-1">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

interface MessageBubbleProps {
  msg: ChatMessage;
  copiedId: string | null;
  onCopy: (id: string, content: string) => void;
  onRegenerate?: () => void;
  onRetry?: () => void;
  onBranch?: (messageId: string) => void;
  onOpenSettings?: () => void;
  isLast: boolean;
  pendingActions: PendingActionReview | null;
  onAcceptActions: () => void;
  onRejectActions: () => void;
  tokenInfo?: {input: number; output: number; cost: number} | null;
}

const MessageBubble = memo(function MessageBubble({ msg, copiedId, onCopy, onRegenerate, onRetry, onBranch, onOpenSettings, isLast, pendingActions, onAcceptActions, onRejectActions, tokenInfo }: MessageBubbleProps) {
  const hasDestructivePendingActions = pendingActions?.actions.some((action) => DESTRUCTIVE_ACTIONS.includes(action.type)) ?? false;

  return (
    <div className={cn(
      "flex gap-3 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300 group/msg",
      msg.role === 'user' ? "flex-row-reverse" : "flex-row"
    )}>
      <div className={cn(
        "w-8 h-8 flex items-center justify-center shrink-0 border shadow-sm",
        msg.role === 'user' ? "bg-muted text-foreground border-border" : "bg-primary/10 text-primary border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)]"
      )}>
        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
      </div>

      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className={cn(
          "p-3 leading-relaxed shadow-sm relative",
          msg.role === 'user'
            ? "bg-primary text-primary-foreground"
            : msg.isError
              ? "bg-destructive/10 border border-destructive/30 text-foreground"
              : "bg-muted/30 backdrop-blur border border-border text-foreground"
        )}>
          {msg.attachments && msg.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {msg.attachments.filter(a => a.type === 'image' && a.url).map((att, idx) => (
                <img
                  key={att.url || att.name || idx}
                  src={att.url}
                  alt={att.name}
                  loading="lazy"
                  className="max-w-[200px] max-h-[150px] object-contain border border-border/50"
                  data-testid={`msg-image-${idx}`}
                />
              ))}
            </div>
          )}
          {msg.role === 'assistant' ? (
            <MarkdownContent content={msg.content} />
          ) : (
            <span className="whitespace-pre-wrap">{msg.content}</span>
          )}
          {msg.role === 'assistant' && 'modelId' in msg && typeof (msg as Record<string, unknown>).modelId === 'string' && (
            <div className="text-xs text-muted-foreground/60 mt-1" data-testid="msg-model-info">
              via {(msg as Record<string, unknown>).modelId as string}
            </div>
          )}
          {tokenInfo && msg.role === 'assistant' && (
            <div className="text-xs text-muted-foreground/80 mt-1" data-testid="text-token-info">
              {tokenInfo.input + tokenInfo.output} tokens · ~${tokenInfo.cost.toFixed(4)}
            </div>
          )}
          {msg.isError && msg.isKeyError && onOpenSettings && (
            <button
              data-testid="update-api-key-btn"
              onClick={onOpenSettings}
              className="flex items-center gap-1.5 mt-2 px-2.5 py-1.5 bg-primary/10 border border-primary/20 text-xs text-primary font-medium hover:bg-primary/20 transition-colors"
            >
              <Settings2 className="w-3 h-3" />
              Update API Key
            </button>
          )}
        </div>

        {msg.toolCalls && msg.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1 px-1">
            {msg.toolCalls.map((tc, index) => (
              <div key={tc.id || `${tc.name}-${index}`} className={cn(
                "flex items-center gap-1.5 px-2 py-1 text-[10px] border",
                tc.result.success
                  ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400"
                  : "border-destructive/20 bg-destructive/5 text-destructive"
              )}>
                {tc.result.success
                  ? <Wrench className="w-2.5 h-2.5 shrink-0" />
                  : <XCircle className="w-2.5 h-2.5 shrink-0" />}
                <span className="font-medium">{ACTION_LABELS[tc.name] || tc.name}</span>
                <span className="text-muted-foreground truncate">— {tc.result.message}</span>
              </div>
            ))}
          </div>
        )}

        {msg.role === 'assistant' && (msg.sources?.length || msg.confidence) && (
          <AnswerSourcePanel 
            sources={msg.sources || []} 
            confidence={msg.confidence} 
            className="px-1" 
          />
        )}

        {msg.actions && msg.actions.length > 0 && !pendingActions && !msg.toolCalls?.length && (
          <div className="flex flex-wrap gap-1 px-1">
            {msg.actions.map((action, idx) => (
              <span key={action.type + idx} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 border border-primary/20 text-[10px] text-primary">
                <CheckCircle2 className="w-2.5 h-2.5" />
                {ACTION_LABELS[action.type] || action.type}
              </span>
            ))}
          </div>
        )}

        {pendingActions && (
          <div className={cn(
            "border p-3 space-y-3 rounded-md shadow-sm",
            hasDestructivePendingActions
              ? "border-amber-500/40 bg-amber-500/5"
              : "border-primary/30 bg-primary/5"
          )}>
            <div className="flex items-center gap-2">
              {hasDestructivePendingActions
                ? <AlertTriangle className="w-4 h-4 text-amber-500" />
                : <Bot className="w-4 h-4 text-primary" />
              }
              <span className={cn(
                "text-[11px] font-bold uppercase tracking-tight",
                hasDestructivePendingActions ? "text-amber-500" : "text-primary"
              )}>
                {hasDestructivePendingActions
                  ? "Confirm Destructive Actions" 
                  : "Review Proposed Changes"
                }
              </span>
            </div>

            <TrustReceiptCard
              receipt={pendingActions.trustReceipt}
              data-testid="trust-receipt-pending-actions"
            />

            <ActionPreviewList actions={pendingActions.actions} />

            <div className="flex gap-2 pt-1">
              <button 
                onClick={onRejectActions} 
                data-testid="reject-actions"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-muted border border-border text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
              >
                <X className="w-3 h-3" />
                Discard
              </button>
              <button 
                onClick={onAcceptActions} 
                data-testid="accept-actions"
                className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-all shadow-[0_0_10px_rgba(0,240,255,0.2)]"
              >
                <Play className="w-3 h-3 fill-current" />
                Confirm & Apply
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 px-1">
          <span className="text-[11px] text-muted-foreground/70">
            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <div className="flex gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity">
            <StyledTooltip content="Copy" side="top">
                <button
                  type="button"
                  onClick={() => onCopy(msg.id, msg.content)}
                  data-testid={`copy-msg-${msg.id}`}
                  aria-label="Copy message"
                  className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copiedId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                </button>
            </StyledTooltip>
            {onRegenerate && isLast && (
              <StyledTooltip content="Regenerate" side="top">
                  <button type="button" onClick={onRegenerate} data-testid="regenerate-msg" aria-label="Regenerate response" className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
              </StyledTooltip>
            )}
            {onRetry && (
              <StyledTooltip content="Retry" side="top">
                  <button type="button" onClick={onRetry} data-testid="retry-msg" aria-label="Retry message" className="p-1 hover:bg-muted text-destructive/70 hover:text-destructive transition-colors">
                    <RefreshCw className="w-3 h-3" />
                  </button>
              </StyledTooltip>
            )}
            {onBranch && (
              <StyledTooltip content="Branch conversation — create a new thread from this message" side="top">
                  <button
                    onClick={() => onBranch(msg.id)}
                    data-testid={`branch-msg-${msg.id}`}
                    aria-label="Branch conversation from this message"
                    className="p-1 hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                  >
                    <GitBranch className="w-3 h-3" />
                  </button>
              </StyledTooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default MessageBubble;
