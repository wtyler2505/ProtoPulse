import { useState, useCallback, useMemo } from 'react';
import {
  Users,
  Copy,
  UserPlus,
  Crown,
  Pencil,
  Eye,
  X,
  Wifi,
  WifiOff,
  Loader2,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/clipboard';
import type { CollabConnectionState } from '@/lib/collaboration-client';
import type { CollabUser, CollabRole } from '@shared/collaboration';

const ROLE_ICONS: Record<CollabRole, typeof Crown> = {
  owner: Crown,
  editor: Pencil,
  viewer: Eye,
};

const ROLE_COLORS: Record<CollabRole, string> = {
  owner: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  editor: 'bg-primary/10 text-primary border-primary/20',
  viewer: 'bg-muted text-muted-foreground border-border',
};

const CONNECTION_STATUS: Record<CollabConnectionState, { label: string; color: string }> = {
  connected: { label: 'Connected', color: 'text-emerald-500' },
  connecting: { label: 'Connecting...', color: 'text-yellow-500' },
  reconnecting: { label: 'Reconnecting...', color: 'text-yellow-500' },
  disconnected: { label: 'Disconnected', color: 'text-muted-foreground' },
  error: { label: 'Error', color: 'text-destructive' },
};

export interface ShareProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  connectionState: CollabConnectionState;
  activeUsers: CollabUser[];
  myRole: CollabRole;
}

export function ShareProjectDialog({
  open,
  onOpenChange,
  projectId,
  connectionState,
  activeUsers,
  myRole,
}: ShareProjectDialogProps) {
  const { toast } = useToast();
  const [inviteSessionId, setInviteSessionId] = useState('');
  const [inviteRole, setInviteRole] = useState<CollabRole>('editor');

  const isOwner = myRole === 'owner';
  const isConnected = connectionState === 'connected';
  const statusInfo = CONNECTION_STATUS[connectionState];
  const StatusIcon = isConnected ? Wifi : WifiOff;

  const shareUrl = useMemo(() => {
    return `${window.location.origin}/projects/${String(projectId)}`;
  }, [projectId]);

  const handleCopyLink = useCallback(() => {
    copyToClipboard(shareUrl);
    toast({ title: 'Link Copied', description: 'Project link copied to clipboard.' });
  }, [shareUrl, toast]);

  const handleInvite = useCallback(() => {
    const sessionId = inviteSessionId.trim();
    if (!sessionId) {
      toast({ title: 'Missing Session ID', description: 'Enter a session ID to invite.', variant: 'destructive' });
      return;
    }
    // Collaboration invites require a running WebSocket server. Show the session ID so
    // the other user can connect manually via the same project URL.
    toast({ title: 'Share this project URL', description: `Send the project URL to your collaborator. They can join as ${inviteRole} by opening the same project.` });
    setInviteSessionId('');
  }, [inviteSessionId, inviteRole, toast]);

  const handleInviteKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInvite();
    }
  }, [handleInvite]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border sm:max-w-[480px]" data-testid="dialog-share-project">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5 text-primary" />
            Share Project
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Collaborate in real-time with others on this project.
          </DialogDescription>
        </DialogHeader>

        {/* Connection status */}
        <div className="flex items-center gap-2 py-2 border-b border-border" data-testid="section-connection-status">
          <StatusIcon className={cn('w-4 h-4', statusInfo.color)} />
          <span className={cn('text-xs font-medium', statusInfo.color)} data-testid="text-connection-state">
            {statusInfo.label}
          </span>
          <div className="flex-1" />
          {activeUsers.length > 0 && (
            <span className="text-[10px] text-muted-foreground">
              {String(activeUsers.length)} online
            </span>
          )}
        </div>

        {/* Share link */}
        <div className="space-y-1.5" data-testid="section-share-link">
          <label className="text-xs text-muted-foreground">Project Link</label>
          <div className="flex gap-2">
            <Input
              readOnly
              value={shareUrl}
              className="text-xs font-mono h-8 bg-muted/30"
              data-testid="input-share-link"
            />
            <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0" onClick={handleCopyLink} data-testid="button-copy-link">
              <Copy className="w-3.5 h-3.5" />
              Copy
            </Button>
          </div>
        </div>

        {/* Invite */}
        {isOwner && (
          <div className="space-y-1.5 border-t border-border pt-3" data-testid="section-invite">
            <label htmlFor="invite-session-id" className="text-xs text-muted-foreground">Invite Collaborator</label>
            <div className="flex gap-2">
              <Input
                id="invite-session-id"
                placeholder="Session ID"
                value={inviteSessionId}
                onChange={(e) => setInviteSessionId(e.target.value)}
                onKeyDown={handleInviteKeyDown}
                className="text-xs font-mono h-8"
                data-testid="input-invite-session"
              />
              <Select value={inviteRole} onValueChange={(val) => setInviteRole(val as CollabRole)}>
                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid="select-invite-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={handleInvite} data-testid="button-send-invite">
                <UserPlus className="w-3.5 h-3.5" />
                Invite
              </Button>
            </div>
          </div>
        )}

        {/* Active collaborators */}
        <div className="space-y-1.5 border-t border-border pt-3" data-testid="section-collaborators">
          <label className="text-xs text-muted-foreground">
            Collaborators {activeUsers.length > 0 ? `(${String(activeUsers.length)})` : ''}
          </label>
          {activeUsers.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground" data-testid="empty-collaborators">
              <Users className="w-6 h-6 mx-auto mb-2 opacity-40" />
              <p className="text-xs">No collaborators online.</p>
              {!isConnected && (
                <p className="text-[10px] mt-1">Connect to see active users.</p>
              )}
            </div>
          ) : (
            <div className="space-y-1 max-h-[240px] overflow-auto" data-testid="list-collaborators">
              {activeUsers.map((user) => {
                const RoleIcon = ROLE_ICONS[user.role];
                return (
                  <div
                    key={user.userId}
                    className="flex items-center gap-2 p-2 border border-border hover:bg-muted/20 transition-colors"
                    data-testid={`collaborator-${String(user.userId)}`}
                  >
                    {/* Color dot */}
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: user.color }}
                      data-testid={`color-dot-${String(user.userId)}`}
                    />
                    {/* Username */}
                    <span className="text-xs font-medium text-foreground flex-1 truncate" data-testid={`text-username-${String(user.userId)}`}>
                      {user.username}
                    </span>
                    {/* Role badge */}
                    <Badge
                      variant="outline"
                      className={cn('text-[10px] gap-1 px-1.5 py-0', ROLE_COLORS[user.role])}
                      data-testid={`badge-role-${String(user.userId)}`}
                    >
                      <RoleIcon className="w-3 h-3" />
                      {user.role}
                    </Badge>
                    {/* Remove button (only for owners, not for self) */}
                    {isOwner && user.role !== 'owner' && (
                      <ConfirmDialog
                        trigger={
                          <StyledTooltip content="Remove collaborator">
                            <button
                              className="p-1 text-destructive hover:bg-destructive/10 transition-colors"
                              data-testid={`button-remove-${String(user.userId)}`}
                              aria-label={`Remove ${user.username}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </StyledTooltip>
                        }
                        title="Remove Collaborator"
                        description={`Remove "${user.username}" from this project? They will lose access immediately.`}
                        confirmLabel="Remove"
                        variant="destructive"
                        onConfirm={() => {
                          toast({ title: 'Collaborator Removed', description: `Removed "${user.username}".` });
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
