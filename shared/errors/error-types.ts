/**
 * Shared types and enums for the ProtoPulse error taxonomy.
 *
 * Contains ErrorSeverity, ErrorCatalogEntry, and ProtoPulseErrorOptions —
 * the foundational types that all domain catalogs and the error class depend on.
 */

import type { ErrorCode } from './error-codes';

// ---------------------------------------------------------------------------
// Error severity levels
// ---------------------------------------------------------------------------

export enum ErrorSeverity {
  /** Informational — operation succeeded with caveats. */
  INFO = 'info',
  /** Recoverable — client can retry or correct input. */
  WARNING = 'warning',
  /** Fatal — operation cannot proceed. */
  ERROR = 'error',
  /** Critical — system integrity may be at risk. */
  CRITICAL = 'critical',
}

// ---------------------------------------------------------------------------
// Error catalog entry — static metadata for each code
// ---------------------------------------------------------------------------

export interface ErrorCatalogEntry {
  /** Stable error code (e.g. PP-1001). */
  code: ErrorCode;
  /** Default HTTP status code to use in API responses. */
  httpStatus: number;
  /** Severity level. */
  severity: ErrorSeverity;
  /** Short human-readable label. */
  label: string;
  /** Longer description for docs / developer guidance. */
  description: string;
  /** Whether the client should retry (with backoff). */
  retryable: boolean;
}

// ---------------------------------------------------------------------------
// ProtoPulseError constructor options
// ---------------------------------------------------------------------------

export interface ProtoPulseErrorOptions {
  /** Human-readable detail message (overrides catalog default label). */
  detail?: string;
  /** Arbitrary context data (e.g. field names, IDs, limits). */
  context?: Record<string, unknown>;
  /** The original error that caused this one. */
  cause?: unknown;
}
