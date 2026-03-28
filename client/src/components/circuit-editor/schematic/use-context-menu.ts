/**
 * Context menu action handlers for the schematic canvas.
 */
import { useCallback } from 'react';
import type { ReactFlowInstance, Node } from '@xyflow/react';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { CircuitSettings, PowerSymbol, SchematicTool } from '@shared/circuit-types';
import type { Connector } from '@shared/component-types';
import type { CreateInstanceMutation, UpdateDesignMutation, CreateNetMutation, ToastFn } from './types';

// ---------------------------------------------------------------------------
// Mutation ref types
// ---------------------------------------------------------------------------

interface ContextMenuMutationRefs {
  createInstance: React.RefObject<CreateInstanceMutation>;
  updateDesign: React.RefObject<UpdateDesignMutation>;
  createNet: React.RefObject<CreateNetMutation>;
  toast: React.RefObject<ToastFn>;
}

interface UseContextMenuParams {
  circuitId: number;
  projectId: number;
  instances: CircuitInstanceRow[] | undefined;
  partsMap: Map<number, ComponentPart>;
  settings: CircuitSettings;
  reactFlowInstance: ReactFlowInstance;
  snapEnabled: boolean;
  gridSize: number;
  setActiveTool: React.Dispatch<React.SetStateAction<SchematicTool>>;
  setLocalNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  setReplacementInstance: React.Dispatch<React.SetStateAction<CircuitInstanceRow | null>>;
  setReplacementPart: React.Dispatch<React.SetStateAction<ComponentPart | null>>;
  setIsReplacementOpen: React.Dispatch<React.SetStateAction<boolean>>;
  pushUndoState: () => void;
  mutationRefs: ContextMenuMutationRefs;
}

export function useSchematicContextMenu({
  circuitId,
  projectId,
  instances,
  partsMap,
  settings,
  reactFlowInstance,
  snapEnabled,
  gridSize,
  setActiveTool,
  setLocalNodes,
  setReplacementInstance,
  setReplacementPart,
  setIsReplacementOpen,
  pushUndoState,
  mutationRefs,
}: UseContextMenuParams) {
  const handleCtxAddComponent = useCallback(() => {
    window.dispatchEvent(new CustomEvent('protopulse:focus-component-search'));
  }, []);

  const handleCtxAddWire = useCallback(() => {
    setActiveTool('draw-net');
  }, [setActiveTool]);

  const handleCtxAddPower = useCallback(() => {
    const pos = reactFlowInstance.screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const snapped = snapEnabled
      ? { x: Math.round(pos.x / gridSize) * gridSize, y: Math.round(pos.y / gridSize) * gridSize }
      : pos;
    const newSymbol: PowerSymbol = {
      id: crypto.randomUUID(),
      type: 'VCC',
      netName: 'VCC',
      x: snapped.x,
      y: snapped.y,
      rotation: 0,
    };
    const currentSymbols = settings.powerSymbols ?? [];
    mutationRefs.updateDesign.current!.mutate({
      projectId,
      id: circuitId,
      settings: { ...settings, powerSymbols: [...currentSymbols, newSymbol] },
    });
  }, [reactFlowInstance, snapEnabled, gridSize, settings, projectId, circuitId, mutationRefs]);

  const handleCtxSelectAll = useCallback(() => {
    setLocalNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }, [setLocalNodes]);

  const handleCtxReplaceComponent = useCallback(() => {
    const selected = reactFlowInstance.getNodes().filter(n => n.selected);
    if (selected.length === 1 && selected[0].type === 'schematic-instance') {
      const instId = Number(selected[0].id.replace('instance-', ''));
      const inst = instances?.find(i => i.id === instId);
      if (inst) {
        setReplacementInstance(inst);
        setReplacementPart(partsMap.get(inst.partId!) || null);
        setIsReplacementOpen(true);
      }
    }
  }, [reactFlowInstance, instances, partsMap, setReplacementInstance, setReplacementPart, setIsReplacementOpen]);

  const handleCtxAddDecoupling = useCallback(() => {
    const selected = reactFlowInstance.getNodes().filter(n => n.selected);
    if (selected.length !== 1 || selected[0].type !== 'schematic-instance') { return; }

    const instId = Number(selected[0].id.replace('instance-', ''));
    const inst = instances?.find(i => i.id === instId);
    if (!inst) { return; }

    const part = partsMap.get(inst.partId!);
    if (!part) { return; }

    const connectors = (part.connectors ?? []) as Connector[];
    const vccPins = connectors.filter(c => /vcc|vdd|vpp|v\+|power/i.test(c.name));
    const gndPins = connectors.filter(c => /gnd|ground|vss|v\-/i.test(c.name));

    if (vccPins.length === 0 || gndPins.length === 0) {
      mutationRefs.toast.current!({
        title: 'No power pins found',
        description: `Could not identify power/ground pins for ${inst.referenceDesignator}.`,
        variant: 'destructive',
      });
      return;
    }

    pushUndoState();

    const caps = [
      { value: '100nF', dx: 150, dy: -100 },
      { value: '10uF', dx: 150, dy: 100 }
    ];

    const createPromises = caps.map(async (cap, i) => {
      const cInstance = await mutationRefs.createInstance.current!.mutateAsync({
        circuitId,
        partId: null,
        referenceDesignator: `C_DEC${i + 1}`,
        schematicX: (inst.schematicX || 0) + cap.dx,
        schematicY: (inst.schematicY || 0) + cap.dy,
        properties: { type: 'capacitor', value: cap.value },
      });

      const vccPin = vccPins[0].id;
      const gndPin = gndPins[0].id;

      await mutationRefs.createNet.current!.mutateAsync({
        circuitId,
        name: `VCC_DEC_${inst.referenceDesignator}`,
        netType: 'power',
        segments: [{
          fromInstanceId: cInstance.id,
          fromPin: '1',
          toInstanceId: inst.id,
          toPin: vccPin
        }]
      });

      await mutationRefs.createNet.current!.mutateAsync({
        circuitId,
        name: `GND_DEC_${inst.referenceDesignator}`,
        netType: 'ground',
        segments: [{
          fromInstanceId: cInstance.id,
          fromPin: '2',
          toInstanceId: inst.id,
          toPin: gndPin
        }]
      });
    });

    Promise.all(createPromises).then(() => {
      mutationRefs.toast.current!({
        title: 'Decoupling added',
        description: `Added 100nF and 10uF capacitors to ${inst.referenceDesignator}.`,
      });
    }).catch(err => {
      console.error('Failed to add decoupling:', err);
      mutationRefs.toast.current!({ title: 'Error', description: 'Failed to add decoupling capacitors.', variant: 'destructive' });
    });

  }, [reactFlowInstance, instances, partsMap, circuitId, pushUndoState, mutationRefs]);

  const handleCtxRunErc = useCallback(() => {
    window.dispatchEvent(new CustomEvent('protopulse:run-erc'));
  }, []);

  return {
    handleCtxAddComponent,
    handleCtxAddWire,
    handleCtxAddPower,
    handleCtxSelectAll,
    handleCtxReplaceComponent,
    handleCtxAddDecoupling,
    handleCtxRunErc,
  };
}
