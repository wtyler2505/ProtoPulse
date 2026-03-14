---
summary: The Arduino workbench tables (arduinoWorkspaces, arduinoSketchFiles) are the only schema entities that store host filesystem paths, creating a unique persistence boundary between DB records and the local filesystem
type: pattern
areas:
  - architecture
  - conventions
---

# The Arduino workbench schema is the only domain that bridges database records to the host filesystem

In `shared/schema.ts`, the Arduino-related tables introduce a pattern unique in the codebase:

```typescript
export const arduinoWorkspaces = pgTable('arduino_workspaces', {
  rootPath: text('root_path').notNull(),        // Absolute path on host filesystem
  activeSketchPath: text('active_sketch_path'), // Relative to rootPath
});

export const arduinoSketchFiles = pgTable('arduino_sketch_files', {
  relativePath: text('relative_path').notNull(), // Path within workspace
  language: text('language').notNull(),           // ino, h, cpp
  sizeBytes: integer('size_bytes').notNull(),
});
```

Every other table in the schema stores self-contained data — the record IS the truth. Arduino workspaces are different: the DB record is a **pointer** to external state (files on disk). The `rootPath` is an absolute filesystem path, and `activeSketchPath` / `relativePath` are relative to it.

**Why this matters:**
1. **Data integrity is split across two systems.** Deleting the DB record doesn't delete the files. Deleting the files doesn't update the DB. The workspace can become "stale" if files are modified externally.
2. **This is the native desktop pivot in action.** The Arduino tables are explicitly designed for local filesystem access — storing `rootPath` as an absolute path only makes sense when the server runs on the same machine as the files. This wouldn't work in a cloud-hosted deployment.
3. **The build profile table (`arduinoBuildProfiles`) stores `fqbn` (Fully Qualified Board Name)** — the Arduino CLI's board identifier format (e.g., `arduino:avr:uno`). This ties the schema directly to the Arduino CLI's concept model.
4. **The job tracking table (`arduinoJobs`) mirrors a task queue** with `status` (pending/running/completed/failed/cancelled), `startedAt`/`finishedAt`, `exitCode`, and `log`. This is the only place in the schema where process execution state is persisted.

**Contrast with the rest of the schema:** All other entities (architecture nodes, BOM items, circuit instances, simulation results) store their full data in the DB. The Arduino domain is the only one where the DB is an index over external state, not the state itself. This creates unique failure modes (orphaned records, stale paths) that don't exist elsewhere — a filesystem-level variant of the [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario|data durability problem]] that localStorage features face. Both break when the external state source becomes unavailable.

**Connection:** This reflects the [[pure-local-desktop-app-chosen-over-hybrid-because-installation-friction-is-better-than-compromised-hardware-access]] decision — the schema itself encodes the platform assumption. The `arduinoJobs` table's process tracking (status/exitCode/log) is the only schema domain that persists execution state, making it the bridge between the [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop|job queue's in-memory runtime]] and durable storage. The [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls|collaboration system]] cannot share Arduino workspaces across users because filesystem paths are machine-local — this is a hard limit of the DB-to-filesystem bridge pattern.

---

Related:
- [[pure-local-desktop-app-chosen-over-hybrid-because-installation-friction-is-better-than-compromised-hardware-access]] — the platform decision that makes filesystem paths in the schema viable
- [[localstorage-backed-features-are-invisible-technical-debt-because-they-look-shipped-but-break-on-any-multi-device-or-collaboration-scenario]] — another external-state-dependent pattern with similar durability issues
- [[graceful-shutdown-drains-resources-in-dependency-order-with-a-30-second-forced-exit-backstop]] — arduinoJobs tracks process state that the job queue drain must handle on shutdown
- [[collaboration-without-explicit-membership-is-a-silent-data-exposure-because-default-editor-assignment-bypasses-invite-controls]] — filesystem paths are machine-local, creating a hard collaboration limit
- [[the-schema-uses-dual-id-systems-serial-for-db-references-and-text-for-client-generated-uuids-creating-a-two-key-boundary]] — Arduino tables follow the serial PK convention; relativePath is a third ID system (filesystem path)
- [[jsonb-columns-are-a-schema-escape-hatch-that-trades-db-level-validation-for-flexibility-creating-a-zod-bridged-type-boundary]] — Arduino build profiles use typed columns rather than JSONB, unusually strict for this codebase

Areas: [[architecture]], [[conventions]]
