import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { exportToFzpz, importFromFzpz } from "./component-export";
import { parseSvgToShapes } from "./svg-parser";
import type { PartMeta, Connector, PartViews, Bus, Constraint, PartState } from "@shared/component-types";
import { runDRC, getDefaultDRCRules } from "@shared/drc-engine";
import { db } from "./db";
import { processAIMessage, streamAIMessage, categorizeError } from "./ai";
import { createUser, getUserByUsername, verifyPassword, createSession, deleteSession, getUserById, validateSession, storeApiKey, getApiKey, deleteApiKey, listApiKeyProviders } from "./auth";
import { fromZodError } from "zod-validation-error";
import { isNotNull, lte, and, isNull } from "drizzle-orm";
import {
  insertProjectSchema,
  insertArchitectureNodeSchema,
  insertArchitectureEdgeSchema,
  insertBomItemSchema,
  insertValidationIssueSchema,
  insertChatMessageSchema,
  insertHistoryItemSchema,
  insertComponentPartSchema,
  insertComponentLibrarySchema,
  componentParts,
  projects,
  architectureNodes,
  architectureEdges,
  bomItems,
  validationIssues,
  chatMessages,
  historyItems,
} from "@shared/schema";
import { z } from "zod";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(["asc", "desc"]).default("desc"),
});

const MAX_CHAT_HISTORY = 10;

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function parseIdParam(param: unknown): number {
  const id = Number(param);
  if (!Number.isFinite(id)) {
    throw new HttpError("Invalid id", 400);
  }
  return id;
}

export function payloadLimit(maxBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      return res.status(413).json({ message: `Payload too large. Maximum size is ${Math.round(maxBytes / 1024)}KB` });
    }
    next();
  };
}

const aiRequestSchema = z.object({
  message: z.string().min(1).max(32000),
  provider: z.enum(["anthropic", "gemini"]),
  model: z.string().min(1).max(200),
  apiKey: z.string().max(500).optional().default(''),
  projectId: z.number(),
  activeView: z.string().optional(),
  schematicSheets: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  activeSheetId: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(256).max(16384).optional(),
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
      description: (n.data as Record<string, unknown> | null)?.description as string | undefined,
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
    chatHistory: chatHistory.slice(0, MAX_CHAT_HISTORY).reverse().map(m => ({
      role: m.role,
      content: m.content,
    })),
    customSystemPrompt: options.customSystemPrompt || "",
    changeDiff: options.changeDiff || "",
  };
}

