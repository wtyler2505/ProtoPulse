import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseChangelog,
  getLastSeenVersion,
  setLastSeenVersion,
  countUnseenEntries,
  changeTypeColor,
  changeTypeBgColor,
} from '../changelog-panel';
import type { ChangelogVersion, ChangeType } from '../changelog-panel';

describe('parseChangelog', () => {
  it('parses a single released version', () => {
    const md = `# Changelog

## [0.1.0] - 2026-02-15

### Added
- Initial release
- Dark theme
`;
    const result = parseChangelog(md);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('0.1.0');
    expect(result[0].date).toBe('2026-02-15');
    expect(result[0].entries).toHaveLength(2);
    expect(result[0].entries[0]).toEqual({ type: 'added', text: 'Initial release' });
    expect(result[0].entries[1]).toEqual({ type: 'added', text: 'Dark theme' });
  });

  it('parses Unreleased section', () => {
    const md = `## [Unreleased]

### Added
- New feature

### Fixed
- Bug fix
`;
    const result = parseChangelog(md);
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe('Unreleased');
    expect(result[0].date).toBeNull();
    expect(result[0].entries).toHaveLength(2);
    expect(result[0].entries[0]).toEqual({ type: 'added', text: 'New feature' });
    expect(result[0].entries[1]).toEqual({ type: 'fixed', text: 'Bug fix' });
  });

  it('parses multiple versions in order', () => {
    const md = `## [Unreleased]

### Added
- Feature A

## [0.2.0] - 2026-03-01

### Changed
- Updated docs

## [0.1.0] - 2026-02-15

### Added
- Initial release
`;
    const result = parseChangelog(md);
    expect(result).toHaveLength(3);
    expect(result[0].version).toBe('Unreleased');
    expect(result[1].version).toBe('0.2.0');
    expect(result[1].date).toBe('2026-03-01');
    expect(result[2].version).toBe('0.1.0');
  });

  it('handles all change types', () => {
    const md = `## [1.0.0] - 2026-01-01

### Added
- Added item
### Changed
- Changed item
### Fixed
- Fixed item
### Removed
- Removed item
### Deprecated
- Deprecated item
### Security
- Security item
`;
    const result = parseChangelog(md);
    expect(result[0].entries).toHaveLength(6);
    expect(result[0].entries[0].type).toBe('added');
    expect(result[0].entries[1].type).toBe('changed');
    expect(result[0].entries[2].type).toBe('fixed');
    expect(result[0].entries[3].type).toBe('removed');
    expect(result[0].entries[4].type).toBe('deprecated');
    expect(result[0].entries[5].type).toBe('security');
  });

  it('falls back to changed for unknown section headers', () => {
    const md = `## [1.0.0] - 2026-01-01

### Miscellaneous
- Some item
`;
    const result = parseChangelog(md);
    expect(result[0].entries[0].type).toBe('changed');
  });

  it('returns empty array for empty input', () => {
    expect(parseChangelog('')).toHaveLength(0);
  });

  it('returns empty array for markdown without version headers', () => {
    const md = `# Changelog

Some description text without versions.
`;
    expect(parseChangelog(md)).toHaveLength(0);
  });

  it('handles version with parenthetical suffix in section header', () => {
    const md = `## [Unreleased]

### Added (Waves 25-26)
- Feature from Wave 25
- Feature from Wave 26

### Added (Waves 1-24)
- Older feature
`;
    const result = parseChangelog(md);
    expect(result).toHaveLength(1);
    expect(result[0].entries).toHaveLength(3);
    expect(result[0].entries[0].type).toBe('added');
    expect(result[0].entries[1].type).toBe('added');
    expect(result[0].entries[2].type).toBe('added');
  });

  it('ignores non-list lines within a version section', () => {
    const md = `## [1.0.0] - 2026-01-01

### Added
Some description paragraph that is not a list item.

- Actual entry

Another paragraph.
`;
    const result = parseChangelog(md);
    expect(result[0].entries).toHaveLength(1);
    expect(result[0].entries[0].text).toBe('Actual entry');
  });

  it('preserves inline markdown in entry text', () => {
    const md = `## [1.0.0] - 2026-01-01

### Added
- Support for \`code blocks\` and **bold** text
`;
    const result = parseChangelog(md);
    expect(result[0].entries[0].text).toBe('Support for `code blocks` and **bold** text');
  });

  it('handles version header without date', () => {
    const md = `## [2.0.0]

### Added
- Something
`;
    const result = parseChangelog(md);
    expect(result[0].version).toBe('2.0.0');
    expect(result[0].date).toBeNull();
  });
});

