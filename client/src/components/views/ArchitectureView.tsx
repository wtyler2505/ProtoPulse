import { useCallback, useRef } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Connection, Edge, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProject } from '@/lib/project-context';
import CustomNode from './CustomNode';
import AssetManager from '@/components/panels/AssetManager';
import { cn } from '@/lib/utils';
import { MousePointer2, Grid, Move, Maximize, Cpu } from 'lucide-react';

const nodeTypes = {
  custom: CustomNode,
};

function ArchitectureFlow() {
  const { nodes, edges, setNodes, setEdges, isGenerating } = useProject();
  
  // Initialize local state from context for React Flow's internal management
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);

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

      // Simple position calculation (center of screen or drop point)
      // In a real app, use project() from useReactFlow to get canvas coordinates
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

  // Sync back to context on unmount or save (simplified for now)
  // In a real app, you'd sync on every change or use a store
  
  return (
    <div className="w-full h-full relative group bg-background" ref={reactFlowWrapper}>
      <AssetManager onDragStart={onDragStart} />

      {/* Toolbar */}
      <div className="absolute top-4 left-[300px] z-10 flex items-center gap-1 bg-card border border-border p-1 rounded-md shadow-lg">
        {[MousePointer2, Move, Grid, Maximize].map((Icon, i) => (
          <button key={i} className={cn("p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors", i === 0 && "bg-primary/20 text-primary")}>
            <Icon className="w-4 h-4" />
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
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
        colorMode="dark"
        snapToGrid={true}
        snapGrid={[20, 20]}
      >
        <Background color="#333" gap={20} size={1} />
        <Controls className="!bg-card !border-border !fill-foreground" />
        <MiniMap 
          className="!bg-card !border-border !rounded-lg overflow-hidden" 
          nodeColor={(n) => {
            if (n.type === 'custom') return '#06b6d4';
            return '#fff';
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
      </ReactFlow>

      {/* Generating Overlay */}
      {isGenerating && (
        <div className="absolute inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="bg-card border border-primary/50 p-6 rounded-xl shadow-[0_0_50px_rgba(6,182,212,0.2)] flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
            <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin"></div>
            <div className="font-display font-bold text-lg text-primary tracking-widest animate-pulse">GENERATING ARCHITECTURE...</div>
          </div>
        </div>
      )}
      
      {/* Empty State (if no nodes) */}
      {localNodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
          <div className="text-center space-y-4 max-w-md">
            <div className="w-20 h-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto border border-dashed border-border">
              <Cpu className="w-10 h-10 text-muted-foreground opacity-50" />
            </div>
            <h3 className="text-xl font-display font-bold text-foreground">No diagram yet</h3>
            <p className="text-muted-foreground">Ask Chat to generate a system architecture or drag components from the Asset Library.</p>
            <button className="pointer-events-auto px-6 py-2 bg-primary text-primary-foreground font-medium rounded-full shadow-lg shadow-primary/20 hover:scale-105 transition-all">
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
