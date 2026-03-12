import { memo } from 'react';
import { 
  PlusCircle, 
  Link, 
  Trash2, 
  RefreshCw, 
  Package, 
  Activity, 
  FileText, 
  Layout, 
  Settings, 
  Undo2, 
  Redo2,
  AlertTriangle,
  PenLine
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AIAction } from './chat-types';

interface ActionPreviewListProps {
  actions: AIAction[];
  className?: string;
}

function getActionIcon(type: string) {
  switch (type) {
    case 'add_node':
    case 'generate_architecture':
      return PlusCircle;
    case 'connect_nodes':
    case 'connect_pins':
      return Link;
    case 'delete_node':
    case 'clear_canvas':
    case 'delete_bom_item':
      return Trash2;
    case 'update_node':
    case 'update_bom_item':
    case 'set_project_metadata':
      return PenLine;
    case 'add_bom_item':
      return Package;
    case 'run_validation':
      return Activity;
    case 'project_summary':
    case 'show_help':
      return FileText;
    case 'switch_view':
    case 'switch_schematic_sheet':
      return Layout;
    case 'undo':
      return Undo2;
    case 'redo':
      return Redo2;
    default:
      return Settings;
  }
}

function getActionDescription(action: AIAction): string {
  switch (action.type) {
    case 'add_node':
      return `Add component "${action.nodeLabel || action.label || 'New Component'}"`;
    case 'connect_nodes':
      return `Connect "${action.sourceLabel}" to "${action.targetLabel}"`;
    case 'delete_node':
      return `Delete component "${action.nodeLabel || action.label || 'Component'}"`;
    case 'update_node':
      return `Update properties for "${action.nodeLabel || action.label}"`;
    case 'add_bom_item':
      return `Add "${action.partNumber || 'item'}" to BOM (${action.quantity || 1}x)`;
    case 'delete_bom_item':
      return `Remove item from BOM`;
    case 'update_bom_item':
      return `Update quantity/details for BOM item`;
    case 'generate_architecture':
      return `Generate full architecture with ${action.components?.length || 0} components`;
    case 'switch_view':
      return `Switch workspace to ${action.view || 'different'} view`;
    case 'clear_canvas':
      return `Clear entire design canvas`;
    case 'set_project_metadata':
      return `Update project name or description`;
    case 'run_validation':
      return `Run Design Rule Checks (DRC)`;
    case 'undo':
      return `Undo last action`;
    case 'redo':
      return `Redo last action`;
    case 'add_validation_issue':
      return `Flag design issue: ${action.message?.substring(0, 30)}...`;
    default:
      return action.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }
}

const ActionPreviewList = ({ actions, className }: ActionPreviewListProps) => {
  if (actions.length === 0) return null;

  return (
    <div className={cn("space-y-1 my-2", className)}>
      {actions.map((action, idx) => {
        const Icon = getActionIcon(action.type);
        const isDestructive = ['delete_node', 'clear_canvas', 'delete_bom_item'].includes(action.type);
        
        return (
          <div 
            key={`${action.type}-${idx}`}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded-sm text-[11px] border",
              isDestructive 
                ? "bg-destructive/5 border-destructive/20 text-destructive/90" 
                : "bg-muted/30 border-border/50 text-muted-foreground"
            )}
          >
            <Icon className="w-3 h-3 shrink-0" />
            <span className="truncate flex-1 font-medium">{getActionDescription(action)}</span>
            {isDestructive && (
              <AlertTriangle className="w-2.5 h-2.5 shrink-0 opacity-70" />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default memo(ActionPreviewList);
