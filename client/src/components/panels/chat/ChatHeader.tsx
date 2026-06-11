import { memo } from 'react';
import { Sparkles, Search, Download, Settings2, X, GitBranch, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import ConnectionStatusDot from './ConnectionStatusDot';
import type { ChatBranch } from '@/lib/contexts/chat-context';
import type { KeyStatus } from '@/hooks/useApiKeyStatus';

interface ChatHeaderProps {
  onSearch: () => void;
  onExport: () => void;
  onSettings: () => void;
  onClose: () => void;
  showSearch: boolean;
  showSettings: boolean;
  branches: ChatBranch[];
  activeBranchId: string | null;
  onBranchSelect: (branchId: string | null) => void;
  keyStatus: KeyStatus;
  hasKey: boolean;
}

function ChatHeader({
  onSearch,
  onExport,
  onSettings,
  onClose,
  showSearch,
  showSettings,
  branches,
  activeBranchId,
  onBranchSelect,
  keyStatus,
  hasKey,
}: ChatHeaderProps) {
  return (
    <div className="h-10 border-b border-border bg-card/30 backdrop-blur flex items-center justify-between px-2 shrink-0">
      <div className="flex items-center gap-1 min-w-0">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <h3 className="font-display font-bold tracking-wide text-[12px]">ProtoPulse AI</h3>
        <ConnectionStatusDot keyStatus={keyStatus} hasKey={hasKey} />
        {branches.length > 0 && (
          <div className="relative ml-0.5 min-w-0">
            <label htmlFor="branch-selector" className="sr-only">Select conversation branch</label>
            <select
              id="branch-selector"
              data-testid="branch-selector"
              value={activeBranchId ?? ''}
              onChange={(e) => onBranchSelect(e.target.value || null)}
              className="appearance-none max-w-[112px] bg-muted/50 border border-border text-[10px] pl-5 pr-5 py-0.5 cursor-pointer hover:bg-muted transition-colors text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
            >
              <option value="">Main</option>
              {branches.map((b) => (
                <option key={b.branchId} value={b.branchId}>
                  Branch ({b.messageCount} msgs)
                </option>
              ))}
            </select>
            <GitBranch className="w-2.5 h-2.5 absolute left-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <ChevronDown className="w-2.5 h-2.5 absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        )}
      </div>
      <div className="flex gap-0.5 items-center shrink-0">
        <StyledTooltip content="Search chat" side="bottom">
            <button type="button" data-testid="chat-search-toggle" onClick={onSearch} aria-label="Search chat" className={cn("w-6.5 h-6.5 rounded-sm flex items-center justify-center hover:bg-muted transition-colors", showSearch && "text-primary bg-primary/10")}>
              <Search className="w-3.5 h-3.5" />
            </button>
        </StyledTooltip>
        <StyledTooltip content="Export chat" side="bottom">
            <button type="button" data-testid="chat-export" onClick={onExport} aria-label="Export chat" className="w-6.5 h-6.5 rounded-sm flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Download className="w-3.5 h-3.5" />
            </button>
        </StyledTooltip>
        <StyledTooltip content="AI Settings" side="bottom">
            <button
              type="button"
              data-testid="settings-button"
              aria-label="Chat settings"
              className={cn("w-6.5 h-6.5 rounded-sm flex items-center justify-center hover:bg-muted transition-colors", showSettings && "text-primary bg-primary/10")}
              onClick={onSettings}
            >
              <Settings2 className="w-3.5 h-3.5" />
            </button>
        </StyledTooltip>
        <StyledTooltip content="Close (Esc)" side="bottom">
            <button type="button" data-testid="chat-close" aria-label="Close chat" className="w-6.5 h-6.5 rounded-sm flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-0.5 md:hidden" onClick={onClose}>
              <X className="w-3.5 h-3.5" />
            </button>
        </StyledTooltip>
      </div>
    </div>
  );
}

export default memo(ChatHeader);
