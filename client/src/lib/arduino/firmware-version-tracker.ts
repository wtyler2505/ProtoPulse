/**
 * BL-0423 — Firmware Version Tracker
 *
 * Singleton+subscribe manager that tracks firmware build versions,
 * links them to design snapshots, computes sketch hashes for change
 * detection, supports version diffing, and generates human-readable
 * labels (semantic-style with build metadata).
 *
 * Pure module — no React/DOM dependencies.
 * Persists to localStorage.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** A recorded firmware version entry. */
export interface FirmwareVersion {
  id: string;
  projectId: number;
  label: string;
  sketchHash: string;
  designSnapshotId: number | null;
  boardFqbn: string;
  buildTimestamp: number;
  sketchPath: string;
  notes: string;
  tags: string[];
  metadata: Record<string, unknown>;
}

/** Data required to record a new firmware version. */
export interface RecordVersionData {
  projectId: number;
  sketchContent: string;
  boardFqbn: string;
  sketchPath: string;
  designSnapshotId?: number | null;
  notes?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
  labelOverride?: string;
}

/** Result of comparing two firmware versions. */
export interface FirmwareVersionDiff {
  sourceId: string;
  targetId: string;
  sourceLabel: string;
  targetLabel: string;
  sketchChanged: boolean;
  boardChanged: boolean;
  snapshotChanged: boolean;
  tagsDiff: {
    added: string[];
    removed: string[];
  };
  metadataDiff: {
    added: string[];
    removed: string[];
    modified: string[];
  };
}

/** Snapshot returned by getSnapshot() for subscribe pattern. */
export interface FirmwareTrackerSnapshot {
  versions: FirmwareVersion[];
  version: number;
}

const STORAGE_KEY = 'protopulse-firmware-versions';
const MAX_VERSIONS_PER_PROJECT = 200;

// ---------------------------------------------------------------------------
// Hash helper
// ---------------------------------------------------------------------------

/**
 * Compute a simple djb2 hash of sketch content.
 * Deterministic, fast, sufficient for change detection (not cryptographic).
 */
export function computeSketchHash(content: string): string {
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash + content.charCodeAt(i)) | 0;
  }
  // Convert to unsigned 32-bit hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// ---------------------------------------------------------------------------
// Label generation
// ---------------------------------------------------------------------------

/**
 * Generate a version label like "v1.0.0+build.3".
 * Uses a simple major.minor.patch scheme based on project version count.
 * The patch increments with each build; minor bumps when the board changes;
 * major bumps when explicitly tagged with "breaking".
 */
export function generateVersionLabel(
  existingVersions: FirmwareVersion[],
  projectId: number,
  boardFqbn: string,
  tags: string[],
): string {
  const projectVersions = existingVersions.filter((v) => v.projectId === projectId);
  const buildNumber = projectVersions.length + 1;

  if (projectVersions.length === 0) {
    return `v1.0.0+build.${buildNumber}`;
  }

  // Parse the last label to extract version numbers
  const lastVersion = projectVersions[projectVersions.length - 1];
  const match = lastVersion.label.match(/^v(\d+)\.(\d+)\.(\d+)/);
  let major = match ? parseInt(match[1], 10) : 1;
  let minor = match ? parseInt(match[2], 10) : 0;
  let patch = match ? parseInt(match[3], 10) : 0;

  const isBreaking = tags.includes('breaking');
  const boardChanged = lastVersion.boardFqbn !== boardFqbn;

  if (isBreaking) {
    major++;
    minor = 0;
    patch = 0;
  } else if (boardChanged) {
    minor++;
    patch = 0;
  } else {
    patch++;
  }

  return `v${major}.${minor}.${patch}+build.${buildNumber}`;
}

// ---------------------------------------------------------------------------
// FirmwareVersionTracker
// ---------------------------------------------------------------------------

export class FirmwareVersionTracker {
  private static instance: FirmwareVersionTracker | null = null;

