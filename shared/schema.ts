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
});

export const insertProjectSchema = createInsertSchema(projects).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projects.$inferSelect;

const nodeDataSchema = z.object({
  description: z.string().optional(),
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
}, (table) => [
  index("idx_arch_nodes_project").on(table.projectId),
  uniqueIndex("uq_arch_nodes_project_node").on(table.projectId, table.nodeId),
]);

export const insertArchitectureNodeSchema = createInsertSchema(architectureNodes).omit({ id: true, updatedAt: true }).extend({
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
}, (table) => [
  index("idx_arch_edges_project").on(table.projectId),
  uniqueIndex("uq_arch_edges_project_edge").on(table.projectId, table.edgeId),
]);

export const insertArchitectureEdgeSchema = createInsertSchema(architectureEdges).omit({ id: true }).extend({
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
}, (table) => [
  index("idx_bom_items_project").on(table.projectId),
]);

export const insertBomItemSchema = createInsertSchema(bomItems).omit({ id: true, totalPrice: true, updatedAt: true }).extend({
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
