import { create } from 'zustand';
import {
  applyOp,
  BranchLog,
  cloneGraph,
  diff,
  invertOp,
  MAIN_BRANCH,
  materialize,
  newUuid,
  type DesignBundle,
  type DesignGraph,
  type GraphDelta,
  type OpBody,
  type OpMeta,
} from '@protopulse/graph';
import { runErc, type Finding } from '@protopulse/erc';
import { seedPartDb, type PartDb } from '@protopulse/parts';

/**
 * The design session. The BranchLog is mutable, so it lives inside a
 * SessionCore held by the store but NOT treated as reactive state;
 * components subscribe to (branch, opsVersion) and derive the graph /
 * findings / diff through memoized core accessors keyed on those.
 */

export const partDb: PartDb = seedPartDb();

const ACTOR_KEY = 'pp-actor';

function loadActorId(): string {
  try {
    const existing = globalThis.localStorage.getItem(ACTOR_KEY);
    if (existing) return existing;
    const id = newUuid();
    globalThis.localStorage.setItem(ACTOR_KEY, id);
    return id;
  } catch {
    // node / privacy mode — ephemeral actor
    return newUuid();
  }
}

export interface UndoEntry {
  forward: OpBody;
  /** Ops that restore the pre-dispatch state (already inverted). */
  inverse: OpBody[];
}

export class SessionCore {
  readonly log: BranchLog;
  readonly designId: string;
  readonly actorId: string;
  /** Per-actor monotonic counter; initialized to max(existing)+ on load. */
  lamport: number;
  /** Bumped on every log mutation — memo keys include it. */
  version = 0;
  undoStack: UndoEntry[] = [];
  redoStack: UndoEntry[] = [];

  private graphCache = new Map<string, DesignGraph>();
  private findingsCache = new Map<string, Finding[]>();
  private diffCache = new Map<string, GraphDelta>();

  constructor(designId: string, log?: BranchLog) {
    this.designId = designId;
    this.log = log ?? new BranchLog();
    this.actorId = loadActorId();
    let max = 0;
    for (const branch of this.log.entries()) {
      for (const env of branch.ops) max = Math.max(max, env.lamport);
    }
    this.lamport = max;
  }

  static fromBundle(bundle: DesignBundle): SessionCore {
    const map = new Map(bundle.branches.map((b) => [b.name, b] as const));
    return new SessionCore(bundle.designId, new BranchLog(map));
  }

  append(branch: string, op: OpBody, meta?: OpMeta): void {
    this.lamport += 1;
    this.log.append(branch, {
      actor: this.actorId,
      lamport: this.lamport,
      ts: Date.now(),
      op,
      ...(meta !== undefined ? { meta } : {}),
    });
    this.version += 1;
  }

  /** Materialized graph of a branch head, memoized on (branch, version). */
  graphFor(branch: string): DesignGraph {
    const key = `${branch}@${String(this.version)}`;
    const hit = this.graphCache.get(key);
    if (hit) return hit;
    if (this.graphCache.size > 8) this.graphCache.clear();
    const graph = materialize(this.log.opsFor(branch)).graph;
    this.graphCache.set(key, graph);
    return graph;
  }

  /** ERC findings for a branch head, memoized like graphFor. */
  findingsFor(branch: string): Finding[] {
    const key = `${branch}@${String(this.version)}`;
    const hit = this.findingsCache.get(key);
    if (hit) return hit;
    if (this.findingsCache.size > 8) this.findingsCache.clear();
    const findings = runErc(this.graphFor(branch), partDb);
    this.findingsCache.set(key, findings);
    return findings;
  }

  /** diff(other, branch) — what `branch` adds/changes relative to `other`. */
  diffBetween(other: string, branch: string): GraphDelta {
    const key = `${other}->${branch}@${String(this.version)}`;
    const hit = this.diffCache.get(key);
    if (hit) return hit;
    if (this.diffCache.size > 8) this.diffCache.clear();
    const delta = diff(this.graphFor(other), this.graphFor(branch));
    this.diffCache.set(key, delta);
    return delta;
  }

  opCount(branch: string): number {
    return this.log.opsFor(branch).length;
  }
}

export interface SessionState {
  core: SessionCore;
  designId: string;
  branch: string;
  /** Bumped on every log mutation; selectors key on (branch, opsVersion). */
  opsVersion: number;
  selection: ReadonlySet<string>;
  /** Branch name to diff the current branch against (overlay), or null. */
  diffAgainst: string | null;
  canUndo: boolean;
  canRedo: boolean;

  dispatch: (ops: OpBody[], label?: string, meta?: OpMeta) => boolean;
  undo: () => void;
  redo: () => void;
  createBranch: (name: string) => boolean;
  switchBranch: (name: string) => void;
  setSelection: (ids: Iterable<string>) => void;
  clearSelection: () => void;
  setDiffAgainst: (name: string | null) => void;
  replaceWithBundle: (bundle: DesignBundle) => void;
}

