import { useCallback } from 'react';
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState, Connection, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useProject } from '@/lib/project-context';
import CustomNode from './CustomNode';

const nodeTypes = {
  custom: CustomNode,
};

export default function ArchitectureView() {
  const { nodes, edges, setNodes, setEdges } = useProject();
  
  // Initialize local state from context for React Flow's internal management
  const [localNodes, setLocalNodes, onNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, onEdgesChange] = useEdgesState(edges);

  const onConnect = useCallback(
    (params: Connection) => setLocalEdges((eds) => addEdge(params, eds)),
    [setLocalEdges],
  );

  return (
    <div className="w-full h-full bg-background relative group">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]"></div>
      <ReactFlow
        nodes={localNodes}
        edges={localEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        className="bg-transparent"
        colorMode="dark"
      >
        <Background color="#333" gap={20} size={1} />
        <Controls className="!bg-card !border-border !fill-foreground" />
        <MiniMap 
          className="!bg-card !border-border" 
          nodeColor={(n) => {
            if (n.type === 'custom') return '#06b6d4';
            return '#fff';
          }}
        />
      </ReactFlow>
      
      <div className="absolute top-4 left-4 z-10 px-3 py-1 bg-card/80 backdrop-blur border border-border rounded text-xs text-muted-foreground font-mono">
        MODE: ARCHITECTURE // EDITABLE
      </div>
    </div>
  );
}
