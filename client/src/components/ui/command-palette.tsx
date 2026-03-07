import { useEffect, useCallback, useState } from 'react';
import { Command } from 'cmdk';
import {
  LayoutGrid,
  CircuitBoard,
  Grid3X3,
  Microchip,
  Cpu,
  Package,
  Activity,
  TerminalSquare,
  PanelLeftClose,
  PanelLeftOpen,
  MessageCircle,
  ShieldCheck,
  FileOutput,
  FlaskConical,
  KanbanSquare,
  BookMarked,
  Box,
  Globe,
  ShoppingBag,
  Warehouse,
  Code2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/lib/project-context';

interface CommandPaletteProps {
  onNavigate: (view: ViewMode) => void;
  onToggleSidebar: () => void;
  onToggleChat: () => void;
  onRunDrc: () => void;
  sidebarCollapsed: boolean;
  chatCollapsed: boolean;
}

interface CommandItemDef {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  shortcut?: string;
  action: () => void;
  keywords?: string[];
}

export default function CommandPalette({
  onNavigate,
  onToggleSidebar,
  onToggleChat,
  onRunDrc,
  sidebarCollapsed,
  chatCollapsed,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = useCallback((action: () => void) => {
    action();
    setOpen(false);
  }, []);

  const navigateItems: CommandItemDef[] = [
    { id: 'nav-architecture', label: 'Architecture', icon: LayoutGrid, shortcut: '1', action: () => onNavigate('architecture'), keywords: ['block', 'diagram'] },
    { id: 'nav-schematic', label: 'Schematic', icon: CircuitBoard, shortcut: '2', action: () => onNavigate('schematic'), keywords: ['circuit', 'net', 'wire'] },
    { id: 'nav-pcb', label: 'PCB Layout', icon: Microchip, shortcut: '3', action: () => onNavigate('pcb'), keywords: ['board', 'trace', 'footprint'] },
    { id: 'nav-breadboard', label: 'Breadboard', icon: Grid3X3, shortcut: '4', action: () => onNavigate('breadboard'), keywords: ['prototype', 'wiring'] },
    { id: 'nav-component-editor', label: 'Component Editor', icon: Cpu, shortcut: '5', action: () => onNavigate('component_editor'), keywords: ['part', 'symbol'] },
    { id: 'nav-procurement', label: 'Procurement', icon: Package, shortcut: '6', action: () => onNavigate('procurement'), keywords: ['bom', 'bill', 'materials', 'cost'] },
    { id: 'nav-validation', label: 'Validation', icon: Activity, shortcut: '7', action: () => onNavigate('validation'), keywords: ['drc', 'check', 'rule'] },
    { id: 'nav-output', label: 'Exports', icon: TerminalSquare, shortcut: '8', action: () => onNavigate('output'), keywords: ['export', 'gerber', 'kicad'] },
    { id: 'nav-simulation', label: 'Simulation', icon: FlaskConical, shortcut: '9', action: () => onNavigate('simulation'), keywords: ['spice', 'simulate', 'analysis', 'waveform'] },
    { id: 'nav-kanban', label: 'Task Board', icon: KanbanSquare, action: () => onNavigate('kanban'), keywords: ['kanban', 'tasks', 'board', 'todo'] },
    { id: 'nav-knowledge', label: 'Learn', icon: BookMarked, action: () => onNavigate('knowledge'), keywords: ['knowledge', 'learn', 'article', 'reference', 'electronics'] },
    { id: 'nav-viewer-3d', label: '3D View', icon: Box, action: () => onNavigate('viewer_3d'), keywords: ['3d', 'viewer', 'board', 'mechanical'] },
    { id: 'nav-community', label: 'Community', icon: Globe, action: () => onNavigate('community'), keywords: ['community', 'library', 'shared', 'components'] },
    { id: 'nav-ordering', label: 'Order PCB', icon: ShoppingBag, action: () => onNavigate('ordering'), keywords: ['order', 'pcb', 'fabricate', 'manufacture', 'jlcpcb'] },
    { id: 'nav-storage', label: 'Inventory', icon: Warehouse, action: () => onNavigate('storage'), keywords: ['inventory', 'storage', 'stock', 'location', 'warehouse'] },
    { id: 'nav-circuit-code', label: 'Circuit Code', icon: Code2, action: () => onNavigate('circuit_code'), keywords: ['code', 'arduino', 'firmware', 'program', 'cpp', 'upload'] },
  ];

  const panelItems: CommandItemDef[] = [
    {
      id: 'panel-sidebar',
      label: sidebarCollapsed ? 'Show Sidebar' : 'Hide Sidebar',
      icon: sidebarCollapsed ? PanelLeftOpen : PanelLeftClose,
      shortcut: 'Ctrl+B',
      action: onToggleSidebar,
    },
    {
      id: 'panel-chat',
      label: chatCollapsed ? 'Show AI Assistant' : 'Hide AI Assistant',
      icon: MessageCircle,
      shortcut: 'Ctrl+J',
      action: onToggleChat,
    },
  ];

  const actionItems: CommandItemDef[] = [
    { id: 'action-run-drc', label: 'Run Design Rule Check', icon: ShieldCheck, action: onRunDrc, keywords: ['validate', 'check', 'drc', 'erc'] },
    { id: 'action-export', label: 'Export Project', icon: FileOutput, action: () => onNavigate('output'), keywords: ['export', 'download', 'gerber'] },
  ];

  if (!open) {
    return null;
  }

  return (
    <div
      data-testid="command-palette-dialog"
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <Command
        label="Command palette"
        loop
        className="relative w-full max-w-lg rounded-lg border border-border bg-background shadow-2xl shadow-primary/5 overflow-hidden"
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
          }
        }}
      >
        <Command.Input
          data-testid="command-palette-input"
          placeholder="Type a command or search..."
          autoFocus
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Command.List className="max-h-[300px] overflow-y-auto p-2">
          <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
            No results found.
          </Command.Empty>

          <Command.Group heading="Navigate" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
            {navigateItems.map((item) => (
              <Command.Item
                key={item.id}
                data-testid={`command-item-${item.id}`}
                value={item.label}
                keywords={item.keywords}
                onSelect={() => handleSelect(item.action)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer',
                  'text-foreground/80',
                  'aria-selected:bg-primary/10 aria-selected:text-primary',
                  'hover:bg-muted/50',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.shortcut && (
                  <kbd className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                    {item.shortcut}
                  </kbd>
                )}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Separator className="my-1 h-px bg-border" />

          <Command.Group heading="Panels" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
            {panelItems.map((item) => (
              <Command.Item
                key={item.id}
                data-testid={`command-item-${item.id}`}
                value={item.label}
                onSelect={() => handleSelect(item.action)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer',
                  'text-foreground/80',
                  'aria-selected:bg-primary/10 aria-selected:text-primary',
                  'hover:bg-muted/50',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.shortcut && (
                  <kbd className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                    {item.shortcut}
                  </kbd>
                )}
              </Command.Item>
            ))}
          </Command.Group>

          <Command.Separator className="my-1 h-px bg-border" />

          <Command.Group heading="Actions" className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground">
            {actionItems.map((item) => (
              <Command.Item
                key={item.id}
                data-testid={`command-item-${item.id}`}
                value={item.label}
                keywords={item.keywords}
                onSelect={() => handleSelect(item.action)}
                className={cn(
                  'flex items-center gap-3 rounded-md px-2 py-2 text-sm cursor-pointer',
                  'text-foreground/80',
                  'aria-selected:bg-primary/10 aria-selected:text-primary',
                  'hover:bg-muted/50',
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
                {item.shortcut && (
                  <kbd className="ml-auto text-[10px] font-mono text-muted-foreground bg-muted border border-border rounded px-1.5 py-0.5">
                    {item.shortcut}
                  </kbd>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        </Command.List>

        <div className="border-t border-border px-3 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-muted border border-border rounded px-1 py-px">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-muted border border-border rounded px-1 py-px">↵</kbd>
              select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="font-mono bg-muted border border-border rounded px-1 py-px">esc</kbd>
              close
            </span>
          </div>
        </div>
      </Command>
    </div>
  );
}
