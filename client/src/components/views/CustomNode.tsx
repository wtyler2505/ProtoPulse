import { useState } from 'react';
import { Handle, Position, NodeProps, Node, Edge } from '@xyflow/react';
import { CircuitBoard, Cpu, Radio, Battery, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProject } from '@/lib/project-context';
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
  const { nodes, edges, setNodes, setEdges, addOutputLog } = useProject();
  const [pendingDelete, setPendingDelete] = useState(false);
  const Icon = iconMap[data.type] || CircuitBoard;
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {/*
          The top-level node wrapper is given button semantics and an accessible label so that
          it can receive focus via keyboard and announce itself to assistive technologies.
          This improves navigation and discoverability for users relying on screen readers【758651948260829†L286-L326】.
        */}
        <div
          role="button"
          tabIndex={0}
          aria-label={`Node ${data.label ?? data.type}`}
          className={cn(
            "px-4 py-3 shadow-lg bg-card/80 backdrop-blur-xl border min-w-[150px] transition-all duration-200",
            selected ? "border-primary shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-primary" : "border-border hover:border-primary/50"
          )}
        >
          <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-3 !h-1 !rounded-none" />
          
          <div className="flex items-center gap-3">
            <div className={cn("p-2 bg-muted/50", selected ? "text-primary" : "text-muted-foreground")}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{data.type}</div>
              <div className="font-display font-medium text-sm text-foreground">{data.label}</div>
            </div>
          </div>

          <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-3 !h-1 !rounded-none" />
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
