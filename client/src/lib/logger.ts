/**
 * Client-side structured logger.
 *
 * Replaces ad-hoc `console.log/warn/error` calls in the browser bundle.
 *
 * Features:
 * - Level gating via `VITE_LOG_LEVEL` (debug | info | warn | error). Default `info`.
 *   In dev (`import.meta.env.DEV`) the default drops to `debug`.
 * - BL-0004 secret redaction: messages and string args are scrubbed of common API
 *   key shapes (sk-ant-, sk-, sk-proj-, AIza, gsk_, xai-, gh[pousr]_, AKIA…,
 *   xox[abpsr]-, sk_live_/pk_test_, generic `API_KEY_*` env-style strings)
 *   BEFORE they reach the console or the network.
 * - Per-session counters (`getCounters()`) for telemetry / smoke tests.
 * - Optional remote sink: when `VITE_CLIENT_LOG_REMOTE === 'true'` we POST a
 *   small JSON envelope to `/api/client-log` via `navigator.sendBeacon` for
 *   `warn` / `error`. Off by default — the endpoint may not exist yet; failures
 *   are swallowed so the logger never throws.
 * - Never recurses into `console.*` from inside the logger's own paths beyond
 *   the single intentional dev sink (we capture references at module load so
 *   downstream monkey-patching can't loop us).
 *
 * Intentionally NOT exported as a `default` export: importers must use named
 * `logger` to keep grep-ability ("logger.error" vs raw `console.error`).
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

// Capture references so monkey-patching `console` later can't cause recursion.
const rawConsole = {
  debug: console.debug.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function readEnv(): { level: LogLevel; remote: boolean; isDev: boolean } {
  // import.meta.env is provided by Vite; guard for non-Vite test contexts.
  const meta = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {};
  const isDev = Boolean(meta.DEV);
  const rawLevel = String(meta.VITE_LOG_LEVEL ?? '').toLowerCase();
  const level: LogLevel =
    rawLevel === 'debug' || rawLevel === 'info' || rawLevel === 'warn' || rawLevel === 'error'
      ? rawLevel
      : isDev
        ? 'debug'
        : 'info';
  const remote = String(meta.VITE_CLIENT_LOG_REMOTE ?? '').toLowerCase() === 'true';
  return { level, remote, isDev };
}

const env = readEnv();

function shouldLog(level: LogLevel): boolean {
  return LEVEL_RANK[level] >= LEVEL_RANK[env.level];
}

/**
 * BL-0004 redaction. Mirrors the server-side `redactSecrets` regex set in
 * `server/ai.ts` so that any secret accidentally logged on the client is
 * scrubbed before it reaches console output OR the remote sink.
 */
const SECRET_PATTERNS: RegExp[] = [
  /sk-ant-[a-zA-Z0-9_-]{16,}/g,
  /\bsk-proj-[a-zA-Z0-9_-]{20,}\b/g,
  /\bsk-[a-zA-Z0-9]{20,}\b/g,
  /\bAIza[a-zA-Z0-9_-]{35}\b/g,
  /\bgsk_[a-zA-Z0-9]{20,}\b/g,
  /\bxai-[a-zA-Z0-9]{20,}\b/g,
  /\bgh[pousr]_[a-zA-Z0-9]{36}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abpsr]-[a-zA-Z0-9-]{10,}\b/g,
  /\b(?:sk|pk)_(?:live|test)_[a-zA-Z0-9]{24,}\b/g,
  // Catch-all: any uppercase API_KEY_<NAME>=<value> style env dump.
  /\bAPI_KEY_[A-Z0-9_]+\s*=\s*[^\s,;]+/g,
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[REDACTED]');
  }
  return out;
}

function scrubArg(arg: unknown): unknown {
  if (typeof arg === 'string') return redactSecrets(arg);
  if (arg instanceof Error) {
    // Don't mutate the original Error; return a string representation.
    return redactSecrets(`${arg.name}: ${arg.message}`);
  }
  return arg;
}

interface Counters {
  debug: number;
  info: number;
  warn: number;
  error: number;
}

const counters: Counters = { debug: 0, info: 0, warn: 0, error: 0 };

export function getCounters(): Readonly<Counters> {
  return { ...counters };
}

/**
 * Reset the per-session counters. Test-only helper.
 */
export function resetCounters(): void {
  counters.debug = 0;
  counters.info = 0;
  counters.warn = 0;
  counters.error = 0;
}

function sendRemote(level: LogLevel, msg: string, args: unknown[]): void {
  if (!env.remote) return;
  if (level !== 'warn' && level !== 'error') return;
  if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') return;
  try {
    const payload = JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg,
      // Best-effort serialization; sendBeacon swallows oversize payloads.
      args: args.map((a) => {
        try {
          return typeof a === 'string' ? a : JSON.parse(JSON.stringify(a)) as unknown;
        } catch {
          return String(a);
        }
      }),
      url: typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
    const blob = new Blob([payload], { type: 'application/json' });
    navigator.sendBeacon('/api/client-log', blob);
  } catch {
    // Logger must never throw.
  }
}

function log(level: LogLevel, msg: string, ...args: unknown[]): void {
  counters[level] += 1;
  if (!shouldLog(level)) return;
  const safeMsg = redactSecrets(msg);
  const safeArgs = args.map(scrubArg);
  // Single intentional sink to the captured raw console.
  rawConsole[level](safeMsg, ...safeArgs);
  sendRemote(level, safeMsg, safeArgs);
}

export const logger = {
  debug(msg: string, ...args: unknown[]): void {
    log('debug', msg, ...args);
  },
  info(msg: string, ...args: unknown[]): void {
    log('info', msg, ...args);
  },
  warn(msg: string, ...args: unknown[]): void {
    log('warn', msg, ...args);
  },
  error(msg: string, ...args: unknown[]): void {
    log('error', msg, ...args);
  },
};

export type { LogLevel };
