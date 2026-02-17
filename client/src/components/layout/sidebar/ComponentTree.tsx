import {
  ChevronRight,
  ChevronDown,
  GripVertical,
  Cpu,
  Activity,
  Zap,
  Radio,
  Cable,
  MoreHorizontal,
} from 'lucide-react';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Cpu }> = {
  mcu: { label: 'MCU', icon: Cpu },
  sensor: { label: 'Sensors', icon: Activity },
  power: { label: 'Power', icon: Zap },
  comm: { label: 'Communications', icon: Radio },
  connector: { label: 'Connectors', icon: Cable },
  generic: { label: 'Other', icon: MoreHorizontal },
};

interface ComponentTreeProps {
  nodes: any[];
  searchQuery: string;
  selectedNodeId: string | null;
  expandedCategories: Record<string, boolean>;
  setExpandedCategories: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  focusNode: (id: string) => void;
  setNodes: (nodes: any[]) => void;
  addOutputLog: (msg: string) => void;
}

export default function ComponentTree({
  nodes,
  searchQuery,
  selectedNodeId,
  expandedCategories,
  setExpandedCategories,
  focusNode,
  setNodes,
  addOutputLog,
}: ComponentTreeProps) {
  const onDragStart = (e: React.DragEvent, nodeType: string, label: string) => {
    e.dataTransfer.setData('application/reactflow/type', nodeType);
    e.dataTransfer.setData('application/reactflow/label', label);
    e.dataTransfer.effectAllowed = 'move';
  };

  const groupedNodes: Record<string, any[]> = {};
  (nodes || []).forEach((node: any) => {
    const type = node.data?.type || 'generic';
    const key = TYPE_CONFIG[type] ? type : 'generic';
    if (!groupedNodes[key]) groupedNodes[key] = [];
    groupedNodes[key].push(node);
  });

  const categoryOrder = ['mcu', 'sensor', 'power', 'comm', 'connector', 'generic'];
  const activeCategories = categoryOrder.filter(cat => groupedNodes[cat]?.length > 0);

  const query = searchQuery.toLowerCase().trim();
  const filteredCategories = activeCategories.map(cat => {
    const filtered = groupedNodes[cat].filter((n: any) =>
      !query || (n.data?.label || '').toLowerCase().includes(query)
    );
    return { cat, nodes: filtered };
  }).filter(c => c.nodes.length > 0);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev: Record<string, boolean>) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const isCategoryExpanded = (cat: string) => expandedCategories[cat] !== false;

  return (
    <div className="pl-4 pr-2 py-1 space-y-0.5">
      {filteredCategories.length === 0 && query && (
        <div className="text-xs text-muted-foreground/60 pl-4 py-1">No results</div>
      )}
      {filteredCategories.map(({ cat, nodes: catNodes }) => {
        const config = TYPE_CONFIG[cat];
        const IconComp = config.icon;
        const expanded = isCategoryExpanded(cat);
        return (
          <div key={cat} data-testid={`block-category-${cat}`}>
            <div
              className="flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/30 group/cat"
              draggable
              onDragStart={(e) => onDragStart(e, cat, config.label)}
              onClick={() => toggleCategory(cat)}
              style={{ cursor: 'grab' }}
            >
              <GripVertical className="w-3 h-3 opacity-0 group-hover/cat:opacity-50 shrink-0" />
              {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
              <IconComp className="w-3 h-3 shrink-0" />
              <span className="flex-1">{config.label}</span>
              <span className="text-[10px] bg-muted/50 px-1.5 py-0.5">{catNodes.length}</span>
            </div>
            {expanded && (
              <div className="pl-6 space-y-0.5">
                {catNodes.map((node: any) => (
                  <ContextMenu key={node.id}>
                    <ContextMenuTrigger asChild>
                      <div
                        data-testid={`block-node-${node.id}`}
                        className={cn(
                          "text-xs cursor-pointer py-1 px-2 flex items-center gap-2 transition-colors group/node",
                          selectedNodeId === node.id
                            ? "bg-primary/20 text-primary"
                            : "text-muted-foreground hover:text-primary hover:bg-muted/50"
                        )}
                        draggable
                        onDragStart={(e) => onDragStart(e, node.data?.type || cat, node.data?.label || node.id)}
                        onClick={() => focusNode(node.id)}
                        style={{ cursor: 'grab' }}
                      >
                        <GripVertical className="w-3 h-3 opacity-0 group-hover/node:opacity-50 shrink-0" />
                        <div className="w-1 h-1 bg-muted-foreground/50 shrink-0"></div>
                        <span className="truncate">{node.data?.label || node.id}</span>
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                      <ContextMenuItem onSelect={() => focusNode(node.id)}>Focus in Architecture</ContextMenuItem>
                      <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent((node.data?.label || node.id) + ' datasheet'), '_blank', 'noopener,noreferrer')}>Search Datasheet</ContextMenuItem>
                      <ContextMenuItem onSelect={() => { copyToClipboard(node.data?.label || node.id); addOutputLog('[SIDEBAR] Copied: ' + (node.data?.label || node.id)); }}>Copy Name</ContextMenuItem>
                      <ContextMenuItem onSelect={() => { if (window.confirm('Remove this node from the design? This cannot be undone.')) { setNodes(nodes.filter((n: any) => n.id !== node.id)); addOutputLog('[SIDEBAR] Removed from design: ' + (node.data?.label || node.id)); } }}>Remove from design</ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
