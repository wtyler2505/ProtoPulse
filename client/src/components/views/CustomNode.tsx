import { Handle, Position, NodeProps } from '@xyflow/react';
import { CircuitBoard, Cpu, Radio, Battery, Zap, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';

const iconMap: Record<string, any> = {
  mcu: Cpu,
  comm: Radio,
  power: Battery,
  sensor: Activity,
  connector: Zap,
  generic: CircuitBoard
};

export default function CustomNode({ data, selected }: NodeProps) {
  const Icon = iconMap[data.type as string] || CircuitBoard;
  
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className={cn(
          "px-4 py-3 shadow-lg bg-card/80 backdrop-blur-lg border min-w-[150px] transition-all duration-200",
          selected ? "border-primary shadow-[0_0_20px_rgba(6,182,212,0.4)] ring-1 ring-primary" : "border-border hover:border-primary/50"
        )}>
          <Handle type="target" position={Position.Top} className="!bg-muted-foreground !w-3 !h-1 !rounded-none" />
          
          <div className="flex items-center gap-3">
            <div className={cn("p-2 bg-muted/50", selected ? "text-primary" : "text-muted-foreground")}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold">{data.type as string}</div>
              <div className="font-display font-medium text-sm text-foreground">{data.label as string}</div>
            </div>
          </div>

          <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground !w-3 !h-1 !rounded-none" />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuItem onSelect={() => console.log('Edit label', data.label)}>Edit Label</ContextMenuItem>
        <ContextMenuItem onSelect={() => console.log('Duplicate node', data.label)}>Duplicate Node</ContextMenuItem>
        <ContextMenuItem onSelect={() => console.log('View datasheet', data.label)}>View Datasheet</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger>Change Type</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
            {['MCU', 'Sensor', 'Power', 'Communication', 'Connector', 'Generic'].map((t) => (
              <ContextMenuItem key={t} onSelect={() => console.log('Change type to', t, data.label)}>{t}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onSelect={() => console.log('Delete node', data.label)}>Delete Node</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
