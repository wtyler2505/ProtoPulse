import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Connection, Edge, Node, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useChat } from '@/lib/contexts/chat-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import CustomNode from './CustomNode';
import AssetManager from '@/components/panels/AssetManager';
import { cn } from '@/lib/utils';
import { MousePointer2, Grid, Move, Maximize, Cpu, Component, Pencil } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent } from '@/components/ui/context-menu';
import { copyToClipboard } from '@/lib/clipboard';
import { useSyncedFlowState } from '@/hooks/useSyncedFlowState';

const nodeTypes = {
  custom: CustomNode,
};

const toolLabels: Record<string, string> = {
  select: 'Select mode',
  pan: 'Pan mode',
  grid: 'Toggle snap to grid',
  fit: 'Fit view to canvas',
};

function ArchitectureFlow() {
  const { nodes, edges, setNodes, setEdges, focusNodeId, selectedNodeId, setSelectedNodeId, pushUndoState, undo, redo, setPendingComponentPartId } = useArchitecture();
  const { isGenerating, addMessage, setIsGenerating } = useChat();
  const { addOutputLog } = useOutput();
  const { setActiveView } = useProjectMeta();
  // Show the asset manager by default on desktop. This state now controls
  // visibility across both desktop and mobile, enabling a collapsible
  // asset library on larger screens.
  const [showAssetManager, setShowAssetManager] = useState(true);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);

  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

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
        })));
      }
    }
  }, [focusNodeId, reactFlowInstance, setLocalNodes]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const markNodeInteracted = useCallback(() => { nodeInteracted.current = true; }, []);
  const markEdgeInteracted = useCallback(() => { edgeInteracted.current = true; }, []);

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

  const handleGenerateArchitecture = useCallback(() => {
    addMessage({ id: crypto.randomUUID(), role: 'user', content: 'Generate Architecture', timestamp: Date.now(), mode: 'chat' });
    setIsGenerating(false);
  }, [addMessage, setIsGenerating]);

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

  const handleContextPaste = useCallback(async () => {
    const center = reactFlowInstance.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    try {
      const text = await navigator.clipboard.readText();
      const parsed = JSON.parse(text);
      if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
        pushUndoState();
        markNodeInteracted();
        const pastedNodes = parsed.nodes.map((n: Node, i: number) => ({
          ...n,
          id: crypto.randomUUID(),
          position: { x: center.x + (i * 20), y: center.y + (i * 20) },
        }));
        setLocalNodes((nds) => [...nds, ...pastedNodes]);
        if (parsed.edges && Array.isArray(parsed.edges)) {
          markEdgeInteracted();
          const pastedEdges = parsed.edges.map((e: Edge) => ({ ...e, id: crypto.randomUUID() }));
          setLocalEdges((eds) => [...eds, ...pastedEdges]);
        }
        addOutputLog(`[ARCH] Pasted ${pastedNodes.length} node(s) from clipboard`);
        return;
      }
    } catch {
      // Clipboard empty, unreadable, or not valid architecture JSON — fall through to default
    }
    pushUndoState();
    markNodeInteracted();
    setLocalNodes((nds) => [...nds, { id: crypto.randomUUID(), type: 'custom' as const, position: center, data: { label: 'New Component', type: 'mcu' } }]);
    addOutputLog('[ARCH] Added new component (no clipboard data)');
  }, [reactFlowInstance, pushUndoState, markNodeInteracted, markEdgeInteracted, setLocalNodes, setLocalEdges, addOutputLog]);

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

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div className="w-full h-full relative group bg-background" ref={reactFlowWrapper}>
          {/* Asset manager is now controlled via showAssetManager state on both
             mobile and desktop. When collapsed, it won't render. */}
          {showAssetManager && (
            <AssetManager
              onDragStart={onDragStart}
              onAddNode={handleAddNodeFromAsset}
              onClose={handleCloseAssetManager}
            />
          )}

          <div className={cn("absolute top-4 right-4 md:right-auto z-10 flex items-center gap-1 bg-card/50 backdrop-blur-xl border border-border p-1 shadow-lg", showAssetManager ? "md:left-[300px]" : "md:left-4")}>
            <StyledTooltip content={showAssetManager ? 'Hide asset library' : 'Show asset library'} side="bottom">
              <button
                data-testid="toggle-asset-manager"
                className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                onClick={handleToggleAssetManager}
                title={showAssetManager ? 'Hide asset library' : 'Show asset library'}
              >
                <Component className="w-4 h-4" />
              </button>
            </StyledTooltip>
            {tools.map((tool) => (
              <StyledTooltip key={tool.id} content={toolLabels[tool.id]} side="bottom">
                <button
                  data-testid={`tool-${tool.id}`}
                  className={cn(
                    "p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
                    tool.id === 'select' && activeTool === 'select' && "bg-primary/20 text-primary",
                    tool.id === 'pan' && activeTool === 'pan' && "bg-primary/20 text-primary",
                    tool.id === 'grid' && snapEnabled && "bg-primary/20 text-primary",
                  )}
                  onClick={tool.action}
                >
                  <tool.icon className="w-4 h-4" />
                </button>
              </StyledTooltip>
            ))}
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
              <div className="text-center space-y-4 max-w-md">
                <div className="w-20 h-20 bg-muted/30 flex items-center justify-center mx-auto border border-dashed border-border">
                  <Cpu className="w-10 h-10 text-muted-foreground opacity-50" />
                </div>
                <h3 className="text-xl font-display font-bold text-foreground">No diagram yet</h3>
                <p className="text-muted-foreground">Ask Chat to generate a system architecture or drag components from the Asset Library.</p>
                <StyledTooltip content="Ask AI to suggest a system architecture" side="bottom">
                  <button
                    data-testid="button-generate-architecture"
                    className="pointer-events-auto px-6 py-2 bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:scale-105 transition-all"
                    onClick={handleGenerateArchitecture}
                  >
                    Generate Architecture
                  </button>
                </StyledTooltip>
              </div>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuSub>
          <ContextMenuSubTrigger>Add Component</ContextMenuSubTrigger>
          <ContextMenuSubContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
            {['MCU', 'Sensor', 'Power', 'Communication', 'Connector'].map((t) => (
              <ContextMenuItem key={t} onSelect={() => handleAddComponent(t)}>{t}</ContextMenuItem>
            ))}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuItem data-testid="context-paste" onSelect={handleContextPaste}>Paste <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+V</span></ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleContextFitView}>Fit View <span className="ml-auto text-muted-foreground text-[10px]">F</span></ContextMenuItem>
        <ContextMenuItem onSelect={handleContextToggleGrid}>Toggle Grid <span className="ml-auto text-muted-foreground text-[10px]">G</span></ContextMenuItem>
        <ContextMenuItem data-testid="context-select-all" onSelect={handleContextSelectAll}>Select All <span className="ml-auto text-muted-foreground text-[10px]">Ctrl+A</span></ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={handleContextExportSummary}>Copy Summary</ContextMenuItem>
        <ContextMenuItem onSelect={handleContextExportJSON}>Copy JSON</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          data-testid="context-edit-component"
          disabled={!selectedNodeId}
          onSelect={handleContextEditComponent}
        >
          <Pencil className="w-3.5 h-3.5 mr-2" />
          Edit Component
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
