import type { OpEnvelope } from './ops.js';

/**
 * Branches — Vol II §A.7. A branch is a pointer: { name, base } where
 * base identifies a prefix of another branch's op sequence. Creating one
 * is O(1) — no copying. Ops for a branch = ops of the base prefix
 * (recursively) + the branch's own ops.
 */
export interface BranchRef {
  /** Base branch name, or null for the root branch. */
  branch: string | null;
  /** How many of the base branch's effective ops are inherited. */
  opCount: number;
}

export interface BranchState {
  name: string;
  base: BranchRef;
  ops: OpEnvelope[];
}

export const MAIN_BRANCH = 'main';

export class BranchLog {
  private branches = new Map<string, BranchState>();

  constructor(initial?: Map<string, BranchState>) {
    if (initial) {
      this.branches = initial;
    } else {
      this.branches.set(MAIN_BRANCH, {
        name: MAIN_BRANCH,
        base: { branch: null, opCount: 0 },
        ops: [],
      });
    }
  }

  has(name: string): boolean {
    return this.branches.has(name);
  }

  names(): string[] {
    return [...this.branches.keys()];
  }

  get(name: string): BranchState {
    const b = this.branches.get(name);
    if (!b) throw new Error(`branch ${name} does not exist`);
    return b;
  }

  append(name: string, env: OpEnvelope): void {
    this.get(name).ops.push(env);
  }

  /**
   * Create a branch at the current head of `from`. O(1): records a
   * pointer to the base prefix length, copies nothing.
   */
  createBranch(name: string, from: string): BranchState {
    if (this.branches.has(name)) throw new Error(`branch ${name} already exists`);
    const base = this.get(from);
    const state: BranchState = {
      name,
      base: { branch: from, opCount: this.opsFor(from).length },
      ops: [],
    };
    this.branches.set(name, state);
    return state;
  }

  /** The effective op sequence of a branch: inherited prefix + own ops. */
  opsFor(name: string): OpEnvelope[] {
    const b = this.get(name);
    if (b.base.branch === null) return [...b.ops];
    const inherited = this.opsFor(b.base.branch).slice(0, b.base.opCount);
    return [...inherited, ...b.ops];
  }

  /** Ops at the fork point between a branch and its base. */
  baseOpsFor(name: string): OpEnvelope[] {
    const b = this.get(name);
    if (b.base.branch === null) return [];
    return this.opsFor(b.base.branch).slice(0, b.base.opCount);
  }

  /** Snapshot for serialization. */
  entries(): BranchState[] {
    return [...this.branches.values()];
  }
}
