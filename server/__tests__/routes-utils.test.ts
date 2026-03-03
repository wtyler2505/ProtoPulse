import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Mock heavy dependencies so routes.ts can be imported without a database
// ---------------------------------------------------------------------------

vi.mock('../db', () => ({
  db: {},
  pool: {},
  checkConnection: vi.fn(),
}));

vi.mock('../storage', () => ({
  storage: {},
}));

vi.mock('../ai', () => ({
  processAIMessage: vi.fn(),
  streamAIMessage: vi.fn(),
}));

vi.mock('../auth', () => ({
  createUser: vi.fn(),
  getUserByUsername: vi.fn(),
  verifyPassword: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getUserById: vi.fn(),
  validateSession: vi.fn(),
  storeApiKey: vi.fn(),
  getApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  listApiKeyProviders: vi.fn(),
}));

vi.mock('../component-export', () => ({
  exportToFzpz: vi.fn(),
  importFromFzpz: vi.fn(),
}));

vi.mock('../svg-parser', () => ({
  parseSvgToShapes: vi.fn(),
}));

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { HttpError, parseIdParam, payloadLimit } from '../routes';

// ---------------------------------------------------------------------------
// Helpers for payloadLimit middleware tests
// ---------------------------------------------------------------------------

function mockReq(contentLength?: number) {
  return {
    headers: contentLength !== undefined
      ? { 'content-length': String(contentLength) }
      : {},
  } as unknown as Request;
}

function mockRes() {
  const res = {
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res as unknown as Response;
}

// ---------------------------------------------------------------------------
// HttpError
// ---------------------------------------------------------------------------

describe('HttpError', () => {
  it('sets message and status correctly', () => {
    const err = new HttpError('Not found', 404);
    expect(err.message).toBe('Not found');
    expect(err.status).toBe(404);
  });

  it('has name property set to "HttpError"', () => {
    const err = new HttpError('Bad request', 400);
    expect(err.name).toBe('HttpError');
  });

  it('is an instance of Error', () => {
    const err = new HttpError('Server error', 500);
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// parseIdParam
// ---------------------------------------------------------------------------

describe('parseIdParam', () => {
  it('returns a number for valid numeric string "5"', () => {
    expect(parseIdParam('5')).toBe(5);
  });

  it('returns a number for valid numeric string "123"', () => {
    expect(parseIdParam('123')).toBe(123);
  });

  it('throws HttpError with status 400 for non-numeric string "abc"', () => {
    expect(() => parseIdParam('abc')).toThrowError(HttpError);
    try {
      parseIdParam('abc');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(400);
    }
  });

  it('throws HttpError with status 400 for undefined', () => {
    expect(() => parseIdParam(undefined)).toThrowError(HttpError);
    try {
      parseIdParam(undefined);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(400);
    }
  });

  it('throws HttpError with status 400 for NaN', () => {
    expect(() => parseIdParam(NaN)).toThrowError(HttpError);
    try {
      parseIdParam(NaN);
    } catch (e) {
      expect(e).toBeInstanceOf(HttpError);
      expect((e as HttpError).status).toBe(400);
    }
  });
});

// ---------------------------------------------------------------------------
// payloadLimit
// ---------------------------------------------------------------------------

describe('payloadLimit', () => {
  const limit1KB = payloadLimit(1024);

  it('calls next() when content-length is under the limit', () => {
    const req = mockReq(512);
    const res = mockRes();
    const next = vi.fn();

    limit1KB(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 413 when content-length exceeds the limit', () => {
    const req = mockReq(2048);
    const res = mockRes();
    const next = vi.fn();

    limit1KB(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Payload too large. Maximum size is 1KB',
    });
  });

  it('treats missing content-length header as 0 and calls next()', () => {
    const req = mockReq();
    const res = mockRes();
    const next = vi.fn();

    limit1KB(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
