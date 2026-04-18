/**
 * Shared helpers and types for circuit tool modules.
 *
 * @module ai-tools/circuit/shared
 */

import type { ToolContext, ToolResult } from '../types';

/**
 * Verify a caller-supplied circuit ID belongs to the active project context.
 *
 * Returns `null` when the circuit is valid. Returns a failure {@link ToolResult}
 * to be returned directly from the tool when the circuit doesn't exist or
 * belongs to another project. Message is intentionally identical for both
 * cases so cross-project existence is not leaked (same enumeration-protection
 * policy as `requireCircuitOwnership`).
 *
 * SECURITY (WS-01, BE-06 audit P0 #1): Without this guard, any AI tool call
 * that accepts `circuitId` as a parameter can read/mutate circuit data from
 * a different project by supplying an ID.
 */
export async function guardCircuitInProject(
  circuitId: number,
  ctx: ToolContext,
): Promise<ToolResult | null> {
  const design = await ctx.storage.getCircuitDesign(circuitId);
  if (!design || design.projectId !== ctx.projectId) {
    return {
      success: false,
      message: `Circuit ${String(circuitId)} not found in this project.`,
    };
  }
  return null;
}

/** Shape of a connector entry stored in component_parts.connectors JSONB. */
export interface ConnectorRecord {
  id?: string | number;
  name?: string;
  offsetX?: number;
  offsetY?: number;
  padWidth?: number;
  padHeight?: number;
  padType?: string;
}

/** Shape of a net segment stored in circuit_nets.segments JSONB. */
export interface NetSegmentRecord {
  fromInstanceId?: number;
  toInstanceId?: number;
  fromPin?: string;
  toPin?: string;
}
