import { z } from 'zod';
import {
  EmbodiedLayoutAnalysisInputSchema,
  EmbodiedLayoutAnalysisOutputSchema,
  embodiedLayoutAnalysisFlow,
  runEmbodiedLayoutAnalysisDraft,
} from './embodied-layout-analysis';
import {
  MultimodalDatasheetInputSchema,
  MultimodalDatasheetOutputSchema,
  multimodalDatasheetFlow,
  runMultimodalDatasheetDraft,
} from './multimodal-datasheet';
import {
  VisualHardwareInspectionInputSchema,
  VisualHardwareInspectionOutputSchema,
  visualHardwareInspectionFlow,
  runVisualHardwareInspectionDraft,
} from './visual-hardware-inspection';

export const FlowDefinitionSchema = z.object({
  name: z.string(),
  inputSchemaName: z.string(),
  outputSchemaName: z.string(),
});

export const FlowRegistrySchema = z.object({
  multimodalDatasheet: FlowDefinitionSchema,
  visualHardwareInspection: FlowDefinitionSchema,
  embodiedLayoutAnalysis: FlowDefinitionSchema,
});

export const flowRegistry = FlowRegistrySchema.parse({
  multimodalDatasheet: {
    name: 'multimodalDatasheet',
    inputSchemaName: 'MultimodalDatasheetInputSchema',
    outputSchemaName: 'MultimodalDatasheetOutputSchema',
  },
  visualHardwareInspection: {
    name: 'visualHardwareInspection',
    inputSchemaName: 'VisualHardwareInspectionInputSchema',
    outputSchemaName: 'VisualHardwareInspectionOutputSchema',
  },
  embodiedLayoutAnalysis: {
    name: 'embodiedLayoutAnalysis',
    inputSchemaName: 'EmbodiedLayoutAnalysisInputSchema',
    outputSchemaName: 'EmbodiedLayoutAnalysisOutputSchema',
  },
});

export type FlowRegistry = typeof flowRegistry;

export const flowSchemas = {
  MultimodalDatasheetInputSchema,
  MultimodalDatasheetOutputSchema,
  VisualHardwareInspectionInputSchema,
  VisualHardwareInspectionOutputSchema,
  EmbodiedLayoutAnalysisInputSchema,
  EmbodiedLayoutAnalysisOutputSchema,
};

export const draftFlowRunners = {
  multimodalDatasheet: runMultimodalDatasheetDraft,
  visualHardwareInspection: runVisualHardwareInspectionDraft,
  embodiedLayoutAnalysis: runEmbodiedLayoutAnalysisDraft,
};

export const genkitFlows = {
  multimodalDatasheet: multimodalDatasheetFlow,
  visualHardwareInspection: visualHardwareInspectionFlow,
  embodiedLayoutAnalysis: embodiedLayoutAnalysisFlow,
};
