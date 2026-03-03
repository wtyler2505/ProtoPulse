import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export class HttpError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = 'HttpError';
  }
}

export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void | Response>) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function parseIdParam(param: unknown): number {
  const id = Number(param);
  if (!Number.isFinite(id)) {
    throw new HttpError('Invalid id', 400);
  }
  return id;
}

export function payloadLimit(maxBytes: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > maxBytes) {
      return res.status(413).json({ message: `Payload too large. Maximum size is ${Math.round(maxBytes / 1024)}KB` });
    }
    next();
  };
}

// Note: circuit-routes.ts defines its own circuitPaginationSchema with max(500)
// for larger result sets (circuit designs can have hundreds of instances/wires).
export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  sort: z.enum(['asc', 'desc']).default('desc'),
});
