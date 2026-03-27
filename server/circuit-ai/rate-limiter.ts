/**
 * Shared rate limiter for circuit-AI endpoints (5 req/min per IP, sliding window)
 */

import type { Request, Response, NextFunction } from 'express';

const CIRCUIT_AI_RATE_WINDOW_MS = 60_000;
const CIRCUIT_AI_RATE_MAX = 5;

interface RateBucket {
  timestamps: number[];
}

const circuitAiRateBuckets = new Map<string, RateBucket>();

const CIRCUIT_AI_PRUNE_INTERVAL_MS = 120_000;
setInterval(() => {
  const cutoff = Date.now() - CIRCUIT_AI_RATE_WINDOW_MS;
  circuitAiRateBuckets.forEach((bucket, ip) => {
    bucket.timestamps = bucket.timestamps.filter((t: number) => t > cutoff);
    if (bucket.timestamps.length === 0) {
      circuitAiRateBuckets.delete(ip);
    }
  });
}, CIRCUIT_AI_PRUNE_INTERVAL_MS).unref();

export function circuitAiRateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const cutoff = now - CIRCUIT_AI_RATE_WINDOW_MS;

  let bucket = circuitAiRateBuckets.get(ip);
  if (!bucket) {
    bucket = { timestamps: [] };
    circuitAiRateBuckets.set(ip, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= CIRCUIT_AI_RATE_MAX) {
    const oldestInWindow = bucket.timestamps[0];
    const retryAfterSec = Math.ceil((oldestInWindow + CIRCUIT_AI_RATE_WINDOW_MS - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSec));
    res.status(429).json({ message: `Rate limit exceeded. Max ${CIRCUIT_AI_RATE_MAX} circuit AI requests per minute.` });
    return;
  }

  bucket.timestamps.push(now);
  next();
}
