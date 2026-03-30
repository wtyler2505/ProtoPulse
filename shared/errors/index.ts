/**
 * shared/errors barrel — re-exports all error taxonomy exports.
 *
 * Import from here (or from the facade at shared/error-taxonomy.ts).
 */

// Types & enums
export { ErrorCode } from './error-codes';
export { ErrorSeverity } from './error-types';
export type { ErrorCatalogEntry, ProtoPulseErrorOptions } from './error-types';

// Assembled catalog
export { errorCatalog } from './catalog';

// Error class
export { ProtoPulseError } from './error-class';

// Utilities
export {
  lookupErrorCode,
  isValidErrorCode,
  getErrorCodesByDomain,
  pgCodeToErrorCode,
} from './utilities';

// Domain catalogs (for consumers that need individual pieces)
export { authCatalog } from './catalog-auth';
export { validationCatalog } from './catalog-validation';
export { exportCatalog } from './catalog-export';
export { importCatalog } from './catalog-import';
export { circuitCatalog } from './catalog-circuit';
export { aiCatalog } from './catalog-ai';
export { storageCatalog } from './catalog-storage';
export { projectCatalog } from './catalog-project';
export { systemCatalog } from './catalog-system';
