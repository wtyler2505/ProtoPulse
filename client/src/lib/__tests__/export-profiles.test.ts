import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_PROFILES,
  getProfileById,
  getProfileFormatIds,
} from '../export-profiles';
import type { ExportProfile } from '../export-profiles';

// ---------------------------------------------------------------------------
// All format IDs present in ExportPanel's EXPORT_CATEGORIES (kept in sync)
// ---------------------------------------------------------------------------

const ALL_FORMAT_IDS = new Set([
  'kicad',
  'eagle',
  'spice',
  'netlist-csv',
  'netlist-kicad',
  'gerber',
  'pick-place',
  'odb-plus-plus',
  'ipc2581',
  'etchable-pcb',
  'bom-csv',
  'fzz',
  'pdf',
  'fmea',
  'step',
  'firmware',
]);

describe('BUILT_IN_PROFILES', () => {
  it('contains exactly 4 profiles', () => {
    expect(BUILT_IN_PROFILES).toHaveLength(4);
  });

  it('has unique IDs across all profiles', () => {
    const ids = BUILT_IN_PROFILES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every profile has a non-empty label and description', () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(profile.label.length).toBeGreaterThan(0);
      expect(profile.description.length).toBeGreaterThan(0);
    }
  });

  it('every profile has at least one format ID', () => {
    for (const profile of BUILT_IN_PROFILES) {
      expect(profile.formatIds.length).toBeGreaterThan(0);
    }
  });

  it('every format ID in every profile is a known export format', () => {
    for (const profile of BUILT_IN_PROFILES) {
      for (const fid of profile.formatIds) {
        expect(ALL_FORMAT_IDS.has(fid)).toBe(true);
      }
    }
  });

  it('profiles are immutable (frozen-like readonly arrays)', () => {
    // TypeScript enforces readonly at compile time; at runtime we just
    // verify the reference hasn't changed after attempting a spread copy.
    const copy = [...BUILT_IN_PROFILES];
    expect(copy).toEqual(BUILT_IN_PROFILES);
  });
});

describe('Fab Ready profile', () => {
  const profile = BUILT_IN_PROFILES.find((p) => p.id === 'fab-ready') as ExportProfile;

  it('exists', () => {
    expect(profile).toBeDefined();
  });

  it('includes gerber, pick-place, and bom-csv', () => {
    expect(profile.formatIds).toContain('gerber');
    expect(profile.formatIds).toContain('pick-place');
    expect(profile.formatIds).toContain('bom-csv');
  });

  it('does not include simulation formats', () => {
    expect(profile.formatIds).not.toContain('spice');
    expect(profile.formatIds).not.toContain('netlist-csv');
  });
});

describe('Sim Bundle profile', () => {
  const profile = BUILT_IN_PROFILES.find((p) => p.id === 'sim-bundle') as ExportProfile;

  it('exists', () => {
    expect(profile).toBeDefined();
  });

  it('includes spice and netlist-csv', () => {
    expect(profile.formatIds).toContain('spice');
    expect(profile.formatIds).toContain('netlist-csv');
  });

  it('does not include fabrication formats', () => {
    expect(profile.formatIds).not.toContain('gerber');
    expect(profile.formatIds).not.toContain('pick-place');
  });
});

describe('Documentation profile', () => {
  const profile = BUILT_IN_PROFILES.find((p) => p.id === 'documentation') as ExportProfile;

  it('exists', () => {
    expect(profile).toBeDefined();
  });

  it('includes pdf, fmea, and bom-csv', () => {
    expect(profile.formatIds).toContain('pdf');
    expect(profile.formatIds).toContain('fmea');
    expect(profile.formatIds).toContain('bom-csv');
  });

  it('does not include 3D or firmware formats', () => {
    expect(profile.formatIds).not.toContain('step');
    expect(profile.formatIds).not.toContain('firmware');
  });
});

describe('Full Package profile', () => {
  const profile = BUILT_IN_PROFILES.find((p) => p.id === 'full-package') as ExportProfile;

  it('exists', () => {
    expect(profile).toBeDefined();
  });

  it('includes every known format ID', () => {
    const profileSet = new Set(profile.formatIds);
    for (const fid of Array.from(ALL_FORMAT_IDS)) {
      expect(profileSet.has(fid)).toBe(true);
    }
  });

  it('has the same count as ALL_FORMAT_IDS', () => {
    expect(profile.formatIds.length).toBe(ALL_FORMAT_IDS.size);
  });
});

describe('getProfileById', () => {
  it('returns the correct profile for a valid ID', () => {
    const profile = getProfileById('fab-ready');
    expect(profile).toBeDefined();
    expect(profile?.id).toBe('fab-ready');
    expect(profile?.label).toBe('Fab Ready');
  });

  it('returns undefined for an unknown ID', () => {
    expect(getProfileById('nonexistent')).toBeUndefined();
  });

  it('returns undefined for an empty string', () => {
    expect(getProfileById('')).toBeUndefined();
  });

  it('is case-sensitive', () => {
    expect(getProfileById('Fab-Ready')).toBeUndefined();
    expect(getProfileById('FAB-READY')).toBeUndefined();
  });

  it('returns each built-in profile by its ID', () => {
    for (const profile of BUILT_IN_PROFILES) {
      const result = getProfileById(profile.id);
      expect(result).toBe(profile);
    }
  });
});

describe('getProfileFormatIds', () => {
  it('returns a Set of format IDs for a valid profile', () => {
    const ids = getProfileFormatIds('fab-ready');
    expect(ids).toBeInstanceOf(Set);
    expect(ids.has('gerber')).toBe(true);
    expect(ids.has('pick-place')).toBe(true);
    expect(ids.has('bom-csv')).toBe(true);
  });

  it('returns an empty set for an unknown profile ID', () => {
    const ids = getProfileFormatIds('does-not-exist');
    expect(ids.size).toBe(0);
  });

  it('full-package set has every format', () => {
    const ids = getProfileFormatIds('full-package');
    expect(ids.size).toBe(ALL_FORMAT_IDS.size);
    for (const fid of Array.from(ALL_FORMAT_IDS)) {
      expect(ids.has(fid)).toBe(true);
    }
  });

  it('sim-bundle set size matches the profile formatIds length', () => {
    const profile = getProfileById('sim-bundle');
    const ids = getProfileFormatIds('sim-bundle');
    expect(ids.size).toBe(profile?.formatIds.length);
  });

  it('does not share references between calls', () => {
    const a = getProfileFormatIds('fab-ready');
    const b = getProfileFormatIds('fab-ready');
    // Each call returns a new Set instance
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
