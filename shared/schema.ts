import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, real, boolean, jsonb, timestamp, serial, numeric, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true, deletedAt: true });
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_arch_nodes_project").on(table.projectId),
  uniqueIndex("uq_arch_nodes_project_node").on(table.projectId, table.nodeId),
]);

export const insertArchitectureNodeSchema = createInsertSchema(architectureNodes).omit({ id: true, updatedAt: true, deletedAt: true }).extend({
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
  busWidth: text("bus_width"),
  netName: text("net_name"),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_arch_edges_project").on(table.projectId),
  uniqueIndex("uq_arch_edges_project_edge").on(table.projectId, table.edgeId),
]);

export const insertArchitectureEdgeSchema = createInsertSchema(architectureEdges).omit({ id: true, deletedAt: true }).extend({
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
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (table) => [
  index("idx_bom_items_project").on(table.projectId),
]);

export const insertBomItemSchema = createInsertSchema(bomItems).omit({ id: true, totalPrice: true, updatedAt: true, deletedAt: true }).extend({
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
}, (table) => [
  index("idx_chat_messages_project").on(table.projectId),
  index("idx_chat_messages_project_ts").on(table.projectId, table.timestamp),
]);

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({ id: true, timestamp: true }).extend({
  role: z.enum(["user", "assistant", "system"]),
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
