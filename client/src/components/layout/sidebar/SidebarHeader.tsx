import { Layers, X } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';

interface SidebarHeaderProps {
  onClose: () => void;
}

export default function SidebarHeader({ onClose }: SidebarHeaderProps) {
  return (
    <div className="h-14 border-b border-sidebar-border flex items-center px-4 gap-3 bg-sidebar/20">
      <div className="w-8 h-8 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] shrink-0">
        <Layers className="w-5 h-5 text-primary" />
      </div>
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span className="font-display font-bold text-lg leading-none tracking-tight truncate">ProtoPulse</span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-1">System Architect</span>
      </div>
      <StyledTooltip content="Close sidebar" side="bottom">
        <button
          data-testid="sidebar-close"
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </StyledTooltip>
    </div>
  );
}
