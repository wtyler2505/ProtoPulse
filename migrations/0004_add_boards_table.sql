CREATE TABLE "boards" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" integer NOT NULL,
	"width_mm" real DEFAULT 100 NOT NULL,
	"height_mm" real DEFAULT 80 NOT NULL,
	"thickness_mm" real DEFAULT 1.6 NOT NULL,
	"corner_radius_mm" real DEFAULT 2 NOT NULL,
	"layers" integer DEFAULT 2 NOT NULL,
	"copper_weight_oz" real DEFAULT 1 NOT NULL,
	"finish" varchar(50) DEFAULT 'HASL' NOT NULL,
	"solder_mask_color" varchar(30) DEFAULT 'green' NOT NULL,
	"silkscreen_color" varchar(30) DEFAULT 'white' NOT NULL,
	"min_trace_width_mm" real DEFAULT 0.2 NOT NULL,
	"min_drill_size_mm" real DEFAULT 0.3 NOT NULL,
	"castellated_holes" boolean DEFAULT false NOT NULL,
	"impedance_control" boolean DEFAULT false NOT NULL,
	"via_in_pad" boolean DEFAULT false NOT NULL,
	"gold_fingers" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_boards_project" ON "boards" USING btree ("project_id");