/**
 * Drag-over and drop handlers for the schematic canvas: placing component
 * instances and power symbols from the sidebar palettes.
 */
import { useCallback } from 'react';
import type { ReactFlowInstance } from '@xyflow/react';
import { generateRefDes } from '@/lib/circuit-editor/ref-des';
import { COMPONENT_DRAG_TYPE } from '../ComponentPlacer';
import type { ComponentDragData } from '../ComponentPlacer';
import { POWER_SYMBOL_DRAG_TYPE } from '../PowerSymbolPalette';
import type { PowerSymbolDragData } from '../PowerSymbolPalette';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { CircuitSettings, PowerSymbol } from '@shared/circuit-types';
import type { Connector, PartMeta } from '@shared/component-types';
import { ToastAction } from '@/components/ui/toast';

// ---------------------------------------------------------------------------
// Mutation ref types
// ---------------------------------------------------------------------------

interface DragDropMutationRefs {
  createInstance: React.RefObject<{ mutate: (args: Record<string, unknown>) => void }>;
  updateDesign: React.RefObject<{ mutate: (args: Record<string, unknown>) => void }>;
  createNet: React.RefObject<{ mutate: (args: Record<string, unknown>) => void }>;
  toast: React.RefObject<(opts: Record<string, unknown>) => void>;
}

interface UseDragDropParams {
  circuitId: number;
  projectId: number;
  instances: CircuitInstanceRow[] | undefined;
  partsMap: Map<number, ComponentPart>;
  settings: CircuitSettings;
  reactFlowInstance: ReactFlowInstance;
  snapEnabled: boolean;
  gridSize: number;
  bom: Array<{ id: number; description: string; partNumber: string; quantity: number }>;
  addBomItem: (item: Record<string, unknown>) => void;
  updateBomItem: (id: number, patch: Record<string, unknown>) => void;
  mutationRefs: DragDropMutationRefs;
}

