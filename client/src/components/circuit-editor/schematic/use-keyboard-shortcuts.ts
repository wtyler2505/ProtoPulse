/**
 * Keyboard shortcuts and custom-event listeners for the schematic canvas.
 */
import { useCallback, useEffect } from 'react';
import type { ReactFlowInstance, Node } from '@xyflow/react';
import type { CircuitInstanceRow, ComponentPart } from '@shared/schema';
import type { CircuitNetRow } from '@shared/schema';
import type { CircuitSettings, PowerSymbol, SchematicTool } from '@shared/circuit-types';
import type { InstanceNodeData } from '../SchematicInstanceNode';
import type { PowerNodeData } from '../SchematicPowerNode';
import type { NetLabelNodeData } from '../SchematicNetLabelNode';
import type { NoConnectNodeData } from '../SchematicNoConnectNode';
import type { AnnotationNodeData } from '../SchematicAnnotationNode';
import type { SchematicClipboardBundle, NetSegmentJSON } from './converters';
import { getToolChangeAnnouncement } from '@/lib/canvas-accessibility';
import type { UpdateDesignMutation, UpdateInstanceMutation, CreateInstanceMutation } from './types';

// ---------------------------------------------------------------------------
// Mutation ref types
// ---------------------------------------------------------------------------

interface KeyboardMutationRefs {
  updateDesign: React.RefObject<UpdateDesignMutation>;
  updateInstance: React.RefObject<UpdateInstanceMutation>;
  createInstance: React.RefObject<CreateInstanceMutation>;
}

interface UseKeyboardShortcutsParams {
  circuitId: number;
  projectId: number;
  instances: CircuitInstanceRow[] | undefined;
  nets: CircuitNetRow[] | undefined;
  partsMap: Map<number, ComponentPart>;
  settings: CircuitSettings;
  localNodes: Node[];
  setLocalNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  activeTool: SchematicTool;
  setActiveTool: React.Dispatch<React.SetStateAction<SchematicTool>>;
  setSnapEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  snapEnabled: boolean;
  gridSize: number;
  reactFlowInstance: ReactFlowInstance;
  handleFitView: () => void;
  handleCopy: () => Promise<boolean>;
  handlePaste: (bundle: SchematicClipboardBundle) => Promise<void>;
  announce: (message: string) => void;
  mutationRefs: KeyboardMutationRefs;
}

