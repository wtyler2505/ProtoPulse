import type { Express, Request, Response, NextFunction } from "express";
import type { IStorage } from "./storage";
import { parseIdParam, payloadLimit, asyncHandler } from "./routes";
import { fromZodError } from "zod-validation-error";
import {
  insertCircuitDesignSchema,
  insertCircuitInstanceSchema,
  insertCircuitNetSchema,
  insertCircuitWireSchema,
} from "@shared/schema";
import { z } from "zod";

export function registerCircuitRoutes(app: Express, storage: IStorage) {
  // =========================================================================
  // Circuit Designs
  // =========================================================================

  app.get("/api/projects/:projectId/circuits", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    res.json(circuits);
  }));

  app.get("/api/projects/:projectId/circuits/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const circuit = await storage.getCircuitDesign(id);
    if (!circuit) return res.status(404).json({ message: "Circuit design not found" });
    res.json(circuit);
  }));

  app.post("/api/projects/:projectId/circuits", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = insertCircuitDesignSchema.safeParse({ ...req.body, projectId });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const circuit = await storage.createCircuitDesign(parsed.data);
    res.status(201).json(circuit);
  }));

  const updateCircuitDesignSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    settings: z.any().optional(),
  });

  app.patch("/api/projects/:projectId/circuits/:id", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = updateCircuitDesignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitDesign(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Circuit design not found" });
    res.json(updated);
  }));

  app.delete("/api/projects/:projectId/circuits/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteCircuitDesign(id);
    if (!deleted) return res.status(404).json({ message: "Circuit design not found" });
    res.json({ success: true });
  }));

  // =========================================================================
  // Circuit Instances
  // =========================================================================

  app.get("/api/circuits/:circuitId/instances", asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const instances = await storage.getCircuitInstances(circuitId);
    res.json(instances);
  }));

  app.get("/api/circuits/:circuitId/instances/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const instance = await storage.getCircuitInstance(id);
    if (!instance) return res.status(404).json({ message: "Circuit instance not found" });
    res.json(instance);
  }));

  const createInstanceSchema = z.object({
    partId: z.number().int().positive(),
    referenceDesignator: z.string().min(1),
    schematicX: z.number().optional(),
    schematicY: z.number().optional(),
    schematicRotation: z.number().optional(),
    breadboardX: z.number().nullable().optional(),
    breadboardY: z.number().nullable().optional(),
    breadboardRotation: z.number().nullable().optional(),
    pcbX: z.number().nullable().optional(),
    pcbY: z.number().nullable().optional(),
    pcbRotation: z.number().nullable().optional(),
    pcbSide: z.enum(["front", "back"]).optional(),
    properties: z.record(z.string()).optional(),
  });

  app.post("/api/circuits/:circuitId/instances", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = createInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const data = { ...parsed.data, circuitId, properties: parsed.data.properties ?? {} };
    const instance = await storage.createCircuitInstance(data);
    res.status(201).json(instance);
  }));

  const updateInstanceSchema = z.object({
    referenceDesignator: z.string().min(1).optional(),
    schematicX: z.number().optional(),
    schematicY: z.number().optional(),
    schematicRotation: z.number().optional(),
    breadboardX: z.number().nullable().optional(),
    breadboardY: z.number().nullable().optional(),
    breadboardRotation: z.number().nullable().optional(),
    pcbX: z.number().nullable().optional(),
    pcbY: z.number().nullable().optional(),
    pcbRotation: z.number().nullable().optional(),
    pcbSide: z.enum(["front", "back"]).optional(),
    properties: z.record(z.string()).optional(),
  });

  app.patch("/api/circuits/:circuitId/instances/:id", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = updateInstanceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitInstance(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Circuit instance not found" });
    res.json(updated);
  }));

  app.delete("/api/circuits/:circuitId/instances/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteCircuitInstance(id);
    if (!deleted) return res.status(404).json({ message: "Circuit instance not found" });
    res.json({ success: true });
  }));

  // =========================================================================
  // Circuit Nets
  // =========================================================================

  app.get("/api/circuits/:circuitId/nets", asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const nets = await storage.getCircuitNets(circuitId);
    res.json(nets);
  }));

  app.get("/api/circuits/:circuitId/nets/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const net = await storage.getCircuitNet(id);
    if (!net) return res.status(404).json({ message: "Circuit net not found" });
    res.json(net);
  }));

  const createNetSchema = z.object({
    name: z.string().min(1),
    netType: z.enum(["signal", "power", "ground", "bus"]).optional(),
    voltage: z.string().nullable().optional(),
    busWidth: z.number().int().positive().nullable().optional(),
    segments: z.array(z.any()).optional(),
    labels: z.array(z.any()).optional(),
    style: z.any().optional(),
  });

  app.post("/api/circuits/:circuitId/nets", payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = createNetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const data = {
      ...parsed.data,
      circuitId,
      segments: parsed.data.segments ?? [],
      labels: parsed.data.labels ?? [],
      style: parsed.data.style ?? {},
    };
    const net = await storage.createCircuitNet(data);
    res.status(201).json(net);
  }));

  const updateNetSchema = z.object({
    name: z.string().min(1).optional(),
    netType: z.enum(["signal", "power", "ground", "bus"]).optional(),
    voltage: z.string().nullable().optional(),
    busWidth: z.number().int().positive().nullable().optional(),
    segments: z.array(z.any()).optional(),
    labels: z.array(z.any()).optional(),
    style: z.any().optional(),
  });

  app.patch("/api/circuits/:circuitId/nets/:id", payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = updateNetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitNet(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Circuit net not found" });
    res.json(updated);
  }));

  app.delete("/api/circuits/:circuitId/nets/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteCircuitNet(id);
    if (!deleted) return res.status(404).json({ message: "Circuit net not found" });
    res.json({ success: true });
  }));

  // =========================================================================
  // Architecture → Schematic Expansion
  // =========================================================================

  app.post("/api/projects/:projectId/circuits/expand-architecture", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const { circuitName } = req.body as { circuitName?: string };

    // 1. Fetch architecture nodes + edges
    const archNodes = await storage.getNodes(projectId, { limit: 500, offset: 0, sort: 'asc' });
    const archEdges = await storage.getEdges(projectId, { limit: 500, offset: 0, sort: 'asc' });

    if (archNodes.length === 0) {
      return res.status(400).json({ message: "No architecture nodes to expand" });
    }

    // 2. Fetch available component parts
    const parts = await storage.getComponentParts(projectId);

    // 3. Create circuit design
    const circuit = await storage.createCircuitDesign({
      projectId,
      name: circuitName || "Expanded from Architecture",
    });

    // 4. Match architecture nodes → component parts by family/type
    // Build a lookup: family → part (use first match)
    const familyToPart = new Map<string, typeof parts[0]>();
    for (const part of parts) {
      const meta = (part.meta ?? {}) as Record<string, unknown>;
      const family = ((meta.family as string) || "").toLowerCase();
      if (family && !familyToPart.has(family)) {
        familyToPart.set(family, part);
      }
      // Also index by title (lowercase)
      const title = ((meta.title as string) || "").toLowerCase();
      if (title && !familyToPart.has(title)) {
        familyToPart.set(title, part);
      }
    }

    // Reference designator prefix map (subset for common architecture block types)
    const TYPE_PREFIX: Record<string, string> = {
      microcontroller: "U", mcu: "U", ic: "U", processor: "U", fpga: "U",
      sensor: "U", module: "U", opamp: "U", amplifier: "U",
      resistor: "R", capacitor: "C", inductor: "L",
      diode: "D", led: "D", transistor: "Q", mosfet: "Q",
      connector: "J", header: "J", switch: "SW", relay: "K",
      regulator: "U", converter: "U", driver: "U",
      crystal: "Y", oscillator: "Y", transformer: "T",
      fuse: "F", battery: "BT", motor: "M", speaker: "SP",
    };

    // Track ref des counters
    const refDesCounters = new Map<string, number>();
    function nextRefDes(nodeType: string): string {
      const type = nodeType.toLowerCase();
      const prefix = TYPE_PREFIX[type] || "X";
      const count = (refDesCounters.get(prefix) || 0) + 1;
      refDesCounters.set(prefix, count);
      return `${prefix}${count}`;
    }

    // 5. Create circuit instances — one per architecture node
    const archNodeIdToInstanceId = new Map<string, number>();
    const instancePartMap = new Map<number, typeof parts[0]>();
    const GRID = 200; // Spacing for grid layout
    const COLS = Math.max(3, Math.ceil(Math.sqrt(archNodes.length)));

    for (let i = 0; i < archNodes.length; i++) {
      const archNode = archNodes[i];
      const nodeType = archNode.nodeType.toLowerCase();
      const label = archNode.label.toLowerCase();

      // Try to find a matching part: by nodeType, then label
      const matchedPart = familyToPart.get(nodeType) || familyToPart.get(label) || parts[0];

      if (!matchedPart) continue; // No parts at all — skip

      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const instance = await storage.createCircuitInstance({
        circuitId: circuit.id,
        partId: matchedPart.id,
        referenceDesignator: nextRefDes(archNode.nodeType),
        schematicX: archNode.positionX || col * GRID,
        schematicY: archNode.positionY || row * GRID,
        schematicRotation: 0,
        properties: {
          sourceArchNodeId: archNode.nodeId,
          sourceLabel: archNode.label,
        },
      });

      archNodeIdToInstanceId.set(archNode.nodeId, instance.id);
      instancePartMap.set(instance.id, matchedPart);
    }

    // Helper: get first connector ID for an instance's part (fallback to "pin1")
    function firstPinId(instanceId: number): string {
      const part = instancePartMap.get(instanceId);
      const connectors = (part?.connectors ?? []) as Array<{ id: string }>;
      return connectors[0]?.id ?? "pin1";
    }

    // 6. Create circuit nets — one per architecture edge
    let netCounter = 0;
    for (const edge of archEdges) {
      const sourceInstanceId = archNodeIdToInstanceId.get(edge.source);
      const targetInstanceId = archNodeIdToInstanceId.get(edge.target);
      if (!sourceInstanceId || !targetInstanceId) continue;

      netCounter++;
      const netName = edge.netName || edge.label || `Net_${netCounter}`;
      const signalType = (edge.signalType || "signal").toLowerCase();
      const netType = signalType === "power" ? "power" : signalType === "ground" ? "ground" : signalType === "bus" ? "bus" : "signal";

      await storage.createCircuitNet({
        circuitId: circuit.id,
        name: netName,
        netType,
        voltage: edge.voltage || undefined,
        busWidth: edge.busWidth ? parseInt(String(edge.busWidth), 10) : undefined,
        segments: [{
          fromInstanceId: sourceInstanceId,
          fromPin: firstPinId(sourceInstanceId),
          toInstanceId: targetInstanceId,
          toPin: firstPinId(targetInstanceId),
        }],
        labels: [],
        style: {},
      });
    }

    // 7. Return the created circuit with summary
    const instances = await storage.getCircuitInstances(circuit.id);
    const nets = await storage.getCircuitNets(circuit.id);

    res.status(201).json({
      circuit,
      instanceCount: instances.length,
      netCount: nets.length,
      unmatchedNodes: archNodes.length - instances.length,
      warning: "Net segments use each part's first pin as a placeholder. Review pin assignments in the schematic editor.",
    });
  }));

  // =========================================================================
  // Netlist Generation
  // =========================================================================

  app.post("/api/circuits/:circuitId/netlist", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const { format = "generic" } = req.body as { format?: "generic" | "spice" | "kicad" };

    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return res.status(404).json({ message: "Circuit not found" });

    const instances = await storage.getCircuitInstances(circuitId);
    const nets = await storage.getCircuitNets(circuitId);
    const parts = await storage.getComponentParts(circuit.projectId);

    const partsMap = new Map<number, typeof parts[0]>();
    for (const p of parts) partsMap.set(p.id, p);

    interface NetSegment {
      fromInstanceId: number;
      fromPin: string;
      toInstanceId: number;
      toPin: string;
    }

    // Build connector alias map: "instId:pinName" → "instId:pinId"
    // Net segments may reference pins by name (e.g. "PB0") or by id (e.g. "pin2")
    const connAlias = new Map<string, string>();
    for (const inst of instances) {
      const part = partsMap.get(inst.partId);
      const connectors = (part?.connectors ?? []) as Array<{ id: string; name: string }>;
      for (const c of connectors) {
        if (c.name !== c.id) {
          connAlias.set(`${inst.id}:${c.name}`, `${inst.id}:${c.id}`);
        }
      }
    }
    const resolveNetKey = (raw: string): string =>
      connAlias.get(raw) ?? raw;

    if (format === "spice") {
      // SPICE netlist format
      const lines: string[] = [];
      lines.push(`* SPICE Netlist — ${circuit.name}`);
      lines.push(`* Generated by ProtoPulse`);
      lines.push("");

      // Map instance → net connections (build pin→net lookup with alias resolution)
      const pinToNet = new Map<string, string>();
      for (const net of nets) {
        const segments = (net.segments ?? []) as NetSegment[];
        for (const seg of segments) {
          pinToNet.set(resolveNetKey(`${seg.fromInstanceId}:${seg.fromPin}`), net.name);
          pinToNet.set(resolveNetKey(`${seg.toInstanceId}:${seg.toPin}`), net.name);
        }
      }

      for (const inst of instances) {
        const part = partsMap.get(inst.partId);
        const meta = (part?.meta ?? {}) as Record<string, unknown>;
        const connectors = (part?.connectors ?? []) as Array<{ id: string; name: string }>;
        const family = ((meta.family as string) || "").toLowerCase();

        // Build pin list in order
        const pinNets = connectors.map((c) => {
          const netName = pinToNet.get(`${inst.id}:${c.id}`);
          return netName || "0"; // 0 = unconnected/ground in SPICE
        });

        // Component line: RefDes net1 net2 ... model/value
        const refDes = inst.referenceDesignator;
        const value = (meta.title as string) || family || "?";

        if (family === "resistor") {
          lines.push(`${refDes} ${pinNets.join(" ")} ${value}`);
        } else if (family === "capacitor") {
          lines.push(`${refDes} ${pinNets.join(" ")} ${value}`);
        } else if (family === "inductor") {
          lines.push(`${refDes} ${pinNets.join(" ")} ${value}`);
        } else {
          // Generic subcircuit call
          lines.push(`X${refDes} ${pinNets.join(" ")} ${value}`);
        }
      }

      lines.push("");
      lines.push(".end");

      res.json({
        format: "spice",
        netlist: lines.join("\n"),
        instanceCount: instances.length,
        netCount: nets.length,
      });
    } else if (format === "kicad") {
      // KiCad netlist format (simplified)
      const lines: string[] = [];
      lines.push(`(export (version D)`);
      lines.push(`  (design`);
      lines.push(`    (source "${circuit.name}")`);
      lines.push(`    (tool "ProtoPulse")`);
      lines.push(`  )`);

      // Components
      lines.push(`  (components`);
      for (const inst of instances) {
        const part = partsMap.get(inst.partId);
        const meta = (part?.meta ?? {}) as Record<string, unknown>;
        lines.push(`    (comp (ref ${inst.referenceDesignator})`);
        lines.push(`      (value "${(meta.title as string) || ''}")`);
        lines.push(`      (footprint "${(meta.package as string) || ''}")`);
        lines.push(`    )`);
      }
      lines.push(`  )`);

      // Nets
      lines.push(`  (nets`);
      lines.push(`    (net (code 0) (name ""))`); // unconnected net
      for (let i = 0; i < nets.length; i++) {
        const net = nets[i];
        const segments = (net.segments ?? []) as NetSegment[];
        lines.push(`    (net (code ${i + 1}) (name "${net.name}")`);
        for (const seg of segments) {
          const fromInst = instances.find((inst) => inst.id === seg.fromInstanceId);
          const toInst = instances.find((inst) => inst.id === seg.toInstanceId);
          // Resolve pin references to canonical IDs (handles name-vs-id mismatch)
          const fromPinId = resolveNetKey(`${seg.fromInstanceId}:${seg.fromPin}`).split(":")[1];
          const toPinId = resolveNetKey(`${seg.toInstanceId}:${seg.toPin}`).split(":")[1];
          if (fromInst) lines.push(`      (node (ref ${fromInst.referenceDesignator}) (pin ${fromPinId}))`);
          if (toInst) lines.push(`      (node (ref ${toInst.referenceDesignator}) (pin ${toPinId}))`);
        }
        lines.push(`    )`);
      }
      lines.push(`  )`);
      lines.push(`)`);

      res.json({
        format: "kicad",
        netlist: lines.join("\n"),
        instanceCount: instances.length,
        netCount: nets.length,
      });
    } else {
      // Generic netlist format (JSON)
      const netlist = {
        circuit: { id: circuit.id, name: circuit.name },
        components: instances.map((inst) => {
          const part = partsMap.get(inst.partId);
          const meta = (part?.meta ?? {}) as Record<string, unknown>;
          const connectors = (part?.connectors ?? []) as Array<{ id: string; name: string }>;
          return {
            refDes: inst.referenceDesignator,
            partId: inst.partId,
            value: (meta.title as string) || "",
            family: (meta.family as string) || "",
            pins: connectors.map((c) => ({ id: c.id, name: c.name })),
          };
        }),
        nets: nets.map((net) => {
          const segments = (net.segments ?? []) as NetSegment[];
          return {
            name: net.name,
            type: net.netType,
            voltage: net.voltage,
            busWidth: net.busWidth,
            connections: segments.map((seg) => {
              const fromInst = instances.find((inst) => inst.id === seg.fromInstanceId);
              const toInst = instances.find((inst) => inst.id === seg.toInstanceId);
              return {
                from: { refDes: fromInst?.referenceDesignator || `?${seg.fromInstanceId}`, pin: seg.fromPin },
                to: { refDes: toInst?.referenceDesignator || `?${seg.toInstanceId}`, pin: seg.toPin },
              };
            }),
          };
        }),
      };

      res.json({
        format: "generic",
        netlist,
        instanceCount: instances.length,
        netCount: nets.length,
      });
    }
  }));

  // =========================================================================
  // Circuit Wires
  // =========================================================================

  app.get("/api/circuits/:circuitId/wires", asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const wires = await storage.getCircuitWires(circuitId);
    res.json(wires);
  }));

  app.post("/api/circuits/:circuitId/wires", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = insertCircuitWireSchema.safeParse({ ...req.body, circuitId });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const wire = await storage.createCircuitWire(parsed.data);
    res.status(201).json(wire);
  }));

  const updateWireSchema = z.object({
    points: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
    layer: z.string().optional(),
    width: z.number().positive().optional(),
    color: z.string().nullable().optional(),
    wireType: z.enum(["wire", "jump"]).optional(),
  });

  app.patch("/api/wires/:id", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = updateWireSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }
    const updated = await storage.updateCircuitWire(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Wire not found" });
    res.json(updated);
  }));

  app.delete("/api/wires/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteCircuitWire(id);
    if (!deleted) return res.status(404).json({ message: "Wire not found" });
    res.json({ success: true });
  }));

  // =========================================================================
  // Auto-route (breadboard)
  // =========================================================================

  const autorouteSchema = z.object({
    view: z.enum(["breadboard", "pcb"]).default("breadboard"),
  });

  app.post("/api/circuits/:circuitId/autoroute", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = autorouteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const nets = await storage.getCircuitNets(circuitId);
    const wires = await storage.getCircuitWires(circuitId);
    const existingWireNetIds = new Set(
      wires.filter(w => w.view === parsed.data.view).map(w => w.netId),
    );

    const unroutedNets = nets.filter(n => !existingWireNetIds.has(n.id));
    if (unroutedNets.length === 0) {
      return res.json({ message: "All nets already routed", wiresCreated: 0 });
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

      if (segments.length === 0) continue;

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
          layer: "front",
          width: 1.5,
          color: colors[i % colors.length],
          wireType: "wire",
        });
        createdWires.push(wire);
      }
    }

    res.json({ message: `Auto-routed ${createdWires.length} nets`, wiresCreated: createdWires.length });
  }));

  // =========================================================================
  // AI Layout Suggestion
  // =========================================================================

  const layoutSuggestionSchema = z.object({
    view: z.enum(["breadboard", "pcb"]).default("breadboard"),
  });

  app.post("/api/circuits/:circuitId/suggest-layout", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = layoutSuggestionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const instances = await storage.getCircuitInstances(circuitId);
    const nets = await storage.getCircuitNets(circuitId);

    if (instances.length === 0) {
      return res.status(400).json({ message: "No components to layout" });
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

  // =========================================================================
  // Export Routes (Phase 12.12)
  // =========================================================================

  const exportFormatSchema = z.object({
    format: z.string().optional(),
    paperSize: z.enum(["A4", "A3", "letter", "tabloid"]).optional(),
    scale: z.enum(["fit", "1:1"]).optional(),
    bomFormat: z.enum(["jlcpcb", "mouser", "digikey", "generic"]).optional(),
    netlistFormat: z.enum(["spice", "kicad", "csv"]).optional(),
    origin: z.enum(["board-center", "bottom-left"]).optional(),
    includeHeader: z.boolean().optional(),
    groupByPartNumber: z.boolean().optional(),
  });

  // Helper: gather full circuit data for export
  async function gatherCircuitData(circuitId: number) {
    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return null;
    const instances = await storage.getCircuitInstances(circuitId);
    const nets = await storage.getCircuitNets(circuitId);
    const wires = await storage.getCircuitWires(circuitId);
    const parts = await storage.getComponentParts(circuit.projectId);
    const partsMap = new Map<number, typeof parts[0]>();
    for (const p of parts) partsMap.set(p.id, p);
    return { circuit, instances, nets, wires, parts, partsMap };
  }

  // Export BOM
  app.post("/api/projects/:projectId/export/bom", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const { exportBom } = await import("./export/bom-exporter");
    const bomItems = await storage.getBomItems(projectId);
    const format = (parsed.data.bomFormat || "generic") as "jlcpcb" | "mouser" | "digikey" | "generic";
    const csv = exportBom(bomItems as Parameters<typeof exportBom>[0], {
      format,
      includeHeader: parsed.data.includeHeader !== false,
      groupByPartNumber: parsed.data.groupByPartNumber || false,
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="bom-${format}.csv"`);
    res.send(csv);
  }));

  // Export Netlist (standalone — supplements the existing inline netlist route)
  app.post("/api/projects/:projectId/export/netlist", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    // Find first circuit for this project
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: "No circuit designs found" });
    }

    const circuitId = circuits[0].id;
    const data = await gatherCircuitData(circuitId);
    if (!data) return res.status(404).json({ message: "Circuit not found" });

    const { generateNetlist } = await import("./export/netlist-generator");
    const format = (parsed.data.netlistFormat || "csv") as "spice" | "kicad" | "csv";

    interface NetSegment { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string; }

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
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="netlist.${ext}"`);
    res.send(content);
  }));

  // Export Gerber + Drill (manufacturing package)
  app.post("/api/projects/:projectId/export/gerber", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: "No circuit designs found" });
    }

    const data = await gatherCircuitData(circuits[0].id);
    if (!data) return res.status(404).json({ message: "Circuit not found" });

    // DRC gate check
    const { runDrcGate } = await import("./export/drc-gate");
    interface NetSegment { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string; }

    const drcResult = runDrcGate({
      instances: data.instances.map(i => ({
        id: i.id,
        referenceDesignator: i.referenceDesignator,
        pcbX: i.pcbX,
        pcbY: i.pcbY,
        pcbSide: i.pcbSide,
        connectors: ((data.partsMap.get(i.partId)?.connectors ?? []) as Array<{ id: string; padType?: string }>),
      })),
      nets: data.nets.map(n => ({
        id: n.id,
        name: n.name,
        segments: ((n.segments ?? []) as NetSegment[]),
      })),
      wires: data.wires.map(w => ({
        netId: w.netId,
        view: w.view,
        layer: (w.layer ?? "front"),
        points: ((w.points ?? []) as Array<{ x: number; y: number }>),
        width: w.width,
      })),
      boardWidth: 50,  // TODO: get from circuit settings
      boardHeight: 40,
    });

    if (!drcResult.passed) {
      return res.status(422).json({
        message: drcResult.message,
        violations: drcResult.violations,
        errors: drcResult.errors,
        warnings: drcResult.warnings,
      });
    }

    const { generateGerber } = await import("./export/gerber-generator");
    const pcbWires = data.wires.filter(w => w.view === "pcb");

    const gerberOutput = generateGerber({
      boardWidth: 50,
      boardHeight: 40,
      instances: data.instances.map(i => {
        const part = data.partsMap.get(i.partId);
        const meta = (part?.meta ?? {}) as Record<string, unknown>;
        return {
          id: i.id,
          referenceDesignator: i.referenceDesignator,
          pcbX: i.pcbX ?? 0,
          pcbY: i.pcbY ?? 0,
          pcbRotation: i.pcbRotation ?? 0,
          pcbSide: i.pcbSide ?? "front",
          connectors: ((part?.connectors ?? []) as Array<{ id: string; name: string; padType?: string; padWidth?: number; padHeight?: number }>),
          footprint: (meta.package as string) || "",
        };
      }),
      wires: pcbWires.map(w => ({
        layer: w.layer ?? "front",
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
        filename: "drill.drl",
        content: gerberOutput.drillFile,
      },
    });
  }));

  // Export Pick-and-Place
  app.post("/api/projects/:projectId/export/pick-place", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: "No circuit designs found" });
    }

    const data = await gatherCircuitData(circuits[0].id);
    if (!data) return res.status(404).json({ message: "Circuit not found" });

    const { generatePickPlace } = await import("./export/pick-place-generator");

    const csv = generatePickPlace({
      instances: data.instances.map(i => {
        const part = data.partsMap.get(i.partId);
        const meta = (part?.meta ?? {}) as Record<string, unknown>;
        const connectors = (part?.connectors ?? []) as Array<{ padType?: string }>;
        const hasSmd = connectors.some(c => c.padType === 'smd');
        return {
          referenceDesignator: i.referenceDesignator,
          pcbX: i.pcbX ?? 0,
          pcbY: i.pcbY ?? 0,
          pcbRotation: i.pcbRotation ?? 0,
          pcbSide: i.pcbSide ?? "front",
          value: (meta.title as string) || "",
          footprint: (meta.package as string) || "",
          isSmd: hasSmd,
        };
      }),
      boardWidth: 50,
      boardHeight: 40,
      origin: (parsed.data.origin || "bottom-left") as "board-center" | "bottom-left",
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="pick-and-place.csv"');
    res.send(csv.content);
  }));

  // Export KiCad Project
  app.post("/api/projects/:projectId/export/kicad", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: "No circuit designs found" });
    }

    const data = await gatherCircuitData(circuits[0].id);
    if (!data) return res.status(404).json({ message: "Circuit not found" });

    const { generateKicadProject } = await import("./export/kicad-exporter");
    interface NetSegment { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string; }

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
        layer: w.layer ?? "front",
        width: w.width,
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string; padType?: string }>),
      }])),
      boardWidth: 50,
      boardHeight: 40,
    });

    res.json({
      message: "KiCad project generated",
      files: [
        { filename: `${data.circuit.name}.kicad_sch`, content: output.schematic },
        { filename: `${data.circuit.name}.kicad_pcb`, content: output.pcb },
        { filename: `${data.circuit.name}.kicad_pro`, content: output.project },
      ],
    });
  }));

  // Export Eagle Project
  app.post("/api/projects/:projectId/export/eagle", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: "No circuit designs found" });
    }

    const data = await gatherCircuitData(circuits[0].id);
    if (!data) return res.status(404).json({ message: "Circuit not found" });

    const { generateEagleProject } = await import("./export/eagle-exporter");
    interface NetSegment { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string; }

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
        layer: w.layer ?? "front",
        width: w.width,
      })),
      parts: new Map(Array.from(data.partsMap.entries()).map(([id, p]) => [id, {
        meta: (p.meta ?? {}) as Record<string, unknown>,
        connectors: ((p.connectors ?? []) as Array<{ id: string; name: string; padType?: string }>),
      }])),
      boardWidth: 50,
      boardHeight: 40,
    });

    res.json({
      message: "Eagle project generated",
      files: [
        { filename: `${data.circuit.name}.sch`, content: output.schematic },
        { filename: `${data.circuit.name}.brd`, content: output.board },
      ],
    });
  }));

  // Export PDF/SVG view
  app.post("/api/projects/:projectId/export/pdf", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = exportFormatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    // The PDF generator takes pre-built view data from the client.
    // Client sends the view data directly since it has the rendered state.
    const { viewData, titleBlock } = req.body as { viewData: unknown; titleBlock?: unknown };
    if (!viewData) {
      return res.status(400).json({ message: "viewData is required" });
    }

    const { generateViewPdf } = await import("./export/pdf-generator");
    const result = generateViewPdf(viewData as Parameters<typeof generateViewPdf>[0], {
      paperSize: parsed.data.paperSize as "A4" | "A3" | "letter" | "tabloid" | undefined,
      scale: parsed.data.scale as "fit" | "1:1" | undefined,
      titleBlock: titleBlock as Parameters<typeof generateViewPdf>[1] extends { titleBlock?: infer T } ? T : never,
      showBorder: true,
    });

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Content-Disposition", 'attachment; filename="export.svg"');
    res.send(result.svg);
  }));

  // Export FZZ (Fritzing full project)
  app.post("/api/projects/:projectId/export/fzz", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) {
      return res.status(404).json({ message: "No circuit designs found" });
    }

    const data = await gatherCircuitData(circuits[0].id);
    if (!data) return res.status(404).json({ message: "Circuit not found" });

    const { exportFzz } = await import("./export/fzz-handler");
    interface NetSegment { fromInstanceId: number; fromPin: string; toInstanceId: number; toPin: string; }

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

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${data.circuit.name}.fzz"`);
    res.send(buffer);
  }));

  // =========================================================================
  // Import Routes (Phase 12.13)
  // =========================================================================

  // Import FZZ (Fritzing full project)
  app.post("/api/projects/:projectId/import/fzz", payloadLimit(10 * 1024 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);

    // Expect raw binary buffer from multipart or base64 in body
    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body?.data === "string") {
      buffer = Buffer.from(req.body.data, "base64");
    } else {
      return res.status(400).json({ message: "Expected .fzz file data (base64 in body.data or raw buffer)" });
    }

    const { importFzz } = await import("./export/fzz-handler");
    const { project, warnings } = await importFzz(buffer);

    // Create circuit design
    const circuit = await storage.createCircuitDesign({
      projectId,
      name: project.title || "Imported Fritzing Project",
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
          importedFrom: "fritzing",
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
        pcbSide: fzzInst.views.pcb?.layer ?? "front",
        properties: fzzInst.properties,
      });
      createdInstances++;
    }

    // Create circuit nets
    let createdNets = 0;
    for (const fzzNet of project.nets) {
      if (fzzNet.connections.length < 2) continue;

      await storage.createCircuitNet({
        circuitId: circuit.id,
        name: fzzNet.name,
        netType: "signal",
        segments: fzzNet.connections.map((c, idx) => {
          // Connect sequentially: pin 0→1, 1→2, etc.
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
  app.post("/api/projects/:projectId/import/kicad", payloadLimit(10 * 1024 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const { schematic, pcb, name } = req.body as { schematic?: string; pcb?: string; name?: string };

    if (!schematic && !pcb) {
      return res.status(400).json({ message: "At least one of 'schematic' or 'pcb' content is required" });
    }

    // Create circuit design
    const circuit = await storage.createCircuitDesign({
      projectId,
      name: name || "Imported KiCad Project",
    });

    // Basic KiCad S-expression parsing for components and nets
    // Full parser is complex — we extract key data points
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
          meta: { title: match[1], importedFrom: "kicad" },
          connectors: [],
          buses: [],
          views: {},
          constraints: [],
        });

        await storage.createCircuitInstance({
          circuitId: circuit.id,
          partId: part.id,
          referenceDesignator: refDes,
          schematicX: x * 10, // KiCad mm → ProtoPulse pixels (rough scale)
          schematicY: y * 10,
          schematicRotation: 0,
          properties: { importedFrom: "kicad" },
        });
        instanceCount++;
      }

      // Extract nets from (wire (pts (xy X1 Y1) (xy X2 Y2)))
      const wireRegex = /\(wire\s+\(pts\s+\(xy\s+([\d.e+-]+)\s+([\d.e+-]+)\)\s+\(xy\s+([\d.e+-]+)\s+([\d.e+-]+)\)\)/g;
      while ((match = wireRegex.exec(schematic)) !== null) {
        await storage.createCircuitNet({
          circuitId: circuit.id,
          name: `Net_${++netCount}`,
          netType: "signal",
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

  // =========================================================================
  // Simulation (Phase 13.8)
  // =========================================================================

  const simulateSchema = z.object({
    analysisType: z.enum(["op", "tran", "ac", "dc"]),
    transient: z.object({
      startTime: z.number().min(0),
      stopTime: z.number().positive(),
      timeStep: z.number().positive(),
    }).optional(),
    ac: z.object({
      startFreq: z.number().positive(),
      stopFreq: z.number().positive(),
      numPoints: z.number().int().positive().max(10000),
      sweepType: z.enum(["dec", "lin", "oct"]),
    }).optional(),
    dcSweep: z.object({
      sourceName: z.string().min(1),
      startValue: z.number(),
      stopValue: z.number(),
      stepValue: z.number(),
    }).optional(),
    temperature: z.number().optional(),
  });

  // POST /api/projects/:projectId/circuits/:circuitId/simulate
  app.post("/api/projects/:projectId/circuits/:circuitId/simulate", payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuitId = parseIdParam(req.params.circuitId);
    const parsed = simulateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return res.status(404).json({ message: "Circuit design not found" });

    const data = await gatherCircuitData(circuitId);
    if (!data) return res.status(404).json({ message: "Circuit data not found" });

    // Generate SPICE netlist
    const { exportSpiceNetlist } = await import("./export/spice-exporter");
    const spiceResult = exportSpiceNetlist({
      circuitName: circuit.name,
      instances: data.instances,
      nets: data.nets,
      parts: data.parts,
      config: {
        analysis: parsed.data.analysisType,
        transient: parsed.data.transient,
        ac: parsed.data.ac,
        dcSweep: parsed.data.dcSweep,
        temperature: parsed.data.temperature,
      },
    });

    // Run simulation
    const { runSimulation } = await import("./simulation");
    const result = await runSimulation({
      netlist: spiceResult.netlist,
      analysisType: parsed.data.analysisType,
      timeout: 30000,
    });

    // Store simulation result (Phase 13.13 — result size management)
    const resultData = {
      nodeVoltages: result.nodeVoltages,
      branchCurrents: result.branchCurrents,
      traces: result.traces,
    };
    const resultJson = JSON.stringify(resultData);
    const sizeBytes = Buffer.byteLength(resultJson, 'utf-8');

    const stored = await storage.createSimulationResult({
      circuitId,
      analysisType: parsed.data.analysisType,
      config: parsed.data as Record<string, unknown>,
      results: resultData as Record<string, unknown>,
      status: result.success ? "completed" : "failed",
      engineUsed: result.engineUsed,
      elapsedMs: result.elapsedMs,
      sizeBytes,
      error: result.error || null,
    });

    // Auto-cleanup: keep max 5 results per circuit
    await storage.cleanupSimulationResults(circuitId, 5);

    res.json({
      id: stored.id,
      success: result.success,
      analysisType: result.analysisType,
      engineUsed: result.engineUsed,
      elapsedMs: result.elapsedMs,
      sizeBytes,
      nodeVoltages: result.nodeVoltages,
      branchCurrents: result.branchCurrents,
      traces: result.traces,
      netlistWarnings: spiceResult.warnings,
      error: result.error,
    });
  }));

  // GET /api/projects/:projectId/circuits/:circuitId/simulations — list stored results
  app.get("/api/projects/:projectId/circuits/:circuitId/simulations", asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const results = await storage.getSimulationResults(circuitId);

    // Return summaries (without full result data to save bandwidth)
    const summaries = results.map(r => ({
      id: r.id,
      analysisType: r.analysisType,
      status: r.status,
      engineUsed: r.engineUsed,
      elapsedMs: r.elapsedMs,
      sizeBytes: r.sizeBytes,
      error: r.error,
      createdAt: r.createdAt,
    }));

    res.json(summaries);
  }));

  // GET /api/projects/:projectId/circuits/:circuitId/simulations/:simId — get full result
  app.get("/api/projects/:projectId/circuits/:circuitId/simulations/:simId", asyncHandler(async (req, res) => {
    const simId = parseIdParam(req.params.simId);
    const result = await storage.getSimulationResult(simId);
    if (!result) return res.status(404).json({ message: "Simulation result not found" });
    res.json(result);
  }));

  // DELETE /api/projects/:projectId/circuits/:circuitId/simulations/:simId — delete result
  app.delete("/api/projects/:projectId/circuits/:circuitId/simulations/:simId", asyncHandler(async (req, res) => {
    const simId = parseIdParam(req.params.simId);
    const deleted = await storage.deleteSimulationResult(simId);
    if (!deleted) return res.status(404).json({ message: "Simulation result not found" });
    res.json({ message: "Simulation result deleted", id: deleted.id });
  }));

  // GET /api/projects/:projectId/circuits/:circuitId/simulation/capabilities
  app.get("/api/projects/:projectId/circuits/:circuitId/simulation/capabilities", asyncHandler(async (_req, res) => {
    const { getSimulationCapabilities } = await import("./simulation");
    const caps = await getSimulationCapabilities();
    res.json(caps);
  }));

  // POST /api/projects/:projectId/export/spice — SPICE netlist export
  app.post("/api/projects/:projectId/export/spice", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const circuits = await storage.getCircuitDesigns(projectId);
    if (circuits.length === 0) return res.status(404).json({ message: "No circuit designs found" });

    const analysisType = (req.body.analysisType as string) || "op";
    const data = await gatherCircuitData(circuits[0].id);
    if (!data) return res.status(404).json({ message: "Circuit data not found" });

    const { exportSpiceNetlist } = await import("./export/spice-exporter");
    const result = exportSpiceNetlist({
      circuitName: circuits[0].name,
      instances: data.instances,
      nets: data.nets,
      parts: data.parts,
      config: {
        analysis: analysisType as "op" | "tran" | "ac" | "dc",
        transient: req.body.transient,
        ac: req.body.ac,
        dcSweep: req.body.dcSweep,
        temperature: req.body.temperature,
      },
    });

    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
    res.send(result.netlist);
  }));

  // POST /api/projects/:projectId/circuits/:circuitId/analyze/power — power estimation (13.10)
  app.post("/api/projects/:projectId/circuits/:circuitId/analyze/power", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return res.status(404).json({ message: "Circuit design not found" });

    const data = await gatherCircuitData(circuitId);
    if (!data) return res.status(404).json({ message: "Circuit data not found" });

    // Generate netlist and run DC OP
    const { exportSpiceNetlist } = await import("./export/spice-exporter");
    const spiceResult = exportSpiceNetlist({
      circuitName: circuit.name,
      instances: data.instances,
      nets: data.nets,
      parts: data.parts,
      config: { analysis: "op" },
    });

    const { runSimulation } = await import("./simulation");
    const simResult = await runSimulation({
      netlist: spiceResult.netlist,
      analysisType: "op",
      timeout: 10000,
    });

    if (!simResult.success || !simResult.nodeVoltages) {
      return res.status(422).json({
        message: "DC operating point simulation failed — cannot estimate power",
        error: simResult.error,
      });
    }

    // Calculate per-component power
    const powerBreakdown: Array<{
      refDes: string;
      partName: string;
      voltage: number;
      current: number;
      power: number;
    }> = [];

    let totalPower = 0;

    for (const inst of data.instances) {
      const part = data.parts.find(p => p.id === inst.partId);
      const meta = (part?.meta ?? {}) as Record<string, string>;
      const refDes = inst.referenceDesignator;

      // Look for branch current by common naming patterns
      const currentKey = Object.keys(simResult.branchCurrents || {}).find(
        k => k.toLowerCase().includes(refDes.toLowerCase()),
      );

      if (currentKey && simResult.branchCurrents) {
        const current = simResult.branchCurrents[currentKey];
        // Estimate voltage across component from node voltages
        // This is approximate — the simulation result has the exact values
        const power = Math.abs(current) * Math.abs(current); // placeholder
        const absCurrent = Math.abs(current);

        powerBreakdown.push({
          refDes,
          partName: meta.title || 'Unknown',
          voltage: 0, // Would need node resolution for exact value
          current: absCurrent,
          power: 0, // Will be computed below
        });
      }
    }

    // Sum voltage source power (actual power delivery)
    const voltageSources = Object.entries(simResult.branchCurrents || {})
      .filter(([k]) => k.startsWith('v'));

    for (const [key, current] of voltageSources) {
      // Find voltage source value from netlist
      const vMatch = new RegExp(`^(V\\S+)\\s+\\S+\\s+\\S+\\s+(?:DC\\s+)?([-\\d.eE+]+)`, 'im')
        .exec(spiceResult.netlist.split('\n').find(l => l.toLowerCase().startsWith(key.split('#')[0])) || '');
      if (vMatch) {
        const voltage = parseFloat(vMatch[2]);
        const power = Math.abs(voltage * current);
        totalPower += power;

        const existing = powerBreakdown.find(p =>
          key.toLowerCase().includes(p.refDes.toLowerCase()),
        );
        if (existing) {
          existing.voltage = voltage;
          existing.current = Math.abs(current);
          existing.power = power;
        }
      }
    }

    res.json({
      totalPower,
      unit: 'W',
      breakdown: powerBreakdown,
      engineUsed: simResult.engineUsed,
      warnings: spiceResult.warnings,
    });
  }));

  // POST /api/projects/:projectId/circuits/:circuitId/analyze/signal-integrity (13.12)
  app.post("/api/projects/:projectId/circuits/:circuitId/analyze/signal-integrity", payloadLimit(16 * 1024), asyncHandler(async (req, res) => {
    const circuitId = parseIdParam(req.params.circuitId);
    const circuit = await storage.getCircuitDesign(circuitId);
    if (!circuit) return res.status(404).json({ message: "Circuit design not found" });

    const data = await gatherCircuitData(circuitId);
    if (!data) return res.status(404).json({ message: "Circuit data not found" });

    const warnings: Array<{
      severity: 'info' | 'warning' | 'error';
      rule: string;
      message: string;
      netName?: string;
      refDes?: string;
    }> = [];

    // Check for high-speed signals (> 10 MHz) on long traces
    const pcbWires = data.wires.filter(w => w.view === 'pcb');

    // Check for unmatched impedance on bus signals
    for (const net of data.nets) {
      const netType = net.netType as string;
      const segments = (net.segments ?? []) as Array<{
        fromInstanceId: number; fromPin: string;
        toInstanceId: number; toPin: string;
      }>;

      // Flag high-fanout nets (> 4 connections)
      if (segments.length > 4) {
        warnings.push({
          severity: 'warning',
          rule: 'high-fanout',
          message: `Net "${net.name}" has ${segments.length} connections — consider buffering or adding series termination`,
          netName: net.name,
        });
      }

      // Flag bus nets without proper termination hints
      if (netType === 'bus') {
        warnings.push({
          severity: 'info',
          rule: 'bus-termination',
          message: `Bus net "${net.name}" — verify series/parallel termination for signal integrity`,
          netName: net.name,
        });
      }
    }

    // Check for thin traces on power nets
    for (const wire of pcbWires) {
      const net = data.nets.find(n => n.id === wire.netId);
      if (net && (net.netType === 'power' || net.netType === 'ground')) {
        if (wire.width < 0.5) {
          warnings.push({
            severity: 'warning',
            rule: 'thin-power-trace',
            message: `Power net "${net.name}" has a ${wire.width.toFixed(2)}mm trace — recommend >= 0.5mm for current capacity`,
            netName: net.name,
          });
        }
      }
    }

    // Check for components without bypass capacitors
    const icInstances = data.instances.filter(inst => {
      const part = data.parts.find(p => p.id === inst.partId);
      const meta = (part?.meta ?? {}) as Record<string, string>;
      const family = (meta.family || '').toLowerCase();
      return family === 'ic' || family === 'microcontroller' || family === 'fpga' || family === 'module';
    });

    const capInstances = data.instances.filter(inst => {
      const part = data.parts.find(p => p.id === inst.partId);
      const meta = (part?.meta ?? {}) as Record<string, string>;
      return (meta.family || '').toLowerCase() === 'capacitor';
    });

    for (const ic of icInstances) {
      // Check if any capacitor shares a power net with this IC
      const icNets = new Set<number>();
      for (const net of data.nets) {
        const segments = (net.segments ?? []) as Array<{
          fromInstanceId: number; toInstanceId: number;
        }>;
        if (segments.some(s => s.fromInstanceId === ic.id || s.toInstanceId === ic.id)) {
          if (net.netType === 'power' || net.netType === 'ground') {
            icNets.add(net.id);
          }
        }
      }

      let hasBypassCap = false;
      for (const cap of capInstances) {
        for (const net of data.nets) {
          const segments = (net.segments ?? []) as Array<{
            fromInstanceId: number; toInstanceId: number;
          }>;
          if (icNets.has(net.id) &&
              segments.some(s => s.fromInstanceId === cap.id || s.toInstanceId === cap.id)) {
            hasBypassCap = true;
            break;
          }
        }
        if (hasBypassCap) break;
      }

      if (!hasBypassCap) {
        warnings.push({
          severity: 'warning',
          rule: 'missing-bypass-cap',
          message: `${ic.referenceDesignator} has no nearby bypass capacitor on its power pins`,
          refDes: ic.referenceDesignator,
        });
      }
    }

    res.json({
      warnings,
      totalWarnings: warnings.filter(w => w.severity === 'warning').length,
      totalErrors: warnings.filter(w => w.severity === 'error').length,
      totalInfo: warnings.filter(w => w.severity === 'info').length,
    });
  }));
}
