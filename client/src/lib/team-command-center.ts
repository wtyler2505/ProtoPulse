/**
 * Team Command Center
 *
 * Manages team members, tracks activity, and computes productivity metrics
 * for collaborative ProtoPulse sessions. Provides real-time view distribution,
 * online status tracking, and configurable activity history.
 *
 * Usage:
 *   const center = TeamCommandCenter.getInstance();
 *   center.addMember({ name: 'Alice', role: 'hardware' });
 *   center.updateMemberStatus(memberId, { online: true, activeView: 'schematic' });
 *   center.getTeamProductivity({ start: Date.now() - 3600000, end: Date.now() });
 *
 * React hook:
 *   const { members, onlineMembers, activities, addMember, ... } = useTeamCommandCenter();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamMember {
  id: string;
  name: string;
  role: string;
  online: boolean;
  activeView?: string;
  lastSeen: number;
}

export interface TeamActivity {
  id: string;
  memberId: string;
  action: string;
  entityType: string;
  entityId?: string;
  timestamp: number;
}

export interface AddMemberInput {
  name: string;
  role: string;
  online?: boolean;
  activeView?: string;
}

export interface UpdateMemberStatusInput {
  online?: boolean;
  activeView?: string | null;
}

export interface LogActivityInput {
  memberId: string;
  action: string;
  entityType: string;
  entityId?: string;
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface TeamProductivityMetrics {
  totalActivities: number;
  activeMemberCount: number;
  activitiesPerMember: number;
  topContributor: { memberId: string; name: string; count: number } | null;
  activityBreakdown: Record<string, number>;
  entityTypeBreakdown: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-team-command-center';
const MAX_ACTIVITIES = 500;
const DEFAULT_ACTIVITY_LIMIT = 50;

// ---------------------------------------------------------------------------
// TeamCommandCenter
// ---------------------------------------------------------------------------

/**
 * Manages team members and their activities within a ProtoPulse session.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class TeamCommandCenter {
  private static instance: TeamCommandCenter | null = null;

  private members: Map<string, TeamMember>;
  private activities: TeamActivity[];
  private subscribers: Set<() => void>;

  constructor() {
    this.members = new Map();
    this.activities = [];
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): TeamCommandCenter {
    if (!TeamCommandCenter.instance) {
      TeamCommandCenter.instance = new TeamCommandCenter();
    }
    return TeamCommandCenter.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    TeamCommandCenter.instance = null;
  }

  // -----------------------------------------------------------------------
  // Member Queries
  // -----------------------------------------------------------------------

  /** Get a member by ID. Returns undefined if not found. */
  getMember(id: string): TeamMember | undefined {
    const member = this.members.get(id);
    return member ? { ...member } : undefined;
  }

  /** Get all members as an array. Returns copies to prevent external mutation. */
  getAllMembers(): TeamMember[] {
    return Array.from(this.members.values()).map((m) => ({ ...m }));
  }

  /** Get only online members, sorted by name. */
  getOnlineMembers(): TeamMember[] {
    return this.getAllMembers()
      .filter((m) => m.online)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Get the total number of members. */
  getMemberCount(): number {
    return this.members.size;
  }

  // -----------------------------------------------------------------------
  // Activity Queries
  // -----------------------------------------------------------------------

  /**
   * Get recent activities, sorted by timestamp descending (newest first).
   * @param limit Max number of activities to return (default 50).
   */
  getTeamActivities(limit: number = DEFAULT_ACTIVITY_LIMIT): TeamActivity[] {
    return [...this.activities]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.max(0, limit))
      .map((a) => ({ ...a }));
  }

  /**
   * Compute a distribution of active views among online members.
   * Returns a map of view name -> number of online members on that view.
   * Members with no activeView are counted under '(none)'.
   */
  getActiveViewDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};
    for (const member of Array.from(this.members.values())) {
      if (!member.online) {
        continue;
      }
      const view = member.activeView ?? '(none)';
      distribution[view] = (distribution[view] ?? 0) + 1;
    }
    return distribution;
  }

  /**
   * Compute team productivity metrics for a given time range.
   * Analyzes activities within [start, end] to produce aggregate metrics.
   */
  getTeamProductivity(timeRange: TimeRange): TeamProductivityMetrics {
    const { start, end } = timeRange;
    const rangeActivities = this.activities.filter(
      (a) => a.timestamp >= start && a.timestamp <= end,
    );

    // Count activities per member
    const perMember = new Map<string, number>();
    const activityBreakdown: Record<string, number> = {};
    const entityTypeBreakdown: Record<string, number> = {};

    for (const activity of rangeActivities) {
      perMember.set(activity.memberId, (perMember.get(activity.memberId) ?? 0) + 1);
      activityBreakdown[activity.action] = (activityBreakdown[activity.action] ?? 0) + 1;
      entityTypeBreakdown[activity.entityType] = (entityTypeBreakdown[activity.entityType] ?? 0) + 1;
    }

    const activeMemberCount = perMember.size;
    const totalActivities = rangeActivities.length;
    const activitiesPerMember = activeMemberCount > 0 ? totalActivities / activeMemberCount : 0;

    // Find top contributor
    let topContributor: TeamProductivityMetrics['topContributor'] = null;
    if (activeMemberCount > 0) {
      let maxCount = 0;
      let maxMemberId = '';
      for (const [memberId, count] of Array.from(perMember.entries())) {
        if (count > maxCount) {
          maxCount = count;
          maxMemberId = memberId;
        }
      }
      const topMember = this.members.get(maxMemberId);
      topContributor = {
        memberId: maxMemberId,
        name: topMember?.name ?? 'Unknown',
        count: maxCount,
      };
    }

    return {
      totalActivities,
      activeMemberCount,
      activitiesPerMember,
      topContributor,
      activityBreakdown,
      entityTypeBreakdown,
    };
  }

  // -----------------------------------------------------------------------
  // Member Mutations
  // -----------------------------------------------------------------------

  /**
   * Add a new team member. Returns the created member with a generated ID.
   * @throws Error if name is empty or blank.
   */
  addMember(input: AddMemberInput): TeamMember {
    const trimmedName = input.name.trim();
    if (trimmedName.length === 0) {
      throw new Error('Member name cannot be empty');
    }

    const id = crypto.randomUUID();
    const member: TeamMember = {
      id,
      name: trimmedName,
      role: input.role,
      online: input.online ?? false,
      activeView: input.activeView,
      lastSeen: Date.now(),
    };

    this.members.set(id, member);
    this.save();
    this.notify();
    return { ...member };
  }

  /**
   * Remove a team member by ID. Also removes their activities.
   * Returns true if the member was found and removed, false otherwise.
   */
  removeMember(id: string): boolean {
    if (!this.members.has(id)) {
      return false;
    }

    this.members.delete(id);
    this.activities = this.activities.filter((a) => a.memberId !== id);
    this.save();
    this.notify();
    return true;
  }

  /**
   * Update a member's online status and/or active view.
   * Automatically updates lastSeen timestamp when going online.
   * Returns the updated member, or undefined if not found.
   */
  updateMemberStatus(id: string, status: UpdateMemberStatusInput): TeamMember | undefined {
    const member = this.members.get(id);
    if (!member) {
      return undefined;
    }

    let changed = false;

    if (status.online !== undefined && status.online !== member.online) {
      member.online = status.online;
      if (status.online) {
        member.lastSeen = Date.now();
      }
      changed = true;
    }

    if (status.activeView !== undefined) {
      const newView = status.activeView === null ? undefined : status.activeView;
      if (newView !== member.activeView) {
        member.activeView = newView;
        changed = true;
      }
    }

    if (changed) {
      member.lastSeen = Date.now();
      this.save();
      this.notify();
    }

    return { ...member };
  }

  // -----------------------------------------------------------------------
  // Activity Mutations
  // -----------------------------------------------------------------------

  /**
   * Log a team activity. Enforces MAX_ACTIVITIES by trimming oldest entries.
   * @throws Error if the memberId does not reference a known member.
   */
  logActivity(input: LogActivityInput): TeamActivity {
    if (!this.members.has(input.memberId)) {
      throw new Error(`Unknown member: ${input.memberId}`);
    }

    const activity: TeamActivity = {
      id: crypto.randomUUID(),
      memberId: input.memberId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      timestamp: Date.now(),
    };

    this.activities.push(activity);

    // Enforce max limit — trim oldest
    if (this.activities.length > MAX_ACTIVITIES) {
      this.activities.sort((a, b) => b.timestamp - a.timestamp);
      this.activities = this.activities.slice(0, MAX_ACTIVITIES);
    }

    this.save();
    this.notify();
    return { ...activity };
  }

  /** Clear all activities (does not remove members). */
  clearActivities(): void {
    if (this.activities.length === 0) {
      return;
    }
    this.activities = [];
    this.save();
    this.notify();
  }

  /** Remove all members and activities. */
  clearAll(): void {
    if (this.members.size === 0 && this.activities.length === 0) {
      return;
    }
    this.members.clear();
    this.activities = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever members or activities change.
   */
  subscribe(callback: () => void): () => void {
    this.subscribers.add(callback);
    return () => {
      this.subscribers.delete(callback);
    };
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data = {
        members: Array.from(this.members.values()),
        activities: this.activities,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load state from localStorage. */
  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as { members?: unknown; activities?: unknown };

      // Validate and load members
      if (Array.isArray(data.members)) {
        for (const item of data.members) {
          if (this.isValidMember(item)) {
            this.members.set(item.id, item);
          }
        }
      }

      // Validate and load activities
      if (Array.isArray(data.activities)) {
        this.activities = data.activities.filter(
          (item: unknown): item is TeamActivity => this.isValidActivity(item),
        );
      }
    } catch {
      // Corrupt data — start fresh
      this.members.clear();
      this.activities = [];
    }
  }

  // -----------------------------------------------------------------------
  // Validation helpers
  // -----------------------------------------------------------------------

  private isValidMember(item: unknown): item is TeamMember {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.name === 'string' &&
      typeof obj.role === 'string' &&
      typeof obj.online === 'boolean' &&
      typeof obj.lastSeen === 'number'
    );
  }

  private isValidActivity(item: unknown): item is TeamActivity {
    if (typeof item !== 'object' || item === null) {
      return false;
    }
    const obj = item as Record<string, unknown>;
    return (
      typeof obj.id === 'string' &&
      typeof obj.memberId === 'string' &&
      typeof obj.action === 'string' &&
      typeof obj.entityType === 'string' &&
      typeof obj.timestamp === 'number'
    );
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Notify all subscribers of a state change. */
  private notify(): void {
    this.subscribers.forEach((cb) => {
      cb();
    });
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the team command center in React components.
 * Subscribes to the TeamCommandCenter and triggers re-renders on state changes.
 * Safe for SSR (checks typeof window).
 */
export function useTeamCommandCenter(): {
  members: TeamMember[];
  onlineMembers: TeamMember[];
  activities: TeamActivity[];
  viewDistribution: Record<string, number>;
  memberCount: number;
  addMember: (input: AddMemberInput) => TeamMember;
  removeMember: (id: string) => boolean;
  updateMemberStatus: (id: string, status: UpdateMemberStatusInput) => TeamMember | undefined;
  logActivity: (input: LogActivityInput) => TeamActivity;
  getTeamProductivity: (timeRange: TimeRange) => TeamProductivityMetrics;
  clearActivities: () => void;
  clearAll: () => void;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const center = TeamCommandCenter.getInstance();
    const unsubscribe = center.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const addMember = useCallback((input: AddMemberInput) => {
    return TeamCommandCenter.getInstance().addMember(input);
  }, []);

  const removeMember = useCallback((id: string) => {
    return TeamCommandCenter.getInstance().removeMember(id);
  }, []);

  const updateMemberStatus = useCallback((id: string, status: UpdateMemberStatusInput) => {
    return TeamCommandCenter.getInstance().updateMemberStatus(id, status);
  }, []);

  const logActivity = useCallback((input: LogActivityInput) => {
    return TeamCommandCenter.getInstance().logActivity(input);
  }, []);

  const getTeamProductivity = useCallback((timeRange: TimeRange) => {
    return TeamCommandCenter.getInstance().getTeamProductivity(timeRange);
  }, []);

  const clearActivities = useCallback(() => {
    TeamCommandCenter.getInstance().clearActivities();
  }, []);

  const clearAll = useCallback(() => {
    TeamCommandCenter.getInstance().clearAll();
  }, []);

  const isClient = typeof window !== 'undefined';
  const center = isClient ? TeamCommandCenter.getInstance() : null;

  return {
    members: center?.getAllMembers() ?? [],
    onlineMembers: center?.getOnlineMembers() ?? [],
    activities: center?.getTeamActivities() ?? [],
    viewDistribution: center?.getActiveViewDistribution() ?? {},
    memberCount: center?.getMemberCount() ?? 0,
    addMember,
    removeMember,
    updateMemberStatus,
    logActivity,
    getTeamProductivity,
    clearActivities,
    clearAll,
  };
}
