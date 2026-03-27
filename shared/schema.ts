import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, jsonb, timestamp, serial, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

const nonNegativeNumericInputSchema = z.union([z.string(), z.number()])
  .transform((value) => typeof value === 'string' ? value.trim() : String(value))
  .refine((value) => value.length > 0 && Number.isFinite(Number(value)) && Number(value) >= 0, {
    message: 'Expected a non-negative numeric value',
  });

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  ownerId: integer("owner_id").references(() => users.id),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => users.id),
}, (table) => [
  index("idx_projects_owner").on(table.ownerId),
  index("idx_projects_owner_deleted").on(table.ownerId, table.deletedAt),
]);


export const projectMembers = pgTable("project_members", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ['viewer', 'editor', 'admin'] }).notNull().default('viewer'),
  status: text("status", { enum: ['pending', 'accepted', 'declined'] }).notNull().default('pending'),
  invitedBy: integer("invited_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_project_members_project").on(table.projectId),
  index("idx_project_members_user").on(table.userId),
  uniqueIndex("uq_project_members").on(table.projectId, table.userId)
]);

export const insertProjectMemberSchema = createInsertSchema(projectMembers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProjectMember = z.infer<typeof insertProjectMemberSchema>;
export type ProjectMember = typeof projectMembers.$inferSelect;

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, ownerId: true, version: true, createdAt: true, updatedAt: true, deletedAt: true, approvedAt: true, approvedBy: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

const nodeDataSchema = z.object({
  description: z.string().optional(),
  componentPartId: z.number().optional(),
}).passthrough().nullable().optional();

export const architectureNodes = pgTable("architecture_nodes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  nodeId: text("node_id").notNull(),
  nodeType: text("node_type").notNull(),
  label: text("label").notNull(),
  positionX: real("position_x").notNull(),
  positionY: real("position_y").notNull(),
  data: jsonb("data"),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_arch_nodes_project").on(table.projectId),
  index("idx_arch_nodes_project_deleted").on(table.projectId, table.deletedAt),
  uniqueIndex("uq_arch_nodes_project_node").on(table.projectId, table.nodeId),
]);

export const insertArchitectureNodeSchema = createInsertSchema(architectureNodes).omit({ id: true, version: true, updatedAt: true, deletedAt: true }).extend({
  nodeType: z.string().min(1).max(100),
  data: nodeDataSchema,
});
export type InsertArchitectureNode = z.infer<typeof insertArchitectureNodeSchema>;
export type ArchitectureNode = typeof architectureNodes.$inferSelect;

const edgeStyleSchema = z.object({
  stroke: z.string().optional(),
}).passthrough().nullable().optional();

export const architectureEdges = pgTable("architecture_edges", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  edgeId: text("edge_id").notNull(),
  source: text("source").notNull(),
  target: text("target").notNull(),
  label: text("label"),
  animated: boolean("animated").default(false),
  style: jsonb("style"),
  signalType: text("signal_type"),
  voltage: text("voltage"),
  busWidth: integer("bus_width"),
  netName: text("net_name"),
  version: integer("version").notNull().default(1),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_arch_edges_project").on(table.projectId),
  index("idx_arch_edges_project_deleted").on(table.projectId, table.deletedAt),
  uniqueIndex("uq_arch_edges_project_edge").on(table.projectId, table.edgeId),
]);

export const insertArchitectureEdgeSchema = createInsertSchema(architectureEdges).omit({ id: true, version: true, deletedAt: true }).extend({
  style: edgeStyleSchema,
});
export type InsertArchitectureEdge = z.infer<typeof insertArchitectureEdgeSchema>;
export type ArchitectureEdge = typeof architectureEdges.$inferSelect;

export const bomItems = pgTable("bom_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  partNumber: text("part_number").notNull(),
  manufacturer: text("manufacturer").notNull(),
  description: text("description").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 4 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 4 }).notNull(),
  supplier: text("supplier").notNull(),
  stock: integer("stock").notNull().default(0),
  status: text("status").notNull().default("In Stock"),
  leadTime: text("lead_time"),
  datasheetUrl: text("datasheet_url"),
  manufacturerUrl: text("manufacturer_url"),
  storageLocation: text("storage_location"),
  quantityOnHand: integer("quantity_on_hand"),
  minimumStock: integer("minimum_stock"),
  esdSensitive: boolean("esd_sensitive"),
  assemblyCategory: text("assembly_category"),
  tolerance: text("tolerance"),
  version: integer("version").notNull().default(1),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_bom_items_project").on(table.projectId),
  index("idx_bom_items_project_deleted").on(table.projectId, table.deletedAt),
]);

