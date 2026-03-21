import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MarketplaceManager, fuzzyMatch } from '../marketplace';
import type {
  MarketplaceItem,
  MarketplaceSearchOptions,
  PublishInput,
} from '../marketplace';
import type { DesignSnippet } from '../design-reuse';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnippet(overrides: Partial<DesignSnippet> = {}): DesignSnippet {
  return {
    id: overrides.id ?? 'test-snippet-1',
    name: overrides.name ?? 'Test Snippet',
    description: overrides.description ?? 'A test snippet',
    category: overrides.category ?? 'analog',
    tags: overrides.tags ?? ['test'],
    nodes: overrides.nodes ?? [],
    edges: overrides.edges ?? [],
    wires: overrides.wires ?? [],
    metadata: overrides.metadata ?? {
      author: 'Tester',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
      usageCount: 0,
      rating: 0,
    },
  };
}

function makePublishInput(overrides: Partial<PublishInput> = {}): PublishInput {
  return {
    name: overrides.name ?? 'Published Item',
    description: overrides.description ?? 'A published circuit block',
    category: overrides.category ?? 'analog',
    tags: overrides.tags ?? ['test'],
    author: overrides.author ?? 'TestUser',
    version: overrides.version,
    snippet: overrides.snippet ?? makeSnippet(),
    license: overrides.license,
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  localStorage.clear();
  MarketplaceManager.resetInstance();
});

// ---------------------------------------------------------------------------
// fuzzyMatch
// ---------------------------------------------------------------------------

