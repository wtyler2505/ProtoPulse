import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  TeamCommandCenter,
  useTeamCommandCenter,
} from '../team-command-center';
import type {
  TeamMember,
  TeamActivity,
} from '../team-command-center';

// ---------------------------------------------------------------------------
// localStorage mock
// ---------------------------------------------------------------------------

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((_index: number) => null),
  };
}

// ---------------------------------------------------------------------------
// TeamCommandCenter
// ---------------------------------------------------------------------------

describe('TeamCommandCenter', () => {
  let center: TeamCommandCenter;
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    TeamCommandCenter.resetInstance();
    center = TeamCommandCenter.getInstance();
  });

  afterEach(() => {
    TeamCommandCenter.resetInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  it('returns the same instance on repeated calls', () => {
    const a = TeamCommandCenter.getInstance();
    const b = TeamCommandCenter.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetInstance', () => {
    center.addMember({ name: 'Alice', role: 'hardware' });
    TeamCommandCenter.resetInstance();
    const fresh = TeamCommandCenter.getInstance();
    // fresh instance loads from localStorage, so Alice should persist
    expect(fresh.getMemberCount()).toBe(1);
  });

  // -----------------------------------------------------------------------
  // addMember
  // -----------------------------------------------------------------------

  it('adds a member with generated ID', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    expect(member.id).toBeDefined();
    expect(member.name).toBe('Alice');
    expect(member.role).toBe('hardware');
    expect(member.online).toBe(false);
    expect(member.activeView).toBeUndefined();
    expect(member.lastSeen).toBeGreaterThan(0);
  });

  it('adds a member with optional fields', () => {
    const member = center.addMember({
      name: 'Bob',
      role: 'firmware',
      online: true,
      activeView: 'schematic',
    });
    expect(member.online).toBe(true);
    expect(member.activeView).toBe('schematic');
  });

  it('trims whitespace from member name', () => {
    const member = center.addMember({ name: '  Alice  ', role: 'hardware' });
    expect(member.name).toBe('Alice');
  });

  it('throws on empty name', () => {
    expect(() => {
      center.addMember({ name: '', role: 'hardware' });
    }).toThrow('Member name cannot be empty');
  });

  it('throws on whitespace-only name', () => {
    expect(() => {
      center.addMember({ name: '   ', role: 'hardware' });
    }).toThrow('Member name cannot be empty');
  });

  it('allows multiple members with the same name', () => {
    center.addMember({ name: 'Alice', role: 'hardware' });
    center.addMember({ name: 'Alice', role: 'firmware' });
    expect(center.getMemberCount()).toBe(2);
  });

  // -----------------------------------------------------------------------
  // removeMember
  // -----------------------------------------------------------------------

  it('removes an existing member', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    const result = center.removeMember(member.id);
    expect(result).toBe(true);
    expect(center.getMemberCount()).toBe(0);
  });

  it('returns false when removing non-existent member', () => {
    const result = center.removeMember('nonexistent-id');
    expect(result).toBe(false);
  });

  it('removes associated activities when removing a member', () => {
    const alice = center.addMember({ name: 'Alice', role: 'hardware' });
    const bob = center.addMember({ name: 'Bob', role: 'firmware' });
    center.logActivity({ memberId: alice.id, action: 'create', entityType: 'node' });
    center.logActivity({ memberId: bob.id, action: 'edit', entityType: 'wire' });
    center.removeMember(alice.id);
    const activities = center.getTeamActivities();
    expect(activities).toHaveLength(1);
    expect(activities[0].memberId).toBe(bob.id);
  });

  // -----------------------------------------------------------------------
  // updateMemberStatus
  // -----------------------------------------------------------------------

  it('updates online status', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    const updated = center.updateMemberStatus(member.id, { online: true });
    expect(updated?.online).toBe(true);
  });

  it('updates activeView', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    const updated = center.updateMemberStatus(member.id, { activeView: 'pcb' });
    expect(updated?.activeView).toBe('pcb');
  });

  it('clears activeView with null', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware', activeView: 'pcb' });
    const updated = center.updateMemberStatus(member.id, { activeView: null });
    expect(updated?.activeView).toBeUndefined();
  });

  it('returns undefined for unknown member', () => {
    const result = center.updateMemberStatus('nonexistent', { online: true });
    expect(result).toBeUndefined();
  });

  it('updates lastSeen on status change', () => {
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const member = center.addMember({ name: 'Alice', role: 'hardware' });

    vi.spyOn(Date, 'now').mockReturnValue(now + 5000);
    const updated = center.updateMemberStatus(member.id, { online: true });
    expect(updated?.lastSeen).toBe(now + 5000);
    vi.restoreAllMocks();
  });

  it('does not notify when nothing actually changes', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    const callback = vi.fn();
    center.subscribe(callback);
    callback.mockClear();

    // Setting online to false when already false — no change
    center.updateMemberStatus(member.id, { online: false });
    expect(callback).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // getMember / getAllMembers / getOnlineMembers
  // -----------------------------------------------------------------------

  it('getMember returns a copy', () => {
    const created = center.addMember({ name: 'Alice', role: 'hardware' });
    const fetched = center.getMember(created.id);
    expect(fetched).toEqual(created);
    // Mutating the returned copy must not affect internal state
    if (fetched) {
      fetched.name = 'Mutated';
    }
    expect(center.getMember(created.id)?.name).toBe('Alice');
  });

  it('getMember returns undefined for unknown ID', () => {
    expect(center.getMember('nonexistent')).toBeUndefined();
  });

  it('getAllMembers returns all members', () => {
    center.addMember({ name: 'Alice', role: 'hardware' });
    center.addMember({ name: 'Bob', role: 'firmware' });
    expect(center.getAllMembers()).toHaveLength(2);
  });

  it('getOnlineMembers returns only online members sorted by name', () => {
    center.addMember({ name: 'Zara', role: 'test', online: true });
    center.addMember({ name: 'Alice', role: 'hardware', online: true });
    center.addMember({ name: 'Bob', role: 'firmware', online: false });
    const online = center.getOnlineMembers();
    expect(online).toHaveLength(2);
    expect(online[0].name).toBe('Alice');
    expect(online[1].name).toBe('Zara');
  });

  // -----------------------------------------------------------------------
  // logActivity
  // -----------------------------------------------------------------------

  it('logs an activity', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    const activity = center.logActivity({
      memberId: member.id,
      action: 'create',
      entityType: 'node',
      entityId: 'node-123',
    });
    expect(activity.id).toBeDefined();
    expect(activity.memberId).toBe(member.id);
    expect(activity.action).toBe('create');
    expect(activity.entityType).toBe('node');
    expect(activity.entityId).toBe('node-123');
    expect(activity.timestamp).toBeGreaterThan(0);
  });

  it('throws when logging activity for unknown member', () => {
    expect(() => {
      center.logActivity({ memberId: 'unknown', action: 'create', entityType: 'node' });
    }).toThrow('Unknown member: unknown');
  });

  it('enforces max activities limit', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    const baseTime = Date.now();
    const dateSpy = vi.spyOn(Date, 'now');

    // Add just enough to exceed the 500 limit — 505 to confirm trimming
    for (let i = 0; i < 505; i++) {
      dateSpy.mockReturnValue(baseTime + i);
      center.logActivity({ memberId: member.id, action: 'edit', entityType: 'wire' });
    }

    // Should be capped at 500
    const all = center.getTeamActivities(1000);
    expect(all.length).toBeLessThanOrEqual(500);
    vi.restoreAllMocks();
  }, 30000);

  // -----------------------------------------------------------------------
  // getTeamActivities
  // -----------------------------------------------------------------------

  it('returns activities sorted newest first', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    const dateSpy = vi.spyOn(Date, 'now');
    const base = 1000000;

    dateSpy.mockReturnValue(base);
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    dateSpy.mockReturnValue(base + 1000);
    center.logActivity({ memberId: member.id, action: 'edit', entityType: 'wire' });

    const activities = center.getTeamActivities();
    expect(activities[0].action).toBe('edit');
    expect(activities[1].action).toBe('create');
    vi.restoreAllMocks();
  });

  it('respects limit parameter', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    for (let i = 0; i < 10; i++) {
      center.logActivity({ memberId: member.id, action: `action-${i}`, entityType: 'node' });
    }
    expect(center.getTeamActivities(3)).toHaveLength(3);
  });

  it('handles limit of 0', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    expect(center.getTeamActivities(0)).toHaveLength(0);
  });

  it('handles negative limit gracefully', () => {
    const member = center.addMember({ name: 'Alice', role: 'hardware' });
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    expect(center.getTeamActivities(-1)).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // getActiveViewDistribution
  // -----------------------------------------------------------------------

  it('computes view distribution for online members only', () => {
    center.addMember({ name: 'Alice', role: 'hw', online: true, activeView: 'schematic' });
    center.addMember({ name: 'Bob', role: 'fw', online: true, activeView: 'schematic' });
    center.addMember({ name: 'Charlie', role: 'test', online: true, activeView: 'pcb' });
    center.addMember({ name: 'Diana', role: 'test', online: false, activeView: 'pcb' });

    const dist = center.getActiveViewDistribution();
    expect(dist['schematic']).toBe(2);
    expect(dist['pcb']).toBe(1);
    // Diana is offline, so pcb should only count once
  });

  it('counts members with no activeView under "(none)"', () => {
    center.addMember({ name: 'Alice', role: 'hw', online: true });
    const dist = center.getActiveViewDistribution();
    expect(dist['(none)']).toBe(1);
  });

  it('returns empty record when no members are online', () => {
    center.addMember({ name: 'Alice', role: 'hw', online: false });
    const dist = center.getActiveViewDistribution();
    expect(Object.keys(dist)).toHaveLength(0);
  });

  // -----------------------------------------------------------------------
  // getTeamProductivity
  // -----------------------------------------------------------------------

  it('computes productivity metrics within a time range', () => {
    const alice = center.addMember({ name: 'Alice', role: 'hw' });
    const bob = center.addMember({ name: 'Bob', role: 'fw' });
    const base = 1000000;
    const dateSpy = vi.spyOn(Date, 'now');

    dateSpy.mockReturnValue(base + 100);
    center.logActivity({ memberId: alice.id, action: 'create', entityType: 'node' });
    dateSpy.mockReturnValue(base + 200);
    center.logActivity({ memberId: alice.id, action: 'edit', entityType: 'node' });
    dateSpy.mockReturnValue(base + 300);
    center.logActivity({ memberId: bob.id, action: 'create', entityType: 'wire' });

    const metrics = center.getTeamProductivity({ start: base, end: base + 500 });
    expect(metrics.totalActivities).toBe(3);
    expect(metrics.activeMemberCount).toBe(2);
    expect(metrics.activitiesPerMember).toBeCloseTo(1.5);
    expect(metrics.topContributor?.name).toBe('Alice');
    expect(metrics.topContributor?.count).toBe(2);
    expect(metrics.activityBreakdown['create']).toBe(2);
    expect(metrics.activityBreakdown['edit']).toBe(1);
    expect(metrics.entityTypeBreakdown['node']).toBe(2);
    expect(metrics.entityTypeBreakdown['wire']).toBe(1);

    vi.restoreAllMocks();
  });

  it('returns zero metrics for empty time range', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });

    // Time range that doesn't overlap
    const metrics = center.getTeamProductivity({ start: 0, end: 1 });
    expect(metrics.totalActivities).toBe(0);
    expect(metrics.activeMemberCount).toBe(0);
    expect(metrics.activitiesPerMember).toBe(0);
    expect(metrics.topContributor).toBeNull();
  });

  it('excludes activities outside the time range', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    const dateSpy = vi.spyOn(Date, 'now');

    dateSpy.mockReturnValue(100);
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    dateSpy.mockReturnValue(500);
    center.logActivity({ memberId: member.id, action: 'edit', entityType: 'wire' });
    dateSpy.mockReturnValue(900);
    center.logActivity({ memberId: member.id, action: 'delete', entityType: 'node' });

    const metrics = center.getTeamProductivity({ start: 200, end: 600 });
    expect(metrics.totalActivities).toBe(1);
    expect(metrics.activityBreakdown['edit']).toBe(1);
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // clearActivities / clearAll
  // -----------------------------------------------------------------------

  it('clearActivities empties activities but keeps members', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    center.clearActivities();
    expect(center.getTeamActivities()).toHaveLength(0);
    expect(center.getMemberCount()).toBe(1);
  });

  it('clearActivities is safe when already empty', () => {
    const callback = vi.fn();
    center.subscribe(callback);
    center.clearActivities();
    expect(callback).not.toHaveBeenCalled();
  });

  it('clearAll empties both members and activities', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    center.clearAll();
    expect(center.getMemberCount()).toBe(0);
    expect(center.getTeamActivities()).toHaveLength(0);
  });

  it('clearAll is safe when already empty', () => {
    const callback = vi.fn();
    center.subscribe(callback);
    center.clearAll();
    expect(callback).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // localStorage persistence
  // -----------------------------------------------------------------------

  it('persists to localStorage on addMember', () => {
    center.addMember({ name: 'Alice', role: 'hw' });
    expect(mockStorage.setItem).toHaveBeenCalledWith(
      'protopulse-team-command-center',
      expect.any(String),
    );
  });

  it('persists to localStorage on logActivity', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    vi.mocked(mockStorage.setItem).mockClear();
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    expect(mockStorage.setItem).toHaveBeenCalled();
  });

  it('loads members and activities from localStorage on init', () => {
    const members: TeamMember[] = [
      { id: 'a1', name: 'Alice', role: 'hw', online: true, lastSeen: Date.now() },
    ];
    const activities: TeamActivity[] = [
      { id: 'act1', memberId: 'a1', action: 'create', entityType: 'node', timestamp: Date.now() },
    ];
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify({ members, activities }));

    TeamCommandCenter.resetInstance();
    const loaded = TeamCommandCenter.getInstance();
    expect(loaded.getMember('a1')?.name).toBe('Alice');
    expect(loaded.getTeamActivities()).toHaveLength(1);
  });

  it('handles corrupt localStorage gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('not valid json{{{');
    TeamCommandCenter.resetInstance();
    const loaded = TeamCommandCenter.getInstance();
    expect(loaded.getMemberCount()).toBe(0);
    expect(loaded.getTeamActivities()).toHaveLength(0);
  });

  it('handles non-object localStorage data gracefully', () => {
    vi.mocked(mockStorage.getItem).mockReturnValue('"just a string"');
    TeamCommandCenter.resetInstance();
    const loaded = TeamCommandCenter.getInstance();
    expect(loaded.getMemberCount()).toBe(0);
  });

  it('filters out invalid members from localStorage', () => {
    const data = {
      members: [
        { id: 'a1', name: 'Alice', role: 'hw', online: true, lastSeen: 123 },
        { invalid: true }, // missing required fields
        { id: 'b1', name: 'Bob', role: 'fw', online: false, lastSeen: 456 },
      ],
      activities: [],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    TeamCommandCenter.resetInstance();
    const loaded = TeamCommandCenter.getInstance();
    expect(loaded.getMemberCount()).toBe(2);
  });

  it('filters out invalid activities from localStorage', () => {
    const data = {
      members: [],
      activities: [
        { id: 'act1', memberId: 'a1', action: 'create', entityType: 'node', timestamp: 123 },
        { bad: true },
        { id: 'act2', memberId: 'a1', action: 'edit', entityType: 'wire', timestamp: 456 },
      ],
    };
    vi.mocked(mockStorage.getItem).mockReturnValue(JSON.stringify(data));
    TeamCommandCenter.resetInstance();
    const loaded = TeamCommandCenter.getInstance();
    expect(loaded.getTeamActivities()).toHaveLength(2);
  });

  // -----------------------------------------------------------------------
  // Subscribe / unsubscribe
  // -----------------------------------------------------------------------

  it('calls subscriber on addMember', () => {
    const callback = vi.fn();
    center.subscribe(callback);
    center.addMember({ name: 'Alice', role: 'hw' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on removeMember', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    const callback = vi.fn();
    center.subscribe(callback);
    center.removeMember(member.id);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on logActivity', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    const callback = vi.fn();
    center.subscribe(callback);
    center.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('calls subscriber on updateMemberStatus', () => {
    const member = center.addMember({ name: 'Alice', role: 'hw' });
    const callback = vi.fn();
    center.subscribe(callback);
    center.updateMemberStatus(member.id, { online: true });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('does not call subscriber after unsubscribe', () => {
    const callback = vi.fn();
    const unsub = center.subscribe(callback);
    unsub();
    center.addMember({ name: 'Alice', role: 'hw' });
    expect(callback).not.toHaveBeenCalled();
  });

  it('does not notify on removeMember of non-existent', () => {
    const callback = vi.fn();
    center.subscribe(callback);
    center.removeMember('nonexistent');
    expect(callback).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

describe('useTeamCommandCenter', () => {
  let mockStorage: Storage;

  beforeEach(() => {
    mockStorage = createMockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      writable: true,
      configurable: true,
    });
    TeamCommandCenter.resetInstance();
  });

  afterEach(() => {
    TeamCommandCenter.resetInstance();
  });

  it('returns initial empty state', () => {
    const { result } = renderHook(() => useTeamCommandCenter());
    expect(result.current.members).toEqual([]);
    expect(result.current.onlineMembers).toEqual([]);
    expect(result.current.activities).toEqual([]);
    expect(result.current.memberCount).toBe(0);
    expect(result.current.viewDistribution).toEqual({});
  });

  it('adds a member via hook', () => {
    const { result } = renderHook(() => useTeamCommandCenter());
    act(() => {
      result.current.addMember({ name: 'Alice', role: 'hardware' });
    });
    expect(result.current.members).toHaveLength(1);
    expect(result.current.memberCount).toBe(1);
  });

  it('removes a member via hook', () => {
    const { result } = renderHook(() => useTeamCommandCenter());
    let memberId = '';
    act(() => {
      const member = result.current.addMember({ name: 'Alice', role: 'hardware' });
      memberId = member.id;
    });
    act(() => {
      result.current.removeMember(memberId);
    });
    expect(result.current.members).toHaveLength(0);
  });

  it('updates member status via hook', () => {
    const { result } = renderHook(() => useTeamCommandCenter());
    let memberId = '';
    act(() => {
      const member = result.current.addMember({ name: 'Alice', role: 'hw', online: false });
      memberId = member.id;
    });
    act(() => {
      result.current.updateMemberStatus(memberId, { online: true, activeView: 'pcb' });
    });
    expect(result.current.onlineMembers).toHaveLength(1);
    expect(result.current.viewDistribution).toEqual({ pcb: 1 });
  });

  it('logs activity via hook', () => {
    const { result } = renderHook(() => useTeamCommandCenter());
    let memberId = '';
    act(() => {
      const member = result.current.addMember({ name: 'Alice', role: 'hw' });
      memberId = member.id;
    });
    act(() => {
      result.current.logActivity({ memberId, action: 'create', entityType: 'node' });
    });
    expect(result.current.activities).toHaveLength(1);
  });

  it('computes productivity via hook', () => {
    const { result } = renderHook(() => useTeamCommandCenter());
    let memberId = '';
    act(() => {
      const member = result.current.addMember({ name: 'Alice', role: 'hw' });
      memberId = member.id;
    });
    act(() => {
      result.current.logActivity({ memberId, action: 'create', entityType: 'node' });
    });
    const metrics = result.current.getTeamProductivity({
      start: 0,
      end: Date.now() + 10000,
    });
    expect(metrics.totalActivities).toBe(1);
    expect(metrics.topContributor?.name).toBe('Alice');
  });

  it('clearAll resets everything via hook', () => {
    const { result } = renderHook(() => useTeamCommandCenter());
    act(() => {
      const member = result.current.addMember({ name: 'Alice', role: 'hw' });
      result.current.logActivity({ memberId: member.id, action: 'create', entityType: 'node' });
    });
    act(() => {
      result.current.clearAll();
    });
    expect(result.current.members).toEqual([]);
    expect(result.current.activities).toEqual([]);
    expect(result.current.memberCount).toBe(0);
  });

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useTeamCommandCenter());
    unmount();
    // Should not throw when center notifies after unmount
    expect(() => {
      TeamCommandCenter.getInstance().addMember({ name: 'Alice', role: 'hw' });
    }).not.toThrow();
  });
});