export function createSessionStore(initial?: DesignBundle) {
  const core = initial ? SessionCore.fromBundle(initial) : new SessionCore(newUuid());

  return create<SessionState>()((set, get) => ({
    core,
    designId: core.designId,
    branch: initial && core.log.has(initial.head) ? initial.head : MAIN_BRANCH,
    opsVersion: 0,
    selection: new Set<string>(),
    diffAgainst: null,
    canUndo: false,
    canRedo: false,

    dispatch: (ops, label = 'edit', meta) => {
      if (ops.length === 0) return false;
      const { core: c, branch, opsVersion } = get();
      const before = c.graphFor(branch);
      const first = ops[0];
      const forward: OpBody =
        ops.length === 1 && first !== undefined ? first : { kind: 'batch', ops, label };

      // Validate against a draft first so a failing op never lands in the log.
      const draft = cloneGraph(before);
      const res = applyOp(draft, forward);
      if (!res.ok) {
        console.warn(`dispatch rejected: ${res.error}`);
        return false;
      }

      const inverse = invertOp(before, forward);
      c.append(branch, forward, meta);
      c.undoStack.push({ forward, inverse });
      c.redoStack = [];
      set({ opsVersion: opsVersion + 1, canUndo: true, canRedo: false });
      return true;
    },

    undo: () => {
      const { core: c, branch, opsVersion } = get();
      const entry = c.undoStack.pop();
      if (!entry) return;
      if (entry.inverse.length > 0) {
        const first = entry.inverse[0];
        const body: OpBody =
          entry.inverse.length === 1 && first !== undefined
            ? first
            : { kind: 'batch', ops: entry.inverse, label: 'undo' };
        c.append(branch, body);
      }
      c.redoStack.push(entry);
      set({
        opsVersion: opsVersion + 1,
        canUndo: c.undoStack.length > 0,
        canRedo: true,
      });
    },

    redo: () => {
      const { core: c, branch, opsVersion } = get();
      const entry = c.redoStack.pop();
      if (!entry) return;
      const before = c.graphFor(branch);
      const inverse = invertOp(before, entry.forward);
      c.append(branch, entry.forward);
      c.undoStack.push({ forward: entry.forward, inverse });
      set({
        opsVersion: opsVersion + 1,
        canUndo: true,
        canRedo: c.redoStack.length > 0,
      });
    },

    createBranch: (name) => {
      const { core: c, branch, opsVersion } = get();
      const trimmed = name.trim();
      if (trimmed.length === 0 || c.log.has(trimmed)) return false;
      c.log.createBranch(trimmed, branch);
      c.undoStack = [];
      c.redoStack = [];
      set({
        branch: trimmed,
        opsVersion: opsVersion + 1,
        selection: new Set<string>(),
        canUndo: false,
        canRedo: false,
      });
      return true;
    },

    switchBranch: (name) => {
      const { core: c, branch, diffAgainst, opsVersion } = get();
      if (name === branch || !c.log.has(name)) return;
      // Undo stacks are per-head edits; switching heads clears them (M1
      // simplification — a per-branch stack map would also be correct).
      c.undoStack = [];
      c.redoStack = [];
      set({
        branch: name,
        opsVersion: opsVersion + 1,
        selection: new Set<string>(),
        diffAgainst: diffAgainst === name ? null : diffAgainst,
        canUndo: false,
        canRedo: false,
      });
    },

    setSelection: (ids) => {
      set({ selection: new Set(ids) });
    },

    clearSelection: () => {
      set({ selection: new Set<string>() });
    },

    setDiffAgainst: (name) => {
      const { branch } = get();
      set({ diffAgainst: name === branch ? null : name });
    },

    replaceWithBundle: (bundle) => {
      const next = SessionCore.fromBundle(bundle);
      set({
        core: next,
        designId: next.designId,
        branch: next.log.has(bundle.head) ? bundle.head : MAIN_BRANCH,
        opsVersion: get().opsVersion + 1,
        selection: new Set<string>(),
        diffAgainst: null,
        canUndo: false,
        canRedo: false,
      });
    },
  }));
}

export type SessionStore = ReturnType<typeof createSessionStore>;

/** The app-wide session. main.tsx replaces its contents on boot. */
export const useSession: SessionStore = createSessionStore();

// ── Derived accessors (memoized in core, keyed on branch+version) ────

export function getGraph(s: SessionState): DesignGraph {
  return s.core.graphFor(s.branch);
}

export function getFindings(s: SessionState): Finding[] {
  return s.core.findingsFor(s.branch);
}

export function getDiffDelta(s: SessionState): GraphDelta | null {
  return s.diffAgainst === null ? null : s.core.diffBetween(s.diffAgainst, s.branch);
}

export function getOpCount(s: SessionState): number {
  return s.core.opCount(s.branch);
}
