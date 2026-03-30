/**
 * 7xxx — Storage & Database error catalog entries.
 */

import { ErrorCode } from './error-codes';
import { ErrorSeverity } from './error-types';
import type { ErrorCatalogEntry } from './error-types';

export const storageCatalog: Partial<Record<ErrorCode, ErrorCatalogEntry>> = {
  [ErrorCode.STORAGE_ERROR]: {
    code: ErrorCode.STORAGE_ERROR,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Storage error',
    description: 'An unclassified storage/database operation failed.',
    retryable: true,
  },
  [ErrorCode.STORAGE_NOT_FOUND]: {
    code: ErrorCode.STORAGE_NOT_FOUND,
    httpStatus: 404,
    severity: ErrorSeverity.ERROR,
    label: 'Resource not found',
    description: 'The requested database resource does not exist.',
    retryable: false,
  },
  [ErrorCode.STORAGE_DUPLICATE]: {
    code: ErrorCode.STORAGE_DUPLICATE,
    httpStatus: 409,
    severity: ErrorSeverity.ERROR,
    label: 'Duplicate entry',
    description: 'A unique constraint was violated (duplicate key).',
    retryable: false,
  },
  [ErrorCode.STORAGE_FK_VIOLATION]: {
    code: ErrorCode.STORAGE_FK_VIOLATION,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Foreign key violation',
    description: 'A foreign key constraint was violated (referenced entity does not exist).',
    retryable: false,
  },
  [ErrorCode.STORAGE_NOT_NULL_VIOLATION]: {
    code: ErrorCode.STORAGE_NOT_NULL_VIOLATION,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Not-null violation',
    description: 'A required (non-nullable) column received a null value.',
    retryable: false,
  },
  [ErrorCode.STORAGE_CHECK_VIOLATION]: {
    code: ErrorCode.STORAGE_CHECK_VIOLATION,
    httpStatus: 400,
    severity: ErrorSeverity.ERROR,
    label: 'Check constraint violation',
    description: 'A database CHECK constraint was violated.',
    retryable: false,
  },
  [ErrorCode.STORAGE_VERSION_CONFLICT]: {
    code: ErrorCode.STORAGE_VERSION_CONFLICT,
    httpStatus: 409,
    severity: ErrorSeverity.WARNING,
    label: 'Version conflict',
    description: 'Optimistic concurrency check failed — the resource was modified by another request.',
    retryable: true,
  },
  [ErrorCode.STORAGE_QUERY_TIMEOUT]: {
    code: ErrorCode.STORAGE_QUERY_TIMEOUT,
    httpStatus: 408,
    severity: ErrorSeverity.ERROR,
    label: 'Query timeout',
    description: 'A database query exceeded the timeout limit.',
    retryable: true,
  },
  [ErrorCode.STORAGE_CONNECTION_FAILED]: {
    code: ErrorCode.STORAGE_CONNECTION_FAILED,
    httpStatus: 503,
    severity: ErrorSeverity.CRITICAL,
    label: 'Database connection failed',
    description: 'Could not establish or maintain a connection to the database.',
    retryable: true,
  },
  [ErrorCode.STORAGE_SERVER_SHUTDOWN]: {
    code: ErrorCode.STORAGE_SERVER_SHUTDOWN,
    httpStatus: 503,
    severity: ErrorSeverity.CRITICAL,
    label: 'Database server shutdown',
    description: 'The database server is shutting down.',
    retryable: true,
  },
  [ErrorCode.STORAGE_TRANSACTION_ABORTED]: {
    code: ErrorCode.STORAGE_TRANSACTION_ABORTED,
    httpStatus: 500,
    severity: ErrorSeverity.ERROR,
    label: 'Transaction aborted',
    description: 'A database transaction was rolled back.',
    retryable: true,
  },
  [ErrorCode.STORAGE_CACHE_MISS]: {
    code: ErrorCode.STORAGE_CACHE_MISS,
    httpStatus: 200,
    severity: ErrorSeverity.INFO,
    label: 'Cache miss',
    description: 'Requested data was not in the LRU cache (informational).',
    retryable: false,
  },
};
