import { runErc  } from '@protopulse/erc';
import {
  applyOp,
  BranchLog,
  cloneGraph,
  diff,
  invertOp,
  MAIN_BRANCH,
  materialize,
  newUuid,
  resolveConflict,
  threeWayMerge
} from '@protopulse/graph';
import { seedPartDb  } from '@protopulse/parts';
import { create } from 'zustand';

import type {Finding} from '@protopulse/erc';
import type {
  DesignBundle,
  DesignGraph,
  GraphDelta,
  MergeChoice,
  MergeConflict,
  OpBody,
  OpEnvelope,
  OpMeta,
} from '@protopulse/graph';
import type {PartDb} from '@protopulse/parts';

/**
 * The design session. The BranchLog is mutable, so it lives inside a
 * SessionCore held by the store but NOT treated as reactive state;
 * components subscribe to (branch, opsVersion) and derive the graph /
 * findings / diff through memoized core accessors keyed on those.
 */

export const partDb: PartDb = seedPartDb();

const ACTOR_KEY = 'pp-actor';

/** Actor identity lives in sessionStorage: unique PER TAB (two tabs of
 *  one browser are two actors — per-actor lamports stay collision-free
 *  under sync), stable across that tab's reloads. A legacy localStorage
 *  actor id is migrated once so a single-tab user keeps their history's
 *  identity. */