  private versions: FirmwareVersion[] = [];
  private listeners = new Set<Listener>();
  private _version = 0;

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): FirmwareVersionTracker {
    if (!FirmwareVersionTracker.instance) {
      FirmwareVersionTracker.instance = new FirmwareVersionTracker();
    }
    return FirmwareVersionTracker.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    FirmwareVersionTracker.instance = null;
  }

  /** Monotonic version counter for useSyncExternalStore integration. */
  get storeVersion(): number {
    return this._version;
  }

  // -----------------------------------------------------------------------
  // Query API
  // -----------------------------------------------------------------------

  /** Get a snapshot for the subscribe pattern. */
  getSnapshot(): FirmwareTrackerSnapshot {
    return { versions: [...this.versions], version: this._version };
  }

  /** List all versions for a project, newest first. */
  listVersions(projectId: number): FirmwareVersion[] {
    return this.versions
      .filter((v) => v.projectId === projectId)
      .sort((a, b) => b.buildTimestamp - a.buildTimestamp);
  }

  /** Get a single version by ID. */
  getVersion(id: string): FirmwareVersion | undefined {
    return this.versions.find((v) => v.id === id);
  }

  /** Get the latest version for a project. */
  getLatestVersion(projectId: number): FirmwareVersion | undefined {
    const projectVersions = this.listVersions(projectId);
    return projectVersions.length > 0 ? projectVersions[0] : undefined;
  }

  /** Find versions linked to a specific design snapshot. */
  findBySnapshot(snapshotId: number): FirmwareVersion[] {
    return this.versions.filter((v) => v.designSnapshotId === snapshotId);
  }

  /** Find versions by tag. */
  findByTag(tag: string, projectId?: number): FirmwareVersion[] {
    return this.versions.filter(
      (v) => v.tags.includes(tag) && (projectId === undefined || v.projectId === projectId),
    );
  }

  /** Check if sketch content has changed since the last version. */
  hasSketchChanged(projectId: number, currentContent: string): boolean {
    const latest = this.getLatestVersion(projectId);
    if (!latest) {
      return true; // No prior version — treat as changed
    }
    return latest.sketchHash !== computeSketchHash(currentContent);
  }

  // -----------------------------------------------------------------------
  // Mutation API
  // -----------------------------------------------------------------------

  /** Record a new firmware version. Returns the created version. */
  recordVersion(data: RecordVersionData): FirmwareVersion {
    const sketchHash = computeSketchHash(data.sketchContent);
    const tags = data.tags ?? [];
    const projectVersions = this.versions.filter((v) => v.projectId === data.projectId);

    const label =
      data.labelOverride ??
      generateVersionLabel(this.versions, data.projectId, data.boardFqbn, tags);

    const version: FirmwareVersion = {
      id: crypto.randomUUID(),
      projectId: data.projectId,
      label,
      sketchHash,
      designSnapshotId: data.designSnapshotId ?? null,
      boardFqbn: data.boardFqbn,
      buildTimestamp: Date.now(),
      sketchPath: data.sketchPath,
      notes: data.notes ?? '',
      tags,
      metadata: data.metadata ?? {},
    };

    this.versions.push(version);

    // Enforce per-project cap — remove oldest when exceeding limit
    if (projectVersions.length >= MAX_VERSIONS_PER_PROJECT) {
      const oldest = projectVersions
        .sort((a, b) => a.buildTimestamp - b.buildTimestamp)[0];
      if (oldest) {
        this.versions = this.versions.filter((v) => v.id !== oldest.id);
      }
    }

    this.bump();
    return version;
  }

  /** Link a version to a design snapshot. */
  linkSnapshot(versionId: string, snapshotId: number): boolean {
    const version = this.getVersion(versionId);
    if (!version) {
      return false;
    }
    version.designSnapshotId = snapshotId;
    this.bump();
    return true;
  }

  /** Add a tag to a version. */
  addTag(versionId: string, tag: string): boolean {
    const version = this.getVersion(versionId);
    if (!version) {
      return false;
    }
    if (version.tags.includes(tag)) {
      return false; // Already has tag
    }
    version.tags.push(tag);
    this.bump();
    return true;
  }

  /** Remove a tag from a version. */
  removeTag(versionId: string, tag: string): boolean {
    const version = this.getVersion(versionId);
    if (!version) {
      return false;
    }
    const idx = version.tags.indexOf(tag);
    if (idx === -1) {
      return false;
    }
    version.tags.splice(idx, 1);
    this.bump();
    return true;
  }

  /** Update notes on a version. */
  updateNotes(versionId: string, notes: string): boolean {
    const version = this.getVersion(versionId);
    if (!version) {
      return false;
    }
    version.notes = notes;
    this.bump();
    return true;
  }

  /** Delete a version by ID. */
  deleteVersion(id: string): boolean {
    const before = this.versions.length;
    this.versions = this.versions.filter((v) => v.id !== id);
    if (this.versions.length === before) {
      return false;
    }
    this.bump();
    return true;
  }

  // -----------------------------------------------------------------------
  // Diffing
  // -----------------------------------------------------------------------

  /** Compare two firmware versions. */
  diffVersions(sourceId: string, targetId: string): FirmwareVersionDiff | undefined {
    const source = this.getVersion(sourceId);
    const target = this.getVersion(targetId);
    if (!source || !target) {
      return undefined;
    }

    const sourceTagSet = new Set(source.tags);
    const targetTagSet = new Set(target.tags);

    const addedTags = target.tags.filter((t) => !sourceTagSet.has(t));
    const removedTags = source.tags.filter((t) => !targetTagSet.has(t));

    const sourceMetaKeys = new Set(Object.keys(source.metadata));
    const targetMetaKeys = new Set(Object.keys(target.metadata));

    const addedMeta = Array.from(targetMetaKeys).filter((k) => !sourceMetaKeys.has(k));
    const removedMeta = Array.from(sourceMetaKeys).filter((k) => !targetMetaKeys.has(k));
    const modifiedMeta = Array.from(sourceMetaKeys).filter(
      (k) => targetMetaKeys.has(k) && JSON.stringify(source.metadata[k]) !== JSON.stringify(target.metadata[k]),
    );

    return {
      sourceId,
      targetId,
      sourceLabel: source.label,
      targetLabel: target.label,
      sketchChanged: source.sketchHash !== target.sketchHash,
      boardChanged: source.boardFqbn !== target.boardFqbn,
      snapshotChanged: source.designSnapshotId !== target.designSnapshotId,
      tagsDiff: { added: addedTags, removed: removedTags },
      metadataDiff: { added: addedMeta, removed: removedMeta, modified: modifiedMeta },
    };
  }

  // -----------------------------------------------------------------------
  // Subscribe pattern
  // -----------------------------------------------------------------------

  /** Subscribe to changes. Returns an unsubscribe function. */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private bump(): void {
    this._version++;
    this.persist();
    this.notify();
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.versions));
    } catch {
      // Storage quota exceeded or unavailable — silently degrade
    }
  }

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.versions = parsed as FirmwareVersion[];
        }
      }
    } catch {
      // Corrupted storage — start fresh
      this.versions = [];
    }
  }
}