export function useSchematicKeyboardShortcuts({
  circuitId,
  projectId,
  instances,
  nets,
  settings,
  localNodes,
  setLocalNodes,
  setActiveTool,
  setSnapEnabled,
  snapEnabled,
  gridSize,
  reactFlowInstance,
  handleFitView,
  handleCopy,
  handlePaste,
  announce,
  mutationRefs,
}: UseKeyboardShortcutsParams) {
  // Keyboard shortcuts (only for implemented tools)
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+C — copy selected instances, nets, and annotations
      if (modKey && e.key.toLowerCase() === 'c' && !e.shiftKey) {
        const hasSelection = localNodes.some(n => n.selected);
        if (!hasSelection) { return; }
        e.preventDefault();
        await handleCopy();
        return;
      }

      // Ctrl+V — paste from internal or system clipboard
      if (modKey && e.key.toLowerCase() === 'v' && !e.shiftKey) {
        let bundle: SchematicClipboardBundle | null = null;
        try {
          const text = await navigator.clipboard.readText();
          const parsed = JSON.parse(text) as unknown;
          if (parsed && typeof parsed === 'object' && 'type' in parsed && (parsed as SchematicClipboardBundle).type === 'protopulse-schematic-bundle') {
            bundle = parsed as SchematicClipboardBundle;
          }
        } catch {
          // Not a valid bundle in clipboard
        }

        if (bundle) {
          e.preventDefault();
          void handlePaste(bundle);
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'v':
          setActiveTool('select');
          announce(getToolChangeAnnouncement('select', 'schematic'));
          break;
        case 'h':
          setActiveTool('pan');
          announce(getToolChangeAnnouncement('pan', 'schematic'));
          break;
        case 'w':
          setActiveTool('draw-net');
          announce(getToolChangeAnnouncement('draw-net', 'schematic'));
          break;
        case 't':
          setActiveTool('place-annotation');
          announce(getToolChangeAnnouncement('place-annotation', 'schematic'));
          break;
        case 'g':
          setSnapEnabled((s) => !s);
          break;
        case 'f':
          handleFitView();
          break;
        case 'escape':
          setActiveTool('select');
          announce(getToolChangeAnnouncement('select', 'schematic'));
          break;
        case 'arrowup':
        case 'arrowdown':
        case 'arrowleft':
        case 'arrowright': {
          const selectedNodes = localNodes.filter(n => n.selected);
          if (selectedNodes.length === 0) { break; }
          e.preventDefault();
          const dx = e.key.toLowerCase() === 'arrowleft' ? -10 : e.key.toLowerCase() === 'arrowright' ? 10 : 0;
          const dy = e.key.toLowerCase() === 'arrowup' ? -10 : e.key.toLowerCase() === 'arrowdown' ? 10 : 0;

          // Optimistically update UI
          setLocalNodes(nodes => nodes.map(n => {
            if (n.selected) {
              return { ...n, position: { x: n.position.x + dx, y: n.position.y + dy } };
            }
            return n;
          }));

          // Persist
          selectedNodes.forEach(node => {
            const newPos = { x: node.position.x + dx, y: node.position.y + dy };
            if (node.id.startsWith('power-')) {
              const symbolId = (node.data as PowerNodeData | undefined)?.symbolId;
              if (symbolId) {
                const updated = (settings.powerSymbols ?? []).map(ps => ps.id === symbolId ? { ...ps, ...newPos } : ps);
                mutationRefs.updateDesign.current!.mutate({ projectId, id: circuitId, settings: { ...settings, powerSymbols: updated } });
              }
            } else if (node.id.startsWith('netlabel-')) {
              const labelId = (node.data as NetLabelNodeData | undefined)?.labelId;
              if (labelId) {
                const updated = (settings.netLabels ?? []).map(nl => nl.id === labelId ? { ...nl, ...newPos } : nl);
                mutationRefs.updateDesign.current!.mutate({ projectId, id: circuitId, settings: { ...settings, netLabels: updated } });
              }
            } else if (node.id.startsWith('noconnect-')) {
              const markerId = (node.data as NoConnectNodeData | undefined)?.markerId;
              if (markerId) {
                const updated = (settings.noConnectMarkers ?? []).map(nc => nc.id === markerId ? { ...nc, ...newPos } : nc);
                mutationRefs.updateDesign.current!.mutate({ projectId, id: circuitId, settings: { ...settings, noConnectMarkers: updated } });
              }
            } else if (node.id.startsWith('annotation-')) {
              const annotationId = (node.data as AnnotationNodeData | undefined)?.annotationId;
              if (annotationId) {
                const updated = (settings.annotations ?? []).map(a => a.id === annotationId ? { ...a, ...newPos } : a);
                mutationRefs.updateDesign.current!.mutate({ projectId, id: circuitId, settings: { ...settings, annotations: updated } });
              }
            } else {
              const instanceId = (node.data as InstanceNodeData | undefined)?.instanceId;
              if (typeof instanceId === 'number') {
                mutationRefs.updateInstance.current!.mutate({ circuitId, id: instanceId, schematicX: newPos.x, schematicY: newPos.y });
              }
            }
          });
          break;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFitView, localNodes, instances, nets, settings, handlePaste, handleCopy, setActiveTool, setSnapEnabled, setLocalNodes, announce, circuitId, projectId, mutationRefs]);

  // Listen for unified component search "Place on schematic" actions
  useEffect(() => {
    const handlePlaceComponent = (e: Event) => {
      const customEvent = e as CustomEvent<{ partId?: number; isPower?: boolean; type?: 'VCC' | 'GND'; refDesPrefix?: string }>;
      if (!customEvent.detail) { return; }

      const pos = reactFlowInstance.screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
      });
      const snapped = snapEnabled
        ? { x: Math.round(pos.x / gridSize) * gridSize, y: Math.round(pos.y / gridSize) * gridSize }
        : pos;

      if (customEvent.detail.isPower) {
        const type = customEvent.detail.type || 'VCC';
        const newSymbol: PowerSymbol = {
          id: crypto.randomUUID(),
          type,
          netName: type === 'GND' ? 'GND' : 'VCC',
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
      } else if (customEvent.detail.partId !== undefined) {
        const prefix = customEvent.detail.refDesPrefix || 'U';
        let count = 1;
        while (instances?.some(i => i.referenceDesignator === `${prefix}${count}`)) {
          count++;
        }
        mutationRefs.createInstance.current!.mutate({
          circuitId,
          partId: customEvent.detail.partId,
          referenceDesignator: `${prefix}${count}`,
          schematicX: snapped.x,
          schematicY: snapped.y,
        });
      }
    };

    window.addEventListener('protopulse:place-component-instance', handlePlaceComponent);
    return () => window.removeEventListener('protopulse:place-component-instance', handlePlaceComponent);
  }, [circuitId, projectId, reactFlowInstance, snapEnabled, gridSize, instances, settings, mutationRefs]);
}
