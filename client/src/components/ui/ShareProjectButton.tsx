/**
 * BL-0549: Collaboration share button with avatar stack.
 *
 * Shows active collaborator avatars (with overflow "+N" indicator) and
 * opens the ShareProjectDialog on click. Designed for the workspace header.
 */

import { useState, useMemo, useCallback } from 'react';
import { Users, Share2 } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ShareProjectDialog } from '@/components/dialogs/ShareProjectDialog';
import { getInitials, computeAvatarOverflow } from '@/lib/collaboration-share';
import { cn } from '@/lib/utils';
import type { CollabConnectionState } from '@/lib/collaboration-client';
import type { CollabUser, CollabRole } from '@shared/collaboration';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ShareProjectButtonProps {
  projectId: number;
  connectionState: CollabConnectionState;
  activeUsers: CollabUser[];
  myRole: CollabRole;
}

/* ------------------------------------------------------------------ */
/*  Connection dot color mapping                                       */
/* ------------------------------------------------------------------ */

const CONNECTION_DOT_COLORS: Record<CollabConnectionState, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-yellow-500 animate-pulse',
  reconnecting: 'bg-yellow-500 animate-pulse',
  disconnected: 'bg-muted-foreground/40',
  error: 'bg-destructive',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ShareProjectButton({
  projectId,
  connectionState,
  activeUsers,
  myRole,
}: ShareProjectButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const { visible, overflowCount } = useMemo(
    () => computeAvatarOverflow(activeUsers.length),
    [activeUsers.length],
  );

  const visibleUsers = useMemo(
    () => activeUsers.slice(0, visible),
    [activeUsers, visible],
  );

  const handleClick = useCallback(() => {
    setDialogOpen(true);
  }, []);

  const tooltipText = activeUsers.length > 0
    ? `${String(activeUsers.length)} collaborator${activeUsers.length !== 1 ? 's' : ''} online`
    : 'Share project';

  return (
    <>
      <StyledTooltip content={tooltipText} side="bottom">
        <button
          data-testid="button-share-project"
          onClick={handleClick}
          className={cn(
            'flex items-center gap-1.5 px-2 py-1.5 rounded-sm transition-colors',
            'hover:bg-muted/50 text-muted-foreground hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          )}
          aria-label={tooltipText}
        >
          {/* Avatar stack */}
          {visibleUsers.length > 0 ? (
            <div className="flex items-center -space-x-1.5" data-testid="avatar-stack">
              {visibleUsers.map((user) => (
                <div
                  key={user.userId}
                  className="w-6 h-6 rounded-full border-2 border-background flex items-center justify-center text-[9px] font-bold shrink-0"
                  style={{ backgroundColor: user.color, color: '#fff' }}
                  title={`${user.username} (${user.role})`}
                  data-testid={`avatar-${String(user.userId)}`}
                >
                  {getInitials(user.username)}
                </div>
              ))}
              {overflowCount > 0 && (
                <div
                  className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0"
                  data-testid="avatar-overflow"
                >
                  +{String(overflowCount)}
                </div>
              )}
            </div>
          ) : (
            <Share2 className="w-4 h-4" data-testid="icon-share" />
          )}

          {/* Connection status dot */}
          <div
            className={cn('w-2 h-2 rounded-full shrink-0', CONNECTION_DOT_COLORS[connectionState])}
            data-testid="connection-dot"
          />
        </button>
      </StyledTooltip>

      <ShareProjectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        connectionState={connectionState}
        activeUsers={activeUsers}
        myRole={myRole}
      />
    </>
  );
}
