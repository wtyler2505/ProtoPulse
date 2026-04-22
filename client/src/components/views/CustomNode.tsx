import { useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeProps, Node, Edge } from '@xyflow/react';
import { CircuitBoard, Cpu, Radio, Battery, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useOutput } from '@/lib/contexts/output-context';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { copyToClipboard } from '@/lib/clipboard';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

interface CustomNodeData {
  type: string;
  label: string;
  description?: string;
  onLabelChange?: (newLabel: string) => void;
  [key: string]: unknown;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  mcu: Cpu,
  comm: Radio,
  power: Battery,
  sensor: Activity,
  connector: Zap,
  generic: CircuitBoard
};

const typeMap: Record<string, string> = {
  'MCU': 'mcu', 'Sensor': 'sensor', 'Power': 'power',
  'Communication': 'comm', 'Connector': 'connector', 'Generic': 'generic',
};

export default function CustomNode({ id, data, selected }: NodeProps<Node<CustomNodeData>>) {
  const { nodes, edges, setNodes, setEdges } = useArchitecture();
  const { addOutputLog } = useOutput();
  const [pendingDelete, setPendingDelete] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const Icon = iconMap[data.type] || CircuitBoard;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commitEdit = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== data.label) {
      if (data.onLabelChange) {
        data.onLabelChange(trimmed);
      } else {
        setNodes(nodes.map((n: Node) => n.id === id ? { ...n, data: { ...n.data, label: trimmed } } : n));
      }
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue(data.label);
  };
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/*
          The top-level node wrapper is given button semantics and an accessible label so that
          it can receive focus via keyboard and announce itself to assistive technologies.
          This improves navigation and discoverability for users relying on screen readers【758651948260829†L286-L326】.
        */}
        <div
          role="group"
          // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Phase 3 InteractiveCard migration (Plan 03-a11y-systemic)
          tabIndex={0}
          aria-label={`Node ${data.label ?? data.type}`}
          className={cn(
            "px-4 py-3 shadow-lg bg-card/80 backdrop-blur-xl border min-w-[150px] transition-all duration-200",
            selected ? "border-primary shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-primary" : "border-border hover:border-primary/50"
          )}
        >
          <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-3.5 !h-2 !rounded-none hover:!ring-2 hover:!ring-primary/60 hover:!bg-primary transition-all" data-testid={`handle-target-${id}`} />
          
          <div className="flex items-center gap-3">
            <div className={cn("p-2 bg-muted/50", selected ? "text-primary" : "text-muted-foreground")}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{data.type}</div>
              {isEditing ? (
                <input
                  ref={inputRef}
                  data-testid="node-label-input"
                  className="font-display font-medium text-sm text-foreground bg-transparent border-0 outline-none ring-1 ring-primary rounded px-1 py-0 w-full min-w-[60px]"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { commitEdit(); }
                    if (e.key === 'Escape') { cancelEdit(); }
                    e.stopPropagation();
                  }}
                  onBlur={commitEdit}
                  onMouseDown={(e) => e.stopPropagation()}
                />
              ) : (
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Phase 3 InteractiveCard migration (Plan 03-a11y-systemic) */}
                <div
                  className="font-display font-medium text-sm text-foreground cursor-text"
                  onDoubleClick={() => { setEditValue(data.label); setIsEditing(true); }}
                  data-testid="node-label-display"
                >
                  {data.label}
                </div>
              )}
            </div>
          </div>

          <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-3.5 !h-2 !rounded-none hover:!ring-2 hover:!ring-primary/60 hover:!bg-primary transition-all" data-testid={`handle-source-${id}`} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuItem onSelect={() => { copyToClipboard(data.label); addOutputLog('[NODE] Copied label: ' + data.label); }}>Copy Label</ContextMenuItem>
        <ContextMenuItem onSelect={() => { const orig = nodes.find((n: Node) => n.id === id); if (orig) { setNodes([...nodes, { ...orig, id: Date.now().toString(), position: { x: orig.position.x + 50, y: orig.position.y + 50 } }]); } }}>Duplicate Node</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(data.label + ' datasheet'), '_blank', 'noopener,noreferrer')}>Search Datasheet</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Change Type</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
            {['MCU', 'Sensor', 'Power', 'Communication', 'Connector', 'Generic'].map((t) => (
              <ContextMenuItem key={t} onSelect={() => { setNodes(nodes.map((n: Node) => n.id === id ? { ...n, data: { ...n.data, type: typeMap[t] || 'generic' } } : n)); addOutputLog('[NODE] Changed type to ' + t); }}>{t}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onSelect={() => setPendingDelete(true)}>Delete Node</ContextMenuItem>
      </ContextMenuContent>

      <AlertDialog open={pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(false); }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this node? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { setNodes(nodes.filter((n: Node) => n.id !== id)); setEdges(edges.filter((e: Edge) => e.source !== id && e.target !== id)); addOutputLog('[NODE] Deleted: ' + data.label); setPendingDelete(false); }}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ContextMenu>
  );
}
