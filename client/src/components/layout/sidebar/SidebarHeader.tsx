import { memo } from 'react';
import { Layers, X, LogOut, Contrast, Palette, MoreHorizontal } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth-context';
import { useHighContrast } from '@/hooks/useHighContrast';
import ThemePickerPanel from '@/components/panels/ThemePickerPanel';

interface SidebarHeaderProps {
  onClose: () => void;
}

const SidebarHeader = memo(function SidebarHeader({ onClose }: SidebarHeaderProps) {
  const { user, logout } = useAuth();
  const { enabled: highContrast, toggle: toggleHighContrast } = useHighContrast();

  return (
    <div data-testid="header-branding" className="flex h-10 items-center gap-1.5 border-b border-sidebar-border/80 bg-sidebar/15 px-2">
      <div className="w-5 h-5 bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_6px_rgba(6,182,212,0.1)] shrink-0">
        <Layers className="w-3.5 h-3.5 text-primary" />
      </div>
      <div className="flex flex-col justify-center flex-1 min-w-0">
        <span className="truncate font-display text-[11px] font-bold leading-none">ProtoPulse</span>
        <span className="text-[10px] text-muted-foreground/75 uppercase tracking-[0.08em] mt-0.5 truncate" title={user ? user.username : 'System Architect'}>
          {user ? user.username : 'System Architect'}
        </span>
      </div>
      <Popover>
        <StyledTooltip content="Color theme" side="bottom">
          <PopoverTrigger asChild>
            <button
              data-testid="button-theme-picker"
              aria-label="Open color theme picker"
              className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <Palette className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
        </StyledTooltip>
        <PopoverContent
          side="bottom"
          align="end"
          sideOffset={8}
          className="w-80"
        >
          <ThemePickerPanel />
        </PopoverContent>
      </Popover>
      <DropdownMenu>
        <StyledTooltip content="More sidebar actions" side="bottom">
          <DropdownMenuTrigger asChild>
            <button
              data-testid="button-sidebar-more"
              aria-label="More sidebar actions"
              className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>
          </DropdownMenuTrigger>
        </StyledTooltip>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            data-testid="toggle-high-contrast"
            className="flex items-center gap-2"
            onSelect={(e) => {
              e.preventDefault();
              toggleHighContrast();
            }}
          >
            <Contrast className={highContrast ? 'w-4 h-4 text-primary' : 'w-4 h-4'} />
            <span>{highContrast ? 'Disable High Contrast' : 'Enable High Contrast'}</span>
          </DropdownMenuItem>
          {user && (
            <DropdownMenuItem
              data-testid="button-logout"
              className="flex items-center gap-2 text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                void logout();
              }}
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <StyledTooltip content="Close sidebar" side="bottom">
        <button
          data-testid="sidebar-close"
          aria-label="Close sidebar"
          className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground md:hidden"
          onClick={onClose}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </StyledTooltip>
    </div>
  );
});

export default SidebarHeader;
