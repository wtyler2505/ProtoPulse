import type { Request } from 'express';

type RequestPathLike = Pick<Request, 'originalUrl' | 'baseUrl' | 'path'>;

export const PUBLIC_API_PATHS = [
  '/api/auth/',
  '/api/health',
  '/api/ready',
  '/api/docs',
  '/api/metrics',
  '/api/settings/chat',
  '/api/vault/', // Ars Contexta vault — read-only public content (rate-limited)
  '/api/parts/browse/', // Parts library browse views (alternates + cross-project usage) — aggregate, user-agnostic (E2E-312/313)
] as const;

const SSE_ROUTE_PATTERNS = [
  /^\/api\/chat\/ai\/stream$/,
  /^\/api\/projects\/\d+\/agent$/,
  /^\/api\/projects\/\d+\/arduino\/jobs\/\d+\/stream$/,
  /^\/api\/projects\/\d+\/firmware\/simulate\/[^/]+\/events$/,
] as const;

export function getRequestPath(req: RequestPathLike): string {
  const originalUrl =
    typeof req.originalUrl === 'string' && req.originalUrl.length > 0
      ? req.originalUrl
      : `${req.baseUrl ?? ''}${req.path ?? ''}`;
  const [path] = originalUrl.split('?', 1);
  return path || '/';
}

export function isPublicApiPath(path: string): boolean {
  return PUBLIC_API_PATHS.some((publicPath) => path.startsWith(publicPath));
}

export function isSSERequest(req: RequestPathLike): boolean {
  const path = getRequestPath(req);
  return SSE_ROUTE_PATTERNS.some((pattern) => pattern.test(path));
}