function loadActorId(): string {
  try {
    const existing = globalThis.sessionStorage.getItem(ACTOR_KEY);
    if (existing) return existing;
    // First load in this tab: adopt the old device-wide id if present
    // (and retire it so the NEXT tab mints its own), else mint fresh.
    let id: string | null = null;
    try {
      id = globalThis.localStorage.getItem(ACTOR_KEY);
      if (id !== null) globalThis.localStorage.removeItem(ACTOR_KEY);
    } catch {
      // localStorage unavailable — sessionStorage may still work
    }
    id ??= newUuid();
    globalThis.sessionStorage.setItem(ACTOR_KEY, id);
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
  private replayCache = new Map<string, DesignGraph>();

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

  /** Ingest REMOTE envelopes (sync): append unseen ones verbatim —
   *  their (actor, lamport) identity is preserved, dedupe is by that
   *  key, and the local lamport clock advances past everything seen so
   *  the next local op sorts after. Returns how many were new. */
  ingest(branch: string, envelopes: readonly OpEnvelope[]): number {
    if (!this.log.has(branch)) return 0;
    const seen = new Set(this.log.opsFor(branch).map((e) => `${e.actor}:${String(e.lamport)}`));
    let fresh = 0;
    for (const env of envelopes) {
      const key = `${env.actor}:${String(env.lamport)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      this.log.append(branch, env);
      this.lamport = Math.max(this.lamport, env.lamport);
      fresh += 1;
    }
    if (fresh > 0) this.version += 1;
    return fresh;
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

  /** The graph after only the first `count` ops of `branch` — replay
   *  time-travel. The design IS its op-log, so any moment in its history
   *  is just a prefix materialization. Memoized per (branch, version,
   *  count) with a larger budget than head graphs: scrubbing touches
   *  many prefixes of the same log. */
  graphAt(branch: string, count: number): DesignGraph {
    const ops = this.log.opsFor(branch);
    const n = Math.max(0, Math.min(Math.floor(count), ops.length));
    if (n === ops.length) return this.graphFor(branch);
    const key = `${branch}@${String(this.version)}#${String(n)}`;
    const hit = this.replayCache.get(key);
    if (hit) return hit;
    if (this.replayCache.size > 64) this.replayCache.clear();
    const graph = materialize(ops.slice(0, n)).graph;
    this.replayCache.set(key, graph);
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

/** An in-progress merge: computed once by startMerge, resolved choice
 *  by choice, landed (or abandoned) as a whole. Conflicts are data —
 *  nothing applies until every one has a pick. */
export interface MergeSession {
  /** Branch being merged INTO the current branch. */
  from: string;
  autoOps: OpBody[];
  conflicts: MergeConflict[];
  /** Index-aligned with conflicts; null = not yet decided. */
  choices: (MergeChoice | null)[];
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
  /** Time-travel position: materialize only the first N ops of the
   *  current branch (0..opCount). null = live head. The session is
   *  read-only while replaying — dispatch/undo/redo refuse. */
  replayIndex: number | null;
  /** In-progress merge into the current branch, or null. */
  merge: MergeSession | null;
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
  /** Enter/scrub/exit replay; the index clamps to [0, opCount]. */
  setReplayIndex: (index: number | null) => void;
  /** Sync: append remote envelopes to MAIN (dedupe by actor:lamport).
   *  Bypasses dispatch — remote ops are not locally undoable. */
  ingestRemote: (envelopes: readonly OpEnvelope[], branch?: string) => number;
  /** Adopt a branch learned from a sync peer (pointer only, no ops). */
  adoptRemoteBranch: (name: string, base: { branch: string | null; opCount: number }) => { ok: true } | { ok: false; reason: string };
  /** Compute a three-way merge of `from` into the current branch. */
  startMerge: (from: string) => boolean;
  setMergeChoice: (index: number, choice: MergeChoice) => void;
  cancelMerge: () => void;
  /** Land autoOps + every resolution as ONE batch (parents recorded).
   *  Refuses while any conflict is undecided. */
  applyMerge: () => boolean;
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
    replayIndex: null,
    merge: null,
    canUndo: false,
    canRedo: false,

    dispatch: (ops, label = 'edit', meta) => {
      if (ops.length === 0) return false;
      if (get().replayIndex !== null) {
        console.warn('dispatch ignored: the session is replaying history (read-only)');
        return false;
      }
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
      // Any landed edit invalidates a merge computed against the old head.
      set({ opsVersion: opsVersion + 1, canUndo: true, canRedo: false, merge: null });
      return true;
    },

    undo: () => {
      if (get().replayIndex !== null) return;
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
      if (get().replayIndex !== null) return;
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
        replayIndex: null,
        merge: null,
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
        replayIndex: null,
        merge: null,
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

    setReplayIndex: (index) => {
      if (index === null) {
        set({ replayIndex: null });
        return;
      }
      const { core: c, branch } = get();
      const clamped = Math.max(0, Math.min(Math.floor(index), c.opCount(branch)));
      // A past graph may not contain the current selection — drop it.
      set({ replayIndex: clamped, selection: new Set<string>() });
    },

    adoptRemoteBranch: (name, base) => {
      const { core: c, opsVersion } = get();
      const result = c.log.adoptBranch(name, base);
      if (result.ok) set({ opsVersion: opsVersion + 1 });
      return result;
    },
    ingestRemote: (envelopes, branch = MAIN_BRANCH) => {
      const { core: c, opsVersion } = get();
      const fresh = c.ingest(branch, envelopes);
      if (fresh > 0) set({ opsVersion: opsVersion + 1 });
      return fresh;
    },

    startMerge: (from) => {
      const { core: c, branch, replayIndex } = get();
      if (replayIndex !== null || from === branch || !c.log.has(from)) return false;
      const base = materialize(c.log.mergeBaseOps(branch, from)).graph;
      const result = threeWayMerge(base, c.graphFor(branch), c.graphFor(from));
      set({
        merge: {
          from,
          autoOps: result.autoOps,
          conflicts: result.conflicts,
          choices: result.conflicts.map(() => null),
        },
      });
      return true;
    },

    setMergeChoice: (index, choice) => {
      const { merge } = get();
      if (!merge || index < 0 || index >= merge.choices.length) return;
      const choices = [...merge.choices];
      choices[index] = choice;
      set({ merge: { ...merge, choices } });
    },

    cancelMerge: () => {
      set({ merge: null });
    },

    applyMerge: () => {
      const { core: c, branch, merge, replayIndex } = get();
      if (!merge || replayIndex !== null) return false;
      const graphs = { ours: c.graphFor(branch), theirs: c.graphFor(merge.from) };
      const ops: OpBody[] = [...merge.autoOps];
      for (const [i, conflict] of merge.conflicts.entries()) {
        const choice = merge.choices[i];
        if (choice === null || choice === undefined) return false; // undecided
        const resolved = resolveConflict(conflict, choice, graphs, ops);
        if (resolved === null) return false; // inexpressible pick — merge stays open
        ops.push(...resolved);
      }
      if (ops.length === 0) {
        set({ merge: null });
        return true; // already up to date
      }
      const batch: OpBody = {
        kind: 'batch',
        ops,
        label: `merge ${merge.from}`,
        parents: [branch, merge.from],
      };
      // dispatch clears `merge` on success; a refused apply keeps the
      // merge (and the user's resolutions) open instead of losing them.
      return get().dispatch([batch]);
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
        replayIndex: null,
        merge: null,
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

/** The graph every view renders: the live head, or — while replaying —
 *  the prefix materialization at the scrub position. */
export function getGraph(s: SessionState): DesignGraph {
  return s.replayIndex === null
    ? s.core.graphFor(s.branch)
    : s.core.graphAt(s.branch, s.replayIndex);
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