describe('getLastSeenVersion / setLastSeenVersion', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns null when no version has been saved', () => {
    expect(getLastSeenVersion()).toBeNull();
  });

  it('returns the saved version after setLastSeenVersion', () => {
    setLastSeenVersion('0.2.0');
    expect(getLastSeenVersion()).toBe('0.2.0');
  });

  it('overwrites previous version', () => {
    setLastSeenVersion('0.1.0');
    setLastSeenVersion('0.3.0');
    expect(getLastSeenVersion()).toBe('0.3.0');
  });

  it('handles localStorage errors gracefully for get', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    expect(getLastSeenVersion()).toBeNull();
    spy.mockRestore();
  });

  it('handles localStorage errors gracefully for set', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });
    // Should not throw
    expect(() => { setLastSeenVersion('1.0.0'); }).not.toThrow();
    spy.mockRestore();
  });
});

describe('countUnseenEntries', () => {
  const versions: ChangelogVersion[] = [
    {
      version: 'Unreleased',
      date: null,
      entries: [
        { type: 'added', text: 'New feature A' },
        { type: 'fixed', text: 'Bug fix B' },
      ],
    },
    {
      version: '0.2.0',
      date: '2026-03-01',
      entries: [
        { type: 'added', text: 'Feature C' },
      ],
    },
    {
      version: '0.1.0',
      date: '2026-02-15',
      entries: [
        { type: 'added', text: 'Initial release' },
      ],
    },
  ];

  it('returns all entries when lastSeenVersion is null', () => {
    expect(countUnseenEntries(versions, null)).toBe(4);
  });

  it('returns entries before the last-seen version', () => {
    expect(countUnseenEntries(versions, '0.2.0')).toBe(2);
  });

  it('returns 0 when last-seen is the latest version', () => {
    expect(countUnseenEntries(versions, 'Unreleased')).toBe(0);
  });

  it('returns all entries when last-seen version is not found', () => {
    expect(countUnseenEntries(versions, '0.0.1')).toBe(4);
  });

  it('returns 0 for empty versions array', () => {
    expect(countUnseenEntries([], null)).toBe(0);
    expect(countUnseenEntries([], '1.0.0')).toBe(0);
  });

  it('returns entries for single version when not seen', () => {
    const single: ChangelogVersion[] = [
      { version: '1.0.0', date: '2026-01-01', entries: [{ type: 'added', text: 'Item' }] },
    ];
    expect(countUnseenEntries(single, null)).toBe(1);
    expect(countUnseenEntries(single, '0.9.0')).toBe(1);
    expect(countUnseenEntries(single, '1.0.0')).toBe(0);
  });
});

describe('changeTypeColor', () => {
  it('returns green for added', () => {
    expect(changeTypeColor('added')).toContain('green');
  });

  it('returns blue for changed', () => {
    expect(changeTypeColor('changed')).toContain('blue');
  });

  it('returns yellow for fixed', () => {
    expect(changeTypeColor('fixed')).toContain('yellow');
  });

  it('returns red for removed', () => {
    expect(changeTypeColor('removed')).toContain('red');
  });

  it('returns orange for deprecated', () => {
    expect(changeTypeColor('deprecated')).toContain('orange');
  });

  it('returns purple for security', () => {
    expect(changeTypeColor('security')).toContain('purple');
  });

  it('returns a Tailwind text class for every type', () => {
    const types: ChangeType[] = ['added', 'changed', 'fixed', 'removed', 'deprecated', 'security'];
    for (const t of types) {
      expect(changeTypeColor(t)).toMatch(/^text-/);
    }
  });
});

describe('changeTypeBgColor', () => {
  it('returns a bg + text combo for every type', () => {
    const types: ChangeType[] = ['added', 'changed', 'fixed', 'removed', 'deprecated', 'security'];
    for (const t of types) {
      const result = changeTypeBgColor(t);
      expect(result).toContain('bg-');
      expect(result).toContain('text-');
    }
  });

  it('returns green bg for added', () => {
    expect(changeTypeBgColor('added')).toContain('green');
  });

  it('returns red bg for removed', () => {
    expect(changeTypeBgColor('removed')).toContain('red');
  });
});