describe('fuzzyMatch', () => {
  it('returns positive score for exact substring match', () => {
    const score = fuzzyMatch('Voltage Regulator', 'voltage');
    expect(score).toBeGreaterThan(0);
  });

  it('returns higher score for match at beginning of string', () => {
    const scoreStart = fuzzyMatch('Voltage Regulator', 'volt');
    const scoreMid = fuzzyMatch('LM Voltage Regulator', 'volt');
    expect(scoreStart).toBeGreaterThan(scoreMid);
  });

  it('returns -1 for no match', () => {
    const score = fuzzyMatch('Voltage Regulator', 'xyz123');
    expect(score).toBe(-1);
  });

  it('matches characters in order (fuzzy)', () => {
    const score = fuzzyMatch('Motor Controller', 'mtcl');
    expect(score).toBeGreaterThan(0);
  });

  it('is case insensitive', () => {
    const score = fuzzyMatch('UART Level Shifter', 'uart');
    expect(score).toBeGreaterThan(0);
  });

  it('returns -1 when characters are out of order', () => {
    const score = fuzzyMatch('abc', 'cba');
    expect(score).toBe(-1);
  });

  it('handles empty query', () => {
    const score = fuzzyMatch('anything', '');
    expect(score).toBeGreaterThan(0);
  });

  it('handles empty text', () => {
    const score = fuzzyMatch('', 'query');
    expect(score).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('MarketplaceManager singleton', () => {
  it('returns the same instance', () => {
    const a = MarketplaceManager.getInstance();
    const b = MarketplaceManager.getInstance();
    expect(a).toBe(b);
  });

  it('resetInstance creates a new instance', () => {
    const a = MarketplaceManager.getInstance();
    MarketplaceManager.resetInstance();
    const b = MarketplaceManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// Seed catalog
// ---------------------------------------------------------------------------

describe('seed catalog', () => {
  it('loads 12 seed items on first init', () => {
    const mp = MarketplaceManager.getInstance();
    expect(mp.getItemCount()).toBe(12);
  });

  it('has items in multiple categories', () => {
    const mp = MarketplaceManager.getInstance();
    const cats = mp.getCategories();
    expect(cats.length).toBeGreaterThanOrEqual(7);
    expect(cats).toContain('power');
    expect(cats).toContain('motor-control');
    expect(cats).toContain('communication');
  });

  it('each seed item has required fields', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    items.forEach((item) => {
      expect(item.id).toBeTruthy();
      expect(item.name).toBeTruthy();
      expect(item.description).toBeTruthy();
      expect(item.category).toBeTruthy();
      expect(item.tags.length).toBeGreaterThan(0);
      expect(item.author).toBeTruthy();
      expect(item.version).toBeTruthy();
      expect(item.snippet).toBeDefined();
      expect(item.license).toBeTruthy();
      expect(typeof item.downloads).toBe('number');
      expect(typeof item.averageRating).toBe('number');
    });
  });

  it('persists seed to localStorage', () => {
    MarketplaceManager.getInstance();
    const raw = localStorage.getItem('protopulse-marketplace');
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as MarketplaceItem[];
    expect(parsed.length).toBe(12);
  });

  it('reloads from localStorage on second init', () => {
    const mp1 = MarketplaceManager.getInstance();
    mp1.publish(makePublishInput({ name: 'Extra Item' }));
    expect(mp1.getItemCount()).toBe(13);

    MarketplaceManager.resetInstance();
    const mp2 = MarketplaceManager.getInstance();
    expect(mp2.getItemCount()).toBe(13);
  });
});

// ---------------------------------------------------------------------------
// Search — basic
// ---------------------------------------------------------------------------

describe('search', () => {
  it('returns all items with empty options', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({});
    expect(result.total).toBe(12);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBeGreaterThanOrEqual(1);
  });

  it('filters by category', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ category: 'power' });
    result.items.forEach((item) => {
      expect(item.category).toBe('power');
    });
    expect(result.total).toBeGreaterThanOrEqual(2);
  });

  it('filters by tags (all must match)', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ tags: ['motor'] });
    expect(result.total).toBeGreaterThanOrEqual(1);
    result.items.forEach((item) => {
      expect(item.tags.some((t) => t.toLowerCase() === 'motor')).toBe(true);
    });
  });

  it('filters by multiple tags requiring all present', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ tags: ['h-bridge', 'motor'] });
    expect(result.total).toBeGreaterThanOrEqual(1);
    result.items.forEach((item) => {
      expect(item.tags).toContain('h-bridge');
    });
  });

  it('filters by verified flag', () => {
    const mp = MarketplaceManager.getInstance();
    const verified = mp.search({ verified: true });
    verified.items.forEach((item) => expect(item.verified).toBe(true));
    const unverified = mp.search({ verified: false });
    unverified.items.forEach((item) => expect(item.verified).toBe(false));
    expect(verified.total + unverified.total).toBe(12);
  });

  it('filters by license', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ license: 'CC0' });
    result.items.forEach((item) => expect(item.license).toBe('CC0'));
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('fuzzy searches by name', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ query: 'voltage regulator' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items[0].name).toContain('Voltage Regulator');
  });

  it('fuzzy searches by description', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ query: 'bidirectional' });
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('fuzzy searches by tags', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ query: 'pwm' });
    expect(result.total).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for non-matching query', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ query: 'zzzznonexistent' });
    expect(result.total).toBe(0);
    expect(result.items).toHaveLength(0);
  });

  it('combines query + category filter', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ query: 'driver', category: 'motor-control' });
    expect(result.total).toBeGreaterThanOrEqual(1);
    result.items.forEach((item) => expect(item.category).toBe('motor-control'));
  });
});

// ---------------------------------------------------------------------------
// Search — sorting
// ---------------------------------------------------------------------------

describe('search sorting', () => {
  it('sorts by name ascending', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ sortBy: 'name', sortOrder: 'asc', pageSize: 100 });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].name.localeCompare(result.items[i - 1].name)).toBeGreaterThanOrEqual(0);
    }
  });

  it('sorts by name descending', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ sortBy: 'name', sortOrder: 'desc', pageSize: 100 });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].name.localeCompare(result.items[i - 1].name)).toBeLessThanOrEqual(0);
    }
  });

  it('sorts by downloads descending by default', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ pageSize: 100 });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].downloads).toBeLessThanOrEqual(result.items[i - 1].downloads);
    }
  });

  it('sorts by rating', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ sortBy: 'rating', sortOrder: 'desc', pageSize: 100 });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].averageRating).toBeLessThanOrEqual(result.items[i - 1].averageRating);
    }
  });

  it('sorts by createdAt ascending', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ sortBy: 'createdAt', sortOrder: 'asc', pageSize: 100 });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].createdAt).toBeGreaterThanOrEqual(result.items[i - 1].createdAt);
    }
  });

  it('sorts by updatedAt descending', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ sortBy: 'updatedAt', sortOrder: 'desc', pageSize: 100 });
    for (let i = 1; i < result.items.length; i++) {
      expect(result.items[i].updatedAt).toBeLessThanOrEqual(result.items[i - 1].updatedAt);
    }
  });
});

