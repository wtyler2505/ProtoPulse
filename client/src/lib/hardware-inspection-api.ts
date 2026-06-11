import { apiRequest } from '@/lib/queryClient';

export type HardwareInspectionMode = 'visual' | 'layout';

export interface VisualHardwareInspectionRequest {
  projectId: number;
  imageUrl: string;
  query: string;
}

export interface EmbodiedLayoutAnalysisRequest {
  projectId: number;
  chassisDescription: string;
  query: string;
  imageUrl?: string;
}

export interface HardwareInspectionResponse {
  result: string;
}

export async function runVisualHardwareInspection(
  payload: VisualHardwareInspectionRequest,
): Promise<HardwareInspectionResponse> {
  const { projectId, ...body } = payload;
  const res = await apiRequest('POST', `/api/projects/${projectId}/hardware-inspection/visual`, body);
  return res.json() as Promise<HardwareInspectionResponse>;
}

export async function runEmbodiedLayoutAnalysis(
  payload: EmbodiedLayoutAnalysisRequest,
): Promise<HardwareInspectionResponse> {
  const { projectId, ...body } = payload;
  const res = await apiRequest('POST', `/api/projects/${projectId}/hardware-inspection/layout`, body);
  return res.json() as Promise<HardwareInspectionResponse>;
}
