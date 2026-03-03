import { memo } from 'react';
import { Layers, X, LogOut, Contrast } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { useAuth } from '@/lib/auth-context';
import { useHighContrast } from '@/hooks/useHighContrast';

interface SidebarHeaderProps {
  onClose: () => void;
}

const SidebarHeader = memo(function SidebarHeader({ onClose }: SidebarHeaderProps) {
  const { user, logout } = useAuth();
  const { enabled: highContrast, toggle: toggleHighContrast } = useHighContrast();

  return (
    <div data-testid="header-branding" className="h-14 border-b border-sidebar-border flex items-center px-4 gap-3 bg-sidebar/20">
      <div className="w-8 h-8 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] shrink-0">
        <Layers className="w-5 h-5 text-primary" />
      </div>
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span className="font-display font-bold text-lg leading-none tracking-tight truncate">ProtoPulse</span>
        <span className="text-[10px] text-muted-foreground/80 uppercase tracking-[0.2em] mt-1">
          {user ? user.username : 'System Architect'}
        </span>
      </div>
      <StyledTooltip content={highContrast ? 'Disable high contrast' : 'Enable high contrast'} side="bottom">
        <button
          data-testid="toggle-high-contrast"
          aria-label={highContrast ? 'Disable high-contrast mode' : 'Enable high-contrast mode'}
          aria-pressed={highContrast}
          className={`p-1.5 hover:bg-muted transition-colors ${highContrast ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          onClick={toggleHighContrast}
        >
          <Contrast className="w-4 h-4" />
        </button>
      </StyledTooltip>
      {user && (
        <StyledTooltip content="Sign out" side="bottom">
          <button
            data-testid="button-logout"
            aria-label="Sign out"
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-destructive transition-colors"
            onClick={() => void logout()}
          >
            <LogOut className="w-4 h-4" />
          </button>
        </StyledTooltip>
      )}
      <StyledTooltip content="Close sidebar" side="bottom">
        <button
          data-testid="sidebar-close"
          aria-label="Close sidebar"
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden"
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </button>
      </StyledTooltip>
    </div>
  );
});

export default SidebarHeader;
