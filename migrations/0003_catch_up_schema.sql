CREATE TABLE IF NOT EXISTS "arduino_build_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"name" text NOT NULL,
	"profile_name" text,
	"fqbn" text NOT NULL,
	"port" text,
	"protocol" text DEFAULT 'serial',
	"board_options" jsonb DEFAULT '{}'::jsonb,
	"port_config" jsonb DEFAULT '{}'::jsonb,
	"lib_overrides" jsonb DEFAULT '{}'::jsonb,
	"verbose_compile" boolean DEFAULT false,
	"verbose_upload" boolean DEFAULT false,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arduino_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"profile_id" integer,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"command" text NOT NULL,
	"args" jsonb DEFAULT '{}'::jsonb,
	"started_at" timestamp,
	"finished_at" timestamp,
	"exit_code" integer,
	"summary" text,
	"error_code" text,
	"log" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arduino_serial_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"port" text NOT NULL,
	"protocol" text DEFAULT 'serial' NOT NULL,
	"baud_rate" integer DEFAULT 115200 NOT NULL,
	"status" text DEFAULT 'closed' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"settings" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arduino_sketch_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"workspace_id" integer NOT NULL,
	"relative_path" text NOT NULL,
	"language" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "arduino_workspaces" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"root_path" text NOT NULL,
	"active_sketch_path" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bom_template_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"part_id" uuid NOT NULL,
	"quantity_needed" integer DEFAULT 1 NOT NULL,
	"unit_price" numeric(10, 4),
	"supplier" text,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "bom_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"tags" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "circuit_vias" (
	"id" serial PRIMARY KEY NOT NULL,
	"circuit_id" integer NOT NULL,
	"net_id" integer NOT NULL,
	"x" real NOT NULL,
	"y" real NOT NULL,
	"outer_diameter" real NOT NULL,
	"drill_diameter" real NOT NULL,
	"via_type" text DEFAULT 'through' NOT NULL,
	"layer_start" text DEFAULT 'front' NOT NULL,
	"layer_end" text DEFAULT 'back' NOT NULL,
	"tented" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "part_alternates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"alt_part_id" uuid NOT NULL,
	"match_score" real NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "part_lifecycle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"obsolete_date" timestamp,
	"replacement_part_id" uuid,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "part_placements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"surface" text NOT NULL,
	"container_type" text NOT NULL,
	"container_id" integer NOT NULL,
	"reference_designator" text NOT NULL,
	"x" real,
	"y" real,
	"rotation" real DEFAULT 0 NOT NULL,
	"layer" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "part_spice_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"model_text" text NOT NULL,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "part_stock" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" integer,
	"part_id" uuid NOT NULL,
	"quantity_needed" integer DEFAULT 0 NOT NULL,
	"quantity_on_hand" integer,
	"minimum_stock" integer,
	"storage_location" text,
	"unit_price" numeric(10, 4),
	"supplier" text,
	"lead_time" text,
	"status" text DEFAULT 'In Stock' NOT NULL,
	"notes" text,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"manufacturer" text,
	"mpn" text,
	"canonical_category" text NOT NULL,
	"package_type" text,
	"tolerance" text,
	"esd_sensitive" boolean,
	"assembly_category" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"connectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"datasheet_url" text,
	"manufacturer_url" text,
	"origin" text NOT NULL,
	"origin_ref" text,
	"forked_from_id" uuid,
	"author_user_id" integer,
	"is_public" boolean DEFAULT false NOT NULL,
	"trust_level" text DEFAULT 'user' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "parts_ingress_failures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"project_id" integer,
	"legacy_table" text NOT NULL,
	"legacy_id" integer,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_message" text NOT NULL,
	"error_stack" text,
	"reconciled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"reconciled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pcb_zones" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"zone_type" varchar(50) NOT NULL,
	"layer" varchar(50) NOT NULL,
	"points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"net_id" integer,
	"name" text,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "project_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "simulation_scenarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"circuit_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "supply_chain_alerts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"project_id" integer,
	"alert_type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"previous_value" text,
	"current_value" text,
	"supplier" text,
	"acknowledged" boolean DEFAULT false NOT NULL,
	"acknowledged_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_comments" DROP CONSTRAINT IF EXISTS "design_comments_resolved_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bom_items" ADD COLUMN IF NOT EXISTS "tolerance" text;--> statement-breakpoint
