/**
 * Telemetry Logger — IndexedDB ring buffer for telemetry data
 *
 * Logs telemetry frames to IndexedDB with:
 *   - Ring buffer eviction (max 100K entries)
 *   - 7-day retention policy
 *   - Batch writes (flush every 100 entries or 1 second)
 *   - Time-range queries for chart data
 *   - Graceful fallback when IndexedDB is unavailable
 *
 * Singleton pattern for single database connection.
 */

import type { TelemetryFrame } from './telemetry-protocol';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LogEntry {
  id?: number;
  timestamp: number;
  deviceTimestamp: number;
  channelId: string;
  value: number | boolean | string;
}

export interface TimeSeriesPoint {
  time: number;
  value: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DB_NAME = 'protopulse-telemetry';
const DB_VERSION = 1;
const STORE_NAME = 'telemetry';
const MAX_ENTRIES = 100_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FLUSH_BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 1000;

// ---------------------------------------------------------------------------
// TelemetryLogger
// ---------------------------------------------------------------------------

export class TelemetryLogger {
  private static instance: TelemetryLogger | null = null;

  private db: IDBDatabase | null = null;
  private buffer: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private initialized = false;
  private flushing = false;

  private constructor() {}

  static getInstance(): TelemetryLogger {
    if (!TelemetryLogger.instance) {
      TelemetryLogger.instance = new TelemetryLogger();
    }
    return TelemetryLogger.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    if (TelemetryLogger.instance) {
      TelemetryLogger.instance.destroy();
    }
    TelemetryLogger.instance = null;
  }

  // -----------------------------------------------------------------------
  // Initialization
  // -----------------------------------------------------------------------

  /**
   * Open the IndexedDB database and create the object store if needed.
   * Returns false if IndexedDB is unavailable.
   */
  async initialize(): Promise<boolean> {
    if (this.initialized && this.db) {
      return true;
    }

    if (typeof indexedDB === 'undefined') {
      return false;
    }

    try {
      this.db = await this.openDatabase();
      this.initialized = true;
      this.startFlushTimer();
      return true;
    } catch {
      this.initialized = false;
      return false;
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: true,
          });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('channelId', 'channelId', { unique: false });
          store.createIndex('channel_time', ['channelId', 'timestamp'], { unique: false });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // -----------------------------------------------------------------------
  // Logging
  // -----------------------------------------------------------------------

  /**
   * Buffer a telemetry frame for batch writing.
   * Expands the frame's channel map into individual log entries.
   */
  log(frame: TelemetryFrame): void {
    const now = Date.now();
    for (const [channelId, value] of Object.entries(frame.ch)) {
      this.buffer.push({
        timestamp: now,
        deviceTimestamp: frame.ts,
        channelId,
        value,
      });
    }

    if (this.buffer.length >= FLUSH_BATCH_SIZE) {
      void this.flush();
    }
  }

  /**
   * Write all buffered entries to IndexedDB.
   */
  async flush(): Promise<void> {
    if (!this.db || this.buffer.length === 0 || this.flushing) {
      return;
    }

    this.flushing = true;
    const entries = this.buffer.splice(0);

    try {
      await this.writeBatch(entries);
    } catch {
      // On failure, put entries back at the front of the buffer
      this.buffer.unshift(...entries);
    } finally {
      this.flushing = false;
    }
  }

  private writeBatch(entries: LogEntry[]): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      for (const entry of entries) {
        store.add(entry);
      }

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /**
   * Get time series data for a specific channel within a time range.
   * Returns only numeric values (booleans converted to 0/1, strings skipped).
   */
  async getTimeSeries(
    channelId: string,
    startTime: number,
    endTime: number,
  ): Promise<TimeSeriesPoint[]> {
    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('channel_time');
      const range = IDBKeyRange.bound([channelId, startTime], [channelId, endTime]);
      const request = index.openCursor(range);
      const points: TimeSeriesPoint[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const entry = cursor.value as LogEntry;
          const numValue = toNumeric(entry.value);
          if (numValue !== null) {
            points.push({ time: entry.timestamp, value: numValue });
          }
          cursor.continue();
        } else {
          resolve(points);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get the latest N data points for a channel.
   */
  async getLatest(channelId: string, count: number): Promise<TimeSeriesPoint[]> {
    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('channel_time');

      // Open cursor at the end of this channel's range, going backwards
      const range = IDBKeyRange.bound(
        [channelId, -Infinity],
        [channelId, Infinity],
      );
      const request = index.openCursor(range, 'prev');
      const points: TimeSeriesPoint[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && points.length < count) {
          const entry = cursor.value as LogEntry;
          const numValue = toNumeric(entry.value);
          if (numValue !== null) {
            points.push({ time: entry.timestamp, value: numValue });
          }
          cursor.continue();
        } else {
          // Reverse to chronological order
          points.reverse();
          resolve(points);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all distinct channel IDs in the database.
   */
  async getChannelIds(): Promise<string[]> {
    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('channelId');
      const request = index.openKeyCursor(null, 'nextunique');
      const ids: string[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          ids.push(cursor.key as string);
          cursor.continue();
        } else {
          resolve(ids);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // -----------------------------------------------------------------------
  // Maintenance
  // -----------------------------------------------------------------------

  /**
   * Remove entries older than maxAge (default: 7 days).
   * Also enforces the MAX_ENTRIES ring buffer size.
   * Returns the number of entries deleted.
   */
  async prune(maxAge: number = MAX_AGE_MS): Promise<number> {
    if (!this.db) {
      return 0;
    }

    let deleted = 0;

    // Delete by age
    const cutoff = Date.now() - maxAge;
    deleted += await this.deleteBeforeTimestamp(cutoff);

    // Enforce max entries
    const count = await this.getEntryCount();
    if (count > MAX_ENTRIES) {
      deleted += await this.deleteOldest(count - MAX_ENTRIES);
    }

    return deleted;
  }

  private deleteBeforeTimestamp(cutoff: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(0);
        return;
      }

      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const range = IDBKeyRange.upperBound(cutoff);
      const request = index.openCursor(range);
      let deleted = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  private deleteOldest(count: number): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(0);
        return;
      }

      const tx = this.db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const index = store.index('timestamp');
      const request = index.openCursor();
      let deleted = 0;

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && deleted < count) {
          cursor.delete();
          deleted++;
          cursor.continue();
        } else {
          resolve(deleted);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get the total number of entries in the database.
   */
  async getEntryCount(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all entries from the database.
   */
  async clear(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  // -----------------------------------------------------------------------
  // Cleanup
  // -----------------------------------------------------------------------

  destroy(): void {
    this.stopFlushTimer();
    this.buffer = [];
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.initialized = false;
  }

  private startFlushTimer(): void {
    if (this.flushTimer !== null) {
      return;
    }
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer !== null) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumeric(value: number | boolean | string): number | null {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  return null;
}