export const insertBomItemSchema = createInsertSchema(bomItems).omit({ id: true, totalPrice: true, version: true, updatedAt: true, deletedAt: true }).extend({
  unitPrice: nonNegativeNumericInputSchema,
  status: z.enum(["In Stock", "Low Stock", "Out of Stock", "On Order"]).default("In Stock"),
});
export type InsertBomItem = z.infer<typeof insertBomItemSchema>;
export type BomItem = typeof bomItems.$inferSelect;

export const validationIssues = pgTable("validation_issues", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  severity: text("severity").notNull(),
  message: text("message").notNull(),
  componentId: text("component_id"),
  suggestion: text("suggestion"),
}, (table) => [
  index("idx_validation_issues_project").on(table.projectId),
]);

export const insertValidationIssueSchema = createInsertSchema(validationIssues).omit({ id: true }).extend({
  severity: z.enum(["error", "warning", "info"]),
});
export type InsertValidationIssue = z.infer<typeof insertValidationIssueSchema>;
export type ValidationIssue = typeof validationIssues.$inferSelect;

export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  mode: text("mode").default("chat"),
  branchId: text("branch_id"),
  parentMessageId: integer("parent_message_id"),
  metadata: text("metadata"),
}, (table) => [
  index("idx_chat_messages_project").on(table.projectId),
  index("idx_chat_messages_project_ts").on(table.projectId, table.timestamp),
  index("idx_chat_messages_branch").on(table.projectId, table.branchId),
]);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, timestamp: true }).extend({
  role: z.enum(["user", "assistant", "system"]),
  metadata: z.string().optional(),
});
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type ChatMessage = typeof chatMessages.$inferSelect;

export const historyItems = pgTable("history_items", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  action: text("action").notNull(),
  user: text("user").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
}, (table) => [
  index("idx_history_items_project").on(table.projectId),
  index("idx_history_items_project_ts").on(table.projectId, table.timestamp),
]);

export const insertHistoryItemSchema = createInsertSchema(historyItems).omit({ id: true, timestamp: true });
export type InsertHistoryItem = z.infer<typeof insertHistoryItemSchema>;
export type HistoryItem = typeof historyItems.$inferSelect;

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  iv: text("iv").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userChatSettings = pgTable("user_chat_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  aiProvider: text("ai_provider").notNull().default("anthropic"),
  aiModel: text("ai_model").notNull().default("claude-sonnet-4-5-20250514"),
  aiTemperature: real("ai_temperature").notNull().default(0.7),
  customSystemPrompt: text("custom_system_prompt").default(""),
  routingStrategy: text("routing_strategy").notNull().default("user"),
  previewAiChanges: boolean("preview_ai_changes").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("uq_user_chat_settings_user").on(table.userId),
]);

export const insertUserChatSettingsSchema = createInsertSchema(userChatSettings).omit({ id: true, updatedAt: true });
export type InsertUserChatSettings = z.infer<typeof insertUserChatSettingsSchema>;
export type UserChatSettings = typeof userChatSettings.$inferSelect;

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type Session = typeof sessions.$inferSelect;
export type ApiKeyRecord = typeof apiKeys.$inferSelect;

export const componentParts = pgTable("component_parts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  nodeId: text("node_id"),
  meta: jsonb("meta").notNull().default({}),
  connectors: jsonb("connectors").notNull().default([]),
  buses: jsonb("buses").notNull().default([]),
  views: jsonb("views").notNull().default({}),
  constraints: jsonb("constraints").notNull().default([]),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_component_parts_project").on(table.projectId),
  index("idx_component_parts_node").on(table.nodeId),
]);

export const insertComponentPartSchema = createInsertSchema(componentParts).omit({ id: true, version: true, createdAt: true, updatedAt: true });
export type InsertComponentPart = z.infer<typeof insertComponentPartSchema>;
export type ComponentPart = typeof componentParts.$inferSelect;