function buildSeedComponentPart(projectId: number) {
  const pinNames = ["VCC", "PB0", "PB1", "PB2", "PB3", "PB4", "GND", "PB5"];
  const pinTypes: Array<"power" | "io"> = ["power", "io", "io", "io", "io", "io", "power", "io"];

  const connectors = pinNames.map((name, i) => {
    const pinNum = i + 1;
    const isLeft = pinNum <= 4;
    const row = isLeft ? i : 7 - i;
    const x = isLeft ? 20 : 180;
    const y = 35 + row * 70;
    return {
      id: `pin${pinNum}`,
      name,
      description: `Pin ${pinNum} - ${name} (${pinTypes[i]})`,
      connectorType: "pad" as const,
      shapeIds: {
        breadboard: [`pin${pinNum}-bb`],
        schematic: [`pin${pinNum}-sch`],
        pcb: [`pin${pinNum}-pcb`],
      },
      terminalPositions: {
        breadboard: { x, y },
        schematic: { x, y },
        pcb: { x, y },
      },
      padSpec: {
        type: "tht" as const,
        shape: "circle" as const,
        diameter: 1.6,
        drill: 0.8,
      },
    };
  });

  const leftPinsBB = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 1}-bb`, type: "rect" as const, x: 20, y: 30 + i * 70, width: 20, height: 10, rotation: 0,
    style: { fill: "#C0C0C0", stroke: "#999999", strokeWidth: 1 },
  }));
  const rightPinsBB = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 5}-bb`, type: "rect" as const, x: 160, y: 240 - i * 70, width: 20, height: 10, rotation: 0,
    style: { fill: "#C0C0C0", stroke: "#999999", strokeWidth: 1 },
  }));
  const leftPinsSch = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 1}-sch`, type: "rect" as const, x: 0, y: 30 + i * 70, width: 20, height: 10, rotation: 0,
    style: { fill: "#C0C0C0", stroke: "#000000", strokeWidth: 1 },
  }));
  const rightPinsSch = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 5}-sch`, type: "rect" as const, x: 180, y: 240 - i * 70, width: 20, height: 10, rotation: 0,
    style: { fill: "#C0C0C0", stroke: "#000000", strokeWidth: 1 },
  }));
  const leftPinsPcb = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 1}-pcb`, type: "circle" as const, x: 20, y: 30 + i * 70, width: 16, height: 16,
    cx: 28, cy: 35 + i * 70, rotation: 0, style: { fill: "#C0C0C0", stroke: "#999999", strokeWidth: 1 },
  }));
  const rightPinsPcb = Array.from({ length: 4 }, (_, i) => ({
    id: `pin${i + 5}-pcb`, type: "circle" as const, x: 164, y: 240 - i * 70, width: 16, height: 16,
    cx: 172, cy: 245 - i * 70, rotation: 0, style: { fill: "#C0C0C0", stroke: "#999999", strokeWidth: 1 },
  }));

  return {
    projectId,
    meta: {
      title: "ATtiny85",
      family: "Microcontroller",
      description: "8-bit AVR Microcontroller, 8-pin DIP",
      manufacturer: "Microchip",
      mpn: "ATTINY85-20PU",
      mountingType: "tht",
      packageType: "DIP",
      tags: ["microcontroller", "AVR", "8-bit", "DIP-8"],
      properties: [],
    },
    connectors,
    buses: [],
    views: {
      breadboard: {
        shapes: [
          { id: "body-bb", type: "rect" as const, x: 40, y: 0, width: 120, height: 280, rotation: 0, style: { fill: "#333333", stroke: "#000000", strokeWidth: 2 } },
          { id: "notch-bb", type: "circle" as const, x: 90, y: 5, width: 20, height: 20, cx: 100, cy: 15, rotation: 0, style: { fill: "#555555", stroke: "#444444", strokeWidth: 1 } },
          { id: "label-bb", type: "text" as const, x: 55, y: 140, width: 90, height: 20, rotation: 0, text: "ATtiny85", style: { fill: "#FFFFFF", fontSize: 11, fontFamily: "monospace", textAnchor: "middle" } },
          ...leftPinsBB,
          ...rightPinsBB,
        ],
      },
      schematic: {
        shapes: [
          { id: "body-sch", type: "rect" as const, x: 20, y: 0, width: 160, height: 280, rotation: 0, style: { fill: "#FFFFFF", stroke: "#000000", strokeWidth: 2 } },
          { id: "label-sch", type: "text" as const, x: 60, y: 140, width: 80, height: 20, rotation: 0, text: "ATtiny85", style: { fontSize: 12, fontFamily: "monospace", textAnchor: "middle" } },
          ...leftPinsSch,
          ...rightPinsSch,
        ],
      },
      pcb: {
        shapes: [
          { id: "body-pcb", type: "rect" as const, x: 40, y: 0, width: 120, height: 280, rotation: 0, style: { fill: "#1a1a1a", stroke: "#333333", strokeWidth: 1 } },
          ...leftPinsPcb,
          ...rightPinsPcb,
        ],
      },
    },
    constraints: [],
  };
}

export async function registerRoutes(app: Express): Promise<void> {

  // --- Auth ---

  app.post("/api/auth/register", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const schema = z.object({
      username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
      password: z.string().min(6).max(128),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });

    const existing = await getUserByUsername(parsed.data.username);
    if (existing) return res.status(409).json({ message: "Username already taken" });

    const user = await createUser(parsed.data.username, parsed.data.password);
    const sessionId = await createSession(user.id);
    res.status(201).json({ sessionId, user: { id: user.id, username: user.username } });
  }));

  app.post("/api/auth/login", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    const schema = z.object({
      username: z.string().min(1),
      password: z.string().min(1),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });

    const user = await getUserByUsername(parsed.data.username);
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const valid = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) return res.status(401).json({ message: "Invalid credentials" });

    const sessionId = await createSession(user.id);
    res.json({ sessionId, user: { id: user.id, username: user.username } });
  }));

  app.post("/api/auth/logout", asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (sessionId) await deleteSession(sessionId);
    res.status(204).end();
  }));

  app.get("/api/auth/me", asyncHandler(async (req, res) => {
    const sessionId = req.headers['x-session-id'] as string;
    if (!sessionId) return res.status(401).json({ message: "Not authenticated" });

    const session = await validateSession(sessionId);
    if (!session) return res.status(401).json({ message: "Invalid session" });

    const user = await getUserById(session.userId);
    if (!user) return res.status(401).json({ message: "User not found" });

    res.json({ id: user.id, username: user.username });
  }));

  // --- API Key Management ---

  app.get("/api/settings/api-keys", asyncHandler(async (req, res) => {
    if (!req.userId) return res.status(401).json({ message: "Authentication required" });
    const providers = await listApiKeyProviders(req.userId);
    res.json({ providers });
  }));

  app.post("/api/settings/api-keys", payloadLimit(4 * 1024), asyncHandler(async (req, res) => {
    if (!req.userId) return res.status(401).json({ message: "Authentication required" });
    const schema = z.object({
      provider: z.enum(["anthropic", "gemini"]),
      apiKey: z.string().min(1).max(500),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });

    await storeApiKey(req.userId, parsed.data.provider, parsed.data.apiKey);
    res.json({ message: "API key stored" });
  }));

  app.delete("/api/settings/api-keys/:provider", asyncHandler(async (req, res) => {
    if (!req.userId) return res.status(401).json({ message: "Authentication required" });
    const provider = req.params.provider;
    if (provider !== "anthropic" && provider !== "gemini") {
      return res.status(400).json({ message: "Invalid provider" });
    }
    const deleted = await deleteApiKey(req.userId, provider);
    if (!deleted) return res.status(404).json({ message: "No API key found for this provider" });
    res.status(204).end();
  }));

  // --- Projects ---

  app.get("/api/projects", asyncHandler(async (req, res) => {
    const opts = paginationSchema.safeParse(req.query);
    const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
    const result = await storage.getProjects(pagination);
    res.json(result);
  }));

  app.get("/api/projects/:id", asyncHandler(async (req, res) => {
    const project = await storage.getProject(parseIdParam(req.params.id));
    if (!project) return res.status(404).json({ message: "Project not found" });
    res.json(project);
  }));

  app.post("/api/projects", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const parsed = insertProjectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const project = await storage.createProject(parsed.data);
    res.status(201).json(project);
  }));

  app.patch("/api/projects/:id", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const parsed = insertProjectSchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    if (parsed.data.name !== undefined && parsed.data.name.trim().length === 0) {
      return res.status(400).json({ message: "Project name cannot be empty" });
    }
    const updated = await storage.updateProject(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Project not found" });
    res.json(updated);
  }));

  app.delete("/api/projects/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteProject(id);
    if (!deleted) return res.status(404).json({ message: "Project not found" });
    res.status(204).end();
  }));

  // --- Architecture Nodes ---

  app.get("/api/projects/:id/nodes", asyncHandler(async (req, res) => {
    const opts = paginationSchema.safeParse(req.query);
    const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
    const nodes = await storage.getNodes(parseIdParam(req.params.id), pagination);
    res.json(nodes);
  }));

  app.post("/api/projects/:id/nodes", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArchitectureNodeSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const node = await storage.createNode({ ...parsed.data, projectId });
    res.status(201).json(node);
  }));

  app.patch("/api/projects/:id/nodes/:nodeId", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const nodeId = parseIdParam(req.params.nodeId);
    const parsed = insertArchitectureNodeSchema.partial().omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const updated = await storage.updateNode(nodeId, projectId, parsed.data);
    if (!updated) return res.status(404).json({ message: "Node not found" });
    res.json(updated);
  }));

  app.put("/api/projects/:id/nodes", payloadLimit(512 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const nodesArray = z.array(insertArchitectureNodeSchema.omit({ projectId: true })).safeParse(req.body);
    if (!nodesArray.success) return res.status(400).json({ message: fromZodError(nodesArray.error).toString() });
    const nodes = await storage.replaceNodes(projectId, nodesArray.data.map(n => ({ ...n, projectId })));
    res.json(nodes);
  }));

  // --- Architecture Edges ---

  app.get("/api/projects/:id/edges", asyncHandler(async (req, res) => {
    const opts = paginationSchema.safeParse(req.query);
    const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
    const edges = await storage.getEdges(parseIdParam(req.params.id), pagination);
    res.json(edges);
  }));

  app.post("/api/projects/:id/edges", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertArchitectureEdgeSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const edge = await storage.createEdge({ ...parsed.data, projectId });
    res.status(201).json(edge);
  }));

  app.patch("/api/projects/:id/edges/:edgeId", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const edgeId = parseIdParam(req.params.edgeId);
    const parsed = insertArchitectureEdgeSchema.partial().omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const updated = await storage.updateEdge(edgeId, projectId, parsed.data);
    if (!updated) return res.status(404).json({ message: "Edge not found" });
    res.json(updated);
  }));

  app.put("/api/projects/:id/edges", payloadLimit(512 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const edgesArray = z.array(insertArchitectureEdgeSchema.omit({ projectId: true })).safeParse(req.body);
    if (!edgesArray.success) return res.status(400).json({ message: fromZodError(edgesArray.error).toString() });
    const edges = await storage.replaceEdges(projectId, edgesArray.data.map(e => ({ ...e, projectId })));
    res.json(edges);
  }));

  // --- BOM Items ---

  app.get("/api/projects/:id/bom", asyncHandler(async (req, res) => {
    const opts = paginationSchema.safeParse(req.query);
    const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
    const items = await storage.getBomItems(parseIdParam(req.params.id), pagination);
    res.json(items);
  }));

  app.get("/api/projects/:id/bom/:bomId", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const bomId = parseIdParam(req.params.bomId);
    const item = await storage.getBomItem(bomId, projectId);
    if (!item) return res.status(404).json({ message: "BOM item not found" });
    res.json(item);
  }));

  app.post("/api/projects/:id/bom", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertBomItemSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const item = await storage.createBomItem({ ...parsed.data, projectId });
    res.status(201).json(item);
  }));

  app.patch("/api/projects/:id/bom/:bomId", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const bomId = parseIdParam(req.params.bomId);
    const parsed = insertBomItemSchema.partial().omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const updated = await storage.updateBomItem(bomId, projectId, parsed.data);
    if (!updated) return res.status(404).json({ message: "BOM item not found" });
    res.json(updated);
  }));

  app.delete("/api/projects/:id/bom/:bomId", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const bomId = parseIdParam(req.params.bomId);
    const deleted = await storage.deleteBomItem(bomId, projectId);
    if (!deleted) return res.status(404).json({ message: "BOM item not found" });
    res.status(204).end();
  }));

  // Deprecated: use /api/projects/:id/bom/:bomId instead
  app.patch("/api/bom/:id", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const projectId = parseIdParam(req.query.projectId);
    const parsed = insertBomItemSchema.partial().omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const updated = await storage.updateBomItem(id, projectId, parsed.data);
    if (!updated) return res.status(404).json({ message: "BOM item not found" });
    res.json(updated);
  }));

  // Deprecated: use /api/projects/:id/bom/:bomId instead
  app.delete("/api/bom/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const projectId = parseIdParam(req.query.projectId);
    const deleted = await storage.deleteBomItem(id, projectId);
    if (!deleted) return res.status(404).json({ message: "BOM item not found" });
    res.status(204).end();
  }));

  // --- Validation Issues ---

  app.get("/api/projects/:id/validation", asyncHandler(async (req, res) => {
    const opts = paginationSchema.safeParse(req.query);
    const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
    const issues = await storage.getValidationIssues(parseIdParam(req.params.id), pagination);
    res.json(issues);
  }));

  app.post("/api/projects/:id/validation", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertValidationIssueSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const issue = await storage.createValidationIssue({ ...parsed.data, projectId });
    res.status(201).json(issue);
  }));

  app.delete("/api/projects/:id/validation/:issueId", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const issueId = parseIdParam(req.params.issueId);
    const deleted = await storage.deleteValidationIssue(issueId, projectId);
    if (!deleted) return res.status(404).json({ message: "Validation issue not found" });
    res.status(204).end();
  }));

  // Deprecated: use /api/projects/:id/validation/:issueId instead
  app.delete("/api/validation/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const projectId = parseIdParam(req.query.projectId);
    const deleted = await storage.deleteValidationIssue(id, projectId);
    if (!deleted) return res.status(404).json({ message: "Validation issue not found" });
    res.status(204).end();
  }));

  app.put("/api/projects/:id/validation", payloadLimit(512 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const issuesArray = z.array(insertValidationIssueSchema.omit({ projectId: true })).safeParse(req.body);
    if (!issuesArray.success) return res.status(400).json({ message: fromZodError(issuesArray.error).toString() });
    const issues = await storage.replaceValidationIssues(projectId, issuesArray.data.map(i => ({ ...i, projectId })));
    res.json(issues);
  }));

  // --- Chat Messages ---

  app.get("/api/projects/:id/chat", asyncHandler(async (req, res) => {
    const opts = paginationSchema.safeParse(req.query);
    const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
    const messages = await storage.getChatMessages(parseIdParam(req.params.id), pagination);
    res.json(messages);
  }));

  app.post("/api/projects/:id/chat", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertChatMessageSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const msg = await storage.createChatMessage({ ...parsed.data, projectId });
    res.status(201).json(msg);
  }));

  app.delete("/api/projects/:id/chat", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    await storage.deleteChatMessages(projectId);
    res.status(204).end();
  }));

  app.delete("/api/projects/:id/chat/:msgId", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const msgId = parseIdParam(req.params.msgId);
    const deleted = await storage.deleteChatMessage(msgId, projectId);
    if (!deleted) return res.status(404).json({ message: "Chat message not found" });
    res.status(204).end();
  }));

  // --- History ---

  app.get("/api/projects/:id/history", asyncHandler(async (req, res) => {
    const opts = paginationSchema.safeParse(req.query);
    const pagination = opts.success ? opts.data : { limit: 50, offset: 0, sort: 'desc' as const };
    const items = await storage.getHistoryItems(parseIdParam(req.params.id), pagination);
    res.json(items);
  }));

  app.post("/api/projects/:id/history", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const parsed = insertHistoryItemSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const item = await storage.createHistoryItem({ ...parsed.data, projectId });
    res.status(201).json(item);
  }));

  app.delete("/api/projects/:id/history", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    await storage.deleteHistoryItems(projectId);
    res.status(204).end();
  }));

  app.delete("/api/projects/:id/history/:itemId", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.id);
    const itemId = parseIdParam(req.params.itemId);
    const deleted = await storage.deleteHistoryItem(itemId, projectId);
    if (!deleted) return res.status(404).json({ message: "History item not found" });
    res.status(204).end();
  }));

  // --- Component Parts ---

  app.get("/api/projects/:projectId/component-parts", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parts = await storage.getComponentParts(projectId);
    res.json(parts);
  }));

  app.get("/api/projects/:projectId/component-parts/by-node/:nodeId", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const nodeId = Array.isArray(req.params.nodeId) ? req.params.nodeId[0] : req.params.nodeId;
    const part = await storage.getComponentPartByNodeId(projectId, nodeId);
    if (!part) return res.status(404).json({ message: "Component part not found" });
    res.json(part);
  }));

  app.get("/api/projects/:projectId/component-parts/:id", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const id = parseIdParam(req.params.id);
    const part = await storage.getComponentPart(id, projectId);
    if (!part) return res.status(404).json({ message: "Component part not found" });
    res.json(part);
  }));

  app.post("/api/projects/:projectId/component-parts", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const parsed = insertComponentPartSchema.omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const part = await storage.createComponentPart({ ...parsed.data, projectId });
    res.status(201).json(part);
  }));

  app.patch("/api/projects/:projectId/component-parts/:id", payloadLimit(32 * 1024), asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const id = parseIdParam(req.params.id);
    const parsed = insertComponentPartSchema.partial().omit({ projectId: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: fromZodError(parsed.error).toString() });
    const updated = await storage.updateComponentPart(id, projectId, parsed.data);
    if (!updated) return res.status(404).json({ message: "Component part not found" });
    res.json(updated);
  }));

  app.delete("/api/projects/:projectId/component-parts/:id", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteComponentPart(id, projectId);
    if (!deleted) return res.status(404).json({ message: "Component part not found" });
    res.status(204).end();
  }));

  // --- FZPZ Export ---
  app.get("/api/projects/:projectId/component-parts/:id/export/fzpz", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const id = parseIdParam(req.params.id);
    const part = await storage.getComponentPart(id, projectId);
    if (!part) return res.status(404).json({ message: "Component part not found" });

    const partState = {
      meta: part.meta as PartMeta,
      connectors: part.connectors as Connector[],
      buses: part.buses as Bus[],
      views: part.views as PartViews,
    };

    const zipBuffer = await exportToFzpz(partState);
    const filename = (partState.meta.title || 'component').replace(/[^a-zA-Z0-9_-]/g, '_');
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}.fzpz"`,
    });
    res.send(zipBuffer);
  }));

  // --- FZPZ Import ---
  app.post("/api/projects/:projectId/component-parts/import/fzpz", payloadLimit(5 * 1024 * 1024), asyncHandler(async (req, res) => {
    let buffer: Buffer;
    if (Buffer.isBuffer(req.body)) {
      buffer = req.body;
    } else if (typeof req.body === 'string') {
      buffer = Buffer.from(req.body, 'binary');
    } else {
      const chunks: Buffer[] = [];
      let totalSize = 0;
      for await (const chunk of req) {
        totalSize += chunk.length;
        if (totalSize > 5 * 1024 * 1024) return res.status(400).json({ message: "File too large (max 5MB)" });
        chunks.push(Buffer.from(chunk));
      }
      buffer = Buffer.concat(chunks);
    }

    if (buffer.length === 0) return res.status(400).json({ message: "No file data provided" });

    const projectId = parseIdParam(req.params.projectId);
    const partState = await importFromFzpz(buffer);

    const part = await storage.createComponentPart({
      projectId,
      meta: partState.meta,
      connectors: partState.connectors,
      buses: partState.buses,
      views: partState.views,
      constraints: [],
    });
    res.status(201).json(part);
  }));

  // --- SVG Import ---
  app.post("/api/projects/:projectId/component-parts/:id/import/svg", payloadLimit(2 * 1024 * 1024), asyncHandler(async (req, res) => {
    const svgContent = typeof req.body === 'string' ? req.body : '';

    if (!svgContent || svgContent.trim().length === 0) {
      return res.status(400).json({ message: "No SVG content provided. Send raw SVG with Content-Type: text/xml" });
    }

    try {
      const shapes = parseSvgToShapes(svgContent);
      res.json({ shapes });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Invalid SVG content";
      res.status(400).json({ message });
    }
  }));

  // --- Component Library ---

  app.get("/api/component-library", asyncHandler(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const result = await storage.getLibraryEntries({ search, category, page, limit });
    res.json(result);
  }));

  app.get("/api/component-library/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const entry = await storage.getLibraryEntry(id);
    if (!entry) return res.status(404).json({ message: "Library entry not found" });
    res.json(entry);
  }));

  app.post("/api/component-library", asyncHandler(async (req, res) => {
    const parsed = insertComponentLibrarySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: fromZodError(parsed.error).message });
    }
    const entry = await storage.createLibraryEntry(parsed.data);
    res.status(201).json(entry);
  }));

  app.delete("/api/component-library/:id", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const deleted = await storage.deleteLibraryEntry(id);
    if (!deleted) return res.status(404).json({ message: "Library entry not found" });
    res.json({ success: true });
  }));

  app.post("/api/component-library/:id/fork", asyncHandler(async (req, res) => {
    const id = parseIdParam(req.params.id);
    const forkSchema = z.object({ projectId: z.number().int().positive() });
    const parsed = forkSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid projectId" });
    const projectId = parsed.data.projectId;
    const entry = await storage.getLibraryEntry(id);
    if (!entry) return res.status(404).json({ message: "Library entry not found" });
    const part = await storage.createComponentPart({
      projectId,
      meta: entry.meta as PartMeta,
      connectors: entry.connectors as Connector[],
      buses: entry.buses as Bus[],
      views: entry.views as PartViews,
      constraints: entry.constraints as Constraint[],
    });
    await storage.incrementLibraryDownloads(id);
    res.status(201).json(part);
  }));

  // --- DRC Check ---
  app.post("/api/projects/:projectId/component-parts/:id/drc", asyncHandler(async (req, res) => {
    const projectId = parseIdParam(req.params.projectId);
    const id = parseIdParam(req.params.id);
    const part = await storage.getComponentPart(id, projectId);
    if (!part) return res.status(404).json({ message: "Component part not found" });

    const view = (req.body?.view || 'pcb') as 'breadboard' | 'schematic' | 'pcb';
    const partState: PartState = {
      meta: part.meta as PartMeta,
      connectors: (part.connectors as Connector[]) || [],
      buses: (part.buses as Bus[]) || [],
      views: part.views as PartViews,
      constraints: (part.constraints as Constraint[]) || [],
    };

    const rules = req.body?.rules || getDefaultDRCRules();
    const violations = runDRC(partState, rules, view);

    res.json({ violations, checkedAt: new Date().toISOString() });
  }));

  // --- Seed / Init default project ---

  app.post("/api/seed", payloadLimit(16 * 1024), asyncHandler(async (_req, res) => {
    if (process.env.NODE_ENV === "production") {
      return res.status(404).json({ message: "Not found" });
    }
    const existingProjects = await storage.getProjects();
    if (existingProjects.length > 0) {
      const existingParts = await storage.getComponentParts(existingProjects[0].id);
      if (existingParts.length === 0) {
        await storage.createComponentPart(buildSeedComponentPart(existingProjects[0].id));
      }
      return res.json({ message: "Already seeded", project: existingProjects[0] });
    }

    const result = await db.transaction(async (tx) => {
      const [project] = await tx.insert(projects).values({ name: "Smart_Agro_Node_v1", description: "IoT Agriculture Sensor Node" }).returning();

      await tx.insert(architectureNodes).values([
        { projectId: project.id, nodeId: "1", nodeType: "mcu", label: "ESP32-S3-WROOM-1", positionX: 400, positionY: 100, data: { description: "Dual-core MCU, Wi-Fi/BLE" } },
        { projectId: project.id, nodeId: "2", nodeType: "power", label: "TP4056 PMU", positionX: 150, positionY: 250, data: { description: "Li-Ion Battery Charger" } },
        { projectId: project.id, nodeId: "3", nodeType: "comm", label: "SX1262 LoRa", positionX: 650, positionY: 250, data: { description: "Long Range Transceiver" } },
        { projectId: project.id, nodeId: "4", nodeType: "sensor", label: "SHT40", positionX: 400, positionY: 400, data: { description: "Temp/Humidity Sensor" } },
        { projectId: project.id, nodeId: "5", nodeType: "connector", label: "USB-C Connector", positionX: 150, positionY: 100, data: { description: "Power/Data Input" } },
      ]);

      await tx.insert(architectureEdges).values([
        { projectId: project.id, edgeId: "e5-2", source: "5", target: "2", animated: true, label: "5V VBUS", style: { stroke: "#ef4444" } },
        { projectId: project.id, edgeId: "e2-1", source: "2", target: "1", animated: true, label: "3.3V", style: { stroke: "#ef4444" } },
        { projectId: project.id, edgeId: "e1-3", source: "1", target: "3", animated: true, label: "SPI", style: { stroke: "#06b6d4" } },
        { projectId: project.id, edgeId: "e1-4", source: "1", target: "4", animated: true, label: "I2C", style: { stroke: "#06b6d4" } },
      ]);

      const bomData = [
        { projectId: project.id, partNumber: "ESP32-S3-WROOM-1", manufacturer: "Espressif", description: "Wi-Fi/BLE MCU Module", quantity: 1, unitPrice: "3.5000", totalPrice: "3.5000", supplier: "Mouser", stock: 1240, status: "In Stock" as const },
        { projectId: project.id, partNumber: "TP4056", manufacturer: "Top Power", description: "Li-Ion Charger IC", quantity: 1, unitPrice: "0.1500", totalPrice: "0.1500", supplier: "LCSC", stock: 50000, status: "In Stock" as const },
        { projectId: project.id, partNumber: "SX1262IMLTRT", manufacturer: "Semtech", description: "LoRa Transceiver", quantity: 1, unitPrice: "4.2000", totalPrice: "4.2000", supplier: "Digi-Key", stock: 85, status: "Low Stock" as const },
        { projectId: project.id, partNumber: "SHT40-AD1B-R2", manufacturer: "Sensirion", description: "Sensor Humidity/Temp", quantity: 1, unitPrice: "1.8500", totalPrice: "1.8500", supplier: "Mouser", stock: 5000, status: "In Stock" as const },
        { projectId: project.id, partNumber: "USB4105-GF-A", manufacturer: "GCT", description: "USB Type-C Receptacle", quantity: 1, unitPrice: "0.6500", totalPrice: "0.6500", supplier: "Digi-Key", stock: 12000, status: "In Stock" as const },
      ];
      await tx.insert(bomItems).values(bomData);

      await tx.insert(validationIssues).values([
        { projectId: project.id, severity: "warning", message: "Missing decoupling capacitor on ESP32 VDD", componentId: "1", suggestion: "Add 10uF + 0.1uF ceramic capacitors close to pins." },
        { projectId: project.id, severity: "error", message: "LoRa antenna path impedance mismatch likely", componentId: "3", suggestion: "Check RF trace width and add Pi-matching network." },
      ]);

      await tx.insert(chatMessages).values({ projectId: project.id, role: "system", content: "Welcome to ProtoPulse AI. I can help you generate architectures, create schematics, and optimize your BOM.", mode: "chat" });

      await tx.insert(historyItems).values([
        { projectId: project.id, action: "Project Created", user: "User" },
        { projectId: project.id, action: "Added ESP32-S3", user: "User" },
        { projectId: project.id, action: "Auto-connected Power Rails", user: "AI" },
      ]);

      await tx.insert(componentParts).values(buildSeedComponentPart(project.id));

      return project;
    });

    res.status(201).json({ message: "Seeded successfully", project: result });
  }));

  // --- AI Chat Endpoint ---

  app.post("/api/chat/ai", payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const { message, provider, model, apiKey: clientApiKey, temperature, maxTokens } = parsed.data;
    const pid = parsed.data.projectId;

    let apiKeyToUse = clientApiKey || '';
    if (req.userId) {
      const storedKey = await getApiKey(req.userId, provider);
      if (storedKey) {
        apiKeyToUse = storedKey;
      }
    }

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
      apiKey: apiKeyToUse,
      appState,
      temperature: temperature ?? 0.7,
      maxTokens,
    });

    res.json(result);
  }));

  app.post("/api/chat/ai/stream", payloadLimit(64 * 1024), asyncHandler(async (req, res) => {
    const parsed = aiRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request: " + fromZodError(parsed.error).toString() });
    }

    const { message, provider, model, apiKey: clientApiKey, temperature, maxTokens } = parsed.data;
    const pid = parsed.data.projectId;

    let apiKeyToUse = clientApiKey || '';
    if (req.userId) {
      const storedKey = await getApiKey(req.userId, provider);
      if (storedKey) {
        apiKeyToUse = storedKey;
      }
    }

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
        { message, provider, model, apiKey: apiKeyToUse, appState, temperature: temperature ?? 0.7, maxTokens },
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
    } catch (error: unknown) {
      clearTimeout(streamTimeout);
      if (!closed) {
        const { userMessage } = categorizeError(error);
        res.write(`data: ${JSON.stringify({ type: 'error', message: userMessage })}\n\n`);
        res.end();
      }
    }
  }));

  // --- Admin: Purge soft-deleted records ---

  app.delete("/api/admin/purge", asyncHandler(async (req, res) => {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await db.delete(architectureNodes).where(and(isNotNull(architectureNodes.deletedAt), lte(architectureNodes.deletedAt, cutoff)));
    await db.delete(architectureEdges).where(and(isNotNull(architectureEdges.deletedAt), lte(architectureEdges.deletedAt, cutoff)));
    await db.delete(bomItems).where(and(isNotNull(bomItems.deletedAt), lte(bomItems.deletedAt, cutoff)));
    await db.delete(projects).where(and(isNotNull(projects.deletedAt), lte(projects.deletedAt, cutoff)));
    res.json({ message: "Purge complete" });
  }));

}
