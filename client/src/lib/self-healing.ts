/**
 * Self-Healing Assistant — compatibility re-export.
 *
 * The implementation was split into ./self-healing/* modules. This thin
 * file preserves the legacy import path used by existing tests/consumers.
 * Prefer importing from `./self-healing/` directly in new code.
 */

export * from './self-healing/index';
