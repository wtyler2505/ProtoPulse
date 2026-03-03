/**
 * Project tools — rename, description, settings, annotations, undo/redo.
 *
 * Provides AI tools for project-level operations: renaming, updating
 * descriptions, setting the project domain type, recording design decisions,
 * adding annotations to components, launching tutorials, undo/redo, and
 * image analysis.
 *
 * Tools that mutate project data server-side (e.g., `rename_project`,
 * `update_description`) execute via `ctx.storage`. Tools that require
 * client-side UI interaction (e.g., `set_project_type`, `undo`, `redo`)
 * are dispatched via {@link clientAction}.
 *
 * @module ai-tools/project
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

/**
 * Register all project-category tools with the given registry.
 *
 * Tools registered (9 total):
 *
 * **Project metadata:**
 * - `rename_project`       — Rename the current project (server-side, writes to DB).
 * - `update_description`   — Update the project description (server-side, writes to DB).
 * - `set_project_type`     — Set the project domain type for AI optimization.
 *
 * **Design documentation:**
 * - `save_design_decision` — Record a design decision with rationale.
 * - `add_annotation`       — Add a sticky-note annotation to a component.
 *
 * **Tutorials:**
 * - `start_tutorial`       — Start an interactive tutorial walkthrough.
 *
 * **History:**
 * - `undo`                 — Undo the last action.
 * - `redo`                 — Redo the last undone action.
 *
 * **Analysis:**
 * - `analyze_image`        — Analyze an uploaded image or schematic reference.
 *
 * @param registry - The {@link ToolRegistry} instance to register tools into.
 */
export function registerProjectTools(registry: ToolRegistry): void {
  /**
   * rename_project — Rename the current project.
   *
   * Executes server-side: updates the project name via `storage.updateProject()`.
   *
   * @side-effect Writes to the `projects` table.
   */
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

  /**
   * update_description — Update the project description.
   *
   * Executes server-side: updates the project description via `storage.updateProject()`.
   *
   * @side-effect Writes to the `projects` table.
   */
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

  /**
   * set_project_type — Set the project domain type.
   *
   * Dispatched client-side. Configures the project's domain (IoT, wearable,
   * industrial, etc.) to optimize AI suggestions, component recommendations,
   * and validation rules for that specific domain.
   */
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

  /**
   * save_design_decision — Record a design decision with its rationale.
   *
   * Dispatched client-side. Stores the decision and reasoning in the project
   * history for future reference and design review.
   */
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

  /**
   * add_annotation — Add a sticky-note annotation to a component.
   *
   * Dispatched client-side. Places a colored annotation note on the specified
   * component node for documentation or review comments.
   */
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

  /**
   * start_tutorial — Start an interactive tutorial walkthrough.
   *
   * Dispatched client-side. Launches a guided tutorial for the specified
   * topic, walking the user through the relevant features.
   */
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

  /**
   * undo — Undo the last action.
   *
   * Dispatched client-side. Reverts the most recent state change in the
   * project's undo/redo history stack.
   */
  registry.register({
    name: 'undo',
    description: 'Undo the last action.',
    category: 'project',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('undo', params),
  });

  /**
   * redo — Redo the last undone action.
   *
   * Dispatched client-side. Re-applies the most recently undone state change
   * from the project's undo/redo history stack.
   */
  registry.register({
    name: 'redo',
    description: 'Redo the last undone action.',
    category: 'project',
    parameters: z.object({}),
    requiresConfirmation: false,
    execute: async (params) => clientAction('redo', params),
  });

  /**
   * analyze_image — Analyze an uploaded image or schematic reference.
   *
   * Dispatched client-side. Describes what the image shows and suggests
   * how to implement the depicted design elements in the current project.
   */
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
