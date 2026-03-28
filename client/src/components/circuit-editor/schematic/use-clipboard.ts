/**
 * Clipboard operations for the schematic canvas: copy selected elements and
 * paste bundles (from internal ref or system clipboard).
 */
import { useCallback, useRef } from 'react';
import type { ReactFlowInstance, Node } from '@xyflow/react';
import { generateRefDes } from '@/lib/circuit-editor/ref-des';
import type { InstanceNodeData } from '../SchematicInstanceNode';
import type { PowerNodeData } from '../SchematicPowerNode';
import type { NetLabelNodeData } from '../SchematicNetLabelNode';
import type { NoConnectNodeData } from '../SchematicNoConnectNode';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import type { CircuitSettings, PowerSymbol, SchematicNetLabel, NoConnectMarker } from '@shared/circuit-types';
import type {
  SchematicClipboardBundle,
  ClipboardNetSegment,
  NetSegmentJSON,
} from './converters';

// ---------------------------------------------------------------------------
// Mutation ref types — mirrors the ref pattern used in the parent component
// ---------------------------------------------------------------------------

interface MutationRefs {
  createInstance: React.RefObject<{ mutateAsync: (args: Record<string, unknown>) => Promise<{ id: number }> }>;
  updateDesign: React.RefObject<{ mutate: (args: Record<string, unknown>) => void; mutateAsync: (args: Record<string, unknown>) => Promise<unknown> }>;
  createNet: React.RefObject<{ mutateAsync: (args: Record<string, unknown>) => Promise<unknown> }>;
  toast: React.RefObject<(opts: Record<string, unknown>) => void>;
}

interface UseClipboardParams {
  circuitId: number;
  projectId: number;
  instances: CircuitInstanceRow[] | undefined;
  nets: CircuitNetRow[] | undefined;
  partsMap: Map<number, ComponentPart>;
  settings: CircuitSettings;
  localNodes: Node[];
  reactFlowInstance: ReactFlowInstance;
  mutationRefs: MutationRefs;
}

