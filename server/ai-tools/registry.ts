/**
 * ToolRegistry — central registry with validation, execution, and format converters.
 *
 * The registry is the single source of truth for all AI tools in the system.
 * Category-specific modules (architecture, circuit, bom, etc.) register their
 * tools at startup via `register()`. At runtime the registry handles:
 *
 * 1. **Validation** — parse incoming params against the tool's Zod schema.
 * 2. **Execution** — validate then invoke the tool's async executor.
 * 3. **Format conversion** — serialize all tools to Anthropic or Gemini native
 *    tool/function formats for inclusion in API requests.
 *
 * @module ai-tools/registry
 */

import type {
  ToolCategory,
  ToolDefinition,
  ToolResult,
  ToolContext,
} from './types';

import { logger } from '../logger';

/**
 * Central registry that stores, validates, executes, and serializes AI tools.
 *
 * A singleton instance is created in `index.ts` by composing all category
 * registration functions. The registry enforces unique tool names — attempting
 * to register a duplicate throws an error at startup.
 */
export class ToolRegistry {
  /** Internal map of tool name to definition. */
  private tools = new Map<string, ToolDefinition>();

  /**
   * Register a tool definition. Throws if a tool with the same name already exists.
   *
   * @param tool - The complete tool definition including name, schema, and executor.
   * @throws {Error} If a tool with `tool.name` is already registered.
   */
  register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Look up a tool definition by its unique name.
   *
   * @param name - Tool name (e.g., `'add_node'`, `'export_kicad'`).
   * @returns The tool definition, or `undefined` if not found.
   */
  get(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Return all registered tool definitions as an array.
   *
   * @returns Array of every registered ToolDefinition.
   */
  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Return all tools belonging to the specified category.
   *
   * @param category - The category to filter by (e.g., `'architecture'`, `'bom'`).
   * @returns Array of tool definitions in the given category.
   */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return this.getAll().filter((t) => t.category === category);
  }

  /**
   * Return the names of all tools that require user confirmation before execution.
   *
   * These are destructive operations (deletes, clears, bulk removals) where the
   * client should prompt "Are you sure?" before proceeding.
   *
   * @returns Array of tool name strings with `requiresConfirmation === true`.
   */
  getDestructiveTools(): string[] {
    return this.getAll()
      .filter((t) => t.requiresConfirmation)
      .map((t) => t.name);
  }

  /**
   * Validate params against a tool's Zod schema.
   *
   * Returns the parsed (coerced/defaulted) params on success, or a string
   * error message on failure. Does not execute the tool.
   *
   * @param toolName - Name of the registered tool.
   * @param params   - Raw parameters to validate (typically from AI model output).
   * @returns A discriminated union: `{ ok: true, params }` on success, `{ ok: false, error }` on failure.
   */
  validate(
    toolName: string,
    params: unknown,
  ): { ok: true; params: Record<string, unknown> } | { ok: false; error: string } {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return { ok: false, error: `Unknown tool: ${toolName}` };
    }

    const result = tool.parameters.safeParse(params);
    if (!result.success) {
      const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      return { ok: false, error: `Invalid params for ${toolName}: ${issues}` };
    }
    return { ok: true, params: result.data as Record<string, unknown> };
  }

  /**
   * Validate and execute a tool in one step.
   *
   * First validates the raw params against the tool's Zod schema. If validation
   * fails, returns a `{ success: false }` result with the error message. On
   * success, invokes the tool's async executor with parsed params and the
   * provided context.
   *
   * @param toolName  - Name of the registered tool.
   * @param rawParams - Raw parameters from AI model output.
   * @param ctx       - Execution context providing project ID and storage access.
   * @returns The tool's result (success/failure message and optional data).
   */
  async execute(toolName: string, rawParams: unknown, ctx: ToolContext): Promise<ToolResult> {
    const validation = this.validate(toolName, rawParams);
    if (!validation.ok) {
      return { success: false, message: (validation as { ok: false; error: string }).error };
    }

    const tool = this.tools.get(toolName)!;
    const tier = tool.permissionTier ?? (tool.requiresConfirmation ? 'destructive' : 'suggest');
    logger.debug('ai:tool-execute', { name: toolName, tier });

    // Server-side enforcement: destructive tools require explicit user confirmation.
    // If the tool has requiresConfirmation=true and the context doesn't have confirmed=true,
    // reject the execution. The client must re-submit with confirmed=true after user approval.
    if (tool.requiresConfirmation && ctx.confirmed !== true) {
      return {
        success: false,
        message: `This action (${toolName}) requires user confirmation. The client must re-submit with confirmed=true.`,
        data: { requiresConfirmation: true, toolName },
      };
    }

    return tool.execute(validation.params, ctx);
  }
}

// ---------------------------------------------------------------------------
// Stub executor — returns action data for client-side execution.
// In later phases, tools that can run server-side will have real executors.
// ---------------------------------------------------------------------------

/**
 * Create a stub ToolResult that dispatches an action to the client.
 *
 * Many tools cannot execute server-side (they manipulate React state, trigger
 * UI interactions, or require client-only APIs). For these tools, `clientAction`
 * wraps the tool name and params into a `ToolResult.data` payload that the
 * frontend's action executor interprets and applies.
 *
 * @param toolName - The tool name to dispatch (becomes `data.type` on the client).
 * @param params   - The validated parameters, spread into the data payload.
 * @returns A successful ToolResult with `data.type` set to the tool name.
 *
 * @example
 * ```ts
 * // In a tool definition:
 * execute: async (params) => clientAction('auto_layout', params),
 * // Produces: { success: true, message: '...', data: { type: 'auto_layout', layout: 'grid' } }
 * ```
 */
export function clientAction(toolName: string, params: Record<string, unknown>): ToolResult {
  return {
    success: true,
    message: `Action ${toolName} dispatched to client`,
    data: { type: toolName, ...params },
  };
}
