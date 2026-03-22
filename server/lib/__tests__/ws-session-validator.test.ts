/**
 * Tests for BL-0526: WebSocket session re-validation.
 *
 * Validates `validateWsSession()` behavior across all failure modes
 * (expired session, deleted project, non-owner access) and success paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockValidateSession = vi.fn<(sessionId: string) => Promise<{ userId: number } | null>>();
const mockGetUserById = vi.fn<(id: number) => Promise<{ username: string } | null>>();
const mockIsProjectOwner = vi.fn<(projectId: number, userId: number) => Promise<boolean>>();
const mockGetProject = vi.fn<(id: number) => Promise<{ id: number; ownerId: number | null } | undefined>>();
const mockGetProjectMembers = vi.fn<(projectId: number) => Promise<{ userId: number; role: string; status: string }[]>>();

vi.mock('../../auth', () => ({
  validateSession: (...args: unknown[]) => mockValidateSession(args[0] as string),
  getUserById: (...args: unknown[]) => mockGetUserById(args[0] as number),
}));

vi.mock('../../storage', () => ({
  storage: {
    isProjectOwner: (...args: unknown[]) => mockIsProjectOwner(args[0] as number, args[1] as number),
    getProject: (...args: unknown[]) => mockGetProject(args[0] as number),
    getProjectMembers: (...args: unknown[]) => mockGetProjectMembers(args[0] as number),
  },
}));

/* ------------------------------------------------------------------ */
/*  Import after mocks                                                 */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line import-x/first
import { validateWsSession } from '../ws-session-validator';
import type { WsSessionValidResult, WsSessionInvalidResult } from '../ws-session-validator';

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateSession.mockResolvedValue({ userId: 1 });
  mockGetUserById.mockResolvedValue({ username: 'alice' });
  mockIsProjectOwner.mockResolvedValue(true);
  mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });
  mockGetProjectMembers.mockResolvedValue([]);
});

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('validateWsSession', () => {
  /* ---------------------------------------------------------------- */
  /*  Session validation                                               */
  /* ---------------------------------------------------------------- */

  describe('session validation', () => {
    it('should return expired when session is null (missing)', async () => {
      mockValidateSession.mockResolvedValueOnce(null);

      const result = await validateWsSession('bad-token', 1);

      expect(result.valid).toBe(false);
      expect((result as WsSessionInvalidResult).reason).toBe('expired');
      expect((result as WsSessionInvalidResult).userId).toBeNull();
    });

    it('should return expired when session is null (expired)', async () => {
      mockValidateSession.mockResolvedValueOnce(null);

      const result = await validateWsSession('expired-token', 42);

      expect(result.valid).toBe(false);
      expect((result as WsSessionInvalidResult).reason).toBe('expired');
    });

    it('should not call getProject when session is invalid', async () => {
      mockValidateSession.mockResolvedValueOnce(null);

      await validateWsSession('bad', 1);

      expect(mockGetProject).not.toHaveBeenCalled();
      expect(mockIsProjectOwner).not.toHaveBeenCalled();
      expect(mockGetUserById).not.toHaveBeenCalled();
    });

    it('should call validateSession with the provided sessionId', async () => {
      await validateWsSession('my-session-token', 1);

      expect(mockValidateSession).toHaveBeenCalledWith('my-session-token');
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Project validation                                               */
  /* ---------------------------------------------------------------- */

  describe('project validation', () => {
    it('should return project_deleted when project does not exist', async () => {
      mockGetProject.mockResolvedValueOnce(undefined);

      const result = await validateWsSession('valid-session', 999);

      expect(result.valid).toBe(false);
      expect((result as WsSessionInvalidResult).reason).toBe('project_deleted');
      expect((result as WsSessionInvalidResult).userId).toBeNull();
    });

    it('should call getProject with the provided projectId', async () => {
      await validateWsSession('valid-session', 42);

      expect(mockGetProject).toHaveBeenCalledWith(42);
    });

    it('should not call isProjectOwner when project is deleted', async () => {
      mockGetProject.mockResolvedValueOnce(undefined);

      await validateWsSession('valid-session', 1);

      expect(mockIsProjectOwner).not.toHaveBeenCalled();
      expect(mockGetUserById).not.toHaveBeenCalled();
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Ownership / role determination                                   */
  /* ---------------------------------------------------------------- */

  describe('ownership check', () => {
    it('should return valid with isOwner=true for project owner', async () => {
      mockIsProjectOwner.mockResolvedValueOnce(true);

      const result = await validateWsSession('valid-session', 1);

      expect(result.valid).toBe(true);
      const valid = result as WsSessionValidResult;
      expect(valid.isOwner).toBe(true);
      expect(valid.userId).toBe(1);
    });

    it('should return valid with isOwner=false for non-owner', async () => {
      mockIsProjectOwner.mockResolvedValueOnce(false);
      mockGetProjectMembers.mockResolvedValueOnce([{ userId: 1, role: 'editor', status: 'accepted' }]);

      const result = await validateWsSession('valid-session', 1);

      expect(result.valid).toBe(true);
      const valid = result as WsSessionValidResult;
      expect(valid.isOwner).toBe(false);
      expect(valid.userId).toBe(1);
    });

    it('should call isProjectOwner with correct projectId and userId', async () => {
      mockValidateSession.mockResolvedValueOnce({ userId: 7 });

      await validateWsSession('valid-session', 42);

      expect(mockIsProjectOwner).toHaveBeenCalledWith(42, 7);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Username resolution                                              */
  /* ---------------------------------------------------------------- */

  describe('username resolution', () => {
    it('should include username from getUserById', async () => {
      mockGetUserById.mockResolvedValueOnce({ username: 'bob' });

      const result = await validateWsSession('valid-session', 1);

      expect(result.valid).toBe(true);
      expect((result as WsSessionValidResult).username).toBe('bob');
    });

    it('should fall back to User N when getUserById returns null', async () => {
      mockValidateSession.mockResolvedValueOnce({ userId: 5 });
      mockGetUserById.mockResolvedValueOnce(null);

      const result = await validateWsSession('valid-session', 1);

      expect(result.valid).toBe(true);
      expect((result as WsSessionValidResult).username).toBe('User 5');
    });

    it('should call getUserById with the session userId', async () => {
      mockValidateSession.mockResolvedValueOnce({ userId: 99 });

      await validateWsSession('valid-session', 1);

      expect(mockGetUserById).toHaveBeenCalledWith(99);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Full success path                                                */
  /* ---------------------------------------------------------------- */

  describe('success path', () => {
    it('should return complete valid result for owner', async () => {
      mockValidateSession.mockResolvedValueOnce({ userId: 3 });
      mockGetProject.mockResolvedValueOnce({ id: 10, ownerId: 3 });
      mockIsProjectOwner.mockResolvedValueOnce(true);
      mockGetUserById.mockResolvedValueOnce({ username: 'charlie' });

      const result = await validateWsSession('session-abc', 10);

      expect(result).toEqual({
        valid: true,
        userId: 3,
        username: 'charlie',
        isOwner: true,
        role: 'owner',
      });
    });

    it('should return complete valid result for non-owner (editor)', async () => {
      mockValidateSession.mockResolvedValueOnce({ userId: 4 });
      mockGetProject.mockResolvedValueOnce({ id: 10, ownerId: 3 });
      mockIsProjectOwner.mockResolvedValueOnce(false);
      mockGetProjectMembers.mockResolvedValueOnce([{ userId: 4, role: 'editor', status: 'accepted' }]);
      mockGetUserById.mockResolvedValueOnce({ username: 'dave' });

      const result = await validateWsSession('session-xyz', 10);

      expect(result).toEqual({
        valid: true,
        userId: 4,
        username: 'dave',
        isOwner: false,
        role: 'editor',
      });
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Call ordering                                                     */
  /* ---------------------------------------------------------------- */

  describe('call ordering', () => {
    it('should call dependencies in order: validateSession → getProject → isProjectOwner → getUserById', async () => {
      const callOrder: string[] = [];

      mockValidateSession.mockImplementation(async () => {
        callOrder.push('validateSession');
        return { userId: 1 };
      });
      mockGetProject.mockImplementation(async () => {
        callOrder.push('getProject');
        return { id: 1, ownerId: 1 };
      });
      mockIsProjectOwner.mockImplementation(async () => {
        callOrder.push('isProjectOwner');
        return true;
      });
      mockGetUserById.mockImplementation(async () => {
        callOrder.push('getUserById');
        return { username: 'alice' };
      });

      await validateWsSession('session', 1);

      expect(callOrder).toEqual([
        'validateSession',
        'getProject',
        'isProjectOwner',
        'getUserById',
      ]);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Edge cases                                                       */
  /* ---------------------------------------------------------------- */

  describe('edge cases', () => {
    it('should handle empty sessionId string', async () => {
      mockValidateSession.mockResolvedValueOnce(null);

      const result = await validateWsSession('', 1);

      expect(result.valid).toBe(false);
      expect((result as WsSessionInvalidResult).reason).toBe('expired');
    });

    it('should handle projectId 0 gracefully (project not found)', async () => {
      mockGetProject.mockResolvedValueOnce(undefined);

      const result = await validateWsSession('valid', 0);

      expect(result.valid).toBe(false);
      expect((result as WsSessionInvalidResult).reason).toBe('project_deleted');
    });

    it('should handle concurrent validation calls independently', async () => {
      mockValidateSession
        .mockResolvedValueOnce({ userId: 1 })
        .mockResolvedValueOnce(null);
      mockGetProject.mockResolvedValue({ id: 1, ownerId: 1 });

      const [result1, result2] = await Promise.all([
        validateWsSession('good-session', 1),
        validateWsSession('bad-session', 1),
      ]);

      expect(result1.valid).toBe(true);
      expect(result2.valid).toBe(false);
    });

    it('should propagate storage errors', async () => {
      mockGetProject.mockRejectedValueOnce(new Error('DB connection lost'));

      await expect(validateWsSession('valid', 1)).rejects.toThrow('DB connection lost');
    });

    it('should propagate auth errors', async () => {
      mockValidateSession.mockRejectedValueOnce(new Error('Auth service down'));

      await expect(validateWsSession('valid', 1)).rejects.toThrow('Auth service down');
    });
  });
});
