import { describe, expect, it } from 'vitest';

import { getRequestPath, isPublicApiPath, isSSERequest } from '../request-routing';

describe('request-routing helpers', () => {
  describe('getRequestPath', () => {
    it('prefers originalUrl and strips query strings', () => {
      const path = getRequestPath({
        originalUrl: '/api/projects/42/agent?mode=fast',
        baseUrl: '',
        path: '/ignored',
      });

      expect(path).toBe('/api/projects/42/agent');
    });

    it('reconstructs the full path for mounted middleware when originalUrl is unavailable', () => {
      const path = getRequestPath({
        originalUrl: '',
        baseUrl: '/api',
        path: '/chat/ai/stream',
      });

      expect(path).toBe('/api/chat/ai/stream');
    });
  });

  describe('isPublicApiPath', () => {
    it('treats documented public routes as public', () => {
      expect(isPublicApiPath('/api/auth/login')).toBe(true);
      expect(isPublicApiPath('/api/health')).toBe(true);
      expect(isPublicApiPath('/api/settings/chat')).toBe(true);
      expect(isPublicApiPath('/api/seed')).toBe(false);
    });

    it('does not accidentally expose protected project routes', () => {
      expect(isPublicApiPath('/api/projects')).toBe(false);
      expect(isPublicApiPath('/api/chat/ai/stream')).toBe(false);
    });
  });

  describe('PUBLIC_API_PATHS (E2E-312/313)', () => {
    it('marks /api/parts/browse/alternates as public', () => {
      expect(isPublicApiPath('/api/parts/browse/alternates')).toBe(true);
    });
    it('marks /api/parts/browse/usage as public', () => {
      expect(isPublicApiPath('/api/parts/browse/usage')).toBe(true);
    });
    it('keeps /api/parts/:id non-public (requires session)', () => {
      expect(isPublicApiPath('/api/parts/42')).toBe(false);
    });
  });

  describe('isSSERequest', () => {
    it('detects SSE routes even from mounted middleware path fragments', () => {
      expect(isSSERequest({
        originalUrl: '',
        baseUrl: '/api',
        path: '/chat/ai/stream',
      })).toBe(true);
    });

    it('detects hardware and agent stream routes', () => {
      expect(isSSERequest({
        originalUrl: '/api/projects/5/agent',
        baseUrl: '',
        path: '/api/projects/5/agent',
      })).toBe(true);

      expect(isSSERequest({
        originalUrl: '/api/projects/5/arduino/jobs/12/stream',
        baseUrl: '',
        path: '/api/projects/5/arduino/jobs/12/stream',
      })).toBe(true);

      expect(isSSERequest({
        originalUrl: '/api/projects/5/firmware/simulate/runtime-123/events',
        baseUrl: '',
        path: '/api/projects/5/firmware/simulate/runtime-123/events',
      })).toBe(true);
    });

    it('does not misclassify neighboring non-stream endpoints', () => {
      expect(isSSERequest({
        originalUrl: '/api/projects/5/firmware/simulate/runtime-123/status',
        baseUrl: '',
        path: '/api/projects/5/firmware/simulate/runtime-123/status',
      })).toBe(false);

      expect(isSSERequest({
        originalUrl: '/api/projects/5/arduino/jobs/12',
        baseUrl: '',
        path: '/api/projects/5/arduino/jobs/12',
      })).toBe(false);
    });
  });
});