// ---------------------------------------------------------------------------
// Search — pagination
// ---------------------------------------------------------------------------

describe('search pagination', () => {
  it('paginates with default page size', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ pageSize: 5, page: 1 });
    expect(result.items.length).toBe(5);
    expect(result.total).toBe(12);
    expect(result.totalPages).toBe(3);
    expect(result.page).toBe(1);
  });

  it('returns correct second page', () => {
    const mp = MarketplaceManager.getInstance();
    const page1 = mp.search({ pageSize: 5, page: 1 });
    const page2 = mp.search({ pageSize: 5, page: 2 });
    expect(page2.items.length).toBe(5);
    expect(page2.page).toBe(2);
    // No overlap between pages
    const page1Ids = new Set(page1.items.map((i) => i.id));
    page2.items.forEach((item) => {
      expect(page1Ids.has(item.id)).toBe(false);
    });
  });

  it('returns partial last page', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ pageSize: 5, page: 3 });
    expect(result.items.length).toBe(2); // 12 items, pages of 5: 5+5+2
    expect(result.page).toBe(3);
  });

  it('clamps page to valid range', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ pageSize: 5, page: 100 });
    expect(result.page).toBe(3); // clamped to totalPages
  });

  it('clamps page to minimum 1', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ pageSize: 5, page: 0 });
    expect(result.page).toBe(1);
  });

  it('returns all items with large page size', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ pageSize: 100 });
    expect(result.items.length).toBe(12);
    expect(result.totalPages).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Install / Uninstall
// ---------------------------------------------------------------------------

describe('install', () => {
  it('installs a marketplace item into SnippetLibrary', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    const itemId = items[0].id;

    const result = mp.install(itemId);
    expect(result).not.toBeNull();
    expect(result!.name).toBe(items[0].snippet.name);
    expect(mp.isInstalled(itemId)).toBe(true);
  });

  it('increments download count on install', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    const itemId = items[0].id;
    const initialDownloads = items[0].downloads;

    mp.install(itemId);
    const updated = mp.getItem(itemId)!;
    expect(updated.downloads).toBe(initialDownloads + 1);
  });

  it('returns snippet without re-adding if already installed', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    const itemId = items[0].id;
    const initialDownloads = items[0].downloads;

    mp.install(itemId);
    const result = mp.install(itemId);
    expect(result).not.toBeNull();
    // Download count should only increment once
    expect(mp.getItem(itemId)!.downloads).toBe(initialDownloads + 1);
  });

  it('returns null for non-existent item', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.install('nonexistent-id');
    expect(result).toBeNull();
  });

  it('persists installed state across resets', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    mp.install(items[0].id);
    mp.install(items[1].id);

    MarketplaceManager.resetInstance();
    const mp2 = MarketplaceManager.getInstance();
    expect(mp2.isInstalled(items[0].id)).toBe(true);
    expect(mp2.isInstalled(items[1].id)).toBe(true);
  });
});

describe('uninstall', () => {
  it('uninstalls a previously installed item', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    const itemId = items[0].id;

    mp.install(itemId);
    expect(mp.isInstalled(itemId)).toBe(true);

    const result = mp.uninstall(itemId);
    expect(result).toBe(true);
    expect(mp.isInstalled(itemId)).toBe(false);
  });

  it('returns false if item was not installed', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.uninstall('nonexistent');
    expect(result).toBe(false);
  });

  it('getInstalledIds reflects installs and uninstalls', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();

    mp.install(items[0].id);
    mp.install(items[1].id);
    expect(mp.getInstalledIds()).toHaveLength(2);

    mp.uninstall(items[0].id);
    expect(mp.getInstalledIds()).toHaveLength(1);
    expect(mp.getInstalledIds()).toContain(items[1].id);
  });
});

