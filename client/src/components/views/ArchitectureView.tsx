import { useCallback, useEffect, useRef, useState } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Connection, Edge, Node, ReactFlowProvider, useReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProject } from '@/lib/project-context';
import CustomNode from './CustomNode';
import AssetManager from '@/components/panels/AssetManager';
import { cn } from '@/lib/utils';
import { MousePointer2, Grid, Move, Maximize, Cpu, Component } from 'lucide-react';

const nodeTypes = {
  custom: CustomNode,
};

function ArchitectureFlow() {
  const { nodes, edges, setNodes, setEdges, isGenerating, addMessage, setIsGenerating } = useProject();
  const [showAssetManager, setShowAssetManager] = useState(false);
  const [activeTool, setActiveTool] = useState<'select' | 'pan'>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useReactFlow();

  const isInitialMount = useRef(true);
  const saveTimer = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setNodes(localNodes);
    }, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [localNodes]);

  useEffect(() => {
    if (isInitialMount.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setEdges(localEdges);
    }, 1000);
    return () => clearTimeout(saveTimer.current);
  }, [localEdges]);

  const onNodesDelete = useCallback(
    (deleted: Node[]) => {
      setLocalNodes((nds) => nds.filter((n) => !deleted.find((d) => d.id === n.id)));
    },
    [setLocalNodes],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      setLocalEdges((eds) => eds.filter((e) => !deleted.find((d) => d.id === e.id)));
    },
    [setLocalEdges],
  );

  const onConnect = useCallback(
    (params: Connection) => setLocalEdges((eds) => addEdge(params, eds)),
    [setLocalEdges],
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

      const position = { x: event.clientX - 300, y: event.clientY - 100 };
      
      const newNode = {
        id: Date.now().toString(),
        type: 'custom',
        position,
        data: { label, type },
      };

      setLocalNodes((nds) => nds.concat(newNode));
    },
    [setLocalNodes],
  );

  const onDragStart = (event: React.DragEvent, nodeType: string, label: string) => {
    event.dataTransfer.setData('application/reactflow/type', nodeType);
    event.dataTransfer.setData('application/reactflow/label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  const tools = [
    { icon: MousePointer2, id: 'select' as const, action: () => setActiveTool('select') },
    { icon: Move, id: 'pan' as const, action: () => setActiveTool('pan') },
    { icon: Grid, id: 'grid' as const, action: () => setSnapEnabled(!snapEnabled) },
    { icon: Maximize, id: 'fit' as const, action: () => reactFlowInstance.fitView({ padding: 0.2 }) },
  ];
  
  return (
    <div className="w-full h-full relative group bg-background" ref={reactFlowWrapper}>
      <div className="hidden md:block">
        <AssetManager onDragStart={onDragStart} />
      </div>

      {showAssetManager && (
        <div className="md:hidden">
          <AssetManager onDragStart={onDragStart} onClose={() => setShowAssetManager(false)} />
        </div>
      )}

      <div className="absolute top-4 right-4 md:right-auto md:left-[300px] z-10 flex items-center gap-1 bg-card border border-border p-1 shadow-lg">
        <button
          data-testid="toggle-asset-manager"
          className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors md:hidden"
          onClick={() => setShowAssetManager(!showAssetManager)}
        >
          <Component className="w-4 h-4" />
        </button>
        {tools.map((tool) => (
          <button
            key={tool.id}
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
        ))}
      </div>

      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
        <div className="absolute inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
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
            <button
              data-testid="button-generate-schematic"
              className="pointer-events-auto px-6 py-2 bg-primary text-primary-foreground font-medium shadow-lg shadow-primary/20 hover:scale-105 transition-all"
              onClick={() => {
                addMessage({ id: Date.now().toString(), role: 'user', content: 'Generate Schematic', timestamp: Date.now(), mode: 'chat' });
                setIsGenerating(true);
                setTimeout(() => {
                  addMessage({ id: (Date.now()+1).toString(), role: 'assistant', content: "I've generated a preliminary block diagram. The architecture includes an MCU core, power management, communication module, and sensor subsystem.", timestamp: Date.now() });
                  setIsGenerating(false);
                }, 2000);
              }}
            >
              Generate Schematic
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ArchitectureView() {
  return (
    <ReactFlowProvider>
      <ArchitectureFlow />
    </ReactFlowProvider>
  );
}
