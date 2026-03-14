/**
 * Import Preview Engine
 *
 * Generates a diff summary before applying an imported design, showing
 * what will be added, modified, or removed so the user can make an
 * informed decision before committing.
 */

import type { ImportedDesign } from '@/lib/design-import';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportPreview {
  /** Number of architecture nodes that will be added. */
  addedNodes: number;
  /** Number of existing nodes that match by label and would be updated. */
  modifiedNodes: number;
  /** Number of existing nodes not present in the import (informational). */
  removedNodes: number;
  /** Number of edges that will be added. */
  addedEdges: number;
  /** Number of BOM line items that will be added. */
  addedComponents: number;
  /** Number of nets that will be added. */
  addedNets: number;
  /** Number of wires that will be added. */
  addedWires: number;
  /** Non-fatal observations about the import. */
  warnings: string[];
  /** Potential data-loss or ambiguity issues that deserve attention. */
  conflicts: string[];
}

/**
 * Minimal representation of the current project state used for comparison.
 * Intentionally kept loose so it can be constructed from any source
 * (architecture context, API response, etc.).
 */
export interface ProjectData {
  nodes: Array<{ id: string; data?: { label?: string; type?: string } }>;
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
  bomItems: Array<{ partNumber?: string; description?: string }>;
}

// ---------------------------------------------------------------------------
// Preview generation
// ---------------------------------------------------------------------------

/**
 * Compare an imported design against the current project state and produce
 * a preview of what will change when the import is applied.
 */
export function generateImportPreview(
  importData: ImportedDesign,
  existingData: ProjectData,
): ImportPreview {
  const warnings: string[] = [];
  const conflicts: string[] = [];

  // --- Nodes ---
  // Build label set from existing project nodes for matching.
  const existingNodeLabels = new Set<string>();
  for (const n of existingData.nodes) {
    const label = n.data?.label;
    if (label) {
      existingNodeLabels.add(label.toLowerCase());
    }
  }

  // Each imported component becomes a node.
  let addedNodes = 0;
  let modifiedNodes = 0;

  for (const comp of importData.components) {
    const label = comp.refDes
      ? `${comp.refDes} - ${comp.name}`.toLowerCase()
      : comp.name.toLowerCase();

    if (existingNodeLabels.has(label)) {
      modifiedNodes++;
    } else {
      addedNodes++;
    }
  }

  // Nodes in the project but not in the import — informational only since
  // the current import flow appends rather than replaces.
  const importedLabelSet = new Set<string>();
  for (const comp of importData.components) {
    const label = comp.refDes
      ? `${comp.refDes} - ${comp.name}`.toLowerCase()
      : comp.name.toLowerCase();
    importedLabelSet.add(label);
  }

  let removedNodes = 0;
  for (const label of existingNodeLabels) {
    if (!importedLabelSet.has(label)) {
      removedNodes++;
    }
  }

  // --- Edges ---
  // Each net with 2+ pins produces consecutive edges.
  let addedEdges = 0;
  for (const net of importData.nets) {
    if (net.pins.length >= 2) {
      addedEdges += net.pins.length - 1;
    }
  }

  // --- BOM ---
  // Aggregate by name|package (matches convertToProtoPulse logic).
  const bomKeys = new Set<string>();
  for (const comp of importData.components) {
    const key = `${comp.name}|${comp.package}`;
    bomKeys.add(key);
  }
  const addedComponents = bomKeys.size;

  // --- Nets & wires ---
  const addedNets = importData.nets.length;
  const addedWires = importData.wires.length;

  // --- Warnings ---
  if (importData.warnings.length > 0) {
    for (const w of importData.warnings) {
      warnings.push(w);
    }
  }

  if (importData.components.length === 0) {
    warnings.push('Import contains no components');
  }

  if (importData.nets.length === 0 && importData.components.length > 0) {
    warnings.push('No nets found — components will be unconnected');
  }

  // Check for unsupported features in metadata.
  const unsupportedFeatures = importData.metadata['unsupported_features'];
  if (unsupportedFeatures) {
    warnings.push(`Unsupported features: ${unsupportedFeatures}`);
  }

  // --- Conflicts ---
  if (importData.errors.length > 0) {
    for (const e of importData.errors) {
      conflicts.push(e);
    }
  }

  // Duplicate ref designators within the import itself.
  const refDesSeen = new Set<string>();
  for (const comp of importData.components) {
    if (comp.refDes) {
      if (refDesSeen.has(comp.refDes)) {
        conflicts.push(`Duplicate reference designator in import: ${comp.refDes}`);
      }
      refDesSeen.add(comp.refDes);
    }
  }

  // Name collisions with existing BOM.
  const existingPartNumbers = new Set<string>();
  for (const item of existingData.bomItems) {
    if (item.partNumber) {
      existingPartNumbers.add(item.partNumber.toLowerCase());
    }
  }

  for (const comp of importData.components) {
    const pn = comp.properties.MPN ?? comp.properties.PartNumber ?? comp.refDes;
    if (pn && existingPartNumbers.has(pn.toLowerCase())) {
      conflicts.push(`Part number already in BOM: ${pn}`);
    }
  }

  // Label collisions (nodes that would become duplicates).
  if (modifiedNodes > 0) {
    conflicts.push(
      `${String(modifiedNodes)} node(s) share a label with existing nodes`,
    );
  }

  return {
    addedNodes,
    modifiedNodes,
    removedNodes,
    addedEdges,
    addedComponents,
    addedNets,
    addedWires,
    warnings,
    conflicts,
  };
}

// ---------------------------------------------------------------------------
// Summary formatting
// ---------------------------------------------------------------------------

/**
 * Produce a concise human-readable summary of an import preview.
 */
export function formatPreviewSummary(preview: ImportPreview): string {
  const parts: string[] = [];

  if (preview.addedNodes > 0) {
    parts.push(`+${String(preview.addedNodes)} node(s)`);
  }
  if (preview.modifiedNodes > 0) {
    parts.push(`~${String(preview.modifiedNodes)} modified node(s)`);
  }
  if (preview.removedNodes > 0) {
    parts.push(`-${String(preview.removedNodes)} orphaned node(s)`);
  }
  if (preview.addedEdges > 0) {
    parts.push(`+${String(preview.addedEdges)} edge(s)`);
  }
  if (preview.addedComponents > 0) {
    parts.push(`+${String(preview.addedComponents)} BOM item(s)`);
  }
  if (preview.addedNets > 0) {
    parts.push(`+${String(preview.addedNets)} net(s)`);
  }
  if (preview.addedWires > 0) {
    parts.push(`+${String(preview.addedWires)} wire(s)`);
  }

  if (parts.length === 0) {
    return 'No changes detected.';
  }

  let summary = parts.join(', ');

  if (preview.warnings.length > 0) {
    summary += ` | ${String(preview.warnings.length)} warning(s)`;
  }
  if (preview.conflicts.length > 0) {
    summary += ` | ${String(preview.conflicts.length)} conflict(s)`;
  }

  return summary;
}