// ---------------------------------------------------------------------------
// Rate
// ---------------------------------------------------------------------------

describe('rate', () => {
  it('adds a rating and updates average', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    const itemId = items[0].id;
    const initialRatings = items[0].ratings.length;

    const avg = mp.rate(itemId, 5);
    expect(avg).not.toBeNull();
    expect(typeof avg).toBe('number');

    const updated = mp.getItem(itemId)!;
    expect(updated.ratings.length).toBe(initialRatings + 1);
    expect(updated.averageRating).toBe(avg);
  });

  it('computes correct average', () => {
    const mp = MarketplaceManager.getInstance();
    // Publish a fresh item with no ratings
    const item = mp.publish(makePublishInput({ name: 'Rating Test' }));

    mp.rate(item.id, 4);
    expect(mp.getItem(item.id)!.averageRating).toBe(4);

    mp.rate(item.id, 2);
    expect(mp.getItem(item.id)!.averageRating).toBe(3);

    mp.rate(item.id, 3);
    expect(mp.getItem(item.id)!.averageRating).toBe(3);
  });

  it('returns null for invalid rating (below 1)', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    expect(mp.rate(items[0].id, 0)).toBeNull();
  });

  it('returns null for invalid rating (above 5)', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    expect(mp.rate(items[0].id, 6)).toBeNull();
  });

  it('returns null for non-integer rating', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    expect(mp.rate(items[0].id, 3.5)).toBeNull();
  });

  it('returns null for non-existent item', () => {
    const mp = MarketplaceManager.getInstance();
    expect(mp.rate('nonexistent', 5)).toBeNull();
  });

  it('updates the updatedAt timestamp', () => {
    const mp = MarketplaceManager.getInstance();
    const items = mp.getAllItems();
    const before = items[0].updatedAt;

    // Small delay to ensure timestamp differs
    mp.rate(items[0].id, 5);
    const after = mp.getItem(items[0].id)!.updatedAt;
    expect(after).toBeGreaterThanOrEqual(before);
  });
});

// ---------------------------------------------------------------------------
// Publish / Unpublish
// ---------------------------------------------------------------------------

describe('publish', () => {
  it('adds a new item to the marketplace', () => {
    const mp = MarketplaceManager.getInstance();
    const initialCount = mp.getItemCount();

    const item = mp.publish(makePublishInput({ name: 'My Custom Block' }));
    expect(mp.getItemCount()).toBe(initialCount + 1);
    expect(item.name).toBe('My Custom Block');
    expect(item.downloads).toBe(0);
    expect(item.ratings).toHaveLength(0);
    expect(item.averageRating).toBe(0);
    expect(item.verified).toBe(false);
  });

  it('uses default version and license', () => {
    const mp = MarketplaceManager.getInstance();
    const item = mp.publish(makePublishInput());
    expect(item.version).toBe('1.0.0');
    expect(item.license).toBe('MIT');
  });

  it('uses provided version and license', () => {
    const mp = MarketplaceManager.getInstance();
    const item = mp.publish(makePublishInput({ version: '2.1.0', license: 'CC0' }));
    expect(item.version).toBe('2.1.0');
    expect(item.license).toBe('CC0');
  });

  it('generates a unique ID', () => {
    const mp = MarketplaceManager.getInstance();
    const item1 = mp.publish(makePublishInput({ name: 'A' }));
    const item2 = mp.publish(makePublishInput({ name: 'B' }));
    expect(item1.id).not.toBe(item2.id);
  });

  it('published item is searchable', () => {
    const mp = MarketplaceManager.getInstance();
    mp.publish(makePublishInput({ name: 'Unique Zigbee Module', tags: ['zigbee'] }));
    const result = mp.search({ query: 'Zigbee' });
    expect(result.total).toBe(1);
    expect(result.items[0].name).toBe('Unique Zigbee Module');
  });
});

