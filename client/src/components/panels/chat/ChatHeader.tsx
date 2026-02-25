import { Sparkles, Search, Download, Settings2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';

interface ChatHeaderProps {
  onSearch: () => void;
  onExport: () => void;
  onSettings: () => void;
  onClose: () => void;
  showSearch: boolean;
  showSettings: boolean;
}

export default function ChatHeader({
  onSearch,
  onExport,
  onSettings,
  onClose,
  showSearch,
  showSettings,
}: ChatHeaderProps) {
  return (
    <div className="h-14 border-b border-border bg-card/30 backdrop-blur flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold tracking-wider text-sm">ProtoPulse AI</h3>
      </div>
      <div className="flex gap-1 items-center">
        <StyledTooltip content="Search chat" side="bottom">
            <button data-testid="chat-search-toggle" onClick={onSearch} className={cn("p-1.5 hover:bg-muted transition-colors", showSearch && "text-primary bg-primary/10")}>
              <Search className="w-4 h-4" />
            </button>
        </StyledTooltip>
        <StyledTooltip content="Export chat" side="bottom">
            <button data-testid="chat-export" onClick={onExport} className="p-1.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Download className="w-4 h-4" />
            </button>
        </StyledTooltip>
        <StyledTooltip content="AI Settings" side="bottom">
            <button
              data-testid="settings-button"
              className={cn("p-1.5 hover:bg-muted transition-colors", showSettings && "text-primary bg-primary/10")}
              onClick={onSettings}
            >
              <Settings2 className="w-4 h-4" />
            </button>
        </StyledTooltip>
        <StyledTooltip content="Close (Esc)" side="bottom">
            <button data-testid="chat-close" className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-1 md:hidden" onClick={onClose}>
              <X className="w-4 h-4" />
            </button>
        </StyledTooltip>
      </div>
    </div>
  );
}
