import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { MoreHorizontal } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { navItems, alwaysVisibleIds } from '@/components/layout/sidebar/sidebar-constants';
import { useArchitecture } from '@/lib/project-context';
import type { ViewMode } from '@/lib/project-context';
import type { WorkspaceState, WorkspaceAction } from './workspace-reducer';

interface MobileNavProps {
  ws: WorkspaceState;
  dispatch: React.Dispatch<WorkspaceAction>;
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;
}

export function MobileNav({ ws, dispatch, activeView, setActiveView }: MobileNavProps) {
  const { nodes } = useArchitecture();
  const hasDesignContent = (nodes ?? []).length > 0;

  const visibleTabs = useMemo(
    () => navItems.filter(t => t.view !== 'project_explorer' && (alwaysVisibleIds.has(t.view) || hasDesignContent)),
    [hasDesignContent]
  );

  /* RS-02: Mobile bottom nav primary/secondary split */
  const primaryMobileTabIds = useMemo(() => new Set<ViewMode>(['dashboard', 'architecture', 'schematic', 'pcb']), []);
  const primaryMobileTabs = useMemo(() => visibleTabs.filter(t => primaryMobileTabIds.has(t.view)), [visibleTabs, primaryMobileTabIds]);
  const secondaryMobileTabs = useMemo(() => visibleTabs.filter(t => !primaryMobileTabIds.has(t.view)), [visibleTabs, primaryMobileTabIds]);

  return (
    <div data-testid="mobile-bottom-nav" className="flex h-13 items-center justify-around border-t border-border bg-card/60 px-1 backdrop-blur-xl lg:hidden">
      {primaryMobileTabs.map((tab) => (
        <button
          key={tab.view}
          data-testid={`bottom-nav-${tab.view}`}
          onClick={() => setActiveView(tab.view)}
          className={cn(
            'relative flex min-h-[40px] min-w-[40px] flex-col items-center justify-center gap-0.5 rounded-sm px-1 py-0.5 transition-colors',
            activeView === tab.view
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground'
          )}
        >
          {activeView === tab.view && (
            <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-b-full" />
          )}
          {tab.icon && <tab.icon className="w-3.5 h-3.5" />}
          <span className="max-w-[58px] truncate text-[10px] font-medium leading-tight">{tab.label}</span>
        </button>
      ))}
      <Popover open={ws.moreMenuOpen} onOpenChange={(open: boolean) => dispatch({ type: 'SET_MORE_MENU_OPEN', open })}>
        <PopoverTrigger asChild>
          <button
            data-testid="bottom-nav-more"
            className={cn(
              'relative flex min-h-[40px] min-w-[40px] flex-col items-center justify-center gap-0.5 rounded-sm px-1 py-0.5 transition-colors',
              secondaryMobileTabs.some(t => t.view === activeView)
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground'
            )}
          >
            {secondaryMobileTabs.some(t => t.view === activeView) && (
              <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-b-full" />
            )}
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-48 max-h-[min(360px,calc(100vh-96px))] overflow-y-auto scrollbar-gutter-stable p-1.5">
          {secondaryMobileTabs.map((tab) => (
            <button
              key={tab.view}
              data-testid={`bottom-nav-${tab.view}`}
              onClick={() => {
                setActiveView(tab.view);
                dispatch({ type: 'SET_MORE_MENU_OPEN', open: false });
              }}
              className={cn(
                'flex h-8 w-full items-center rounded-sm px-2.5 text-[11px] transition-colors',
                activeView === tab.view
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
