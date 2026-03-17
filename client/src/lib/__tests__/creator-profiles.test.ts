import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { CreatorProfileManager, useCreatorProfile } from '../creator-profiles';
import type { CreatorProfile, CreatorStats, CreatorProfileUpdate } from '../creator-profiles';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeProfile(overrides?: Partial<CreatorProfile>): CreatorProfile {
  return {
    id: 'user-1',
    displayName: 'Ada Lovelace',
    bio: 'First programmer',
    avatar: 'https://example.com/ada.png',
    skills: ['embedded', 'robotics'],
    projectCount: 5,
    sharedDesignCount: 3,
    joinedAt: 1700000000000,
    socialLinks: { github: 'https://github.com/ada' },
    ...overrides,
  };
}

function makeStats(overrides?: Partial<CreatorStats>): CreatorStats {
  return {
    totalDownloads: 120,
    averageRating: 4.5,
    topDesigns: [
      { id: 'd-1', name: 'Motor Driver', downloads: 80, rating: 4.8 },
      { id: 'd-2', name: 'Blinker', downloads: 40, rating: 4.2 },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let manager: CreatorProfileManager;

beforeEach(() => {
  localStorage.clear();
  CreatorProfileManager.resetForTesting();
  manager = CreatorProfileManager.getInstance();
});

afterEach(() => {
  CreatorProfileManager.resetForTesting();
  localStorage.clear();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - Singleton', () => {
  it('returns the same instance on repeated calls', () => {
    const a = CreatorProfileManager.getInstance();
    const b = CreatorProfileManager.getInstance();
    expect(a).toBe(b);
  });

  it('creates a fresh instance after resetForTesting', () => {
    const first = CreatorProfileManager.getInstance();
    CreatorProfileManager.resetForTesting();
    const second = CreatorProfileManager.getInstance();
    expect(first).not.toBe(second);
  });
});

// ---------------------------------------------------------------------------
// Default State
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - Default State', () => {
  it('starts with zero profiles', () => {
    expect(manager.getProfileCount()).toBe(0);
  });

  it('getProfile returns undefined for unknown ID', () => {
    expect(manager.getProfile('nonexistent')).toBeUndefined();
  });

  it('getPublicProfiles returns empty array', () => {
    expect(manager.getPublicProfiles()).toEqual([]);
  });

  it('getCreatorStats returns zero defaults for unknown ID', () => {
    const stats = manager.getCreatorStats('unknown');
    expect(stats.totalDownloads).toBe(0);
    expect(stats.averageRating).toBe(0);
    expect(stats.topDesigns).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// addProfile
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - addProfile', () => {
  it('adds a valid profile and increments count', () => {
    const result = manager.addProfile(makeProfile());
    expect(result).toBe(true);
    expect(manager.getProfileCount()).toBe(1);
  });

  it('rejects profile with empty id', () => {
    const result = manager.addProfile(makeProfile({ id: '' }));
    expect(result).toBe(false);
    expect(manager.getProfileCount()).toBe(0);
  });

  it('rejects profile with empty displayName', () => {
    const result = manager.addProfile(makeProfile({ displayName: '' }));
    expect(result).toBe(false);
  });

  it('replaces an existing profile with same id', () => {
    manager.addProfile(makeProfile());
    manager.addProfile(makeProfile({ displayName: 'Updated Name' }));
    expect(manager.getProfileCount()).toBe(1);
    expect(manager.getProfile('user-1')?.displayName).toBe('Updated Name');
  });

  it('truncates skills to MAX_SKILLS (50)', () => {
    const skills = Array.from({ length: 60 }, (_, i) => `skill-${i}`);
    manager.addProfile(makeProfile({ skills }));
    const profile = manager.getProfile('user-1');
    expect(profile?.skills.length).toBe(50);
  });

  it('truncates socialLinks to MAX_SOCIAL_LINKS (20)', () => {
    const socialLinks: Record<string, string> = {};
    for (let i = 0; i < 25; i++) {
      socialLinks[`link-${i}`] = `https://example.com/${i}`;
    }
    manager.addProfile(makeProfile({ socialLinks }));
    const profile = manager.getProfile('user-1');
    expect(Object.keys(profile?.socialLinks ?? {}).length).toBe(20);
  });

  it('notifies subscribers', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.addProfile(makeProfile());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists to localStorage', () => {
    manager.addProfile(makeProfile());
    const raw = localStorage.getItem('protopulse-creator-profiles');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('user-1');
  });
});

// ---------------------------------------------------------------------------
// getProfile
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - getProfile', () => {
  it('returns a copy (not a reference)', () => {
    manager.addProfile(makeProfile());
    const a = manager.getProfile('user-1');
    const b = manager.getProfile('user-1');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });

  it('returns skills as a separate array copy', () => {
    manager.addProfile(makeProfile());
    const profile = manager.getProfile('user-1');
    profile?.skills.push('mutated');
    expect(manager.getProfile('user-1')?.skills).not.toContain('mutated');
  });

  it('includes optional fields when present', () => {
    manager.addProfile(makeProfile());
    const profile = manager.getProfile('user-1');
    expect(profile?.bio).toBe('First programmer');
    expect(profile?.avatar).toBe('https://example.com/ada.png');
    expect(profile?.socialLinks?.github).toBe('https://github.com/ada');
  });
});