export const componentLibrary = pgTable("component_library", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  meta: jsonb("meta").notNull().default({}),
  connectors: jsonb("connectors").notNull().default([]),
  buses: jsonb("buses").notNull().default([]),
  views: jsonb("views").notNull().default({}),
  constraints: jsonb("constraints").notNull().default([]),
  tags: text("tags").array().notNull().default([]),
  category: text("category"),
  isPublic: boolean("is_public").notNull().default(false),
  authorId: text("author_id"),
  forkedFromId: integer("forked_from_id"),
  downloadCount: integer("download_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_component_library_category").on(table.category),
  index("idx_component_library_public").on(table.isPublic),
]);

export const insertComponentLibrarySchema = createInsertSchema(componentLibrary).omit({ id: true, downloadCount: true, createdAt: true, updatedAt: true });
export type InsertComponentLibrary = z.infer<typeof insertComponentLibrarySchema>;
export type ComponentLibraryEntry = typeof componentLibrary.$inferSelect;

// --- Circuit Design Tables (Phase 10) ---

export const circuitDesigns = pgTable("circuit_designs", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  parentDesignId: integer("parent_design_id"),
  name: text("name").notNull().default("Main Circuit"),
  description: text("description"),
  settings: jsonb("settings").notNull().default({}),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_circuit_designs_project").on(table.projectId),
  index("idx_circuit_designs_parent").on(table.parentDesignId),
]);

export const insertCircuitDesignSchema = createInsertSchema(circuitDesigns).omit({ id: true, version: true, createdAt: true, updatedAt: true });
export type InsertCircuitDesign = z.infer<typeof insertCircuitDesignSchema>;
export type CircuitDesignRow = typeof circuitDesigns.$inferSelect;

// --- Hierarchical Ports (inter-sheet connections) ---

export const hierarchicalPorts = pgTable("hierarchical_ports", {
  id: serial("id").primaryKey(),
  designId: integer("design_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  portName: text("port_name").notNull(),
  direction: text("direction").notNull().default("bidirectional"),
  netName: text("net_name"),
  positionX: real("position_x").notNull().default(0),
  positionY: real("position_y").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_hierarchical_ports_design").on(table.designId),
]);

export const insertHierarchicalPortSchema = createInsertSchema(hierarchicalPorts).omit({ id: true, createdAt: true }).extend({
  direction: z.enum(["input", "output", "bidirectional"]).default("bidirectional"),
});
export type InsertHierarchicalPort = z.infer<typeof insertHierarchicalPortSchema>;
export type HierarchicalPortRow = typeof hierarchicalPorts.$inferSelect;

export const circuitInstances = pgTable("circuit_instances", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  partId: integer("part_id").references(() => componentParts.id, { onDelete: 'set null' }),
  subDesignId: integer("sub_design_id").references(() => circuitDesigns.id, { onDelete: 'set null' }), // For hierarchical sheets
  referenceDesignator: text("reference_designator").notNull(),
  schematicX: real("schematic_x").notNull().default(0),
  schematicY: real("schematic_y").notNull().default(0),
  schematicRotation: real("schematic_rotation").notNull().default(0),
  breadboardX: real("breadboard_x"),
  breadboardY: real("breadboard_y"),
  breadboardRotation: real("breadboard_rotation").default(0),
  pcbX: real("pcb_x"),
  pcbY: real("pcb_y"),
  pcbRotation: real("pcb_rotation").default(0),
  pcbSide: text("pcb_side").default("front"),
  properties: jsonb("properties").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_circuit_instances_circuit").on(table.circuitId),
  index("idx_circuit_instances_part").on(table.partId),
]);

export const insertCircuitInstanceSchema = createInsertSchema(circuitInstances).omit({ id: true, createdAt: true });
export type InsertCircuitInstance = z.infer<typeof insertCircuitInstanceSchema>;
export type CircuitInstanceRow = typeof circuitInstances.$inferSelect;

export const circuitNets = pgTable("circuit_nets", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  netType: text("net_type").notNull().default("signal"),
  voltage: text("voltage"),
  busWidth: integer("bus_width"),
  segments: jsonb("segments").notNull().default([]),
  labels: jsonb("labels").notNull().default([]),
  style: jsonb("style").notNull().default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_circuit_nets_circuit").on(table.circuitId),
  index("idx_circuit_nets_name").on(table.name),
]);

