import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { CircuitDesignRow, CircuitInstanceRow, CircuitNetRow, CircuitWireRow, CircuitViaRow, HierarchicalPortRow, PcbZone, DesignComment, SimulationScenario } from '@shared/schema';
import type { CircuitAiGenerateResponse } from '@shared/circuit-ai-types';

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

export function useGenerateCircuitWithAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      description: string;
      apiKey: string;
      model?: string;
    }) => {
      const { circuitId, ...body } = data;
      const res = await apiRequest('POST', `/api/circuits/${circuitId}/ai/generate`, body);
      return res.json() as Promise<CircuitAiGenerateResponse>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-instances', variables.circuitId] });
      queryClient.invalidateQueries({ queryKey: ['circuit-nets', variables.circuitId] });
      queryClient.invalidateQueries({ queryKey: ['circuit-wires', variables.circuitId] });
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
      partId: number | null;
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
      benchX?: number | null;
      benchY?: number | null;
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
      partId?: number | null;
      subDesignId?: number | null;
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
      endpointMeta?: Record<string, unknown> | null;
      provenance?: 'manual' | 'synced' | 'coach' | 'jumper';
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
      endpointMeta?: Record<string, unknown> | null;
      provenance?: 'manual' | 'synced' | 'coach' | 'jumper';
    }) => {
      const { circuitId, id, ...body } = data;
      const res = await apiRequest('PATCH', `/api/circuits/${circuitId}/wires/${id}`, body);
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
      await apiRequest('DELETE', `/api/circuits/${data.circuitId}/wires/${data.id}`);
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
// Schematic → PCB Forward Annotation
// ===========================================================================

export interface PushToPcbResult {
  pushed: number;
  alreadyPlaced: number;
  total: number;
  instances: CircuitInstanceRow[];
}

export function usePushToPcb() {
  const queryClient = useQueryClient();
  return useMutation<PushToPcbResult, Error, { circuitId: number }>({
    mutationFn: async ({ circuitId }) => {
      const res = await apiRequest('POST', `/api/circuits/${circuitId}/push-to-pcb`, {});
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-instances', variables.circuitId] });
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

export function useInstantiateSubSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; parentId: number; subId: number; x?: number; y?: number }) => {
      const res = await apiRequest('POST', `/api/projects/${data.projectId}/circuits/${data.parentId}/instantiate/${data.subId}`, { x: data.x, y: data.y });
      return res.json() as Promise<CircuitInstanceRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-instances', variables.parentId] });
      queryClient.invalidateQueries({ queryKey: ['circuit-designs', variables.projectId] });
    },
  });
}

// ===========================================================================
// PCB Zones (BL-0100)
// ===========================================================================

export function usePcbZones(projectId: number) {
  return useQuery<PcbZone[]>({
    queryKey: ['pcb-zones', projectId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/pcb-zones`);
      return res.json() as Promise<PcbZone[]>;
    },
  });
}

export function useCreatePcbZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      zoneType: 'pour' | 'keepout' | 'keepin' | 'cutout' | 'teardrop';
      layer: string;
      points: Array<{ x: number; y: number }>;
      netId?: number | null;
      name?: string | null;
      properties?: Record<string, any>;
    }) => {
      const { projectId, ...body } = data;
      const res = await apiRequest('POST', `/api/projects/${projectId}/pcb-zones`, body);
      return res.json() as Promise<PcbZone>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pcb-zones', variables.projectId] });
    },
  });
}

export function useUpdatePcbZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      zoneId: number;
      update: Partial<PcbZone>;
    }) => {
      const res = await apiRequest('PATCH', `/api/projects/${data.projectId}/pcb-zones/${data.zoneId}`, data.update);
      return res.json() as Promise<PcbZone>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pcb-zones', variables.projectId] });
    },
  });
}

export function useDeletePcbZone() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; zoneId: number }) => {
      await apiRequest('DELETE', `/api/projects/${data.projectId}/pcb-zones/${data.zoneId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pcb-zones', variables.projectId] });
    },
  });
}

// ===========================================================================
// Design Comments (Review) (BL-0180)
// ===========================================================================

export function useComments(projectId: number, filters?: { targetType?: string; targetId?: string; status?: string }) {
  return useQuery<{ data: DesignComment[]; total: number }>({
    queryKey: ['design-comments', projectId, filters],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (filters?.targetType) sp.append('targetType', filters.targetType);
      if (filters?.targetId) sp.append('targetId', filters.targetId);
      if (filters?.status !== undefined) sp.append('status', String(filters.status));

      const res = await apiRequest('GET', `/api/projects/${projectId}/comments?${sp.toString()}`);
      return res.json() as Promise<{ data: DesignComment[]; total: number }>;
    },
  });
}
export function useCreateComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      content: string;
      targetType: 'node' | 'edge' | 'bom_item' | 'general' | 'spatial';
      targetId?: string | null;
      spatialX?: number | null;
      spatialY?: number | null;
      spatialView?: 'architecture' | 'schematic' | 'pcb' | 'breadboard' | null;
      parentId?: number | null;
      userId?: number | null;
    }) => {
      const { projectId, ...body } = data;
      const res = await apiRequest('POST', `/api/projects/${projectId}/comments`, body);
      return res.json() as Promise<DesignComment>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['design-comments', variables.projectId] });
    },
  });
}

