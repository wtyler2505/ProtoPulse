/**
 * Utility functions for working with ProtoPulse error codes.
 */

import { ErrorCode } from './error-codes';
import type { ErrorCatalogEntry } from './error-types';
import { errorCatalog } from './catalog';

/**
 * Retrieve the catalog entry for a given error code string.
 * Returns `undefined` if the code is not in the taxonomy.
 */
export function lookupErrorCode(code: string): ErrorCatalogEntry | undefined {
  return errorCatalog[code as ErrorCode];
}

/**
 * Check whether a string is a valid ProtoPulse error code.
 */
export function isValidErrorCode(code: string): code is ErrorCode {
  return code in errorCatalog;
}

/**
 * Get all error codes for a given domain (e.g. '1' for auth, '5' for circuit).
 */
export function getErrorCodesByDomain(domainDigit: string): ErrorCatalogEntry[] {
  const prefix = `PP-${domainDigit}`;
  return Object.values(errorCatalog).filter((entry) => entry.code.startsWith(prefix));
}

/**
 * Map a PostgreSQL error code to the corresponding ProtoPulse storage error code.
 */
export function pgCodeToErrorCode(pgCode: string | undefined): ErrorCode {
  if (!pgCode) { return ErrorCode.STORAGE_ERROR; }
  switch (pgCode) {
    case '23505': return ErrorCode.STORAGE_DUPLICATE;
    case '23503': return ErrorCode.STORAGE_FK_VIOLATION;
    case '23502': return ErrorCode.STORAGE_NOT_NULL_VIOLATION;
    case '23514': return ErrorCode.STORAGE_CHECK_VIOLATION;
    case '57014': return ErrorCode.STORAGE_QUERY_TIMEOUT;
    case '08006':
    case '08001':
    case '08004':
      return ErrorCode.STORAGE_CONNECTION_FAILED;
    case '57P01':
      return ErrorCode.STORAGE_SERVER_SHUTDOWN;
    case '40001':
    case '40P01':
      return ErrorCode.STORAGE_TRANSACTION_ABORTED;
    default: return ErrorCode.STORAGE_ERROR;
  }
}
