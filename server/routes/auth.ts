import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import {
  createUser,
  getUserByUsername,
  verifyPassword,
  createSession,
  deleteSession,
  getUserById,
  validateSession,
} from '../auth';
import { asyncHandler, payloadLimit } from './utils';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // max 10 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts, please try again later' },
});

export function registerAuthRoutes(app: Express): void {
  app.post(
    '/api/auth/register',
    authLimiter,
    payloadLimit(4 * 1024),
    asyncHandler(async (req, res) => {
      const schema = z.object({
        username: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/),
        password: z.string().min(6).max(128),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const existing = await getUserByUsername(parsed.data.username);
      if (existing) {
        return res.status(409).json({ message: 'Username already taken' });
      }

      const user = await createUser(parsed.data.username, parsed.data.password);
      const sessionId = await createSession(user.id);
      res.status(201).json({ sessionId, user: { id: user.id, username: user.username } });
    }),
  );

  app.post(
    '/api/auth/login',
    authLimiter,
    payloadLimit(4 * 1024),
    asyncHandler(async (req, res) => {
      const schema = z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: fromZodError(parsed.error).toString() });
      }

      const user = await getUserByUsername(parsed.data.username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const valid = await verifyPassword(parsed.data.password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const sessionId = await createSession(user.id);
      res.json({ sessionId, user: { id: user.id, username: user.username } });
    }),
  );

  app.post(
    '/api/auth/logout',
    asyncHandler(async (req, res) => {
      const sessionId = req.headers['x-session-id'] as string;
      if (sessionId) {
        await deleteSession(sessionId);
      }
      res.status(204).end();
    }),
  );

  app.get(
    '/api/auth/me',
    asyncHandler(async (req, res) => {
      const sessionId = req.headers['x-session-id'] as string;
      if (!sessionId) {
        return res.status(401).json({ message: 'Not authenticated' });
      }

      const session = await validateSession(sessionId);
      if (!session) {
        return res.status(401).json({ message: 'Invalid session' });
      }

      const user = await getUserById(session.userId);
      if (!user) {
        return res.status(401).json({ message: 'User not found' });
      }

      res.json({ id: user.id, username: user.username });
    }),
  );
}
