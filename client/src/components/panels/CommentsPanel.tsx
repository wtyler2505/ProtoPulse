import { useState, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  MessageSquare,
  Reply,
  Check,
  RotateCcw,
  Trash2,
  Send,
  Filter,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, getQueryFn } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { DesignComment } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResolvedFilter = 'all' | 'resolved' | 'unresolved';
type TargetFilter = 'all' | 'general' | 'node' | 'edge' | 'bom_item';

interface CommentsPanelProps {
  projectId: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) { return 'just now'; }
  if (diffMin < 60) { return `${diffMin}m ago`; }
  if (diffHr < 24) { return `${diffHr}h ago`; }
  if (diffDay < 30) { return `${diffDay}d ago`; }
  return new Date(date).toLocaleDateString();
}

function targetLabel(type: string): string {
  switch (type) {
    case 'node': return 'Node';
    case 'edge': return 'Edge';
    case 'bom_item': return 'BOM';
    case 'general': return 'General';
    default: return type;
  }
}

// ---------------------------------------------------------------------------
// CommentItem
// ---------------------------------------------------------------------------

interface CommentItemProps {
  comment: DesignComment;
  replies: DesignComment[];
  allComments: DesignComment[];
  depth: number;
  onReply: (parentId: number) => void;
  onResolve: (id: number) => void;
  onUnresolve: (id: number) => void;
  onDelete: (id: number) => void;
}

