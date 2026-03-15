import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  ErrorSeverity,
  ProtoPulseError,
  errorCatalog,
  lookupErrorCode,
  isValidErrorCode,
  getErrorCodesByDomain,
  pgCodeToErrorCode,
} from '../error-taxonomy';
import type { ErrorCatalogEntry } from '../error-taxonomy';

// ---------------------------------------------------------------------------
// ErrorCode enum coverage
// ---------------------------------------------------------------------------

describe('ErrorCode enum', () => {
  it('has codes for all 9 domains', () => {
    const domains = new Set<string>();
    for (const code of Object.values(ErrorCode)) {
      // PP-XYYY → extract X
      const match = /^PP-(\d)/.exec(code);
      expect(match).not.toBeNull();
      domains.add(match![1]);
    }
    // Domains 1-9
    expect(domains).toContain('1'); // auth
    expect(domains).toContain('2'); // validation
    expect(domains).toContain('3'); // export
    expect(domains).toContain('4'); // import
    expect(domains).toContain('5'); // circuit/simulation
    expect(domains).toContain('6'); // AI
    expect(domains).toContain('7'); // storage
    expect(domains).toContain('8'); // project/collab
    expect(domains).toContain('9'); // system
  });

  it('has at least 50 error codes', () => {
    const codes = Object.values(ErrorCode);
    expect(codes.length).toBeGreaterThanOrEqual(50);
  });

  it('has no duplicate code values', () => {
    const values = Object.values(ErrorCode);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('all codes follow PP-XYYY format', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(code).toMatch(/^PP-\d{4}$/);
    }
  });

  it('enum keys are UPPER_SNAKE_CASE', () => {
    for (const key of Object.keys(ErrorCode)) {
      // Skip numeric reverse-mapping keys (TypeScript string enums don't have them, but guard anyway)
      if (/^\d/.test(key)) { continue; }
      expect(key).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// ErrorSeverity enum
// ---------------------------------------------------------------------------

describe('ErrorSeverity enum', () => {
  it('has exactly 4 levels', () => {
    const values = Object.values(ErrorSeverity);
    expect(values).toHaveLength(4);
    expect(values).toContain('info');
    expect(values).toContain('warning');
    expect(values).toContain('error');
    expect(values).toContain('critical');
  });
});

// ---------------------------------------------------------------------------
// Error catalog completeness & consistency
// ---------------------------------------------------------------------------

describe('errorCatalog', () => {
  const allCodes = Object.values(ErrorCode);

  it('has an entry for every ErrorCode', () => {
    for (const code of allCodes) {
      expect(errorCatalog[code]).toBeDefined();
      expect(errorCatalog[code].code).toBe(code);
    }
  });

  it('every entry has valid httpStatus (100-599)', () => {
    for (const entry of Object.values(errorCatalog)) {
      expect(entry.httpStatus).toBeGreaterThanOrEqual(100);
      expect(entry.httpStatus).toBeLessThan(600);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const entry of Object.values(errorCatalog)) {
      expect(entry.label.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty description', () => {
    for (const entry of Object.values(errorCatalog)) {
      expect(entry.description.length).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid severity', () => {
    const validSeverities = new Set(Object.values(ErrorSeverity));
    for (const entry of Object.values(errorCatalog)) {
      expect(validSeverities.has(entry.severity)).toBe(true);
    }
  });

  it('every entry has a boolean retryable flag', () => {
    for (const entry of Object.values(errorCatalog)) {
      expect(typeof entry.retryable).toBe('boolean');
    }
  });

  it('auth errors (1xxx) use 401 or 403 or 429 status', () => {
    const authEntries = Object.values(errorCatalog).filter((e) => e.code.startsWith('PP-1'));
    for (const entry of authEntries) {
      expect([401, 403, 429]).toContain(entry.httpStatus);
    }
  });

  it('validation errors (2xxx) use 4xx status', () => {
    const entries = Object.values(errorCatalog).filter((e) => e.code.startsWith('PP-2'));
    for (const entry of entries) {
      expect(entry.httpStatus).toBeGreaterThanOrEqual(400);
      expect(entry.httpStatus).toBeLessThan(500);
    }
  });

  it('not-found codes use 404 status', () => {
    const notFoundCodes = allCodes.filter((c) => {
      const key = Object.entries(ErrorCode).find(([, v]) => v === c)?.[0] ?? '';
      return key.endsWith('_NOT_FOUND');
    });
    for (const code of notFoundCodes) {
      expect(errorCatalog[code].httpStatus).toBe(404);
    }
  });

  it('rate limited codes use 429 status', () => {
    const rateLimitCodes = allCodes.filter((c) => {
      const key = Object.entries(ErrorCode).find(([, v]) => v === c)?.[0] ?? '';
      return key.includes('RATE_LIMITED');
    });
    expect(rateLimitCodes.length).toBeGreaterThan(0);
    for (const code of rateLimitCodes) {
      expect(errorCatalog[code].httpStatus).toBe(429);
      expect(errorCatalog[code].retryable).toBe(true);
    }
  });

  it('circuit breaker / unavailable codes are retryable', () => {
    expect(errorCatalog[ErrorCode.AI_CIRCUIT_BREAKER_OPEN].retryable).toBe(true);
    expect(errorCatalog[ErrorCode.SYSTEM_UNAVAILABLE].retryable).toBe(true);
    expect(errorCatalog[ErrorCode.STORAGE_CONNECTION_FAILED].retryable).toBe(true);
  });

  it('import errors are not retryable (bad input)', () => {
    const importEntries = Object.values(errorCatalog).filter((e) => e.code.startsWith('PP-4'));
    for (const entry of importEntries) {
      expect(entry.retryable).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Domain-specific catalog checks
// ---------------------------------------------------------------------------

describe('domain-specific catalog entries', () => {
  it('auth domain has >=10 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-1'));
    expect(codes.length).toBeGreaterThanOrEqual(10);
  });

  it('validation domain has >=15 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-2'));
    expect(codes.length).toBeGreaterThanOrEqual(15);
  });

  it('export domain has >=15 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-3'));
    expect(codes.length).toBeGreaterThanOrEqual(15);
  });

  it('import domain has >=10 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-4'));
    expect(codes.length).toBeGreaterThanOrEqual(10);
  });

  it('circuit/simulation domain has >=15 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-5'));
    expect(codes.length).toBeGreaterThanOrEqual(15);
  });

  it('AI domain has >=10 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-6'));
    expect(codes.length).toBeGreaterThanOrEqual(10);
  });

  it('storage domain has >=10 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-7'));
    expect(codes.length).toBeGreaterThanOrEqual(10);
  });

  it('project/collab domain has >=10 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-8'));
    expect(codes.length).toBeGreaterThanOrEqual(10);
  });

  it('system domain has >=10 codes', () => {
    const codes = Object.values(ErrorCode).filter((c) => c.startsWith('PP-9'));
    expect(codes.length).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// ProtoPulseError class
// ---------------------------------------------------------------------------

describe('ProtoPulseError', () => {
  it('extends Error', () => {
    const err = new ProtoPulseError(ErrorCode.AUTH_REQUIRED);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ProtoPulseError);
  });

  it('has name "ProtoPulseError"', () => {
    const err = new ProtoPulseError(ErrorCode.VALIDATION_FAILED);
    expect(err.name).toBe('ProtoPulseError');
  });

  it('carries the error code', () => {
    const err = new ProtoPulseError(ErrorCode.STORAGE_DUPLICATE);
    expect(err.code).toBe('PP-7003');
  });

  it('uses catalog httpStatus', () => {
    const err = new ProtoPulseError(ErrorCode.AUTH_REQUIRED);
    expect(err.httpStatus).toBe(401);
  });

  it('uses catalog severity', () => {
    const err = new ProtoPulseError(ErrorCode.SYSTEM_UNAVAILABLE);
    expect(err.severity).toBe(ErrorSeverity.CRITICAL);
  });

  it('uses catalog label as default message', () => {
    const err = new ProtoPulseError(ErrorCode.PROJECT_NOT_FOUND);
    expect(err.message).toBe('Project not found');
    expect(err.label).toBe('Project not found');
  });

  it('uses detail option as message when provided', () => {
    const err = new ProtoPulseError(ErrorCode.AUTH_SESSION_EXPIRED, {
      detail: 'Session timed out after 30 minutes of inactivity',
    });
    expect(err.message).toBe('Session timed out after 30 minutes of inactivity');
    expect(err.label).toBe('Session expired'); // label stays from catalog
  });

  it('carries context data', () => {
    const err = new ProtoPulseError(ErrorCode.VALIDATION_FIELD_RANGE, {
      context: { field: 'quantity', min: 1, max: 10000, actual: -5 },
    });
    expect(err.context).toEqual({ field: 'quantity', min: 1, max: 10000, actual: -5 });
  });

  it('defaults context to empty object', () => {
    const err = new ProtoPulseError(ErrorCode.SYSTEM_INTERNAL);
    expect(err.context).toEqual({});
  });

  it('preserves cause stack trace', () => {
    const original = new Error('pg connection refused');
    const err = new ProtoPulseError(ErrorCode.STORAGE_CONNECTION_FAILED, {
      cause: original,
    });
    expect(err.stack).toBe(original.stack);
  });

  it('carries retryable flag from catalog', () => {
    expect(new ProtoPulseError(ErrorCode.AI_PROVIDER_ERROR).retryable).toBe(true);
    expect(new ProtoPulseError(ErrorCode.AUTH_REQUIRED).retryable).toBe(false);
  });

  describe('toJSON()', () => {
    it('returns a structured error envelope', () => {
      const err = new ProtoPulseError(ErrorCode.VALIDATION_SCHEMA, {
        detail: 'Invalid BOM item: quantity must be positive',
        context: { field: 'quantity', value: -1 },
      });
      const json = err.toJSON();
      expect(json).toEqual({
        error: {
          code: 'PP-2009',
          label: 'Schema validation error',
          message: 'Invalid BOM item: quantity must be positive',
          retryable: false,
          context: { field: 'quantity', value: -1 },
        },
      });
    });

    it('uses label as message when no detail provided', () => {
      const err = new ProtoPulseError(ErrorCode.EXPORT_GERBER);
      const json = err.toJSON();
      expect(json.error.message).toBe('Gerber export error');
    });

    it('is JSON-serializable', () => {
      const err = new ProtoPulseError(ErrorCode.CIRCUIT_NOT_FOUND, {
        context: { designId: 42 },
      });
      const serialized = JSON.stringify(err.toJSON());
      const parsed = JSON.parse(serialized) as ReturnType<ProtoPulseError['toJSON']>;
      expect(parsed.error.code).toBe('PP-5002');
      expect(parsed.error.context).toEqual({ designId: 42 });
    });
  });
});

// ---------------------------------------------------------------------------
// lookupErrorCode()
// ---------------------------------------------------------------------------

describe('lookupErrorCode()', () => {
  it('returns catalog entry for valid code', () => {
    const entry = lookupErrorCode('PP-1001');
    expect(entry).toBeDefined();
    expect(entry!.code).toBe(ErrorCode.AUTH_REQUIRED);
    expect(entry!.label).toBe('Authentication required');
  });

  it('returns undefined for unknown code', () => {
    expect(lookupErrorCode('PP-0000')).toBeUndefined();
    expect(lookupErrorCode('XX-1234')).toBeUndefined();
    expect(lookupErrorCode('')).toBeUndefined();
  });

  it('returns undefined for partial code', () => {
    expect(lookupErrorCode('PP-1')).toBeUndefined();
    expect(lookupErrorCode('PP-100')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// isValidErrorCode()
// ---------------------------------------------------------------------------

describe('isValidErrorCode()', () => {
  it('returns true for all ErrorCode values', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(isValidErrorCode(code)).toBe(true);
    }
  });

  it('returns false for invalid codes', () => {
    expect(isValidErrorCode('PP-0000')).toBe(false);
    expect(isValidErrorCode('INVALID')).toBe(false);
    expect(isValidErrorCode('')).toBe(false);
    expect(isValidErrorCode('PP-99999')).toBe(false);
  });

  it('narrows type when true', () => {
    const code = 'PP-1001';
    if (isValidErrorCode(code)) {
      // TypeScript should allow using code as ErrorCode here
      const entry: ErrorCatalogEntry = errorCatalog[code];
      expect(entry).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// getErrorCodesByDomain()
// ---------------------------------------------------------------------------

describe('getErrorCodesByDomain()', () => {
  it('returns auth codes for domain 1', () => {
    const entries = getErrorCodesByDomain('1');
    expect(entries.length).toBeGreaterThanOrEqual(10);
    for (const entry of entries) {
      expect(entry.code).toMatch(/^PP-1\d{3}$/);
    }
  });

  it('returns validation codes for domain 2', () => {
    const entries = getErrorCodesByDomain('2');
    expect(entries.length).toBeGreaterThanOrEqual(15);
    for (const entry of entries) {
      expect(entry.code).toMatch(/^PP-2\d{3}$/);
    }
  });

  it('returns export codes for domain 3', () => {
    const entries = getErrorCodesByDomain('3');
    expect(entries.length).toBeGreaterThanOrEqual(15);
  });

  it('returns empty array for unused domain', () => {
    const entries = getErrorCodesByDomain('0');
    expect(entries).toHaveLength(0);
  });

  it('returns entries with full catalog data', () => {
    const entries = getErrorCodesByDomain('9');
    for (const entry of entries) {
      expect(entry.httpStatus).toBeDefined();
      expect(entry.severity).toBeDefined();
      expect(entry.label).toBeDefined();
      expect(entry.description).toBeDefined();
      expect(typeof entry.retryable).toBe('boolean');
    }
  });
});

// ---------------------------------------------------------------------------
// pgCodeToErrorCode()
// ---------------------------------------------------------------------------

describe('pgCodeToErrorCode()', () => {
  it('maps unique_violation (23505) to STORAGE_DUPLICATE', () => {
    expect(pgCodeToErrorCode('23505')).toBe(ErrorCode.STORAGE_DUPLICATE);
  });

  it('maps foreign_key_violation (23503) to STORAGE_FK_VIOLATION', () => {
    expect(pgCodeToErrorCode('23503')).toBe(ErrorCode.STORAGE_FK_VIOLATION);
  });

  it('maps not_null_violation (23502) to STORAGE_NOT_NULL_VIOLATION', () => {
    expect(pgCodeToErrorCode('23502')).toBe(ErrorCode.STORAGE_NOT_NULL_VIOLATION);
  });

  it('maps check_violation (23514) to STORAGE_CHECK_VIOLATION', () => {
    expect(pgCodeToErrorCode('23514')).toBe(ErrorCode.STORAGE_CHECK_VIOLATION);
  });

  it('maps query_canceled (57014) to STORAGE_QUERY_TIMEOUT', () => {
    expect(pgCodeToErrorCode('57014')).toBe(ErrorCode.STORAGE_QUERY_TIMEOUT);
  });

  it('maps connection errors to STORAGE_CONNECTION_FAILED', () => {
    expect(pgCodeToErrorCode('08006')).toBe(ErrorCode.STORAGE_CONNECTION_FAILED);
    expect(pgCodeToErrorCode('08001')).toBe(ErrorCode.STORAGE_CONNECTION_FAILED);
    expect(pgCodeToErrorCode('08004')).toBe(ErrorCode.STORAGE_CONNECTION_FAILED);
  });

  it('maps admin_shutdown (57P01) to STORAGE_SERVER_SHUTDOWN', () => {
    expect(pgCodeToErrorCode('57P01')).toBe(ErrorCode.STORAGE_SERVER_SHUTDOWN);
  });

  it('maps deadlock/serialization errors to STORAGE_TRANSACTION_ABORTED', () => {
    expect(pgCodeToErrorCode('40001')).toBe(ErrorCode.STORAGE_TRANSACTION_ABORTED);
    expect(pgCodeToErrorCode('40P01')).toBe(ErrorCode.STORAGE_TRANSACTION_ABORTED);
  });

  it('maps undefined to STORAGE_ERROR', () => {
    expect(pgCodeToErrorCode(undefined)).toBe(ErrorCode.STORAGE_ERROR);
  });

  it('maps unknown codes to STORAGE_ERROR', () => {
    expect(pgCodeToErrorCode('99999')).toBe(ErrorCode.STORAGE_ERROR);
    expect(pgCodeToErrorCode('00000')).toBe(ErrorCode.STORAGE_ERROR);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting invariants
// ---------------------------------------------------------------------------

describe('cross-cutting invariants', () => {
  it('catalog size matches ErrorCode enum size', () => {
    const enumKeys = Object.values(ErrorCode);
    const catalogKeys = Object.keys(errorCatalog);
    expect(catalogKeys.length).toBe(enumKeys.length);
  });

  it('every catalog entry code field matches its key', () => {
    for (const [key, entry] of Object.entries(errorCatalog)) {
      expect(entry.code).toBe(key);
    }
  });

  it('codes within each domain are sequential (no gaps in first 3 digits)', () => {
    for (let domain = 1; domain <= 9; domain++) {
      const prefix = `PP-${String(domain)}`;
      const codes = Object.values(ErrorCode)
        .filter((c) => c.startsWith(prefix))
        .map((c) => parseInt(c.slice(3), 10)) // extract YYY from PP-XYYY
        .sort((a, b) => a - b);

      if (codes.length === 0) { continue; }

      // First code should end in 001
      expect(codes[0] % 1000).toBe(1);

      // Codes should be sequential (no gaps)
      for (let i = 1; i < codes.length; i++) {
        expect(codes[i]).toBe(codes[i - 1] + 1);
      }
    }
  });

  it('ZIP bomb is marked CRITICAL severity', () => {
    expect(errorCatalog[ErrorCode.IMPORT_ZIP_BOMB].severity).toBe(ErrorSeverity.CRITICAL);
  });

  it('database connection/shutdown codes are CRITICAL severity', () => {
    expect(errorCatalog[ErrorCode.STORAGE_CONNECTION_FAILED].severity).toBe(ErrorSeverity.CRITICAL);
    expect(errorCatalog[ErrorCode.STORAGE_SERVER_SHUTDOWN].severity).toBe(ErrorSeverity.CRITICAL);
    expect(errorCatalog[ErrorCode.SYSTEM_UNAVAILABLE].severity).toBe(ErrorSeverity.CRITICAL);
    expect(errorCatalog[ErrorCode.SYSTEM_SHUTTING_DOWN].severity).toBe(ErrorSeverity.CRITICAL);
  });

  it('version conflict is 409 and retryable', () => {
    const entry = errorCatalog[ErrorCode.STORAGE_VERSION_CONFLICT];
    expect(entry.httpStatus).toBe(409);
    expect(entry.retryable).toBe(true);
  });

  it('WebGPU unavailable is INFO severity (graceful fallback)', () => {
    expect(errorCatalog[ErrorCode.SIMULATION_WEBGPU_UNAVAILABLE].severity).toBe(ErrorSeverity.INFO);
  });

  it('tool confirmation required is INFO severity (not an error)', () => {
    expect(errorCatalog[ErrorCode.AI_TOOL_CONFIRMATION_REQUIRED].severity).toBe(ErrorSeverity.INFO);
  });

  it('all export codes except DRC_GATE are retryable', () => {
    const exportEntries = Object.values(errorCatalog).filter(
      (e) => e.code.startsWith('PP-3') && e.code !== ErrorCode.EXPORT_DRC_GATE,
    );
    for (const entry of exportEntries) {
      expect(entry.retryable).toBe(true);
    }
  });
});
