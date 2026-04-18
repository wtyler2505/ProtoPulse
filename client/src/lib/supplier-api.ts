/**
 * Supplier API — compatibility re-export.
 *
 * The implementation was split into ./supplier-api/* modules. This thin
 * file preserves the legacy import path `@/lib/supplier-api` used by
 * existing consumers. Prefer importing from `./supplier-api/` directly
 * in new code.
 */

export * from './supplier-api/index';
