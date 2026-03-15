import { memo } from 'react';
import { CircuitBoard } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useCircuitDesigns } from '@/lib/circuit-editor/hooks';
import { useCircuitSelector } from '@/lib/circuit-selector';
import { cn } from '@/lib/utils';

/**
 * Dropdown for selecting which circuit design is the active target for
 * export, ordering, and simulation flows.
 *
 * Automatically reconciles the selection against the available circuits
 * from the server (via useCircuitDesigns) and persists to localStorage.
 */
function CircuitSelectorDropdown({ className }: { className?: string }) {
  const projectId = useProjectId();
  const { data: circuits, isLoading } = useCircuitDesigns(projectId);

  const available = circuits?.map((c) => ({ id: c.id, name: c.name })) ?? [];
  const { selected, select } = useCircuitSelector(projectId, available);

  if (isLoading) {
    return (
      <div
        className={cn('flex items-center gap-2 text-[10px] text-muted-foreground/60', className)}
        data-testid="circuit-selector-loading"
      >
        <CircuitBoard className="w-3.5 h-3.5 animate-pulse" />
        Loading circuits...
      </div>
    );
  }

  if (!circuits || circuits.length === 0) {
    return (
      <div
        className={cn('flex items-center gap-2 text-[10px] text-muted-foreground/50', className)}
        data-testid="circuit-selector-empty"
      >
        <CircuitBoard className="w-3.5 h-3.5" />
        No circuit designs
      </div>
    );
  }

  // Single circuit — show a static label instead of a dropdown
  if (circuits.length === 1) {
    return (
      <div
        className={cn('flex items-center gap-2 text-[10px] text-muted-foreground', className)}
        data-testid="circuit-selector-single"
      >
        <CircuitBoard className="w-3.5 h-3.5 text-primary/70" />
        <span className="truncate">{circuits[0].name}</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)} data-testid="circuit-selector">
      <CircuitBoard className="w-3.5 h-3.5 text-primary/70 shrink-0" />
      <Select
        value={selected ? String(selected.circuitId) : undefined}
        onValueChange={(value) => {
          const id = Number(value);
          const circuit = circuits.find((c) => c.id === id);
          if (circuit) {
            select(id, circuit.name);
          }
        }}
      >
        <SelectTrigger
          className="h-7 text-[11px] bg-muted/30 border-border/50 px-2 py-0"
          data-testid="circuit-selector-trigger"
          aria-label="Select circuit for export"
        >
          <SelectValue placeholder="Select circuit..." />
        </SelectTrigger>
        <SelectContent>
          {circuits.map((circuit) => (
            <SelectItem
              key={circuit.id}
              value={String(circuit.id)}
              data-testid={`circuit-option-${circuit.id}`}
            >
              {circuit.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default memo(CircuitSelectorDropdown);
