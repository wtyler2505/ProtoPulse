import { memo, useMemo } from 'react';
import type { Node } from '@xyflow/react';
import { useDraggable } from '@dnd-kit/core';
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
import type { ComponentDragData } from '@/lib/dnd-context';

const TYPE_CONFIG: Record<string, { label: string; icon: typeof Cpu }> = {
  mcu: { label: 'MCU', icon: Cpu },
  sensor: { label: 'Sensors', icon: Activity },
  power: { label: 'Power', icon: Zap },
  comm: { label: 'Communications', icon: Radio },
  connector: { label: 'Connectors', icon: Cable },
  generic: { label: 'Other', icon: MoreHorizontal },
};

// ---------------------------------------------------------------------------
// DraggableCategoryHeader — category row with @dnd-kit draggable
// ---------------------------------------------------------------------------

interface DraggableCategoryHeaderProps {
  cat: string;
  config: { label: string; icon: typeof Cpu };
  IconComp: typeof Cpu;
  expanded: boolean;
  catNodeCount: number;
  toggleCategory: (cat: string) => void;
  onDragStart: (e: React.DragEvent, nodeType: string, label: string) => void;
}

function DraggableCategoryHeader({ cat, config, IconComp, expanded, catNodeCount, toggleCategory, onDragStart }: DraggableCategoryHeaderProps) {
  const dragData: ComponentDragData = { nodeType: cat, label: config.label, source: 'component-tree' };
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `category-${cat}`,
    data: dragData,
  });

  return (
    <div
      ref={setNodeRef}
      role="button"
      tabIndex={0}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} ${config.label} category`}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCategory(cat); } }}
      className={cn(
        'flex items-center gap-2 py-1 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer hover:bg-muted/30 group/cat focus-ring',
        isDragging && 'opacity-50',
      )}
      draggable
      onDragStart={(e) => onDragStart(e, cat, config.label)}
      onClick={() => toggleCategory(cat)}
      style={{ cursor: 'grab' }}
    >
      <div {...listeners} {...attributes} data-testid={`drag-handle-category-${cat}`} className="touch-none">
        <GripVertical className="w-3 h-3 opacity-0 group-hover/cat:opacity-50 shrink-0" />
      </div>
      {expanded ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
      <IconComp className="w-3 h-3 shrink-0" />
      <span className="flex-1">{config.label}</span>
      <span className="text-[10px] font-medium bg-muted/50 text-muted-foreground px-1.5 py-0.5 tabular-nums">{catNodeCount}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DraggableNodeRow — individual node with @dnd-kit draggable + context menu
// ---------------------------------------------------------------------------

interface DraggableNodeRowProps {
  node: Node;
  cat: string;
  selectedNodeId: string | null;
  allNodes: Node[];
  focusNode: (id: string) => void;
  setNodes: (nodes: Node[]) => void;
  addOutputLog: (msg: string) => void;
  onDragStart: (e: React.DragEvent, nodeType: string, label: string) => void;
}

function DraggableNodeRow({ node, cat, selectedNodeId, allNodes, focusNode, setNodes, addOutputLog, onDragStart }: DraggableNodeRowProps) {
  const nodeType = String(node.data?.type || cat);
  const nodeLabel = String(node.data?.label || node.id);
  const dragData: ComponentDragData = { nodeType, label: nodeLabel, source: 'component-tree' };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `node-${node.id}`,
    data: dragData,
  });

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={setNodeRef}
          data-testid={`block-node-${node.id}`}
          role="button"
          tabIndex={0}
          aria-label={`Focus node: ${nodeLabel}`}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusNode(node.id); } }}
          className={cn(
            'text-xs cursor-pointer py-1 px-2 flex items-center gap-2 transition-colors group/node focus-ring',
            selectedNodeId === node.id
              ? 'bg-primary/20 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent',
            isDragging && 'opacity-50',
          )}
          draggable
          onDragStart={(e) => onDragStart(e, nodeType, nodeLabel)}
          onClick={() => focusNode(node.id)}
          style={{ cursor: 'grab' }}
        >
          <div {...listeners} {...attributes} data-testid={`drag-handle-node-${node.id}`} className="touch-none">
            <GripVertical className="w-3 h-3 opacity-0 group-hover/node:opacity-50 shrink-0" />
          </div>
          <div className="w-1 h-1 bg-muted-foreground/50 shrink-0"></div>
          <span className="truncate">{nodeLabel}</span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuItem onSelect={() => focusNode(node.id)}>Focus in Architecture</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(nodeLabel + ' datasheet'), '_blank', 'noopener,noreferrer')}>Search Datasheet</ContextMenuItem>
        <ContextMenuItem onSelect={() => { copyToClipboard(nodeLabel); addOutputLog('[SIDEBAR] Copied: ' + nodeLabel); }}>Copy Name</ContextMenuItem>
        <ContextMenuItem onSelect={() => { if (window.confirm('Remove this node from the design? This cannot be undone.')) { setNodes(allNodes.filter((n) => n.id !== node.id)); addOutputLog('[SIDEBAR] Removed from design: ' + nodeLabel); } }}>Remove from design</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ---------------------------------------------------------------------------
// ComponentTree — main component
// ---------------------------------------------------------------------------

interface ComponentTreeProps {
  nodes: Node[];
  searchQuery: string;
  selectedNodeId: string | null;
  expandedCategories: Record<string, boolean>;
  setExpandedCategories: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  focusNode: (id: string) => void;
  setNodes: (nodes: Node[]) => void;
  addOutputLog: (msg: string) => void;
}

const ComponentTree = memo(function ComponentTree({
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

  const filteredCategories = useMemo(() => {
    const grouped: Record<string, Node[]> = {};
    (nodes || []).forEach((node) => {
      const type = String(node.data?.type || 'generic');
      const key = TYPE_CONFIG[type] ? type : 'generic';
      if (!grouped[key]) { grouped[key] = []; }
      grouped[key].push(node);
    });

    const categoryOrder = ['mcu', 'sensor', 'power', 'comm', 'connector', 'generic'];
    const activeCategories = categoryOrder.filter(cat => grouped[cat]?.length > 0);

    const query = searchQuery.toLowerCase().trim();
    return activeCategories.map(cat => {
      const filtered = grouped[cat].filter((n) =>
        !query || String(n.data?.label || '').toLowerCase().includes(query)
      );
      return { cat, nodes: filtered };
    }).filter(c => c.nodes.length > 0);
  }, [nodes, searchQuery]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories((prev: Record<string, boolean>) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const isCategoryExpanded = (cat: string) => expandedCategories[cat] !== false;

  return (
    <div className="pl-4 pr-2 py-1 space-y-0.5">
      {filteredCategories.length === 0 && searchQuery.trim() && (
        <div className="text-xs text-muted-foreground/60 pl-4 py-1">No results</div>
      )}
      {filteredCategories.map(({ cat, nodes: catNodes }) => {
        const config = TYPE_CONFIG[cat];
        const IconComp = config.icon;
        const expanded = isCategoryExpanded(cat);
        return (
          <div key={cat} data-testid={`block-category-${cat}`}>
            <DraggableCategoryHeader
              cat={cat}
              config={config}
              IconComp={IconComp}
              expanded={expanded}
              catNodeCount={catNodes.length}
              toggleCategory={toggleCategory}
              onDragStart={onDragStart}
            />
            {expanded && (
              <div className="pl-6 space-y-0.5">
                {catNodes.map((node) => (
                  <DraggableNodeRow
                    key={node.id}
                    node={node}
                    cat={cat}
                    selectedNodeId={selectedNodeId}
                    allNodes={nodes}
                    focusNode={focusNode}
                    setNodes={setNodes}
                    addOutputLog={addOutputLog}
                    onDragStart={onDragStart}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default ComponentTree;
