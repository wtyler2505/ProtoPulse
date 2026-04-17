/**
 * BL-0524: Tests for detectConflict — the conflict-shape emitter that
 * rides alongside the existing structuralMerge / LWW drop logic so
 * losing operations can be surfaced to the UI rather than silently
 * swallowed.
 */

import { describe, it, expect } from 'vitest';
import type { CRDTOperation } from '../collaboration';
import { detectConflict } from '../collaboration';

type RecentEntry = { op: CRDTOperation; serverTs: number; clientId: number };

describe('detectConflict', () => {
  describe('lww-update', () => {
    it('returns a conflict when a newer update for the same key exists', () => {
      const incoming: CRDTOperation = {
        op: 'update',
        path: ['nodes'],
        key: 'n1',
        value: { label: 'mine' },
        timestamp: 5,
        clientId: 1,
      };
      const recent: RecentEntry[] = [
        {
          op: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' }, timestamp: 10, clientId: 2 },
          serverTs: 10,
          clientId: 2,
        },
      ];
      const result = detectConflict(incoming, recent);
      expect(result).not.toBeNull();
      expect(result?.kind).toBe('lww-update');
      expect(result?.key).toBe('n1');
      expect(result?.yourOp).toBe(incoming);
      expect(result?.theirOp).toBe(recent[0].op);
    });

    it('returns null when incoming update would win LWW', () => {
      const incoming: CRDTOperation = {
        op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' }, timestamp: 20, clientId: 1,
      };
      const recent: RecentEntry[] = [
        {
          op: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'theirs' }, timestamp: 10, clientId: 2 },
          serverTs: 10, clientId: 2,
        },
      ];
      expect(detectConflict(incoming, recent)).toBeNull();
    });

    it('returns null when updates target different keys', () => {
      const incoming: CRDTOperation = {
        op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' }, timestamp: 5, clientId: 1,
      };
      const recent: RecentEntry[] = [
        {
          op: { op: 'update', path: ['nodes'], key: 'n2', value: { label: 'other' }, timestamp: 10, clientId: 2 },
          serverTs: 10, clientId: 2,
        },
      ];
      expect(detectConflict(incoming, recent)).toBeNull();
    });

    it('returns null when no recent update exists for the key', () => {
      const incoming: CRDTOperation = {
        op: 'update', path: ['nodes'], key: 'n1', value: { label: 'mine' }, timestamp: 5, clientId: 1,
      };
      expect(detectConflict(incoming, [])).toBeNull();
    });
  });

  describe('insert-superseded', () => {
    it('returns a conflict when a concurrent insert with the same id has a higher timestamp', () => {
      const incoming: CRDTOperation = {
        op: 'insert', path: ['nodes'], value: { id: 'n1', label: 'mine' }, timestamp: 5, clientId: 1,
      };
      const recent: RecentEntry[] = [
        {
          op: { op: 'insert', path: ['nodes'], value: { id: 'n1', label: 'theirs' }, timestamp: 10, clientId: 2 },
          serverTs: 10, clientId: 2,
        },
      ];
      const result = detectConflict(incoming, recent);
      expect(result?.kind).toBe('insert-superseded');
      expect(result?.key).toBe('n1');
    });

    it('returns null when incoming insert has no id', () => {
      const incoming: CRDTOperation = {
        op: 'insert', path: ['misc'], value: 'plain', timestamp: 5, clientId: 1,
      };
      expect(detectConflict(incoming, [])).toBeNull();
    });

    it('returns null when incoming insert would win LWW', () => {
      const incoming: CRDTOperation = {
        op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 20, clientId: 1,
      };
      const recent: RecentEntry[] = [
        {
          op: { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 10, clientId: 2 },
          serverTs: 10, clientId: 2,
        },
      ];
      expect(detectConflict(incoming, recent)).toBeNull();
    });
  });

  describe('delete-rejected', () => {
    it('returns a conflict when a concurrent insert targets the deleted key', () => {
      const incoming: CRDTOperation = {
        op: 'delete', path: ['nodes'], key: 'n1', timestamp: 5, clientId: 1,
      };
      const recent: RecentEntry[] = [
        {
          op: { op: 'insert', path: ['nodes'], value: { id: 'n1', label: 'resurrected' }, timestamp: 10, clientId: 2 },
          serverTs: 10, clientId: 2,
        },
      ];
      const result = detectConflict(incoming, recent);
      expect(result?.kind).toBe('delete-rejected');
      expect(result?.key).toBe('n1');
      expect(result?.theirOp.op).toBe('insert');
    });

    it('returns null when no concurrent insert targets the deleted key', () => {
      const incoming: CRDTOperation = {
        op: 'delete', path: ['nodes'], key: 'n1', timestamp: 5, clientId: 1,
      };
      const recent: RecentEntry[] = [
        {
          op: { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'x' }, timestamp: 10, clientId: 2 },
          serverTs: 10, clientId: 2,
        },
      ];
      expect(detectConflict(incoming, recent)).toBeNull();
    });
  });
});
