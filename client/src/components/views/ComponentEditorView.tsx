import { useState, useEffect, useCallback, useRef } from 'react';
import { ComponentEditorProvider, useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { useComponentParts, useCreateComponentPart, useUpdateComponentPart } from '@/lib/component-editor/hooks';
import { useProject, PROJECT_ID } from '@/lib/project-context';
import type { EditorViewType, PartMeta } from '@shared/component-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Undo2, Redo2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ShapeCanvas from '@/components/views/component-editor/ShapeCanvas';
import PinTable from '@/components/views/component-editor/PinTable';

const TABS: { id: EditorViewType; label: string }[] = [
  { id: 'breadboard', label: 'Breadboard' },
  { id: 'schematic', label: 'Schematic' },
  { id: 'pcb', label: 'PCB' },
  { id: 'metadata', label: 'Metadata' },
  { id: 'pin-table', label: 'Pin Table' },
];

function MetadataForm() {
  const { state, dispatch } = useComponentEditor();
  const meta = state.present.meta;

  const updateField = (field: keyof PartMeta, value: unknown) => {
    dispatch({ type: 'UPDATE_META', payload: { [field]: value } });
  };

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-5" data-testid="metadata-form">
      <div className="space-y-1.5">
        <Label htmlFor="meta-title" className="text-muted-foreground">Title</Label>
        <Input
          id="meta-title"
          data-testid="input-meta-title"
          value={meta.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="e.g. ATmega328P"
          className="bg-card border-border"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meta-family" className="text-muted-foreground">Family</Label>
        <Input
          id="meta-family"
          data-testid="input-meta-family"
          value={meta.family ?? ''}
          onChange={(e) => updateField('family', e.target.value)}
          placeholder="e.g. AVR"
          className="bg-card border-border"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meta-description" className="text-muted-foreground">Description</Label>
        <Textarea
          id="meta-description"
          data-testid="input-meta-description"
          value={meta.description ?? ''}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Brief component description…"
          rows={3}
          className="bg-card border-border"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="meta-manufacturer" className="text-muted-foreground">Manufacturer</Label>
          <Input
            id="meta-manufacturer"
            data-testid="input-meta-manufacturer"
            value={meta.manufacturer ?? ''}
            onChange={(e) => updateField('manufacturer', e.target.value)}
            placeholder="e.g. Microchip"
            className="bg-card border-border"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meta-mpn" className="text-muted-foreground">MPN</Label>
          <Input
            id="meta-mpn"
            data-testid="input-meta-mpn"
            value={meta.mpn ?? ''}
            onChange={(e) => updateField('mpn', e.target.value)}
            placeholder="e.g. ATMEGA328P-AU"
            className="bg-card border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-muted-foreground">Mounting Type</Label>
          <Select
            value={meta.mountingType || ''}
            onValueChange={(val) => updateField('mountingType', val)}
          >
            <SelectTrigger data-testid="select-meta-mounting" className="bg-card border-border">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="tht">THT</SelectItem>
              <SelectItem value="smd">SMD</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="meta-package" className="text-muted-foreground">Package Type</Label>
          <Input
            id="meta-package"
            data-testid="input-meta-package"
            value={meta.packageType ?? ''}
            onChange={(e) => updateField('packageType', e.target.value)}
            placeholder="e.g. TQFP-32"
            className="bg-card border-border"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="meta-tags" className="text-muted-foreground">Tags</Label>
        <Input
          id="meta-tags"
          data-testid="input-meta-tags"
          value={meta.tags.join(', ')}
          onChange={(e) =>
            updateField(
              'tags',
              e.target.value
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
            )
          }
          placeholder="mcu, microcontroller, avr"
          className="bg-card border-border"
        />
      </div>
    </div>
  );
}

function CanvasPlaceholder({ view }: { view: string }) {
  return (
    <div className="flex-1 flex items-center justify-center" data-testid={`placeholder-${view}`}>
      <p className="text-muted-foreground text-lg">{view.charAt(0).toUpperCase() + view.slice(1)} canvas coming in Phase 2</p>
    </div>
  );
}

function ComponentEditorContent() {
  const { state, dispatch, canUndo, canRedo, undo, redo } = useComponentEditor();
  const { selectedNodeId } = useProject();
  const activeView = state.ui.activeEditorView;
  const { toast } = useToast();

  const [partId, setPartId] = useState<number | null>(null);
  const loadedRef = useRef(false);

  const { data: parts } = useComponentParts(PROJECT_ID);
  const createMutation = useCreateComponentPart();
  const updateMutation = useUpdateComponentPart();

  useEffect(() => {
    if (loadedRef.current || !parts) return;
    if (parts.length > 0) {
      const part = parts[0];
      setPartId(part.id);
      dispatch({
        type: 'LOAD_PART',
        payload: {
          meta: part.meta as any,
          connectors: part.connectors as any ?? [],
          buses: part.buses as any ?? [],
          views: part.views as any,
          constraints: part.constraints as any ?? [],
        },
      });
    }
    loadedRef.current = true;
  }, [parts, dispatch]);

  const handleSave = useCallback(async () => {
    const payload = {
      meta: state.present.meta,
      connectors: state.present.connectors,
      buses: state.present.buses,
      views: state.present.views,
      constraints: state.present.constraints || [],
    };

    try {
      if (partId) {
        await updateMutation.mutateAsync({
          id: partId,
          projectId: PROJECT_ID,
          data: payload,
        });
      } else {
        const created = await createMutation.mutateAsync({
          projectId: PROJECT_ID,
          ...payload,
        });
        setPartId(created.id);
      }
      dispatch({ type: 'MARK_CLEAN' });
      toast({ title: 'Saved', description: 'Component part saved successfully.' });
    } catch {
      toast({ title: 'Save failed', description: 'Could not save component part.', variant: 'destructive' });
    }
  }, [state.present, partId, updateMutation, createMutation, dispatch, toast]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === 's') {
        e.preventDefault();
        handleSave();
      } else if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      } else if (mod && e.key === 'z') {
        e.preventDefault();
        undo();
      } else if (mod && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave, undo, redo]);

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="w-full h-full flex flex-col bg-background" data-testid="component-editor">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              data-testid={`tab-${tab.id}`}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                activeView === tab.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
              onClick={() => dispatch({ type: 'SET_EDITOR_VIEW', payload: tab.id })}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {state.ui.isDirty && (
            <span
              data-testid="indicator-dirty"
              className="w-2 h-2 rounded-full bg-primary animate-pulse"
            />
          )}
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-save"
            disabled={!state.ui.isDirty || isSaving}
            onClick={handleSave}
            className={`h-8 w-8 ${
              state.ui.isDirty
                ? 'text-primary hover:text-primary hover:bg-primary/20'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Save className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-undo"
            disabled={!canUndo}
            onClick={undo}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Undo2 className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            data-testid="button-redo"
            disabled={!canRedo}
            onClick={redo}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {activeView === 'metadata' ? (
          <MetadataForm />
        ) : activeView === 'pin-table' ? (
          <PinTable />
        ) : activeView === 'breadboard' || activeView === 'schematic' || activeView === 'pcb' ? (
          <ShapeCanvas view={activeView} />
        ) : (
          <CanvasPlaceholder view={activeView} />
        )}
      </div>
    </div>
  );
}

export default function ComponentEditorView() {
  return (
    <ComponentEditorProvider>
      <ComponentEditorContent />
    </ComponentEditorProvider>
  );
}