// ---------------------------------------------------------------------------
// updateProfile
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - updateProfile', () => {
  it('updates displayName', () => {
    manager.addProfile(makeProfile());
    const updated = manager.updateProfile('user-1', { displayName: 'Charles Babbage' });
    expect(updated?.displayName).toBe('Charles Babbage');
    expect(manager.getProfile('user-1')?.displayName).toBe('Charles Babbage');
  });

  it('updates bio and avatar', () => {
    manager.addProfile(makeProfile());
    manager.updateProfile('user-1', { bio: 'Updated bio', avatar: 'new.png' });
    const p = manager.getProfile('user-1');
    expect(p?.bio).toBe('Updated bio');
    expect(p?.avatar).toBe('new.png');
  });

  it('does not change id (immutable)', () => {
    manager.addProfile(makeProfile());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = manager.updateProfile('user-1', { id: 'hacked' } as any);
    expect(updated?.id).toBe('user-1');
  });

  it('does not change joinedAt (immutable)', () => {
    manager.addProfile(makeProfile());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updated = manager.updateProfile('user-1', { joinedAt: 0 } as any);
    expect(updated?.joinedAt).toBe(1700000000000);
  });

  it('returns undefined for nonexistent profile', () => {
    expect(manager.updateProfile('ghost', { displayName: 'x' })).toBeUndefined();
  });

  it('enforces skills limit on update', () => {
    manager.addProfile(makeProfile());
    const bigSkills = Array.from({ length: 60 }, (_, i) => `s-${i}`);
    manager.updateProfile('user-1', { skills: bigSkills });
    expect(manager.getProfile('user-1')?.skills.length).toBe(50);
  });

  it('enforces socialLinks limit on update', () => {
    manager.addProfile(makeProfile());
    const links: Record<string, string> = {};
    for (let i = 0; i < 25; i++) {
      links[`l-${i}`] = `https://example.com/${i}`;
    }
    manager.updateProfile('user-1', { socialLinks: links });
    expect(Object.keys(manager.getProfile('user-1')?.socialLinks ?? {}).length).toBe(20);
  });

  it('notifies subscribers on update', () => {
    manager.addProfile(makeProfile());
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.updateProfile('user-1', { displayName: 'New' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists updated profile to localStorage', () => {
    manager.addProfile(makeProfile());
    manager.updateProfile('user-1', { displayName: 'Persisted' });
    CreatorProfileManager.resetForTesting();
    const fresh = CreatorProfileManager.getInstance();
    expect(fresh.getProfile('user-1')?.displayName).toBe('Persisted');
  });
});

