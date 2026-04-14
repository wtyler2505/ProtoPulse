/**
 * Vault Telemetry — in-memory ring buffer + aggregator for vault grounding events.
 *
 * Every call to `buildVaultContext` records a structured event here so we can
 * measure the impact of Ars Contexta vault grounding on AI responses:
 *   - how often grounding returns results (empty rate)
 *   - how big the returned context is (avg contextChars)
 *   - query distribution (top queried vault slugs)
 *   - which UI views drive the most grounding traffic
 *
 * Deliberately in-memory — telemetry should add zero DB load and must be
 * fire-and-forget: a telemetry failure must NEVER break an AI response.
 *
 * Scope: single-process ring buffer of the last MAX_EVENTS events. Resets on
 * server restart. If we ever want durable cross-restart metrics, swap the
 * ring buffer for a SQLite table behind the same public API.
 */
import { logger } from '../logger';

/** Per-event record captured at each buildVaultContext invocation. */
export interface VaultTelemetryEvent {
  /** ISO-8601 timestamp of the invocation. */
  timestamp: string;
  /** Raw user message, trimmed to 60 chars (privacy + log-volume safety). */
  query: string;
  /** The active client view at the time of the request (e.g. "schematic"). */
  activeView: string;
  /** Number of notes indexed in the singleton vault at query time. */
  vaultSize: number;
  /** Top-3 results returned by Fuse with their inverted scores (1 = perfect). */
  topResults: Array<{ slug: string; score: number }>;
  /** Length in chars of the grounding string returned to the AI prompt. */
  contextChars: number;
  /** True when no grounding string was produced (query skipped or no matches). */
  empty: boolean;
}

/** Maximum events retained in the ring buffer. Sized to keep memory tiny (~300KB worst case). */
const MAX_EVENTS = 1000;

/** Aggregated stats snapshot returned by `getStats`. */
export interface VaultTelemetryStats {
  /** Total events currently in the buffer (<= MAX_EVENTS). */
  totalQueries: number;
  /** Fraction of events where `empty === true`, rounded to 4 decimals. 0 when no events. */
  emptyRate: number;
  /** Mean contextChars across all recorded events. 0 when no events. */
  avgContextChars: number;
  /** Top 10 slugs that appeared in `topResults` across events, most frequent first. */
  topSlugs: Array<{ slug: string; count: number }>;
  /** Top 10 activeView values across events, most frequent first. */
  topViews: Array<{ view: string; count: number }>;
}

// Ring buffer state — module-local singleton.
// We use a plain array with head-pointer rollover rather than Array.shift() so
// appends stay O(1) regardless of buffer size.
const buffer: VaultTelemetryEvent[] = [];
let head = 0; // next write index when buffer is full

/**
 * Append a telemetry event to the in-memory ring buffer.
 *
 * Wrapped in try/catch — a telemetry failure must never propagate to the
 * caller (which is the AI request path). On error, the event is silently
 * dropped and a warn log is emitted.
 */
export function recordEvent(event: VaultTelemetryEvent): void {
  try {
    if (buffer.length < MAX_EVENTS) {
      buffer.push(event);
    } else {
      buffer[head] = event;
      head = (head + 1) % MAX_EVENTS;
    }
  } catch (err) {
    logger.warn('[vault-telemetry] recordEvent failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Aggregate the current buffer into a stats snapshot.
 *
 * All aggregation is O(n) over the buffer (max 1000 events), so this is
 * cheap enough to run on every /api/vault/stats request behind the 30s HTTP
 * cache layer we configure in the route.
 */
export function getStats(): VaultTelemetryStats {
  const events = buffer;
  const total = events.length;

  if (total === 0) {
    return {
      totalQueries: 0,
      emptyRate: 0,
      avgContextChars: 0,
      topSlugs: [],
      topViews: [],
    };
  }

  let emptyCount = 0;
  let charsSum = 0;
  const slugCounts = new Map<string, number>();
  const viewCounts = new Map<string, number>();

  for (const e of events) {
    if (e.empty) emptyCount += 1;
    charsSum += e.contextChars;

    for (const r of e.topResults) {
      slugCounts.set(r.slug, (slugCounts.get(r.slug) ?? 0) + 1);
    }

    if (e.activeView) {
      viewCounts.set(e.activeView, (viewCounts.get(e.activeView) ?? 0) + 1);
    }
  }

  const topSlugs = [...slugCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([slug, count]) => ({ slug, count }));

  const topViews = [...viewCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([view, count]) => ({ view, count }));

  return {
    totalQueries: total,
    emptyRate: Number((emptyCount / total).toFixed(4)),
    avgContextChars: Math.round(charsSum / total),
    topSlugs,
    topViews,
  };
}

/**
 * Reset the ring buffer. Intended for tests — never called in production
 * pathways. Kept exported (not test-only) so the stats route could offer an
 * admin reset in future without another module change.
 */
export function clearStats(): void {
  buffer.length = 0;
  head = 0;
}

/** Exposed only so tests can assert the max-size contract without hard-coding. */
export const VAULT_TELEMETRY_MAX_EVENTS = MAX_EVENTS;
