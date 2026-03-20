const fs = require('fs');

let content = fs.readFileSync('shared/schema.ts', 'utf8');

// Insert projectMembers after projects table
const insertPoint = content.indexOf('export const insertProjectSchema');

const newTable = `
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

`;

content = content.substring(0, insertPoint) + newTable + content.substring(insertPoint);

fs.writeFileSync('shared/schema.ts', content, 'utf8');
console.log('Added projectMembers to schema.ts');
