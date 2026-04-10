import { describe, it, expect } from 'vitest';
import { moveCursor, type CursorState } from '../useBreadboardCursor';

describe('breadboard cursor', () => {
  const initial: CursorState = { col: 'a', row: 1, active: true };

  describe('moveCursor', () => {
    it('moves down on ArrowDown', () => {
      const next = moveCursor(initial, 'ArrowDown');
      expect(next.row).toBe(2);
      expect(next.col).toBe('a');
    });

    it('moves up on ArrowUp', () => {
      const start: CursorState = { col: 'c', row: 10, active: true };
      const next = moveCursor(start, 'ArrowUp');
      expect(next.row).toBe(9);
      expect(next.col).toBe('c');
    });

    it('moves right on ArrowRight (a → b)', () => {
      const next = moveCursor(initial, 'ArrowRight');
      expect(next.col).toBe('b');
      expect(next.row).toBe(1);
    });

    it('moves left on ArrowLeft (b → a)', () => {
      const start: CursorState = { col: 'b', row: 5, active: true };
      const next = moveCursor(start, 'ArrowLeft');
      expect(next.col).toBe('a');
      expect(next.row).toBe(5);
    });

    it('crosses center channel (e → f on ArrowRight)', () => {
      const start: CursorState = { col: 'e', row: 3, active: true };
      const next = moveCursor(start, 'ArrowRight');
      expect(next.col).toBe('f');
    });

    it('crosses center channel (f → e on ArrowLeft)', () => {
      const start: CursorState = { col: 'f', row: 3, active: true };
      const next = moveCursor(start, 'ArrowLeft');
      expect(next.col).toBe('e');
    });

    it('clamps row at bottom edge', () => {
      const edge: CursorState = { col: 'a', row: 63, active: true };
      const next = moveCursor(edge, 'ArrowDown');
      expect(next.row).toBe(63);
    });

    it('clamps row at top edge', () => {
      const next = moveCursor(initial, 'ArrowUp');
      expect(next.row).toBe(1);
    });

    it('clamps column at left edge', () => {
      const next = moveCursor(initial, 'ArrowLeft');
      expect(next.col).toBe('a');
    });

    it('clamps column at right edge', () => {
      const edge: CursorState = { col: 'j', row: 1, active: true };
      const next = moveCursor(edge, 'ArrowRight');
      expect(next.col).toBe('j');
    });

    it('moves 5 rows on Shift+ArrowDown', () => {
      const next = moveCursor(initial, 'ArrowDown', true);
      expect(next.row).toBe(6);
    });

    it('moves 5 rows on Shift+ArrowUp', () => {
      const start: CursorState = { col: 'a', row: 20, active: true };
      const next = moveCursor(start, 'ArrowUp', true);
      expect(next.row).toBe(15);
    });

    it('moves 5 columns on Shift+ArrowRight', () => {
      const next = moveCursor(initial, 'ArrowRight', true);
      expect(next.col).toBe('f');
    });

    it('moves 5 columns on Shift+ArrowLeft', () => {
      const start: CursorState = { col: 'j', row: 1, active: true };
      const next = moveCursor(start, 'ArrowLeft', true);
      expect(next.col).toBe('e');
    });

    it('clamps Shift+ArrowDown at bottom edge', () => {
      const start: CursorState = { col: 'a', row: 61, active: true };
      const next = moveCursor(start, 'ArrowDown', true);
      expect(next.row).toBe(63);
    });

    it('clamps Shift+ArrowRight at right edge', () => {
      const start: CursorState = { col: 'h', row: 1, active: true };
      const next = moveCursor(start, 'ArrowRight', true);
      expect(next.col).toBe('j');
    });

    it('preserves active state', () => {
      const inactive: CursorState = { col: 'c', row: 5, active: false };
      const next = moveCursor(inactive, 'ArrowDown');
      expect(next.active).toBe(false);
    });

    it('returns same state for unrecognized key', () => {
      const next = moveCursor(initial, 'Space');
      expect(next).toEqual(initial);
    });

    it('navigates full column range a through j', () => {
      let state: CursorState = { col: 'a', row: 1, active: true };
      const visited: string[] = [state.col];
      for (let i = 0; i < 9; i++) {
        state = moveCursor(state, 'ArrowRight');
        visited.push(state.col);
      }
      expect(visited).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']);
    });
  });
});
