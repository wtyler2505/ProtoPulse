import { memo, useState, useCallback, useMemo } from 'react';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useCircuitNets } from '@/lib/circuit-editor/hooks';
import {
  Network,
  Plus,
  Trash2,
  Pencil,
  Palette,
  ChevronDown,
  ChevronRight,
  Check,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import type { CircuitNetRow } from '@shared/schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NetClass {
  name: string;
  traceWidth: number;
  clearance: number;
  viaDiameter: number;
  color: string;
}

interface NetClassAssignment {
  netId: number;
  className: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_NET_CLASS: NetClass = {
  name: 'Default',
  traceWidth: 0.25,
  clearance: 0.2,
  viaDiameter: 0.6,
  color: '#6b7280',
};

const PRESET_COLORS = [
  '#6b7280', // gray
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#00F0FF', // neon cyan (theme accent)
];

const EMPTY_FORM: Omit<NetClass, 'name'> & { name: string } = {
  name: '',
  traceWidth: 0.25,
  clearance: 0.2,
  viaDiameter: 0.6,
  color: '#3b82f6',
};

// ---------------------------------------------------------------------------
// NetClassPanel
// ---------------------------------------------------------------------------

interface NetClassPanelProps {
  circuitId: number;
}

const NetClassPanel = memo(function NetClassPanel({ circuitId }: NetClassPanelProps) {
  const projectId = useProjectId();
  const { data: nets } = useCircuitNets(circuitId);

  // Net class state (local — no backend persistence)
  const [netClasses, setNetClasses] = useState<NetClass[]>([DEFAULT_NET_CLASS]);
  const [assignments, setAssignments] = useState<NetClassAssignment[]>([]);

  // UI state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['classes', 'assignments']),
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<string | null>(null);
  const [formData, setFormData] = useState<NetClass>({ ...EMPTY_FORM, color: '#3b82f6' });

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const assignmentMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of assignments) {
      map.set(a.netId, a.className);
    }
    return map;
  }, [assignments]);

  const classCountMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const nc of netClasses) {
      map.set(nc.name, 0);
    }
    for (const a of assignments) {
      map.set(a.className, (map.get(a.className) ?? 0) + 1);
    }
    // Count unassigned nets as belonging to Default
    const totalNets = nets?.length ?? 0;
    const assignedCount = assignments.length;
    const defaultCount = (map.get('Default') ?? 0) + (totalNets - assignedCount);
    map.set('Default', defaultCount);
    return map;
  }, [netClasses, assignments, nets]);

  const netClassMap = useMemo(() => {
    const map = new Map<string, NetClass>();
    for (const nc of netClasses) {
      map.set(nc.name, nc);
    }
    return map;
  }, [netClasses]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const openAddDialog = useCallback(() => {
    setEditingClass(null);
    setFormData({ ...EMPTY_FORM, color: PRESET_COLORS[netClasses.length % PRESET_COLORS.length] });
    setDialogOpen(true);
  }, [netClasses.length]);

  const openEditDialog = useCallback(
    (className: string) => {
      const nc = netClassMap.get(className);
      if (!nc) { return; }
      setEditingClass(className);
      setFormData({ ...nc });
      setDialogOpen(true);
    },
    [netClassMap],
  );

  const handleSave = useCallback(() => {
    const trimmedName = formData.name.trim();
    if (!trimmedName) { return; }

    if (editingClass) {
      // Editing existing class
      setNetClasses((prev) =>
        prev.map((nc) =>
          nc.name === editingClass ? { ...formData, name: trimmedName } : nc,
        ),
      );
      // Update assignments if name changed
      if (editingClass !== trimmedName) {
        setAssignments((prev) =>
          prev.map((a) =>
            a.className === editingClass ? { ...a, className: trimmedName } : a,
          ),
        );
      }
    } else {
      // Adding new class — check name uniqueness
      const nameExists = netClasses.some(
        (nc) => nc.name.toLowerCase() === trimmedName.toLowerCase(),
      );
      if (nameExists) { return; }
      setNetClasses((prev) => [...prev, { ...formData, name: trimmedName }]);
    }

    setDialogOpen(false);
    setEditingClass(null);
  }, [formData, editingClass, netClasses]);

  const handleDelete = useCallback(
    (className: string) => {
      if (className === 'Default') { return; } // Cannot delete Default
      setNetClasses((prev) => prev.filter((nc) => nc.name !== className));
      // Remove assignments for deleted class (nets fall back to Default)
      setAssignments((prev) => prev.filter((a) => a.className !== className));
    },
    [],
  );

  const handleAssignNet = useCallback(
    (netId: number, className: string) => {
      if (className === 'Default') {
        // Remove explicit assignment — Default is implicit
        setAssignments((prev) => prev.filter((a) => a.netId !== netId));
      } else {
        setAssignments((prev) => {
          const existing = prev.findIndex((a) => a.netId === netId);
          if (existing >= 0) {
            const updated = [...prev];
            updated[existing] = { netId, className };
            return updated;
          }
          return [...prev, { netId, className }];
        });
      }
    },
    [],
  );

  const updateFormField = useCallback(
    <K extends keyof NetClass>(field: K, value: NetClass[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  const getNetClassName = useCallback(
    (netId: number): string => assignmentMap.get(netId) ?? 'Default',
    [assignmentMap],
  );

  const getNetClassColor = useCallback(
    (className: string): string => netClassMap.get(className)?.color ?? DEFAULT_NET_CLASS.color,
    [netClassMap],
  );

  // Suppress projectId unused — consumed by hook but needed in scope
  void projectId;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="flex flex-col h-full bg-card/40" data-testid="net-class-panel">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <Network className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs font-medium text-foreground flex-1">Net Classes</span>
        <button
          data-testid="button-add-net-class"
          onClick={openAddDialog}
          className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 hover:bg-primary/20 text-primary text-[10px] font-medium transition-colors"
          title="Add net class"
          aria-label="Add net class"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* ---- Net Classes Section ---- */}
        <div data-testid="section-classes">
          <button
            data-testid="toggle-section-classes"
            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left"
            onClick={() => toggleSection('classes')}
          >
            {expandedSections.has('classes') ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-[10px] font-medium text-foreground uppercase tracking-wider flex-1">
              Classes
            </span>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {netClasses.length}
            </span>
          </button>

          {expandedSections.has('classes') && (
            <div className="px-1 pb-1">
              {netClasses.map((nc) => (
                <div
                  key={nc.name}
                  data-testid={`net-class-item-${nc.name}`}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-sm hover:bg-accent/20 transition-colors group"
                >
                  {/* Color dot */}
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0 border border-border"
                    style={{ backgroundColor: nc.color }}
                    data-testid={`net-class-color-${nc.name}`}
                  />

                  {/* Name + properties */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground truncate">
                        {nc.name}
                      </span>
                      {nc.name === 'Default' && (
                        <Badge
                          variant="outline"
                          className="text-[8px] px-1 py-0 h-3.5 border-muted-foreground/30"
                        >
                          default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                      <span>W:{nc.traceWidth}mm</span>
                      <span>C:{nc.clearance}mm</span>
                      <span>V:{nc.viaDiameter}mm</span>
                    </div>
                  </div>

                  {/* Net count */}
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                    {classCountMap.get(nc.name) ?? 0} net{(classCountMap.get(nc.name) ?? 0) !== 1 ? 's' : ''}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      data-testid={`button-edit-net-class-${nc.name}`}
                      onClick={() => openEditDialog(nc.name)}
                      className="p-0.5 rounded hover:bg-accent/50 transition-colors"
                      title={`Edit ${nc.name}`}
                      aria-label={`Edit ${nc.name}`}
                    >
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                    {nc.name !== 'Default' && (
                      <ConfirmDialog
                        trigger={
                          <button
                            data-testid={`button-delete-net-class-${nc.name}`}
                            className="p-0.5 rounded hover:bg-destructive/20 transition-colors"
                            title={`Delete ${nc.name}`}
                            aria-label={`Delete ${nc.name}`}
                          >
                            <Trash2 className="w-3 h-3 text-destructive" />
                          </button>
                        }
                        title="Delete Net Class"
                        description={`Remove the "${nc.name}" net class? Assigned nets will revert to the Default class.`}
                        confirmLabel="Delete"
                        variant="destructive"
                        onConfirm={() => handleDelete(nc.name)}
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ---- Net Assignments Section ---- */}
        <div data-testid="section-assignments">
          <button
            data-testid="toggle-section-assignments"
            className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-accent/30 transition-colors text-left border-t border-border/50"
            onClick={() => toggleSection('assignments')}
          >
            {expandedSections.has('assignments') ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-[10px] font-medium text-foreground uppercase tracking-wider flex-1">
              Net Assignments
            </span>
            <span className="text-[9px] text-muted-foreground tabular-nums">
              {nets?.length ?? 0}
            </span>
          </button>

          {expandedSections.has('assignments') && (
            <div className="px-1 pb-1">
              {!nets || nets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2 px-4 text-center">
                  <Network className="w-6 h-6 text-muted-foreground/20" />
                  <span className="text-[10px]">No nets in this design</span>
                </div>
              ) : (
                nets.map((net: CircuitNetRow) => {
                  const currentClass = getNetClassName(net.id);
                  const classColor = getNetClassColor(currentClass);

                  return (
                    <div
                      key={net.id}
                      data-testid={`net-assignment-${net.id}`}
                      className="flex items-center gap-2 px-2 py-1 rounded-sm hover:bg-accent/20 transition-colors"
                    >
                      {/* Color indicator */}
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: classColor }}
                      />

                      {/* Net name + type */}
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-medium text-foreground truncate block">
                          {net.name}
                        </span>
                        {net.netType && net.netType !== 'signal' && (
                          <span className="text-[8px] text-cyan-400 uppercase">{net.netType}</span>
                        )}
                      </div>

                      {/* Class selector */}
                      <Select
                        value={currentClass}
                        onValueChange={(value) => handleAssignNet(net.id, value)}
                      >
                        <SelectTrigger
                          data-testid={`select-net-class-${net.id}`}
                          className="h-6 w-[100px] text-[10px] border-border/50 bg-transparent px-2 py-0"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {netClasses.map((nc) => (
                            <SelectItem
                              key={nc.name}
                              value={nc.name}
                              data-testid={`select-option-${nc.name}-${net.id}`}
                              className="text-[10px]"
                            >
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2 h-2 rounded-full shrink-0"
                                  style={{ backgroundColor: nc.color }}
                                />
                                {nc.name}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* ---- Add/Edit Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="sm:max-w-[380px] bg-card border-border"
          data-testid="dialog-net-class"
        >
          <DialogHeader>
            <DialogTitle className="text-sm">
              {editingClass ? `Edit "${editingClass}"` : 'New Net Class'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingClass
                ? 'Modify the properties of this net class.'
                : 'Define a new net class with trace width, clearance, and via properties.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 py-2">
            {/* Name */}
            <div className="grid gap-1.5">
              <Label htmlFor="nc-name" className="text-[10px] text-muted-foreground">
                Name
              </Label>
              <Input
                id="nc-name"
                data-testid="input-net-class-name"
                value={formData.name}
                onChange={(e) => updateFormField('name', e.target.value)}
                placeholder="e.g., Power, High-Speed, Signal"
                className="h-7 text-xs"
                disabled={editingClass === 'Default'}
              />
            </div>

            {/* Trace Width */}
            <div className="grid gap-1.5">
              <Label htmlFor="nc-trace-width" className="text-[10px] text-muted-foreground">
                Trace Width (mm)
              </Label>
              <Input
                id="nc-trace-width"
                data-testid="input-trace-width"
                type="number"
                step={0.05}
                min={0.01}
                value={formData.traceWidth}
                onChange={(e) => updateFormField('traceWidth', parseFloat(e.target.value) || 0)}
                className="h-7 text-xs"
              />
            </div>

            {/* Clearance */}
            <div className="grid gap-1.5">
              <Label htmlFor="nc-clearance" className="text-[10px] text-muted-foreground">
                Clearance (mm)
              </Label>
              <Input
                id="nc-clearance"
                data-testid="input-clearance"
                type="number"
                step={0.05}
                min={0.01}
                value={formData.clearance}
                onChange={(e) => updateFormField('clearance', parseFloat(e.target.value) || 0)}
                className="h-7 text-xs"
              />
            </div>

            {/* Via Diameter */}
            <div className="grid gap-1.5">
              <Label htmlFor="nc-via-diameter" className="text-[10px] text-muted-foreground">
                Via Diameter (mm)
              </Label>
              <Input
                id="nc-via-diameter"
                data-testid="input-via-diameter"
                type="number"
                step={0.1}
                min={0.1}
                value={formData.viaDiameter}
                onChange={(e) => updateFormField('viaDiameter', parseFloat(e.target.value) || 0)}
                className="h-7 text-xs"
              />
            </div>

            {/* Color */}
            <div className="grid gap-1.5">
              <Label className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Palette className="w-3 h-3" />
                Color
              </Label>
              <div className="flex items-center gap-1.5 flex-wrap" data-testid="color-picker">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    data-testid={`color-swatch-${color.replace('#', '')}`}
                    className={cn(
                      'w-5 h-5 rounded-full border-2 transition-all',
                      formData.color === color
                        ? 'border-foreground scale-110'
                        : 'border-transparent hover:border-muted-foreground/50',
                    )}
                    style={{ backgroundColor: color }}
                    onClick={() => updateFormField('color', color)}
                    title={color}
                    aria-label={`Select color ${color}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <button
              data-testid="button-cancel-net-class"
              onClick={() => setDialogOpen(false)}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-muted-foreground hover:bg-accent/30 transition-colors"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
            <button
              data-testid="button-save-net-class"
              onClick={handleSave}
              disabled={!formData.name.trim()}
              className={cn(
                'flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium transition-colors',
                formData.name.trim()
                  ? 'bg-primary/20 hover:bg-primary/30 text-primary'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
              )}
            >
              <Check className="w-3 h-3" />
              {editingClass ? 'Save' : 'Create'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

export default NetClassPanel;
