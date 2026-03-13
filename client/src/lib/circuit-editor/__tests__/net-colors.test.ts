import { describe, it, expect, beforeEach, vi } from 'vitest';
import { netColorManager } from '../net-colors';

describe('NetColorManager', () => {
  beforeEach(() => {
    netColorManager.clearAll();
    localStorage.clear();
  });

  describe('setNetColor / getNetColor', () => {
    it('stores and retrieves a custom color for a net', () => {
      netColorManager.setNetColor(1, '#ff0000');
      expect(netColorManager.getNetColor(1)).toBe('#ff0000');
    });

    it('returns undefined for nets without custom color', () => {
      expect(netColorManager.getNetColor(999)).toBeUndefined();
    });

    it('overwrites existing custom color', () => {
      netColorManager.setNetColor(1, '#ff0000');
      netColorManager.setNetColor(1, '#00ff00');
      expect(netColorManager.getNetColor(1)).toBe('#00ff00');
    });
  });

  describe('clearNetColor', () => {
    it('removes a custom color assignment', () => {
      netColorManager.setNetColor(1, '#ff0000');
      netColorManager.clearNetColor(1);
      expect(netColorManager.getNetColor(1)).toBeUndefined();
    });

    it('is a no-op for nets without custom color', () => {
      netColorManager.clearNetColor(999); // should not throw
      expect(netColorManager.getNetColor(999)).toBeUndefined();
    });
  });

  describe('getDefaultColor', () => {
    it('returns red for power nets', () => {
      expect(netColorManager.getDefaultColor('power')).toBe('#ef4444');
    });

    it('returns green for ground nets', () => {
      expect(netColorManager.getDefaultColor('ground')).toBe('#22c55e');
    });

    it('returns cyan for signal nets', () => {
      expect(netColorManager.getDefaultColor('signal')).toBe('#06b6d4');
    });

    it('returns purple for bus nets', () => {
      expect(netColorManager.getDefaultColor('bus')).toBe('#a855f7');
    });
  });

  describe('resolveColor', () => {
    it('returns custom color when set', () => {
      netColorManager.setNetColor(1, '#abcdef');
      expect(netColorManager.resolveColor(1, 'signal')).toBe('#abcdef');
    });

    it('falls back to default when no custom color', () => {
      expect(netColorManager.resolveColor(1, 'power')).toBe('#ef4444');
    });
  });

  describe('getAllColors', () => {
    it('returns empty array when no custom colors', () => {
      expect(netColorManager.getAllColors()).toEqual([]);
    });

    it('returns all custom color entries', () => {
      netColorManager.setNetColor(1, '#ff0000');
      netColorManager.setNetColor(2, '#00ff00');
      const all = netColorManager.getAllColors();
      expect(all).toHaveLength(2);
      expect(all).toContainEqual({ netId: 1, color: '#ff0000' });
      expect(all).toContainEqual({ netId: 2, color: '#00ff00' });
    });
  });

  describe('clearAll', () => {
    it('removes all custom colors', () => {
      netColorManager.setNetColor(1, '#ff0000');
      netColorManager.setNetColor(2, '#00ff00');
      netColorManager.clearAll();
      expect(netColorManager.getAllColors()).toEqual([]);
    });
  });

  describe('subscribe', () => {
    it('notifies listeners on setNetColor', () => {
      const listener = vi.fn();
      netColorManager.subscribe(listener);
      netColorManager.setNetColor(1, '#ff0000');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clearNetColor', () => {
      const listener = vi.fn();
      netColorManager.subscribe(listener);
      netColorManager.clearNetColor(1);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies listeners on clearAll', () => {
      const listener = vi.fn();
      netColorManager.subscribe(listener);
      netColorManager.clearAll();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = netColorManager.subscribe(listener);
      unsub();
      netColorManager.setNetColor(1, '#ff0000');
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('localStorage persistence', () => {
    it('persists colors to localStorage', () => {
      netColorManager.setNetColor(1, '#ff0000');
      const stored = localStorage.getItem('protopulse:net-colors');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as Array<[number, string]>;
      expect(parsed).toContainEqual([1, '#ff0000']);
    });

    it('clears localStorage on clearAll', () => {
      netColorManager.setNetColor(1, '#ff0000');
      netColorManager.clearAll();
      const stored = localStorage.getItem('protopulse:net-colors');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as Array<[number, string]>;
      expect(parsed).toHaveLength(0);
    });
  });
});
