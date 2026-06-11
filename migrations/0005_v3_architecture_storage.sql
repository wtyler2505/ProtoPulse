CREATE TABLE IF NOT EXISTS "v3_verified_facts" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"source_type" text NOT NULL,
	"source_ref" text NOT NULL,
	"fact_type" text NOT NULL,
	"subject" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"provenance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" text DEFAULT 'verified' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "v3_compile_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"status" text NOT NULL,
	"accepted_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"blocked_tasks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emitted_tsx" text,
	"compile_input" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"compile_summary" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "v3_swarm_tasks" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"task_id" text NOT NULL,
	"status" text DEFAULT 'planned' NOT NULL,
	"agent_type" text NOT NULL,
	"claimed_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"forbidden_files" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"command_template" text,
	"result" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "v3_inspection_reports" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"mode" text NOT NULL,
	"query" text NOT NULL,
	"chassis_description" text,
	"image_digest" text,
	"markdown" text NOT NULL,
	"provenance" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "v3_verified_facts" ADD CONSTRAINT "v3_verified_facts_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "v3_compile_runs" ADD CONSTRAINT "v3_compile_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "v3_swarm_tasks" ADD CONSTRAINT "v3_swarm_tasks_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "v3_inspection_reports" ADD CONSTRAINT "v3_inspection_reports_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_v3_verified_facts_project" ON "v3_verified_facts" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_v3_verified_facts_subject" ON "v3_verified_facts" USING btree ("project_id","subject");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "v3_verified_facts_value_gin_idx" ON "v3_verified_facts" USING gin ("value" jsonb_path_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_v3_compile_runs_project" ON "v3_compile_runs" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_v3_compile_runs_status" ON "v3_compile_runs" USING btree ("project_id","status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_v3_swarm_tasks_project" ON "v3_swarm_tasks" USING btree ("project_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_v3_swarm_tasks_project_task" ON "v3_swarm_tasks" USING btree ("project_id","task_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_v3_inspection_reports_project" ON "v3_inspection_reports" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_v3_inspection_reports_mode" ON "v3_inspection_reports" USING btree ("project_id","mode");
