import type { Express } from "express";
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

// Helper to safely parse numeric IDs from route parameters. Throws a 400 error on invalid input.
function parseIdParam(param: any): number {
  const id = Number(param);
  if (!Number.isFinite(id)) {
    const err: any = new Error("Invalid id");
    err.status = 400;
    throw err;
  }
  return id;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // --- Projects ---

  app.get("/api/projects", async (_req, res) => {
    const projects = await storage.getProjects();
    res.json(projects);
  });

  app.get("/api/projects/:id", async (req, res) => {
    const project = await storage.getProject(parseIdParam(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  });

  app.post("/api/projects", async (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const project = await storage.createProject(parsed.data);
    res.status(201).json(project);
  });

  app.patch("/api/projects/:id", async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = insertProjectSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const updated = await storage.updateProject(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  });

  // --- Architecture Nodes ---

  app.get("/api/projects/:id/nodes", async (req, res) => {
    const nodes = await storage.getNodes(parseIdParam(req.params.id));
    res.json(nodes);
  });

  app.post("/api/projects/:id/nodes", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArchitectureNodeSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const node = await storage.createNode({ ...parsed.data, projectId });
    res.status(201).json(node);
  });

  app.put("/api/projects/:id/nodes", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const nodesArray = z.array(insertArchitectureNodeSchema.omit({ projectId: true })).safeParse(req.body);
    if (!nodesArray.success) return res.status(400).json({ message: nodesArray.error.message });
    await storage.deleteNodesByProject(projectId);
    const nodes = await storage.bulkCreateNodes(nodesArray.data.map(n => ({ ...n, projectId })));
    res.json(nodes);
  });

  // --- Architecture Edges ---

  app.get("/api/projects/:id/edges", async (req, res) => {
    const edges = await storage.getEdges(parseIdParam(req.params.id));
    res.json(edges);
  });

  app.post("/api/projects/:id/edges", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArchitectureEdgeSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const edge = await storage.createEdge({ ...parsed.data, projectId });
    res.status(201).json(edge);
  });

  app.put("/api/projects/:id/edges", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const edgesArray = z.array(insertArchitectureEdgeSchema.omit({ projectId: true })).safeParse(req.body);
    if (!edgesArray.success) return res.status(400).json({ message: edgesArray.error.message });
    await storage.deleteEdgesByProject(projectId);
    const edges = await storage.bulkCreateEdges(edgesArray.data.map(e => ({ ...e, projectId })));
    res.json(edges);
  });

  // --- BOM Items ---

  app.get("/api/projects/:id/bom", async (req, res) => {
    const items = await storage.getBomItems(parseIdParam(req.params.id));
    res.json(items);
  });

  app.post("/api/projects/:id/bom", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertBomItemSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createBomItem({ ...parsed.data, projectId });
    res.status(201).json(item);
  });

  app.patch("/api/bom/:id", async (req, res) => {
    const updated = await storage.updateBomItem(parseIdParam(req.params.id), req.body);
    if (!updated) return res.status(404).json({ message: "BOM item not found" });
    res.json(updated);
  });

  app.delete("/api/bom/:id", async (req, res) => {
    await storage.deleteBomItem(parseIdParam(req.params.id));
    res.status(204).end();
  });

  // --- Validation Issues ---

  app.get("/api/projects/:id/validation", async (req, res) => {
    const issues = await storage.getValidationIssues(parseIdParam(req.params.id));
    res.json(issues);
  });

  app.post("/api/projects/:id/validation", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertValidationIssueSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const issue = await storage.createValidationIssue({ ...parsed.data, projectId });
    res.status(201).json(issue);
  });

  app.delete("/api/validation/:id", async (req, res) => {
    await storage.deleteValidationIssue(parseIdParam(req.params.id));
    res.status(204).end();
  });

  app.put("/api/projects/:id/validation", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const issuesArray = z.array(insertValidationIssueSchema.omit({ projectId: true })).safeParse(req.body);
    if (!issuesArray.success) return res.status(400).json({ message: issuesArray.error.message });
    await storage.deleteValidationIssuesByProject(projectId);
    const issues = await storage.bulkCreateValidationIssues(issuesArray.data.map(i => ({ ...i, projectId })));
    res.json(issues);
  });

  // --- Chat Messages ---

  app.get("/api/projects/:id/chat", async (req, res) => {
    const messages = await storage.getChatMessages(parseIdParam(req.params.id));
    res.json(messages);
  });

  app.post("/api/projects/:id/chat", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertChatMessageSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const msg = await storage.createChatMessage({ ...parsed.data, projectId });
    res.status(201).json(msg);
  });

  // --- History ---

  app.get("/api/projects/:id/history", async (req, res) => {
    const items = await storage.getHistoryItems(parseIdParam(req.params.id));
    res.json(items);
  });

  app.post("/api/projects/:id/history", async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertHistoryItemSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const item = await storage.createHistoryItem({ ...parsed.data, projectId });
    res.status(201).json(item);
  });

  // --- Seed / Init default project ---

  app.post("/api/seed", async (_req, res) => {
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
      { projectId: project.id, partNumber: "ESP32-S3-WROOM-1", manufacturer: "Espressif", description: "Wi-Fi/BLE MCU Module", quantity: 1, unitPrice: 3.50, totalPrice: 3.50, supplier: "Mouser", stock: 1240, status: "In Stock" },
      { projectId: project.id, partNumber: "TP4056", manufacturer: "Top Power", description: "Li-Ion Charger IC", quantity: 1, unitPrice: 0.15, totalPrice: 0.15, supplier: "LCSC", stock: 50000, status: "In Stock" },
      { projectId: project.id, partNumber: "SX1262IMLTRT", manufacturer: "Semtech", description: "LoRa Transceiver", quantity: 1, unitPrice: 4.20, totalPrice: 4.20, supplier: "Digi-Key", stock: 85, status: "Low Stock" },
      { projectId: project.id, partNumber: "SHT40-AD1B-R2", manufacturer: "Sensirion", description: "Sensor Humidity/Temp", quantity: 1, unitPrice: 1.85, totalPrice: 1.85, supplier: "Mouser", stock: 5000, status: "In Stock" },
      { projectId: project.id, partNumber: "USB4105-GF-A", manufacturer: "GCT", description: "USB Type-C Receptacle", quantity: 1, unitPrice: 0.65, totalPrice: 0.65, supplier: "Digi-Key", stock: 12000, status: "In Stock" },
    ];
    for (const item of bomData) {
      await storage.createBomItem(item);
    }

    await storage.bulkCreateValidationIssues([
      { projectId: project.id, severity: "warning", message: "Missing decoupling capacitor on ESP32 VDD", componentId: "1", suggestion: "Add 10uF + 0.1uF ceramic capacitors close to pins." },
      { projectId: project.id, severity: "error", message: "LoRa antenna path impedance mismatch likely", componentId: "3", suggestion: "Check RF trace width and add Pi-matching network." },
    ]);

    await storage.createChatMessage({ projectId: project.id, role: "system", content: "Welcome to ProtoPulse AI. I can help you generate architectures, create schematics, and optimize your BOM.", mode: "chat" });

    await storage.createHistoryItem({ projectId: project.id, action: "Project Created", user: "User" });
    await storage.createHistoryItem({ projectId: project.id, action: "Added ESP32-S3", user: "User" });
    await storage.createHistoryItem({ projectId: project.id, action: "Auto-connected Power Rails", user: "AI" });

    res.status(201).json({ message: "Seeded successfully", project });
  });

  // --- AI Chat Endpoint ---

  app.post("/api/chat/ai", async (req, res) => {
    const aiRequestSchema = z.object({
      message: z.string().min(1),
      provider: z.enum(["anthropic", "gemini"]),
      model: z.string().min(1),
      apiKey: z.string().min(1),
      projectId: z.number().optional(),
      activeView: z.string().optional(),
      schematicSheets: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
      activeSheetId: z.string().optional(),
    });

    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + parsed.error.message });
    }

    const { message, provider, model, apiKey, projectId: reqProjectId } = parsed.data;
    const pid = reqProjectId || 1;

    const [nodes, edges, bomData, validation, chatHistory, project] = await Promise.all([
      storage.getNodes(pid),
      storage.getEdges(pid),
      storage.getBomItems(pid),
      storage.getValidationIssues(pid),
      storage.getChatMessages(pid),
      storage.getProject(pid),
    ]);

    const appState = {
      projectName: project?.name || "Untitled",
      projectDescription: project?.description || "",
      activeView: parsed.data.activeView || "architecture",
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
      })),
      bom: bomData.map(b => ({
        id: String(b.id),
        partNumber: b.partNumber,
        manufacturer: b.manufacturer,
        description: b.description,
        quantity: b.quantity,
        unitPrice: b.unitPrice,
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
      schematicSheets: parsed.data.schematicSheets || [],
      activeSheetId: parsed.data.activeSheetId || "top",
      chatHistory: chatHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    const result = await processAIMessage({
      message,
      provider,
      model,
      apiKey,
      appState,
    });

    res.json(result);
  });

  app.post("/api/chat/ai/stream", async (req, res) => {
    const aiRequestSchema = z.object({
      message: z.string().min(1),
      provider: z.enum(["anthropic", "gemini"]),
      model: z.string().min(1),
      apiKey: z.string().min(1),
      projectId: z.number().optional(),
      activeView: z.string().optional(),
      schematicSheets: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
      activeSheetId: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      customSystemPrompt: z.string().optional(),
    });

    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + parsed.error.message });
    }

    const { message, provider, model, apiKey, projectId: reqProjectId, temperature } = parsed.data;
    const pid = reqProjectId || 1;

    const [nodes, edges, bomData, validation, chatHistory, project] = await Promise.all([
      storage.getNodes(pid),
      storage.getEdges(pid),
      storage.getBomItems(pid),
      storage.getValidationIssues(pid),
      storage.getChatMessages(pid),
      storage.getProject(pid),
    ]);

    const appState = {
      projectName: project?.name || "Untitled",
      projectDescription: project?.description || "",
      activeView: parsed.data.activeView || "architecture",
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
      })),
      bom: bomData.map(b => ({
        id: String(b.id),
        partNumber: b.partNumber,
        manufacturer: b.manufacturer,
        description: b.description,
        quantity: b.quantity,
        unitPrice: b.unitPrice,
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
      schematicSheets: parsed.data.schematicSheets || [],
      activeSheetId: parsed.data.activeSheetId || "top",
      chatHistory: chatHistory.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      })),
      customSystemPrompt: parsed.data.customSystemPrompt || "",
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let closed = false;
    req.on('close', () => { closed = true; });

    try {
      await streamAIMessage(
        { message, provider, model, apiKey, appState, temperature },
        (chunk) => {
          if (!closed) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
          }
        },
        (result) => {
          if (!closed) {
            res.write(`data: ${JSON.stringify({ type: 'done', message: result.message, actions: result.actions })}\n\n`);
            res.end();
          }
        }
      );
    } catch (error: any) {
      if (!closed) {
        res.write(`data: ${JSON.stringify({ type: 'error', message: error.message || 'Stream failed' })}\n\n`);
        res.end();
      }
    }
  });

  return httpServer;
}
