/**
 * @protopulse/parts — the minimal M1 part model and seed library.
 * Tiers are earned, not assumed: parts are born unverified.
 */
export * from './types.js';
export { PartDb, seedPartDb } from './db.js';
export { SEED_PARTS } from './seed/index.js';
