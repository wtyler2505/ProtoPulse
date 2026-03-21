import { describe, it, expect, beforeEach } from 'vitest';
import { ObservabilityManager } from '../observability';
import type { LogLevel } from '../observability';

describe('ObservabilityManager', () => {
  let mgr: ObservabilityManager;

  beforeEach(() => {
    ObservabilityManager.resetInstance();
    mgr = ObservabilityManager.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      expect(ObservabilityManager.getInstance()).toBe(mgr);
    });

    it('returns a new instance after reset', () => {
      ObservabilityManager.resetInstance();
      expect(ObservabilityManager.getInstance()).not.toBe(mgr);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe
  // -----------------------------------------------------------------------

  describe('subscribe', () => {
    it('notifies on log', () => {
      let called = 0;
      mgr.subscribe(() => { called += 1; });
      mgr.log('info', 'hello');
      expect(called).toBe(1);
    });

    it('can unsubscribe', () => {
      let called = 0;
      const unsub = mgr.subscribe(() => { called += 1; });
      unsub();
      mgr.log('info', 'hello');
      expect(called).toBe(0);
    });

    it('notifies on span start', () => {
      let called = 0;
      mgr.subscribe(() => { called += 1; });
      mgr.startSpan('test');
      expect(called).toBe(1);
    });

    it('notifies on span end', () => {
      let called = 0;
      const span = mgr.startSpan('test');
      mgr.subscribe(() => { called += 1; });
      mgr.endSpan(span.spanId);
      expect(called).toBe(1);
    });

    it('notifies on alert add', () => {
      let called = 0;
      mgr.subscribe(() => { called += 1; });
      mgr.addAlert({
        name: 'test',
        condition: { type: 'error_rate', metric: 'errors', operator: '>', value: 0.5, windowMs: 60000 },
        severity: 'critical',
        cooldownMs: 5000,
        enabled: true,
      });
      expect(called).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------------

  describe('logging', () => {
    it('stores a log entry', () => {
      mgr.log('info', 'test message');
      const logs = mgr.getRecentLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('test message');
      expect(logs[0].level).toBe('info');
    });

    it('stores context', () => {
      mgr.log('warn', 'oops', { key: 'value', userId: 'u1' });
      const logs = mgr.getRecentLogs();
      expect(logs[0].context.key).toBe('value');
      expect(logs[0].userId).toBe('u1');
    });

    it('stores tags', () => {
      mgr.log('info', 'tagged', { tags: ['a', 'b'] });
      expect(mgr.getRecentLogs()[0].tags).toEqual(['a', 'b']);
    });

    it('defaults tags to empty array', () => {
      mgr.log('info', 'no tags');
      expect(mgr.getRecentLogs()[0].tags).toEqual([]);
    });

    it('filters by level (min level)', () => {
      mgr.log('debug', 'd');
      mgr.log('info', 'i');
      mgr.log('warn', 'w');
      mgr.log('error', 'e');
      mgr.log('fatal', 'f');

      const warns = mgr.getRecentLogs({ level: 'warn' });
      expect(warns).toHaveLength(3); // warn, error, fatal
    });

    it('filters by source', () => {
      mgr.log('info', 'a', { source: 'auth' });
      mgr.log('info', 'b', { source: 'api' });
      mgr.log('info', 'c', { source: 'auth' });

      const authLogs = mgr.getRecentLogs({ source: 'auth' });
      expect(authLogs).toHaveLength(2);
    });

    it('limits results', () => {
      for (let i = 0; i < 20; i++) {
        mgr.log('info', `msg ${i}`);
      }
      const limited = mgr.getRecentLogs({ limit: 5 });
      expect(limited).toHaveLength(5);
    });

    it('returns most recent when limited', () => {
      for (let i = 0; i < 10; i++) {
        mgr.log('info', `msg ${i}`);
      }
      const limited = mgr.getRecentLogs({ limit: 3 });
      expect(limited[0].message).toBe('msg 7');
      expect(limited[2].message).toBe('msg 9');
    });

    it('ring buffer caps at 10000', () => {
      for (let i = 0; i < 10_050; i++) {
        mgr.log('info', `msg ${i}`);
      }
      const all = mgr.getRecentLogs();
      expect(all.length).toBe(10_000);
      // First entry should be msg 50 (first 50 evicted)
      expect(all[0].message).toBe('msg 50');
    });

    it('sets timestamp on log', () => {
      const before = Date.now();
      mgr.log('info', 'timed');
      const after = Date.now();
      const ts = mgr.getRecentLogs()[0].timestamp;
      expect(ts).toBeGreaterThanOrEqual(before);
      expect(ts).toBeLessThanOrEqual(after);
    });

    it('stores source from context', () => {
      mgr.log('info', 'src', { source: 'myModule' });
      expect(mgr.getRecentLogs()[0].source).toBe('myModule');
    });

    it('defaults source to app', () => {
      mgr.log('info', 'no source');
      expect(mgr.getRecentLogs()[0].source).toBe('app');
    });

    it('stores projectId', () => {
      mgr.log('info', 'proj', { projectId: 42 });
      expect(mgr.getRecentLogs()[0].projectId).toBe(42);
    });

    it('stores duration', () => {
      mgr.log('info', 'dur', { duration: 1234 });
      expect(mgr.getRecentLogs()[0].duration).toBe(1234);
    });

    it('stores traceId and spanId from context', () => {
      mgr.log('info', 'traced', { traceId: 't1', spanId: 's1' });
      const entry = mgr.getRecentLogs()[0];
      expect(entry.traceId).toBe('t1');
      expect(entry.spanId).toBe('s1');
    });
  });

  // -----------------------------------------------------------------------
  // Tracing
  // -----------------------------------------------------------------------

  describe('tracing', () => {
    it('creates a span with unique IDs', () => {
      const span = mgr.startSpan('op1');
      expect(span.traceId).toBeDefined();
      expect(span.spanId).toBeDefined();
      expect(span.name).toBe('op1');
      expect(span.status).toBe('ok');
    });

    it('child span inherits traceId', () => {
      const parent = mgr.startSpan('parent');
      const child = mgr.startSpan('child', parent.spanId);
      expect(child.traceId).toBe(parent.traceId);
      expect(child.parentSpanId).toBe(parent.spanId);
    });

    it('getActiveTraces returns open spans', () => {
      mgr.startSpan('active1');
      mgr.startSpan('active2');
      expect(mgr.getActiveTraces()).toHaveLength(2);
    });

    it('endSpan removes from active', () => {
      const span = mgr.startSpan('temp');
      mgr.endSpan(span.spanId);
      expect(mgr.getActiveTraces()).toHaveLength(0);
    });

    it('endSpan sets endTime', () => {
      const span = mgr.startSpan('timed');
      mgr.endSpan(span.spanId);
      const completed = mgr.getCompletedSpans();
      expect(completed[0].endTime).toBeDefined();
      expect(completed[0].endTime!).toBeGreaterThanOrEqual(completed[0].startTime);
    });

    it('endSpan sets error status', () => {
      const span = mgr.startSpan('failing');
      mgr.endSpan(span.spanId, 'error');
      const completed = mgr.getCompletedSpans();
      expect(completed[0].status).toBe('error');
    });

    it('endSpan defaults to ok status', () => {
      const span = mgr.startSpan('success');
      mgr.endSpan(span.spanId);
      expect(mgr.getCompletedSpans()[0].status).toBe('ok');
    });

    it('endSpan is no-op for unknown spanId', () => {
      mgr.endSpan('nonexistent');
      expect(mgr.getCompletedSpans()).toHaveLength(0);
    });

    it('addSpanEvent adds event to span', () => {
      const span = mgr.startSpan('evented');
      mgr.addSpanEvent(span.spanId, 'checkpoint', { step: 1 });
      const active = mgr.getActiveTraces();
      expect(active[0].events).toHaveLength(1);
      expect(active[0].events[0].name).toBe('checkpoint');
    });

    it('addSpanEvent is no-op for unknown spanId', () => {
      mgr.addSpanEvent('nonexistent', 'event');
      // No error thrown
    });

    it('completed spans ring buffer caps at 1000', () => {
      for (let i = 0; i < 1050; i++) {
        const span = mgr.startSpan(`span-${i}`);
        mgr.endSpan(span.spanId);
      }
      expect(mgr.getCompletedSpans().length).toBe(1000);
    });

    it('getCompletedSpans with limit', () => {
      for (let i = 0; i < 10; i++) {
        const span = mgr.startSpan(`span-${i}`);
        mgr.endSpan(span.spanId);
      }
      expect(mgr.getCompletedSpans(3)).toHaveLength(3);
    });

    it('getActiveTraces returns copies', () => {
      mgr.startSpan('copy');
      const a = mgr.getActiveTraces();
      const b = mgr.getActiveTraces();
      expect(a[0]).not.toBe(b[0]);
    });
  });

  // -----------------------------------------------------------------------
  // Alerts
  // -----------------------------------------------------------------------

  describe('alerts', () => {
    it('addAlert returns rule with id', () => {
      const rule = mgr.addAlert({
        name: 'high errors',
        condition: { type: 'error_rate', metric: 'errors', operator: '>', value: 0.5, windowMs: 60000 },
        severity: 'critical',
        cooldownMs: 5000,
        enabled: true,
      });
      expect(rule.id).toBeDefined();
      expect(rule.name).toBe('high errors');
    });

    it('getAlertRules returns all rules', () => {
      mgr.addAlert({ name: 'r1', condition: { type: 'count', metric: 'x', operator: '>', value: 1, windowMs: 1000 }, severity: 'info', cooldownMs: 0, enabled: true });
      mgr.addAlert({ name: 'r2', condition: { type: 'count', metric: 'y', operator: '>', value: 1, windowMs: 1000 }, severity: 'warning', cooldownMs: 0, enabled: true });
      expect(mgr.getAlertRules()).toHaveLength(2);
    });

    it('removeAlert removes rule', () => {
      const rule = mgr.addAlert({ name: 'removable', condition: { type: 'count', metric: 'x', operator: '>', value: 1, windowMs: 1000 }, severity: 'info', cooldownMs: 0, enabled: true });
      expect(mgr.removeAlert(rule.id)).toBe(true);
      expect(mgr.getAlertRules()).toHaveLength(0);
    });

    it('removeAlert returns false for unknown id', () => {
      expect(mgr.removeAlert('fake')).toBe(false);
    });

    it('evaluateAlerts triggers on error rate', () => {
      mgr.addAlert({
        name: 'error rate alert',
        condition: { type: 'error_rate', metric: 'errors', operator: '>', value: 0.3, windowMs: 60000 },
        severity: 'critical',
        cooldownMs: 0,
        enabled: true,
      });

      // Generate logs: 4 errors, 1 info → 80% error rate > 30%
      mgr.log('error', 'e1');
      mgr.log('error', 'e2');
      mgr.log('error', 'e3');
      mgr.log('error', 'e4');
      mgr.log('info', 'ok');

      const evals = mgr.evaluateAlerts();
      expect(evals).toHaveLength(1);
      expect(evals[0].triggered).toBe(true);
      expect(evals[0].currentValue).toBeCloseTo(0.8, 1);
    });

    it('evaluateAlerts respects cooldown', () => {
      const rule = mgr.addAlert({
        name: 'cooled',
        condition: { type: 'error_rate', metric: 'errors', operator: '>', value: 0, windowMs: 60000 },
        severity: 'critical',
        cooldownMs: 999999,
        enabled: true,
      });

      mgr.log('error', 'e1');
      const first = mgr.evaluateAlerts();
      expect(first[0].triggered).toBe(true);

      // Second eval should be in cooldown
      const second = mgr.evaluateAlerts();
      const cooldownResult = second.find((e) => e.rule.id === rule.id);
      expect(cooldownResult?.triggered).toBe(false);
    });

    it('evaluateAlerts skips disabled rules', () => {
      mgr.addAlert({
        name: 'disabled',
        condition: { type: 'count', metric: 'x', operator: '>', value: 0, windowMs: 1000 },
        severity: 'info',
        cooldownMs: 0,
        enabled: false,
      });
      mgr.setMetric('x', 100);
      const evals = mgr.evaluateAlerts();
      expect(evals[0].triggered).toBe(false);
    });

    it('evaluateAlerts threshold type', () => {
      mgr.addAlert({
        name: 'threshold',
        condition: { type: 'threshold', metric: 'cpu', operator: '>=', value: 80, windowMs: 1000 },
        severity: 'warning',
        cooldownMs: 0,
        enabled: true,
      });
      mgr.setMetric('cpu', 90);
      const evals = mgr.evaluateAlerts();
      expect(evals[0].triggered).toBe(true);
      expect(evals[0].currentValue).toBe(90);
    });

    it('evaluateAlerts less than operator', () => {
      mgr.addAlert({
        name: 'low',
        condition: { type: 'threshold', metric: 'free_mem', operator: '<', value: 100, windowMs: 1000 },
        severity: 'critical',
        cooldownMs: 0,
        enabled: true,
      });
      mgr.setMetric('free_mem', 50);
      const evals = mgr.evaluateAlerts();
      expect(evals[0].triggered).toBe(true);
    });

    it('evaluateAlerts equals operator', () => {
      mgr.addAlert({
        name: 'exact',
        condition: { type: 'threshold', metric: 'count', operator: '==', value: 42, windowMs: 1000 },
        severity: 'info',
        cooldownMs: 0,
        enabled: true,
      });
      mgr.setMetric('count', 42);
      const evals = mgr.evaluateAlerts();
      expect(evals[0].triggered).toBe(true);
    });

    it('evaluateAlerts latency type', () => {
      mgr.addAlert({
        name: 'slow',
        condition: { type: 'latency', metric: 'spans', operator: '>', value: 0, windowMs: 60000 },
        severity: 'warning',
        cooldownMs: 0,
        enabled: true,
      });
      const span = mgr.startSpan('slow-op');
      mgr.endSpan(span.spanId);
      const evals = mgr.evaluateAlerts();
      expect(evals[0].triggered).toBe(true);
      expect(evals[0].currentValue).toBeGreaterThanOrEqual(0);
    });
  });

  // -----------------------------------------------------------------------
  // Metrics
  // -----------------------------------------------------------------------

  describe('metrics', () => {
    it('getMetrics returns empty initially', () => {
      expect(Object.keys(mgr.getMetrics()).length).toBe(0);
    });

    it('setMetric stores value', () => {
      mgr.setMetric('foo', 42);
      expect(mgr.getMetrics().foo).toBe(42);
    });

    it('incrementMetric increments by delta', () => {
      mgr.incrementMetric('counter', 5);
      mgr.incrementMetric('counter', 3);
      expect(mgr.getMetrics().counter).toBe(8);
    });

    it('incrementMetric defaults to 1', () => {
      mgr.incrementMetric('clicks');
      mgr.incrementMetric('clicks');
      expect(mgr.getMetrics().clicks).toBe(2);
    });

    it('logging updates log metrics', () => {
      mgr.log('error', 'e1');
      mgr.log('error', 'e2');
      mgr.log('info', 'i1');
      const metrics = mgr.getMetrics();
      expect(metrics.log_error_count).toBe(2);
      expect(metrics.log_info_count).toBe(1);
      expect(metrics.log_total_count).toBe(3);
    });

    it('span tracking updates metrics', () => {
      const span = mgr.startSpan('m');
      expect(mgr.getMetrics().active_span_count).toBe(1);
      mgr.endSpan(span.spanId);
      expect(mgr.getMetrics().active_span_count).toBe(0);
      expect(mgr.getMetrics().span_total_count).toBe(1);
    });

    it('error spans increment span_error_count', () => {
      const span = mgr.startSpan('err');
      mgr.endSpan(span.spanId, 'error');
      expect(mgr.getMetrics().span_error_count).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // Export
  // -----------------------------------------------------------------------

  describe('export', () => {
    it('exports JSON format', () => {
      mgr.log('info', 'hello');
      mgr.log('error', 'oops');
      const json = mgr.exportLogs('json');
      const parsed = JSON.parse(json) as unknown[];
      expect(parsed).toHaveLength(2);
    });

    it('exports CSV format', () => {
      mgr.log('info', 'hello world');
      const csv = mgr.exportLogs('csv');
      const lines = csv.split('\n');
      expect(lines[0]).toBe('level,message,timestamp,source,traceId,spanId,tags');
      expect(lines).toHaveLength(2); // header + 1 row
    });

    it('CSV escapes quotes in message', () => {
      mgr.log('info', 'say "hello"');
      const csv = mgr.exportLogs('csv');
      expect(csv).toContain('""hello""');
    });

    it('exports empty CSV header when no logs', () => {
      const csv = mgr.exportLogs('csv');
      expect(csv).toBe('level,message,timestamp,source,traceId,spanId,tags');
    });

    it('exports empty JSON array when no logs', () => {
      const json = mgr.exportLogs('json');
      expect(JSON.parse(json)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Reset
  // -----------------------------------------------------------------------

  describe('reset', () => {
    it('clears all state', () => {
      mgr.log('info', 'x');
      mgr.startSpan('s');
      mgr.setMetric('m', 1);
      mgr.addAlert({ name: 'a', condition: { type: 'count', metric: 'x', operator: '>', value: 0, windowMs: 1000 }, severity: 'info', cooldownMs: 0, enabled: true });

      mgr.reset();

      expect(mgr.getRecentLogs()).toHaveLength(0);
      expect(mgr.getActiveTraces()).toHaveLength(0);
      expect(Object.keys(mgr.getMetrics()).length).toBe(0);
      expect(mgr.getAlertRules()).toHaveLength(0);
    });
  });
});