export const insertCircuitNetSchema = createInsertSchema(circuitNets).omit({ id: true, createdAt: true });
export type InsertCircuitNet = z.infer<typeof insertCircuitNetSchema>;
export type CircuitNetRow = typeof circuitNets.$inferSelect;

export const circuitWires = pgTable("circuit_wires", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  netId: integer("net_id").notNull().references(() => circuitNets.id, { onDelete: "cascade" }),
  view: text("view").notNull(),
  points: jsonb("points").notNull().default([]),
  layer: text("layer").default("front"),
  width: real("width").notNull().default(1.0),
  color: text("color"),
  wireType: text("wire_type").default("wire"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_circuit_wires_circuit").on(table.circuitId),
  index("idx_circuit_wires_net").on(table.netId),
]);

export const insertCircuitWireSchema = createInsertSchema(circuitWires).omit({ id: true, createdAt: true });
export type InsertCircuitWire = z.infer<typeof insertCircuitWireSchema>;
export type CircuitWireRow = typeof circuitWires.$inferSelect;

export const circuitVias = pgTable("circuit_vias", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  netId: integer("net_id").notNull().references(() => circuitNets.id, { onDelete: "cascade" }),
  x: real("x").notNull(),
  y: real("y").notNull(),
  outerDiameter: real("outer_diameter").notNull(),
  drillDiameter: real("drill_diameter").notNull(),
  viaType: text("via_type").notNull().default("through"), // through, blind, buried, micro
  layerStart: text("layer_start").notNull().default("front"),
  layerEnd: text("layer_end").notNull().default("back"),
  tented: boolean("tented").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_circuit_vias_circuit").on(table.circuitId),
  index("idx_circuit_vias_net").on(table.netId),
]);

export const insertCircuitViaSchema = createInsertSchema(circuitVias).omit({ id: true, createdAt: true });
export type InsertCircuitVia = z.infer<typeof insertCircuitViaSchema>;
export type CircuitViaRow = typeof circuitVias.$inferSelect;

// ---------------------------------------------------------------------------
// Simulation Results (Phase 13.13)
// ---------------------------------------------------------------------------

export const simulationResults = pgTable("simulation_results", {
  id: serial("id").primaryKey(),
  circuitId: integer("circuit_id").notNull().references(() => circuitDesigns.id, { onDelete: "cascade" }),
  analysisType: text("analysis_type").notNull(),
  config: jsonb("config").notNull().default({}),
  results: jsonb("results").notNull().default({}),
  status: text("status").notNull().default("completed"),
  engineUsed: text("engine_used"),
  elapsedMs: integer("elapsed_ms"),
  sizeBytes: integer("size_bytes"),
  error: text("error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_simulation_results_circuit").on(table.circuitId),
]);

export const insertSimulationResultSchema = createInsertSchema(simulationResults).omit({ id: true, createdAt: true });
export type InsertSimulationResult = z.infer<typeof insertSimulationResultSchema>;
export type SimulationResultRow = typeof simulationResults.$inferSelect;

// ---------------------------------------------------------------------------
// AI Action Log (Phase 5) — persists tool executions for audit/replay
// ---------------------------------------------------------------------------

export const aiActions = pgTable("ai_actions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  chatMessageId: text("chat_message_id"),
  toolName: text("tool_name").notNull(),
  parameters: jsonb("parameters").notNull().default({}),
  result: jsonb("result").notNull().default({}),
  status: text("status").notNull().default("completed"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_actions_project").on(table.projectId),
  index("idx_ai_actions_message").on(table.chatMessageId),
]);

export const insertAiActionSchema = createInsertSchema(aiActions).omit({ id: true, createdAt: true });
export type InsertAiAction = z.infer<typeof insertAiActionSchema>;
export type AiActionRow = typeof aiActions.$inferSelect;

// ---------------------------------------------------------------------------
// Design Preferences (FG-24) — AI-learned user preferences per project
// ---------------------------------------------------------------------------

export const designPreferences = pgTable("design_preferences", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  key: text("key").notNull(),
  value: text("value").notNull(),
  source: text("source").notNull().default("ai"),
  confidence: real("confidence").notNull().default(0.8),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_design_prefs_project").on(table.projectId),
  uniqueIndex("uq_design_prefs_project_cat_key").on(table.projectId, table.category, table.key),
]);

export const insertDesignPreferenceSchema = createInsertSchema(designPreferences).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDesignPreference = z.infer<typeof insertDesignPreferenceSchema>;
export type DesignPreference = typeof designPreferences.$inferSelect;

