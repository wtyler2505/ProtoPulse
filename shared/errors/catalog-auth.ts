/**
 * 1xxx — Authentication & Authorization error catalog entries.
 */

import { ErrorCode } from './error-codes';
import { ErrorSeverity } from './error-types';
import type { ErrorCatalogEntry } from './error-types';

export const authCatalog: Partial<Record<ErrorCode, ErrorCatalogEntry>> = {
  [ErrorCode.AUTH_REQUIRED]: {
    code: ErrorCode.AUTH_REQUIRED,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'Authentication required',
    description: 'Request is missing the X-Session-Id header or other credentials.',
    retryable: false,
  },
  [ErrorCode.AUTH_SESSION_INVALID]: {
    code: ErrorCode.AUTH_SESSION_INVALID,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid session',
    description: 'The provided session ID is syntactically malformed.',
    retryable: false,
  },
  [ErrorCode.AUTH_SESSION_EXPIRED]: {
    code: ErrorCode.AUTH_SESSION_EXPIRED,
    httpStatus: 401,
    severity: ErrorSeverity.WARNING,
    label: 'Session expired',
    description: 'The session has expired or been revoked. Re-authenticate to continue.',
    retryable: false,
  },
  [ErrorCode.AUTH_FORBIDDEN]: {
    code: ErrorCode.AUTH_FORBIDDEN,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Forbidden',
    description: 'Authenticated but insufficient permissions for this resource.',
    retryable: false,
  },
  [ErrorCode.AUTH_API_KEY_MISSING]: {
    code: ErrorCode.AUTH_API_KEY_MISSING,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'API key missing',
    description: 'An API key is required but was not provided.',
    retryable: false,
  },
  [ErrorCode.AUTH_API_KEY_INVALID]: {
    code: ErrorCode.AUTH_API_KEY_INVALID,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'API key invalid',
    description: 'The API key could not be decrypted or verified.',
    retryable: false,
  },
  [ErrorCode.AUTH_ADMIN_REQUIRED]: {
    code: ErrorCode.AUTH_ADMIN_REQUIRED,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Admin access required',
    description: 'This operation requires administrator credentials.',
    retryable: false,
  },
  [ErrorCode.AUTH_PROJECT_OWNERSHIP]: {
    code: ErrorCode.AUTH_PROJECT_OWNERSHIP,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Not project owner',
    description: 'You do not own this project and cannot perform this operation.',
    retryable: false,
  },
  [ErrorCode.AUTH_ROLE_INSUFFICIENT]: {
    code: ErrorCode.AUTH_ROLE_INSUFFICIENT,
    httpStatus: 403,
    severity: ErrorSeverity.ERROR,
    label: 'Insufficient collaboration role',
    description: 'Your collaboration role (e.g. viewer) does not allow this action.',
    retryable: false,
  },
  [ErrorCode.AUTH_CREDENTIALS_INVALID]: {
    code: ErrorCode.AUTH_CREDENTIALS_INVALID,
    httpStatus: 401,
    severity: ErrorSeverity.ERROR,
    label: 'Invalid credentials',
    description: 'Username or password is incorrect.',
    retryable: false,
  },
  [ErrorCode.AUTH_RATE_LIMITED]: {
    code: ErrorCode.AUTH_RATE_LIMITED,
    httpStatus: 429,
    severity: ErrorSeverity.WARNING,
    label: 'Auth rate limited',
    description: 'Too many authentication attempts. Wait before retrying.',
    retryable: true,
  },
};
