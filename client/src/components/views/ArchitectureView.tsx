import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Connection, Edge, Node, ReactFlowProvider, useReactFlow, SelectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useDroppable, useDndMonitor } from '@dnd-kit/core';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useChat } from '@/lib/contexts/chat-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useDndState, type ComponentDragData } from '@/lib/dnd-context';
import CustomNode from './CustomNode';
import AssetManager from '@/components/panels/AssetManager';
import { cn } from '@/lib/utils';
import { MousePointer2, Grid, Move, Maximize, Cpu, Component, Pencil, Brain, X, RefreshCw, Zap, AlertTriangle, Info, ChevronDown, ChevronUp, Plus, ClipboardPaste, CheckSquare, ShieldCheck, FileJson, FileText, CircuitBoard } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { Badge } from '@/components/ui/badge';
import { copyToClipboard } from '@/lib/clipboard';
import { useSyncedFlowState } from '@/hooks/useSyncedFlowState';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArchitectureAnalyzer } from '@/lib/architecture-analyzer';
import type { DesignAnalysisReport, SubsystemCategory, ComplexityLevel } from '@/lib/architecture-analyzer';
import { NodeInspectorPanel } from './architecture/NodeInspectorPanel';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useCircuitDesigns, useCreateCircuitDesign, useCreateCircuitInstance } from '@/lib/circuit-editor/hooks';
import { STANDARD_LIBRARY_COMPONENTS } from '@shared/standard-library';

const nodeTypes = {
  custom: CustomNode,
};

const toolLabels: Record<string, string> = {
  select: 'Select mode',
  pan: 'Pan mode',
  grid: 'Toggle snap to grid',
  fit: 'Fit view to canvas',
};

const SUBSYSTEM_COLORS: Record<SubsystemCategory, string> = {
  power: 'bg-red-500/20 text-red-400 border-red-500/30',
  sensing: 'bg-green-500/20 text-green-400 border-green-500/30',
  control: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  communication: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  actuation: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  protection: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'user-interface': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  unknown: 'bg-muted text-muted-foreground border-border',
};

const COMPLEXITY_COLORS: Record<ComplexityLevel, string> = {
  simple: 'bg-green-500/20 text-green-400',
  moderate: 'bg-yellow-500/20 text-yellow-400',
  complex: 'bg-red-500/20 text-red-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-green-500/20 text-green-400',
};

