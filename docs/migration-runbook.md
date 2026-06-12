# Legacy → .ppx Migration Runbook

How to take a real legacy ProtoPulse project out of Postgres and through
`protopulse import-legacy` into a `.ppx.json` op-log bundle. Proven end-to-end
on synthetic snapshots 2026-06-12 (small / medium / dirty edge cases — all
import, materialize, and pass `protopulse check` clean). **The roadmap
migration criterion still requires Tyler's REAL projects** — this runbook is
the path, not the proof.

## Why a table dump, not the app's export

The legacy app's own project-export format drops instance ids and part links,
which severs net connectivity. The importer therefore reads a **raw-row dump
WITH ids** straight from the database.

## 1. Build the CLI (once)

```bash
npm run -w @protopulse/cli build
```

## 2. Find your project id

```bash
psql "$DATABASE_URL" -c "select id, name from projects order by id;"
```

`DATABASE_URL` is the same env var the legacy server uses (`server/db.ts`
refuses to start without it).

## 3. Export the snapshot

Replace `:PID` with the project id (e.g. `42`) in both places, or use
`-v pid=42` and `:pid`:

```bash
psql "$DATABASE_URL" -At -v pid=42 -c "select json_build_object(
  'project', (select json_build_object('name', name) from projects where id = :pid),
  'parts', (select coalesce(json_agg(json_build_object(
    'id', id, 'meta', meta, 'connectors', connectors)), '[]')
    from component_parts where project_id = :pid),
  'designs', (select coalesce(json_agg(json_build_object(
    'id', d.id, 'name', d.name,
    'instances', (select coalesce(json_agg(json_build_object(
      'id', i.id, 'referenceDesignator', i.reference_designator, 'partId', i.part_id,
      'schematicX', i.schematic_x, 'schematicY', i.schematic_y,
      'schematicRotation', i.schematic_rotation, 'properties', i.properties)), '[]')
      from circuit_instances i where i.circuit_id = d.id),
    'nets', (select coalesce(json_agg(json_build_object(
      'id', n.id, 'name', n.name, 'segments', n.segments)), '[]')
      from circuit_nets n where n.circuit_id = d.id))), '[]')
    from circuit_designs d where d.project_id = :pid)
)" > snapshot.json
```

(The same SQL ships in `protopulse import-legacy --help`.)

## 4. Import

```bash
node packages/cli/dist/protopulse.js import-legacy snapshot.json --out my-project.ppx.json
# multiple circuit designs in one project? one bundle each:
node packages/cli/dist/protopulse.js import-legacy snapshot.json --design "Power Sheet" --out power-sheet.ppx.json
```

Read the report. Every skip has a reason (unmappable part, ghost instance,
unmatched pin, port already claimed); duplicate reference designators get
uniquified with a visible `.2` suffix and a note. `!!` problem lines mean the
bundle is unsound — exit code 1, stop and investigate.

## 5. Verify

```bash
node packages/cli/dist/protopulse.js check my-project.ppx.json
```

Exit 0 = materializes clean, invariants hold, ERC passes. ERC findings here
are about the *circuit*, not the importer — a design that genuinely has no
power source will say so.

## Known scope limits (by design)

- One legacy circuit design per bundle; hierarchy (sub-designs) not imported.
- Parts map onto the engine seed library by mpn/title/category heuristics;
  anything unmappable is **skipped with its reason** — pinouts are never
  guessed (hardware verification protocol).
- Schematic positions rescale (25 legacy px = 1.27 mm grid step) and snap;
  breadboard/bench/pcb views don't carry over.
- Dirty data degrades loudly: first net wins a contested port, ghost
  instances and empty nets are skipped, all of it reported.
