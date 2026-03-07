import { useState, useEffect, useCallback, useRef } from 'react';
import { ComponentEditorProvider, useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { useComponentParts, useCreateComponentPart, useUpdateComponentPart, useDeleteComponentPart, usePublishToLibrary } from '@/lib/component-editor/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import type { EditorViewType, PartMeta, Connector, Bus, PartViews, Constraint } from '@shared/component-types';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Undo2, Redo2, Save, Cpu, ShieldCheck, Loader2, Box, CircuitBoard, GitBranch, FileText, Download, Upload, FileImage, History, Shield, Share2, Library, Plus, Sparkles, Camera } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ShapeCanvas from '@/components/views/component-editor/ShapeCanvas';
import PinTable from '@/components/views/component-editor/PinTable';
import ComponentInspector from '@/components/views/component-editor/ComponentInspector';
import GeneratorModal from '@/components/views/component-editor/GeneratorModal';
import ModifyModal from '@/components/views/component-editor/ModifyModal';
import DatasheetExtractModal from '@/components/views/component-editor/DatasheetExtractModal';
import PinExtractModal from '@/components/views/component-editor/PinExtractModal';
import type { PartState } from '@shared/component-types';
import ValidationModal from '@/components/views/component-editor/ValidationModal';
import HistoryPanel from '@/components/views/component-editor/HistoryPanel';
import DRCPanel from '@/components/views/component-editor/DRCPanel';
import type { GeneratorResult } from '@/lib/component-editor/generators';
import { validatePart } from '@/lib/component-editor/validation';
import { runDRC, getDefaultDRCRules } from '@/lib/component-editor/drc';
import type { ComponentValidationIssue, DRCViolation, DRCRule } from '@shared/component-types';
import { createDefaultPartState } from '@shared/component-types';
import ComponentLibraryBrowser from '@/components/views/component-editor/ComponentLibraryBrowser';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import type { ComponentPart } from '@shared/schema';

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
  const { selectedNodeId, pendingComponentPartId, setPendingComponentPartId } = useArchitecture();
  const projectId = useProjectId();
  const activeView = state.ui.activeEditorView;
  const { toast } = useToast();

  const [partId, setPartId] = useState<number | null>(null);
  const loadedRef = useRef(false);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [modifyOpen, setModifyOpen] = useState(false);
  const [datasheetExtractOpen, setDatasheetExtractOpen] = useState(false);
  const [pinExtractOpen, setPinExtractOpen] = useState(false);
  const [validationOpen, setValidationOpen] = useState(false);
  const [validationIssues, setValidationIssues] = useState<ComponentValidationIssue[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgFileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingSvg, setIsImportingSvg] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [drcViolations, setDrcViolations] = useState<DRCViolation[]>([]);
  const [drcOpen, setDrcOpen] = useState(false);
  const [showDrcOverlays, setShowDrcOverlays] = useState(true);
  const [drcRules, setDrcRules] = useState(() => getDefaultDRCRules());
  const [publishOpen, setPublishOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [publishTags, setPublishTags] = useState('');
  const [publishIsPublic, setPublishIsPublic] = useState(true);
  const queryClient = useQueryClient();

  const { data: parts, isLoading: partsLoading } = useComponentParts(projectId);
  const createMutation = useCreateComponentPart();
  const updateMutation = useUpdateComponentPart();
  const publishMutation = usePublishToLibrary();

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
          meta: part.meta as PartMeta,
          connectors: part.connectors as Connector[] ?? [],
          buses: part.buses as Bus[] ?? [],
          views: part.views as PartViews,
          constraints: part.constraints as Constraint[] ?? [],
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
          projectId: projectId,
          data: payload,
        });
      } else {
        const created = await createMutation.mutateAsync({
          projectId: projectId,
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
    const handleKeyDown = (e: KeyboardEvent) => {
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
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, undo, redo]);

  useEffect(() => {
    if (!state.ui.isDirty || !partId) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => clearTimeout(timer);
  }, [state.ui.isDirty, state.present, partId, handleSave]);

  useEffect(() => {
    const view = activeView;
    if (view !== 'breadboard' && view !== 'schematic' && view !== 'pcb') return;
    const timer = setTimeout(() => {
      const violations = runDRC(state.present, drcRules, view);
      setDrcViolations(violations);
    }, 500);
    return () => clearTimeout(timer);
  }, [state.present, activeView, drcRules]);

  const handleValidateAll = useCallback(() => {
    const partIssues = validatePart(state.present);
    const view = activeView;
    if (view === 'breadboard' || view === 'schematic' || view === 'pcb') {
      const drcResults = runDRC(state.present, drcRules, view);
      const drcAsIssues: ComponentValidationIssue[] = drcResults.map(v => ({
        id: v.id,
        severity: v.severity,
        message: `[DRC] ${v.message}`,
        view: v.view,
        elementId: v.shapeIds[0],
        suggestion: v.actual !== undefined && v.required !== undefined
          ? `Actual: ${v.actual}, Required: ${v.required}`
          : undefined,
      }));
      setValidationIssues([...partIssues, ...drcAsIssues]);
    } else {
      setValidationIssues(partIssues);
    }
    setValidationOpen(true);
  }, [state.present, activeView, drcRules]);

  const handleUpdateDrcRule = useCallback((index: number, updates: Partial<DRCRule>) => {
    setDrcRules(prev => prev.map((rule, i) => i === index ? { ...rule, ...updates } : rule));
  }, []);

  const handleDrcHighlight = useCallback((shapeIds: string[]) => {
    dispatch({ type: 'SET_SELECTION', payload: shapeIds });
  }, [dispatch]);

  const handleRunDrc = useCallback(() => {
    const view = activeView;
    if (view !== 'breadboard' && view !== 'schematic' && view !== 'pcb') return;
    const violations = runDRC(state.present, drcRules, view);
    setDrcViolations(violations);
  }, [state.present, activeView, drcRules]);

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

  const handleModifyApply = useCallback((newState: PartState) => {
    dispatch({
      type: 'SET_PART_STATE',
      payload: {
        label: 'AI Modify',
        state: newState,
      },
    });
    toast({ title: 'AI Changes Applied', description: 'Component has been modified.' });
  }, [dispatch, toast]);

  const handleDatasheetExtractApply = useCallback((updates: Partial<PartMeta>) => {
    dispatch({ type: 'UPDATE_META', payload: updates });
    const count = Object.keys(updates).length;
    toast({ title: 'Metadata Extracted', description: `Applied ${count} field${count !== 1 ? 's' : ''} from datasheet.` });
  }, [dispatch, toast]);

  const handlePinExtractApply = useCallback((connectors: Connector[]) => {
    for (const conn of connectors) {
      dispatch({ type: 'ADD_CONNECTOR', payload: conn });
    }
    toast({ title: 'Pins Extracted', description: `Added ${connectors.length} pin${connectors.length !== 1 ? 's' : ''} from photo.` });
  }, [dispatch, toast]);

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
    link.href = `/api/projects/${projectId}/component-parts/${partId}/export/fzpz`;
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
      const res = await fetch(`/api/projects/${projectId}/component-parts/import/fzpz`, {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not import FZPZ file.';
      toast({ title: 'Import failed', description: message, variant: 'destructive' });
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
      const res = await fetch(`/api/projects/${projectId}/component-parts/${partId || 0}/import/svg`, {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Could not import SVG file.';
      toast({ title: 'SVG Import failed', description: message, variant: 'destructive' });
    } finally {
      setIsImportingSvg(false);
      if (svgFileInputRef.current) svgFileInputRef.current.value = '';
    }
  }, [partId, activeView, dispatch, toast]);

  const handlePublish = useCallback(() => {
    const issues = validatePart(state.present);
    if (issues.some(i => i.severity === 'error')) {
      toast({ title: 'Validation failed', description: 'Fix validation errors before publishing.', variant: 'destructive' });
      return;
    }
    setPublishTags(state.present.meta.tags?.join(', ') || '');
    setPublishIsPublic(true);
    setPublishOpen(true);
  }, [state.present, toast]);

  const handleConfirmPublish = useCallback(async () => {
    try {
      await publishMutation.mutateAsync({
        title: state.present.meta.title || 'Untitled',
        description: state.present.meta.description || undefined,
        meta: state.present.meta,
        connectors: state.present.connectors,
        buses: state.present.buses,
        views: state.present.views,
        constraints: state.present.constraints || [],
        tags: publishTags.split(',').map(t => t.trim()).filter(Boolean),
        category: state.present.meta.family || undefined,
        isPublic: publishIsPublic,
      });
      setPublishOpen(false);
      toast({ title: 'Published', description: 'Component published to library.' });
    } catch {
      toast({ title: 'Publish failed', description: 'Could not publish component.', variant: 'destructive' });
    }
  }, [state.present, publishTags, publishIsPublic, publishMutation, toast]);

  const handleCreateNewPart = useCallback(async () => {
    if (state.ui.isDirty && partId) {
      await handleSave();
    }
    try {
      const created = await createMutation.mutateAsync({ projectId: projectId });
      setPartId(created.id);
      dispatch({ type: 'LOAD_PART', payload: createDefaultPartState() });
      loadedRef.current = true;
    } catch {
      toast({ title: 'Error', description: 'Could not create new part.', variant: 'destructive' });
    }
  }, [state.ui.isDirty, partId, handleSave, createMutation, dispatch, toast]);

  const handleSwitchPart = useCallback(async (part: ComponentPart) => {
    if (state.ui.isDirty && partId) {
      await handleSave();
    }
    setPartId(part.id);
    dispatch({
      type: 'LOAD_PART',
      payload: {
        meta: part.meta as PartMeta,
        connectors: part.connectors as Connector[] ?? [],
        buses: part.buses as Bus[] ?? [],
        views: part.views as PartViews,
        constraints: part.constraints as Constraint[] ?? [],
      },
    });
  }, [state.ui.isDirty, partId, handleSave, dispatch]);

  const handleLibraryForked = useCallback((forkedPartId: number) => {
    queryClient.invalidateQueries({ queryKey: ['component-parts'] });
    setPartId(forkedPartId);
    loadedRef.current = false;
  }, [queryClient]);

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
            data-testid="button-ai-modify"
            onClick={() => setModifyOpen(true)}
            disabled={!partId}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Sparkles className="w-4 h-4" />
            <span className="text-xs">AI Modify</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-extract-datasheet"
            onClick={() => setDatasheetExtractOpen(true)}
            disabled={!partId}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <FileText className="w-4 h-4" />
            <span className="text-xs">Datasheet</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-extract-pins"
            onClick={() => setPinExtractOpen(true)}
            disabled={!partId}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Camera className="w-4 h-4" />
            <span className="text-xs">Pins</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-validate"
            onClick={handleValidateAll}
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
            data-testid="button-publish"
            onClick={handlePublish}
            disabled={!partId}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Share2 className="w-4 h-4" />
            <span className="text-xs">Publish</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-library"
            onClick={() => setLibraryOpen(true)}
            className="h-8 gap-1 text-muted-foreground hover:text-foreground"
          >
            <Library className="w-4 h-4" />
            <span className="text-xs">Library</span>
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
            data-testid="button-drc"
            onClick={() => setDrcOpen((v) => !v)}
            className={`h-8 gap-1 relative ${drcOpen ? 'text-editor-accent bg-editor-accent/10' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Shield className="w-4 h-4" />
            <span className="text-xs">DRC</span>
            {drcViolations.length > 0 && (
              <span
                className={`absolute -top-1 -right-1 text-[9px] min-w-[16px] h-4 flex items-center justify-center rounded-full font-medium ${
                  drcViolations.some(v => v.severity === 'error')
                    ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
                data-testid="badge-drc-count"
              >
                {drcViolations.length}
              </span>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="button-history"
            onClick={() => setHistoryOpen((v) => !v)}
            className={`h-8 gap-1 relative ${historyOpen ? 'text-editor-accent bg-editor-accent/10' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <History className="w-4 h-4" />
            <span className="text-xs">History</span>
            {(state.past.length + state.future.length) > 0 && (
              <span
                className="absolute -top-1 -right-1 text-[9px] min-w-[16px] h-4 flex items-center justify-center rounded-full bg-editor-accent/20 text-editor-accent font-medium"
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
            aria-label="Save"
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
            aria-label="Undo"
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
            aria-label="Redo"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <Redo2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-48 border-r border-border flex flex-col bg-card/50">
          <div className="p-2 flex items-center justify-between border-b border-border">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Parts</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCreateNewPart} data-testid="button-new-part" aria-label="Add new part">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {parts?.map(part => (
              <button
                key={part.id}
                data-testid={`part-item-${part.id}`}
                className={`w-full text-left px-3 py-2 text-sm border-b border-border/50 transition-colors ${
                  partId === part.id
                    ? 'bg-editor-accent/10 text-editor-accent border-l-2 border-l-editor-accent'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
                onClick={() => handleSwitchPart(part)}
              >
                <div className="font-medium truncate">{(part.meta as PartMeta)?.title || `Part #${part.id}`}</div>
                <div className="text-xs opacity-60 truncate">{(part.meta as PartMeta)?.family || 'No family'}</div>
              </button>
            ))}
          </div>
        </div>
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
            <ShapeCanvas view={activeView} drcViolations={showDrcOverlays ? drcViolations : []} />
          ) : (
            <CanvasPlaceholder view={activeView} />
          )}
        </div>
        <ComponentInspector />
        {drcOpen && (
          <DRCPanel
            violations={drcViolations}
            onRunDRC={handleRunDrc}
            showOverlays={showDrcOverlays}
            onToggleOverlays={() => setShowDrcOverlays(v => !v)}
            onHighlight={handleDrcHighlight}
            rules={drcRules}
            onUpdateRule={handleUpdateDrcRule}
          />
        )}
        {historyOpen && <HistoryPanel />}
      </div>
      <GeneratorModal
        open={generatorOpen}
        onClose={() => setGeneratorOpen(false)}
        onGenerate={handleGenerate}
      />
      {partId && (
        <>
          <ModifyModal
            open={modifyOpen}
            onOpenChange={setModifyOpen}
            currentPart={state.present}
            projectId={projectId}
            partId={partId}
            onApply={handleModifyApply}
          />
          <DatasheetExtractModal
            open={datasheetExtractOpen}
            onOpenChange={setDatasheetExtractOpen}
            projectId={projectId}
            partId={partId}
            currentMeta={state.present.meta}
            onApply={handleDatasheetExtractApply}
          />
          <PinExtractModal
            open={pinExtractOpen}
            onOpenChange={setPinExtractOpen}
            projectId={projectId}
            partId={partId}
            currentMeta={state.present.meta}
            onApply={handlePinExtractApply}
          />
        </>
      )}
      <ValidationModal
        open={validationOpen}
        onClose={() => setValidationOpen(false)}
        issues={validationIssues}
        onNavigate={handleNavigateToIssue}
      />
      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent className="max-w-md bg-background border-border" data-testid="dialog-publish">
          <DialogHeader>
            <DialogTitle>Publish to Library</DialogTitle>
            <DialogDescription className="sr-only">Publish this component to the shared library</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="publish-tags" className="text-muted-foreground text-sm">Tags (comma-separated)</Label>
              <Input
                id="publish-tags"
                data-testid="input-publish-tags"
                value={publishTags}
                onChange={(e) => setPublishTags(e.target.value)}
                placeholder="mcu, sensor, ic"
                className="bg-card border-border"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-sm">Category</Label>
              <Input
                data-testid="input-publish-category"
                value={state.present.meta.family || ''}
                disabled
                className="bg-card border-border opacity-60"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="publish-public"
                data-testid="checkbox-publish-public"
                checked={publishIsPublic}
                onCheckedChange={(checked) => setPublishIsPublic(checked === true)}
              />
              <Label htmlFor="publish-public" className="text-sm text-muted-foreground cursor-pointer">Make public</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" data-testid="button-cancel-publish" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              data-testid="button-confirm-publish"
              onClick={handleConfirmPublish}
              disabled={publishMutation.isPending}
              className="bg-editor-accent text-black hover:bg-editor-accent/80"
            >
              {publishMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ComponentLibraryBrowser
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        projectId={projectId}
        onForked={handleLibraryForked}
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
