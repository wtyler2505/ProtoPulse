/**
 * Navigation tools — view switching and schematic sheet navigation.
 *
 * These tools let the AI change which panel or schematic sheet the user
 * is looking at. Both are client-side dispatched (no server state changes).
 *
 * @module ai-tools/navigation
 */

import { z } from 'zod';
import type { ToolRegistry } from './registry';
import { clientAction } from './registry';

/**
 * Register all navigation-category tools with the given registry.
 *
 * Tools registered:
 * - `switch_view`            — Navigate between top-level application views.
 * - `switch_schematic_sheet` — Jump to a specific schematic sheet by ID.
 *
 * All navigation tools are non-destructive and dispatched client-side.
 *
 * @param registry - The ToolRegistry instance to register tools into.
 */
export function registerNavigationTools(registry: ToolRegistry): void {
  /**
   * switch_view — Navigate between top-level application views.
   *
   * Dispatched client-side. Switches the active tab in ProjectWorkspace
   * to the specified view (architecture, schematic, procurement, etc.).
   */
  registry.register({
    name: 'switch_view',
    description:
      'Switch the active view in the application. Navigate between any of the 30 views: design (architecture, schematic, breadboard, pcb, component_editor, circuit_code, generative_design), simulation (simulation, digital_twin, calculators), BOM (procurement, ordering, storage), validation, project management (dashboard, project_explorer, design_history, lifecycle, comments, kanban, audit_trail), output (output, viewer_3d), learning (knowledge, design_patterns, community, starter_circuits), hardware (arduino, serial_monitor), and experimental (labs).',
    category: 'navigation',
    parameters: z.object({
      view: z
        .enum([
          'dashboard', 'architecture', 'schematic', 'breadboard', 'pcb',
          'component_editor', 'procurement', 'validation', 'simulation',
          'output', 'design_history', 'lifecycle', 'comments', 'calculators',
          'design_patterns', 'storage', 'kanban', 'knowledge', 'viewer_3d',
          'community', 'ordering', 'serial_monitor', 'circuit_code',
          'generative_design', 'digital_twin', 'arduino', 'starter_circuits',
          'audit_trail', 'labs', 'project_explorer',
        ])
        .describe('The view to switch to'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('switch_view', params),
  });

  /**
   * switch_schematic_sheet — Jump to a specific schematic sheet.
   *
   * Dispatched client-side. Navigates the schematic editor to the sheet
   * identified by the given ID, useful in multi-sheet designs.
   */
  registry.register({
    name: 'switch_schematic_sheet',
    description: 'Switch to a specific schematic sheet by its ID.',
    category: 'navigation',
    parameters: z.object({
      sheetId: z.string().min(1).describe('The ID of the schematic sheet to switch to'),
    }),
    requiresConfirmation: false,
    execute: async (params) => clientAction('switch_schematic_sheet', params),
  });
}