export function useSchematicDragDrop({
  circuitId,
  projectId,
  instances,
  partsMap,
  settings,
  reactFlowInstance,
  snapEnabled,
  gridSize,
  bom,
  addBomItem,
  updateBomItem,
  mutationRefs,
}: UseDragDropParams) {
  // Accept component and power symbol drops
  const onDragOver = useCallback((e: React.DragEvent) => {
    if (
      e.dataTransfer.types.includes(COMPONENT_DRAG_TYPE) ||
      e.dataTransfer.types.includes(POWER_SYMBOL_DRAG_TYPE)
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      // Helper: snap drop position to grid
      const getDropPosition = () => {
        const pos = reactFlowInstance.screenToFlowPosition({
          x: e.clientX,
          y: e.clientY,
        });
        if (snapEnabled) {
          pos.x = Math.round(pos.x / gridSize) * gridSize;
          pos.y = Math.round(pos.y / gridSize) * gridSize;
        }
        return pos;
      };

      // Component instance drop
      const componentRaw = e.dataTransfer.getData(COMPONENT_DRAG_TYPE);
      if (componentRaw) {
        e.preventDefault();
        let dragData: ComponentDragData;
        try {
          dragData = JSON.parse(componentRaw) as ComponentDragData;
        } catch {
          return;
        }

        const part = partsMap.get(dragData.partId);
        const position = getDropPosition();
        const refDes = generateRefDes(instances, part);
        const partMeta = (part?.meta ?? {}) as Partial<PartMeta>;
        const partTitle = partMeta.title || 'Component';
        const partValueProp = partMeta.properties?.find((p) => p.key === 'value');
        const partValue = partValueProp?.value ?? '';
        const partMpn = partMeta.mpn ?? '';

        mutationRefs.createInstance.current!.mutate({
          circuitId,
          partId: dragData.partId,
          referenceDesignator: refDes,
          schematicX: position.x,
          schematicY: position.y,
        });

        // BL-0498: Offer to add to BOM after placement
        const bomLabel = partValue ? `${refDes} (${partValue})` : refDes;
        const existingBomItem = bom.find(
          (item) => item.description === partTitle && item.partNumber === partMpn,
        );
        if (existingBomItem) {
          mutationRefs.toast.current!({
            title: `Add ${bomLabel} to BOM?`,
            description: `"${partTitle}" already in BOM (qty ${String(existingBomItem.quantity)}). Increment?`,
            action: (
              <ToastAction
                altText="Increment quantity"
                data-testid="bom-increment-action"
                onClick={() => {
                  updateBomItem(existingBomItem.id, { quantity: existingBomItem.quantity + 1 });
                }}
              >
                Increment
              </ToastAction>
            ),
          });
        } else {
          mutationRefs.toast.current!({
            title: `Add ${bomLabel} to BOM?`,
            description: `Place "${partTitle}" in your bill of materials.`,
            action: (
              <ToastAction
                altText="Add to BOM"
                data-testid="bom-add-action"
                onClick={() => {
                  addBomItem({
                    partNumber: partMpn,
                    manufacturer: partMeta.manufacturer || '',
                    description: partTitle,
                    quantity: 1,
                    unitPrice: 0,
                    totalPrice: 0,
                    supplier: 'Unknown',
                    stock: 0,
                    status: 'In Stock',
                  });
                }}
              >
                Add to BOM
              </ToastAction>
            ),
          });
        }
        return;
      }

      // Power symbol drop
      const powerRaw = e.dataTransfer.getData(POWER_SYMBOL_DRAG_TYPE);
      if (powerRaw) {
        e.preventDefault();
        let dragData: PowerSymbolDragData;
        try {
          dragData = JSON.parse(powerRaw) as PowerSymbolDragData;
        } catch {
          return;
        }

        const position = getDropPosition();
        const newSymbol: PowerSymbol = {
          id: crypto.randomUUID(),
          type: dragData.symbolType,
          netName: dragData.netName,
          x: position.x,
          y: position.y,
          rotation: 0,
          customLabel: dragData.customLabel,
        };

        const currentSymbols = settings.powerSymbols ?? [];
        mutationRefs.updateDesign.current!.mutate({
          projectId,
          id: circuitId,
          settings: { ...settings, powerSymbols: [...currentSymbols, newSymbol] },
        });

        // BL-0493: Auto-connect — find compatible pins within snap distance
        const SNAP_DISTANCE = gridSize * 3;
        const isGround = /gnd|ground|vss|v\-/i.test(dragData.netName);
        const isPower = /vcc|vdd|vpp|v\+|power/i.test(dragData.netName);

        if ((isGround || isPower) && instances) {
          const compatiblePins: Array<{ instanceId: number; pinId: string; refDes: string }> = [];

          for (const inst of instances) {
            const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
            if (!part) { continue; }
            const connectors = (part.connectors ?? []) as Connector[];
            const instX = inst.schematicX;
            const instY = inst.schematicY;

            for (const conn of connectors) {
              const pinNameMatch = isGround
                ? /gnd|ground|vss|v\-/i.test(conn.name)
                : /vcc|vdd|vpp|v\+|power/i.test(conn.name);
              if (!pinNameMatch) { continue; }

              // Compute actual pin world position using terminal offset from instance origin
              const terminal = conn.terminalPositions?.schematic;
              const pinX = instX + (terminal?.x ?? 0);
              const pinY = instY + (terminal?.y ?? 0);
              const dx = Math.abs(position.x - pinX);
              const dy = Math.abs(position.y - pinY);
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist <= SNAP_DISTANCE) {
                compatiblePins.push({ instanceId: inst.id, pinId: conn.id, refDes: inst.referenceDesignator });
              }
            }
          }

          // Create nets connecting pairs of compatible pins to the power net
          if (compatiblePins.length >= 2) {
            for (let i = 1; i < compatiblePins.length; i++) {
              const from = compatiblePins[i - 1];
              const to = compatiblePins[i];
              mutationRefs.createNet.current!.mutate({
                circuitId,
                name: dragData.netName,
                netType: isGround ? 'ground' : 'power',
                segments: [{
                  fromInstanceId: from.instanceId,
                  fromPin: from.pinId,
                  toInstanceId: to.instanceId,
                  toPin: to.pinId,
                }],
              });
            }
            mutationRefs.toast.current!({
              title: 'Auto-connected power pins',
              description: `Connected ${String(compatiblePins.length)} pins to ${dragData.netName}.`,
            });
          } else if (compatiblePins.length === 1) {
            mutationRefs.toast.current!({
              title: 'Power pin detected',
              description: `${compatiblePins[0].refDes} has a compatible ${dragData.netName} pin nearby.`,
            });
          }
        }
      }
    },
    [circuitId, projectId, instances, partsMap, settings, reactFlowInstance, snapEnabled, gridSize, bom, addBomItem, updateBomItem, mutationRefs],
  );

  return { onDragOver, onDrop };
}
