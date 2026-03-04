import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) { delete store[k]; } }),
});

import {
  CommunityLibrary,
  useCommunityLibrary,
} from '../community-library';
import type {
  CommunityComponent,
  SearchFilters,
  AddComponentInput,
} from '../community-library';

function makeInput(overrides: Partial<AddComponentInput> = {}): AddComponentInput {
  return {
    name: 'Test Component',
    description: 'A test component',
    type: 'schematic-symbol',
    category: 'Test',
    tags: ['test'],
    author: { id: 'user-1', name: 'TestUser', reputation: 50 },
    version: '1.0.0',
    license: 'MIT',
    size: 1024,
    data: { foo: 'bar' },
    dependencies: [],
    compatibility: ['protopulse'],
    ...overrides,
  };
}

describe('CommunityLibrary', () => {
  beforeEach(() => {
    CommunityLibrary.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Seed Components
  // -----------------------------------------------------------------------

  describe('seed components', () => {
    it('should load 10 built-in seed components on first initialization', () => {
      const lib = CommunityLibrary.getInstance();
      const all = lib.getAllComponents();
      expect(all).toHaveLength(10);
    });

    it('should include seed components of all types', () => {
      const lib = CommunityLibrary.getInstance();
      const all = lib.getAllComponents();
      const types = new Set(all.map((c) => c.type));
      expect(types.has('schematic-symbol')).toBe(true);
      expect(types.has('footprint')).toBe(true);
      expect(types.has('pcb-module')).toBe(true);
      expect(types.has('snippet')).toBe(true);
      expect(types.has('3d-model')).toBe(true);
    });

    it('should have the NPN transistor seed component', () => {
      const lib = CommunityLibrary.getInstance();
      const npn = lib.getComponent('seed-npn-transistor');
      expect(npn).not.toBeNull();
      expect(npn!.name).toContain('NPN');
      expect(npn!.type).toBe('schematic-symbol');
    });

    it('should have the op-amp seed component', () => {
      const lib = CommunityLibrary.getInstance();
      const opamp = lib.getComponent('seed-op-amp');
      expect(opamp).not.toBeNull();
      expect(opamp!.name).toContain('Operational Amplifier');
    });
  });

  // -----------------------------------------------------------------------
  // Component CRUD
  // -----------------------------------------------------------------------

  describe('addComponent', () => {
    it('should add a component and return it with generated ID', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.addComponent(makeInput());
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Test Component');
      expect(result.type).toBe('schematic-symbol');
      expect(result.downloads).toBe(0);
      expect(result.rating).toBe(0);
      expect(result.ratingCount).toBe(0);
    });

    it('should set default values for optional fields', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.addComponent({
        name: 'Minimal',
        description: 'Minimal component',
        type: 'footprint',
        category: 'Test',
        author: { id: 'u1', name: 'User' },
      });
      expect(result.version).toBe('1.0.0');
      expect(result.license).toBe('CC0');
      expect(result.tags).toEqual([]);
      expect(result.compatibility).toEqual(['protopulse']);
      expect(result.author.reputation).toBe(0);
    });

    it('should store the component so it can be retrieved', () => {
      const lib = CommunityLibrary.getInstance();
      const added = lib.addComponent(makeInput({ name: 'Retrievable' }));
      const retrieved = lib.getComponent(added.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Retrievable');
    });
  });

  describe('getComponent', () => {
    it('should return null for non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.getComponent('nonexistent-id')).toBeNull();
    });
  });

  describe('getAllComponents', () => {
    it('should include both seed and user-added components', () => {
      const lib = CommunityLibrary.getInstance();
      lib.addComponent(makeInput({ name: 'Custom' }));
      const all = lib.getAllComponents();
      expect(all.length).toBe(11); // 10 seed + 1 custom
    });
  });

  describe('updateComponent', () => {
    it('should update specified fields', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const result = lib.updateComponent(comp.id, { name: 'Updated Name', tags: ['updated'] });
      expect(result).toBe(true);
      const updated = lib.getComponent(comp.id);
      expect(updated!.name).toBe('Updated Name');
      expect(updated!.tags).toEqual(['updated']);
    });

    it('should update the updatedAt timestamp', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const before = comp.updatedAt;
      lib.updateComponent(comp.id, { name: 'After' });
      const after = lib.getComponent(comp.id)!.updatedAt;
      expect(after).toBeGreaterThanOrEqual(before);
    });

    it('should return false for non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.updateComponent('bad-id', { name: 'Nope' })).toBe(false);
    });
  });

  describe('removeComponent', () => {
    it('should remove a component', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      expect(lib.removeComponent(comp.id)).toBe(true);
      expect(lib.getComponent(comp.id)).toBeNull();
    });

    it('should return false for non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.removeComponent('bad-id')).toBe(false);
    });

    it('should remove associated ratings when component is removed', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      lib.rateComponent(comp.id, 'user-1', 5);
      lib.removeComponent(comp.id);
      expect(lib.getComponentRatings(comp.id)).toHaveLength(0);
    });

    it('should remove component from collections when removed', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const col = lib.createCollection({ name: 'My Collection' });
      lib.addToCollection(col.id, comp.id);
      lib.removeComponent(comp.id);
      const updatedCol = lib.getCollection(col.id);
      expect(updatedCol!.componentIds).not.toContain(comp.id);
    });
  });

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  describe('search', () => {
    it('should return all components with no filters', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({});
      expect(result.totalCount).toBe(10);
      expect(result.components.length).toBeLessThanOrEqual(20);
    });

    it('should search by name', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ query: 'transistor' });
      expect(result.totalCount).toBeGreaterThan(0);
      result.components.forEach((c) => {
        const combined = `${c.name} ${c.description} ${c.tags.join(' ')}`.toLowerCase();
        expect(combined).toContain('transistor');
      });
    });

    it('should search by description', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ query: 'bipolar' });
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should search by tags', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ query: 'mosfet' });
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should filter by type', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ type: 'footprint' });
      expect(result.totalCount).toBe(2);
      result.components.forEach((c) => {
        expect(c.type).toBe('footprint');
      });
    });

    it('should filter by category', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ category: 'Connectors' });
      expect(result.totalCount).toBeGreaterThan(0);
      result.components.forEach((c) => {
        expect(c.category).toBe('Connectors');
      });
    });

    it('should filter by license', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ license: ['MIT'] });
      expect(result.totalCount).toBeGreaterThan(0);
      result.components.forEach((c) => {
        expect(c.license).toBe('MIT');
      });
    });

    it('should filter by minimum rating', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ minRating: 4.5 });
      result.components.forEach((c) => {
        expect(c.rating).toBeGreaterThanOrEqual(4.5);
      });
    });

    it('should filter by author', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ author: 'community-1' });
      expect(result.totalCount).toBe(2);
      result.components.forEach((c) => {
        expect(c.author.id).toBe('community-1');
      });
    });

    it('should filter by tags array', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ tags: ['usb', 'connector'] });
      expect(result.totalCount).toBeGreaterThan(0);
    });

    it('should filter by compatibility', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ compatibility: ['eagle'] });
      result.components.forEach((c) => {
        expect(c.compatibility).toContain('eagle');
      });
    });

    it('should return empty results for no-match query', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ query: 'xyznonexistent123' });
      expect(result.totalCount).toBe(0);
      expect(result.components).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Pagination
  // -----------------------------------------------------------------------

  describe('pagination', () => {
    it('should paginate results', () => {
      const lib = CommunityLibrary.getInstance();
      const page1 = lib.search({ pageSize: 3, page: 1 });
      expect(page1.components).toHaveLength(3);
      expect(page1.page).toBe(1);
      expect(page1.pageSize).toBe(3);
      expect(page1.totalPages).toBe(4); // ceil(10/3)
      expect(page1.totalCount).toBe(10);

      const page2 = lib.search({ pageSize: 3, page: 2 });
      expect(page2.components).toHaveLength(3);
      expect(page2.page).toBe(2);
    });

    it('should handle last page with fewer results', () => {
      const lib = CommunityLibrary.getInstance();
      const lastPage = lib.search({ pageSize: 3, page: 4 });
      expect(lastPage.components).toHaveLength(1); // 10 mod 3 = 1
    });

    it('should default to page 1 and pageSize 20', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({});
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });
  });

  // -----------------------------------------------------------------------
  // Sorting
  // -----------------------------------------------------------------------

  describe('sorting', () => {
    it('should sort by popular (downloads desc)', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ sort: 'popular' });
      for (let i = 1; i < result.components.length; i++) {
        expect(result.components[i - 1].downloads).toBeGreaterThanOrEqual(result.components[i].downloads);
      }
    });

    it('should sort by recent (createdAt desc)', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ sort: 'recent' });
      for (let i = 1; i < result.components.length; i++) {
        expect(result.components[i - 1].createdAt).toBeGreaterThanOrEqual(result.components[i].createdAt);
      }
    });

    it('should sort by rating (rating desc)', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ sort: 'rating' });
      for (let i = 1; i < result.components.length; i++) {
        expect(result.components[i - 1].rating).toBeGreaterThanOrEqual(result.components[i].rating);
      }
    });

    it('should sort by downloads (downloads desc)', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ sort: 'downloads' });
      for (let i = 1; i < result.components.length; i++) {
        expect(result.components[i - 1].downloads).toBeGreaterThanOrEqual(result.components[i].downloads);
      }
    });

    it('should sort by name (alphabetical asc)', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({ sort: 'name' });
      for (let i = 1; i < result.components.length; i++) {
        expect(result.components[i - 1].name.localeCompare(result.components[i].name)).toBeLessThanOrEqual(0);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Facets
  // -----------------------------------------------------------------------

  describe('facets', () => {
    it('should return type facets', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({});
      expect(result.facets.types.length).toBeGreaterThan(0);
      const totalCount = result.facets.types.reduce((sum, f) => sum + f.count, 0);
      expect(totalCount).toBe(10);
    });

    it('should return category facets', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({});
      expect(result.facets.categories.length).toBeGreaterThan(0);
    });

    it('should return license facets', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({});
      expect(result.facets.licenses.length).toBeGreaterThan(0);
    });

    it('should sort facets by count descending', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({});
      for (let i = 1; i < result.facets.types.length; i++) {
        expect(result.facets.types[i - 1].count).toBeGreaterThanOrEqual(result.facets.types[i].count);
      }
    });
  });

  // -----------------------------------------------------------------------
  // Ratings
  // -----------------------------------------------------------------------

  describe('ratings', () => {
    it('should add a rating to a component', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const rating = lib.rateComponent(comp.id, 'user-1', 4, 'Great component');
      expect(rating).not.toBeNull();
      expect(rating!.rating).toBe(4);
      expect(rating!.review).toBe('Great component');
    });

    it('should update the component average rating', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      lib.rateComponent(comp.id, 'user-1', 4);
      lib.rateComponent(comp.id, 'user-2', 2);
      const updated = lib.getComponent(comp.id);
      expect(updated!.rating).toBe(3); // (4+2)/2
      expect(updated!.ratingCount).toBe(2);
    });

    it('should update existing rating from same user', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      lib.rateComponent(comp.id, 'user-1', 3);
      lib.rateComponent(comp.id, 'user-1', 5);
      const updated = lib.getComponent(comp.id);
      expect(updated!.rating).toBe(5); // Updated, not averaged with old
      expect(updated!.ratingCount).toBe(1);
    });

    it('should clamp rating to 0-5 range', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      lib.rateComponent(comp.id, 'user-1', 10);
      const updated = lib.getComponent(comp.id);
      expect(updated!.rating).toBe(5);
    });

    it('should return null when rating non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.rateComponent('nonexistent', 'user-1', 5);
      expect(result).toBeNull();
    });

    it('should retrieve user rating', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      lib.rateComponent(comp.id, 'user-1', 4, 'Nice');
      const rating = lib.getUserRating(comp.id, 'user-1');
      expect(rating).not.toBeNull();
      expect(rating!.rating).toBe(4);
      expect(rating!.review).toBe('Nice');
    });

    it('should return null for non-existent user rating', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      expect(lib.getUserRating(comp.id, 'user-999')).toBeNull();
    });

    it('should get all ratings for a component', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      lib.rateComponent(comp.id, 'user-1', 5);
      lib.rateComponent(comp.id, 'user-2', 3);
      lib.rateComponent(comp.id, 'user-3', 4);
      const ratings = lib.getComponentRatings(comp.id);
      expect(ratings).toHaveLength(3);
    });
  });

  // -----------------------------------------------------------------------
  // Downloads
  // -----------------------------------------------------------------------

  describe('downloadComponent', () => {
    it('should increment download count', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      expect(comp.downloads).toBe(0);
      lib.downloadComponent(comp.id);
      lib.downloadComponent(comp.id);
      const updated = lib.getComponent(comp.id);
      expect(updated!.downloads).toBe(2);
    });

    it('should return a copy of the component', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const downloaded = lib.downloadComponent(comp.id);
      expect(downloaded).not.toBeNull();
      expect(downloaded!.name).toBe(comp.name);
    });

    it('should return null for non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.downloadComponent('bad-id')).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // Collections
  // -----------------------------------------------------------------------

  describe('collections', () => {
    it('should create a collection', () => {
      const lib = CommunityLibrary.getInstance();
      const col = lib.createCollection({ name: 'Favorites', description: 'My favorites' });
      expect(col.id).toBeDefined();
      expect(col.name).toBe('Favorites');
      expect(col.description).toBe('My favorites');
      expect(col.componentIds).toEqual([]);
      expect(col.isPublic).toBe(false);
    });

    it('should add a component to a collection', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const col = lib.createCollection({ name: 'My Parts' });
      expect(lib.addToCollection(col.id, comp.id)).toBe(true);
      const updated = lib.getCollection(col.id);
      expect(updated!.componentIds).toContain(comp.id);
    });

    it('should not duplicate component in collection', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const col = lib.createCollection({ name: 'Dupes' });
      lib.addToCollection(col.id, comp.id);
      lib.addToCollection(col.id, comp.id);
      const updated = lib.getCollection(col.id);
      expect(updated!.componentIds.filter((id) => id === comp.id)).toHaveLength(1);
    });

    it('should return false when adding to non-existent collection', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      expect(lib.addToCollection('bad-col', comp.id)).toBe(false);
    });

    it('should return false when adding non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      const col = lib.createCollection({ name: 'Test' });
      expect(lib.addToCollection(col.id, 'bad-comp')).toBe(false);
    });

    it('should remove a component from a collection', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const col = lib.createCollection({ name: 'Remove Test' });
      lib.addToCollection(col.id, comp.id);
      expect(lib.removeFromCollection(col.id, comp.id)).toBe(true);
      const updated = lib.getCollection(col.id);
      expect(updated!.componentIds).not.toContain(comp.id);
    });

    it('should return false when removing from non-existent collection', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.removeFromCollection('bad-col', 'any-id')).toBe(false);
    });

    it('should return false when removing non-present component from collection', () => {
      const lib = CommunityLibrary.getInstance();
      const col = lib.createCollection({ name: 'Test' });
      expect(lib.removeFromCollection(col.id, 'not-in-collection')).toBe(false);
    });

    it('should get all collections', () => {
      const lib = CommunityLibrary.getInstance();
      lib.createCollection({ name: 'Col 1' });
      lib.createCollection({ name: 'Col 2' });
      expect(lib.getCollections()).toHaveLength(2);
    });

    it('should return null for non-existent collection', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.getCollection('nope')).toBeNull();
    });

    it('should delete a collection', () => {
      const lib = CommunityLibrary.getInstance();
      const col = lib.createCollection({ name: 'Delete Me' });
      expect(lib.deleteCollection(col.id)).toBe(true);
      expect(lib.getCollection(col.id)).toBeNull();
    });

    it('should return false when deleting non-existent collection', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.deleteCollection('bad-id')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Discovery
  // -----------------------------------------------------------------------

  describe('getFeatured', () => {
    it('should return components with high rating and downloads', () => {
      const lib = CommunityLibrary.getInstance();
      const featured = lib.getFeatured(5);
      expect(featured.length).toBeGreaterThan(0);
      expect(featured.length).toBeLessThanOrEqual(5);
      // Featured should have ratings
      featured.forEach((c) => {
        expect(c.ratingCount).toBeGreaterThan(0);
      });
    });

    it('should respect the limit parameter', () => {
      const lib = CommunityLibrary.getInstance();
      const featured = lib.getFeatured(2);
      expect(featured).toHaveLength(2);
    });
  });

  describe('getTrending', () => {
    it('should return components sorted by download velocity', () => {
      const lib = CommunityLibrary.getInstance();
      const trending = lib.getTrending(5);
      expect(trending.length).toBeGreaterThan(0);
      expect(trending.length).toBeLessThanOrEqual(5);
    });

    it('should respect the limit parameter', () => {
      const lib = CommunityLibrary.getInstance();
      const trending = lib.getTrending(3);
      expect(trending.length).toBeLessThanOrEqual(3);
    });
  });

  describe('getNewArrivals', () => {
    it('should return components sorted by creation date descending', () => {
      const lib = CommunityLibrary.getInstance();
      const arrivals = lib.getNewArrivals(10);
      for (let i = 1; i < arrivals.length; i++) {
        expect(arrivals[i - 1].createdAt).toBeGreaterThanOrEqual(arrivals[i].createdAt);
      }
    });

    it('should respect the limit parameter', () => {
      const lib = CommunityLibrary.getInstance();
      const arrivals = lib.getNewArrivals(3);
      expect(arrivals).toHaveLength(3);
    });
  });

  describe('getByAuthor', () => {
    it('should return components by a specific author', () => {
      const lib = CommunityLibrary.getInstance();
      const authorComponents = lib.getByAuthor('community-1');
      expect(authorComponents).toHaveLength(2);
      authorComponents.forEach((c) => {
        expect(c.author.id).toBe('community-1');
      });
    });

    it('should return empty array for unknown author', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.getByAuthor('unknown-author')).toHaveLength(0);
    });
  });

  describe('getRelated', () => {
    it('should return components in the same category', () => {
      const lib = CommunityLibrary.getInstance();
      // seed-usb-c is in 'Connectors', seed-barrel-jack is also in 'Connectors'
      const related = lib.getRelated('seed-usb-c');
      const relatedIds = related.map((c) => c.id);
      expect(relatedIds).toContain('seed-barrel-jack');
    });

    it('should not include the source component', () => {
      const lib = CommunityLibrary.getInstance();
      const related = lib.getRelated('seed-usb-c');
      const relatedIds = related.map((c) => c.id);
      expect(relatedIds).not.toContain('seed-usb-c');
    });

    it('should return empty array for non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.getRelated('nonexistent')).toHaveLength(0);
    });

    it('should respect the limit parameter', () => {
      const lib = CommunityLibrary.getInstance();
      const related = lib.getRelated('seed-npn-transistor', 2);
      expect(related.length).toBeLessThanOrEqual(2);
    });

    it('should rank components with shared tags higher', () => {
      const lib = CommunityLibrary.getInstance();
      // Add a component with same category and tags as NPN transistor
      lib.addComponent(makeInput({
        name: 'PNP Transistor',
        category: 'Transistors',
        tags: ['bjt', 'transistor', 'pnp'],
        type: 'schematic-symbol',
      }));
      const related = lib.getRelated('seed-npn-transistor');
      // The PNP transistor should be highly ranked due to same category + shared tags
      expect(related.length).toBeGreaterThan(0);
      expect(related[0].name).toBe('PNP Transistor');
    });
  });

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  describe('getStats', () => {
    it('should return correct aggregate statistics', () => {
      const lib = CommunityLibrary.getInstance();
      const stats = lib.getStats();
      expect(stats.totalComponents).toBe(10);
      expect(stats.totalDownloads).toBeGreaterThan(0);
      expect(stats.totalAuthors).toBeGreaterThan(0);
      expect(stats.avgRating).toBeGreaterThan(0);
    });

    it('should return 0 avgRating when no components have ratings', () => {
      const lib = CommunityLibrary.getInstance();
      lib.clear();
      lib.addComponent(makeInput());
      const stats = lib.getStats();
      expect(stats.avgRating).toBe(0);
    });

    it('should count unique authors', () => {
      const lib = CommunityLibrary.getInstance();
      const stats = lib.getStats();
      // Seed data has: 'system', 'community-1', 'community-2', 'community-3', 'community-4'
      expect(stats.totalAuthors).toBe(5);
    });
  });

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  describe('exportLibrary', () => {
    it('should export library as valid JSON string', () => {
      const lib = CommunityLibrary.getInstance();
      const json = lib.exportLibrary();
      const parsed = JSON.parse(json) as { components: unknown[]; ratings: unknown[]; collections: unknown[] };
      expect(parsed.components).toBeInstanceOf(Array);
      expect(parsed.ratings).toBeInstanceOf(Array);
      expect(parsed.collections).toBeInstanceOf(Array);
    });
  });

  describe('importLibrary', () => {
    it('should import components from exported JSON', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput({ name: 'Export Test' }));
      const json = lib.exportLibrary();

      // Reset and import
      lib.clear();
      expect(lib.getAllComponents()).toHaveLength(0);

      const result = lib.importLibrary(json);
      expect(result.imported).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle round-trip export/import', () => {
      const lib = CommunityLibrary.getInstance();
      lib.addComponent(makeInput({ name: 'Round Trip' }));
      const exported = lib.exportLibrary();
      lib.clear();
      lib.importLibrary(exported);
      const found = lib.getAllComponents().find((c) => c.name === 'Round Trip');
      expect(found).toBeDefined();
    });

    it('should handle malformed JSON', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.importLibrary('not json at all');
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Invalid JSON format');
    });

    it('should handle non-object JSON', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.importLibrary('"just a string"');
      expect(result.imported).toBe(0);
      expect(result.errors).toContain('Data must be an object');
    });

    it('should report errors for invalid components', () => {
      const lib = CommunityLibrary.getInstance();
      lib.clear();
      const json = JSON.stringify({
        components: [
          { name: 'Valid', type: 'footprint', description: 'ok', category: 'Test' },
          { noName: true },
          { name: 'BadType', type: 'invalid-type' },
        ],
      });
      const result = lib.importLibrary(json);
      expect(result.imported).toBe(1);
      expect(result.errors.length).toBe(2);
    });

    it('should skip duplicate components by ID', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput({ name: 'Original' }));
      const json = JSON.stringify({
        components: [{ ...comp, name: 'Duplicate' }],
      });
      const before = lib.getAllComponents().length;
      lib.importLibrary(json);
      expect(lib.getAllComponents().length).toBe(before);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('should save to localStorage on mutation', () => {
      const lib = CommunityLibrary.getInstance();
      lib.addComponent(makeInput());
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'protopulse-community-library',
        expect.any(String),
      );
    });

    it('should load from localStorage on construction', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput({ name: 'Persisted' }));
      const savedJson = store['protopulse-community-library'];
      expect(savedJson).toBeDefined();

      // Reset singleton and re-create (simulates page reload)
      CommunityLibrary.resetForTesting();
      const lib2 = CommunityLibrary.getInstance();
      const found = lib2.getComponent(comp.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('Persisted');
    });

    it('should handle corrupt localStorage data gracefully', () => {
      store['protopulse-community-library'] = 'not valid json';
      CommunityLibrary.resetForTesting();
      const lib = CommunityLibrary.getInstance();
      // Should fall back to seed components
      expect(lib.getAllComponents().length).toBe(10);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  describe('subscribe/notify', () => {
    it('should call listeners on state changes', () => {
      const lib = CommunityLibrary.getInstance();
      const listener = vi.fn();
      lib.subscribe(listener);
      lib.addComponent(makeInput());
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should call multiple listeners', () => {
      const lib = CommunityLibrary.getInstance();
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      lib.subscribe(listener1);
      lib.subscribe(listener2);
      lib.addComponent(makeInput());
      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it('should stop calling listener after unsubscribe', () => {
      const lib = CommunityLibrary.getInstance();
      const listener = vi.fn();
      const unsubscribe = lib.subscribe(listener);
      unsubscribe();
      lib.addComponent(makeInput());
      expect(listener).not.toHaveBeenCalled();
    });

    it('should notify on removeComponent', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const listener = vi.fn();
      lib.subscribe(listener);
      lib.removeComponent(comp.id);
      expect(listener).toHaveBeenCalled();
    });

    it('should notify on updateComponent', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const listener = vi.fn();
      lib.subscribe(listener);
      lib.updateComponent(comp.id, { name: 'Changed' });
      expect(listener).toHaveBeenCalled();
    });

    it('should notify on rateComponent', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const listener = vi.fn();
      lib.subscribe(listener);
      lib.rateComponent(comp.id, 'user-1', 5);
      expect(listener).toHaveBeenCalled();
    });

    it('should notify on downloadComponent', () => {
      const lib = CommunityLibrary.getInstance();
      const comp = lib.addComponent(makeInput());
      const listener = vi.fn();
      lib.subscribe(listener);
      lib.downloadComponent(comp.id);
      expect(listener).toHaveBeenCalled();
    });

    it('should notify on collection mutations', () => {
      const lib = CommunityLibrary.getInstance();
      const listener = vi.fn();
      lib.subscribe(listener);
      const col = lib.createCollection({ name: 'Test' });
      expect(listener).toHaveBeenCalled();
      listener.mockClear();
      lib.deleteCollection(col.id);
      expect(listener).toHaveBeenCalled();
    });

    it('should notify on clear', () => {
      const lib = CommunityLibrary.getInstance();
      const listener = vi.fn();
      lib.subscribe(listener);
      lib.clear();
      expect(listener).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle empty library after clear', () => {
      const lib = CommunityLibrary.getInstance();
      lib.clear();
      expect(lib.getAllComponents()).toHaveLength(0);
      expect(lib.getCollections()).toHaveLength(0);
      const stats = lib.getStats();
      expect(stats.totalComponents).toBe(0);
      expect(stats.totalDownloads).toBe(0);
      expect(stats.totalAuthors).toBe(0);
      expect(stats.avgRating).toBe(0);
    });

    it('should handle search with no results', () => {
      const lib = CommunityLibrary.getInstance();
      lib.clear();
      const result = lib.search({ query: 'anything' });
      expect(result.totalCount).toBe(0);
      expect(result.components).toHaveLength(0);
      expect(result.totalPages).toBe(1);
    });

    it('should handle rating a non-existent component', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.rateComponent('no-such-id', 'user-1', 5)).toBeNull();
    });

    it('should handle combined search filters', () => {
      const lib = CommunityLibrary.getInstance();
      const result = lib.search({
        type: 'schematic-symbol',
        minRating: 4.0,
        sort: 'rating',
      });
      result.components.forEach((c) => {
        expect(c.type).toBe('schematic-symbol');
        expect(c.rating).toBeGreaterThanOrEqual(4.0);
      });
    });

    it('should handle getFeatured with empty library', () => {
      const lib = CommunityLibrary.getInstance();
      lib.clear();
      expect(lib.getFeatured()).toHaveLength(0);
    });

    it('should handle getRelated with no related components', () => {
      const lib = CommunityLibrary.getInstance();
      lib.clear();
      const comp = lib.addComponent(makeInput({ category: 'Unique', tags: ['unique-tag'] }));
      expect(lib.getRelated(comp.id)).toHaveLength(0);
    });

    it('should handle getByAuthor with no matches', () => {
      const lib = CommunityLibrary.getInstance();
      expect(lib.getByAuthor('nobody')).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Hook shape
  // -----------------------------------------------------------------------

  describe('useCommunityLibrary', () => {
    it('should export a function', () => {
      expect(typeof useCommunityLibrary).toBe('function');
    });

    it('should have the expected properties', () => {
      // We just verify the hook is exported and is a function
      // Full hook testing requires a React rendering environment
      expect(useCommunityLibrary).toBeDefined();
    });
  });
});