function CommentItem({
  comment,
  replies,
  allComments,
  depth,
  onReply,
  onResolve,
  onUnresolve,
  onDelete,
}: CommentItemProps) {
  const isResolved = comment.resolved;

  return (
    <div
      className={cn('group', depth > 0 && 'ml-4 border-l border-zinc-700 pl-3')}
      data-testid={`comment-item-${comment.id}`}
    >
      <div className={cn(
        'rounded-md px-3 py-2 transition-colors',
        isResolved ? 'bg-zinc-900/50' : 'bg-zinc-800/60',
      )}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2 min-w-0">
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 shrink-0',
                isResolved ? 'border-green-700 text-green-400' : 'border-zinc-600 text-zinc-400',
              )}
              data-testid={`comment-target-badge-${comment.id}`}
            >
              {targetLabel(comment.targetType)}
            </Badge>
            {comment.targetId && (
              <span className="text-[10px] text-zinc-500 truncate" data-testid={`comment-target-id-${comment.id}`}>
                {comment.targetId}
              </span>
            )}
          </div>
          <span className="text-[10px] text-zinc-500 shrink-0" data-testid={`comment-time-${comment.id}`}>
            {relativeTime(comment.createdAt)}
          </span>
        </div>

        {/* Content */}
        <p
          className={cn(
            'text-sm whitespace-pre-wrap break-words',
            isResolved ? 'text-zinc-500 line-through' : 'text-zinc-200',
          )}
          data-testid={`comment-content-${comment.id}`}
        >
          {comment.content}
        </p>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-zinc-400 hover:text-[#00F0FF]"
            onClick={() => { onReply(comment.id); }}
            data-testid={`comment-reply-btn-${comment.id}`}
          >
            <Reply className="h-3 w-3 mr-1" />
            Reply
          </Button>

          {isResolved ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-green-400 hover:text-yellow-400"
              onClick={() => { onUnresolve(comment.id); }}
              data-testid={`comment-unresolve-btn-${comment.id}`}
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reopen
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-zinc-400 hover:text-green-400"
              onClick={() => { onResolve(comment.id); }}
              data-testid={`comment-resolve-btn-${comment.id}`}
            >
              <Check className="h-3 w-3 mr-1" />
              Resolve
            </Button>
          )}

          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-zinc-400 hover:text-red-400"
                data-testid={`comment-delete-btn-${comment.id}`}
                aria-label="Delete comment"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            }
            title="Delete Comment"
            description="Are you sure you want to delete this comment? This action cannot be undone."
            confirmLabel="Delete"
            variant="destructive"
            onConfirm={() => { onDelete(comment.id); }}
          />
        </div>
      </div>

      {/* Nested replies */}
      {replies.length > 0 && (
        <div className="mt-1 space-y-1">
          {replies.map((reply) => {
            const childReplies = allComments.filter((c) => c.parentId === reply.id);
            return (
              <CommentItem
                key={reply.id}
                comment={reply}
                replies={childReplies}
                allComments={allComments}
                depth={depth + 1}
                onReply={onReply}
                onResolve={onResolve}
                onUnresolve={onUnresolve}
                onDelete={onDelete}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CommentsPanel
// ---------------------------------------------------------------------------

export function CommentsPanel({ projectId }: CommentsPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [resolvedFilter, setResolvedFilter] = useState<ResolvedFilter>('all');
  const [targetFilter, setTargetFilter] = useState<TargetFilter>('all');
  const [newContent, setNewContent] = useState('');
  const [replyToId, setReplyToId] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Build query string with filters
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (resolvedFilter === 'resolved') { params.set('resolved', 'true'); }
    if (resolvedFilter === 'unresolved') { params.set('resolved', 'false'); }
    if (targetFilter !== 'all') { params.set('targetType', targetFilter); }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }, [resolvedFilter, targetFilter]);

  const commentsQuery = useQuery<{ data: DesignComment[]; total: number }>({
    queryKey: [`/api/projects/${projectId}/comments${queryParams}`],
    queryFn: getQueryFn({ on401: 'throw' }),
    staleTime: 30_000,
  });

  const comments = commentsQuery.data?.data ?? [];

  // Build thread tree: top-level comments (no parentId)
  const topLevelComments = useMemo(
    () => comments.filter((c) => !c.parentId),
    [comments],
  );

  const invalidateComments = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/comments`], exact: false });
  }, [queryClient, projectId]);

  // --- Mutations ---

  const createMutation = useMutation({
    mutationFn: async (body: { content: string; parentId?: number | null }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/comments`, body);
      return res.json() as Promise<DesignComment>;
    },
    onSuccess: () => {
      setNewContent('');
      setReplyToId(null);
      invalidateComments();
      toast({ title: 'Comment added' });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/comments/${id}/resolve`);
      return res.json() as Promise<DesignComment>;
    },
    onSuccess: () => {
      invalidateComments();
    },
  });

  const unresolveMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/comments/${id}/unresolve`);
      return res.json() as Promise<DesignComment>;
    },
    onSuccess: () => {
      invalidateComments();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest('DELETE', `/api/projects/${projectId}/comments/${id}`);
    },
    onSuccess: () => {
      invalidateComments();
      toast({ title: 'Comment deleted' });
    },
  });

  // --- Handlers ---

  const handleSubmit = useCallback(() => {
    const trimmed = newContent.trim();
    if (!trimmed) { return; }
    createMutation.mutate({ content: trimmed, parentId: replyToId });
  }, [newContent, replyToId, createMutation]);

  const handleReply = useCallback((parentId: number) => {
    setReplyToId(parentId);
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyToId(null);
  }, []);

  // Find the parent comment we're replying to for display
  const replyTarget = replyToId ? comments.find((c) => c.id === replyToId) : null;

  // --- Stats ---
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const unresolvedCount = comments.length - resolvedCount;

  return (
    <div className="flex flex-col h-full bg-zinc-950" data-testid="comments-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-[#00F0FF]" />
          <h2 className="text-sm font-semibold text-zinc-100" data-testid="comments-panel-title">
            Design Review
          </h2>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0" data-testid="comments-total-badge">
            {comments.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-7 px-2 text-xs',
            showFilters ? 'text-[#00F0FF]' : 'text-zinc-400',
          )}
          onClick={() => { setShowFilters((prev) => !prev); }}
          data-testid="comments-filter-toggle"
        >
          <Filter className="h-3 w-3 mr-1" />
          Filter
          <ChevronDown className={cn('h-3 w-3 ml-1 transition-transform', showFilters && 'rotate-180')} />
        </Button>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="px-4 py-2 border-b border-zinc-800 space-y-2" data-testid="comments-filter-bar">
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 w-14 shrink-0">Status:</span>
            {(['all', 'unresolved', 'resolved'] as ResolvedFilter[]).map((f) => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2 text-[10px] capitalize',
                  resolvedFilter === f ? 'text-[#00F0FF] bg-zinc-800' : 'text-zinc-400',
                )}
                onClick={() => { setResolvedFilter(f); }}
                data-testid={`comments-filter-status-${f}`}
              >
                {f}
                {f === 'resolved' && <span className="ml-1 text-green-400">({resolvedCount})</span>}
                {f === 'unresolved' && <span className="ml-1 text-yellow-400">({unresolvedCount})</span>}
              </Button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-zinc-500 w-14 shrink-0">Target:</span>
            {(['all', 'general', 'node', 'edge', 'bom_item'] as TargetFilter[]).map((f) => (
              <Button
                key={f}
                variant="ghost"
                size="sm"
                className={cn(
                  'h-6 px-2 text-[10px] capitalize',
                  targetFilter === f ? 'text-[#00F0FF] bg-zinc-800' : 'text-zinc-400',
                )}
                onClick={() => { setTargetFilter(f); }}
                data-testid={`comments-filter-target-${f}`}
              >
                {f === 'bom_item' ? 'BOM' : f}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Comment list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-2" data-testid="comments-list">
          {commentsQuery.isLoading && (
            <p className="text-xs text-zinc-500 text-center py-8" data-testid="comments-loading">Loading comments...</p>
          )}
          {commentsQuery.isError && (
            <p className="text-xs text-red-400 text-center py-8" data-testid="comments-error">Failed to load comments</p>
          )}
          {!commentsQuery.isLoading && !commentsQuery.isError && topLevelComments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500" data-testid="comments-empty">
              <MessageSquare className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-xs">No comments yet</p>
              <p className="text-[10px] mt-1">Start a design review conversation</p>
            </div>
          )}
          {topLevelComments.map((comment) => {
            const replies = comments.filter((c) => c.parentId === comment.id);
            return (
              <CommentItem
                key={comment.id}
                comment={comment}
                replies={replies}
                allComments={comments}
                depth={0}
                onReply={handleReply}
                onResolve={(id) => { resolveMutation.mutate(id); }}
                onUnresolve={(id) => { unresolveMutation.mutate(id); }}
                onDelete={(id) => { deleteMutation.mutate(id); }}
              />
            );
          })}
        </div>
      </ScrollArea>

      <Separator className="bg-zinc-800" />

      {/* Compose area */}
      <div className="px-3 py-3 space-y-2" data-testid="comments-compose">
        {replyTarget && (
          <div className="flex items-center justify-between rounded bg-zinc-800/50 px-2 py-1" data-testid="comments-reply-indicator">
            <span className="text-[10px] text-zinc-400 truncate">
              Replying to: <span className="text-zinc-300">{replyTarget.content.slice(0, 60)}{replyTarget.content.length > 60 ? '...' : ''}</span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-[10px] text-zinc-500 hover:text-zinc-300"
              onClick={handleCancelReply}
              data-testid="comments-cancel-reply"
            >
              Cancel
            </Button>
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            placeholder={replyToId ? 'Write a reply...' : 'Add a comment...'}
            aria-label={replyToId ? 'Write a reply' : 'Add a comment'}
            className="min-h-[60px] max-h-[120px] resize-none bg-zinc-900 border-zinc-700 text-sm text-zinc-200 placeholder:text-zinc-500 focus-visible:ring-[#00F0FF]/30"
            value={newContent}
            onChange={(e) => { setNewContent(e.target.value); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit();
              }
            }}
            data-testid="comments-textarea"
          />
          <Button
            size="sm"
            className="h-auto self-end bg-[#00F0FF]/10 text-[#00F0FF] hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30"
            disabled={!newContent.trim() || createMutation.isPending}
            onClick={handleSubmit}
            data-testid="comments-submit-btn"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-zinc-600" data-testid="comments-shortcut-hint">
          Ctrl+Enter to submit
        </p>
      </div>
    </div>
  );
}
