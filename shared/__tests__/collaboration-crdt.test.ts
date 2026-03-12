/**
 * Tests for CRDT merge helpers in shared/collaboration.ts (BL-0486).
 */

import { describe, it, expect } from 'vitest';
import type { CRDTOperation, MergeVerdict } from '../collaboration';
import {
  operationEntityKey,
  lwwWins,
  structuralMerge,
  lockKey,
} from '../collaboration';

/* ------------------------------------------------------------------ */
/*  operationEntityKey                                                  */
/* ------------------------------------------------------------------ */

describe('operationEntityKey', () => {
  it('should return entityType:entityId for delete ops', () => {
    const op: CRDTOperation = { op: 'delete', path: ['nodes'], key: 'abc-123' };
    expect(operationEntityKey(op)).toBe('nodes:abc-123');
  });

  it('should return entityType:entityId for update ops', () => {
    const op: CRDTOperation = { op: 'update', path: ['edges'], key: 'e1', value: { label: 'new' } };
    expect(operationEntityKey(op)).toBe('edges:e1');
  });

  it('should return null for insert ops (entity does not exist yet)', () => {
    const op: CRDTOperation = { op: 'insert', path: ['nodes'], value: { id: 'n1' } };
    expect(operationEntityKey(op)).toBeNull();
  });

  it('should return null for delete with empty path', () => {
    const op: CRDTOperation = { op: 'delete', path: [], key: '' };
    expect(operationEntityKey(op)).toBeNull();
  });

  it('should use the last path segment as entity type', () => {
    const op: CRDTOperation = { op: 'update', path: ['project', 'circuit', 'instances'], key: 'i5', value: {} };
    expect(operationEntityKey(op)).toBe('instances:i5');
  });
});

/* ------------------------------------------------------------------ */
/*  lwwWins                                                             */
/* ------------------------------------------------------------------ */

describe('lwwWins', () => {
  it('should return true when incoming timestamp is higher', () => {
    expect(lwwWins(10, 1, 20, 1)).toBe(true);
  });

  it('should return false when incoming timestamp is lower', () => {
    expect(lwwWins(20, 1, 10, 1)).toBe(false);
  });

  it('should break ties by higher clientId', () => {
    expect(lwwWins(10, 1, 10, 2)).toBe(true);  // client 2 > client 1
    expect(lwwWins(10, 2, 10, 1)).toBe(false); // client 1 < client 2
  });

  it('should return false when both timestamp and clientId are equal', () => {
    expect(lwwWins(10, 1, 10, 1)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  structuralMerge                                                     */
/* ------------------------------------------------------------------ */

describe('structuralMerge', () => {
  describe('insert operations', () => {
    it('should accept insert with no concurrent conflicts', () => {
      const op: CRDTOperation = { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 5, clientId: 1 };
      expect(structuralMerge(op, [])).toBe('accept');
    });

    it('should accept insert when concurrent ops are unrelated', () => {
      const op: CRDTOperation = { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 5, clientId: 1 };
      const concurrent: CRDTOperation[] = [
        { op: 'update', path: ['nodes'], key: 'n2', value: { label: 'x' } },
        { op: 'delete', path: ['edges'], key: 'e1' },
      ];
      expect(structuralMerge(op, concurrent)).toBe('accept');
    });

    it('should supersede insert when concurrent insert with same id has higher timestamp', () => {
      const op: CRDTOperation = { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 5, clientId: 1 };
      const concurrent: CRDTOperation[] = [
        { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 10, clientId: 2 },
      ];
      expect(structuralMerge(op, concurrent)).toBe('superseded');
    });

    it('should accept insert when it has higher timestamp than concurrent insert', () => {
      const op: CRDTOperation = { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 10, clientId: 1 };
      const concurrent: CRDTOperation[] = [
        { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 5, clientId: 2 },
      ];
      expect(structuralMerge(op, concurrent)).toBe('accept');
    });

    it('should use clientId tie-break for concurrent inserts with same timestamp', () => {
      const op: CRDTOperation = { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 10, clientId: 3 };
      const concurrent: CRDTOperation[] = [
        { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 10, clientId: 1 },
      ];
      // clientId 3 > clientId 1 → incoming wins
      expect(structuralMerge(op, concurrent)).toBe('accept');
    });

    it('should accept insert with no id in value', () => {
      const op: CRDTOperation = { op: 'insert', path: ['misc'], value: 'plain string', timestamp: 5, clientId: 1 };
      expect(structuralMerge(op, [])).toBe('accept');
    });
  });

  describe('delete operations', () => {
    it('should accept delete with no concurrent conflicts', () => {
      const op: CRDTOperation = { op: 'delete', path: ['nodes'], key: 'n1', timestamp: 5, clientId: 1 };
      expect(structuralMerge(op, [])).toBe('accept');
    });

    it('should reject delete when a concurrent insert targets the same key', () => {
      const op: CRDTOperation = { op: 'delete', path: ['nodes'], key: 'n1', timestamp: 5, clientId: 1 };
      const concurrent: CRDTOperation[] = [
        { op: 'insert', path: ['nodes'], value: { id: 'n1' }, timestamp: 3, clientId: 2 },
      ];
      // Insert wins over delete (intent-preserving: creation intent survives)
      expect(structuralMerge(op, concurrent)).toBe('reject');
    });

    it('should accept delete when concurrent insert targets a different key', () => {
      const op: CRDTOperation = { op: 'delete', path: ['nodes'], key: 'n1', timestamp: 5, clientId: 1 };
      const concurrent: CRDTOperation[] = [
        { op: 'insert', path: ['nodes'], value: { id: 'n2' }, timestamp: 3, clientId: 2 },
      ];
      expect(structuralMerge(op, concurrent)).toBe('accept');
    });

    it('should accept delete when concurrent ops are only updates', () => {
      const op: CRDTOperation = { op: 'delete', path: ['nodes'], key: 'n1', timestamp: 5, clientId: 1 };
      const concurrent: CRDTOperation[] = [
        { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'x' }, timestamp: 3, clientId: 2 },
      ];
      expect(structuralMerge(op, concurrent)).toBe('accept');
    });
  });

  describe('update operations', () => {
    it('should always accept update (LWW handled externally)', () => {
      const op: CRDTOperation = { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'x' }, timestamp: 5, clientId: 1 };
      expect(structuralMerge(op, [])).toBe('accept');
    });

    it('should accept update even with concurrent ops', () => {
      const op: CRDTOperation = { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'x' }, timestamp: 5, clientId: 1 };
      const concurrent: CRDTOperation[] = [
        { op: 'update', path: ['nodes'], key: 'n1', value: { label: 'y' }, timestamp: 10, clientId: 2 },
      ];
      // structuralMerge returns 'accept' for updates — LWW is checked at a higher level
      expect(structuralMerge(op, concurrent)).toBe('accept');
    });
  });
});

/* ------------------------------------------------------------------ */
/*  lockKey                                                             */
/* ------------------------------------------------------------------ */

describe('lockKey', () => {
  it('should join projectId, entityType, and entityId', () => {
    expect(lockKey(1, 'node', 'abc')).toBe('1:node:abc');
  });

  it('should handle string projectId', () => {
    expect(lockKey('42', 'edge', 'e1')).toBe('42:edge:e1');
  });
});
