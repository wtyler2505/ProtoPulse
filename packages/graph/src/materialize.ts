import { applyOp  } from './apply.js';
import { validateGraph   } from './invariants.js';
import { compareEnvelopes, opId   } from './ops.js';
import { cloneGraph, emptyGraph  } from './types.js';

import type {ApplyWarning} from './apply.js';
import type {InvariantOpts, InvariantViolation} from './invariants.js';
import type {OpEnvelope, OpId} from './ops.js';
import type {DesignGraph} from './types.js';

/**
 * The graph is a materialized view of the op log. Materialization is
 * deterministic: envelopes are sorted into the (lamport, actorId) total
 * order, then applied in sequence. Failed ops are skipped with a warning
 * — concurrent histories may race — but invariant violations are corrupt-log.
 */
export interface MaterializeWarning {
  opId: OpId;
  kind: 'apply_failed' | 'apply_warning';
  message: string;
  detail?: ApplyWarning;
}

export interface MaterializeResult {
  graph: DesignGraph;
  warnings: MaterializeWarning[];
  violations: InvariantViolation[];
}

export interface MaterializeOpts extends InvariantOpts {
  /** Start from a snapshot instead of the empty graph. */
  from?: DesignGraph;
  /** Invariant validation mode. Default "final". */
  validate?: 'per-op' | 'final' | 'off';
}

export function materialize(
  ops: readonly OpEnvelope[],
  opts: MaterializeOpts = {},
): MaterializeResult {
  const graph = opts.from ? cloneGraph(opts.from) : emptyGraph();
  const warnings: MaterializeWarning[] = [];
  const violations: InvariantViolation[] = [];
  const validate = opts.validate ?? 'final';

  const ordered = [...ops].sort(compareEnvelopes);
  for (const env of ordered) {
    const res = applyOp(graph, env.op);
    if (!res.ok) {
      warnings.push({ opId: opId(env), kind: 'apply_failed', message: res.error });
      continue;
    }
    for (const w of res.warnings) {
      warnings.push({ opId: opId(env), kind: 'apply_warning', message: w.message, detail: w });
    }
    if (validate === 'per-op') {
      violations.push(...validateGraph(graph, opts));
    }
  }

  if (validate === 'final') {
    violations.push(...validateGraph(graph, opts));
  }

  return { graph, warnings, violations };
}
