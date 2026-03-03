import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitNetRow, CircuitWireRow, HierarchicalPortRow } from '@shared/schema';

// ===========================================================================
// Circuit Designs
// ===========================================================================

export function useCircuitDesigns(projectId: number) {
  return useQuery<CircuitDesignRow[]>({
    queryKey: ['circuit-designs', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/circuits`);
      const json = await res.json() as { data: CircuitDesignRow[]; total: number };
      return json.data;
    },
  });
}

export function useCircuitDesign(projectId: number, id: number) {
  return useQuery<CircuitDesignRow>({
    queryKey: ['circuit-design', projectId, id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/circuits/${id}`);
      return res.json();
    },
    enabled: id > 0,
  });
}

export function useCreateCircuitDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; name?: string; description?: string; settings?: unknown }) => {
      const res = await apiRequest('POST', `/api/projects/${data.projectId}/circuits`, data);
      return res.json() as Promise<CircuitDesignRow>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['circuit-designs'] });
    },
  });
}

export function useUpdateCircuitDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; id: number; name?: string; description?: string | null; settings?: unknown }) => {
      const { projectId, id, ...body } = data;
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/circuits/${id}`, body);
      return res.json() as Promise<CircuitDesignRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-designs', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['circuit-design', variables.projectId, variables.id] });
    },
  });
}

export function useDeleteCircuitDesign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; id: number }) => {
      await apiRequest('DELETE', `/api/projects/${data.projectId}/circuits/${data.id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-designs', variables.projectId] });
    },
  });
}

// ===========================================================================
// Circuit Instances
// ===========================================================================

export function useCircuitInstances(circuitId: number) {
  return useQuery<CircuitInstanceRow[]>({
    queryKey: ['circuit-instances', circuitId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/circuits/${circuitId}/instances`);
      const json = await res.json() as { data: CircuitInstanceRow[]; total: number };
      return json.data;
    },
    enabled: circuitId > 0,
  });
}

export function useCircuitInstance(circuitId: number, id: number) {
  return useQuery<CircuitInstanceRow>({
    queryKey: ['circuit-instance', circuitId, id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/circuits/${circuitId}/instances/${id}`);
      return res.json();
    },
    enabled: circuitId > 0 && id > 0,
  });
}

export function useCreateCircuitInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      partId: number;
      referenceDesignator: string;
      schematicX?: number;
      schematicY?: number;
      schematicRotation?: number;
      properties?: Record<string, string>;
    }) => {
      const { circuitId, ...body } = data;
      const res = await apiRequest('POST', `/api/circuits/${circuitId}/instances`, body);
      return res.json() as Promise<CircuitInstanceRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-instances', variables.circuitId] });
    },
  });
}

export function useUpdateCircuitInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      id: number;
      referenceDesignator?: string;
      schematicX?: number;
      schematicY?: number;
      schematicRotation?: number;
      breadboardX?: number | null;
      breadboardY?: number | null;
      breadboardRotation?: number | null;
      pcbX?: number | null;
      pcbY?: number | null;
      pcbRotation?: number | null;
      pcbSide?: 'front' | 'back';
      properties?: Record<string, string>;
    }) => {
      const { circuitId, id, ...body } = data;
      const res = await apiRequest('PATCH', `/api/circuits/${circuitId}/instances/${id}`, body);
      return res.json() as Promise<CircuitInstanceRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-instances', variables.circuitId] });
      queryClient.invalidateQueries({ queryKey: ['circuit-instance', variables.circuitId, variables.id] });
    },
  });
}

export function useDeleteCircuitInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { circuitId: number; id: number }) => {
      await apiRequest('DELETE', `/api/circuits/${data.circuitId}/instances/${data.id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-instances', variables.circuitId] });
    },
  });
}

// ===========================================================================
// Circuit Nets
// ===========================================================================

export function useCircuitNets(circuitId: number) {
  return useQuery<CircuitNetRow[]>({
    queryKey: ['circuit-nets', circuitId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/circuits/${circuitId}/nets`);
      const json = await res.json() as { data: CircuitNetRow[]; total: number };
      return json.data;
    },
    enabled: circuitId > 0,
  });
}

export function useCircuitNet(circuitId: number, id: number) {
  return useQuery<CircuitNetRow>({
    queryKey: ['circuit-net', circuitId, id],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/circuits/${circuitId}/nets/${id}`);
      return res.json();
    },
    enabled: circuitId > 0 && id > 0,
  });
}

export function useCreateCircuitNet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      name: string;
      netType?: 'signal' | 'power' | 'ground' | 'bus';
      voltage?: string | null;
      busWidth?: number | null;
      segments?: unknown[];
      labels?: unknown[];
      style?: unknown;
    }) => {
      const { circuitId, ...body } = data;
      const res = await apiRequest('POST', `/api/circuits/${circuitId}/nets`, body);
      return res.json() as Promise<CircuitNetRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-nets', variables.circuitId] });
    },
  });
}

export function useUpdateCircuitNet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      id: number;
      name?: string;
      netType?: 'signal' | 'power' | 'ground' | 'bus';
      voltage?: string | null;
      busWidth?: number | null;
      segments?: unknown[];
      labels?: unknown[];
      style?: unknown;
    }) => {
      const { circuitId, id, ...body } = data;
      const res = await apiRequest('PATCH', `/api/circuits/${circuitId}/nets/${id}`, body);
      return res.json() as Promise<CircuitNetRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-nets', variables.circuitId] });
      queryClient.invalidateQueries({ queryKey: ['circuit-net', variables.circuitId, variables.id] });
    },
  });
}

export function useDeleteCircuitNet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { circuitId: number; id: number }) => {
      await apiRequest('DELETE', `/api/circuits/${data.circuitId}/nets/${data.id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-nets', variables.circuitId] });
    },
  });
}

