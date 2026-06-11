import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDroppable, useDndMonitor } from '@dnd-kit/core';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useChat } from '@/lib/contexts/chat-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectMeta } from '@/lib/project-context';
import { useBom } from '@/lib/contexts/bom-context';
import { useDndState, type ComponentDragData } from '@/lib/dnd-context';
import AssetManager from '@/components/panels/AssetManager';
import { cn } from '@/lib/utils';
import { PROTOPULSE_DRAG_LABEL, PROTOPULSE_DRAG_TYPE } from '@/lib/drag-mime';
import {
  MousePointer2,
  Grid,
  Move,
  Maximize,
  Cpu,
  Component,
  Brain,
  X,
  RefreshCw,
  Zap,
  AlertTriangle,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent } from '@/components/ui/context-menu';
import RadialCommandLinearMenu from '@/components/ui/RadialCommandLinearMenu';
import { Badge } from '@/components/ui/badge';
import { copyToClipboard } from '@/lib/clipboard';
import { useSyncedFlowState } from '@/hooks/useSyncedFlowState';
import { useToast } from '@/hooks/use-toast';
import { EmptyState } from '@/components/ui/EmptyState';
import { ArchitectureAnalyzer } from '@/lib/architecture-analyzer';
import type { DesignAnalysisReport, SubsystemCategory, ComplexityLevel } from '@/lib/architecture-analyzer';
import { getNodeAnchor } from '@/lib/diagram';
import { NodeInspectorPanel } from './architecture/NodeInspectorPanel';
import { V3ArchitectureReadinessPanel } from './architecture/V3ArchitectureReadinessPanel';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useCircuitDesigns, useCreateCircuitDesign, useCreateCircuitInstance } from '@/lib/circuit-editor/hooks';
import { STANDARD_LIBRARY_COMPONENTS } from '@shared/standard-library';
import { SnippetLibrary } from '@/lib/design-reuse';
import { placeSnippetAtomic } from '@/lib/snippet-undo';
import { LibrarySuggestPopover } from '@/components/ui/LibrarySuggestPopover';
import type { LibrarySuggestion } from '@/lib/library-auto-suggest';
import { logger } from '@/lib/logger';
import type { GraphEdge, GraphNode } from '@/lib/graph-types';
import { evaluateLiveV3Readiness } from '@/lib/v3-architecture-live';
import { buildLiveArchitectureCompileReport } from '@/lib/v3-architecture-compiler';
import { saveV3CompileRun, saveV3SwarmTasks, saveV3VerifiedFacts } from '@/lib/v3-architecture-api';
import { buildV3ExecutionReadiness } from '@/lib/v3-execution-readiness';
import { enrichV3NodesFromVerifiedSources } from '@/lib/v3-verified-fact-enrichment';
import {
  getLinearActionsForContext,
  RADIAL_COMMAND_EVENT,
  type MenuContext,
  type RadialCommandEventDetail,
} from '@/lib/radial-menu-actions';
import {
  buildRadialAiPrompt,
  dispatchRadialAiPrompt,
  getRadialAiPromptDelivery,
  rememberRadialAiCommand,
  type RadialAiIntent,
  type RadialAiPromptDelivery,
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';

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

type ArchitectureAiIntent = Extract<RadialAiIntent, 'generate' | 'explain' | 'propose_connection' | 'expand_block'>;

const ARCHITECTURE_AI_INTRO: Record<ArchitectureAiIntent, string> = {
  generate:
    'Generate a complete architecture for this project. Analyze the project description and current architecture context, then propose concrete architecture nodes, connections, risks, and next build steps.',
  explain:
    'Explain this architecture context in plain language. Focus on what the selected target does, what it depends on, what can go wrong, and what Tyler should inspect or build next.',
  propose_connection:
    'Propose the next useful architecture connection. Use the current target if one exists, explain why the connection matters, name the source and destination blocks, and call out validation risks.',
  expand_block:
    'Expand this architecture block into concrete sub-blocks. Suggest internal responsibilities, interfaces, signals, parts, validation checks, and how it should connect back to the larger design.',
};

const ARCHITECTURE_AI_HISTORY_LABEL: Record<ArchitectureAiIntent, string> = {
  generate: 'Generate architecture',
  explain: 'Explain architecture',
  propose_connection: 'Propose connection',
  expand_block: 'Expand block',
};

function getArchitectureAiHistoryLabel(intent: ArchitectureAiIntent, context?: MenuContext): string {
  const targetLabel = context?.targetLabel ?? context?.targetId ?? context?.target;
  return targetLabel
    ? `${ARCHITECTURE_AI_HISTORY_LABEL[intent]}: ${targetLabel}`
    : ARCHITECTURE_AI_HISTORY_LABEL[intent];
}

function getArchitectureNodeLabel(node: GraphNode): string {
  return String(node.data?.label ?? node.id);
}

function getArchitectureNodeType(node: GraphNode): string {
  return String(node.data?.type ?? 'unknown');
}

function buildArchitectureAiPrompt({
  intent = 'generate',
  context,
  nodes,
  edges,
}: {
  intent?: ArchitectureAiIntent;
  context?: MenuContext;
  nodes: GraphNode[];
  edges: GraphEdge[];
}): string {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const targetNode = context?.targetId ? nodeMap.get(context.targetId) : undefined;
  const targetDetails = targetNode
    ? [
        `${getArchitectureNodeLabel(targetNode)} [${getArchitectureNodeType(targetNode)}] at x=${String(Math.round(targetNode.position.x))}, y=${String(Math.round(targetNode.position.y))}.`,
      ]
    : [];
  const sections: RadialAiPromptSection[] = [];
  if (nodes.length > 0) {
    const lines: string[] = [];
    nodes.slice(0, 12).forEach((node) => {
      lines.push(`- ${getArchitectureNodeLabel(node)} [${getArchitectureNodeType(node)}] id=${node.id}`);
    });
    if (nodes.length > 12) {
      lines.push(`- ...${String(nodes.length - 12)} more node(s)`);
    }
    sections.push({ title: 'Current nodes', lines });
  }

  if (edges.length > 0) {
    const lines: string[] = [];
    edges.slice(0, 12).forEach((edge) => {
      const source = nodeMap.get(edge.source);
      const target = nodeMap.get(edge.target);
      const sourceLabel = source ? getArchitectureNodeLabel(source) : edge.source;
      const targetLabelForEdge = target ? getArchitectureNodeLabel(target) : edge.target;
      const edgeLabel = typeof edge.label === 'string' && edge.label.trim().length > 0 ? ` (${edge.label})` : '';
      lines.push(`- ${sourceLabel} -> ${targetLabelForEdge}${edgeLabel}`);
    });
    if (edges.length > 12) {
      lines.push(`- ...${String(edges.length - 12)} more connection(s)`);
    }
    sections.push({ title: 'Current connections', lines });
  }

  return buildRadialAiPrompt({
    intent,
    intro: ARCHITECTURE_AI_INTRO[intent],
    summary: `Canvas summary: ${String(nodes.length)} node(s), ${String(edges.length)} connection(s).`,
    context,
    targetDetails,
    sections,
  });
}

function ArchitectureFlow() {
  const {
    nodes,
    edges,
    setNodes,
    setEdges,
    focusNodeId,
    selectedNodeId,
    setSelectedNodeId,
    pushUndoState,
    undo,
    redo,
    setPendingComponentPartId,
  } = useArchitecture();
  const { isGenerating, addMessage, setIsGenerating } = useChat();
  const { addOutputLog } = useOutput();
  const { setActiveView } = useProjectMeta();
  const { bom, addBomItem } = useBom();
  const { toast } = useToast();
  const projectId = useProjectId();
  const { data: circuits } = useCircuitDesigns(projectId);
  const createDesignMutation = useCreateCircuitDesign();
  const createInstanceMutation = useCreateCircuitInstance();
  const { activeDrag } = useDndState();
  const contextMenuHintShown = useRef(false);
  const clipboardRef = useRef<{ nodes: GraphNode[]; edges: GraphEdge[] } | null>(null);
  // Show the asset manager by default on desktop. This state now controls
  // visibility across both desktop and mobile, enabling a collapsible
  // asset library on larger screens.
  const [showAssetManager, setShowAssetManager] = useState(true);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeDraftSourceId, setEdgeDraftSourceId] = useState<string | null>(null);
  const [edgeDraftCursor, setEdgeDraftCursor] = useState<{ x: number; y: number } | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // Library auto-suggest popover state
  const [suggestState, setSuggestState] = useState<{
    nodeLabel: string;
    nodeType: string;
    anchorPosition: { x: number; y: number };
  } | null>(null);

  // Analysis panel state
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showV3Readiness, setShowV3Readiness] = useState(true);
  const [v3SaveState, setV3SaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [v3FactSaveState, setV3FactSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [v3SwarmSaveState, setV3SwarmSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
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
        label: ((n.data as Record<string, unknown>)?.label as string) ?? n.id,
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

  const [localNodes, setLocalNodes] = useState<GraphNode[]>(nodes as GraphNode[]);
  const [localEdges, setLocalEdges] = useState<GraphEdge[]>(edges as GraphEdge[]);
  const localNodesRef = useRef(localNodes);
  localNodesRef.current = localNodes;
  const v3Readiness = useMemo(() => evaluateLiveV3Readiness(localNodes, localEdges), [localNodes, localEdges]);
  const v3SourceEnrichment = useMemo(() => enrichV3NodesFromVerifiedSources(localNodes), [localNodes]);
  const v3CompileReport = useMemo(
    () => buildLiveArchitectureCompileReport(localNodes, localEdges, { enrichFromVerifiedSources: true }),
    [localNodes, localEdges],
  );
  const v3ExecutionReadiness = useMemo(
    () => buildV3ExecutionReadiness(localNodes, localEdges, v3CompileReport),
    [localNodes, localEdges, v3CompileReport],
  );
  const handleSaveV3CompileRun = useCallback(async () => {
    setV3SaveState('saving');
    try {
      const saved = await saveV3CompileRun(projectId, v3CompileReport);
      setV3SaveState('saved');
      addOutputLog(`[ARCH:v3] Saved compile run #${String(saved.id)} (${v3CompileReport.status})`);
    } catch (error) {
      setV3SaveState('error');
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[ARCH:v3] Failed to save compile run', { error: message });
    }
  }, [addOutputLog, projectId, v3CompileReport]);
  const handleSaveV3VerifiedFacts = useCallback(async () => {
    setV3FactSaveState('saving');
    try {
      const saved = await saveV3VerifiedFacts(projectId, v3SourceEnrichment.facts);
      setV3FactSaveState('saved');
      addOutputLog(`[ARCH:v3] Saved ${String(saved.length)} verified facts`);
    } catch (error) {
      setV3FactSaveState('error');
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[ARCH:v3] Failed to save verified facts', { error: message });
    }
  }, [addOutputLog, projectId, v3SourceEnrichment.facts]);
  const handleSaveV3SwarmTasks = useCallback(async () => {
    setV3SwarmSaveState('saving');
    try {
      const saved = await saveV3SwarmTasks(projectId, v3ExecutionReadiness);
      setV3SwarmSaveState('saved');
      addOutputLog(`[ARCH:v3] Saved ${String(saved.length)} swarm tasks (${v3ExecutionReadiness.status})`);
    } catch (error) {
      setV3SwarmSaveState('error');
      const message = error instanceof Error ? error.message : String(error);
      logger.error('[ARCH:v3] Failed to save swarm tasks', { error: message });
    }
  }, [addOutputLog, projectId, v3ExecutionReadiness]);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const initialFitDone = useRef(false);

  const reactFlowInstance = useMemo(() => {
    const fitView = ({ padding = 0.2 }: { padding?: number; duration?: number } = {}) => {
      const wrapper = reactFlowWrapper.current;
      if (!wrapper || localNodes.length === 0) {
        return;
      }
      const xs = localNodes.map((n) => n.position.x);
      const ys = localNodes.map((n) => n.position.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      const width = Math.max(maxX - minX + 180, 200);
      const height = Math.max(maxY - minY + 120, 140);
      const cx = minX + width / 2;
      const cy = minY + height / 2;
      wrapper.scrollTo({
        left: Math.max(0, cx - (wrapper.clientWidth * (1 - padding)) / 2),
        top: Math.max(0, cy - (wrapper.clientHeight * (1 - padding)) / 2),
        behavior: 'smooth',
      });
    };

    return {
      fitView,
      screenToFlowPosition: ({ x, y }: { x: number; y: number }) => {
        const wrapper = reactFlowWrapper.current;
        if (!wrapper) {
          return { x, y };
        }
        const rect = wrapper.getBoundingClientRect();
        return {
          x: x - rect.left + wrapper.scrollLeft,
          y: y - rect.top + wrapper.scrollTop,
        };
      },
      flowToScreenPosition: ({ x, y }: { x: number; y: number }) => {
        const wrapper = reactFlowWrapper.current;
        if (!wrapper) {
          return { x, y };
        }
        const rect = wrapper.getBoundingClientRect();
        return {
          x: rect.left + x - wrapper.scrollLeft,
          y: rect.top + y - wrapper.scrollTop,
        };
      },
      setCenter: (x: number, y: number) => {
        const wrapper = reactFlowWrapper.current;
        if (!wrapper) {
          return;
        }
        wrapper.scrollTo({
          left: Math.max(0, x - wrapper.clientWidth / 2),
          top: Math.max(0, y - wrapper.clientHeight / 2),
          behavior: 'smooth',
        });
      },
    };
  }, [localNodes]);

  useEffect(() => {
    if (!edgeDraftSourceId) {
      setEdgeDraftCursor(null);
      return;
    }
    const handlePointerMove = (event: PointerEvent) => {
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setEdgeDraftCursor(flowPos);
    };
    window.addEventListener('pointermove', handlePointerMove);
    return () => window.removeEventListener('pointermove', handlePointerMove);
  }, [edgeDraftSourceId, reactFlowInstance]);

  // Auto-fit canvas when nodes first load from the server
  useEffect(() => {
    if (!initialFitDone.current && localNodes.length > 0) {
      initialFitDone.current = true;
      // Delay to let ReactFlow measure nodes
      requestAnimationFrame(() => {
        reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
      });
    }
  }, [localNodes.length, reactFlowInstance]);

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

      // Trigger library auto-suggest near the drop position
      setSuggestState({ nodeLabel: data.label, nodeType: data.nodeType, anchorPosition: { x: finalX, y: finalY } });
    },
  });

  const { nodeInteracted, edgeInteracted } = useSyncedFlowState({
    nodes,
    edges,
    setNodes,
    setEdges,
    localNodes,
    localEdges,
    setLocalNodes,
    setLocalEdges,
  });

  useEffect(() => {
    if (focusNodeId) {
      const targetNode = localNodes.find((n) => n.id === focusNodeId);
      if (targetNode) {
        const anchor = getNodeAnchor(targetNode);
        reactFlowInstance.setCenter(anchor.x, anchor.y);
        setLocalNodes((nds) =>
          nds.map((n) => ({
            ...n,
            selected: n.id === focusNodeId,
            className:
              n.id === focusNodeId
                ? 'validation-focus-flash'
                : n.className === 'validation-focus-flash'
                  ? ''
                  : n.className,
          })),
        );
        // Remove the flash class after animation completes
        const timer = setTimeout(() => {
          setLocalNodes((nds) =>
            nds.map((n) => (n.className === 'validation-focus-flash' ? { ...n, className: '' } : n)),
          );
        }, 600);
        return () => {
          clearTimeout(timer);
        };
      }
    }
  }, [focusNodeId, reactFlowInstance, setLocalNodes]);

  const markNodeInteracted = useCallback(() => {
    nodeInteracted.current = true;
  }, []);
  const markEdgeInteracted = useCallback(() => {
    edgeInteracted.current = true;
  }, []);

  const handlePaste = useCallback(
    (bundle: { nodes?: GraphNode[]; edges?: GraphEdge[] } | null) => {
      if (!bundle || !bundle.nodes || bundle.nodes.length === 0) {
        return;
      }

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
      const minX = Math.min(...copiedNodes.map((n) => n.position.x));
      const minY = Math.min(...copiedNodes.map((n) => n.position.y));
      const maxX = Math.max(...copiedNodes.map((n) => n.position.x));
      const maxY = Math.max(...copiedNodes.map((n) => n.position.y));
      const bboxCenterX = (minX + maxX) / 2;
      const bboxCenterY = (minY + maxY) / 2;
      const offsetX = center.x - bboxCenterX + 30;
      const offsetY = center.y - bboxCenterY + 30;

      const pastedNodes = copiedNodes.map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        position: {
          x: n.position.x + offsetX,
          y: n.position.y + offsetY,
        },
        selected: true,
      }));

      const pastedEdges = (copiedEdges ?? []).map((ed) => ({
        ...ed,
        id: crypto.randomUUID(),
        source: idMap.get(ed.source) ?? ed.source,
        target: idMap.get(ed.target) ?? ed.target,
      }));

      pushUndoState();
      markNodeInteracted();
      if (pastedEdges.length > 0) markEdgeInteracted();
      // Deselect existing nodes before pasting
      setLocalNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...pastedNodes]);
      if (pastedEdges.length > 0) {
        setLocalEdges((eds) => [...eds, ...pastedEdges]);
      }
      addOutputLog(`[ARCH] Pasted ${pastedNodes.length} node(s) and ${pastedEdges.length} edge(s)`);
    },
    [
      reactFlowInstance,
      pushUndoState,
      markNodeInteracted,
      markEdgeInteracted,
      setLocalNodes,
      setLocalEdges,
      addOutputLog,
    ],
  );

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
    setLocalNodes((nds) => [
      ...nds,
      {
        id: crypto.randomUUID(),
        type: 'custom' as const,
        position: center,
        data: { label: 'New Component', type: 'mcu' },
      },
    ]);
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
      if (e.key === 'Escape') {
        setEdgeDraftSourceId(null);
        setEdgeDraftCursor(null);
        return;
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.ctrlKey) {
        const selectedNodes = localNodes.filter((n) => Boolean(n.selected));
        if (selectedNodes.length > 0 || selectedEdgeId) {
          e.preventDefault();
          pushUndoState();
          if (selectedNodes.length > 0) {
            const selectedNodeIds = new Set(selectedNodes.map((n) => n.id));
            markNodeInteracted();
            markEdgeInteracted();
            setLocalNodes((nds) => nds.filter((n) => !selectedNodeIds.has(n.id)));
            setLocalEdges((eds) =>
              eds.filter((edge) => !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)),
            );
            setSelectedNodeId(null);
          }
          if (selectedEdgeId) {
            markEdgeInteracted();
            setLocalEdges((eds) => eds.filter((edge) => edge.id !== selectedEdgeId));
            setSelectedEdgeId(null);
          }
        }
      }
      // Ctrl+C — copy selected nodes + their connecting edges
      if ((e.metaKey || e.ctrlKey) && e.key === 'c' && !e.shiftKey) {
        const selected = localNodes.filter((n) => Boolean(n.selected));
        if (selected.length === 0) return; // let default copy happen
        e.preventDefault();
        const selectedIds = new Set(selected.map((n) => n.id));
        const connectedEdges = localEdges.filter((ed) => selectedIds.has(ed.source) && selectedIds.has(ed.target));
        const bundle = {
          type: 'protopulse-architecture-bundle',
          nodes: selected,
          edges: connectedEdges,
        };
        clipboardRef.current = { nodes: selected, edges: connectedEdges };
        try {
          await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
          addOutputLog(
            `[ARCH] Copied ${selected.length} node(s) and ${connectedEdges.length} edge(s) to system clipboard`,
          );
        } catch (err) {
          logger.error('Copy failed', err);
          addOutputLog(
            `[ARCH] Copied ${selected.length} node(s) and ${connectedEdges.length} edge(s) to internal clipboard only`,
          );
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
  }, [
    undo,
    redo,
    localNodes,
    localEdges,
    selectedEdgeId,
    pushUndoState,
    markNodeInteracted,
    markEdgeInteracted,
    setLocalNodes,
    setLocalEdges,
    reactFlowInstance,
    addOutputLog,
    handlePaste,
    setSelectedNodeId,
  ]);

  const onNodesDelete = useCallback(
    (deleted: GraphNode[]) => {
      pushUndoState();
      markNodeInteracted();
      setLocalNodes((nds) => nds.filter((n) => !deleted.find((d) => d.id === n.id)));
    },
    [setLocalNodes, markNodeInteracted, pushUndoState],
  );

  const onEdgesDelete = useCallback(
    (deleted: GraphEdge[]) => {
      pushUndoState();
      markEdgeInteracted();
      setLocalEdges((eds) => eds.filter((e) => !deleted.find((d) => d.id === e.id)));
    },
    [setLocalEdges, markEdgeInteracted, pushUndoState],
  );

  const onConnect = useCallback(
    (params: { source?: string; target?: string }) => {
      if (!params.source || !params.target) {
        return;
      }
      pushUndoState();
      markEdgeInteracted();
      setLocalEdges((eds) =>
        eds.concat({
          id: crypto.randomUUID(),
          source: params.source!,
          target: params.target!,
        }),
      );
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

      const type = event.dataTransfer.getData(PROTOPULSE_DRAG_TYPE);
      const label = event.dataTransfer.getData(PROTOPULSE_DRAG_LABEL);

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
    event.dataTransfer.setData(PROTOPULSE_DRAG_TYPE, nodeType);
    event.dataTransfer.setData(PROTOPULSE_DRAG_LABEL, label);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  useEffect(() => {
    if (!draggingNodeId) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (activeTool === 'pan') {
        return;
      }
      const flowPos = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const { dx, dy } = dragOffsetRef.current;
      let nx = flowPos.x - dx;
      let ny = flowPos.y - dy;
      if (snapEnabled) {
        nx = Math.round(nx / 20) * 20;
        ny = Math.round(ny / 20) * 20;
      }
      setLocalNodes((nds) =>
        nds.map((node) => (node.id === draggingNodeId ? { ...node, position: { x: nx, y: ny } } : node)),
      );
    };

    const handlePointerUp = () => {
      setDraggingNodeId(null);
      markNodeInteracted();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [draggingNodeId, snapEnabled, activeTool, reactFlowInstance, markNodeInteracted]);

  const tools = [
    { icon: MousePointer2, id: 'select' as const, action: () => setActiveTool('select') },
    { icon: Move, id: 'pan' as const, action: () => setActiveTool('pan') },
    { icon: Grid, id: 'grid' as const, action: () => setSnapEnabled(!snapEnabled) },
    { icon: Maximize, id: 'fit' as const, action: () => reactFlowInstance.fitView({ padding: 0.2 }) },
  ];

  const handleAddNodeFromAsset = useCallback(
    (type: string, label: string) => {
      const newNode = {
        id: crypto.randomUUID(),
        type: 'custom',
        position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
        data: { label, type },
      };
      pushUndoState();
      markNodeInteracted();
      setLocalNodes((nds) => nds.concat(newNode));

      // Trigger library auto-suggest — position at canvas center-ish area
      const screenPos = reactFlowInstance.flowToScreenPosition(newNode.position);
      setSuggestState({ nodeLabel: label, nodeType: type, anchorPosition: { x: screenPos.x + 80, y: screenPos.y } });
    },
    [setLocalNodes, markNodeInteracted, pushUndoState, reactFlowInstance],
  );

  const handleAddComponent = useCallback(
    (type: string) => {
      const newNode = {
        id: crypto.randomUUID(),
        type: 'custom',
        position: { x: Math.random() * 400 + 100, y: Math.random() * 400 + 100 },
        data: { label: type, type: type.toLowerCase() },
      };
      pushUndoState();
      markNodeInteracted();
      setLocalNodes((nds) => nds.concat(newNode));

      // Trigger library auto-suggest
      const screenPos = reactFlowInstance.flowToScreenPosition(newNode.position);
      setSuggestState({
        nodeLabel: type,
        nodeType: type.toLowerCase(),
        anchorPosition: { x: screenPos.x + 80, y: screenPos.y },
      });
    },
    [setLocalNodes, markNodeInteracted, pushUndoState, reactFlowInstance],
  );

  const handleSuggestAddToBom = useCallback(
    (suggestion: LibrarySuggestion) => {
      const part = suggestion.libraryPart;
      const mpn = (part.meta.mpn as string) ?? '';
      const mfr = (part.meta.manufacturer as string) ?? '';
      addBomItem({
        partNumber: mpn || part.title,
        manufacturer: mfr,
        description: part.description,
        quantity: 1,
        unitPrice: 0,
        totalPrice: 0,
        supplier: 'Unknown',
        stock: 0,
        status: 'In Stock',
      });
      toast({ title: 'Added to BOM', description: `${part.title} added to the Bill of Materials` });
      addOutputLog(`[SUGGEST] Added "${part.title}" to BOM from library suggestion`);
    },
    [addBomItem, toast, addOutputLog],
  );

  const handleSuggestDismiss = useCallback(() => {
    setSuggestState(null);
  }, []);

  const handleToggleAssetManager = useCallback(() => {
    setShowAssetManager((prev) => !prev);
  }, []);

  const handleCloseAssetManager = useCallback(() => {
    setShowAssetManager(false);
  }, []);

  const handleInspectorUpdateNode = useCallback(
    (nodeId: string, updates: Record<string, unknown>) => {
      pushUndoState();
      markNodeInteracted();
      setLocalNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updates } } : n)));
    },
    [setLocalNodes, markNodeInteracted, pushUndoState],
  );

  const handleInspectorDeleteNode = useCallback(
    (nodeId: string) => {
      pushUndoState();
      markNodeInteracted();
      if (localEdges.some((edge) => edge.source === nodeId || edge.target === nodeId)) {
        markEdgeInteracted();
      }
      setLocalNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setLocalEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId(null);
      addOutputLog('[INSPECTOR] Deleted node: ' + nodeId);
    },
    [
      setLocalNodes,
      setLocalEdges,
      localEdges,
      markNodeInteracted,
      markEdgeInteracted,
      pushUndoState,
      setSelectedNodeId,
      addOutputLog,
    ],
  );

  const handleInspectorClose = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);

  /** Place a design snippet as a single atomic undo unit. */
  const handlePlaceSnippet = useCallback(
    (snippetId: string, offset?: { x: number; y: number }) => {
      const library = SnippetLibrary.getInstance();
      const snippet = library.getSnippet(snippetId);
      if (!snippet) {
        return;
      }

      const placement = library.prepareForPlacement(
        snippetId,
        offset ?? { x: 200 + Math.random() * 300, y: 100 + Math.random() * 200 },
      );
      const action = placeSnippetAtomic(snippetId, snippet.name, placement, {
        pushUndoState,
        setNodes: setLocalNodes,
        setEdges: setLocalEdges,
        markNodeInteracted,
        markEdgeInteracted,
      });

      if (action) {
        library.incrementUsage(snippetId);
        addOutputLog(
          `[ARCH] Placed snippet "${snippet.name}" (${action.addedNodeIds.length} nodes, ${action.addedEdgeIds.length} edges)`,
        );
      }
    },
    [pushUndoState, setLocalNodes, setLocalEdges, markNodeInteracted, markEdgeInteracted, addOutputLog],
  );

  const handleArchitectureAiCommand = useCallback(
    (intent: ArchitectureAiIntent, context?: MenuContext, delivery: RadialAiPromptDelivery = 'draft') => {
      const message = buildArchitectureAiPrompt({ intent, context, nodes: localNodes, edges: localEdges });
      const summary = `Canvas summary: ${String(localNodes.length)} node(s), ${String(localEdges.length)} connection(s).`;
      rememberRadialAiCommand({
        intent,
        label: getArchitectureAiHistoryLabel(intent, context),
        summary,
        message,
        context,
      });
      dispatchRadialAiPrompt({
        message,
        addMessage,
        delivery,
        telemetry: {
          intent,
          context,
          summary,
        },
      });
    },
    [addMessage, localEdges, localNodes],
  );

  const handleGenerateArchitecture = useCallback(
    (context?: MenuContext, delivery: RadialAiPromptDelivery = 'draft') => {
      handleArchitectureAiCommand('generate', context, delivery);
    },
    [handleArchitectureAiCommand],
  );

  const handleContextFitView = useCallback(() => {
    reactFlowInstance.fitView({ padding: 0.2 });
  }, [reactFlowInstance]);

  const handleContextToggleGrid = useCallback(() => {
    setSnapEnabled((prev) => !prev);
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
    nodes.forEach((n) => {
      const label = (n.data as Record<string, unknown>)?.label ?? n.id;
      const type = (n.data as Record<string, unknown>)?.type ?? 'unknown';
      lines.push(`  - ${label} [${type}]`);
    });
    lines.push('');
    lines.push(`Connections (${edges.length}):`);
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source);
      const tgt = nodes.find((n) => n.id === e.target);
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
      const node = localNodes.find((n) => n.id === selectedNodeId);
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
    if (!selectedNodeId) {
      return;
    }
    const node = localNodes.find((n) => n.id === selectedNodeId);
    if (!node) {
      return;
    }

    const nodeLabel = String(node.data?.label ?? '').toLowerCase();
    const nodeType = String(node.data?.type ?? '').toLowerCase();
    const searchTerms = [nodeLabel, nodeType].filter(Boolean);

    // Find matching standard library component via simple substring/keyword match
    const match = STANDARD_LIBRARY_COMPONENTS.find((comp) => {
      const title = comp.title.toLowerCase();
      const tags = comp.tags.map((t) => t.toLowerCase());
      const category = comp.category.toLowerCase();
      return searchTerms.some(
        (term) =>
          title.includes(term) ||
          term.includes(title.split(' ')[0]) ||
          tags.some((tag) => tag.includes(term) || term.includes(tag)) ||
          category.includes(term),
      );
    });

    if (!match) {
      toast({
        title: 'No matching component found in library',
        description: `Could not find a standard library component matching "${node.data?.label ?? ''}"`,
      });
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
      toast({
        title: `Created ${match.title} on schematic`,
        description: `Placed from architecture node "${node.data?.label ?? ''}"`,
      });
      addOutputLog(`[ARCH] Created schematic instance: ${match.title} from node ${selectedNodeId}`);
    } catch (err) {
      toast({
        title: 'Failed to create schematic instance',
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, [
    selectedNodeId,
    localNodes,
    circuits,
    projectId,
    createDesignMutation,
    createInstanceMutation,
    setActiveView,
    toast,
    addOutputLog,
  ]);

  const architectureLinearContext = useMemo<MenuContext>(() => {
    const selectedNode = selectedNodeId ? localNodes.find((node) => node.id === selectedNodeId) : undefined;
    return {
      view: 'architecture',
      target: selectedNode ? 'node' : 'canvas',
      targetId: selectedNode?.id,
      targetLabel: selectedNode ? String(selectedNode.data?.label ?? selectedNode.id) : undefined,
    };
  }, [localNodes, selectedNodeId]);
  const architectureLinearActions = useMemo(
    () => getLinearActionsForContext(architectureLinearContext),
    [architectureLinearContext],
  );
  const disabledLinearCommands = useMemo(
    () => new Set(selectedNodeId ? [] : ['edit_component', 'create_schematic_instance']),
    [selectedNodeId],
  );
  const disabledLinearReasons = useMemo(
    () => ({
      edit_component: 'Select an Architecture block first.',
      create_schematic_instance: 'Select an Architecture block first.',
    }),
    [],
  );
  const handleArchitectureLinearCommand = useCallback(
    (commandId: string) => {
      switch (commandId) {
        case 'add_node':
        case 'add_mcu':
          handleAddComponent('MCU');
          break;
        case 'add_sensor':
          handleAddComponent('Sensor');
          break;
        case 'add_power':
          handleAddComponent('Power');
          break;
        case 'add_communication':
          handleAddComponent('Communication');
          break;
        case 'add_connector':
          handleAddComponent('Connector');
          break;
        case 'generate_architecture':
          handleGenerateArchitecture(architectureLinearContext);
          break;
        case 'ai_explain_architecture':
          handleArchitectureAiCommand('explain', architectureLinearContext);
          addOutputLog('[ARCH] Asked AI to explain architecture context');
          break;
        case 'ai_propose_connection':
          handleArchitectureAiCommand('propose_connection', architectureLinearContext);
          addOutputLog('[ARCH] Asked AI to propose an architecture connection');
          break;
        case 'ai_expand_block':
          handleArchitectureAiCommand('expand_block', architectureLinearContext);
          addOutputLog('[ARCH] Asked AI to expand architecture context');
          break;
        case 'fit_view':
          handleContextFitView();
          break;
        case 'analyze_architecture':
          runAnalysis();
          setShowAnalysis(true);
          addOutputLog('[ARCH] Opened architecture analysis from context menu');
          break;
        case 'select_all':
          handleContextSelectAll();
          break;
        case 'paste':
          void handleContextPaste();
          break;
        case 'toggle_grid':
          handleContextToggleGrid();
          break;
        case 'run_validation':
          handleContextRunValidation();
          break;
        case 'copy_summary':
          handleContextExportSummary();
          break;
        case 'copy_json':
          handleContextExportJSON();
          break;
        case 'edit_component':
          handleContextEditComponent();
          break;
        case 'create_schematic_instance':
          void handleCreateSchematicInstance();
          break;
        default:
          addOutputLog(`[ARCH] Context command not wired: ${commandId}`);
      }
    },
    [
      addOutputLog,
      architectureLinearContext,
      handleAddComponent,
      handleContextEditComponent,
      handleContextExportJSON,
      handleContextExportSummary,
      handleContextFitView,
      handleContextPaste,
      handleContextRunValidation,
      handleContextSelectAll,
      handleContextToggleGrid,
      handleArchitectureAiCommand,
      handleCreateSchematicInstance,
      handleGenerateArchitecture,
      runAnalysis,
    ],
  );

  useEffect(() => {
    const selectNodeForRadialCommand = (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setSelectedEdgeId(null);
      setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === nodeId })));
    };

    const handleRadialCommand = (event: Event) => {
      if (!(event instanceof CustomEvent)) {
        return;
      }
      const detail = event.detail as RadialCommandEventDetail | undefined;
      if (!detail || detail.context.view !== 'architecture') {
        return;
      }

      detail.handled = true;
      const { commandId, context } = detail;
      const targetId = context.targetId;
      const targetNode = targetId ? localNodesRef.current.find((node) => node.id === targetId) : undefined;

      if (targetId && targetNode) {
        selectNodeForRadialCommand(targetId);
      }

      switch (commandId) {
        case 'add_node': {
          const position = context.pointer
            ? reactFlowInstance.screenToFlowPosition(context.pointer)
            : { x: 160 + Math.random() * 240, y: 120 + Math.random() * 180 };
          const newNode: GraphNode = {
            id: crypto.randomUUID(),
            type: 'custom',
            position,
            data: { label: 'New Component', type: 'mcu' },
          };
          pushUndoState();
          markNodeInteracted();
          setLocalNodes((nds) => nds.concat(newNode));
          addOutputLog('[RADIAL] Added architecture node');
          break;
        }
        case 'generate_architecture':
          handleGenerateArchitecture(context, getRadialAiPromptDelivery(detail));
          addOutputLog('[RADIAL] Requested AI architecture generation');
          break;
        case 'ai_explain_architecture':
        case 'view_datasheet':
          handleArchitectureAiCommand('explain', context, getRadialAiPromptDelivery(detail));
          addOutputLog('[RADIAL] Asked AI to explain architecture target');
          break;
        case 'ai_propose_connection':
          handleArchitectureAiCommand('propose_connection', context, getRadialAiPromptDelivery(detail));
          addOutputLog('[RADIAL] Asked AI to propose architecture connection');
          break;
        case 'ai_expand_block':
          handleArchitectureAiCommand('expand_block', context, getRadialAiPromptDelivery(detail));
          addOutputLog('[RADIAL] Asked AI to expand architecture target');
          break;
        case 'fit_view':
          handleContextFitView();
          addOutputLog('[RADIAL] Fit architecture view');
          break;
        case 'analyze_architecture':
          runAnalysis();
          setShowAnalysis(true);
          addOutputLog('[RADIAL] Opened architecture analysis');
          break;
        case 'run_validation':
          handleContextRunValidation();
          break;
        case 'select_all':
          handleContextSelectAll();
          break;
        case 'paste':
          void handleContextPaste();
          break;
        case 'connect':
          if (targetId) {
            setEdgeDraftSourceId(targetId);
            setEdgeDraftCursor(null);
            addOutputLog(`[RADIAL] Started connection from ${targetId}`);
          }
          break;
        case 'edit':
          if (targetNode && targetId) {
            const partId = targetNode.data?.componentPartId;
            if (typeof partId === 'number') {
              setPendingComponentPartId(partId);
            }
            addOutputLog(`[RADIAL] Opening Component Editor for node ${targetId}`);
            setActiveView('component_editor');
          }
          break;
        case 'delete':
          if (targetId && targetNode) {
            const deletedNode = targetNode;
            const deletedEdges = localEdges.filter((edge) => edge.source === targetId || edge.target === targetId);
            const deletedNodeLabel = String(deletedNode.data?.label ?? targetId);
            detail.undo = {
              label: `Restore ${deletedNodeLabel}`,
              description:
                deletedEdges.length > 0
                  ? `Restores ${deletedNodeLabel} and ${String(deletedEdges.length)} connected edge${deletedEdges.length === 1 ? '' : 's'}.`
                  : `Restores ${deletedNodeLabel}.`,
              run: () => {
                pushUndoState();
                markNodeInteracted();
                if (deletedEdges.length > 0) {
                  markEdgeInteracted();
                }
                setLocalNodes((nds) =>
                  nds.some((node) => node.id === deletedNode.id) ? nds : nds.concat({ ...deletedNode, selected: true }),
                );
                setLocalEdges((eds) => {
                  const existingEdgeIds = new Set(eds.map((edge) => edge.id));
                  return eds.concat(deletedEdges.filter((edge) => !existingEdgeIds.has(edge.id)));
                });
                setSelectedNodeId(deletedNode.id);
                addOutputLog(`[RADIAL] Restored deleted node ${deletedNode.id}`);
              },
            };
            handleInspectorDeleteNode(targetId);
          } else {
            detail.handled = false;
          }
          break;
        case 'duplicate':
          if (targetNode) {
            pushUndoState();
            markNodeInteracted();
            const duplicate: GraphNode = {
              ...targetNode,
              id: crypto.randomUUID(),
              position: {
                x: targetNode.position.x + 48,
                y: targetNode.position.y + 48,
              },
              selected: true,
            };
            setSelectedNodeId(duplicate.id);
            setLocalNodes((nds): GraphNode[] =>
              nds.map<GraphNode>((n) => ({ ...n, selected: false })).concat(duplicate),
            );
            addOutputLog(`[RADIAL] Duplicated node ${targetNode.id}`);
          }
          break;
        case 'change_type':
          if (targetNode && targetId) {
            const cycle = ['mcu', 'sensor', 'power', 'communication', 'connector'];
            const current = String(targetNode.data?.type ?? 'mcu').toLowerCase();
            const currentIndex = cycle.indexOf(current);
            const next = cycle[(currentIndex >= 0 ? currentIndex + 1 : 1) % cycle.length];
            pushUndoState();
            markNodeInteracted();
            setLocalNodes((nds) =>
              nds.map((node) =>
                node.id === targetId
                  ? { ...node, data: { ...node.data, type: next, label: String(node.data?.label ?? next) } }
                  : node,
              ),
            );
            addOutputLog(`[RADIAL] Changed node ${targetId} type to ${next}`);
          }
          break;
        case 'add_to_bom':
          if (targetNode) {
            const label = String(targetNode.data?.label ?? targetNode.id);
            addBomItem({
              partNumber: label,
              manufacturer: 'Unknown',
              description: `Architecture block: ${label}`,
              quantity: 1,
              unitPrice: 0,
              totalPrice: 0,
              supplier: 'Unknown',
              stock: 0,
              status: 'On Order',
            });
            toast({ title: 'Added to BOM', description: `${label} added from the action wheel.` });
            addOutputLog(`[RADIAL] Added ${label} to BOM`);
          }
          break;
        default:
          detail.handled = false;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleRadialCommand);
  }, [
    addBomItem,
    addOutputLog,
    localEdges,
    handleArchitectureAiCommand,
    handleContextFitView,
    handleContextPaste,
    handleContextSelectAll,
    handleGenerateArchitecture,
    handleInspectorDeleteNode,
    markEdgeInteracted,
    markNodeInteracted,
    pushUndoState,
    reactFlowInstance,
    runAnalysis,
    setActiveView,
    setLocalEdges,
    setLocalNodes,
    setPendingComponentPartId,
    setSelectedNodeId,
    toast,
  ]);

  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open) handleContextMenuHint();
      }}
    >
      <ContextMenuTrigger asChild>
        <div
          className={cn(
            'w-full h-full relative group bg-background',
            isOver && activeDrag && 'ring-2 ring-primary/50 ring-inset',
          )}
          ref={(el) => {
            reactFlowWrapper.current = el;
            setDropRef(el);
          }}
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

          <div
            className={cn(
              'absolute top-2.5 right-2.5 md:right-auto z-10 flex items-center gap-1 border border-border bg-card/80 p-1 shadow-lg backdrop-blur-xl',
              showAssetManager ? 'md:left-[284px]' : 'md:left-2.5',
            )}
          >
            <StyledTooltip content={showAssetManager ? 'Hide asset library' : 'Show asset library'} side="bottom">
              <button
                data-testid="toggle-asset-manager"
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-ring"
                onClick={handleToggleAssetManager}
                title={showAssetManager ? 'Hide asset library' : 'Show asset library'}
                aria-label="Toggle asset manager"
              >
                <Component className="w-3 h-3" />
              </button>
            </StyledTooltip>
            <div className="w-px h-4 bg-border mx-0.5" />
            {tools.map((tool) => (
              <StyledTooltip key={tool.id} content={toolLabels[tool.id]} side="bottom">
                <button
                  data-testid={`tool-${tool.id}`}
                  aria-label={toolLabels[tool.id]}
                  className={cn(
                    'rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring',
                    tool.id === 'select' &&
                      activeTool === 'select' &&
                      'bg-primary/20 text-primary border border-primary/40',
                    tool.id === 'pan' && activeTool === 'pan' && 'bg-primary/20 text-primary border border-primary/40',
                    tool.id === 'grid' && snapEnabled && 'bg-primary/20 text-primary',
                  )}
                  onClick={tool.action}
                >
                  <tool.icon className="w-3 h-3" />
                </button>
              </StyledTooltip>
            ))}
            <div className="w-px h-4 bg-border mx-0.5" />
            <StyledTooltip content={showAnalysis ? 'Close analysis' : 'Analyze design'} side="bottom">
              <button
                data-testid="tool-analyze"
                aria-label="Analyze design"
                className={cn(
                  'rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring',
                  showAnalysis && 'bg-primary/20 text-primary border border-primary/40',
                )}
                onClick={handleToggleAnalysis}
              >
                <Brain className="w-3 h-3" />
              </button>
            </StyledTooltip>
            <StyledTooltip content={showV3Readiness ? 'Hide v3 gate' : 'Show v3 gate'} side="bottom">
              <button
                data-testid="tool-v3-architecture-gate"
                aria-label={showV3Readiness ? 'Hide v3 architecture gate' : 'Show v3 architecture gate'}
                className={cn(
                  'rounded-sm p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring',
                  showV3Readiness && 'bg-primary/20 text-primary border border-primary/40',
                )}
                onClick={() => setShowV3Readiness((prev) => !prev)}
              >
                <Zap className="w-3 h-3" />
              </button>
            </StyledTooltip>
          </div>

          <div
            data-testid="react-flow"
            data-node-count={localNodes.length}
            className="relative w-full h-full overflow-auto bg-[radial-gradient(circle_at_1px_1px,rgba(100,116,139,0.28)_1px,transparent_0)] [background-size:20px_20px]"
            onDragOver={onDragOver}
            onDrop={onDrop}
            onClick={() => {
              setSelectedNodeId(null);
              setSelectedEdgeId(null);
              setEdgeDraftSourceId(null);
              setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
          >
            {edgeDraftSourceId && (
              <div className="absolute top-2.5 left-2.5 z-20 border border-amber-400/40 bg-amber-500/15 px-2 py-1 text-[11px] text-amber-200">
                Connecting from node. Shift-click target node. Press Esc to cancel.
              </div>
            )}
            <svg className="absolute inset-0 w-full h-full">
              {localEdges.map((edge) => {
                const source = localNodes.find((n) => n.id === edge.source);
                const target = localNodes.find((n) => n.id === edge.target);
                if (!source || !target) {
                  return null;
                }
                const a1 = getNodeAnchor(source);
                const a2 = getNodeAnchor(target);
                const x1 = a1.x;
                const y1 = a1.y;
                const x2 = a2.x;
                const y2 = a2.y;
                return (
                  <line
                    key={edge.id}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={selectedEdgeId === edge.id ? '#facc15' : '#22d3ee'}
                    strokeWidth={2}
                    strokeOpacity={0.8}
                    className="cursor-pointer"
                    onClick={(evt) => {
                      evt.stopPropagation();
                      setSelectedEdgeId(edge.id);
                      setSelectedNodeId(null);
                      setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
                    }}
                  />
                );
              })}
              {edgeDraftSourceId &&
                edgeDraftCursor &&
                (() => {
                  const source = localNodes.find((n) => n.id === edgeDraftSourceId);
                  if (!source) {
                    return null;
                  }
                  const a1 = getNodeAnchor(source);
                  const x1 = a1.x;
                  const y1 = a1.y;
                  return (
                    <line
                      x1={x1}
                      y1={y1}
                      x2={edgeDraftCursor.x}
                      y2={edgeDraftCursor.y}
                      stroke="#f59e0b"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      strokeOpacity={0.8}
                      pointerEvents="none"
                    />
                  );
                })()}
            </svg>

            {localNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                data-id={node.id}
                data-node-label={String(node.data?.label ?? node.id)}
                className={cn(
                  'absolute min-w-[124px] max-w-[196px] border border-border bg-card/90 px-2 py-1.5 text-left shadow-sm backdrop-blur',
                  node.id === selectedNodeId && 'border-primary ring-1 ring-primary',
                  edgeDraftSourceId === node.id && 'border-amber-400 ring-1 ring-amber-400',
                )}
                style={{ left: node.position.x, top: node.position.y }}
                onPointerDown={(evt) => {
                  if (activeTool === 'pan' || evt.button !== 0) {
                    return;
                  }
                  const flowPos = reactFlowInstance.screenToFlowPosition({ x: evt.clientX, y: evt.clientY });
                  dragOffsetRef.current = {
                    dx: flowPos.x - node.position.x,
                    dy: flowPos.y - node.position.y,
                  };
                  setDraggingNodeId(node.id);
                }}
                onClick={(evt) => {
                  evt.stopPropagation();
                  setSelectedEdgeId(null);
                  if (evt.shiftKey) {
                    if (edgeDraftSourceId && edgeDraftSourceId !== node.id) {
                      onConnect({ source: edgeDraftSourceId, target: node.id });
                      setEdgeDraftSourceId(null);
                      return;
                    }
                    setEdgeDraftSourceId(node.id);
                    setSelectedNodeId(node.id);
                    setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
                    return;
                  }
                  setEdgeDraftSourceId(null);
                  setSelectedNodeId(node.id);
                  setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === node.id })));
                }}
              >
                <div className="text-[11px] text-muted-foreground">
                  {String((node.data as Record<string, unknown>)?.type ?? 'component')}
                </div>
                <div className="text-xs font-medium text-foreground truncate">
                  {String((node.data as Record<string, unknown>)?.label ?? node.id)}
                </div>
              </button>
            ))}
          </div>

          {/* Edge color legend (AV-06) */}
          {localEdges.length > 0 && (
            <div
              className="absolute bottom-2.5 left-2.5 z-10 bg-card/80 backdrop-blur-xl border border-border p-1.5 shadow-lg"
              data-testid="edge-color-legend"
            >
              <p className="text-[11px] font-medium text-muted-foreground mb-1.5">Edge Colors</p>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-cyan-400 inline-block" />
                  <span className="text-[11px] text-muted-foreground">Data / Signal</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-red-400 inline-block" />
                  <span className="text-[11px] text-muted-foreground">Power</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-0.5 bg-yellow-400 inline-block" />
                  <span className="text-[11px] text-muted-foreground">Control</span>
                </div>
              </div>
            </div>
          )}

          {/* Analysis slide-over panel */}
          {showAnalysis && (
            <div
              className="absolute top-0 right-0 bottom-0 z-20 flex w-[320px] max-w-[90%] animate-in slide-in-from-right flex-col border-l border-border bg-card/95 shadow-2xl backdrop-blur-xl duration-200"
              data-testid="analysis-panel"
            >
              <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground" data-testid="analysis-panel-title">
                    Design Analysis
                  </h3>
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
                      <RefreshCw className={cn('h-3.5 w-3.5', analysisLoading && 'animate-spin')} />
                    </button>
                  </StyledTooltip>
                  <button
                    data-testid="analysis-close"
                    aria-label="Close analysis panel"
                    className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAnalysis(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {analysisLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3" data-testid="analysis-loading">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent animate-spin" />
                    <p className="text-xs text-muted-foreground">Analyzing design...</p>
                  </div>
                )}

                {!analysisLoading && analysisReport && (
                  <>
                    {/* Summary */}
                    <div className="space-y-1.5" data-testid="analysis-summary">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{analysisReport.summary}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="text-[11px]" data-testid="analysis-design-type">
                          {analysisReport.designType}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn('text-[11px]', COMPLEXITY_COLORS[analysisReport.complexity])}
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
                        <span className="text-[11px] font-semibold text-foreground">
                          Subsystems ({analysisReport.subsystems.length})
                        </span>
                        {expandedSections.subsystems ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedSections.subsystems && (
                        <div className="mt-1.5 space-y-1">
                          {analysisReport.subsystems.map((sub, i) => (
                            <div
                              key={`${sub.category}-${i}`}
                              className={cn('px-2.5 py-2 border text-[11px]', SUBSYSTEM_COLORS[sub.category])}
                              data-testid={`analysis-subsystem-${sub.category}`}
                            >
                              <div className="font-semibold">{sub.name}</div>
                              <div className="opacity-80 mt-0.5">{sub.description}</div>
                              <div className="opacity-60 mt-0.5">
                                {sub.nodeIds.length} component{sub.nodeIds.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ))}
                          {analysisReport.subsystems.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">No subsystems detected</p>
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
                        <span className="text-[11px] font-semibold text-foreground">
                          Detected Patterns ({analysisReport.detectedPatterns.length})
                        </span>
                        {expandedSections.patterns ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedSections.patterns && (
                        <div className="mt-1.5 space-y-1">
                          {analysisReport.detectedPatterns.map((pat, i) => (
                            <div
                              key={`${pat.name}-${i}`}
                              className="px-2.5 py-2 bg-muted/30 border border-border text-[11px]"
                            >
                              <div className="font-semibold text-foreground">{pat.name}</div>
                              <div className="text-muted-foreground mt-0.5">{pat.description}</div>
                              <div className="text-muted-foreground/60 mt-0.5">
                                Confidence: {Math.round(pat.confidence * 100)}% | {pat.nodeIds.length} node
                                {pat.nodeIds.length !== 1 ? 's' : ''}
                              </div>
                            </div>
                          ))}
                          {analysisReport.detectedPatterns.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">No patterns detected</p>
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
                        <span className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-yellow-400" />
                          Power Architecture
                        </span>
                        {expandedSections.power ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedSections.power && (
                        <div className="mt-1.5 space-y-1.5 text-[11px]">
                          {analysisReport.powerArchitecture.sources.length > 0 && (
                            <div className="px-2 py-1 bg-red-500/10 border border-red-500/20">
                              <span className="font-semibold text-red-400">Sources:</span>{' '}
                              <span className="text-muted-foreground">
                                {analysisReport.powerArchitecture.sources.join(', ')}
                              </span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.regulators.length > 0 && (
                            <div className="px-2 py-1 bg-orange-500/10 border border-orange-500/20">
                              <span className="font-semibold text-orange-400">Regulators:</span>{' '}
                              <span className="text-muted-foreground">
                                {analysisReport.powerArchitecture.regulators.join(', ')}
                              </span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.voltageDomains.length > 0 && (
                            <div className="px-2 py-1 bg-yellow-500/10 border border-yellow-500/20">
                              <span className="font-semibold text-yellow-400">Voltage Domains:</span>{' '}
                              <span className="text-muted-foreground">
                                {analysisReport.powerArchitecture.voltageDomains.join(', ')}
                              </span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.distribution && (
                            <div className="px-2 py-1 bg-muted/30 border border-border">
                              <span className="font-semibold text-foreground">Distribution:</span>{' '}
                              <span className="text-muted-foreground">
                                {analysisReport.powerArchitecture.distribution}
                              </span>
                            </div>
                          )}
                          {analysisReport.powerArchitecture.sources.length === 0 &&
                            analysisReport.powerArchitecture.regulators.length === 0 && (
                              <p className="text-muted-foreground italic px-2">No power architecture detected</p>
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
                        <span className="text-[11px] font-semibold text-foreground">
                          Suggestions ({analysisReport.suggestions.length})
                        </span>
                        {expandedSections.suggestions ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedSections.suggestions && (
                        <div className="mt-1.5 space-y-1">
                          {analysisReport.suggestions.map((sug, i) => (
                            <div key={`sug-${i}`} className="px-2.5 py-2 bg-muted/30 border border-border text-[11px]">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                {sug.priority === 'high' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                                {sug.priority === 'medium' && <Info className="w-3 h-3 text-yellow-400 shrink-0" />}
                                {sug.priority === 'low' && <Info className="w-3 h-3 text-green-400 shrink-0" />}
                                <span className="font-semibold text-foreground">{sug.suggestion}</span>
                                <Badge
                                  variant="outline"
                                  className={cn('text-[10px] ml-auto shrink-0', PRIORITY_COLORS[sug.priority])}
                                >
                                  {sug.priority}
                                </Badge>
                              </div>
                              <div className="text-muted-foreground">{sug.reason}</div>
                            </div>
                          ))}
                          {analysisReport.suggestions.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">No suggestions</p>
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
                        <span className="text-[11px] font-semibold text-foreground">
                          Component Roles ({analysisReport.componentRoles.length})
                        </span>
                        {expandedSections.roles ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedSections.roles && (
                        <div className="mt-1.5 space-y-1">
                          {analysisReport.componentRoles.map((role) => (
                            <div
                              key={role.nodeId}
                              className="flex items-center justify-between px-2.5 py-1.5 bg-muted/20 border border-border/50 text-[11px]"
                            >
                              <span className="text-foreground font-medium truncate mr-2">{role.label}</span>
                              <span className="text-muted-foreground shrink-0">{role.role}</span>
                            </div>
                          ))}
                          {analysisReport.componentRoles.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">No roles assigned</p>
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
                        <span className="text-[11px] font-semibold text-foreground">
                          Educational Notes ({analysisReport.educationalNotes.length})
                        </span>
                        {expandedSections.education ? (
                          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        )}
                      </button>
                      {expandedSections.education && (
                        <div className="mt-1.5 space-y-1">
                          {analysisReport.educationalNotes.map((note, i) => (
                            <div
                              key={`edu-${i}`}
                              className="px-2.5 py-1.5 bg-primary/5 border border-primary/10 text-[11px] text-muted-foreground"
                            >
                              {note}
                            </div>
                          ))}
                          {analysisReport.educationalNotes.length === 0 && (
                            <p className="text-[11px] text-muted-foreground italic">No educational notes</p>
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
          {selectedNodeId &&
            !showAnalysis &&
            (() => {
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

          {suggestState && (
            <LibrarySuggestPopover
              nodeLabel={suggestState.nodeLabel}
              nodeType={suggestState.nodeType}
              anchorPosition={suggestState.anchorPosition}
              onAddToBom={handleSuggestAddToBom}
              onDismiss={handleSuggestDismiss}
            />
          )}

          {isGenerating && (
            <div className="absolute inset-0 z-50 bg-background/50 backdrop-blur flex items-center justify-center pointer-events-none">
              <div className="bg-card border border-primary/50 p-6 shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                <div className="w-12 h-12 border-2 border-primary border-t-transparent animate-spin"></div>
                <div className="font-display font-bold text-lg text-primary tracking-widest animate-pulse">
                  GENERATING ARCHITECTURE...
                </div>
              </div>
            </div>
          )}

          {showV3Readiness && (
            <V3ArchitectureReadinessPanel
              readiness={v3Readiness}
              compileReport={v3CompileReport}
              executionReadiness={v3ExecutionReadiness}
              resolvedFacts={v3SourceEnrichment.facts}
              saveState={v3SaveState}
              factSaveState={v3FactSaveState}
              swarmSaveState={v3SwarmSaveState}
              assetManagerOpen={showAssetManager}
              onSaveCompileRun={handleSaveV3CompileRun}
              onSaveVerifiedFacts={handleSaveV3VerifiedFacts}
              onSaveSwarmTasks={handleSaveV3SwarmTasks}
              onClose={() => setShowV3Readiness(false)}
            />
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
      <ContextMenuContent className="min-w-[15rem] border-border bg-card/90 backdrop-blur-xl">
        <RadialCommandLinearMenu
          items={architectureLinearActions}
          disabledCommandIds={disabledLinearCommands}
          disabledReasons={disabledLinearReasons}
          onSelect={handleArchitectureLinearCommand}
        />
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function ArchitectureView() {
  return <ArchitectureFlow />;
}
