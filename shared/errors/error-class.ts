/**
 * ProtoPulseError — structured error class that carries a stable code.
 */

import type { ErrorCode } from './error-codes';
import type { ErrorSeverity, ProtoPulseErrorOptions } from './error-types';
import { errorCatalog } from './catalog';

export class ProtoPulseError extends Error {
  /** Stable error code from the ErrorCode enum. */
  readonly code: ErrorCode;
  /** HTTP status to use in API responses. */
  readonly httpStatus: number;
  /** Error severity level. */
  readonly severity: ErrorSeverity;
  /** Short label from the catalog. */
  readonly label: string;
  /** Whether the operation is safe to retry. */
  readonly retryable: boolean;
  /** Arbitrary structured context data. */
  readonly context: Record<string, unknown>;

  constructor(code: ErrorCode, options: ProtoPulseErrorOptions = {}) {
    const entry = errorCatalog[code];
    const message = options.detail ?? entry.label;
    super(message);
    this.name = 'ProtoPulseError';
    this.code = code;
    this.httpStatus = entry.httpStatus;
    this.severity = entry.severity;
    this.label = entry.label;
    this.retryable = entry.retryable;
    this.context = options.context ?? {};

    if (options.cause instanceof Error) {
      this.stack = options.cause.stack;
    }
  }

  /**
   * Serialize to a JSON-safe API response payload.
   * Suitable for `res.status(err.httpStatus).json(err.toJSON())`.
   */
  toJSON(): {
    error: {
      code: string;
      label: string;
      message: string;
      retryable: boolean;
      context: Record<string, unknown>;
    };
  } {
    return {
      error: {
        code: this.code,
        label: this.label,
        message: this.message,
        retryable: this.retryable,
        context: this.context,
      },
    };
  }
}