// ---------------------------------------------------------------------------
// BOM Snapshots (EN-21) — point-in-time BOM captures for diff/comparison
// ---------------------------------------------------------------------------

export const bomSnapshots = pgTable("bom_snapshots", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  snapshotData: jsonb("snapshot_data").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_bom_snapshots_project").on(table.projectId),
]);

export const insertBomSnapshotSchema = createInsertSchema(bomSnapshots).omit({ id: true, createdAt: true });
export type InsertBomSnapshot = z.infer<typeof insertBomSnapshotSchema>;
export type BomSnapshot = typeof bomSnapshots.$inferSelect;

// ---------------------------------------------------------------------------
// SPICE Model Library (EN-24) — standard component model definitions
// ---------------------------------------------------------------------------

export const spiceModels = pgTable("spice_models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  modelType: text("model_type").notNull(),
  spiceDirective: text("spice_directive").notNull(),
  parameters: jsonb("parameters").notNull().default({}),
  description: text("description"),
  category: text("category").notNull(),
  datasheet: text("datasheet"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_spice_models_category").on(table.category),
  index("idx_spice_models_model_type").on(table.modelType),
  index("idx_spice_models_name").on(table.name),
]);

export const insertSpiceModelSchema = createInsertSchema(spiceModels).omit({ id: true, createdAt: true }).extend({
  modelType: z.enum([
    'NPN', 'PNP', 'DIODE', 'ZENER', 'SCHOTTKY', 'LED',
    'NMOS', 'PMOS', 'MOSFET_N', 'MOSFET_P', 'JFET_N', 'JFET_P',
    'OPAMP', 'COMPARATOR',
    'VOLTAGE_REG', 'TIMER',
    'RESISTOR', 'CAPACITOR', 'INDUCTOR',
  ]),
  category: z.enum([
    'transistor', 'diode', 'opamp', 'passive', 'ic', 'voltage_regulator', 'mosfet', 'jfet',
  ]),
});
export type InsertSpiceModel = z.infer<typeof insertSpiceModelSchema>;
export type SpiceModelRow = typeof spiceModels.$inferSelect;

// ---------------------------------------------------------------------------
// Component Lifecycle / Obsolescence Tracking (FG-32)
// ---------------------------------------------------------------------------

export const componentLifecycle = pgTable('component_lifecycle', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  bomItemId: integer('bom_item_id'),
  partNumber: varchar('part_number', { length: 100 }).notNull(),
  manufacturer: varchar('manufacturer', { length: 200 }),
  lifecycleStatus: varchar('lifecycle_status', { length: 50 }).notNull().default('active'),
  lastCheckedAt: timestamp('last_checked_at'),
  alternatePartNumbers: text('alternate_part_numbers'),
  dataSource: varchar('data_source', { length: 100 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_component_lifecycle_project').on(table.projectId),
  index('idx_component_lifecycle_status').on(table.lifecycleStatus),
]);

export const insertComponentLifecycleSchema = createInsertSchema(componentLifecycle).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertComponentLifecycle = z.infer<typeof insertComponentLifecycleSchema>;
export type ComponentLifecycle = typeof componentLifecycle.$inferSelect;

// ---------------------------------------------------------------------------
// Design Snapshots (IN-07) — point-in-time architecture captures for visual diff
// ---------------------------------------------------------------------------

export const designSnapshots = pgTable('design_snapshots', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description'),
  nodesJson: jsonb('nodes_json').notNull(),
  edgesJson: jsonb('edges_json').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_design_snapshots_project').on(table.projectId),
]);

export const insertDesignSnapshotSchema = createInsertSchema(designSnapshots).omit({ id: true, createdAt: true });
export type InsertDesignSnapshot = z.infer<typeof insertDesignSnapshotSchema>;
export type DesignSnapshot = typeof designSnapshots.$inferSelect;

// ---------------------------------------------------------------------------
// Design Comments / Review (FG-12) — threaded comments on design elements
// ---------------------------------------------------------------------------

