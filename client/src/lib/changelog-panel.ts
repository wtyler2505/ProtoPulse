/**
 * Changelog panel logic — parses CHANGELOG.md, tracks last-seen version,
 * and provides unseen entry detection for the "What's New" UI.
 */

const LAST_SEEN_KEY = 'protopulse:changelog:lastSeenVersion';

export type ChangeType = 'added' | 'changed' | 'fixed' | 'removed' | 'deprecated' | 'security';

export interface ChangelogEntry {
  type: ChangeType;
  text: string;
}

export interface ChangelogVersion {
  version: string;
  date: string | null;
  entries: ChangelogEntry[];
}

/**
 * Normalizes a Keep-a-Changelog section header to a ChangeType.
 * Falls back to 'changed' for unrecognized sections.
 */
function parseChangeType(header: string): ChangeType {
  const lower = header.toLowerCase().trim();
  if (lower.startsWith('added')) { return 'added'; }
  if (lower.startsWith('changed')) { return 'changed'; }
  if (lower.startsWith('fixed')) { return 'fixed'; }
  if (lower.startsWith('removed')) { return 'removed'; }
  if (lower.startsWith('deprecated')) { return 'deprecated'; }
  if (lower.startsWith('security')) { return 'security'; }
  return 'changed';
}

/**
 * Parses a CHANGELOG.md string (Keep-a-Changelog format) into structured versions.
 *
 * Expected format:
 *   ## [version] - date     or   ## [Unreleased]
 *   ### Added
 *   - entry text
 *   ### Fixed
 *   - entry text
 */
export function parseChangelog(markdown: string): ChangelogVersion[] {
  const lines = markdown.split('\n');
  const versions: ChangelogVersion[] = [];
  let current: ChangelogVersion | null = null;
  let currentType: ChangeType = 'changed';

  for (const line of lines) {
    // Match version headers: ## [x.y.z] - date  or  ## [Unreleased]
    const versionMatch = /^##\s+\[([^\]]+)\](?:\s*-?\s*(.+))?/.exec(line);
    if (versionMatch) {
      if (current) {
        versions.push(current);
      }
      current = {
        version: versionMatch[1],
        date: versionMatch[2]?.trim() || null,
        entries: [],
      };
      currentType = 'changed';
      continue;
    }

    // Match section headers: ### Added, ### Fixed, etc.
    const sectionMatch = /^###\s+(.+)/.exec(line);
    if (sectionMatch) {
      currentType = parseChangeType(sectionMatch[1]);
      continue;
    }

    // Match list items: - entry text
    const entryMatch = /^-\s+(.+)/.exec(line);
    if (entryMatch && current) {
      current.entries.push({
        type: currentType,
        text: entryMatch[1],
      });
    }
  }

  if (current) {
    versions.push(current);
  }

  return versions;
}

/**
 * Returns the last-seen version from localStorage.
 */
export function getLastSeenVersion(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Saves the last-seen version to localStorage.
 */
export function setLastSeenVersion(version: string): void {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    // localStorage may be unavailable (SSR, private browsing quota exceeded)
  }
}

/**
 * Counts unseen changelog entries — entries from versions newer than lastSeenVersion.
 * If lastSeenVersion is null (first visit), all entries are considered unseen.
 */
export function countUnseenEntries(versions: ChangelogVersion[], lastSeenVersion: string | null): number {
  if (versions.length === 0) {
    return 0;
  }

  // If no version has been seen yet, everything is unseen
  if (lastSeenVersion === null) {
    return versions.reduce((sum, v) => sum + v.entries.length, 0);
  }

  let count = 0;
  for (const v of versions) {
    if (v.version === lastSeenVersion) {
      break;
    }
    count += v.entries.length;
  }
  return count;
}

/**
 * Returns the color class for a given change type (Tailwind text color).
 */
export function changeTypeColor(type: ChangeType): string {
  switch (type) {
    case 'added': return 'text-green-400';
    case 'changed': return 'text-blue-400';
    case 'fixed': return 'text-yellow-400';
    case 'removed': return 'text-red-400';
    case 'deprecated': return 'text-orange-400';
    case 'security': return 'text-purple-400';
  }
}

/**
 * Returns the background color class for a badge of a given change type.
 */
export function changeTypeBgColor(type: ChangeType): string {
  switch (type) {
    case 'added': return 'bg-green-400/15 text-green-400';
    case 'changed': return 'bg-blue-400/15 text-blue-400';
    case 'fixed': return 'bg-yellow-400/15 text-yellow-400';
    case 'removed': return 'bg-red-400/15 text-red-400';
    case 'deprecated': return 'bg-orange-400/15 text-orange-400';
    case 'security': return 'bg-purple-400/15 text-purple-400';
  }
}
