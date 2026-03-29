import type { PartState, PartMeta, ViewData, PartViews } from '@shared/component-types';
import type { ComponentPart } from '@shared/schema';
import type { ComplianceFinding } from '@/lib/standards-compliance';
import { DRC_EXPLANATIONS } from '@shared/drc-engine';

/** Brief explanations for validation rule categories (UX-043: "why this rule matters" tooltips).
 *  DRC_EXPLANATIONS (from shared/drc-engine) provides detailed beginner-friendly text for every
 *  DRC/ERC ruleType. This local map covers high-level validation *categories* used by the
 *  architecture-level validator that don't map 1:1 to DRC rule types.
 */
export const RULE_CATEGORY_EXPLANATIONS: Record<string, string> = {
  connectivity: 'Ensures all nodes are properly connected and no signals are left floating',
  power: 'Verifies power rails, decoupling, and voltage compatibility across the design',
  naming: 'Checks for consistent and unambiguous naming of nets, nodes, and components',
  completeness: 'Validates that the design has all required elements before fabrication',
  clearance: 'Ensures minimum spacing between traces, pads, and copper features',
  annular_ring: 'Checks pad ring width around drill holes meets manufacturing minimums',
  drill: 'Validates drill hole sizes are within fabrication capabilities',
  trace_width: 'Ensures traces can carry required current without overheating',
  silkscreen: 'Checks silkscreen text and graphics meet readability requirements',
  solder_mask: 'Validates solder mask openings and bridges for reliable soldering',
  board_edge: 'Ensures components and copper maintain safe distance from board edges',
  via: 'Checks via sizes and spacing meet manufacturing and signal integrity requirements',
  courtyard: 'Detects component courtyard overlaps that would prevent physical assembly',
  unconnected_pin: 'Flags pins that should be connected but are not wired to any net',
  power_pin_conflict: 'Detects conflicting power connections that could damage components',
  duplicate_refdes: 'Catches duplicate reference designators that cause BOM and assembly errors',
  missing_value: 'Ensures all components have required values (resistance, capacitance, etc.)',
  esd: 'Flags ESD-sensitive components that may need protection circuitry',
};

/** Look up explanation for a ruleType — prefers the detailed DRC_EXPLANATIONS, falls back to
 *  the category-level map, and finally a generic fallback string. */
export function getRuleExplanation(ruleType: string, fallbackPrefix: string): string {
  return DRC_EXPLANATIONS[ruleType] ?? RULE_CATEGORY_EXPLANATIONS[ruleType] ?? `${fallbackPrefix} rule: ${ruleType}`;
}

/** Safely build a PartState from a ComponentPart DB row, providing defaults for nullable JSON fields. */
export function toPartState(part: ComponentPart): PartState {
  const defaultMeta: PartMeta = { title: '', tags: [], mountingType: '', properties: [] };
  const defaultViewData: ViewData = { shapes: [] };
  const defaultViews: PartViews = {
    breadboard: defaultViewData,
    schematic: defaultViewData,
    pcb: defaultViewData,
  };
  return {
    meta: part.meta ? { ...defaultMeta, ...(part.meta as PartMeta) } : defaultMeta,
    connectors: Array.isArray(part.connectors) ? (part.connectors as PartState['connectors']) : [],
    buses: Array.isArray(part.buses) ? (part.buses as PartState['buses']) : [],
    views: part.views ? { ...defaultViews, ...(part.views as PartViews) } : defaultViews,
    constraints: Array.isArray(part.constraints) ? (part.constraints as PartState['constraints']) : undefined,
  };
}

export type ArchIssue = { id: number | string; severity: string; message: string; suggestion?: string; componentId?: string };
export type CompIssue = { id: string; severity: string; message: string; suggestion?: string; componentId: string };
export type ERCIssue = { id: string; severity: string; message: string; ruleType: string };
export type DRCIssue = { id: string; severity: string; message: string; ruleType: string; view: string; componentId: string };
export type VirtualRow =
  | { type: 'arch'; issue: ArchIssue }
  | { type: 'section_header'; count: number }
  | { type: 'drc_header'; count: number }
  | { type: 'drc_rule_header'; ruleType: string; count: number }
  | { type: 'erc_header'; count: number }
  | { type: 'compliance_header'; count: number }
  | { type: 'comp'; issue: CompIssue }
  | { type: 'drc'; issue: DRCIssue }
  | { type: 'erc'; issue: ERCIssue }
  | { type: 'compliance'; issue: ComplianceFinding };
