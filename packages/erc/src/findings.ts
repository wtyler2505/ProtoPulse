import type { OpBody, PortRef, Uuid } from '@protopulse/graph';

/**
 * ERC findings — Vol II §C.1. Anchors point at real entities (click →
 * canvas jumps); fixes are executable ops, not prose.
 */
export type Severity = 'error' | 'warn' | 'info';

export type Anchor =
  | { kind: 'net'; netId: Uuid }
  | { kind: 'component'; componentId: Uuid }
  | { kind: 'port'; port: PortRef };

export interface Finding {
  severity: Severity;
  code: string;
  message: string;
  anchors: Anchor[];
  fix?: OpBody[];
}

export function compareFindings(a: Finding, b: Finding): number {
  const sevRank = { error: 0, warn: 1, info: 2 } as const;
  if (sevRank[a.severity] !== sevRank[b.severity]) return sevRank[a.severity] - sevRank[b.severity];
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  const aAnchor = JSON.stringify(a.anchors);
  const bAnchor = JSON.stringify(b.anchors);
  return aAnchor < bAnchor ? -1 : aAnchor > bAnchor ? 1 : 0;
}
