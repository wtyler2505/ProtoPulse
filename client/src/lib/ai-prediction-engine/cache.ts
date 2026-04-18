/**
 * localStorage persistence layer for dismissal and feedback records. All
 * functions are defensive against unavailable storage (SSR/Electron/private
 * browsing) and malformed data.
 */

import { STORAGE_KEY_DISMISSALS, STORAGE_KEY_FEEDBACK } from './constants';
import type { DismissRecord, FeedbackRecord } from './types';

export function saveDismissals(dismissals: DismissRecord[]): void {
  try {
    if (typeof window === 'undefined') { return; }
    localStorage.setItem(STORAGE_KEY_DISMISSALS, JSON.stringify(dismissals));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadDismissals(): DismissRecord[] {
  try {
    if (typeof window === 'undefined') { return []; }
    const raw = localStorage.getItem(STORAGE_KEY_DISMISSALS);
    if (!raw) { return []; }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) { return []; }
    return parsed.filter(
      (item: unknown): item is DismissRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as DismissRecord).ruleId === 'string' &&
        typeof (item as DismissRecord).dismissedAt === 'number',
    );
  } catch {
    return [];
  }
}

export function saveFeedback(feedback: FeedbackRecord[]): void {
  try {
    if (typeof window === 'undefined') { return; }
    localStorage.setItem(STORAGE_KEY_FEEDBACK, JSON.stringify(feedback));
  } catch {
    // localStorage may be unavailable
  }
}

export function loadFeedback(): FeedbackRecord[] {
  try {
    if (typeof window === 'undefined') { return []; }
    const raw = localStorage.getItem(STORAGE_KEY_FEEDBACK);
    if (!raw) { return []; }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) { return []; }
    return parsed.filter(
      (item: unknown): item is FeedbackRecord =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as FeedbackRecord).ruleId === 'string' &&
        typeof (item as FeedbackRecord).accepts === 'number' &&
        typeof (item as FeedbackRecord).dismisses === 'number',
    );
  } catch {
    return [];
  }
}
