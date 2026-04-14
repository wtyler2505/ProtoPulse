/**
 * Vault Telemetry Tests
 *
 * Unit tests for server/lib/vault-telemetry.ts — in-memory ring buffer +
 * aggregator used by buildVaultContext and /api/vault/stats.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordEvent,
  getStats,
  clearStats,
  VAULT_TELEMETRY_MAX_EVENTS,
  type VaultTelemetryEvent,
} from '../vault-telemetry';

function makeEvent(overrides: Partial<VaultTelemetryEvent> = {}): VaultTelemetryEvent {
  return {
    timestamp: new Date().toISOString(),
    query: 'test query',
    activeView: 'schematic',
    vaultSize: 100,
    topResults: [
      { slug: 'note-a', score: 0.9 },
      { slug: 'note-b', score: 0.7 },
    ],
    contextChars: 500,
    empty: false,
    ...overrides,
  };
}

describe('vault-telemetry', () => {
  beforeEach(() => {
    clearStats();
  });

  describe('recordEvent', () => {
    it('appends events to the buffer', () => {
      recordEvent(makeEvent());
      expect(getStats().totalQueries).toBe(1);

      recordEvent(makeEvent());
      recordEvent(makeEvent());
      expect(getStats().totalQueries).toBe(3);
    });

    it('rolls over past MAX_EVENTS (ring buffer behavior)', () => {
      // Push MAX_EVENTS + overflow events; buffer should cap at MAX_EVENTS.
      const overflow = 25;
      for (let i = 0; i < VAULT_TELEMETRY_MAX_EVENTS + overflow; i++) {
        recordEvent(makeEvent({ activeView: `view-${i}` }));
      }
      const stats = getStats();
      expect(stats.totalQueries).toBe(VAULT_TELEMETRY_MAX_EVENTS);

      // Oldest events should be evicted — early `view-N` values should not
      // appear in topViews because they've been overwritten.
      const viewNames = stats.topViews.map((v) => v.view);
      expect(viewNames).not.toContain('view-0');
      expect(viewNames).not.toContain('view-5');
    });
  });

  describe('getStats', () => {
    it('returns zeroed stats when no events recorded', () => {
      const stats = getStats();
      expect(stats).toEqual({
        totalQueries: 0,
        emptyRate: 0,
        avgContextChars: 0,
        topSlugs: [],
        topViews: [],
      });
    });

    it('computes emptyRate correctly', () => {
      // 2 empty out of 5 → 0.4
      recordEvent(makeEvent({ empty: false, contextChars: 100 }));
      recordEvent(makeEvent({ empty: true, contextChars: 0 }));
      recordEvent(makeEvent({ empty: true, contextChars: 0 }));
      recordEvent(makeEvent({ empty: false, contextChars: 200 }));
      recordEvent(makeEvent({ empty: false, contextChars: 300 }));

      const stats = getStats();
      expect(stats.totalQueries).toBe(5);
      expect(stats.emptyRate).toBe(0.4);
    });

    it('computes avgContextChars correctly', () => {
      recordEvent(makeEvent({ contextChars: 100 }));
      recordEvent(makeEvent({ contextChars: 200 }));
      recordEvent(makeEvent({ contextChars: 300 }));

      // Mean of 100, 200, 300 = 200
      expect(getStats().avgContextChars).toBe(200);
    });

    it('aggregates topSlugs from topResults across events', () => {
      recordEvent(makeEvent({ topResults: [
        { slug: 'alpha', score: 0.9 },
        { slug: 'beta', score: 0.8 },
      ]}));
      recordEvent(makeEvent({ topResults: [
        { slug: 'alpha', score: 0.7 },
        { slug: 'gamma', score: 0.6 },
      ]}));
      recordEvent(makeEvent({ topResults: [
        { slug: 'alpha', score: 0.5 },
      ]}));

      const stats = getStats();
      expect(stats.topSlugs[0]).toEqual({ slug: 'alpha', count: 3 });
      // beta + gamma tied at 1 each
      const counts = Object.fromEntries(stats.topSlugs.map((s) => [s.slug, s.count]));
      expect(counts.beta).toBe(1);
      expect(counts.gamma).toBe(1);
    });

    it('aggregates topViews across events', () => {
      recordEvent(makeEvent({ activeView: 'schematic' }));
      recordEvent(makeEvent({ activeView: 'schematic' }));
      recordEvent(makeEvent({ activeView: 'schematic' }));
      recordEvent(makeEvent({ activeView: 'breadboard' }));
      recordEvent(makeEvent({ activeView: 'architecture' }));

      const stats = getStats();
      expect(stats.topViews[0]).toEqual({ view: 'schematic', count: 3 });
      const byView = Object.fromEntries(stats.topViews.map((v) => [v.view, v.count]));
      expect(byView.breadboard).toBe(1);
      expect(byView.architecture).toBe(1);
    });

    it('caps topSlugs and topViews at 10 entries each', () => {
      for (let i = 0; i < 15; i++) {
        recordEvent(makeEvent({
          activeView: `view-${i}`,
          topResults: [{ slug: `slug-${i}`, score: 0.9 }],
        }));
      }
      const stats = getStats();
      expect(stats.topSlugs.length).toBe(10);
      expect(stats.topViews.length).toBe(10);
    });

    it('skips empty activeView strings in topViews', () => {
      recordEvent(makeEvent({ activeView: '' }));
      recordEvent(makeEvent({ activeView: 'schematic' }));
      const stats = getStats();
      expect(stats.topViews).toEqual([{ view: 'schematic', count: 1 }]);
    });
  });

  describe('clearStats', () => {
    it('empties the buffer', () => {
      recordEvent(makeEvent());
      recordEvent(makeEvent());
      expect(getStats().totalQueries).toBe(2);

      clearStats();
      expect(getStats().totalQueries).toBe(0);
    });

    it('resets ring-buffer head so subsequent appends start fresh', () => {
      // Fill buffer, clear, then add a few — totalQueries should reflect only
      // the new events, not any leftover slots.
      for (let i = 0; i < VAULT_TELEMETRY_MAX_EVENTS + 10; i++) {
        recordEvent(makeEvent());
      }
      clearStats();
      recordEvent(makeEvent());
      recordEvent(makeEvent());
      expect(getStats().totalQueries).toBe(2);
    });
  });
});