// ---------------------------------------------------------------------------
// removeProfile
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - removeProfile', () => {
  it('removes an existing profile', () => {
    manager.addProfile(makeProfile());
    const removed = manager.removeProfile('user-1');
    expect(removed).toBe(true);
    expect(manager.getProfileCount()).toBe(0);
    expect(manager.getProfile('user-1')).toBeUndefined();
  });

  it('returns false for nonexistent profile', () => {
    expect(manager.removeProfile('ghost')).toBe(false);
  });

  it('also clears stats cache for the removed profile', () => {
    manager.addProfile(makeProfile());
    manager.setCreatorStats('user-1', makeStats());
    manager.removeProfile('user-1');
    expect(manager.getCreatorStats('user-1').totalDownloads).toBe(0);
  });

  it('notifies subscribers', () => {
    manager.addProfile(makeProfile());
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.removeProfile('user-1');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getPublicProfiles
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - getPublicProfiles', () => {
  it('returns all profiles sorted by joinedAt descending', () => {
    manager.addProfile(makeProfile({ id: 'old', displayName: 'Old', joinedAt: 1000 }));
    manager.addProfile(makeProfile({ id: 'new', displayName: 'New', joinedAt: 3000 }));
    manager.addProfile(makeProfile({ id: 'mid', displayName: 'Mid', joinedAt: 2000 }));
    const profiles = manager.getPublicProfiles();
    expect(profiles.map((p) => p.id)).toEqual(['new', 'mid', 'old']);
  });

  it('respects limit parameter', () => {
    manager.addProfile(makeProfile({ id: 'a', displayName: 'A', joinedAt: 1000 }));
    manager.addProfile(makeProfile({ id: 'b', displayName: 'B', joinedAt: 2000 }));
    manager.addProfile(makeProfile({ id: 'c', displayName: 'C', joinedAt: 3000 }));
    const profiles = manager.getPublicProfiles(2);
    expect(profiles).toHaveLength(2);
    expect(profiles[0].id).toBe('c');
    expect(profiles[1].id).toBe('b');
  });

  it('returns all profiles if limit exceeds count', () => {
    manager.addProfile(makeProfile({ id: 'only', displayName: 'Only' }));
    expect(manager.getPublicProfiles(100)).toHaveLength(1);
  });

  it('ignores non-positive limit', () => {
    manager.addProfile(makeProfile({ id: 'a', displayName: 'A' }));
    manager.addProfile(makeProfile({ id: 'b', displayName: 'B' }));
    expect(manager.getPublicProfiles(0)).toHaveLength(2);
    expect(manager.getPublicProfiles(-1)).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// searchCreators
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - searchCreators', () => {
  beforeEach(() => {
    manager.addProfile(makeProfile({ id: 'ada', displayName: 'Ada Lovelace', bio: 'First programmer', skills: ['embedded'] }));
    manager.addProfile(makeProfile({ id: 'bob', displayName: 'Bob Builder', bio: 'Builds robots', skills: ['robotics', 'mechanical'] }));
    manager.addProfile(makeProfile({ id: 'carl', displayName: 'Carl Sagan', bio: 'Space explorer', skills: ['embedded', 'radio'] }));
  });

  it('matches by displayName (case-insensitive)', () => {
    const results = manager.searchCreators('ada');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('ada');
  });

  it('matches by bio', () => {
    const results = manager.searchCreators('robots');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('bob');
  });

  it('matches by skills', () => {
    const results = manager.searchCreators('radio');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('carl');
  });

  it('returns name matches before bio matches before skill matches', () => {
    // "embedded" appears in ada's skills and carl's skills
    // Add a profile with "embedded" in displayName to test ordering
    manager.addProfile(makeProfile({ id: 'emb', displayName: 'Embedded Expert', bio: 'Hardware only', skills: ['pcb'] }));
    const results = manager.searchCreators('embedded');
    expect(results[0].id).toBe('emb'); // name match first
    // skill matches after
    expect(results.some((r) => r.id === 'ada')).toBe(true);
    expect(results.some((r) => r.id === 'carl')).toBe(true);
  });

  it('returns all profiles for empty query', () => {
    const results = manager.searchCreators('');
    expect(results).toHaveLength(3);
  });

  it('returns all profiles for whitespace-only query', () => {
    const results = manager.searchCreators('   ');
    expect(results).toHaveLength(3);
  });

  it('respects limit parameter', () => {
    const results = manager.searchCreators('', 2);
    expect(results).toHaveLength(2);
  });

  it('returns empty array for no matches', () => {
    const results = manager.searchCreators('zzzzz');
    expect(results).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getCreatorStats / setCreatorStats
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - Stats', () => {
  it('returns default stats for unknown creator', () => {
    const stats = manager.getCreatorStats('unknown');
    expect(stats.totalDownloads).toBe(0);
    expect(stats.averageRating).toBe(0);
    expect(stats.topDesigns).toEqual([]);
  });

  it('stores and retrieves stats', () => {
    manager.setCreatorStats('user-1', makeStats());
    const stats = manager.getCreatorStats('user-1');
    expect(stats.totalDownloads).toBe(120);
    expect(stats.averageRating).toBe(4.5);
    expect(stats.topDesigns).toHaveLength(2);
  });

  it('returns a copy of stats (not a reference)', () => {
    manager.setCreatorStats('user-1', makeStats());
    const a = manager.getCreatorStats('user-1');
    const b = manager.getCreatorStats('user-1');
    expect(a).toEqual(b);
    expect(a).not.toBe(b);
    expect(a.topDesigns).not.toBe(b.topDesigns);
  });

  it('truncates topDesigns to 10', () => {
    const designs = Array.from({ length: 15 }, (_, i) => ({
      id: `d-${i}`,
      name: `Design ${i}`,
      downloads: i * 10,
      rating: 4.0,
    }));
    manager.setCreatorStats('user-1', { totalDownloads: 100, averageRating: 4.0, topDesigns: designs });
    expect(manager.getCreatorStats('user-1').topDesigns).toHaveLength(10);
  });

  it('notifies subscribers when stats are set', () => {
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.setCreatorStats('user-1', makeStats());
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - Subscription', () => {
  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = manager.subscribe(listener);
    manager.addProfile(makeProfile());
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    manager.addProfile(makeProfile({ id: 'user-2', displayName: 'B' }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('supports multiple listeners', () => {
    const l1 = vi.fn();
    const l2 = vi.fn();
    manager.subscribe(l1);
    manager.subscribe(l2);
    manager.addProfile(makeProfile());
    expect(l1).toHaveBeenCalledTimes(1);
    expect(l2).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - Persistence', () => {
  it('loads profiles from localStorage on construction', () => {
    manager.addProfile(makeProfile());
    CreatorProfileManager.resetForTesting();
    const fresh = CreatorProfileManager.getInstance();
    expect(fresh.getProfile('user-1')?.displayName).toBe('Ada Lovelace');
  });

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem('protopulse-creator-profiles', 'not json');
    CreatorProfileManager.resetForTesting();
    const fresh = CreatorProfileManager.getInstance();
    expect(fresh.getProfileCount()).toBe(0);
  });

  it('handles non-array JSON in localStorage', () => {
    localStorage.setItem('protopulse-creator-profiles', '{"not":"array"}');
    CreatorProfileManager.resetForTesting();
    const fresh = CreatorProfileManager.getInstance();
    expect(fresh.getProfileCount()).toBe(0);
  });

  it('skips invalid profile entries in localStorage', () => {
    const data = [
      makeProfile(),
      { id: '', displayName: '' }, // invalid
      { notAProfile: true }, // invalid
    ];
    localStorage.setItem('protopulse-creator-profiles', JSON.stringify(data));
    CreatorProfileManager.resetForTesting();
    const fresh = CreatorProfileManager.getInstance();
    expect(fresh.getProfileCount()).toBe(1);
  });

  it('handles localStorage.setItem throwing (quota exceeded)', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    // Should not throw — just silently fail persistence
    expect(() => {
      manager.addProfile(makeProfile());
    }).not.toThrow();
    expect(manager.getProfileCount()).toBe(1);
  });

  it('handles localStorage.getItem throwing', () => {
    vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    CreatorProfileManager.resetForTesting();
    const fresh = CreatorProfileManager.getInstance();
    expect(fresh.getProfileCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// clear
// ---------------------------------------------------------------------------

describe('CreatorProfileManager - clear', () => {
  it('removes all profiles and stats', () => {
    manager.addProfile(makeProfile());
    manager.setCreatorStats('user-1', makeStats());
    manager.clear();
    expect(manager.getProfileCount()).toBe(0);
    expect(manager.getCreatorStats('user-1').totalDownloads).toBe(0);
  });

  it('notifies subscribers', () => {
    manager.addProfile(makeProfile());
    const listener = vi.fn();
    manager.subscribe(listener);
    manager.clear();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('persists empty state to localStorage', () => {
    manager.addProfile(makeProfile());
    manager.clear();
    const raw = localStorage.getItem('protopulse-creator-profiles');
    expect(JSON.parse(raw!)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// useCreatorProfile Hook
// ---------------------------------------------------------------------------

describe('useCreatorProfile', () => {
  it('returns undefined profile for unknown ID', () => {
    const { result } = renderHook(() => useCreatorProfile('unknown'));
    expect(result.current.profile).toBeUndefined();
  });

  it('returns profile and default stats for known ID', () => {
    manager.addProfile(makeProfile());
    const { result } = renderHook(() => useCreatorProfile('user-1'));
    expect(result.current.profile?.displayName).toBe('Ada Lovelace');
    expect(result.current.stats.totalDownloads).toBe(0);
  });

  it('returns cached stats when available', () => {
    manager.addProfile(makeProfile());
    manager.setCreatorStats('user-1', makeStats());
    const { result } = renderHook(() => useCreatorProfile('user-1'));
    expect(result.current.stats.totalDownloads).toBe(120);
    expect(result.current.stats.averageRating).toBe(4.5);
  });

  it('updateProfile updates the manager', () => {
    manager.addProfile(makeProfile());
    const { result } = renderHook(() => useCreatorProfile('user-1'));
    act(() => {
      result.current.updateProfile({ displayName: 'Hook Update' });
    });
    expect(result.current.profile?.displayName).toBe('Hook Update');
  });

  it('removeProfile removes from the manager', () => {
    manager.addProfile(makeProfile());
    const { result } = renderHook(() => useCreatorProfile('user-1'));
    act(() => {
      result.current.removeProfile();
    });
    expect(result.current.profile).toBeUndefined();
  });

  it('re-renders on external mutation', () => {
    manager.addProfile(makeProfile());
    const { result } = renderHook(() => useCreatorProfile('user-1'));
    expect(result.current.profile?.displayName).toBe('Ada Lovelace');
    act(() => {
      manager.updateProfile('user-1', { displayName: 'External Update' });
    });
    expect(result.current.profile?.displayName).toBe('External Update');
  });
});
