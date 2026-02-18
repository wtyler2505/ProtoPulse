import { useState, useEffect, useCallback, useRef } from 'react';
import { ComponentEditorProvider, useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { useComponentParts, useCreateComponentPart, useUpdateComponentPart } from '@/lib/component-editor/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useProject, PROJECT_ID } from '@/lib/project-context';
import type { EditorViewType, PartMeta } from '@shared/component-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Undo2, Redo2, Save, Cpu, ShieldCheck, Loader2, Box, CircuitBoard, GitBranch, FileText, Download, Upload, FileImage, History } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ShapeCanvas from '@/components/views/component-editor/ShapeCanvas';
import PinTable from '@/components/views/component-editor/PinTable';
import ComponentInspector from '@/components/views/component-editor/ComponentInspector';
import GeneratorModal from '@/components/views/component-editor/GeneratorModal';
import ValidationModal from '@/components/views/component-editor/ValidationModal';
import HistoryPanel from '@/components/views/component-editor/HistoryPanel';
import type { GeneratorResult } from '@/lib/component-editor/generators';
import { validatePart } from '@/lib/component-editor/validation';
import type { ComponentValidationIssue } from '@shared/component-types';

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
  const viewConfig: Record<string, { icon: React.ReactNode; message: string }> = {
    breadboard: {
      icon: <Box className="w-10 h-10 text-muted-foreground/50" />,
      message: 'No shapes yet. Use the toolbar to draw, or click Generate to create a component package.',
    },
    schematic: {
      icon: <GitBranch className="w-10 h-10 text-muted-foreground/50" />,
      message: 'Design the schematic symbol for your component.',
    },
    pcb: {
      icon: <CircuitBoard className="w-10 h-10 text-muted-foreground/50" />,
      message: 'Design the PCB footprint for your component.',
    },
  };

  const config = viewConfig[view] ?? {
    icon: <FileText className="w-10 h-10 text-muted-foreground/50" />,
    message: `${view.charAt(0).toUpperCase() + view.slice(1)} view`,
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8" data-testid={`placeholder-${view}`}>
      {config.icon}
      <p className="text-muted-foreground text-sm text-center max-w-md">{config.message}</p>
    </div>
  );
}

