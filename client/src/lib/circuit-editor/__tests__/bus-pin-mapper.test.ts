import { describe, it, expect, beforeEach, vi } from 'vitest';
import { busPinMapper } from '../bus-pin-mapper';
import type { BusDefinition } from '../bus-pin-mapper';

describe('BusPinMapper', () => {
  beforeEach(() => {
    busPinMapper.clearAll();
    localStorage.clear();
  });

  // ---------- Bus CRUD ----------

  describe('createBus', () => {
    it('creates a bus with the given name and width', () => {
      const bus = busPinMapper.createBus('data', 8);
      expect(bus.name).toBe('data');
      expect(bus.width).toBe(8);
      expect(bus.signals).toHaveLength(8);
      expect(bus.id).toBeTruthy();
    });

    it('initializes all signals as unmapped', () => {
      const bus = busPinMapper.createBus('address', 16);
      for (let i = 0; i < 16; i++) {
        expect(bus.signals[i].bitIndex).toBe(i);
        expect(bus.signals[i].signalName).toBeNull();
        expect(bus.signals[i].netId).toBeNull();
      }
    });

    it('trims whitespace from bus name', () => {
      const bus = busPinMapper.createBus('  data  ', 4);
      expect(bus.name).toBe('data');
    });

    it('throws on empty name', () => {
      expect(() => busPinMapper.createBus('', 8)).toThrow('Bus name cannot be empty');
    });

    it('throws on whitespace-only name', () => {
      expect(() => busPinMapper.createBus('   ', 8)).toThrow('Bus name cannot be empty');
    });

    it('throws on width < 1', () => {
      expect(() => busPinMapper.createBus('test', 0)).toThrow('Bus width must be an integer between 1 and 64');
    });

    it('throws on width > 64', () => {
      expect(() => busPinMapper.createBus('test', 65)).toThrow('Bus width must be an integer between 1 and 64');
    });

    it('throws on non-integer width', () => {
      expect(() => busPinMapper.createBus('test', 3.5)).toThrow('Bus width must be an integer between 1 and 64');
    });

    it('allows width of exactly 1', () => {
      const bus = busPinMapper.createBus('single', 1);
      expect(bus.width).toBe(1);
      expect(bus.signals).toHaveLength(1);
    });

    it('allows width of exactly 64', () => {
      const bus = busPinMapper.createBus('wide', 64);
      expect(bus.width).toBe(64);
      expect(bus.signals).toHaveLength(64);
    });

    it('throws on duplicate bus name (case-insensitive)', () => {
      busPinMapper.createBus('DATA', 8);
      expect(() => busPinMapper.createBus('data', 4)).toThrow('A bus named "DATA" already exists');
    });

    it('returns a deep copy (modifying return value does not affect internal state)', () => {
      const bus = busPinMapper.createBus('data', 4);
      bus.signals[0].signalName = 'mutated';
      const retrieved = busPinMapper.getBusById(bus.id);
      expect(retrieved?.signals[0].signalName).toBeNull();
    });
  });

  describe('deleteBus', () => {
    it('removes an existing bus', () => {
      const bus = busPinMapper.createBus('data', 8);
      busPinMapper.deleteBus(bus.id);
      expect(busPinMapper.getBusById(bus.id)).toBeNull();
    });

    it('is a no-op for non-existent bus ID', () => {
      busPinMapper.deleteBus('nonexistent'); // should not throw
      expect(busPinMapper.getBusDefinitions()).toEqual([]);
    });

    it('does not affect other buses', () => {
      const bus1 = busPinMapper.createBus('data', 8);
      const bus2 = busPinMapper.createBus('address', 16);
      busPinMapper.deleteBus(bus1.id);
      expect(busPinMapper.getBusById(bus2.id)).not.toBeNull();
    });
  });

  describe('getBusDefinitions', () => {
    it('returns empty array when no buses exist', () => {
      expect(busPinMapper.getBusDefinitions()).toEqual([]);
    });

    it('returns all buses', () => {
      busPinMapper.createBus('data', 8);
      busPinMapper.createBus('address', 16);
      const defs = busPinMapper.getBusDefinitions();
      expect(defs).toHaveLength(2);
      expect(defs.map((d) => d.name).sort()).toEqual(['address', 'data']);
    });

    it('returns deep copies', () => {
      busPinMapper.createBus('data', 4);
      const defs = busPinMapper.getBusDefinitions();
      defs[0].signals[0].signalName = 'mutated';
      const fresh = busPinMapper.getBusDefinitions();
      expect(fresh[0].signals[0].signalName).toBeNull();
    });
  });

  describe('getBusByName', () => {
    it('finds bus by exact name', () => {
      busPinMapper.createBus('data', 8);
      const found = busPinMapper.getBusByName('data');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('data');
    });

    it('finds bus case-insensitively', () => {
      busPinMapper.createBus('DATA', 8);
      expect(busPinMapper.getBusByName('data')).not.toBeNull();
      expect(busPinMapper.getBusByName('Data')).not.toBeNull();
    });

    it('returns null for non-existent name', () => {
      expect(busPinMapper.getBusByName('nonexistent')).toBeNull();
    });
  });

  describe('getBusById', () => {
    it('finds bus by ID', () => {
      const bus = busPinMapper.createBus('data', 8);
      const found = busPinMapper.getBusById(bus.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('data');
    });

    it('returns null for non-existent ID', () => {
      expect(busPinMapper.getBusById('no-such-id')).toBeNull();
    });
  });

  // ---------- Signal assignment ----------

  describe('assignSignal', () => {
    let bus: BusDefinition;

    beforeEach(() => {
      bus = busPinMapper.createBus('data', 8);
    });

    it('assigns a signal name and net ID to a bit', () => {
      busPinMapper.assignSignal(bus.id, 0, 'D0', 'net-1');
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[0].signalName).toBe('D0');
      expect(updated.signals[0].netId).toBe('net-1');
    });

    it('assigns without net ID', () => {
      busPinMapper.assignSignal(bus.id, 3, 'D3');
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[3].signalName).toBe('D3');
      expect(updated.signals[3].netId).toBeNull();
    });

    it('overwrites existing assignment', () => {
      busPinMapper.assignSignal(bus.id, 0, 'D0', 'net-1');
      busPinMapper.assignSignal(bus.id, 0, 'D0_new', 'net-2');
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[0].signalName).toBe('D0_new');
      expect(updated.signals[0].netId).toBe('net-2');
    });

    it('trims signal name whitespace', () => {
      busPinMapper.assignSignal(bus.id, 0, '  D0  ');
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[0].signalName).toBe('D0');
    });

    it('treats empty/whitespace-only signal name as null', () => {
      busPinMapper.assignSignal(bus.id, 0, '   ');
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[0].signalName).toBeNull();
    });

    it('throws on non-existent bus', () => {
      expect(() => busPinMapper.assignSignal('fake', 0, 'D0')).toThrow('Bus "fake" not found');
    });

    it('throws on negative bit index', () => {
      expect(() => busPinMapper.assignSignal(bus.id, -1, 'D0')).toThrow('out of range');
    });

    it('throws on bit index >= width', () => {
      expect(() => busPinMapper.assignSignal(bus.id, 8, 'D8')).toThrow('out of range');
    });

    it('throws on non-integer bit index', () => {
      expect(() => busPinMapper.assignSignal(bus.id, 1.5, 'D1')).toThrow('out of range');
    });
  });

  describe('unassignSignal', () => {
    let bus: BusDefinition;

    beforeEach(() => {
      bus = busPinMapper.createBus('data', 8);
      busPinMapper.assignSignal(bus.id, 0, 'D0', 'net-1');
    });

    it('clears a signal assignment', () => {
      busPinMapper.unassignSignal(bus.id, 0);
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[0].signalName).toBeNull();
      expect(updated.signals[0].netId).toBeNull();
    });

    it('preserves bitIndex after unassign', () => {
      busPinMapper.unassignSignal(bus.id, 0);
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[0].bitIndex).toBe(0);
    });

    it('is safe to call on an already-unmapped bit', () => {
      busPinMapper.unassignSignal(bus.id, 7); // bit 7 was never assigned
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[7].signalName).toBeNull();
    });

    it('throws on non-existent bus', () => {
      expect(() => busPinMapper.unassignSignal('fake', 0)).toThrow('Bus "fake" not found');
    });

    it('throws on out-of-range bit index', () => {
      expect(() => busPinMapper.unassignSignal(bus.id, 8)).toThrow('out of range');
    });
  });

  // ---------- Auto-assign ----------

  describe('autoAssignByPrefix', () => {
    let bus: BusDefinition;
    const nets = [
      { id: 'n0', name: 'D0' },
      { id: 'n1', name: 'D1' },
      { id: 'n2', name: 'D2' },
      { id: 'n3', name: 'D3' },
      { id: 'n4', name: 'D4' },
      { id: 'n5', name: 'D5' },
      { id: 'n6', name: 'D6' },
      { id: 'n7', name: 'D7' },
    ];

    beforeEach(() => {
      bus = busPinMapper.createBus('data', 8);
    });

    it('assigns D0–D7 to bits 0–7', () => {
      const count = busPinMapper.autoAssignByPrefix(bus.id, 'D', nets);
      expect(count).toBe(8);
      const updated = busPinMapper.getBusById(bus.id)!;
      for (let i = 0; i < 8; i++) {
        expect(updated.signals[i].signalName).toBe(`D${i}`);
        expect(updated.signals[i].netId).toBe(`n${i}`);
      }
    });

    it('handles address bus prefix A0–A15', () => {
      const addrBus = busPinMapper.createBus('address', 16);
      const addrNets = Array.from({ length: 16 }, (_, i) => ({
        id: `addr-${i}`,
        name: `A${i}`,
      }));
      const count = busPinMapper.autoAssignByPrefix(addrBus.id, 'A', addrNets);
      expect(count).toBe(16);
    });

    it('ignores nets that do not match the prefix', () => {
      const mixedNets = [
        { id: 'n0', name: 'D0' },
        { id: 'clk', name: 'CLK' },
        { id: 'gnd', name: 'GND' },
        { id: 'n1', name: 'D1' },
      ];
      const count = busPinMapper.autoAssignByPrefix(bus.id, 'D', mixedNets);
      expect(count).toBe(2);
    });

    it('skips nets with index out of bus range', () => {
      const bigNets = [
        { id: 'n0', name: 'D0' },
        { id: 'n99', name: 'D99' }, // Out of range for 8-bit bus
      ];
      const count = busPinMapper.autoAssignByPrefix(bus.id, 'D', bigNets);
      expect(count).toBe(1);
    });

    it('handles underscore separator (D_0, D_1)', () => {
      const underscoreNets = [
        { id: 'n0', name: 'D_0' },
        { id: 'n1', name: 'D_1' },
      ];
      const count = busPinMapper.autoAssignByPrefix(bus.id, 'D', underscoreNets);
      expect(count).toBe(2);
    });

    it('handles dash separator (D-0, D-1)', () => {
      const dashNets = [
        { id: 'n0', name: 'D-0' },
        { id: 'n3', name: 'D-3' },
      ];
      const count = busPinMapper.autoAssignByPrefix(bus.id, 'D', dashNets);
      expect(count).toBe(2);
    });

    it('is case-insensitive on prefix matching', () => {
      const lowerNets = [
        { id: 'n0', name: 'd0' },
        { id: 'n1', name: 'd1' },
      ];
      const count = busPinMapper.autoAssignByPrefix(bus.id, 'D', lowerNets);
      expect(count).toBe(2);
    });

    it('returns 0 for empty prefix', () => {
      expect(busPinMapper.autoAssignByPrefix(bus.id, '', nets)).toBe(0);
    });

    it('returns 0 for whitespace-only prefix', () => {
      expect(busPinMapper.autoAssignByPrefix(bus.id, '   ', nets)).toBe(0);
    });

    it('returns 0 when no nets match', () => {
      const unrelatedNets = [{ id: 'clk', name: 'CLK' }];
      expect(busPinMapper.autoAssignByPrefix(bus.id, 'D', unrelatedNets)).toBe(0);
    });

    it('throws on non-existent bus', () => {
      expect(() => busPinMapper.autoAssignByPrefix('fake', 'D', nets)).toThrow('Bus "fake" not found');
    });

    it('does not notify if nothing was assigned', () => {
      const listener = vi.fn();
      busPinMapper.subscribe(listener);
      listener.mockClear(); // clear createBus notification
      busPinMapper.autoAssignByPrefix(bus.id, 'Z', nets);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // ---------- Validation ----------

  describe('validateBus', () => {
    it('reports valid when all bits are mapped with unique names', () => {
      const bus = busPinMapper.createBus('data', 4);
      for (let i = 0; i < 4; i++) {
        busPinMapper.assignSignal(bus.id, i, `D${i}`, `net-${i}`);
      }
      const result = busPinMapper.validateBus(bus.id);
      expect(result.valid).toBe(true);
      expect(result.unmappedCount).toBe(0);
      expect(result.conflicts).toHaveLength(0);
      expect(result.gaps).toHaveLength(0);
    });

    it('reports gaps for unmapped bits', () => {
      const bus = busPinMapper.createBus('data', 4);
      busPinMapper.assignSignal(bus.id, 0, 'D0');
      busPinMapper.assignSignal(bus.id, 2, 'D2');
      // Bits 1 and 3 are gaps
      const result = busPinMapper.validateBus(bus.id);
      expect(result.valid).toBe(false);
      expect(result.unmappedCount).toBe(2);
      expect(result.gaps).toEqual([1, 3]);
    });

    it('reports all unmapped for fresh bus', () => {
      const bus = busPinMapper.createBus('data', 8);
      const result = busPinMapper.validateBus(bus.id);
      expect(result.valid).toBe(false);
      expect(result.unmappedCount).toBe(8);
      expect(result.gaps).toHaveLength(8);
    });

    it('detects duplicate signal names', () => {
      const bus = busPinMapper.createBus('data', 4);
      busPinMapper.assignSignal(bus.id, 0, 'D0', 'net-0');
      busPinMapper.assignSignal(bus.id, 1, 'D0', 'net-1'); // duplicate name
      busPinMapper.assignSignal(bus.id, 2, 'D2', 'net-2');
      busPinMapper.assignSignal(bus.id, 3, 'D3', 'net-3');
      const result = busPinMapper.validateBus(bus.id);
      expect(result.valid).toBe(false);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(result.conflicts[0].bitIndex).toBe(1);
      expect(result.conflicts[0].signalName).toBe('D0');
      expect(result.conflicts[0].conflictsWith).toContain('Duplicate signal name');
    });

    it('detects duplicate signal names case-insensitively', () => {
      const bus = busPinMapper.createBus('data', 2);
      busPinMapper.assignSignal(bus.id, 0, 'D0');
      busPinMapper.assignSignal(bus.id, 1, 'd0'); // same name, different case
      const result = busPinMapper.validateBus(bus.id);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
    });

    it('detects duplicate net IDs', () => {
      const bus = busPinMapper.createBus('data', 4);
      busPinMapper.assignSignal(bus.id, 0, 'D0', 'net-shared');
      busPinMapper.assignSignal(bus.id, 1, 'D1', 'net-shared'); // duplicate net
      busPinMapper.assignSignal(bus.id, 2, 'D2', 'net-2');
      busPinMapper.assignSignal(bus.id, 3, 'D3', 'net-3');
      const result = busPinMapper.validateBus(bus.id);
      expect(result.valid).toBe(false);
      expect(result.conflicts.some((c) => c.conflictsWith.includes('Duplicate net ID'))).toBe(true);
    });

    it('returns invalid result for non-existent bus', () => {
      const result = busPinMapper.validateBus('nonexistent');
      expect(result.valid).toBe(false);
    });
  });

  // ---------- Subscribe / version ----------

  describe('subscribe', () => {
    it('notifies on createBus', () => {
      const listener = vi.fn();
      busPinMapper.subscribe(listener);
      busPinMapper.createBus('data', 8);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on deleteBus', () => {
      const bus = busPinMapper.createBus('data', 8);
      const listener = vi.fn();
      busPinMapper.subscribe(listener);
      busPinMapper.deleteBus(bus.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on assignSignal', () => {
      const bus = busPinMapper.createBus('data', 8);
      const listener = vi.fn();
      busPinMapper.subscribe(listener);
      busPinMapper.assignSignal(bus.id, 0, 'D0');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on unassignSignal', () => {
      const bus = busPinMapper.createBus('data', 8);
      busPinMapper.assignSignal(bus.id, 0, 'D0');
      const listener = vi.fn();
      busPinMapper.subscribe(listener);
      busPinMapper.unassignSignal(bus.id, 0);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on clearAll', () => {
      busPinMapper.createBus('data', 8);
      const listener = vi.fn();
      busPinMapper.subscribe(listener);
      busPinMapper.clearAll();
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsub = busPinMapper.subscribe(listener);
      unsub();
      busPinMapper.createBus('data', 8);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      busPinMapper.subscribe(listener1);
      busPinMapper.subscribe(listener2);
      busPinMapper.createBus('data', 8);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });

  describe('version counter', () => {
    it('starts at a number', () => {
      expect(typeof busPinMapper.version).toBe('number');
    });

    it('increments on createBus', () => {
      const before = busPinMapper.version;
      busPinMapper.createBus('data', 8);
      expect(busPinMapper.version).toBe(before + 1);
    });

    it('increments on deleteBus', () => {
      const bus = busPinMapper.createBus('data', 8);
      const before = busPinMapper.version;
      busPinMapper.deleteBus(bus.id);
      expect(busPinMapper.version).toBe(before + 1);
    });

    it('increments on assignSignal', () => {
      const bus = busPinMapper.createBus('data', 8);
      const before = busPinMapper.version;
      busPinMapper.assignSignal(bus.id, 0, 'D0');
      expect(busPinMapper.version).toBe(before + 1);
    });

    it('increments on unassignSignal', () => {
      const bus = busPinMapper.createBus('data', 8);
      const before = busPinMapper.version;
      busPinMapper.unassignSignal(bus.id, 0);
      expect(busPinMapper.version).toBe(before + 1);
    });

    it('increments on clearAll', () => {
      busPinMapper.createBus('data', 8);
      const before = busPinMapper.version;
      busPinMapper.clearAll();
      expect(busPinMapper.version).toBe(before + 1);
    });
  });

  // ---------- localStorage persistence ----------

  describe('localStorage persistence', () => {
    it('persists buses to localStorage', () => {
      busPinMapper.createBus('data', 8);
      const stored = localStorage.getItem('protopulse:bus-pin-mapper');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as BusDefinition[];
      expect(parsed).toHaveLength(1);
      expect(parsed[0].name).toBe('data');
    });

    it('persists signal assignments', () => {
      const bus = busPinMapper.createBus('data', 4);
      busPinMapper.assignSignal(bus.id, 0, 'D0', 'net-0');
      const stored = localStorage.getItem('protopulse:bus-pin-mapper');
      const parsed = JSON.parse(stored!) as BusDefinition[];
      expect(parsed[0].signals[0].signalName).toBe('D0');
      expect(parsed[0].signals[0].netId).toBe('net-0');
    });

    it('clears localStorage on clearAll', () => {
      busPinMapper.createBus('data', 8);
      busPinMapper.clearAll();
      const stored = localStorage.getItem('protopulse:bus-pin-mapper');
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!) as BusDefinition[];
      expect(parsed).toHaveLength(0);
    });
  });

  // ---------- Edge cases ----------

  describe('edge cases', () => {
    it('supports single-bit bus', () => {
      const bus = busPinMapper.createBus('enable', 1);
      busPinMapper.assignSignal(bus.id, 0, 'EN', 'net-en');
      const result = busPinMapper.validateBus(bus.id);
      expect(result.valid).toBe(true);
    });

    it('allows creating multiple buses', () => {
      busPinMapper.createBus('data', 8);
      busPinMapper.createBus('address', 16);
      busPinMapper.createBus('control', 4);
      expect(busPinMapper.getBusDefinitions()).toHaveLength(3);
    });

    it('clearAll removes all buses', () => {
      busPinMapper.createBus('data', 8);
      busPinMapper.createBus('address', 16);
      busPinMapper.clearAll();
      expect(busPinMapper.getBusDefinitions()).toEqual([]);
    });

    it('autoAssign with multi-char prefix (GPIO)', () => {
      const bus = busPinMapper.createBus('gpio', 4);
      const gpioNets = [
        { id: 'g0', name: 'GPIO0' },
        { id: 'g1', name: 'GPIO1' },
        { id: 'g2', name: 'GPIO2' },
        { id: 'g3', name: 'GPIO3' },
      ];
      const count = busPinMapper.autoAssignByPrefix(bus.id, 'GPIO', gpioNets);
      expect(count).toBe(4);
      const updated = busPinMapper.getBusById(bus.id)!;
      expect(updated.signals[0].signalName).toBe('GPIO0');
    });
  });
});