export const designComments = pgTable('design_comments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: integer('user_id').references(() => users.id),
  parentId: integer('parent_id'),
  targetType: text("target_type").notNull().default('general'),
  targetId: text("target_id"),
  spatialX: real("spatial_x"),
  spatialY: real("spatial_y"),
  spatialView: text("spatial_view"), // 'architecture', 'schematic', 'pcb', 'breadboard'
  content: text("content").notNull(),
  status: text('status').notNull().default('open'), // 'open', 'resolved', 'blocked', 'wontfix'
  statusUpdatedBy: integer('status_updated_by').references(() => users.id),
  statusUpdatedAt: timestamp('status_updated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_design_comments_project').on(table.projectId),
  index('idx_design_comments_project_target').on(table.projectId, table.targetType, table.targetId),
  index('idx_design_comments_parent').on(table.parentId),
]);

export const insertDesignCommentSchema = createInsertSchema(designComments).omit({ id: true, statusUpdatedBy: true, statusUpdatedAt: true, createdAt: true, updatedAt: true }).extend({
  targetType: z.enum(['general', 'node', 'edge', 'bom_item', 'spatial']).default('general'),
  spatialView: z.enum(['architecture', 'schematic', 'pcb', 'breadboard']).optional(),
  content: z.string().min(1, "Comment cannot be empty"),
});
export type InsertDesignComment = z.infer<typeof insertDesignCommentSchema>;
export type DesignComment = typeof designComments.$inferSelect;

// ---------------------------------------------------------------------------
// PCB Orders (FG-10) — PCB fabrication order tracking
// ---------------------------------------------------------------------------

export const pcbOrders = pgTable('pcb_orders', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  fabricatorId: varchar('fabricator_id', { length: 50 }).notNull(),
  boardSpec: jsonb('board_spec').notNull(),
  quantity: integer('quantity').notNull().default(5),
  turnaround: varchar('turnaround', { length: 20 }).default('standard'),
  status: varchar('status', { length: 30 }).notNull().default('draft'),
  quoteData: jsonb('quote_data'),
  fabOrderNumber: varchar('fab_order_number', { length: 100 }),
  trackingNumber: varchar('tracking_number', { length: 100 }),
  notes: text('notes'),
  submittedAt: timestamp('submitted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_pcb_orders_project').on(table.projectId),
  index('idx_pcb_orders_status').on(table.status),
]);

export const insertPcbOrderSchema = createInsertSchema(pcbOrders).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  submittedAt: true,
});

export type PcbOrder = typeof pcbOrders.$inferSelect;
export type InsertPcbOrder = z.infer<typeof insertPcbOrderSchema>;

// ---------------------------------------------------------------------------
// PCB Zones (BL-0100) — keep-out, keep-in, and copper pour regions
// ---------------------------------------------------------------------------

export const pcbZones = pgTable('pcb_zones', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  zoneType: varchar('zone_type', { length: 50 }).notNull(), // 'pour', 'keepout', 'keepin', 'cutout'
  layer: varchar('layer', { length: 50 }).notNull(),
  points: jsonb('points').notNull().default([]), // Array of {x, y}
  netId: integer('net_id').references(() => circuitNets.id, { onDelete: 'set null' }),
  name: text('name'),
  properties: jsonb('properties').notNull().default({}), // clearance, minWidth, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_pcb_zones_project').on(table.projectId),
  index('idx_pcb_zones_layer').on(table.layer),
]);

export const insertPcbZoneSchema = createInsertSchema(pcbZones).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  zoneType: z.enum(['pour', 'keepout', 'keepin', 'cutout', 'teardrop']),
  points: z.array(z.object({ x: z.number(), y: z.number() })),
});

export type PcbZone = typeof pcbZones.$inferSelect;
export type InsertPcbZone = z.infer<typeof insertPcbZoneSchema>;

// ---------------------------------------------------------------------------
// Simulation Scenarios (BL-0124) — stored simulation presets/configs
// ---------------------------------------------------------------------------

export const simulationScenarios = pgTable('simulation_scenarios', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  circuitId: integer('circuit_id').notNull().references(() => circuitDesigns.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  config: jsonb('config').notNull().default({}), // Simulation type, stop time, step, etc.
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_simulation_scenarios_project').on(table.projectId),
  index('idx_simulation_scenarios_circuit').on(table.circuitId),
]);

export const insertSimulationScenarioSchema = createInsertSchema(simulationScenarios).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SimulationScenario = typeof simulationScenarios.$inferSelect;
export type InsertSimulationScenario = z.infer<typeof insertSimulationScenarioSchema>;