// ===========================================================================
// Circuit Wires
// ===========================================================================

export function useCircuitWires(circuitId: number) {
  return useQuery<CircuitWireRow[]>({
    queryKey: ['circuit-wires', circuitId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/circuits/${circuitId}/wires`);
      const json = await res.json() as { data: CircuitWireRow[]; total: number };
      return json.data;
    },
    enabled: circuitId > 0,
  });
}

export function useCreateCircuitWire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      netId: number;
      view: string;
      points: { x: number; y: number }[];
      layer?: string;
      width?: number;
      color?: string | null;
      wireType?: 'wire' | 'jump';
    }) => {
      const { circuitId, ...body } = data;
      const res = await apiRequest('POST', `/api/circuits/${circuitId}/wires`, body);
      return res.json() as Promise<CircuitWireRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-wires', variables.circuitId] });
    },
  });
}

export function useUpdateCircuitWire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      id: number;
      points?: { x: number; y: number }[];
      layer?: string;
      width?: number;
      color?: string | null;
      wireType?: 'wire' | 'jump';
    }) => {
      const { circuitId, id, ...body } = data;
      const res = await apiRequest('PATCH', `/api/wires/${id}`, body);
      return res.json() as Promise<CircuitWireRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-wires', variables.circuitId] });
    },
  });
}

export function useDeleteCircuitWire() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { circuitId: number; id: number }) => {
      await apiRequest('DELETE', `/api/wires/${data.id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-wires', variables.circuitId] });
    },
  });
}

// ===========================================================================
// Architecture → Schematic Expansion
// ===========================================================================

interface ExpandArchitectureResult {
  circuit: CircuitDesignRow;
  instanceCount: number;
  netCount: number;
  unmatchedNodes: number;
}

export function useExpandArchitecture() {
  const queryClient = useQueryClient();
  return useMutation<ExpandArchitectureResult, Error, { projectId: number; circuitName?: string }>({
    mutationFn: async ({ projectId, circuitName }) => {
      const res = await apiRequest('POST', `/api/projects/${projectId}/circuits/expand-architecture`, { circuitName });
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-designs', variables.projectId] });
    },
  });
}

// ===========================================================================
// Hierarchical Sheet Navigation
// ===========================================================================

export function useChildDesigns(projectId: number, designId: number) {
  return useQuery<CircuitDesignRow[]>({
    queryKey: ['circuit-children', projectId, designId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/circuits/${designId}/children`);
      const json = await res.json() as { data: CircuitDesignRow[]; total: number };
      return json.data;
    },
    enabled: designId > 0,
  });
}

export function useRootDesigns(projectId: number) {
  return useQuery<CircuitDesignRow[]>({
    queryKey: ['circuit-roots', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/circuits/roots`);
      const json = await res.json() as { data: CircuitDesignRow[]; total: number };
      return json.data;
    },
  });
}

export function useHierarchicalPorts(projectId: number, designId: number) {
  return useQuery<HierarchicalPortRow[]>({
    queryKey: ['hierarchical-ports', projectId, designId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/circuits/${designId}/ports`);
      const json = await res.json() as { data: HierarchicalPortRow[]; total: number };
      return json.data;
    },
    enabled: designId > 0,
  });
}

export function useCreateHierarchicalPort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      designId: number;
      portName: string;
      direction?: 'input' | 'output' | 'bidirectional';
      netName?: string | null;
      positionX?: number;
      positionY?: number;
    }) => {
      const { projectId, designId, ...body } = data;
      const res = await apiRequest('POST', `/api/projects/${projectId}/circuits/${designId}/ports`, body);
      return res.json() as Promise<HierarchicalPortRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hierarchical-ports', variables.projectId, variables.designId] });
    },
  });
}

export function useUpdateHierarchicalPort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      designId: number;
      portId: number;
      portName?: string;
      direction?: 'input' | 'output' | 'bidirectional';
      netName?: string | null;
      positionX?: number;
      positionY?: number;
    }) => {
      const { projectId, designId, portId, ...body } = data;
      const res = await apiRequest('PATCH', `/api/projects/${projectId}/circuits/${designId}/ports/${portId}`, body);
      return res.json() as Promise<HierarchicalPortRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hierarchical-ports', variables.projectId, variables.designId] });
    },
  });
}

export function useDeleteHierarchicalPort() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; designId: number; portId: number }) => {
      await apiRequest('DELETE', `/api/projects/${data.projectId}/circuits/${data.designId}/ports/${data.portId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['hierarchical-ports', variables.projectId, variables.designId] });
    },
  });
}
