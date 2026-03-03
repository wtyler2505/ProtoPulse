import type { Express } from 'express';
import type { IStorage } from '../storage';
import type { NetSegment } from './utils';
import { fromZodError } from 'zod-validation-error';
import {
  asyncHandler,
  parseIdParam,
  payloadLimit,
  gatherCircuitData,
  boardDimensionsSchema,
  exportFormatSchema,
  DEFAULT_BOARD_WIDTH,
  DEFAULT_BOARD_HEIGHT,
} from './utils';

export function registerCircuitExportRoutes(app: Express, storage: IStorage): void {
  // Export BOM
  app.post('/api/projects/:projectId/export/bom', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const { exportBom } = await import('../export/bom-exporter');
    const bomItems = await storage.getBomItems(projectId);
    const format = (parsed.data.bomFormat || 'generic') as 'jlcpcb' | 'mouser' | 'digikey' | 'generic';
    const csv = exportBom(bomItems as Parameters<typeof exportBom>[0], {
      format,
      includeHeader: parsed.data.includeHeader !== false,
      groupByPartNumber: parsed.data.groupByPartNumber || false,
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="bom-${format}.csv"`);
    res.send(csv);
  }));

  // Export Netlist (standalone -- supplements the existing inline netlist route)
  app.post('/api/projects/:projectId/export/netlist', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    // Find first circuit for this project
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const circuitId = circuits[0].id;
    const data = await gatherCircuitData(storage, circuitId);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    const { generateNetlist } = await import('../export/netlist-generator');
    const format = (parsed.data.netlistFormat || 'csv') as 'spice' | 'kicad' | 'csv';

    const netlistInput = {
      circuit: { id: data.circuit.id, name: data.circuit.name },
      instances: data.instances.map(i => ({
        id: i.id,
        partId: i.partId,
        referenceDesignator: i.referenceDesignator,
      })),
      nets: data.nets.map(n => ({
        id: n.id,
        name: n.name,
        netType: n.netType,
        voltage: n.voltage,
        busWidth: n.busWidth,
        segments: ((n.segments ?? []) as NetSegment[]),
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        id: p.id,
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string }>),
      }])),
    };

    const content = generateNetlist(netlistInput, format);
    const ext = format === 'spice' ? 'cir' : format === 'kicad' ? 'net' : 'csv';
    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="netlist.${ext}"`);
    res.send(content);
  }));

  // Export Gerber + Drill (manufacturing package)
  app.post('/api/projects/:projectId/export/gerber', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const dims = boardDimensionsSchema.safeParse(req.body);
    const boardWidth = dims.success ? (dims.data.boardWidth ?? DEFAULT_BOARD_WIDTH) : DEFAULT_BOARD_WIDTH;
    const boardHeight = dims.success ? (dims.data.boardHeight ?? DEFAULT_BOARD_HEIGHT) : DEFAULT_BOARD_HEIGHT;
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    // DRC gate check
    const { runDrcGate } = await import('../export/drc-gate');

    const drcResult = runDrcGate({
      instances: data.instances.map(i => ({
        id: i.id,
        referenceDesignator: i.referenceDesignator,
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        pcbSide: i.pcbSide,
        connectors: (((i.partId != null ? data.partsMap.get(i.partId) : undefined)?.connectors ?? []) as Array<{ id: string; padType?: string }>),
      })),
      nets: data.nets.map(n => ({
        id: n.id,
        name: n.name,
        segments: ((n.segments ?? []) as NetSegment[]),
      })),
      wires: data.wires.map(w => ({
        netId: w.netId,
        view: w.view,
        layer: (w.layer ?? 'front'),
        points: ((w.points ?? []) as Array<{ x: number; y: number }>),
        width: w.width,
      })),
      boardWidth,
      boardHeight,
    });

    if (!drcResult.passed) {
      return res.status(422).json({
        message: drcResult.message,
        violations: drcResult.violations,
        errors: drcResult.errors,
        warnings: drcResult.warnings,
      });
    }

    const { generateGerber } = await import('../export/gerber-generator');
    const pcbWires = data.wires.filter(w => w.view === 'pcb');

    const gerberOutput = generateGerber({
      boardWidth,
      boardHeight,
      instances: data.instances.map(i => {
        const part = i.partId != null ? data.partsMap.get(i.partId) : undefined;
        const meta = (part?.meta ?? {}) as Record<string, unknown>;
        return {
          id: i.id,
          referenceDesignator: i.referenceDesignator,
          pcbX: i.pcbX ?? 0,
          pcbY: i.pcbY ?? 0,
          pcbRotation: i.pcbRotation ?? 0,
          pcbSide: i.pcbSide ?? 'front',
          connectors: ((part?.connectors ?? []) as Array<{ id: string; name: string; padType?: string; padWidth?: number; padHeight?: number }>),
          footprint: (meta.package as string) || '',
        };
      }),
      wires: pcbWires.map(w => ({
        layer: w.layer ?? 'front',
        points: (w.points ?? []) as Array<{ x: number; y: number }>,
        width: w.width,
      })),
    });

    // Package as JSON with all layer files
    res.json({
      message: `Generated ${gerberOutput.layers.length} Gerber layers + drill file`,
      drcWarnings: drcResult.warnings,
      layers: gerberOutput.layers.map(l => ({
        name: l.name,
        type: l.type,
        side: l.side,
        filename: `${l.name.replace(/\./g, '_')}.gbr`,
        content: l.content,
      })),
      drill: {
        filename: 'drill.drl',
        content: gerberOutput.drillFile,
      },
    });
  }));

  // Export Pick-and-Place
  app.post('/api/projects/:projectId/export/pick-place', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    const { generatePickPlace } = await import('../export/pick-place-generator');

    const csv = generatePickPlace({
      instances: data.instances.map(i => {
        const part = i.partId != null ? data.partsMap.get(i.partId) : undefined;
        const meta = (part?.meta ?? {}) as Record<string, unknown>;
        const connectors = (part?.connectors ?? []) as Array<{ padType?: string }>;
        const hasSmd = connectors.some(c => c.padType === 'smd');
        return {
          referenceDesignator: i.referenceDesignator,
          pcbX: i.pcbX ?? 0,
          pcbY: i.pcbY ?? 0,
          pcbRotation: i.pcbRotation ?? 0,
          pcbSide: i.pcbSide ?? 'front',
          value: (meta.title as string) || '',
          footprint: (meta.package as string) || '',
          isSmd: hasSmd,
        };
      }),
      boardWidth: parsed.data.boardWidth ?? DEFAULT_BOARD_WIDTH,
      boardHeight: parsed.data.boardHeight ?? DEFAULT_BOARD_HEIGHT,
      origin: (parsed.data.origin || 'bottom-left') as 'board-center' | 'bottom-left',
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="pick-and-place.csv"');
    res.send(csv.content);
  }));

  // Export KiCad Project
  app.post('/api/projects/:projectId/export/kicad', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const dims = boardDimensionsSchema.safeParse(req.body);
    const kicadBoardWidth = dims.success ? (dims.data.boardWidth ?? DEFAULT_BOARD_WIDTH) : DEFAULT_BOARD_WIDTH;
    const kicadBoardHeight = dims.success ? (dims.data.boardHeight ?? DEFAULT_BOARD_HEIGHT) : DEFAULT_BOARD_HEIGHT;
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    const { generateKicadProject } = await import('../export/kicad-exporter');

    const output = generateKicadProject({
      circuit: { id: data.circuit.id, name: data.circuit.name },
      instances: data.instances.map(i => ({
        id: i.id,
        referenceDesignator: i.referenceDesignator,
        partId: i.partId,
        schematicX: i.schematicX,
        schematicY: i.schematicY,
        schematicRotation: i.schematicRotation,
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        pcbRotation: i.pcbRotation,
        pcbSide: i.pcbSide,
      })),
      nets: data.nets.map(n => ({
        name: n.name,
        netType: n.netType,
        segments: ((n.segments ?? []) as NetSegment[]),
      })),
      wires: data.wires.map(w => ({
        netId: w.netId,
        view: w.view,
        points: ((w.points ?? []) as Array<{ x: number; y: number }>),
        layer: w.layer ?? 'front',
        width: w.width,
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string; padType?: string }>),
      }])),
      boardWidth: kicadBoardWidth,
      boardHeight: kicadBoardHeight,
    });

    res.json({
      message: 'KiCad project generated',
      files: [
        { filename: `${data.circuit.name}.kicad_sch`, content: output.schematic },
        { filename: `${data.circuit.name}.kicad_pcb`, content: output.pcb },
        { filename: `${data.circuit.name}.kicad_pro`, content: output.project },
      ],
    });
  }));

  // Export Eagle Project
  app.post('/api/projects/:projectId/export/eagle', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const eagleDims = boardDimensionsSchema.safeParse(req.body);
    const eagleBoardWidth = eagleDims.success ? (eagleDims.data.boardWidth ?? DEFAULT_BOARD_WIDTH) : DEFAULT_BOARD_WIDTH;
    const eagleBoardHeight = eagleDims.success ? (eagleDims.data.boardHeight ?? DEFAULT_BOARD_HEIGHT) : DEFAULT_BOARD_HEIGHT;
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    const { generateEagleProject } = await import('../export/eagle-exporter');

    const output = generateEagleProject({
      circuit: { id: data.circuit.id, name: data.circuit.name },
      instances: data.instances.map(i => ({
        id: i.id,
        referenceDesignator: i.referenceDesignator,
        partId: i.partId,
        schematicX: i.schematicX,
        schematicY: i.schematicY,
        schematicRotation: i.schematicRotation,
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        pcbRotation: i.pcbRotation,
        pcbSide: i.pcbSide,
      })),
      nets: data.nets.map(n => ({
        name: n.name,
        netType: n.netType,
        segments: ((n.segments ?? []) as NetSegment[]),
      })),
      wires: data.wires.map(w => ({
        netId: w.netId,
        view: w.view,
        points: ((w.points ?? []) as Array<{ x: number; y: number }>),
        layer: w.layer ?? 'front',
        width: w.width,
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string; padType?: string }>),
      }])),
      boardWidth: eagleBoardWidth,
      boardHeight: eagleBoardHeight,
    });

    res.json({
      message: 'Eagle project generated',
      files: [
        { filename: `${data.circuit.name}.sch`, content: output.schematic },
        { filename: `${data.circuit.name}.brd`, content: output.board },
      ],
    });
  }));

  // Export PDF/SVG view
  app.post('/api/projects/:projectId/export/pdf', payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: 'Invalid request: ' + fromZodError(parsed.error).toString() });
    }

    // The PDF generator takes pre-built view data from the client.
    // Client sends the view data directly since it has the rendered state.
    const { viewData, titleBlock } = req.body as { viewData: unknown; titleBlock?: unknown };
    if (!viewData) {
      return res.status(400).json({ message: 'viewData is required' });
    }

    const { generateViewPdf } = await import('../export/pdf-generator');
    const result = generateViewPdf(viewData as Parameters<typeof generateViewPdf>[0], {
      paperSize: parsed.data.paperSize as 'A4' | 'A3' | 'letter' | 'tabloid' | undefined,
      scale: parsed.data.scale as 'fit' | '1:1' | undefined,
      titleBlock: titleBlock as Parameters<typeof generateViewPdf>[1] extends { titleBlock?: infer T } ? T : never,
      showBorder: true,
    });

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Content-Disposition', 'attachment; filename="export.svg"');
    res.send(result.svg);
  }));

  // Export PDF Design Report
  app.post('/api/projects/:projectId/export/report-pdf', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);

    // Gather project data
    const [project, nodes, edges, bomItems, issues, circuits] = await Promise.all([
      storage.getProject(projectId),
      storage.getNodes(projectId),
      storage.getEdges(projectId),
      storage.getBomItems(projectId),
      storage.getValidationIssues(projectId),
      storage.getCircuitDesigns(projectId),
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { generateDesignReportPdf } = await import('../export/pdf-report-generator');

    const circuitSummaries = await Promise.all(
      circuits.map(async (c) => {
        const [instances, nets] = await Promise.all([
          storage.getCircuitInstances(c.id),
          storage.getCircuitNets(c.id),
        ]);
        return { name: c.name, instanceCount: instances.length, netCount: nets.length };
      }),
    );

    const result = await generateDesignReportPdf({
      projectName: project.name,
      projectDescription: project.description ?? '',
      nodes: nodes.map((n) => ({
        nodeId: n.nodeId,
        label: n.label,
        nodeType: n.nodeType,
        positionX: n.positionX,
        positionY: n.positionY,
        data: n.data as Record<string, unknown> | null,
      })),
      edges: edges.map((e) => ({
        edgeId: e.edgeId,
        source: e.source,
        target: e.target,
        label: e.label ?? null,
        signalType: e.signalType ?? null,
        voltage: e.voltage ?? null,
        busWidth: e.busWidth ?? null,
        netName: e.netName ?? null,
      })),
      bom: bomItems.map((b) => ({
        partNumber: b.partNumber ?? '',
        manufacturer: b.manufacturer ?? '',
        description: b.description ?? '',
        quantity: b.quantity ?? 0,
        unitPrice: String(b.unitPrice ?? '0'),
        totalPrice: String(b.totalPrice ?? '0'),
        supplier: b.supplier ?? '',
        stock: b.stock ?? 0,
        status: b.status ?? 'unknown',
        leadTime: b.leadTime ?? null,
      })),
      issues: issues.map((i) => ({
        severity: i.severity,
        message: i.message,
        componentId: i.componentId ?? null,
        suggestion: i.suggestion ?? null,
      })),
      circuits: circuitSummaries,
    });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }));

  // Export FMEA Report (CSV)
  app.post('/api/projects/:projectId/export/fmea', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);

    const [project, nodes, edges, issues] = await Promise.all([
      storage.getProject(projectId),
      storage.getNodes(projectId),
      storage.getEdges(projectId),
      storage.getValidationIssues(projectId),
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { generateFmeaReport } = await import('../export/fmea-generator');

    const result = generateFmeaReport({
      projectName: project.name,
      nodes: nodes.map((n) => ({
        nodeId: n.nodeId,
        label: n.label,
        nodeType: n.nodeType,
        positionX: n.positionX,
        positionY: n.positionY,
        data: n.data as Record<string, unknown> | null,
      })),
      edges: edges.map((e) => ({
        edgeId: e.edgeId,
        source: e.source,
        target: e.target,
        label: e.label ?? null,
        signalType: e.signalType ?? null,
        voltage: e.voltage ?? null,
        busWidth: e.busWidth ?? null,
        netName: e.netName ?? null,
      })),
      issues: issues.map((i) => ({
        severity: i.severity,
        message: i.message,
        componentId: i.componentId ?? null,
        suggestion: i.suggestion ?? null,
      })),
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.content);
  }));

  // Export FZZ (Fritzing full project)
  app.post('/api/projects/:projectId/export/fzz', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    const { exportFzz } = await import('../export/fzz-handler');

    const buffer = await exportFzz({
      circuit: { id: data.circuit.id, name: data.circuit.name },
      instances: data.instances.map(i => ({
        id: i.id,
        partId: i.partId,
        referenceDesignator: i.referenceDesignator,
        schematicX: i.schematicX,
        schematicY: i.schematicY,
        schematicRotation: i.schematicRotation,
        breadboardX: i.breadboardX,
        breadboardY: i.breadboardY,
        breadboardRotation: i.breadboardRotation,
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        pcbRotation: i.pcbRotation,
        pcbSide: i.pcbSide,
        properties: (i.properties ?? {}) as Record<string, unknown>,
      })),
      nets: data.nets.map(n => ({
        id: n.id,
        name: n.name,
        netType: n.netType,
        segments: ((n.segments ?? []) as NetSegment[]),
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        id: p.id,
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string; type?: string }>),
        views: (p.views ?? {}) as Record<string, unknown>,
      }])),
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${data.circuit.name}.fzz"`);
    res.send(buffer);
  }));

  // Export ODB++ (manufacturing package ZIP)
  app.post('/api/projects/:projectId/export/odb-plus-plus', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const dims = boardDimensionsSchema.safeParse(req.body);
    const boardWidth = dims.success ? (dims.data.boardWidth ?? DEFAULT_BOARD_WIDTH) : DEFAULT_BOARD_WIDTH;
    const boardHeight = dims.success ? (dims.data.boardHeight ?? DEFAULT_BOARD_HEIGHT) : DEFAULT_BOARD_HEIGHT;

    const [project, circuits, bomItems] = await Promise.all([
      storage.getProject(projectId),
      storage.getCircuitDesigns(projectId),
      storage.getBomItems(projectId),
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    const { generateOdbPlusPlus } = await import('../export/odb-plus-plus-generator');

    const result = await generateOdbPlusPlus({
      projectName: project.name,
      instances: data.instances.map(i => ({
        id: i.id,
        partId: i.partId,
        referenceDesignator: i.referenceDesignator,
        schematicX: i.schematicX,
        schematicY: i.schematicY,
        schematicRotation: i.schematicRotation,
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        pcbRotation: i.pcbRotation,
        pcbSide: i.pcbSide,
        properties: (i.properties ?? {}) as Record<string, unknown>,
      })),
      nets: data.nets.map(n => ({
        id: n.id,
        name: n.name,
        netType: n.netType,
        voltage: n.voltage,
        busWidth: n.busWidth,
        segments: (n.segments ?? []) as unknown[],
        labels: (n.labels ?? []) as unknown[],
      })),
      wires: data.wires.map(w => ({
        id: w.id,
        netId: w.netId,
        view: w.view,
        points: (w.points ?? []) as unknown[],
        layer: w.layer,
        width: w.width,
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string; padType?: string }>),
      }])),
      bom: bomItems.map(b => ({
        partNumber: b.partNumber ?? '',
        manufacturer: b.manufacturer ?? '',
        description: b.description ?? '',
        quantity: b.quantity ?? 0,
        unitPrice: String(b.unitPrice ?? '0'),
        totalPrice: String(b.totalPrice ?? '0'),
        supplier: b.supplier ?? '',
        stock: b.stock ?? 0,
        status: b.status ?? 'unknown',
        leadTime: b.leadTime ?? null,
      })),
      boardWidth,
      boardHeight,
    });

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}.odb++.zip"`);
    res.send(result.buffer);
  }));

  // Export IPC-2581 (XML manufacturing data)
  app.post('/api/projects/:projectId/export/ipc2581', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const dims = boardDimensionsSchema.safeParse(req.body);
    const boardWidth = dims.success ? (dims.data.boardWidth ?? DEFAULT_BOARD_WIDTH) : DEFAULT_BOARD_WIDTH;
    const boardHeight = dims.success ? (dims.data.boardHeight ?? DEFAULT_BOARD_HEIGHT) : DEFAULT_BOARD_HEIGHT;

    const [project, circuits, bomItems] = await Promise.all([
      storage.getProject(projectId),
      storage.getCircuitDesigns(projectId),
      storage.getBomItems(projectId),
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    if (circuits.length === 0) {
      return res.status(404).json({ message: 'No circuit designs found' });
    }

    const data = await gatherCircuitData(storage, circuits[0].id);
    if (!data) { return res.status(404).json({ message: 'Circuit not found' }); }

    const { generateIpc2581 } = await import('../export/ipc2581-generator');

    const result = generateIpc2581({
      projectName: project.name,
      instances: data.instances.map(i => ({
        id: i.id,
        partId: i.partId,
        referenceDesignator: i.referenceDesignator,
        schematicX: i.schematicX,
        schematicY: i.schematicY,
        schematicRotation: i.schematicRotation,
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        pcbRotation: i.pcbRotation,
        pcbSide: i.pcbSide,
        properties: (i.properties ?? {}) as Record<string, unknown>,
      })),
      nets: data.nets.map(n => ({
        id: n.id,
        name: n.name,
        netType: n.netType,
        voltage: n.voltage,
        busWidth: n.busWidth,
        segments: (n.segments ?? []) as unknown[],
        labels: (n.labels ?? []) as unknown[],
      })),
      wires: data.wires.map(w => ({
        id: w.id,
        netId: w.netId,
        view: w.view,
        points: (w.points ?? []) as unknown[],
        layer: w.layer,
        width: w.width,
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string; padType?: string }>),
      }])),
      bom: bomItems.map(b => ({
        partNumber: b.partNumber ?? '',
        manufacturer: b.manufacturer ?? '',
        description: b.description ?? '',
        quantity: b.quantity ?? 0,
        unitPrice: String(b.unitPrice ?? '0'),
        totalPrice: String(b.totalPrice ?? '0'),
        supplier: b.supplier ?? '',
        stock: b.stock ?? 0,
        status: b.status ?? 'unknown',
        leadTime: b.leadTime ?? null,
      })),
      boardWidth,
      boardHeight,
    });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${project.name}.ipc2581.xml"`);
    res.send(result.xml);
  }));

  // Export Firmware Scaffold (Arduino/PlatformIO)
  app.post('/api/projects/:projectId/export/firmware', payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);

    const [project, nodes, edges] = await Promise.all([
      storage.getProject(projectId),
      storage.getNodes(projectId),
      storage.getEdges(projectId),
    ]);

    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const { generateFirmwareScaffold } = await import('../export/firmware-scaffold-generator');

    const result = generateFirmwareScaffold({
      nodes: nodes.map((n) => ({
        nodeId: n.nodeId,
        label: n.label,
        nodeType: n.nodeType,
        positionX: n.positionX,
        positionY: n.positionY,
        data: n.data as Record<string, unknown> | null,
      })),
      edges: edges.map((e) => ({
        edgeId: e.edgeId,
        source: e.source,
        target: e.target,
        label: e.label ?? null,
        signalType: e.signalType ?? null,
        voltage: e.voltage ?? null,
        busWidth: e.busWidth ?? null,
        netName: e.netName ?? null,
      })),
    });

    res.json({
      message: `Generated ${result.files.length} firmware scaffold files`,
      files: result.files,
    });
  }));
}