export function useUpdateCommentStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; commentId: number; status: string; updatedBy?: number }) => {
      const res = await apiRequest('PATCH', `/api/projects/${data.projectId}/comments/${data.commentId}/status`, { status: data.status, updatedBy: data.updatedBy });
      return res.json() as Promise<DesignComment>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['design-comments', variables.projectId] });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; commentId: number }) => {
      await apiRequest('DELETE', `/api/projects/${data.projectId}/comments/${data.commentId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['design-comments', variables.projectId] });
    },
  });
}

// ===========================================================================
// Circuit Vias
// ===========================================================================

export function useCircuitVias(circuitId: number) {
  return useQuery<CircuitViaRow[]>({
    queryKey: ['circuit-vias', circuitId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/circuits/${circuitId}/vias`);
      const json = await res.json() as { data: CircuitViaRow[]; total: number };
      return json.data;
    },
    enabled: circuitId > 0,
  });
}

export function useCreateCircuitVia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      netId: number;
      x: number;
      y: number;
      outerDiameter: number;
      drillDiameter: number;
      viaType?: 'through' | 'blind' | 'buried' | 'micro';
      layerStart?: string;
      layerEnd?: string;
      tented?: boolean;
    }) => {
      const { circuitId, ...body } = data;
      const res = await apiRequest('POST', `/api/circuits/${circuitId}/vias`, body);
      return res.json() as Promise<CircuitViaRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-vias', variables.circuitId] });
    },
  });
}

export function useCreateCircuitVias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { circuitId: number; vias: Omit<CircuitViaRow, 'id' | 'circuitId' | 'createdAt'>[] }) => {
      const res = await apiRequest('POST', `/api/circuits/${params.circuitId}/vias/bulk`, params.vias);
      return res.json() as Promise<{ count: number, data: CircuitViaRow[] }>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-vias', variables.circuitId] });
    },
  });
}

export function useUpdateCircuitVia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      circuitId: number;
      id: number;
      x?: number;
      y?: number;
      outerDiameter?: number;
      drillDiameter?: number;
      viaType?: 'through' | 'blind' | 'buried' | 'micro';
      layerStart?: string;
      layerEnd?: string;
      tented?: boolean;
    }) => {
      const { circuitId, id, ...body } = data;
      const res = await apiRequest('PATCH', `/api/circuits/${circuitId}/vias/${id}`, body);
      return res.json() as Promise<CircuitViaRow>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-vias', variables.circuitId] });
    },
  });
}

export function useDeleteCircuitVia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { circuitId: number; id: number }) => {
      await apiRequest('DELETE', `/api/circuits/${data.circuitId}/vias/${data.id}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['circuit-vias', variables.circuitId] });
    },
  });
}

// ===========================================================================
// Simulation Scenarios (BL-0124)
// ===========================================================================

export function useSimulationScenarios(projectId: number, circuitId: number) {
  return useQuery<SimulationScenario[]>({
    queryKey: ['simulation-scenarios', projectId, circuitId],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${projectId}/circuits/${circuitId}/scenarios`);
      const json = await res.json() as { data: SimulationScenario[]; total: number };
      return json.data;
    },
    enabled: projectId > 0 && circuitId > 0,
  });
}

export function useCreateSimulationScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      circuitId: number;
      name: string;
      description?: string;
      config: Record<string, any>;
    }) => {
      const { projectId, circuitId, ...body } = data;
      const res = await apiRequest('POST', `/api/projects/${projectId}/circuits/${circuitId}/scenarios`, body);
      return res.json() as Promise<SimulationScenario>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['simulation-scenarios', variables.projectId, variables.circuitId] });
    },
  });
}

export function useUpdateSimulationScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      projectId: number;
      circuitId: number;
      scenarioId: number;
      update: Partial<SimulationScenario>;
    }) => {
      const res = await apiRequest('PATCH', `/api/projects/${data.projectId}/scenarios/${data.scenarioId}`, data.update);
      return res.json() as Promise<SimulationScenario>;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['simulation-scenarios', variables.projectId, variables.circuitId] });
    },
  });
}

export function useDeleteSimulationScenario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { projectId: number; circuitId: number; scenarioId: number }) => {
      await apiRequest('DELETE', `/api/projects/${data.projectId}/scenarios/${data.scenarioId}`);
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['simulation-scenarios', variables.projectId, variables.circuitId] });
    },
  });
}
