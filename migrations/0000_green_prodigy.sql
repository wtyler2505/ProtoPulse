CREATE TABLE "ai_actions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"chat_message_id" text,
	"tool_name" text NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text NOT NULL,
	"encrypted_key" text NOT NULL,
	"iv" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "architecture_edges" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"edge_id" text NOT NULL,
	"source" text NOT NULL,
	"target" text NOT NULL,
	"label" text,
	"animated" boolean DEFAULT false,
	"style" jsonb,
	"signal_type" text,
	"voltage" text,
	"bus_width" text,
	"net_name" text,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "architecture_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"node_id" text NOT NULL,
	"node_type" text NOT NULL,
	"label" text NOT NULL,
	"position_x" real NOT NULL,
	"position_y" real NOT NULL,
	"data" jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bom_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"part_number" text NOT NULL,
	"manufacturer" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 4) NOT NULL,
	"total_price" numeric(10, 4) NOT NULL,
	"supplier" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'In Stock' NOT NULL,
	"lead_time" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"mode" text DEFAULT 'chat'
);
--> statement-breakpoint
CREATE TABLE "circuit_designs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text DEFAULT 'Main Circuit' NOT NULL,
	"description" text,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circuit_instances" (
	"id" serial PRIMARY KEY NOT NULL,
	"circuit_id" integer NOT NULL,
	"part_id" integer,
	"reference_designator" text NOT NULL,
	"schematic_x" real DEFAULT 0 NOT NULL,
	"schematic_y" real DEFAULT 0 NOT NULL,
	"schematic_rotation" real DEFAULT 0 NOT NULL,
	"breadboard_x" real,
	"breadboard_y" real,
	"breadboard_rotation" real DEFAULT 0,
	"pcb_x" real,
	"pcb_y" real,
	"pcb_rotation" real DEFAULT 0,
	"pcb_side" text DEFAULT 'front',
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circuit_nets" (
	"id" serial PRIMARY KEY NOT NULL,
	"circuit_id" integer NOT NULL,
	"name" text NOT NULL,
	"net_type" text DEFAULT 'signal' NOT NULL,
	"voltage" text,
	"bus_width" integer,
	"segments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"labels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"style" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "circuit_wires" (
	"id" serial PRIMARY KEY NOT NULL,
	"circuit_id" integer NOT NULL,
	"net_id" integer NOT NULL,
	"view" text NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"layer" text DEFAULT 'front',
	"width" real DEFAULT 1 NOT NULL,
	"color" text,
	"wire_type" text DEFAULT 'wire',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_library" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"buses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"views" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"category" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"author_id" text,
	"forked_from_id" integer,
	"download_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "component_parts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"node_id" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"buses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"views" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"constraints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "history_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"action" text NOT NULL,
	"user" text NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulation_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"circuit_id" integer NOT NULL,
	"analysis_type" text NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"results" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"engine_used" text,
	"elapsed_ms" integer,
	"size_bytes" integer,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_chat_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"ai_provider" text DEFAULT 'anthropic' NOT NULL,
	"ai_model" text DEFAULT 'claude-sonnet-4-5-20250514' NOT NULL,
	"ai_temperature" real DEFAULT 0.7 NOT NULL,
	"custom_system_prompt" text DEFAULT '',
	"routing_strategy" text DEFAULT 'user' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "validation_issues" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"severity" text NOT NULL,
	"message" text NOT NULL,
	"component_id" text,
	"suggestion" text
);
--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "architecture_edges" ADD CONSTRAINT "architecture_edges_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "architecture_nodes" ADD CONSTRAINT "architecture_nodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bom_items" ADD CONSTRAINT "bom_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_designs" ADD CONSTRAINT "circuit_designs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_instances" ADD CONSTRAINT "circuit_instances_circuit_id_circuit_designs_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuit_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_instances" ADD CONSTRAINT "circuit_instances_part_id_component_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."component_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_nets" ADD CONSTRAINT "circuit_nets_circuit_id_circuit_designs_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuit_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_wires" ADD CONSTRAINT "circuit_wires_circuit_id_circuit_designs_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuit_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circuit_wires" ADD CONSTRAINT "circuit_wires_net_id_circuit_nets_id_fk" FOREIGN KEY ("net_id") REFERENCES "public"."circuit_nets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "component_parts" ADD CONSTRAINT "component_parts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "history_items" ADD CONSTRAINT "history_items_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "simulation_results" ADD CONSTRAINT "simulation_results_circuit_id_circuit_designs_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuit_designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_chat_settings" ADD CONSTRAINT "user_chat_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ai_actions_project" ON "ai_actions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_ai_actions_message" ON "ai_actions" USING btree ("chat_message_id");--> statement-breakpoint
CREATE INDEX "idx_arch_edges_project" ON "architecture_edges" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_arch_edges_project_deleted" ON "architecture_edges" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_arch_edges_project_edge" ON "architecture_edges" USING btree ("project_id","edge_id");--> statement-breakpoint
CREATE INDEX "idx_arch_nodes_project" ON "architecture_nodes" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_arch_nodes_project_deleted" ON "architecture_nodes" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_arch_nodes_project_node" ON "architecture_nodes" USING btree ("project_id","node_id");--> statement-breakpoint
CREATE INDEX "idx_bom_items_project" ON "bom_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_bom_items_project_deleted" ON "bom_items" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_project" ON "chat_messages" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_project_ts" ON "chat_messages" USING btree ("project_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_circuit_designs_project" ON "circuit_designs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_circuit_instances_circuit" ON "circuit_instances" USING btree ("circuit_id");--> statement-breakpoint
CREATE INDEX "idx_circuit_instances_part" ON "circuit_instances" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX "idx_circuit_nets_circuit" ON "circuit_nets" USING btree ("circuit_id");--> statement-breakpoint
CREATE INDEX "idx_circuit_nets_name" ON "circuit_nets" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_circuit_wires_circuit" ON "circuit_wires" USING btree ("circuit_id");--> statement-breakpoint
CREATE INDEX "idx_circuit_wires_net" ON "circuit_wires" USING btree ("net_id");--> statement-breakpoint
CREATE INDEX "idx_component_library_category" ON "component_library" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_component_library_public" ON "component_library" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "idx_component_parts_project" ON "component_parts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_component_parts_node" ON "component_parts" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "idx_history_items_project" ON "history_items" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_history_items_project_ts" ON "history_items" USING btree ("project_id","timestamp");--> statement-breakpoint
CREATE INDEX "idx_simulation_results_circuit" ON "simulation_results" USING btree ("circuit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_user_chat_settings_user" ON "user_chat_settings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_validation_issues_project" ON "validation_issues" USING btree ("project_id");