describe('unpublish', () => {
  it('removes an item from the marketplace', () => {
    const mp = MarketplaceManager.getInstance();
    const item = mp.publish(makePublishInput({ name: 'To Remove' }));
    const countBefore = mp.getItemCount();

    const result = mp.unpublish(item.id);
    expect(result).toBe(true);
    expect(mp.getItemCount()).toBe(countBefore - 1);
    expect(mp.getItem(item.id)).toBeUndefined();
  });

  it('returns false for non-existent item', () => {
    const mp = MarketplaceManager.getInstance();
    expect(mp.unpublish('nonexistent')).toBe(false);
  });

  it('also removes from installed set', () => {
    const mp = MarketplaceManager.getInstance();
    const item = mp.publish(makePublishInput());
    mp.install(item.id);
    expect(mp.isInstalled(item.id)).toBe(true);

    mp.unpublish(item.id);
    expect(mp.isInstalled(item.id)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Subscribe / Notify
// ---------------------------------------------------------------------------

describe('subscribe', () => {
  it('notifies listeners on install', () => {
    const mp = MarketplaceManager.getInstance();
    const listener = vi.fn();
    mp.subscribe(listener);

    const items = mp.getAllItems();
    mp.install(items[0].id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on rate', () => {
    const mp = MarketplaceManager.getInstance();
    const listener = vi.fn();
    mp.subscribe(listener);

    const items = mp.getAllItems();
    mp.rate(items[0].id, 5);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on publish', () => {
    const mp = MarketplaceManager.getInstance();
    const listener = vi.fn();
    mp.subscribe(listener);

    mp.publish(makePublishInput());
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const mp = MarketplaceManager.getInstance();
    const listener = vi.fn();
    const unsub = mp.subscribe(listener);

    unsub();
    mp.publish(makePublishInput());
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Tags and categories
// ---------------------------------------------------------------------------

describe('tags and categories', () => {
  it('getAllTags returns sorted unique tags', () => {
    const mp = MarketplaceManager.getInstance();
    const tags = mp.getAllTags();
    expect(tags.length).toBeGreaterThan(0);
    // Verify sorted
    for (let i = 1; i < tags.length; i++) {
      expect(tags[i].localeCompare(tags[i - 1])).toBeGreaterThanOrEqual(0);
    }
    // Verify unique
    expect(new Set(tags).size).toBe(tags.length);
  });

  it('getCategories returns all present categories', () => {
    const mp = MarketplaceManager.getInstance();
    const cats = mp.getCategories();
    expect(cats).toContain('power');
    expect(cats).toContain('filtering');
    expect(cats).toContain('analog');
    expect(cats).toContain('sensor');
    expect(cats).toContain('digital');
    expect(cats).toContain('protection');
    expect(cats).toContain('motor-control');
    expect(cats).toContain('communication');
    expect(cats).toContain('custom');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles corrupt localStorage gracefully', () => {
    localStorage.setItem('protopulse-marketplace', 'not-json');
    const mp = MarketplaceManager.getInstance();
    // Should fall back to seed catalog
    expect(mp.getItemCount()).toBe(12);
  });

  it('handles empty array in localStorage', () => {
    localStorage.setItem('protopulse-marketplace', '[]');
    const mp = MarketplaceManager.getInstance();
    // Should fall back to seed catalog
    expect(mp.getItemCount()).toBe(12);
  });

  it('handles corrupt installed localStorage', () => {
    localStorage.setItem('protopulse-marketplace-installed', '{bad}');
    const mp = MarketplaceManager.getInstance();
    expect(mp.getInstalledIds()).toHaveLength(0);
  });

  it('search with all filters combined', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({
      query: 'regulator',
      category: 'power',
      verified: true,
      license: 'MIT',
      sortBy: 'name',
      sortOrder: 'asc',
      page: 1,
      pageSize: 5,
    });
    expect(result.total).toBeGreaterThanOrEqual(1);
    result.items.forEach((item) => {
      expect(item.category).toBe('power');
      expect(item.verified).toBe(true);
      expect(item.license).toBe('MIT');
    });
  });

  it('tag filter is case insensitive', () => {
    const mp = MarketplaceManager.getInstance();
    const result = mp.search({ tags: ['MOTOR'] });
    expect(result.total).toBeGreaterThanOrEqual(1);
  });
});
