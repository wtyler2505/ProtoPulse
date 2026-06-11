export type TensionConsequenceSpeed = 'session' | 'multi-session' | 'slow';

export interface TensionConflict {
  id: string;
  title: string;
  details?: string;
  sourceType: 'branch_merge' | 'sync_conflict' | 'pin_verification' | 'other';
  severity: 'error' | 'warning';
}

export interface TriageQueueItem {
  conflict: TensionConflict;
  consequenceSpeed: TensionConsequenceSpeed;
  score: number;
}

const SOURCE_SPEED: Record<TensionConflict['sourceType'], TensionConsequenceSpeed> = {
  branch_merge: 'session',
  sync_conflict: 'multi-session',
  pin_verification: 'session',
  other: 'slow',
};

const SPEED_SCORE: Record<TensionConsequenceSpeed, number> = {
  session: 100,
  'multi-session': 60,
  slow: 30,
};

const SEVERITY_SCORE: Record<TensionConflict['severity'], number> = {
  error: 20,
  warning: 0,
};

export function rankTensions(conflicts: TensionConflict[]): TriageQueueItem[] {
  const queue = conflicts.map((conflict) => {
    const consequenceSpeed = SOURCE_SPEED[conflict.sourceType];
    const score = SPEED_SCORE[consequenceSpeed] + SEVERITY_SCORE[conflict.severity];
    return { conflict, consequenceSpeed, score };
  });
  queue.sort((a, b) => b.score - a.score);
  return queue;
}

export function getTopTension(conflicts: TensionConflict[]): TriageQueueItem | null {
  const ranked = rankTensions(conflicts);
  return ranked[0] ?? null;
}

