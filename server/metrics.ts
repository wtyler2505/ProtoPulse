interface RouteMetric {
  count: number;
  totalDuration: number;
  errors: number;
}

const routeMetrics = new Map<string, RouteMetric>();
let startTime = Date.now();

export function recordRequest(method: string, path: string, statusCode: number, durationMs: number) {
  const key = `${method} ${path}`;
  const existing = routeMetrics.get(key) || { count: 0, totalDuration: 0, errors: 0 };
  existing.count++;
  existing.totalDuration += durationMs;
  if (statusCode >= 400) existing.errors++;
  routeMetrics.set(key, existing);
}

export function getMetrics() {
  const routes: Record<string, { count: number; avgMs: number; errors: number }> = {};
  routeMetrics.forEach((m, key) => {
    routes[key] = {
      count: m.count,
      avgMs: Math.round(m.totalDuration / m.count),
      errors: m.errors,
    };
  });
  return {
    uptimeSeconds: Math.round((Date.now() - startTime) / 1000),
    routes,
  };
}