ALTER TABLE "circuit_instances" ADD COLUMN IF NOT EXISTS "sub_design_id" integer;--> statement-breakpoint
ALTER TABLE "circuit_instances" ADD COLUMN IF NOT EXISTS "bench_x" real;--> statement-breakpoint
ALTER TABLE "circuit_instances" ADD COLUMN IF NOT EXISTS "bench_y" real;--> statement-breakpoint
ALTER TABLE "circuit_wires" ADD COLUMN IF NOT EXISTS "endpoint_meta" jsonb;--> statement-breakpoint
ALTER TABLE "circuit_wires" ADD COLUMN IF NOT EXISTS "provenance" text DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "design_comments" ADD COLUMN IF NOT EXISTS "spatial_x" real;--> statement-breakpoint
ALTER TABLE "design_comments" ADD COLUMN IF NOT EXISTS "spatial_y" real;--> statement-breakpoint
ALTER TABLE "design_comments" ADD COLUMN IF NOT EXISTS "spatial_view" text;--> statement-breakpoint
ALTER TABLE "design_comments" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "design_comments" ADD COLUMN IF NOT EXISTS "status_updated_by" integer;--> statement-breakpoint
ALTER TABLE "design_comments" ADD COLUMN IF NOT EXISTS "status_updated_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "approved_by" integer;--> statement-breakpoint
ALTER TABLE "user_chat_settings" ADD COLUMN IF NOT EXISTS "preview_ai_changes" boolean DEFAULT true NOT NULL;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arduino_build_profiles" ADD CONSTRAINT "arduino_build_profiles_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arduino_jobs" ADD CONSTRAINT "arduino_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arduino_jobs" ADD CONSTRAINT "arduino_jobs_profile_id_arduino_build_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."arduino_build_profiles"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arduino_serial_sessions" ADD CONSTRAINT "arduino_serial_sessions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arduino_sketch_files" ADD CONSTRAINT "arduino_sketch_files_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arduino_sketch_files" ADD CONSTRAINT "arduino_sketch_files_workspace_id_arduino_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."arduino_workspaces"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arduino_workspaces" ADD CONSTRAINT "arduino_workspaces_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bom_template_items" ADD CONSTRAINT "bom_template_items_template_id_bom_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."bom_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bom_template_items" ADD CONSTRAINT "bom_template_items_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bom_templates" ADD CONSTRAINT "bom_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "circuit_vias" ADD CONSTRAINT "circuit_vias_circuit_id_circuit_designs_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuit_designs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "circuit_vias" ADD CONSTRAINT "circuit_vias_net_id_circuit_nets_id_fk" FOREIGN KEY ("net_id") REFERENCES "public"."circuit_nets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_alternates" ADD CONSTRAINT "part_alternates_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_alternates" ADD CONSTRAINT "part_alternates_alt_part_id_parts_id_fk" FOREIGN KEY ("alt_part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_lifecycle" ADD CONSTRAINT "part_lifecycle_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_lifecycle" ADD CONSTRAINT "part_lifecycle_replacement_part_id_parts_id_fk" FOREIGN KEY ("replacement_part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_placements" ADD CONSTRAINT "part_placements_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_spice_models" ADD CONSTRAINT "part_spice_models_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_stock" ADD CONSTRAINT "part_stock_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "part_stock" ADD CONSTRAINT "part_stock_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "parts" ADD CONSTRAINT "parts_forked_from_id_parts_id_fk" FOREIGN KEY ("forked_from_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "parts" ADD CONSTRAINT "parts_author_user_id_users_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pcb_zones" ADD CONSTRAINT "pcb_zones_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "pcb_zones" ADD CONSTRAINT "pcb_zones_net_id_circuit_nets_id_fk" FOREIGN KEY ("net_id") REFERENCES "public"."circuit_nets"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "project_members" ADD CONSTRAINT "project_members_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "project_members" ADD CONSTRAINT "project_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "project_members" ADD CONSTRAINT "project_members_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "simulation_scenarios" ADD CONSTRAINT "simulation_scenarios_circuit_id_circuit_designs_id_fk" FOREIGN KEY ("circuit_id") REFERENCES "public"."circuit_designs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supply_chain_alerts" ADD CONSTRAINT "supply_chain_alerts_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "supply_chain_alerts" ADD CONSTRAINT "supply_chain_alerts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_arduino_profiles_project" ON "arduino_build_profiles" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_arduino_jobs_project" ON "arduino_jobs" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_arduino_jobs_status" ON "arduino_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_arduino_serial_project" ON "arduino_serial_sessions" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_arduino_files_project" ON "arduino_sketch_files" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_arduino_files_workspace" ON "arduino_sketch_files" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_arduino_workspaces_project" ON "arduino_workspaces" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bom_template_items_template" ON "bom_template_items" USING btree ("template_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_bom_template_items_template_part" ON "bom_template_items" USING btree ("template_id","part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bom_templates_user" ON "bom_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_bom_templates_deleted" ON "bom_templates" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_circuit_vias_circuit" ON "circuit_vias" USING btree ("circuit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_circuit_vias_net" ON "circuit_vias" USING btree ("net_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_part_alternates_pair" ON "part_alternates" USING btree ("part_id","alt_part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_alternates_part" ON "part_alternates" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_alternates_alt" ON "part_alternates" USING btree ("alt_part_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_part_lifecycle_part" ON "part_lifecycle" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_lifecycle_replacement" ON "part_lifecycle" USING btree ("replacement_part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_placements_part" ON "part_placements" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_placements_container" ON "part_placements" USING btree ("container_type","container_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_placements_surface" ON "part_placements" USING btree ("surface");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_placements_deleted" ON "part_placements" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "part_placements_properties_gin_idx" ON "part_placements" USING gin ("properties" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_spice_models_part" ON "part_spice_models" USING btree ("part_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_part_spice_models_part_filename" ON "part_spice_models" USING btree ("part_id","filename");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_part_stock_project_part" ON "part_stock" USING btree ("project_id","part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_stock_project" ON "part_stock" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_stock_project_deleted" ON "part_stock" USING btree ("project_id","deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_stock_part" ON "part_stock" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_part_stock_personal" ON "part_stock" USING btree ("part_id","deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_parts_slug" ON "parts" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_parts_manufacturer_mpn" ON "parts" USING btree ("manufacturer","mpn") WHERE "parts"."mpn" IS NOT NULL AND "parts"."manufacturer" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_canonical_category" ON "parts" USING btree ("canonical_category");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_trust_level" ON "parts" USING btree ("trust_level");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_origin" ON "parts" USING btree ("origin");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_is_public" ON "parts" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_deleted_at" ON "parts" USING btree ("deleted_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parts_meta_gin_idx" ON "parts" USING gin ("meta" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "parts_connectors_gin_idx" ON "parts" USING gin ("connectors" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_ingress_failures_reconciled" ON "parts_ingress_failures" USING btree ("reconciled");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_ingress_failures_legacy" ON "parts_ingress_failures" USING btree ("legacy_table","legacy_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_parts_ingress_failures_created" ON "parts_ingress_failures" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pcb_zones_project" ON "pcb_zones" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_pcb_zones_layer" ON "pcb_zones" USING btree ("layer");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_members_project" ON "project_members" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_members_user" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_project_members" ON "project_members" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_simulation_scenarios_project" ON "simulation_scenarios" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_simulation_scenarios_circuit" ON "simulation_scenarios" USING btree ("circuit_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supply_chain_alerts_part" ON "supply_chain_alerts" USING btree ("part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supply_chain_alerts_project" ON "supply_chain_alerts" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_supply_chain_alerts_unacknowledged" ON "supply_chain_alerts" USING btree ("acknowledged","created_at");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "circuit_instances" ADD CONSTRAINT "circuit_instances_sub_design_id_circuit_designs_id_fk" FOREIGN KEY ("sub_design_id") REFERENCES "public"."circuit_designs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "design_comments" ADD CONSTRAINT "design_comments_status_updated_by_users_id_fk" FOREIGN KEY ("status_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_approved_by_users_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "arch_nodes_data_gin_idx" ON "architecture_nodes" USING gin ("data" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "circuit_instances_properties_gin_idx" ON "circuit_instances" USING gin ("properties" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "component_parts_meta_gin_idx" ON "component_parts" USING gin ("meta" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "component_parts_connectors_gin_idx" ON "component_parts" USING gin ("connectors" jsonb_path_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_projects_owner_deleted" ON "projects" USING btree ("owner_id","deleted_at");--> statement-breakpoint
ALTER TABLE "design_comments" DROP COLUMN IF EXISTS "resolved";--> statement-breakpoint
ALTER TABLE "design_comments" DROP COLUMN IF EXISTS "resolved_by";--> statement-breakpoint
ALTER TABLE "design_comments" DROP COLUMN IF EXISTS "resolved_at";