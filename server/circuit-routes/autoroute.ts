import type { Express } from 'express';
import type { IStorage } from '../storage';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';

const autorouteSchema = z.object({
  view: z.enum(['breadboard', 'pcb']).default('breadboard'),
});

const layoutSuggestionSchema = z.object({
  view: z.enum(['breadboard', 'pcb']).default('breadboard'),
});

export function registerCircuitAutorouteRoutes(app: Express, storage: IStorage): void {
  // Auto-route (breadboard / PCB)
  app.post('/api/circuits/:circuitId/autoroute', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = autorouteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const nets = await storage.getCircuitNets(circuitId);
    const wires = await storage.getCircuitWires(circuitId);
    const existingWireNetIds = new Set(
      wires.filter(w => w.view === parsed.data.view).map(w => w.netId),
    );

    const unroutedNets = nets.filter(n => !existingWireNetIds.has(n.id));
    if (unroutedNets.length === 0) {
      return res.json({ message: 'All nets already routed', wiresCreated: 0 });
    }

    const createdWires = [];
    const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c'];

    for (let i = 0; i < unroutedNets.length; i++) {
      const net = unroutedNets[i];
      const segments = (net.segments ?? []) as Array<{
        fromInstanceId: number;
        fromPin: string;
        toInstanceId: number;
        toPin: string;
      }>;

      if (segments.length === 0) { continue; }

      const instances = await storage.getCircuitInstances(circuitId);
      const points: Array<{ x: number; y: number }> = [];

      for (const seg of segments) {
        const fromInst = instances.find(inst => inst.id === seg.fromInstanceId);
        const toInst = instances.find(inst => inst.id === seg.toInstanceId);

        if (parsed.data.view === 'breadboard') {
          if (fromInst?.breadboardX != null && fromInst?.breadboardY != null) {
            points.push({ x: fromInst.breadboardX, y: fromInst.breadboardY });
          }
          if (toInst?.breadboardX != null && toInst?.breadboardY != null) {
            points.push({ x: toInst.breadboardX, y: toInst.breadboardY });
          }
        } else {
          if (fromInst?.pcbX != null && fromInst?.pcbY != null) {
            points.push({ x: fromInst.pcbX, y: fromInst.pcbY });
          }
          if (toInst?.pcbX != null && toInst?.pcbY != null) {
            points.push({ x: toInst.pcbX, y: toInst.pcbY });
          }
        }
      }

      if (points.length >= 2) {
        const wire = await storage.createCircuitWire({
          circuitId,
          netId: net.id,
          view: parsed.data.view,
          points,
          layer: 'front',
          width: 1.5,
          color: colors[i % colors.length],
          wireType: 'wire',
        });
        createdWires.push(wire);
      }
    }

    res.json({ message: `Auto-routed ${createdWires.length} nets`, wiresCreated: createdWires.length });
  }));

  // AI Layout Suggestion
  app.post('/api/circuits/:circuitId/suggest-layout', payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = layoutSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const instances = await storage.getCircuitInstances(circuitId);
    const nets = await storage.getCircuitNets(circuitId);

    if (instances.length === 0) {
      return res.status(400).json({ message: 'No components to layout' });
    }

    const suggestions: Array<{
      instanceId: number;
      referenceDesignator: string;
      x: number;
      y: number;
      rotation: number;
    }> = [];

    const spacing = parsed.data.view === 'breadboard' ? 80 : 120;
    const cols = Math.max(1, Math.ceil(Math.sqrt(instances.length)));

    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      suggestions.push({
        instanceId: inst.id,
        referenceDesignator: inst.referenceDesignator,
        x: 50 + col * spacing,
        y: 50 + row * spacing,
        rotation: 0,
      });
    }

    res.json({
      view: parsed.data.view,
      suggestions,
      netCount: nets.length,
      instanceCount: instances.length,
    });
  }));
}
