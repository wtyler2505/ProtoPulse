/**
 * Confidence-scoring helpers. Pure functions: input-only, no I/O.
 */

import type { FeedbackRecord } from './types';

/**
 * Shift a rule's base confidence toward the user's historical preference.
 * If they always dismiss suggestions from this rule, lower it; if they
 * always accept, raise it. Adjustment is capped at ±0.1.
 */
export function adjustConfidence(
  feedback: FeedbackRecord[],
  ruleId: string,
  base: number,
): number {
  const record = feedback.find((f) => f.ruleId === ruleId);
  if (!record) { return base; }

  const total = record.accepts + record.dismisses;
  if (total === 0) { return base; }

  const acceptRate = record.accepts / total;
  const adjustment = (acceptRate - 0.5) * 0.2; // max +/-0.1 shift
  return Math.max(0.1, Math.min(1.0, base + adjustment));
}

/**
 * Increment the accept/dismiss counters for a rule's feedback record.
 * Creates the record if it doesn't already exist. Mutates the array
 * in place and returns it.
 */
export function trackFeedback(
  feedback: FeedbackRecord[],
  ruleId: string,
  action: 'accept' | 'dismiss',
): FeedbackRecord[] {
  let record = feedback.find((f) => f.ruleId === ruleId);
  if (!record) {
    record = { ruleId, accepts: 0, dismisses: 0 };
    feedback.push(record);
  }
  if (action === 'accept') {
    record.accepts++;
  } else {
    record.dismisses++;
  }
  return feedback;
}