function ComponentEditorContent() {
  const { state, dispatch, canUndo, canRedo, undo, redo } = useComponentEditor();
  const { selectedNodeId, pendingComponentPartId, setPendingComponentPartId } = useProject();
  const activeView = state.ui.activeEditorView;
  const { toast } = useToast();

  const [partId, setPartId] = useState<number | null>(null);
  const loadedRef = useRef(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ComponentValidationIssue[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingSvg, setIsImportingSvg] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: parts, isLoading: partsLoading } = useComponentParts(PROJECT_ID);
  const createMutation = useCreateComponentPart();
  const updateMutation = useUpdateComponentPart();

  useEffect(() => {
    if (loadedRef.current || !parts) return;
    if (parts.length > 0) {
      const targetId = pendingComponentPartId;
      const part = targetId
        ? parts.find(p => p.id === targetId) ?? parts[0]
        : parts[0];
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
      if (targetId) {
        setPendingComponentPartId(null);
      }
    }
    loadedRef.current = true;
  }, [parts, dispatch, pendingComponentPartId, setPendingComponentPartId]);

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

  useEffect(() => {
    if (!state.ui.isDirty || !partId) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [state.ui.isDirty, state.present, partId, handleSave]);

  const handleGenerate = useCallback((result: GeneratorResult) => {
    const view = (activeView === 'breadboard' || activeView === 'schematic' || activeView === 'pcb') ? activeView : 'breadboard';
    for (const shape of result.shapes) {
      dispatch({ type: 'ADD_SHAPE', payload: { view, shape } });
    }
    for (const connector of result.connectors) {
      dispatch({ type: 'ADD_CONNECTOR', payload: connector });
    }
    if (activeView !== view) {
      dispatch({ type: 'SET_EDITOR_VIEW', payload: view });
    }
    toast({ title: 'Generated', description: `Created ${result.shapes.length} shapes and ${result.connectors.length} pins.` });
  }, [activeView, dispatch, toast]);

  const handleNavigateToIssue = useCallback((issue: ComponentValidationIssue) => {
    const isCanvasView = (v: string): v is 'breadboard' | 'schematic' | 'pcb' => ['breadboard', 'schematic', 'pcb'].includes(v);

    if (issue.elementId) {
      const allShapeIds = new Set<string>();
      for (const viewKey of ['breadboard', 'schematic', 'pcb'] as const) {
        for (const shape of state.present.views[viewKey].shapes) {
          allShapeIds.add(shape.id);
        }
      }

      if (allShapeIds.has(issue.elementId)) {
        if (issue.view && isCanvasView(issue.view)) {
          dispatch({ type: 'SET_EDITOR_VIEW', payload: issue.view });
        }
        dispatch({ type: 'SET_SELECTION', payload: [issue.elementId] });
      } else if (state.present.connectors.some(c => c.id === issue.elementId)) {
        dispatch({ type: 'SET_CONNECTOR_SELECTION', payload: issue.elementId });
        dispatch({ type: 'SET_EDITOR_VIEW', payload: 'pin-table' });
      }
    } else if (issue.view && isCanvasView(issue.view)) {
      dispatch({ type: 'SET_EDITOR_VIEW', payload: issue.view });
    } else if (!issue.view && !issue.elementId && /title|description/i.test(issue.message)) {
      dispatch({ type: 'SET_EDITOR_VIEW', payload: 'metadata' });
    }

    setValidationOpen(false);
  }, [state.present, dispatch]);

  const handleExportFzpz = useCallback(() => {
    if (!partId) {
      toast({ title: 'No component', description: 'Save a component first before exporting.', variant: 'destructive' });
      return;
    }
    const link = document.createElement('a');
    link.href = `/api/projects/${PROJECT_ID}/component-parts/${partId}/export/fzpz`;
    link.download = `${(state.present.meta.title || 'component').replace(/[^a-zA-Z0-9_-]/g, '_')}.fzpz`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [partId, state.present.meta.title, toast]);

  const handleImportFzpz = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    try {
      const res = await fetch(`/api/projects/${PROJECT_ID}/component-parts/import/fzpz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(err.message || 'Import failed');
      }
      const created = await res.json();
      queryClient.invalidateQueries({ queryKey: ['component-parts'] });
      setPartId(created.id);
      dispatch({
        type: 'LOAD_PART',
        payload: {
          meta: created.meta,
          connectors: created.connectors ?? [],
          buses: created.buses ?? [],
          views: created.views,
          constraints: created.constraints ?? [],
        },
      });
      toast({ title: 'Imported', description: `Component "${created.meta?.title || 'Untitled'}" imported successfully.` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message || 'Could not import FZPZ file.', variant: 'destructive' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [queryClient, dispatch, toast]);

  const handleImportSvg = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImportingSvg(true);
    try {
      const svgText = await file.text();
      const res = await fetch(`/api/projects/${PROJECT_ID}/component-parts/${partId || 0}/import/svg`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/xml' },
        body: svgText,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'SVG import failed' }));
        throw new Error(err.message || 'SVG import failed');
      }
      const { shapes } = await res.json();
      const view = (activeView === 'breadboard' || activeView === 'schematic' || activeView === 'pcb') ? activeView : 'breadboard';
      for (const shape of shapes) {
        dispatch({ type: 'ADD_SHAPE', payload: { view, shape } });
      }
      if (activeView !== view) {
        dispatch({ type: 'SET_EDITOR_VIEW', payload: view });
      }
      toast({ title: 'SVG Imported', description: `Imported ${shapes.length} shape(s) into ${view} view.` });
    } catch (err: any) {
      toast({ title: 'SVG Import failed', description: err.message || 'Could not import SVG file.', variant: 'destructive' });
    } finally {
      setIsImportingSvg(false);
      if (svgFileInputRef.current) svgFileInputRef.current.value = '';
    }
  }, [partId, activeView, dispatch, toast]);

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
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-generate"
            onClick={() => setGeneratorOpen(true)}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Cpu className="w-4 h-4" />
            <span className="text-xs">Generate</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-validate"
            onClick={() => { setValidationIssues(validatePart(state.present)); setValidationOpen(true); }}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <ShieldCheck className="w-4 h-4" />
            <span className="text-xs">Validate</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-export-fzpz"
            onClick={handleExportFzpz}
            disabled={!partId}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs">Export</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-import-fzpz"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span className="text-xs">Import</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".fzpz"
            className="hidden"
            onChange={handleImportFzpz}
            data-testid="input-import-fzpz"
          />
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-import-svg"
            onClick={() => svgFileInputRef.current?.click()}
            disabled={isImportingSvg}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            {isImportingSvg ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileImage className="w-4 h-4" />}
            <span className="text-xs">Import SVG</span>
          </Button>
          <input
            ref={svgFileInputRef}
            type="file"
            accept=".svg"
            className="hidden"
            onChange={handleImportSvg}
            data-testid="input-import-svg"
          />
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-history"
            onClick={() => setHistoryOpen((v) => !v)}
            className={`h-8 gap-1 relative ${historyOpen ? 'text-[#00F0FF] bg-[#00F0FF]/10' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <History className="w-4 h-4" />
            <span className="text-xs">History</span>
            {(state.past.length + state.future.length) > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[9px] min-w-[16px] h-4 flex items-center justify-center rounded-full bg-[#00F0FF]/20 text-[#00F0FF] font-medium"
                data-testid="badge-history-count"
              >
                {state.past.length + state.future.length}
              </span>
            )}
          </Button>
          <div className="w-px h-5 bg-border mx-1" />
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

      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 overflow-auto">
          {partsLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 h-full" data-testid="loading-editor">
              <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
              <p className="text-muted-foreground text-sm">Loading component data…</p>
            </div>
          ) : activeView === 'metadata' ? (
            !partId ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 h-full p-8" data-testid="empty-metadata">
                <FileText className="w-10 h-10 text-muted-foreground/50" />
                <p className="text-muted-foreground text-sm text-center max-w-md">Create or select a component part to edit its metadata.</p>
              </div>
            ) : (
              <MetadataForm />
            )
          ) : activeView === 'pin-table' ? (
            <PinTable />
          ) : activeView === 'breadboard' || activeView === 'schematic' || activeView === 'pcb' ? (
            <ShapeCanvas view={activeView} />
          ) : (
            <CanvasPlaceholder view={activeView} />
          )}
        </div>
        <ComponentInspector />
        {historyOpen && <HistoryPanel />}
      </div>
      <GeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={handleGenerate}
      />
      <ValidationModal
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        issues={validationIssues}
        onNavigate={handleNavigateToIssue}
      />
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
