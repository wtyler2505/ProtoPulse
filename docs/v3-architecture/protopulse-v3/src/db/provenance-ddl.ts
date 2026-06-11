export const v3ProvenanceEventsSql = `
CREATE TABLE IF NOT EXISTS v3_provenance_events (
  id serial PRIMARY KEY,
  subject_type text NOT NULL,
  subject_key text NOT NULL,
  source_path text NOT NULL,
  source_kind text NOT NULL,
  status text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

export const v3ArchitectureTablesSql = `
CREATE TABLE IF NOT EXISTS v3_verified_facts (
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  fact_key text NOT NULL,
  part_number text NOT NULL,
  source_path text NOT NULL,
  status text NOT NULL,
  value jsonb NOT NULL,
  provenance_event_id integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v3_compile_runs (
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  status text NOT NULL,
  source_shape_count integer NOT NULL,
  emitted_element_count integer NOT NULL,
  blocked_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  emitted_tsx text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v3_swarm_tasks (
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  task_id text NOT NULL,
  agent_role text NOT NULL,
  status text NOT NULL,
  claimed_files jsonb NOT NULL DEFAULT '[]'::jsonb,
  prompt text NOT NULL,
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS v3_inspection_reports (
  id serial PRIMARY KEY,
  project_id integer NOT NULL,
  report_type text NOT NULL,
  query text NOT NULL,
  image_url text,
  chassis_description text,
  markdown text NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
`;

export const v3ArchitectureTableNames = [
  'v3_verified_facts',
  'v3_compile_runs',
  'v3_swarm_tasks',
  'v3_inspection_reports',
] as const;
