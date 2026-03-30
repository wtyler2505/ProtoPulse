/**
 * ProtoPulse Error Taxonomy — stable error codes for the entire application.
 *
 * Error code format: PP-XYYY
 *   PP   = ProtoPulse prefix
 *   X    = domain digit (1-9)
 *   YYY  = sequential within domain (001-999)
 *
 * Domains:
 *   1xxx = Authentication & Authorization
 *   2xxx = Validation & Input
 *   3xxx = Export & Generation
 *   4xxx = Import & Parsing
 *   5xxx = Circuit & Simulation
 *   6xxx = AI & Agent
 *   7xxx = Storage & Database
 *   8xxx = Project & Collaboration
 *   9xxx = System & Infrastructure
 *
 * Usage:
 *   import { ErrorCode, ProtoPulseError, errorCatalog } from '@shared/error-taxonomy';
 *   throw new ProtoPulseError(ErrorCode.AUTH_SESSION_EXPIRED, { detail: 'Session timed out after 30m' });
 *
 * BL-0262
 *
 * This is a thin facade — all implementation lives in shared/errors/.
 */

// Re-export everything from the decomposed modules
export { ErrorCode } from './errors/error-codes';
export { ErrorSeverity } from './errors/error-types';
export type { ErrorCatalogEntry, ProtoPulseErrorOptions } from './errors/error-types';
export { errorCatalog } from './errors/catalog';
export { ProtoPulseError } from './errors/error-class';
export {
  lookupErrorCode,
  isValidErrorCode,
  getErrorCodesByDomain,
  pgCodeToErrorCode,
} from './errors/utilities';