export function useSchematicClipboard({
  circuitId,
  projectId,
  instances,
  nets,
  partsMap,
  settings,
  localNodes,
  reactFlowInstance,
  mutationRefs,
}: UseClipboardParams) {
  const clipboardRef = useRef<SchematicClipboardBundle | null>(null);

  // ------------------------------------------------------------------
  // Paste
  // ------------------------------------------------------------------
  const handlePaste = useCallback(async (bundle: SchematicClipboardBundle) => {
    if (!bundle || bundle.type !== 'protopulse-schematic-bundle') { return; }

    const center = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });

    const insts = bundle.instances || [];
    const pwr = bundle.powerSymbols || [];
    const lbl = bundle.netLabels || [];
    const ncm = bundle.noConnectMarkers || [];

    if (insts.length === 0 && pwr.length === 0 && lbl.length === 0 && ncm.length === 0) { return; }

    const allX = [...insts.map((i) => i.schematicX), ...pwr.map((p) => p.x)];
    const allY = [...insts.map((i) => i.schematicY), ...pwr.map((p) => p.y)];
    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const minY = Math.min(...allY);
    const maxY = Math.max(...allY);
    const bboxCenterX = (minX + maxX) / 2;
    const bboxCenterY = (minY + maxY) / 2;

    const offsetX = center.x - bboxCenterX;
    const offsetY = center.y - bboxCenterY;

    const idMap = new Map<number, number>();
    const usedRefDes = new Set((instances ?? []).map(i => i.referenceDesignator));

    try {
      // 1. Create instances
      for (const inst of insts) {
        const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
        const refDes = generateRefDes(instances, part);
        let uniqueRefDes = refDes;
        let suffix = 1;
        while (usedRefDes.has(uniqueRefDes)) {
          const prefix = uniqueRefDes.replace(/\d+$/, '');
          const match = uniqueRefDes.match(/\d+$/);
          const num = match ? parseInt(match[0], 10) : 0;
          uniqueRefDes = `${prefix}${num + suffix}`;
          suffix++;
        }
        usedRefDes.add(uniqueRefDes);

        const newInst = await mutationRefs.createInstance.current!.mutateAsync({
          circuitId,
          partId: inst.partId,
          referenceDesignator: uniqueRefDes,
          schematicX: inst.schematicX + offsetX,
          schematicY: inst.schematicY + offsetY,
          schematicRotation: inst.schematicRotation,
          properties: inst.properties as Record<string, string> | undefined,
        });
        idMap.set(inst.oldId, newInst.id);
      }

      // 2. Create nets
      for (const net of (bundle.nets || [])) {
        const newSegments = net.segments.map((seg: ClipboardNetSegment) => ({
          ...seg,
          fromInstanceId: idMap.get(seg.fromInstanceId),
          toInstanceId: idMap.get(seg.toInstanceId),
        })).filter((s) => s.fromInstanceId && s.toInstanceId);

        if (newSegments.length > 0) {
          await mutationRefs.createNet.current!.mutateAsync({
            circuitId,
            name: `${net.name}_copy`,
            netType: net.netType as 'signal' | 'power' | 'ground' | 'bus' | undefined,
            segments: newSegments,
            style: net.style,
          });
        }
      }

      // 3. Annotations (power symbols, net labels, no-connect markers)
      const newPowerSymbols = pwr.map((ps) => ({
        ...ps,
        id: crypto.randomUUID(),
        x: ps.x + offsetX,
        y: ps.y + offsetY,
      }));

      const newNetLabels = lbl.map((nl) => ({
        ...nl,
        id: crypto.randomUUID(),
        x: nl.x + offsetX,
        y: nl.y + offsetY,
      }));

      const newNoConnectMarkers = ncm.map((nc) => ({
        ...nc,
        id: crypto.randomUUID(),
        x: nc.x + offsetX,
        y: nc.y + offsetY,
      }));

      if (newPowerSymbols.length > 0 || newNetLabels.length > 0 || newNoConnectMarkers.length > 0) {
        await mutationRefs.updateDesign.current!.mutateAsync({
          projectId,
          id: circuitId,
          settings: {
            ...settings,
            powerSymbols: [...(settings.powerSymbols ?? []), ...newPowerSymbols],
            netLabels: [...(settings.netLabels ?? []), ...newNetLabels],
            noConnectMarkers: [...(settings.noConnectMarkers ?? []), ...newNoConnectMarkers],
          }
        });
      }

      mutationRefs.toast.current!({
        title: 'Pasted successfully',
        description: `Added ${insts.length} components and ${bundle.nets?.length || 0} nets.`,
      });
    } catch (err) {
      console.error('Paste failed', err);
      mutationRefs.toast.current!({
        variant: 'destructive',
        title: 'Paste failed',
        description: 'An error occurred while pasting schematic elements.',
      });
    }
  }, [circuitId, projectId, instances, partsMap, settings, reactFlowInstance, mutationRefs]);

  // ------------------------------------------------------------------
  // Copy
  // ------------------------------------------------------------------
  const handleCopy = useCallback(async () => {
    const selectedNodes = localNodes.filter(n => n.selected);
    if (selectedNodes.length === 0) { return false; }

    const selectedInstanceIds = new Set(
      selectedNodes
        .filter(n => n.type === 'schematic-instance')
        .map(n => (n.data as InstanceNodeData).instanceId)
    );

    const bundle: SchematicClipboardBundle = {
      type: 'protopulse-schematic-bundle',
      instances: (instances ?? [])
        .filter(inst => selectedInstanceIds.has(inst.id))
        .map(inst => ({
          partId: inst.partId,
          referenceDesignator: inst.referenceDesignator,
          schematicX: inst.schematicX,
          schematicY: inst.schematicY,
          schematicRotation: inst.schematicRotation,
          properties: inst.properties,
          oldId: inst.id
        })),
      powerSymbols: selectedNodes
        .filter(n => n.type === 'schematic-power')
        .map(n => {
          const d = n.data as PowerNodeData;
          return (settings.powerSymbols ?? []).find(ps => ps.id === d.symbolId);
        })
        .filter((ps): ps is PowerSymbol => ps != null),
      netLabels: selectedNodes
        .filter(n => n.type === 'schematic-net-label')
        .map(n => {
          const d = n.data as NetLabelNodeData;
          return (settings.netLabels ?? []).find(nl => nl.id === d.labelId);
        })
        .filter((nl): nl is SchematicNetLabel => nl != null),
      noConnectMarkers: selectedNodes
        .filter(n => n.type === 'schematic-no-connect')
        .map(n => {
          const d = n.data as NoConnectNodeData;
          return (settings.noConnectMarkers ?? []).find(nc => nc.id === d.markerId);
        })
        .filter((nc): nc is NoConnectMarker => nc != null),
      nets: (nets ?? [])
        .filter(net => {
          const segments = (net.segments ?? []) as NetSegmentJSON[];
          return segments.some(seg =>
            selectedInstanceIds.has(seg.fromInstanceId) &&
            selectedInstanceIds.has(seg.toInstanceId)
          );
        })
        .map(net => ({
          name: net.name,
          netType: net.netType,
          style: net.style,
          segments: ((net.segments ?? []) as NetSegmentJSON[]).filter((seg) =>
            selectedInstanceIds.has(seg.fromInstanceId) &&
            selectedInstanceIds.has(seg.toInstanceId)
          )
        }))
    };

    clipboardRef.current = bundle;
    try {
      await navigator.clipboard.writeText(JSON.stringify(bundle, null, 2));
      mutationRefs.toast.current!({
        title: 'Copied to clipboard',
        description: `Copied ${bundle.instances.length} components and ${bundle.nets.length} nets.`,
      });
    } catch (err) {
      console.error('Copy failed', err);
    }
    return true;
  }, [localNodes, instances, nets, settings, mutationRefs]);

  // ------------------------------------------------------------------
  // Trigger paste (from internal ref or system clipboard)
  // ------------------------------------------------------------------
  const triggerPaste = useCallback(async () => {
    let bundle = clipboardRef.current;
    if (!bundle) {
      try {
        const text = await navigator.clipboard.readText();
        const parsed = JSON.parse(text) as unknown;
        if (parsed && typeof parsed === 'object' && 'type' in parsed && (parsed as SchematicClipboardBundle).type === 'protopulse-schematic-bundle') {
          bundle = parsed as SchematicClipboardBundle;
        }
      } catch {
        // Not a valid bundle in clipboard
      }
    }

    if (bundle) {
      void handlePaste(bundle);
    }
  }, [handlePaste]);

  return { clipboardRef, handlePaste, handleCopy, triggerPaste };
}
