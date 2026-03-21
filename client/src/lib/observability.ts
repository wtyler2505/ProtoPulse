/**
 * ObservabilityManager — Structured logging, distributed tracing, and alerting.
 *
 * Singleton + subscribe pattern. Ring buffers for logs (10K) and traces (1K).
 * Alert rules evaluated against recent log/trace data.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface StructuredLog {
  level: LogLevel;
  message: string;
  timestamp: number;
  context: Record<string, unknown>;
  traceId?: string;
  spanId?: string;
  source: string;
  userId?: string;
  projectId?: number;
  duration?: number;
  tags: string[];
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: number;
  endTime?: number;
  status: 'ok' | 'error';
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export interface AlertCondition {
  type: 'error_rate' | 'latency' | 'count' | 'threshold';
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==';
  value: number;
  windowMs: number;
}

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: 'info' | 'warning' | 'critical';
  cooldownMs: number;
  enabled: boolean;
  lastFired?: number;
}

export interface AlertEvaluation {
  rule: AlertRule;
  triggered: boolean;
  currentValue: number;
}

type Listener = () => void;

// ---------------------------------------------------------------------------
// Log level ordering
// ---------------------------------------------------------------------------

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(36).substring(2, 10);
  return `${prefix}-${idCounter}-${rand}`;
}

// ---------------------------------------------------------------------------
// Ring buffer
// ---------------------------------------------------------------------------

class RingBuffer<T> {
  private buffer: T[] = [];
  private maxSize: number;

  constructor(maxSize: number) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    if (this.buffer.length >= this.maxSize) {
      this.buffer.shift();
    }
    this.buffer.push(item);
  }

  getAll(): T[] {
    return [...this.buffer];
  }

  getRecent(count: number): T[] {
    return this.buffer.slice(-count);
  }

  clear(): void {
    this.buffer = [];
  }

  get size(): number {
    return this.buffer.length;
  }
}

// ---------------------------------------------------------------------------
// ObservabilityManager
// ---------------------------------------------------------------------------

export class ObservabilityManager {
  // -- Singleton --
  private static instance: ObservabilityManager | null = null;

  static getInstance(): ObservabilityManager {
    if (!ObservabilityManager.instance) {
      ObservabilityManager.instance = new ObservabilityManager();
    }
    return ObservabilityManager.instance;
  }

  static resetInstance(): void {
    ObservabilityManager.instance = null;
  }

  // -- State --
  private logs: RingBuffer<StructuredLog> = new RingBuffer(10_000);
  private spans: RingBuffer<TraceSpan> = new RingBuffer(1_000);
  private activeSpans: Map<string, TraceSpan> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private metrics: Map<string, number> = new Map();
  private listeners: Set<Listener> = new Set();
  private defaultSource = 'app';

  private constructor() {}

  // -- Subscribe --
  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // -- Logging --

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: StructuredLog = {
      level,
      message,
      timestamp: Date.now(),
      context: context ?? {},
      source: (context?.source as string) ?? this.defaultSource,
      userId: context?.userId as string | undefined,
      projectId: context?.projectId as number | undefined,
      duration: context?.duration as number | undefined,
      traceId: context?.traceId as string | undefined,
      spanId: context?.spanId as string | undefined,
      tags: (context?.tags as string[]) ?? [],
    };

    this.logs.push(entry);

    // Update metrics
    const metricKey = `log_${level}_count`;
    this.metrics.set(metricKey, (this.metrics.get(metricKey) ?? 0) + 1);
    this.metrics.set('log_total_count', (this.metrics.get('log_total_count') ?? 0) + 1);

    this.notify();
  }

  getRecentLogs(filter?: { level?: LogLevel; source?: string; limit?: number }): StructuredLog[] {
    let results = this.logs.getAll();

    if (filter?.level) {
      const minOrder = LOG_LEVEL_ORDER[filter.level];
      results = results.filter((l) => LOG_LEVEL_ORDER[l.level] >= minOrder);
    }

    if (filter?.source) {
      results = results.filter((l) => l.source === filter.source);
    }

    if (filter?.limit && filter.limit > 0) {
      results = results.slice(-filter.limit);
    }

    return results;
  }

  // -- Tracing --

  startSpan(name: string, parentSpanId?: string): TraceSpan {
    const parentSpan = parentSpanId ? this.activeSpans.get(parentSpanId) : undefined;
    const traceId = parentSpan ? parentSpan.traceId : generateId('trace');
    const spanId = generateId('span');

    const span: TraceSpan = {
      traceId,
      spanId,
      parentSpanId,
      name,
      startTime: Date.now(),
      status: 'ok',
      attributes: {},
      events: [],
    };

    this.activeSpans.set(spanId, span);
    this.metrics.set('active_span_count', this.activeSpans.size);
    this.notify();
    return span;
  }

  endSpan(spanId: string, status?: 'ok' | 'error'): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }

    span.endTime = Date.now();
    span.status = status ?? 'ok';

    // Track latency metric
    const duration = span.endTime - span.startTime;
    this.metrics.set('span_avg_duration', duration);
    this.metrics.set('span_total_count', (this.metrics.get('span_total_count') ?? 0) + 1);

    if (status === 'error') {
      this.metrics.set('span_error_count', (this.metrics.get('span_error_count') ?? 0) + 1);
    }

    this.spans.push({ ...span });
    this.activeSpans.delete(spanId);
    this.metrics.set('active_span_count', this.activeSpans.size);
    this.notify();
  }

  addSpanEvent(spanId: string, name: string, attributes?: Record<string, unknown>): void {
    const span = this.activeSpans.get(spanId);
    if (!span) {
      return;
    }
    span.events.push({ name, timestamp: Date.now(), attributes });
  }

  getActiveTraces(): TraceSpan[] {
    return Array.from(this.activeSpans.values()).map((s) => ({ ...s }));
  }

  getCompletedSpans(limit?: number): TraceSpan[] {
    const all = this.spans.getAll();
    if (limit && limit > 0) {
      return all.slice(-limit);
    }
    return all;
  }

  // -- Alerts --

  addAlert(rule: Omit<AlertRule, 'id'>): AlertRule {
    const id = generateId('alert');
    const alertRule: AlertRule = { ...rule, id };
    this.alertRules.set(id, alertRule);
    this.notify();
    return alertRule;
  }

  removeAlert(id: string): boolean {
    const deleted = this.alertRules.delete(id);
    if (deleted) {
      this.notify();
    }
    return deleted;
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  evaluateAlerts(): AlertEvaluation[] {
    const now = Date.now();
    const results: AlertEvaluation[] = [];

    this.alertRules.forEach((rule) => {
      if (!rule.enabled) {
        results.push({ rule, triggered: false, currentValue: 0 });
        return;
      }

      // Cooldown check
      if (rule.lastFired && now - rule.lastFired < rule.cooldownMs) {
        results.push({ rule, triggered: false, currentValue: 0 });
        return;
      }

      const currentValue = this.computeMetricForCondition(rule.condition, now);
      const triggered = this.evaluateCondition(rule.condition, currentValue);

      if (triggered) {
        rule.lastFired = now;
      }

      results.push({ rule, triggered, currentValue });
    });

    return results;
  }

  private computeMetricForCondition(condition: AlertCondition, now: number): number {
    const windowStart = now - condition.windowMs;

    switch (condition.type) {
      case 'error_rate': {
        const recentLogs = this.logs.getAll().filter((l) => l.timestamp >= windowStart);
        if (recentLogs.length === 0) {
          return 0;
        }
        const errorCount = recentLogs.filter((l) => l.level === 'error' || l.level === 'fatal').length;
        return errorCount / recentLogs.length;
      }
      case 'latency': {
        const recentSpans = this.spans.getAll().filter((s) => s.endTime && s.endTime >= windowStart);
        if (recentSpans.length === 0) {
          return 0;
        }
        const totalDuration = recentSpans.reduce((sum, s) => sum + ((s.endTime ?? s.startTime) - s.startTime), 0);
        return totalDuration / recentSpans.length;
      }
      case 'count': {
        const metricVal = this.metrics.get(condition.metric) ?? 0;
        return metricVal;
      }
      case 'threshold': {
        return this.metrics.get(condition.metric) ?? 0;
      }
    }
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.value;
      case '<':
        return value < condition.value;
      case '>=':
        return value >= condition.value;
      case '<=':
        return value <= condition.value;
      case '==':
        return value === condition.value;
    }
  }

  // -- Metrics --

  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {};
    this.metrics.forEach((v, k) => {
      result[k] = v;
    });
    return result;
  }

  setMetric(name: string, value: number): void {
    this.metrics.set(name, value);
  }

  incrementMetric(name: string, delta = 1): void {
    this.metrics.set(name, (this.metrics.get(name) ?? 0) + delta);
  }

  // -- Export --

  exportLogs(format: 'json' | 'csv'): string {
    const logs = this.logs.getAll();

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV
    if (logs.length === 0) {
      return 'level,message,timestamp,source,traceId,spanId,tags';
    }

    const header = 'level,message,timestamp,source,traceId,spanId,tags';
    const rows = logs.map((l) => {
      const escapedMessage = `"${l.message.replace(/"/g, '""')}"`;
      return [
        l.level,
        escapedMessage,
        l.timestamp,
        l.source,
        l.traceId ?? '',
        l.spanId ?? '',
        `"${l.tags.join(';')}"`,
      ].join(',');
    });

    return [header, ...rows].join('\n');
  }

  // -- Reset (testing) --

  reset(): void {
    this.logs.clear();
    this.spans = new RingBuffer(1_000);
    this.activeSpans.clear();
    this.alertRules.clear();
    this.metrics.clear();
    this.listeners.clear();
  }
}
