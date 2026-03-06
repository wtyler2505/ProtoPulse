import type { Express } from 'express';
import type { IStorage } from '../storage';
import { asyncHandler, parseIdParam, payloadLimit } from './utils';
import { requireProjectOwnership } from '../routes/auth-middleware';

export function registerCircuitImportRoutes(app: Express, storage: IStorage): void {
  // Import FZZ (Fritzing full project)
  app.post('/api/projects/:projectId/import/fzz', requireProjectOwnership, payloadLimit(10 * 1024 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);

    // Expect raw binary buffer from multipart or base64 in body
    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body?.data === 'string') {
      buffer = Buffer.from(req.body.data, 'base64');
    } else {
      return res.status(400).json({ message: 'Expected .fzz file data (base64 in body.data or raw buffer)' });
    }

    const { importFzz } = await import('../export/fzz-handler');
    const { project, warnings } = await importFzz(buffer);

    // Create circuit design
    const circuit = await storage.createCircuitDesign({
      projectId,
      name: project.title || 'Imported Fritzing Project',
    });

    // Create component parts for each unique FZZ part
    const moduleIdToPartId = new Map<string, number>();
    for (const fzzPart of project.parts) {
      const created = await storage.createComponentPart({
        projectId,
        meta: {
          title: fzzPart.title,
          family: fzzPart.family,
          description: fzzPart.description,
          ...fzzPart.properties,
          importedFrom: 'fritzing',
        },
        connectors: fzzPart.connectors.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
        })),
        buses: [],
        views: {},
        constraints: [],
      });
      moduleIdToPartId.set(fzzPart.moduleId, created.id);
    }

    // Create circuit instances
    let createdInstances = 0;
    for (const fzzInst of project.instances) {
      const partId = moduleIdToPartId.get(fzzInst.moduleIdRef);
      if (!partId) {
        warnings.push(`Skipped instance "${fzzInst.referenceDesignator}": part not found`);
        continue;
      }

      await storage.createCircuitInstance({
        circuitId: circuit.id,
        partId,
        referenceDesignator: fzzInst.referenceDesignator,
        schematicX: fzzInst.views.schematic?.x ?? fzzInst.views.breadboard?.x ?? 0,
        schematicY: fzzInst.views.schematic?.y ?? fzzInst.views.breadboard?.y ?? 0,
        schematicRotation: fzzInst.views.schematic?.rotation ?? 0,
        breadboardX: fzzInst.views.breadboard?.x ?? null,
        breadboardY: fzzInst.views.breadboard?.y ?? null,
        breadboardRotation: fzzInst.views.breadboard?.rotation ?? null,
        pcbX: fzzInst.views.pcb?.x ?? null,
        pcbY: fzzInst.views.pcb?.y ?? null,
        pcbRotation: fzzInst.views.pcb?.rotation ?? null,
        pcbSide: fzzInst.views.pcb?.layer ?? 'front',
        properties: fzzInst.properties,
      });
      createdInstances++;
    }

    // Create circuit nets
    let createdNets = 0;
    for (const fzzNet of project.nets) {
      if (fzzNet.connections.length < 2) { continue; }

      await storage.createCircuitNet({
        circuitId: circuit.id,
        name: fzzNet.name,
        netType: 'signal',
        segments: fzzNet.connections.map((c, idx) => {
          // Connect sequentially: pin 0->1, 1->2, etc.
          const next = fzzNet.connections[(idx + 1) % fzzNet.connections.length];
          return {
            fromInstanceRef: c.instanceRef,
            fromPin: c.connectorId,
            toInstanceRef: next.instanceRef,
            toPin: next.connectorId,
          };
        }),
        labels: [],
        style: {},
      });
      createdNets++;
    }

    res.status(201).json({
      message: `Imported Fritzing project: ${createdInstances} instances, ${createdNets} nets, ${project.parts.length} parts`,
      circuitId: circuit.id,
      instanceCount: createdInstances,
      netCount: createdNets,
      partCount: project.parts.length,
      warnings,
    });
  }));

  // Import KiCad project (accepts .kicad_sch content)
  app.post('/api/projects/:projectId/import/kicad', requireProjectOwnership, payloadLimit(10 * 1024 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const { schematic, pcb, name } = req.body as { schematic?: string; pcb?: string; name?: string };

    if (!schematic && !pcb) {
      return res.status(400).json({ message: "At least one of 'schematic' or 'pcb' content is required" });
    }

    // Create circuit design
    const circuit = await storage.createCircuitDesign({
      projectId,
      name: name || 'Imported KiCad Project',
    });

    // Basic KiCad S-expression parsing for components and nets
    // Full parser is complex -- we extract key data points
    let instanceCount = 0;
    let netCount = 0;

    if (schematic) {
      // Extract components from (symbol ... (property "Reference" "R1") ...)
      const symbolRegex = /\(symbol\s+\(lib_id\s+"([^"]+)"\)[\s\S]*?\(property\s+"Reference"\s+"([^"]+)"[\s\S]*?\(at\s+([\d.e+-]+)\s+([\d.e+-]+)/g;
      let match: RegExpExecArray | null;
      while ((match = symbolRegex.exec(schematic)) !== null) {
        const refDes = match[2];
        const x = parseFloat(match[3]) || 0;
        const y = parseFloat(match[4]) || 0;

        // Create a generic part
        const part = await storage.createComponentPart({
          projectId,
          meta: { title: match[1], importedFrom: 'kicad' },
          connectors: [],
          buses: [],
          views: {},
          constraints: [],
        });

        await storage.createCircuitInstance({
          circuitId: circuit.id,
          partId: part.id,
          referenceDesignator: refDes,
          schematicX: x * 10, // KiCad mm -> ProtoPulse pixels (rough scale)
          schematicY: y * 10,
          schematicRotation: 0,
          properties: { importedFrom: 'kicad' },
        });
        instanceCount++;
      }

      // Extract nets from (wire (pts (xy X1 Y1) (xy X2 Y2)))
      const wireRegex = /\(wire\s+\(pts\s+\(xy\s+([\d.e+-]+)\s+([\d.e+-]+)\)\s+\(xy\s+([\d.e+-]+)\s+([\d.e+-]+)\)\)/g;
      while ((match = wireRegex.exec(schematic)) !== null) {
        await storage.createCircuitNet({
          circuitId: circuit.id,
          name: `Net_${++netCount}`,
          netType: 'signal',
          segments: [],
          labels: [],
          style: {},
        });
      }
    }

    res.status(201).json({
      message: `Imported KiCad project: ${instanceCount} instances, ${netCount} nets`,
      circuitId: circuit.id,
      instanceCount,
      netCount,
    });
  }));
}
