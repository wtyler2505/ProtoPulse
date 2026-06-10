/**
 * @protopulse/review — the Design Review deck (Vol II §G.4). Wraps the
 * full ERC run plus design-level checks into a versioned, diffable
 * report; findings anchor to real entities and carry executable fixes.
 */
export { runReview, type ReviewOptions } from './run.js';
export { diffReports, type ReviewDiff } from './diff.js';
export { compareReviewFindings, DECK_REV, type ReviewFinding, type ReviewReport } from './report.js';
export { conceptForReview, REV_CODES } from './codes.js';
