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
  const primaryMobileTabIds = useMemo(() => new Set<ViewMode>(['dashboard', 'architecture', 'schematic', 'component_editor', 'procurement']), []);
  const primaryMobileTabs = useMemo(() => visibleTabs.filter(t => primaryMobileTabIds.has(t.view)), [visibleTabs, primaryMobileTabIds]);
  const secondaryMobileTabs = useMemo(() => visibleTabs.filter(t => !primaryMobileTabIds.has(t.view)), [visibleTabs, primaryMobileTabIds]);

  return (
    <div data-testid="mobile-bottom-nav" className="h-16 border-t border-border bg-card/60 backdrop-blur-xl flex items-center justify-around lg:hidden px-2">
      {primaryMobileTabs.map((tab) => (
        <button
          key={tab.view}
          data-testid={`bottom-nav-${tab.view}`}
          onClick={() => setActiveView(tab.view)}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 transition-colors relative min-w-[44px] min-h-[44px] rounded-md',
            activeView === tab.view
              ? 'text-primary bg-primary/10'
              : 'text-muted-foreground'
          )}
        >
          {activeView === tab.view && (
            <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-b-full" />
          )}
          {tab.icon && <tab.icon className="w-5 h-5" />}
          <span className="text-[10px] font-medium leading-tight truncate max-w-[60px]">{tab.label}</span>
        </button>
      ))}
      <Popover open={ws.moreMenuOpen} onOpenChange={(open: boolean) => dispatch({ type: 'SET_MORE_MENU_OPEN', open })}>
        <PopoverTrigger asChild>
          <button
            data-testid="bottom-nav-more"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 transition-colors relative min-w-[44px] min-h-[44px] rounded-md',
              secondaryMobileTabs.some(t => t.view === activeView)
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground'
            )}
          >
            {secondaryMobileTabs.some(t => t.view === activeView) && (
              <div className="absolute top-0 inset-x-2 h-[2px] bg-primary rounded-b-full" />
            )}
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="end" className="w-48 p-1">
          {secondaryMobileTabs.map((tab) => (
            <button
              key={tab.view}
              data-testid={`bottom-nav-${tab.view}`}
              onClick={() => {
                setActiveView(tab.view);
                dispatch({ type: 'SET_MORE_MENU_OPEN', open: false });
              }}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 text-sm rounded-md transition-colors',
                activeView === tab.view
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab.icon && <tab.icon className="w-4 h-4 shrink-0" />}
              {tab.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
