import { useCallback, useEffect, useRef, useState } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { X, Trash2, Link2, MapPin } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
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
import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

const NODE_TYPES = [
  { value: 'mcu', label: 'MCU' },
  { value: 'sensor', label: 'Sensor' },
  { value: 'power', label: 'Power' },
  { value: 'comm', label: 'Communication' },
  { value: 'connector', label: 'Connector' },
  { value: 'generic', label: 'Generic' },
] as const;

interface NodeInspectorPanelProps {
  node: Node;
  edges: Edge[];
  onUpdateNode: (nodeId: string, updates: Record<string, unknown>) => void;
  onDeleteNode: (nodeId: string) => void;
  onClose: () => void;
}

export function NodeInspectorPanel({ node, edges, onUpdateNode, onDeleteNode, onClose }: NodeInspectorPanelProps) {
  const nodeData = node.data as Record<string, unknown>;
  const label = (nodeData.label as string) ?? '';
  const type = (nodeData.type as string) ?? 'generic';
  const description = (nodeData.description as string) ?? '';

  const [localLabel, setLocalLabel] = useState(label);
  const [localDescription, setLocalDescription] = useState(description);
  const [pendingDelete, setPendingDelete] = useState(false);
  const labelInputRef = useRef<HTMLInputElement>(null);

  // Sync local state when selected node changes
  useEffect(() => {
    setLocalLabel(label);
    setLocalDescription(description);
  }, [node.id, label, description]);

  const connectedEdgeCount = edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  ).length;

  const handleLabelBlur = useCallback(() => {
    const trimmed = localLabel.trim();
    if (trimmed && trimmed !== label) {
      onUpdateNode(node.id, { label: trimmed });
    } else if (!trimmed) {
      setLocalLabel(label);
    }
  }, [localLabel, label, node.id, onUpdateNode]);

  const handleLabelKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLabelBlur();
        labelInputRef.current?.blur();
      }
      if (e.key === 'Escape') {
        setLocalLabel(label);
        labelInputRef.current?.blur();
      }
    },
    [handleLabelBlur, label],
  );

  const handleDescriptionBlur = useCallback(() => {
    if (localDescription !== description) {
      onUpdateNode(node.id, { description: localDescription });
    }
  }, [localDescription, description, node.id, onUpdateNode]);

  const handleTypeChange = useCallback(
    (value: string) => {
      onUpdateNode(node.id, { type: value });
    },
    [node.id, onUpdateNode],
  );

  const handleDelete = useCallback(() => {
    onDeleteNode(node.id);
    setPendingDelete(false);
  }, [node.id, onDeleteNode]);

  return (
    <>
      <div
        className="absolute top-0 right-0 bottom-0 z-20 w-[280px] max-w-[90%] bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        data-testid="node-inspector-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="text-sm font-bold text-foreground" data-testid="node-inspector-title">
            Node Properties
          </h3>
          <button
            data-testid="node-inspector-close"
            aria-label="Close inspector panel"
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={onClose}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Label */}
          <div className="space-y-1.5">
            <Label htmlFor="inspector-label" className="text-xs text-muted-foreground">
              Label
            </Label>
            <Input
              ref={labelInputRef}
              id="inspector-label"
              data-testid="node-inspector-label"
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onBlur={handleLabelBlur}
              onKeyDown={handleLabelKeyDown}
              className="h-8 text-sm bg-muted/30 border-border focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <Label htmlFor="inspector-type" className="text-xs text-muted-foreground">
              Type
            </Label>
            <Select value={type} onValueChange={handleTypeChange}>
              <SelectTrigger
                id="inspector-type"
                data-testid="node-inspector-type"
                className="h-8 text-sm bg-muted/30 border-border focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {NODE_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value} data-testid={`node-inspector-type-${t.value}`}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="inspector-description" className="text-xs text-muted-foreground">
              Description
            </Label>
            <Textarea
              id="inspector-description"
              data-testid="node-inspector-description"
              value={localDescription}
              onChange={(e) => setLocalDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add a description..."
              rows={3}
              className="text-sm bg-muted/30 border-border resize-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Position (read-only) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="w-3 h-3" />
              <span>Position</span>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <Label htmlFor="inspector-pos-x" className="text-[10px] text-muted-foreground/70">
                  X
                </Label>
                <Input
                  id="inspector-pos-x"
                  data-testid="node-inspector-pos-x"
                  value={Math.round(node.position.x)}
                  readOnly
                  className="h-7 text-xs bg-muted/20 border-border text-muted-foreground cursor-default"
                />
              </div>
              <div className="flex-1">
                <Label htmlFor="inspector-pos-y" className="text-[10px] text-muted-foreground/70">
                  Y
                </Label>
                <Input
                  id="inspector-pos-y"
                  data-testid="node-inspector-pos-y"
                  value={Math.round(node.position.y)}
                  readOnly
                  className="h-7 text-xs bg-muted/20 border-border text-muted-foreground cursor-default"
                />
              </div>
            </div>
          </div>

          {/* Connected edges */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Link2 className="w-3 h-3" />
              <span>Connections</span>
            </div>
            <p className="text-sm text-foreground" data-testid="node-inspector-edge-count">
              {connectedEdgeCount} {connectedEdgeCount === 1 ? 'edge' : 'edges'}
            </p>
          </div>

          {/* Node ID (read-only, small) */}
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground/60">ID</span>
            <p
              className="text-[10px] text-muted-foreground/60 font-mono break-all select-all"
              data-testid="node-inspector-id"
            >
              {node.id}
            </p>
          </div>
        </div>

        {/* Footer — Delete */}
        <div className="px-4 py-3 border-t border-border shrink-0">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            data-testid="node-inspector-delete"
            onClick={() => setPendingDelete(true)}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete Node
          </Button>
        </div>
      </div>

      <AlertDialog open={pendingDelete} onOpenChange={(open) => { if (!open) { setPendingDelete(false); } }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node</AlertDialogTitle>
            <AlertDialogDescription>
              Delete &ldquo;{label}&rdquo;? This will also remove {connectedEdgeCount} connected{' '}
              {connectedEdgeCount === 1 ? 'edge' : 'edges'}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className={cn(buttonVariants({ variant: 'destructive' }))}
              data-testid="node-inspector-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
