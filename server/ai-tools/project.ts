/**
 * Project tools — rename, description, settings, annotations, undo/redo.
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

export function registerProjectTools(registry: ToolRegistry): void {
  registry.register({
    name: 'rename_project',
    description: 'Rename the current project.',
    category: 'project',
    parameters: z.object({
      name: z.string().min(1).max(200).describe('New project name'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      await ctx.storage.updateProject(ctx.projectId, { name: params.name });
      return {
        success: true,
        message: `Project renamed to "${params.name}"`,
      };
    },
  });

  registry.register({
    name: 'update_description',
    description: 'Update the project description.',
    category: 'project',
    parameters: z.object({
      description: z.string().describe('New project description'),
    }),
    requiresConfirmation: false,
    execute: async (params, ctx) => {
      await ctx.storage.updateProject(ctx.projectId, { description: params.description });
      return {
        success: true,
        message: 'Project description updated',
      };
    },
  });

  registry.register({
    name: 'set_project_type',
    description:
      'Set the project type to optimize AI suggestions, component recommendations, and validation rules for the specific domain.',
    category: 'project',
    parameters: z.object({
      projectType: z
        .enum(['iot', 'wearable', 'industrial', 'automotive', 'consumer', 'medical', 'rf', 'power'])
        .describe('Project domain type'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('set_project_type', params),
  });

  registry.register({
    name: 'save_design_decision',
    description: 'Record a design decision with its rationale for future reference.',
    category: 'project',
    parameters: z.object({
      decision: z.string().min(1).describe('What was decided'),
      rationale: z.string().min(1).describe('Why this decision was made'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('save_design_decision', params),
  });

  registry.register({
    name: 'add_annotation',
    description: 'Add a sticky-note annotation to a component for documentation or review comments.',
    category: 'project',
    parameters: z.object({
      nodeLabel: z.string().min(1).describe('Label of the component to annotate'),
      note: z.string().min(1).describe('Annotation text'),
      color: z
        .enum(['yellow', 'blue', 'red', 'green'])
        .optional()
        .default('yellow')
        .describe('Annotation color'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('add_annotation', params),
  });

  registry.register({
    name: 'start_tutorial',
    description: 'Start an interactive tutorial walkthrough for the specified topic.',
    category: 'project',
    parameters: z.object({
      topic: z
        .enum(['getting_started', 'power_design', 'pcb_layout', 'bom_management', 'validation'])
        .describe('Tutorial topic'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('start_tutorial', params),
  });

  registry.register({
    name: 'undo',
    description: 'Undo the last action.',
    category: 'project',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('undo', params),
  });

  registry.register({
    name: 'redo',
    description: 'Redo the last undone action.',
    category: 'project',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('redo', params),
  });

  registry.register({
    name: 'analyze_image',
    description:
      'Analyze an uploaded image or schematic reference — describe what\'s shown and suggest how to implement it in the design.',
    category: 'project',
    parameters: z.object({
      description: z.string().min(1).describe('Description of what the image shows or what to analyze'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('analyze_image', params),
  });
}