function ArchitectureFlow() {
  const { nodes, edges, setNodes, setEdges, focusNodeId, selectedNodeId, setSelectedNodeId, pushUndoState, undo, redo, setPendingComponentPartId } = useArchitecture();
  const { isGenerating, addMessage, setIsGenerating } = useChat();
  const { addOutputLog } = useOutput();
  const { setActiveView } = useProjectMeta();
  const { bom } = useBom();
  const { toast } = useToast();
  const projectId = useProjectId();
  const { data: circuits } = useCircuitDesigns(projectId);
  const createDesignMutation = useCreateCircuitDesign();
  const createInstanceMutation = useCreateCircuitInstance();
  const { activeDrag } = useDndState();
  const contextMenuHintShown = useRef(false);
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  // Show the asset manager by default on desktop. This state now controls
  // visibility across both desktop and mobile, enabling a collapsible
  // asset library on larger screens.
  const [showAssetManager, setShowAssetManager] = useState(true);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Analysis panel state
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<DesignAnalysisReport | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    subsystems: true,
    patterns: true,
    power: false,
    suggestions: true,
    roles: false,
    education: false,
  });

  const analyzer = useMemo(() => new ArchitectureAnalyzer(), []);

  const runAnalysis = useCallback(() => {
    setAnalysisLoading(true);
    // Use setTimeout to avoid blocking the UI thread
    setTimeout(() => {
      const analysisNodes = nodes.map((n) => ({
        id: n.id,
        label: (n.data as Record<string, unknown>)?.label as string ?? n.id,
        type: (n.data as Record<string, unknown>)?.type as string | undefined,
      }));
      const analysisEdges = edges.map((e) => ({
        source: e.source,
        target: e.target,
        label: typeof e.label === 'string' ? e.label : undefined,
      }));
      const analysisBom = bom.map((b) => ({
        name: b.description || b.partNumber,
        category: undefined,
        value: undefined,
        quantity: b.quantity,
      }));
      const report = analyzer.analyze({
        nodes: analysisNodes,
        edges: analysisEdges,
        bomItems: analysisBom,
      });
      setAnalysisReport(report);
      setAnalysisLoading(false);
      addOutputLog(`[ARCH] Analysis complete: ${report.designType} (${report.complexity})`);
    }, 0);
  }, [nodes, edges, bom, analyzer, addOutputLog]);

  const handleToggleAnalysis = useCallback(() => {
    if (!showAnalysis) {
      runAnalysis();
    }
    setShowAnalysis((prev) => !prev);
  }, [showAnalysis, runAnalysis]);

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  // @dnd-kit droppable zone for the canvas area
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: 'architecture-canvas' });

  // Handle @dnd-kit drops from ComponentTree sidebar onto this canvas
  useDndMonitor({
    onDragEnd(event) {
      if (event.over?.id !== 'architecture-canvas') return;
      const data = event.active.data.current as ComponentDragData | undefined;
      if (data?.source !== 'component-tree') return;

      // Compute drop position in flow coordinates from the pointer position
      const pointerEvent = event.activatorEvent as PointerEvent;
      const finalX = pointerEvent.clientX + event.delta.x;
      const finalY = pointerEvent.clientY + event.delta.y;
      const position = reactFlowInstance.screenToFlowPosition({ x: finalX, y: finalY });

      const newNode = {
        id: crypto.randomUUID(),
        type: 'custom' as const,
        position,
        data: { label: data.label, type: data.nodeType },
      };
      pushUndoState();
      markNodeInteracted();
      setLocalNodes((nds) => nds.concat(newNode));
    },
  });

  const { nodeInteracted, edgeInteracted } = useSyncedFlowState({
    nodes, edges,
    setNodes, setEdges,
    localNodes, localEdges,
    setLocalNodes, setLocalEdges,
  });

  useEffect(() => {
    if (focusNodeId) {
      const targetNode = localNodes.find(n => n.id === focusNodeId);
      if (targetNode) {
        reactFlowInstance.setCenter(
          targetNode.position.x + 75,
          targetNode.position.y + 40,
          { zoom: 1.5, duration: 600 }
        );
        setLocalNodes(nds => nds.map(n => ({
          ...n,
          selected: n.id === focusNodeId,
          className: n.id === focusNodeId ? 'validation-focus-flash' : (n.className === 'validation-focus-flash' ? '' : n.className),
        })));
        // Remove the flash class after animation completes
        const timer = setTimeout(() => {
          setLocalNodes(nds => nds.map(n =>
            n.className === 'validation-focus-flash' ? { ...n, className: '' } : n,
          ));
        }, 600);
        return () => { clearTimeout(timer); };
      }
    }
  }, [focusNodeId, reactFlowInstance, setLocalNodes]);

  const markNodeInteracted = useCallback(() => { nodeInteracted.current = true; }, []);
  const markEdgeInteracted = useCallback(() => { edgeInteracted.current = true; }, []);

  const handlePaste = useCallback((bundle: { nodes?: Node[]; edges?: Edge[] } | null) => {
    if (!bundle || !bundle.nodes || bundle.nodes.length === 0) { return; }

    const { nodes: copiedNodes, edges: copiedEdges } = bundle;

    // Build old-ID → new-ID mapping
    const idMap = new Map<string, string>();
    for (const n of copiedNodes) {
      idMap.set(n.id, crypto.randomUUID());
    }

    // Compute paste offset: center of viewport + small jitter
    const center = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    // Bounding box center of copied nodes
    const minX = Math.min(...copiedNodes.map((n: Node) => n.position.x));
    const minY = Math.min(...copiedNodes.map((n: Node) => n.position.y));
    const maxX = Math.max(...copiedNodes.map((n: Node) => n.position.x));
    const maxY = Math.max(...copiedNodes.map((n: Node) => n.position.y));
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;
    const offsetX = center.x - bboxCenterX + 30;
    const offsetY = center.y - bboxCenterY + 30;

    const pastedNodes = copiedNodes.map((n: Node) => ({
      ...n,
      id: idMap.get(n.id)!,
      position: {
        x: n.position.x + offsetX,
        y: n.position.y + offsetY,
      },
      selected: true,
    }));

    const pastedEdges = (copiedEdges ?? []).map((ed: Edge) => ({
      ...ed,
      id: crypto.randomUUID(),
      source: idMap.get(ed.source) ?? ed.source,
      target: idMap.get(ed.target) ?? ed.target,
    }));

    pushUndoState();
    markNodeInteracted();
    if (pastedEdges.length > 0) markEdgeInteracted();
    // Deselect existing nodes before pasting
    setLocalNodes(nds => [
      ...nds.map(n => ({ ...n, selected: false })),
      ...pastedNodes,
    ]);
    if (pastedEdges.length > 0) {
      setLocalEdges(eds => [...eds, ...pastedEdges]);
    }
    addOutputLog(`[ARCH] Pasted ${pastedNodes.length} node(s) and ${pastedEdges.length} edge(s)`);
  }, [reactFlowInstance, pushUndoState, markNodeInteracted, markEdgeInteracted, setLocalNodes, setLocalEdges, addOutputLog]);

  const handleContextPaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (parsed.type === 'protopulse-architecture-bundle' || (parsed.nodes && Array.isArray(parsed.nodes))) {
        handlePaste(parsed);
        return;
      }
    } catch {
      // Clipboard empty or invalid
    }
    // Default: just add a new generic component if clipboard fails
    const center = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    pushUndoState();
    markNodeInteracted();
    setLocalNodes((nds) => [...nds, { id: crypto.randomUUID(), type: 'custom' as const, position: center, data: { label: 'New Component', type: 'mcu' } }]);
    addOutputLog('[ARCH] Added new component (no clipboard data)');
  }, [handlePaste, reactFlowInstance, pushUndoState, markNodeInteracted, setLocalNodes, addOutputLog]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Ignore shortcuts when the user is typing in an input/textarea
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
      // Ctrl+C — copy selected nodes + their connecting edges
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey) {
        const selected = localNodes.filter(n => n.selected);
        if (selected.length === 0) return; // let default copy happen
        e.preventDefault();
        const selectedIds = new Set(selected.map(n => n.id));
        const connectedEdges = localEdges.filter(
          ed => selectedIds.has(ed.source) && selectedIds.has(ed.target),
        );
        const bundle = {
          type: 'protopulse-architecture-bundle',
          nodes: selected,
          edges: connectedEdges,
        };
        clipboardRef.current = { nodes: selected, edges: connectedEdges };
        try {
          await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
          addOutputLog(`[ARCH] Copied ${selected.length} node(s) and ${connectedEdges.length} edge(s) to system clipboard`);
        } catch (err) {
          console.error('Copy failed', err);
          addOutputLog(`[ARCH] Copied ${selected.length} node(s) and ${connectedEdges.length} edge(s) to internal clipboard only`);
        }
      }
      // Ctrl+V — paste from internal or system clipboard with new IDs
      if ((e.metaKey || e.ctrlKey) && e.key === 'v' && !e.shiftKey) {
        let bundle = clipboardRef.current;
        if (!bundle || !bundle.nodes || bundle.nodes.length === 0) {
          try {
            const text = await navigator.clipboard.readText();
            const parsed = JSON.parse(text);
            if (parsed.type === 'protopulse-architecture-bundle' || (parsed.nodes && Array.isArray(parsed.nodes))) {
              bundle = { nodes: parsed.nodes, edges: parsed.edges || [] };
            }
          } catch (err) {
            // Not a valid bundle
          }
        }

        if (bundle && bundle.nodes && bundle.nodes.length > 0) {
          e.preventDefault();
          handlePaste(bundle);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, localNodes, localEdges, pushUndoState, markNodeInteracted, markEdgeInteracted, setLocalNodes, setLocalEdges, reactFlowInstance, addOutputLog, handlePaste]);

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      pushUndoState();
      markNodeInteracted();
      setLocalNodes((nds) => nds.filter((n) => !deleted.find((d) => d.id === n.id)));
    },
    [setLocalNodes, markNodeInteracted, pushUndoState],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      pushUndoState();
      markEdgeInteracted();
      setLocalEdges((eds) => eds.filter((e) => !deleted.find((d) => d.id === e.id)));
    },
    [setLocalEdges, markEdgeInteracted, pushUndoState],
  );

  const onConnect = useCallback(
    (params: Connection) => {
      pushUndoState();
      markEdgeInteracted();
      setLocalEdges((eds) => addEdge(params, eds));
    },
    [setLocalEdges, markEdgeInteracted, pushUndoState],
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const type = event.dataTransfer.getData('application/reactflow/type');
      const label = event.dataTransfer.getData('application/reactflow/label');

      const position = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const newNode = {
        id: crypto.randomUUID(),
        type: 'custom',
        position,
        data: { label, type },
      };

      pushUndoState();
      markNodeInteracted();
      setLocalNodes((nds) => nds.concat(newNode));
    },
    [setLocalNodes, markNodeInteracted, pushUndoState, reactFlowInstance],
  );

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const tools = [
    { icon: MousePointer2, id: 'select' as const, action: () => setActiveTool('select') },
    { icon: Move, id: 'pan' as const, action: () => setActiveTool('pan') },
    { icon: Grid, id: 'grid' as const, action: () => setSnapEnabled(!snapEnabled) },
    { icon: Maximize, id: 'fit' as const, action: () => reactFlowInstance.fitView({ padding: 0.2 }) },
  ];

  const handleAddNodeFromAsset = useCallback((type: string, label: string) => {
    const newNode = {
      id: crypto.randomUUID(),
      type: 'custom',
      position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: { label, type },
    };
    pushUndoState();
    markNodeInteracted();
    setLocalNodes((nds) => nds.concat(newNode));
  }, [setLocalNodes, markNodeInteracted, pushUndoState]);

  const handleAddComponent = useCallback((type: string) => {
    const newNode = {
      id: crypto.randomUUID(),
      type: 'custom',
      position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
      data: { label: type, type: type.toLowerCase() },
    };
    pushUndoState();
    markNodeInteracted();
    setLocalNodes((nds) => nds.concat(newNode));
  }, [setLocalNodes, markNodeInteracted, pushUndoState]);

  const handleToggleAssetManager = useCallback(() => {
    setShowAssetManager(prev => !prev);
  }, []);

  const handleCloseAssetManager = useCallback(() => {
    setShowAssetManager(false);
  }, []);

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: Node[] }) => {
    const firstSelected = selectedNodes.length > 0 ? selectedNodes[0].id : null;
    setSelectedNodeId(firstSelected);
  }, [setSelectedNodeId]);

  const handleInspectorUpdateNode = useCallback((nodeId: string, updates: Record<string, unknown>) => {
    pushUndoState();
    markNodeInteracted();
    setLocalNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)),
    );
  }, [setLocalNodes, markNodeInteracted, pushUndoState]);

  const handleInspectorDeleteNode = useCallback((nodeId: string) => {
    pushUndoState();
    markNodeInteracted();
    setLocalNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setLocalEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNodeId(null);
    addOutputLog('[INSPECTOR] Deleted node: ' + nodeId);
  }, [setLocalNodes, setLocalEdges, markNodeInteracted, pushUndoState, setSelectedNodeId, addOutputLog]);

  const handleInspectorClose = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  const handleGenerateArchitecture = useCallback(() => {
    const message = 'Generate a complete architecture for this project. Analyze the project description and create appropriate architecture nodes and connections.';
    addMessage({ id: crypto.randomUUID(), role: 'user', content: message, timestamp: Date.now(), mode: 'chat' });
    // Dispatch event so ChatPanel picks up the message and sends it to the AI
    window.dispatchEvent(new CustomEvent('protopulse:chat-send', { detail: { message } }));
  }, [addMessage]);

  const handleContextFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  const handleContextToggleGrid = useCallback(() => {
    setSnapEnabled(prev => !prev);
  }, []);

  const handleContextSelectAll = useCallback(() => {
    setLocalNodes((nds) => {
      addOutputLog('[ARCH] Selected all ' + nds.length + ' nodes');
      return nds.map((n) => ({ ...n, selected: true }));
    });
  }, [setLocalNodes, addOutputLog]);

  const handleContextExportJSON = useCallback(() => {
    copyToClipboard(JSON.stringify({ nodes, edges }, null, 2));
    addOutputLog('[ARCH] Exported architecture JSON to clipboard');
  }, [nodes, edges, addOutputLog]);

  const handleContextExportSummary = useCallback(() => {
    const lines: string[] = ['Architecture Summary', ''];
    lines.push(`Components (${nodes.length}):`);
    nodes.forEach(n => {
      const label = (n.data as Record<string, unknown>)?.label ?? n.id;
      const type = (n.data as Record<string, unknown>)?.type ?? 'unknown';
      lines.push(`  - ${label} [${type}]`);
    });
    lines.push('');
    lines.push(`Connections (${edges.length}):`);
    edges.forEach(e => {
      const src = nodes.find(n => n.id === e.source);
      const tgt = nodes.find(n => n.id === e.target);
      const srcLabel = (src?.data as Record<string, unknown>)?.label ?? e.source;
      const tgtLabel = (tgt?.data as Record<string, unknown>)?.label ?? e.target;
      lines.push(`  - ${srcLabel} → ${tgtLabel}`);
    });
    copyToClipboard(lines.join('\n'));
    addOutputLog('[ARCH] Copied architecture summary to clipboard');
  }, [nodes, edges, addOutputLog]);

  const handleContextMenuHint = useCallback(() => {
    if (contextMenuHintShown.current) return;
    const STORAGE_KEY = 'protopulse-ctx-menu-hint-seen';
    try {
      if (localStorage.getItem(STORAGE_KEY)) {
        contextMenuHintShown.current = true;
        return;
      }
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // localStorage unavailable — show hint anyway on first trigger
    }
    contextMenuHintShown.current = true;
    toast({
      title: 'Tip: Right-click for context menu options',
      description: 'Add components, paste, export, and more.',
    });
  }, [toast]);

  const handleContextEditComponent = useCallback(() => {
    if (selectedNodeId) {
      const node = localNodes.find(n => n.id === selectedNodeId);
      const partId = node?.data?.componentPartId;
      if (typeof partId === 'number') {
        setPendingComponentPartId(partId);
      }
      addOutputLog(`[ARCH] Opening Component Editor for node ${selectedNodeId}`);
      setActiveView('component_editor');
    }
  }, [selectedNodeId, localNodes, setPendingComponentPartId, addOutputLog, setActiveView]);

  const handleContextRunValidation = useCallback(() => {
    addOutputLog('[ARCH] Navigating to Validation view');
    setActiveView('validation');
  }, [addOutputLog, setActiveView]);

  const handleCreateSchematicInstance = useCallback(async () => {
    if (!selectedNodeId) { return; }
    const node = localNodes.find(n => n.id === selectedNodeId);
    if (!node) { return; }

    const nodeLabel = String(node.data?.label ?? '').toLowerCase();
    const nodeType = String(node.data?.type ?? '').toLowerCase();
    const searchTerms = [nodeLabel, nodeType].filter(Boolean);

    // Find matching standard library component via simple substring/keyword match
    const match = STANDARD_LIBRARY_COMPONENTS.find((comp) => {
      const title = comp.title.toLowerCase();
      const tags = comp.tags.map(t => t.toLowerCase());
      const category = comp.category.toLowerCase();
      return searchTerms.some(term =>
        title.includes(term) ||
        term.includes(title.split(' ')[0]) ||
        tags.some(tag => tag.includes(term) || term.includes(tag)) ||
        category.includes(term)
      );
    });

    if (!match) {
      toast({ title: 'No matching component found in library', description: `Could not find a standard library component matching "${node.data?.label ?? ''}"` });
      return;
    }

    try {
      // Ensure we have a circuit design to place the instance on
      let circuitId: number;
      if (circuits && circuits.length > 0) {
        circuitId = circuits[0].id;
      } else {
        const newCircuit = await createDesignMutation.mutateAsync({ projectId, name: 'Main Schematic' });
        circuitId = newCircuit.id;
      }

      // BL-0497: Let the server auto-generate the refdes from componentTitle
      await createInstanceMutation.mutateAsync({
        circuitId,
        partId: null,
        schematicX: 200,
        schematicY: 200,
        properties: {
          componentTitle: match.title,
          sourceArchNode: String(node.data?.label ?? ''),
        },
      });

      setActiveView('schematic');
      toast({ title: `Created ${match.title} on schematic`, description: `Placed from architecture node "${node.data?.label ?? ''}"` });
      addOutputLog(`[ARCH] Created schematic instance: ${match.title} from node ${selectedNodeId}`);
    } catch (err) {
      toast({ title: 'Failed to create schematic instance', description: err instanceof Error ? err.message : 'Unknown error' });
    }
  }, [selectedNodeId, localNodes, circuits, projectId, createDesignMutation, createInstanceMutation, setActiveView, toast, addOutputLog]);

  return (
    <ContextMenu onOpenChange={(open) => { if (open) handleContextMenuHint(); }}>
      <ContextMenuTrigger asChild>
        <div
          className={cn('w-full h-full relative group bg-background', isOver && activeDrag && 'ring-2 ring-primary/50 ring-inset')}
          ref={(el) => { reactFlowWrapper.current = el; setDropRef(el); }}
          data-testid="architecture-drop-zone"
        >
          {/* Asset manager is now controlled via showAssetManager state on both
             mobile and desktop. When collapsed, it won't render. */}
          {showAssetManager && (
            <AssetManager
              onDragStart={onDragStart}
              onAddNode={handleAddNodeFromAsset}
              onClose={handleCloseAssetManager}
            />
          )}

          <div className={cn("absolute top-4 right-4 md:right-auto z-10 flex items-center gap-1 bg-card/80 backdrop-blur-xl border border-border p-1 shadow-lg", showAssetManager ? "md:left-[300px]" : "md:left-4")}>
            <StyledTooltip content={showAssetManager ? 'Hide asset library' : 'Show asset library'} side="bottom">
              <button
                data-testid="toggle-asset-manager"
                className="p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-ring"
                onClick={handleToggleAssetManager}
                title={showAssetManager ? 'Hide asset library' : 'Show asset library'}
                aria-label="Toggle asset manager"
              >
                <Component className="w-5 h-5" />
              </button>
            </StyledTooltip>
            <div className="w-px h-5 bg-border mx-0.5" />
            {tools.map((tool) => (
              <StyledTooltip key={tool.id} content={toolLabels[tool.id]} side="bottom">
                <button
                  data-testid={`tool-${tool.id}`}
                  aria-label={toolLabels[tool.id]}
                  className={cn(
                    "p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-ring",
                    tool.id === 'select' && activeTool === 'select' && "bg-primary/20 text-primary border border-primary/40",
                    tool.id === 'pan' && activeTool === 'pan' && "bg-primary/20 text-primary border border-primary/40",
                    tool.id === 'grid' && snapEnabled && "bg-primary/20 text-primary",
                  )}
                  onClick={tool.action}
                >
                  <tool.icon className="w-5 h-5" />
                </button>
              </StyledTooltip>
            ))}
            <div className="w-px h-5 bg-border mx-0.5" />
            <StyledTooltip content={showAnalysis ? 'Close analysis' : 'Analyze design'} side="bottom">
              <button
                data-testid="tool-analyze"
                aria-label="Analyze design"
                className={cn(
                  "p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-ring",
                  showAnalysis && "bg-primary/20 text-primary border border-primary/40",
                )}
                onClick={handleToggleAnalysis}
              >
                <Brain className="w-5 h-5" />
              </button>
            </StyledTooltip>
          </div>

          <ReactFlow
            nodes={localNodes}
            edges={localEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={markNodeInteracted}
            onSelectionChange={handleSelectionChange}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodesDelete={onNodesDelete}
            onEdgesDelete={onEdgesDelete}
            deleteKeyCode={['Backspace', 'Delete']}
            nodeTypes={nodeTypes}
            fitView
            className="bg-transparent"
            colorMode="dark"
            snapToGrid={snapEnabled}
            snapGrid={[20, 20]}
            panOnDrag={activeTool === 'pan'}
            selectionOnDrag={activeTool !== 'pan'}
            selectionMode={SelectionMode.Partial}
          >
            <Background color="#333" gap={20} size={1} />
            <Controls className="!bg-card !border-border !fill-foreground" />
            <MiniMap
              className="!bg-card !border-border overflow-hidden"
              nodeColor={(n) => {
                if (n.type === 'custom') return '#06b6d4';
                return '#fff';
              }}
              maskColor="rgba(0, 0, 0, 0.6)"
            />
          </ReactFlow>

          {/* Edge color legend (AV-06) */}
          {localEdges.length > 0 && (
            <div className="absolute bottom-4 left-4 z-10 bg-card/80 backdrop-blur-xl border border-border p-2 shadow-lg" data-testid="edge-color-legend">
              <p className="text-[9px] font-medium text-muted-foreground mb-1">Edge Colors</p>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
                  <span className="text-[9px] text-muted-foreground">Data / Signal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-red-400 inline-block" />
                  <span className="text-[9px] text-muted-foreground">Power</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-yellow-400 inline-block" />
                  <span className="text-[9px] text-muted-foreground">Control</span>
                </div>
              </div>
            </div>
          )}

          {/* Analysis slide-over panel */}
          {showAnalysis && (
            <div
              className="absolute top-0 right-0 bottom-0 z-20 w-[340px] max-w-[90%] bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
              data-testid="analysis-panel"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground" data-testid="analysis-panel-title">Design Analysis</h3>
                </div>
                <div className="flex items-center gap-1">
                  <StyledTooltip content="Re-run analysis" side="bottom">
                    <button
                      data-testid="analysis-refresh"
                      aria-label="Refresh analysis"
                      className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      onClick={runAnalysis}
                      disabled={analysisLoading}
                    >
                      <RefreshCw className={cn("w-4 h-4", analysisLoading && "animate-spin")} />
                    </button>
                  </StyledTooltip>
                  <button
                    data-testid="analysis-close"
                    aria-label="Close analysis panel"
                    className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAnalysis(false)}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {analysisLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="analysis-loading">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-xs text-muted-foreground">Analyzing design...</p>
                  </div>
                )}

                {!analysisLoading && analysisReport && (
                  <>
                    {/* Summary */}
                    <div className="space-y-2" data-testid="analysis-summary">
                      <p className="text-xs text-muted-foreground leading-relaxed">{analysisReport.summary}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px]" data-testid="analysis-design-type">
                          {analysisReport.designType}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", COMPLEXITY_COLORS[analysisReport.complexity])}
                          data-testid="analysis-complexity"
                        >
                          {analysisReport.complexity}
                        </Badge>
                      </div>
                    </div>

                    {/* Subsystems */}
                    <div data-testid="analysis-subsystems">
                      <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => toggleSection('subsystems')}
                        data-testid="analysis-toggle-subsystems"
                      >
                        <span className="text-xs font-semibold text-foreground">Subsystems ({analysisReport.subsystems.length})</span>
                        {expandedSections.subsystems ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {expandedSections.subsystems && (
                        <div className="mt-2 space-y-1.5">
                          {analysisReport.subsystems.map((sub, i) => (
                            <div
                              key={`${sub.category}-${i}`}
                              className={cn("px-2.5 py-2 border text-[10px]", SUBSYSTEM_COLORS[sub.category])}
                              data-testid={`analysis-subsystem-${sub.category}`}
                            >
                              <div className="font-semibold">{sub.name}</div>
                              <div className="opacity-80 mt-0.5">{sub.description}</div>
                              <div className="opacity-60 mt-0.5">{sub.nodeIds.length} component{sub.nodeIds.length !== 1 ? 's' : ''}</div>
                            </div>
                          ))}
                          {analysisReport.subsystems.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No subsystems detected</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Detected Patterns */}
                    <div data-testid="analysis-patterns">
                      <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => toggleSection('patterns')}
                        data-testid="analysis-toggle-patterns"
                      >
                        <span className="text-xs font-semibold text-foreground">Detected Patterns ({analysisReport.detectedPatterns.length})</span>
                        {expandedSections.patterns ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {expandedSections.patterns && (
                        <div className="mt-2 space-y-1.5">
                          {analysisReport.detectedPatterns.map((pat, i) => (
                            <div key={`${pat.name}-${i}`} className="px-2.5 py-2 bg-muted/30 border border-border text-[10px]">
                              <div className="font-semibold text-foreground">{pat.name}</div>
                              <div className="text-muted-foreground mt-0.5">{pat.description}</div>
                              <div className="text-muted-foreground/60 mt-0.5">
                                Confidence: {Math.round(pat.confidence * 100)}% | {pat.nodeIds.length} node{pat.nodeIds.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ))}
                          {analysisReport.detectedPatterns.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No patterns detected</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Power Architecture */}
                    <div data-testid="analysis-power">
                      <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => toggleSection('power')}
                        data-testid="analysis-toggle-power"
                      >
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          Power Architecture
                        </span>
                        {expandedSections.power ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {expandedSections.power && (
                        <div className="mt-2 space-y-1 text-[10px]">
                          {analysisReport.powerArchitecture.sources.length > 0 && (
                            <div className="px-2.5 py-1.5 bg-red-500/10 border border-red-500/20">
                              <span className="font-semibold text-red-400">Sources:</span>{' '}
                              <span className="text-muted-foreground">{analysisReport.powerArchitecture.sources.join(', ')}</span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.regulators.length > 0 && (
                            <div className="px-2.5 py-1.5 bg-orange-500/10 border border-orange-500/20">
                              <span className="font-semibold text-orange-400">Regulators:</span>{' '}
                              <span className="text-muted-foreground">{analysisReport.powerArchitecture.regulators.join(', ')}</span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.voltageDomains.length > 0 && (
                            <div className="px-2.5 py-1.5 bg-yellow-500/10 border border-yellow-500/20">
                              <span className="font-semibold text-yellow-400">Voltage Domains:</span>{' '}
                              <span className="text-muted-foreground">{analysisReport.powerArchitecture.voltageDomains.join(', ')}</span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.distribution && (
                            <div className="px-2.5 py-1.5 bg-muted/30 border border-border">
                              <span className="font-semibold text-foreground">Distribution:</span>{' '}
                              <span className="text-muted-foreground">{analysisReport.powerArchitecture.distribution}</span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.sources.length === 0 &&
                            analysisReport.powerArchitecture.regulators.length === 0 && (
                            <p className="text-muted-foreground italic px-2.5">No power architecture detected</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Suggestions */}
                    <div data-testid="analysis-suggestions">
                      <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => toggleSection('suggestions')}
                        data-testid="analysis-toggle-suggestions"
                      >
                        <span className="text-xs font-semibold text-foreground">Suggestions ({analysisReport.suggestions.length})</span>
                        {expandedSections.suggestions ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {expandedSections.suggestions && (
                        <div className="mt-2 space-y-1.5">
                          {analysisReport.suggestions.map((sug, i) => (
                            <div key={`sug-${i}`} className="px-2.5 py-2 bg-muted/30 border border-border text-[10px]">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {sug.priority === 'high' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                                {sug.priority === 'medium' && <Info className="w-3 h-3 text-yellow-400 shrink-0" />}
                                {sug.priority === 'low' && <Info className="w-3 h-3 text-green-400 shrink-0" />}
                                <span className="font-semibold text-foreground">{sug.suggestion}</span>
                                <Badge variant="outline" className={cn("text-[8px] ml-auto shrink-0", PRIORITY_COLORS[sug.priority])}>
                                  {sug.priority}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground">{sug.reason}</div>
                            </div>
                          ))}
                          {analysisReport.suggestions.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No suggestions</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Component Roles */}
                    <div data-testid="analysis-roles">
                      <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => toggleSection('roles')}
                        data-testid="analysis-toggle-roles"
                      >
                        <span className="text-xs font-semibold text-foreground">Component Roles ({analysisReport.componentRoles.length})</span>
                        {expandedSections.roles ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {expandedSections.roles && (
                        <div className="mt-2 space-y-1">
                          {analysisReport.componentRoles.map((role) => (
                            <div key={role.nodeId} className="flex items-center justify-between px-2.5 py-1 bg-muted/20 border border-border/50 text-[10px]">
                              <span className="text-foreground font-medium truncate mr-2">{role.label}</span>
                              <span className="text-muted-foreground shrink-0">{role.role}</span>
                            </div>
                          ))}
                          {analysisReport.componentRoles.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No roles assigned</p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Educational Notes */}
                    <div data-testid="analysis-education">
                      <button
                        className="flex items-center justify-between w-full text-left"
                        onClick={() => toggleSection('education')}
                        data-testid="analysis-toggle-education"
                      >
                        <span className="text-xs font-semibold text-foreground">Educational Notes ({analysisReport.educationalNotes.length})</span>
                        {expandedSections.education ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </button>
                      {expandedSections.education && (
                        <div className="mt-2 space-y-1">
                          {analysisReport.educationalNotes.map((note, i) => (
                            <div key={`edu-${i}`} className="px-2.5 py-1.5 bg-primary/5 border border-primary/10 text-[10px] text-muted-foreground">
                              {note}
                            </div>
                          ))}
                          {analysisReport.educationalNotes.length === 0 && (
                            <p className="text-[10px] text-muted-foreground italic">No educational notes</p>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {!analysisLoading && !analysisReport && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <Brain className="w-8 h-8 text-muted-foreground opacity-50" />
                    <p className="text-xs text-muted-foreground">Click Refresh to analyze your design</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Node inspector panel — shown when a node is selected and analysis is not open */}
          {selectedNodeId && !showAnalysis && (() => {
            const inspectedNode = localNodes.find((n) => n.id === selectedNodeId);
            return inspectedNode ? (
              <NodeInspectorPanel
                node={inspectedNode}
                edges={localEdges}
                onUpdateNode={handleInspectorUpdateNode}
                onDeleteNode={handleInspectorDeleteNode}
                onClose={handleInspectorClose}
              />
            ) : null;
          })()}

          {isGenerating && (
            <div className="absolute inset-0 z-50 bg-background/50 backdrop-blur flex items-center justify-center pointer-events-none">
              <div className="bg-card border border-primary/50 p-6 shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 border-2 border-primary border-t-transparent animate-spin"></div>
                <div className="font-display font-bold text-lg text-primary tracking-widest animate-pulse">GENERATING ARCHITECTURE...</div>
              </div>
            </div>
          )}

          {localNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
              <div className="pointer-events-auto">
                <EmptyState
                  icon={Cpu}
                  title="Start Building Your Architecture"
                  description="Start building your system architecture. Add blocks from the sidebar or ask the AI assistant to generate one."
                  actionLabel="Generate Architecture"
                  actionTestId="button-generate-architecture"
                  onAction={handleGenerateArchitecture}
                />
              </div>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuSub>
          <ContextMenuSubTrigger data-testid="ctx-add-node">
            <Plus className="w-4 h-4 mr-2" />
            Add Node
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
            {['MCU', 'Sensor', 'Power', 'Communication', 'Connector'].map((t) => (
              <ContextMenuItem key={t} onSelect={() => handleAddComponent(t)}>{t}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem data-testid="ctx-paste" onSelect={handleContextPaste}>
          <ClipboardPaste className="w-4 h-4 mr-2" />
          Paste
          <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+V</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem data-testid="ctx-select-all" onSelect={handleContextSelectAll}>
          <CheckSquare className="w-4 h-4 mr-2" />
          Select All
          <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+A</span>
        </ContextMenuItem>
        <ContextMenuItem data-testid="ctx-zoom-to-fit" onSelect={handleContextFitView}>
          <Maximize className="w-4 h-4 mr-2" />
          Zoom to Fit
          <span className="ml-auto text-muted-foreground text-[10px]">F</span>
        </ContextMenuItem>
        <ContextMenuItem data-testid="ctx-toggle-grid" onSelect={handleContextToggleGrid}>
          <Grid className="w-4 h-4 mr-2" />
          Toggle Grid
          <span className="ml-auto text-muted-foreground text-[10px]">G</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem data-testid="ctx-run-validation" onSelect={handleContextRunValidation}>
          <ShieldCheck className="w-4 h-4 mr-2" />
          Run Validation
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem data-testid="ctx-copy-summary" onSelect={handleContextExportSummary}>
          <FileText className="w-4 h-4 mr-2" />
          Copy Summary
          <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+Shift+S</span>
        </ContextMenuItem>
        <ContextMenuItem data-testid="ctx-copy-json" onSelect={handleContextExportJSON}>
          <FileJson className="w-4 h-4 mr-2" />
          Copy JSON
          <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+Shift+J</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          data-testid="ctx-edit-component"
          disabled={!selectedNodeId}
          onSelect={handleContextEditComponent}
        >
          <Pencil className="w-3.5 h-3.5 mr-2" />
          Edit Component
        </ContextMenuItem>
        <ContextMenuItem
          data-testid="context-menu-create-schematic-instance"
          disabled={!selectedNodeId}
          onSelect={() => { void handleCreateSchematicInstance(); }}
        >
          <CircuitBoard className="w-3.5 h-3.5 mr-2" />
          Create Schematic Instance
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function ArchitectureView() {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow />
    </ReactFlowProvider>
  );
}
