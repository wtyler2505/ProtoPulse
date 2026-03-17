/**
 * View Hints — re-export layer for BL-0313
 *
 * The per-view onboarding hint system is implemented in view-onboarding.ts.
 * This module provides the BL-0313 specified types and hook aliases so that
 * consumers can import from either location.
 */

export {
  ViewOnboardingManager as ViewHintManager,
  MAX_HINT_VISITS,
  VIEW_HINTS,
  useViewOnboarding as useViewHints,
} from './view-onboarding';

export type {
  ViewHintContent as ViewHint,
  OnboardingState,
  UseViewOnboardingResult as UseViewHintsResult,
} from './view-onboarding';
