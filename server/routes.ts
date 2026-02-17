import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { processAIMessage, streamAIMessage } from "./ai";
import {
  insertProjectSchema,
  insertArchitectureNodeSchema,
  insertArchitectureEdgeSchema,
  insertBomItemSchema,
  insertValidationIssueSchema,
  insertChatMessageSchema,
  insertHistoryItemSchema,
} from "@shared/schema";
import { z } from "zod";

const MAX_CHAT_HISTORY = 10;

class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function parseIdParam(param: any): number {
  const id = Number(param);
  if (!Number.isFinite(id)) {
    throw new HttpError("Invalid id", 400);
  }
  return id;
}

const aiRequestSchema = z.object({
  message: z.string().min(1).max(32000),
  provider: z.enum(["anthropic", "gemini"]),
  model: z.string().min(1).max(200),
  apiKey: z.string().min(1).max(500),
  projectId: z.number(),
  activeView: z.string().optional(),
  schematicSheets: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  activeSheetId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  customSystemPrompt: z.string().max(10000).optional(),
  selectedNodeId: z.string().nullable().optional(),
  changeDiff: z.string().max(50000).optional(),
});

async function buildAppStateFromProject(
  projectId: number,
  options: {
    activeView?: string;
    schematicSheets?: Array<{ id: string; name: string }>;
    activeSheetId?: string;
    selectedNodeId?: string | null;
    customSystemPrompt?: string;
    changeDiff?: string;
  }
) {
  const [nodes, edges, bomData, validation, chatHistory, project] = await Promise.all([
    storage.getNodes(projectId),
    storage.getEdges(projectId),
    storage.getBomItems(projectId),
    storage.getValidationIssues(projectId),
    storage.getChatMessages(projectId),
    storage.getProject(projectId),
  ]);

  return {
    projectName: project?.name || "Untitled",
    projectDescription: project?.description || "",
    activeView: options.activeView || "architecture",
    selectedNodeId: options.selectedNodeId || null,
    nodes: nodes.map(n => ({
      id: n.nodeId,
      label: n.label,
      type: n.nodeType,
      description: (n.data as any)?.description,
      positionX: n.positionX,
      positionY: n.positionY,
    })),
    edges: edges.map(e => ({
      id: e.edgeId,
      source: e.source,
      target: e.target,
      label: e.label || undefined,
      signalType: e.signalType || undefined,
      voltage: e.voltage || undefined,
      busWidth: e.busWidth || undefined,
      netName: e.netName || undefined,
    })),
    bom: bomData.map(b => ({
      id: String(b.id),
      partNumber: b.partNumber,
      manufacturer: b.manufacturer,
      description: b.description,
      quantity: b.quantity,
      unitPrice: Number(b.unitPrice),
      supplier: b.supplier,
      status: b.status,
    })),
    validationIssues: validation.map(v => ({
      id: String(v.id),
      severity: v.severity,
      message: v.message,
      componentId: v.componentId || undefined,
      suggestion: v.suggestion || undefined,
    })),
    schematicSheets: options.schematicSheets || [],
    activeSheetId: options.activeSheetId || "top",
    chatHistory: chatHistory.slice(-MAX_CHAT_HISTORY).map(m => ({
      role: m.role,
      content: m.content,
    })),
    customSystemPrompt: options.customSystemPrompt || "",
    changeDiff: options.changeDiff || "",
  };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- Projects ---

  app.get("/api/projects", asyncHandler(async (_req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  }));

  app.get("/api/projects/:id", asyncHandler(async (req, res) => {
    const project = await storage.getProject(parseIdParam(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  }));

  app.post("/api/projects", asyncHandler(async (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const project = await storage.createProject(parsed.data);
    res.status(201).json(project);
  }));

  app.patch("/api/projects/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = insertProjectSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    if (parsed.data.name !== undefined && parsed.data.name.trim().length === 0) {
      return res.status(400).json({ message: "Project name cannot be empty" });
    }
    const updated = await storage.updateProject(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  }));

  // --- Architecture Nodes ---

  app.get("/api/projects/:id/nodes", asyncHandler(async (req, res) => {
    const nodes = await storage.getNodes(parseIdParam(req.params.id));
    res.json(nodes);
  }));

  app.post("/api/projects/:id/nodes", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArchitectureNodeSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const node = await storage.createNode({ ...parsed.data, projectId });
    res.status(201).json(node);
  }));

  app.put("/api/projects/:id/nodes", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const nodesArray = z.array(insertArchitectureNodeSchema.omit({ projectId: true })).safeParse(req.body);
    if (!nodesArray.success) return res.status(400).json({ message: nodesArray.error.message });
    const nodes = await storage.replaceNodes(projectId, nodesArray.data.map(n => ({ ...n, projectId })));
    res.json(nodes);
  }));

  // --- Architecture Edges ---

  app.get("/api/projects/:id/edges", asyncHandler(async (req, res) => {
    const edges = await storage.getEdges(parseIdParam(req.params.id));
    res.json(edges);
  }));

  app.post("/api/projects/:id/edges", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArchitectureEdgeSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const edge = await storage.createEdge({ ...parsed.data, projectId });
    res.status(201).json(edge);
  }));

  app.put("/api/projects/:id/edges", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const edgesArray = z.array(insertArchitectureEdgeSchema.omit({ projectId: true })).safeParse(req.body);
    if (!edgesArray.success) return res.status(400).json({ message: edgesArray.error.message });
    const edges = await storage.replaceEdges(projectId, edgesArray.data.map(e => ({ ...e, projectId })));
    res.json(edges);
  }));

  // --- BOM Items ---

  app.get("/api/projects/:id/bom", asyncHandler(async (req, res) => {
    const items = await storage.getBomItems(parseIdParam(req.params.id));
    res.json(items);
  }));

  app.post("/api/projects/:id/bom", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertBomItemSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createBomItem({ ...parsed.data, projectId });
    res.status(201).json(item);
  }));

  app.patch("/api/bom/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const projectId = parseIdParam(req.query.projectId);
    const parsed = insertBomItemSchema.partial().omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateBomItem(id, projectId, parsed.data);
    if (!updated) return res.status(404).json({ message: "BOM item not found" });
    res.json(updated);
  }));

  app.delete("/api/bom/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const projectId = parseIdParam(req.query.projectId);
    const deleted = await storage.deleteBomItem(id, projectId);
    if (!deleted) return res.status(404).json({ message: "BOM item not found" });
    res.status(204).end();
  }));

  // --- Validation Issues ---

  app.get("/api/projects/:id/validation", asyncHandler(async (req, res) => {
    const issues = await storage.getValidationIssues(parseIdParam(req.params.id));
    res.json(issues);
  }));

  app.post("/api/projects/:id/validation", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertValidationIssueSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const issue = await storage.createValidationIssue({ ...parsed.data, projectId });
    res.status(201).json(issue);
  }));

  app.delete("/api/validation/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const projectId = parseIdParam(req.query.projectId);
    const deleted = await storage.deleteValidationIssue(id, projectId);
    if (!deleted) return res.status(404).json({ message: "Validation issue not found" });
    res.status(204).end();
  }));

  app.put("/api/projects/:id/validation", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const issuesArray = z.array(insertValidationIssueSchema.omit({ projectId: true })).safeParse(req.body);
    if (!issuesArray.success) return res.status(400).json({ message: issuesArray.error.message });
    const issues = await storage.replaceValidationIssues(projectId, issuesArray.data.map(i => ({ ...i, projectId })));
    res.json(issues);
  }));

  // --- Chat Messages ---

  app.get("/api/projects/:id/chat", asyncHandler(async (req, res) => {
    const messages = await storage.getChatMessages(parseIdParam(req.params.id));
    res.json(messages);
  }));

  app.post("/api/projects/:id/chat", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertChatMessageSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const msg = await storage.createChatMessage({ ...parsed.data, projectId });
    res.status(201).json(msg);
  }));

  // --- History ---

  app.get("/api/projects/:id/history", asyncHandler(async (req, res) => {
    const items = await storage.getHistoryItems(parseIdParam(req.params.id));
    res.json(items);
  }));

  app.post("/api/projects/:id/history", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertHistoryItemSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createHistoryItem({ ...parsed.data, projectId });
    res.status(201).json(item);
  }));

  // --- Seed / Init default project ---

  app.post("/api/seed", asyncHandler(async (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }
    const existingProjects = await storage.getProjects();
    if (existingProjects.length > 0) {
      return res.json({ message: "Already seeded", project: existingProjects[0] });
    }

    const project = await storage.createProject({ name: "Smart_Agro_Node_v1", description: "IoT Agriculture Sensor Node" });

    await storage.bulkCreateNodes([
      { projectId: project.id, nodeId: "1", nodeType: "mcu", label: "ESP32-S3-WROOM-1", positionX: 400, positionY: 100, data: { description: "Dual-core MCU, Wi-Fi/BLE" } },
      { projectId: project.id, nodeId: "2", nodeType: "power", label: "TP4056 PMU", positionX: 150, positionY: 250, data: { description: "Li-Ion Battery Charger" } },
      { projectId: project.id, nodeId: "3", nodeType: "comm", label: "SX1262 LoRa", positionX: 650, positionY: 250, data: { description: "Long Range Transceiver" } },
      { projectId: project.id, nodeId: "4", nodeType: "sensor", label: "SHT40", positionX: 400, positionY: 400, data: { description: "Temp/Humidity Sensor" } },
      { projectId: project.id, nodeId: "5", nodeType: "connector", label: "USB-C Connector", positionX: 150, positionY: 100, data: { description: "Power/Data Input" } },
    ]);

    await storage.bulkCreateEdges([
      { projectId: project.id, edgeId: "e5-2", source: "5", target: "2", animated: true, label: "5V VBUS", style: { stroke: "#ef4444" } },
      { projectId: project.id, edgeId: "e2-1", source: "2", target: "1", animated: true, label: "3.3V", style: { stroke: "#ef4444" } },
      { projectId: project.id, edgeId: "e1-3", source: "1", target: "3", animated: true, label: "SPI", style: { stroke: "#06b6d4" } },
      { projectId: project.id, edgeId: "e1-4", source: "1", target: "4", animated: true, label: "I2C", style: { stroke: "#06b6d4" } },
    ]);

    const bomData = [
      { projectId: project.id, partNumber: "ESP32-S3-WROOM-1", manufacturer: "Espressif", description: "Wi-Fi/BLE MCU Module", quantity: 1, unitPrice: "3.5000", totalPrice: "3.5000", supplier: "Mouser", stock: 1240, status: "In Stock" },
      { projectId: project.id, partNumber: "TP4056", manufacturer: "Top Power", description: "Li-Ion Charger IC", quantity: 1, unitPrice: "0.1500", totalPrice: "0.1500", supplier: "LCSC", stock: 50000, status: "In Stock" },
      { projectId: project.id, partNumber: "SX1262IMLTRT", manufacturer: "Semtech", description: "LoRa Transceiver", quantity: 1, unitPrice: "4.2000", totalPrice: "4.2000", supplier: "Digi-Key", stock: 85, status: "Low Stock" },
      { projectId: project.id, partNumber: "SHT40-AD1B-R2", manufacturer: "Sensirion", description: "Sensor Humidity/Temp", quantity: 1, unitPrice: "1.8500", totalPrice: "1.8500", supplier: "Mouser", stock: 5000, status: "In Stock" },
      { projectId: project.id, partNumber: "USB4105-GF-A", manufacturer: "GCT", description: "USB Type-C Receptacle", quantity: 1, unitPrice: "0.6500", totalPrice: "0.6500", supplier: "Digi-Key", stock: 12000, status: "In Stock" },
    ];
    await Promise.all(bomData.map(item => storage.createBomItem(item)));

    await storage.bulkCreateValidationIssues([
      { projectId: project.id, severity: "warning", message: "Missing decoupling capacitor on ESP32 VDD", componentId: "1", suggestion: "Add 10uF + 0.1uF ceramic capacitors close to pins." },
      { projectId: project.id, severity: "error", message: "LoRa antenna path impedance mismatch likely", componentId: "3", suggestion: "Check RF trace width and add Pi-matching network." },
    ]);

    await storage.createChatMessage({ projectId: project.id, role: "system", content: "Welcome to ProtoPulse AI. I can help you generate architectures, create schematics, and optimize your BOM.", mode: "chat" });

    await storage.createHistoryItem({ projectId: project.id, action: "Project Created", user: "User" });
    await storage.createHistoryItem({ projectId: project.id, action: "Added ESP32-S3", user: "User" });
    await storage.createHistoryItem({ projectId: project.id, action: "Auto-connected Power Rails", user: "AI" });

    res.status(201).json({ message: "Seeded successfully", project });
  }));

  // --- AI Chat Endpoint ---

  app.post("/api/chat/ai", asyncHandler(async (req, res) => {
    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + parsed.error.message });
    }

    const { message, provider, model, apiKey, temperature } = parsed.data;
    const pid = parsed.data.projectId;

    const appState = await buildAppStateFromProject(pid, {
      activeView: parsed.data.activeView,
      schematicSheets: parsed.data.schematicSheets,
      activeSheetId: parsed.data.activeSheetId,
      selectedNodeId: parsed.data.selectedNodeId,
      customSystemPrompt: parsed.data.customSystemPrompt,
      changeDiff: parsed.data.changeDiff,
    });

    const result = await processAIMessage({
      message,
      provider,
      model,
      apiKey,
      appState,
      temperature: temperature ?? 0.7,
    });

    res.json(result);
  }));

  app.post("/api/chat/ai/stream", asyncHandler(async (req, res) => {
    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + parsed.error.message });
    }

    const { message, provider, model, apiKey, temperature } = parsed.data;
    const pid = parsed.data.projectId;

    const appState = await buildAppStateFromProject(pid, {
      activeView: parsed.data.activeView,
      schematicSheets: parsed.data.schematicSheets,
      activeSheetId: parsed.data.activeSheetId,
      selectedNodeId: parsed.data.selectedNodeId,
      customSystemPrompt: parsed.data.customSystemPrompt,
      changeDiff: parsed.data.changeDiff,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abortController = new AbortController();
    let closed = false;
    const streamTimeout = setTimeout(() => {
      if (!closed) {
        closed = true;
        res.write(`data: ${JSON.stringify({ type: 'error', message: 'Stream timed out after 120 seconds' })}\n\n`);
        res.end();
      }
    }, 120000);
    req.on('close', () => {
      closed = true;
      abortController.abort();
      clearTimeout(streamTimeout);
    });

    const writeWithBackpressure = (data: string): Promise<void> => {
      return new Promise((resolve) => {
        if (closed) { resolve(); return; }
        const ok = res.write(data);
        if (ok) { resolve(); return; }
        res.once('drain', resolve);
      });
    };

    try {
      await streamAIMessage(
        { message, provider, model, apiKey, appState, temperature: temperature ?? 0.7 },
        async (chunk) => {
          if (!closed) {
            await writeWithBackpressure(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
          }
        },
        async (result) => {
          clearTimeout(streamTimeout);
          if (!closed) {
            await writeWithBackpressure(`data: ${JSON.stringify({ type: 'done', message: result.message, actions: result.actions })}\n\n`);
            res.end();
          }
        },
        abortController.signal
      );
    } catch (error: any) {
      clearTimeout(streamTimeout);
      if (!closed) {
        const safeMessage = (error?.message || 'Stream failed').replace(/sk-[a-zA-Z0-9]+/g, '[REDACTED]').replace(/AIza[a-zA-Z0-9_-]+/g, '[REDACTED]');
        res.write(`data: ${JSON.stringify({ type: 'error', message: safeMessage })}\n\n`);
        res.end();
      }
    }
  }));

  return httpServer;
}