// ---------------------------------------------------------------------------
// Arduino Workbench (BL-0200) — firmware development and management
// ---------------------------------------------------------------------------

export const arduinoWorkspaces = pgTable('arduino_workspaces', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  rootPath: text('root_path').notNull(), // Absolute path on host filesystem
  activeSketchPath: text('active_sketch_path'), // Relative to rootPath
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_arduino_workspaces_project').on(table.projectId),
]);

export const arduinoBuildProfiles = pgTable('arduino_build_profiles', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  profileName: text('profile_name'), // Maps to sketch.yaml
  fqbn: text('fqbn').notNull(),
  port: text('port'),
  protocol: text('protocol').default('serial'),
  boardOptions: jsonb('board_options').default({}),
  portConfig: jsonb('port_config').default({}),
  libOverrides: jsonb('lib_overrides').default({}),
  verboseCompile: boolean('verbose_compile').default(false),
  verboseUpload: boolean('verbose_upload').default(false),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_arduino_profiles_project').on(table.projectId),
]);

export const arduinoJobs = pgTable('arduino_jobs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  profileId: integer('profile_id').references(() => arduinoBuildProfiles.id, { onDelete: 'set null' }),
  jobType: text('job_type').notNull(), // compile, upload, etc.
  status: text('status').notNull().default('pending'), // pending, running, completed, failed, cancelled
  command: text('command').notNull(),
  args: jsonb('args').default({}),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  exitCode: integer('exit_code'),
  summary: text('summary'),
  errorCode: text('error_code'),
  log: text('log'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('idx_arduino_jobs_project').on(table.projectId),
  index('idx_arduino_jobs_status').on(table.status),
]);

export const arduinoSerialSessions = pgTable('arduino_serial_sessions', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  port: text('port').notNull(),
  protocol: text('protocol').notNull().default('serial'),
  baudRate: integer('baud_rate').notNull().default(115200),
  status: text('status').notNull().default('closed'), // open, closed, error
  startedAt: timestamp('started_at').defaultNow().notNull(),
  endedAt: timestamp('ended_at'),
  settings: jsonb('settings').default({}),
}, (table) => [
  index('idx_arduino_serial_project').on(table.projectId),
]);

export const arduinoSketchFiles = pgTable('arduino_sketch_files', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  workspaceId: integer('workspace_id').notNull().references(() => arduinoWorkspaces.id, { onDelete: 'cascade' }),
  relativePath: text('relative_path').notNull(),
  language: text('language').notNull(), // ino, h, cpp, etc.
  sizeBytes: integer('size_bytes').notNull().default(0),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_arduino_files_project').on(table.projectId),
  index('idx_arduino_files_workspace').on(table.workspaceId),
]);

export const insertArduinoWorkspaceSchema = createInsertSchema(arduinoWorkspaces).omit({ id: true, createdAt: true, updatedAt: true });
export const insertArduinoBuildProfileSchema = createInsertSchema(arduinoBuildProfiles).omit({ id: true, createdAt: true, updatedAt: true });
export const insertArduinoJobSchema = createInsertSchema(arduinoJobs).omit({ id: true, createdAt: true });
export const insertArduinoSerialSessionSchema = createInsertSchema(arduinoSerialSessions).omit({ id: true, startedAt: true });
export const insertArduinoSketchFileSchema = createInsertSchema(arduinoSketchFiles).omit({ id: true });

export type ArduinoWorkspace = typeof arduinoWorkspaces.$inferSelect;
export type ArduinoBuildProfile = typeof arduinoBuildProfiles.$inferSelect;
export type ArduinoJob = typeof arduinoJobs.$inferSelect;
export type ArduinoSerialSession = typeof arduinoSerialSessions.$inferSelect;
export type ArduinoSketchFile = typeof arduinoSketchFiles.$inferSelect;

export type InsertArduinoWorkspace = z.infer<typeof insertArduinoWorkspaceSchema>;
export type InsertArduinoBuildProfile = z.infer<typeof insertArduinoBuildProfileSchema>;
export type InsertArduinoJob = z.infer<typeof insertArduinoJobSchema>;
export type InsertArduinoSerialSession = z.infer<typeof insertArduinoSerialSessionSchema>;
export type InsertArduinoSketchFile = z.infer<typeof insertArduinoSketchFileSchema>;
