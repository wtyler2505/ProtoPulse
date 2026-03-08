CREATE TABLE "bom_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"label" text NOT NULL,
	"snapshot_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_lifecycle" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"bom_item_id" integer,
	"part_number" varchar(100) NOT NULL,
	"manufacturer" varchar(200),
	"lifecycle_status" varchar(50) DEFAULT 'active' NOT NULL,
	"last_checked_at" timestamp,
	"alternate_part_numbers" text,
	"data_source" varchar(100),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer,
	"parent_id" integer,
	"target_type" text DEFAULT 'general' NOT NULL,
	"target_id" text,
	"content" text NOT NULL,
	"resolved" boolean DEFAULT false NOT NULL,
	"resolved_by" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"confidence" real DEFAULT 0.8 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text,
	"nodes_json" jsonb NOT NULL,
	"edges_json" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hierarchical_ports" (
	"id" serial PRIMARY KEY NOT NULL,
	"design_id" integer NOT NULL,
	"port_name" text NOT NULL,
	"direction" text DEFAULT 'bidirectional' NOT NULL,
	"net_name" text,
	"position_x" real DEFAULT 0 NOT NULL,
	"position_y" real DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pcb_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"fabricator_id" varchar(50) NOT NULL,
	"board_spec" jsonb NOT NULL,
	"quantity" integer DEFAULT 5 NOT NULL,
	"turnaround" varchar(20) DEFAULT 'standard',
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"quote_data" jsonb,
	"fab_order_number" varchar(100),
	"tracking_number" varchar(100),
	"notes" text,
	"submitted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spice_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"model_type" text NOT NULL,
	"spice_directive" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"datasheet" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bom_items" DROP CONSTRAINT "chk_bom_status";--> statement-breakpoint
ALTER TABLE "chat_messages" DROP CONSTRAINT "chk_chat_role";--> statement-breakpoint
ALTER TABLE "validation_issues" DROP CONSTRAINT "chk_validation_severity";--> statement-breakpoint
ALTER TABLE "architecture_edges" ALTER COLUMN "bus_width" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "architecture_edges" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "architecture_nodes" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "datasheet_url" text;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "manufacturer_url" text;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "storage_location" text;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "quantity_on_hand" integer;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "minimum_stock" integer;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "esd_sensitive" boolean;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "assembly_category" text;--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "branch_id" text;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "parent_message_id" integer;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD COLUMN "metadata" text;--> statement-breakpoint
ALTER TABLE "circuit_designs" ADD COLUMN "parent_design_id" integer;--> statement-breakpoint
ALTER TABLE "circuit_designs" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "owner_id" integer;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "bom_snapshots" ADD CONSTRAINT "bom_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_lifecycle" ADD CONSTRAINT "component_lifecycle_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_preferences" ADD CONSTRAINT "design_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_snapshots" ADD CONSTRAINT "design_snapshots_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hierarchical_ports" ADD CONSTRAINT "hierarchical_ports_design_id_circuit_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."circuit_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pcb_orders" ADD CONSTRAINT "pcb_orders_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bom_snapshots_project" ON "bom_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_component_lifecycle_project" ON "component_lifecycle" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_component_lifecycle_status" ON "component_lifecycle" USING btree ("lifecycle_status");--> statement-breakpoint
CREATE INDEX "idx_design_comments_project" ON "design_comments" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_design_comments_project_target" ON "design_comments" USING btree ("project_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "idx_design_comments_parent" ON "design_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "idx_design_prefs_project" ON "design_preferences" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_design_prefs_project_cat_key" ON "design_preferences" USING btree ("project_id","category","key");--> statement-breakpoint
CREATE INDEX "idx_design_snapshots_project" ON "design_snapshots" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_hierarchical_ports_design" ON "hierarchical_ports" USING btree ("design_id");--> statement-breakpoint
CREATE INDEX "idx_pcb_orders_project" ON "pcb_orders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_pcb_orders_status" ON "pcb_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_spice_models_category" ON "spice_models" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_spice_models_model_type" ON "spice_models" USING btree ("model_type");--> statement-breakpoint
CREATE INDEX "idx_spice_models_name" ON "spice_models" USING btree ("name");--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chat_messages_branch" ON "chat_messages" USING btree ("project_id","branch_id");--> statement-breakpoint
CREATE INDEX "idx_circuit_designs_parent" ON "circuit_designs" USING btree ("parent_design_id");--> statement-breakpoint
CREATE INDEX "idx_projects_owner" ON "projects" USING btree ("owner_id");--> statement-breakpoint
-- Re-add CHECK constraints from 0001 (dropped above because Drizzle schema
-- does not model them; they are maintained as manual DB-level guards).
ALTER TABLE bom_items
  ADD CONSTRAINT chk_bom_status
  CHECK (status IN ('In Stock', 'Low Stock', 'Out of Stock', 'On Order'));--> statement-breakpoint
ALTER TABLE chat_messages
  ADD CONSTRAINT chk_chat_role
  CHECK (role IN ('user', 'assistant', 'system'));--> statement-breakpoint
ALTER TABLE validation_issues
  ADD CONSTRAINT chk_validation_severity
  CHECK (severity IN ('error', 'warning', 'info'));