import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Variable,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  Download,
  Upload,
  AlertTriangle,
  GitBranch,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  VariableStore,
  DesignVariableError,
} from '@shared/design-variables';
import type { DesignVariable, ValidationResult } from '@shared/design-variables';

const STORAGE_KEY = 'protopulse:design-variables';

function loadStore(): VariableStore {
  const store = new VariableStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const vars = JSON.parse(raw) as DesignVariable[];
      for (const v of vars) {
        store.addVariable(v);
      }
    }
  } catch {
    // corrupted — start fresh
  }
  return store;
}

function persistStore(store: VariableStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store.all()));
  } catch {
    // quota exceeded
  }
}

interface DesignVariablesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DesignVariablesPanel({ open, onOpenChange }: DesignVariablesPanelProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Store state — re-create array on mutations to trigger re-render
  const [store] = useState(() => loadStore());
  const [variables, setVariables] = useState<DesignVariable[]>(() => store.all());
  const [errors, setErrors] = useState<ValidationResult[]>([]);

  // Add form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpression, setNewExpression] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Inline editing
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editExpression, setEditExpression] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // Dependencies toggle
  const [showDeps, setShowDeps] = useState(false);

  const refreshState = useCallback(() => {
    const { errors: validationErrors } = store.resolveAll();
    setVariables([...store.all()]);
    setErrors(validationErrors);
    persistStore(store);
  }, [store]);

  // Resolve on open
  useEffect(() => {
    if (open) {
      refreshState();
    }
  }, [open, refreshState]);

  const errorMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of errors) {
      map.set(e.variableName, e.error.message);
    }
    return map;
  }, [errors]);

  const depGraph = useMemo(() => store.getDependencyGraph(), [variables, store]);

  // --- Add variable ---
  const handleAdd = useCallback(() => {
    const name = newName.trim();
    if (!name) {
      toast({ title: 'Missing Name', description: 'Variable name is required.', variant: 'destructive' });
      return;
    }
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
      toast({ title: 'Invalid Name', description: 'Name must start with a letter or underscore and contain only alphanumeric characters.', variant: 'destructive' });
      return;
    }
    if (store.get(name)) {
      toast({ title: 'Duplicate Name', description: `Variable "${name}" already exists.`, variant: 'destructive' });
      return;
    }
    const expression = newExpression.trim();
    if (!expression) {
      toast({ title: 'Missing Expression', description: 'Expression is required.', variant: 'destructive' });
      return;
    }

    store.addVariable({
      name,
      value: expression,
      unit: newUnit.trim() || undefined,
      description: newDescription.trim() || undefined,
    });
    refreshState();
    setNewName('');
    setNewExpression('');
    setNewUnit('');
    setNewDescription('');
    setShowAddForm(false);
    toast({ title: 'Variable Added', description: `"${name}" defined.` });
  }, [newName, newExpression, newUnit, newDescription, store, refreshState, toast]);

  // --- Delete variable ---
  const handleDelete = useCallback((name: string) => {
    store.removeVariable(name);
    refreshState();
    toast({ title: 'Variable Removed', description: `"${name}" removed.` });
  }, [store, refreshState, toast]);

  // --- Start editing ---
  const startEdit = useCallback((v: DesignVariable) => {
    setEditingName(v.name);
    setEditExpression(v.value);
    setEditUnit(v.unit ?? '');
    setEditDescription(v.description ?? '');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingName(null);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingName) { return; }
    const expression = editExpression.trim();
    if (!expression) {
      toast({ title: 'Missing Expression', description: 'Expression is required.', variant: 'destructive' });
      return;
    }
    store.addVariable({
      name: editingName,
      value: expression,
      unit: editUnit.trim() || undefined,
      description: editDescription.trim() || undefined,
    });
    refreshState();
    setEditingName(null);
    toast({ title: 'Variable Updated', description: `"${editingName}" updated.` });
  }, [editingName, editExpression, editUnit, editDescription, store, refreshState, toast]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); saveEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }, [saveEdit, cancelEdit]);

  const handleAddKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
    if (e.key === 'Escape') { e.preventDefault(); setShowAddForm(false); }
  }, [handleAdd]);

  // --- Export / Import ---
  const handleExport = useCallback(() => {
    const data = JSON.stringify(store.all(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'design-variables.json';
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Exported', description: 'Design variables exported as JSON.' });
  }, [store, toast]);

  const handleImport = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) { return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const vars = JSON.parse(reader.result as string) as DesignVariable[];
        if (!Array.isArray(vars)) {
          throw new Error('Invalid format');
        }
        for (const v of vars) {
          if (typeof v.name === 'string' && typeof v.value === 'string') {
            store.addVariable(v);
          }
        }
        refreshState();
        toast({ title: 'Imported', description: `Imported ${String(vars.length)} variable(s).` });
      } catch {
        toast({ title: 'Import Failed', description: 'Invalid JSON file.', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  }, [store, refreshState, toast]);

  const formatValue = (v: DesignVariable): string => {
    if (v.resolved !== undefined) {
      const abs = Math.abs(v.resolved);
      if (abs >= 1e9) { return (v.resolved / 1e9).toPrecision(4) + 'G'; }
      if (abs >= 1e6) { return (v.resolved / 1e6).toPrecision(4) + 'M'; }
      if (abs >= 1e3) { return (v.resolved / 1e3).toPrecision(4) + 'k'; }
      if (abs >= 1) { return v.resolved.toPrecision(6); }
      if (abs >= 1e-3) { return (v.resolved / 1e-3).toPrecision(4) + 'm'; }
      if (abs >= 1e-6) { return (v.resolved / 1e-6).toPrecision(4) + 'u'; }
      if (abs >= 1e-9) { return (v.resolved / 1e-9).toPrecision(4) + 'n'; }
      if (abs >= 1e-12) { return (v.resolved / 1e-12).toPrecision(4) + 'p'; }
      if (abs === 0) { return '0'; }
      return v.resolved.toPrecision(6);
    }
    return '—';
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
        data-testid="input-import-variables"
      />
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[480px] sm:w-[540px] bg-card border-border flex flex-col" data-testid="panel-design-variables">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <Variable className="w-5 h-5 text-primary" />
              Design Variables
            </SheetTitle>
            <SheetDescription className="text-muted-foreground text-xs">
              Define parametric variables with expressions and SI prefixes.
            </SheetDescription>
          </SheetHeader>

          {/* Toolbar */}
          <div className="flex items-center gap-2 py-2 border-b border-border">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => setShowAddForm(true)}
              data-testid="button-add-variable"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Variable
            </Button>
            <div className="flex-1" />
            <StyledTooltip content="Import from JSON">
              <Button size="sm" variant="ghost" onClick={handleImport} data-testid="button-import-variables">
                <Upload className="w-3.5 h-3.5" />
              </Button>
            </StyledTooltip>
            <StyledTooltip content="Export to JSON">
              <Button size="sm" variant="ghost" onClick={handleExport} data-testid="button-export-variables">
                <Download className="w-3.5 h-3.5" />
              </Button>
            </StyledTooltip>
          </div>

          {/* Add form */}
          {showAddForm && (
            <div className="border border-primary/30 bg-primary/5 p-3 space-y-2" data-testid="form-add-variable">
              <div className="grid grid-cols-[1fr_80px] gap-2">
                <Input
                  placeholder="Variable name (e.g. VCC)"
                  aria-label="Variable name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleAddKeyDown}
                  className="text-xs font-mono h-8"
                  data-testid="input-new-name"
                  autoFocus
                />
                <Input
                  placeholder="Unit"
                  aria-label="Variable unit"
                  value={newUnit}
                  onChange={(e) => setNewUnit(e.target.value)}
                  onKeyDown={handleAddKeyDown}
                  className="text-xs h-8"
                  data-testid="input-new-unit"
                />
              </div>
              <Input
                placeholder="Expression (e.g. 3.3, 10k, VCC * 2)"
                aria-label="Variable expression"
                value={newExpression}
                onChange={(e) => setNewExpression(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="text-xs font-mono h-8"
                data-testid="input-new-expression"
              />
              <Input
                placeholder="Description (optional)"
                aria-label="Variable description"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                onKeyDown={handleAddKeyDown}
                className="text-xs h-8"
                data-testid="input-new-description"
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={() => setShowAddForm(false)} data-testid="button-cancel-add">
                  <X className="w-3.5 h-3.5 mr-1" />Cancel
                </Button>
                <Button size="sm" onClick={handleAdd} data-testid="button-confirm-add">
                  <Check className="w-3.5 h-3.5 mr-1" />Add
                </Button>
              </div>
            </div>
          )}

          {/* Variable list */}
          <div className="flex-1 overflow-auto space-y-1 py-2" data-testid="list-variables">
            {variables.length === 0 && (
              <div className="text-center py-12 text-muted-foreground" data-testid="empty-variables">
                <Variable className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No design variables defined yet.</p>
                <p className="text-xs mt-1">Click "Add Variable" to get started.</p>
              </div>
            )}
            {variables.map((v) => {
              const isEditing = editingName === v.name;
              const error = errorMap.get(v.name);
              const deps = depGraph.get(v.name) ?? [];

              return (
                <div
                  key={v.name}
                  className={cn(
                    'border border-border p-2.5 transition-colors',
                    isEditing && 'border-primary/40 bg-primary/5',
                    error && !isEditing && 'border-destructive/40 bg-destructive/5',
                  )}
                  data-testid={`variable-row-${v.name}`}
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-medium text-foreground">{v.name}</span>
                        <div className="flex-1" />
                        <Input
                          placeholder="Unit"
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          onKeyDown={handleEditKeyDown}
                          className="w-20 text-xs h-7"
                          data-testid={`edit-unit-${v.name}`}
                        />
                      </div>
                      <Input
                        value={editExpression}
                        onChange={(e) => setEditExpression(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="text-xs font-mono h-7"
                        data-testid={`edit-expression-${v.name}`}
                        autoFocus
                      />
                      <Input
                        placeholder="Description"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        className="text-xs h-7"
                        data-testid={`edit-description-${v.name}`}
                      />
                      <div className="flex gap-1.5 justify-end">
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={cancelEdit} data-testid={`button-cancel-edit-${v.name}`}>
                          Cancel
                        </Button>
                        <Button size="sm" className="h-7 text-xs" onClick={saveEdit} data-testid={`button-save-edit-${v.name}`}>
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-medium text-foreground" data-testid={`text-var-name-${v.name}`}>{v.name}</span>
                          {v.unit && (
                            <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5" data-testid={`text-var-unit-${v.name}`}>
                              {v.unit}
                            </span>
                          )}
                          <span className="text-xs font-mono text-muted-foreground" data-testid={`text-var-expression-${v.name}`}>
                            = {v.value}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {error ? (
                            <span className="text-[10px] text-destructive flex items-center gap-1" data-testid={`error-var-${v.name}`}>
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              {error}
                            </span>
                          ) : (
                            <span className="text-sm font-mono font-bold text-[#00F0FF]" data-testid={`text-var-value-${v.name}`}>
                              {formatValue(v)}{v.unit ? ` ${v.unit}` : ''}
                            </span>
                          )}
                        </div>
                        {v.description && (
                          <p className="text-[10px] text-muted-foreground mt-0.5" data-testid={`text-var-desc-${v.name}`}>
                            {v.description}
                          </p>
                        )}
                        {deps.length > 0 && (
                          <p className="text-[10px] text-muted-foreground/60 mt-0.5" data-testid={`text-var-deps-${v.name}`}>
                            depends on: {deps.join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <StyledTooltip content="Edit variable">
                          <button
                            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
                            onClick={() => startEdit(v)}
                            data-testid={`button-edit-${v.name}`}
                            aria-label={`Edit ${v.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </StyledTooltip>
                        <ConfirmDialog
                          trigger={
                            <StyledTooltip content="Delete variable">
                              <button
                                className="p-1.5 text-destructive hover:bg-destructive/10 transition-colors"
                                data-testid={`button-delete-${v.name}`}
                                aria-label={`Delete ${v.name}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </StyledTooltip>
                          }
                          title="Delete Variable"
                          description={`Are you sure you want to delete "${v.name}"? Variables that depend on it will show errors.`}
                          confirmLabel="Delete"
                          variant="destructive"
                          onConfirm={() => handleDelete(v.name)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Dependency graph toggle */}
          {variables.length > 0 && (
            <div className="border-t border-border pt-2 pb-1">
              <button
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
                onClick={() => setShowDeps(!showDeps)}
                data-testid="button-toggle-deps"
              >
                {showDeps ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <GitBranch className="w-3.5 h-3.5" />
                Dependency Graph
              </button>
              {showDeps && (
                <div className="mt-2 space-y-1 text-[10px] font-mono text-muted-foreground" data-testid="section-dep-graph">
                  {Array.from(depGraph.entries()).map(([name, deps]) => (
                    <div key={name} className="flex items-center gap-1">
                      <span className="text-foreground">{name}</span>
                      {deps.length > 0 ? (
                        <>
                          <span className="text-muted-foreground/40">-&gt;</span>
                          <span>{deps.join(', ')}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/40">(no deps)</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats footer */}
          {variables.length > 0 && (
            <div className="border-t border-border pt-2 pb-1 text-[10px] text-muted-foreground flex items-center gap-3" data-testid="footer-variables-stats">
              <span>{String(variables.length)} variable{variables.length !== 1 ? 's' : ''}</span>
              {errors.length > 0 && (
                <span className="text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {String(errors.length)} error{errors.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
