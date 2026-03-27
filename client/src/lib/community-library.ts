/**
 * Community Component Library Browser
 *
 * Client-side community library for browsing, rating, sharing, and importing
 * community-contributed components. Supports search with facets, collections,
 * ratings, download tracking, and localStorage persistence.
 *
 * Usage:
 *   const lib = CommunityLibrary.getInstance();
 *   lib.addComponent({ name: 'NPN Transistor', type: 'schematic-symbol', ... });
 *   const results = lib.search({ query: 'transistor', sort: 'popular' });
 *
 * React hook:
 *   const { components, search, rateComponent, downloadComponent } = useCommunityLibrary();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ComponentType = 'schematic-symbol' | 'footprint' | 'pcb-module' | 'snippet' | '3d-model';
export type SortOption = 'popular' | 'recent' | 'rating' | 'downloads' | 'name';
export type LicenseType = 'CC0' | 'CC-BY' | 'CC-BY-SA' | 'MIT' | 'GPL' | 'proprietary';

export interface CommunityComponent {
  id: string;
  name: string;
  description: string;
  type: ComponentType;
  category: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    reputation: number;
  };
  version: string;
  license: LicenseType;
  downloads: number;
  rating: number; // 0-5
  ratingCount: number;
  createdAt: number;
  updatedAt: number;
  size: number; // bytes
  previewUrl?: string;
  data: Record<string, unknown>; // component-specific data
  dependencies: string[]; // IDs of required components
  compatibility: string[]; // e.g., ['kicad', 'eagle', 'protopulse']
}

export interface UserRating {
  componentId: string;
  userId: string;
  rating: number;
  review?: string;
  createdAt: number;
}

export interface LibraryCollection {
  id: string;
  name: string;
  description: string;
  componentIds: string[];
  isPublic: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface SearchFilters {
  query?: string;
  type?: ComponentType;
  category?: string;
  tags?: string[];
  license?: LicenseType[];
  minRating?: number;
  author?: string;
  compatibility?: string[];
  sort?: SortOption;
  page?: number;
  pageSize?: number;
}

export interface SearchResult {
  components: CommunityComponent[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    types: Array<{ value: string; count: number }>;
    categories: Array<{ value: string; count: number }>;
    licenses: Array<{ value: string; count: number }>;
  };
}

export interface AddComponentInput {
  name: string;
  description: string;
  type: ComponentType;
  category: string;
  tags?: string[];
  author: { id: string; name: string; reputation?: number };
  version?: string;
  license?: LicenseType;
  size?: number;
  previewUrl?: string;
  data?: Record<string, unknown>;
  dependencies?: string[];
  compatibility?: string[];
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  isPublic?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-community-library';

const SEED_COMPONENTS: CommunityComponent[] = [
  {
    id: 'seed-npn-transistor',
    name: 'NPN Transistor (2N2222)',
    description: 'General-purpose NPN bipolar junction transistor symbol with base, collector, and emitter pins.',
    type: 'schematic-symbol',
    category: 'Transistors',
    tags: ['npn', 'bjt', 'transistor', 'switching', 'amplifier'],
    author: { id: 'system', name: 'ProtoPulse', reputation: 100 },
    version: '1.0.0',
    license: 'CC0',
    downloads: 1250,
    rating: 4.7,
    ratingCount: 89,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
    size: 2048,
    data: { pinCount: 3, pins: ['base', 'collector', 'emitter'] },
    dependencies: [],
    compatibility: ['kicad', 'eagle', 'protopulse'],
  },
  {
    id: 'seed-op-amp',
    name: 'Operational Amplifier (LM741)',
    description: 'Standard op-amp schematic symbol with inverting, non-inverting inputs, output, and power rails.',
    type: 'schematic-symbol',
    category: 'ICs',
    tags: ['op-amp', 'amplifier', 'analog', 'linear'],
    author: { id: 'system', name: 'ProtoPulse', reputation: 100 },
    version: '1.0.0',
    license: 'CC0',
    downloads: 980,
    rating: 4.5,
    ratingCount: 67,
    createdAt: 1700100000000,
    updatedAt: 1700100000000,
    size: 3072,
    data: { pinCount: 5, pins: ['in+', 'in-', 'out', 'vcc', 'vee'] },
    dependencies: [],
    compatibility: ['kicad', 'eagle', 'protopulse'],
  },
  {
    id: 'seed-sot23',
    name: 'SOT-23 Footprint',
    description: 'Standard SOT-23 (3-pin) surface-mount footprint with recommended pad dimensions.',
    type: 'footprint',
    category: 'SMD Packages',
    tags: ['sot-23', 'smd', 'surface-mount', '3-pin'],
    author: { id: 'system', name: 'ProtoPulse', reputation: 100 },
    version: '1.0.0',
    license: 'CC0',
    downloads: 2100,
    rating: 4.8,
    ratingCount: 142,
    createdAt: 1700200000000,
    updatedAt: 1700200000000,
    size: 1536,
    data: { padCount: 3, pitch: 0.95, bodyWidth: 1.3, bodyLength: 2.9 },
    dependencies: [],
    compatibility: ['kicad', 'eagle', 'protopulse'],
  },
  {
    id: 'seed-qfp48',
    name: 'QFP-48 Footprint',
    description: 'Quad flat package 48-pin footprint with 0.5mm pitch, suitable for microcontrollers.',
    type: 'footprint',
    category: 'SMD Packages',
    tags: ['qfp', 'smd', '48-pin', 'microcontroller'],
    author: { id: 'system', name: 'ProtoPulse', reputation: 100 },
    version: '1.0.0',
    license: 'CC0',
    downloads: 870,
    rating: 4.3,
    ratingCount: 51,
    createdAt: 1700300000000,
    updatedAt: 1700300000000,
    size: 4096,
    data: { padCount: 48, pitch: 0.5, bodySize: 7.0 },
    dependencies: [],
    compatibility: ['kicad', 'eagle', 'protopulse'],
  },
  {
    id: 'seed-usb-c',
    name: 'USB-C Connector Module',
    description: 'USB Type-C connector PCB module with ESD protection and proper impedance-matched traces.',
    type: 'pcb-module',
    category: 'Connectors',
    tags: ['usb-c', 'connector', 'esd', 'usb'],
    author: { id: 'community-1', name: 'ElectronMaker', reputation: 85 },
    version: '2.1.0',
    license: 'MIT',
    downloads: 3200,
    rating: 4.9,
    ratingCount: 210,
    createdAt: 1700400000000,
    updatedAt: 1701000000000,
    size: 8192,
    data: { pinCount: 24, hasESD: true, dataRate: 'USB 2.0' },
    dependencies: [],
    compatibility: ['kicad', 'protopulse'],
  },
  {
    id: 'seed-vreg',
    name: 'Voltage Regulator Module (LM7805)',
    description: 'Complete 5V voltage regulator circuit with input/output capacitors and thermal pad.',
    type: 'pcb-module',
    category: 'Power',
    tags: ['voltage-regulator', 'power', 'lm7805', '5v', 'linear'],
    author: { id: 'community-2', name: 'PowerDesigner', reputation: 72 },
    version: '1.2.0',
    license: 'CC-BY',
    downloads: 1580,
    rating: 4.4,
    ratingCount: 98,
    createdAt: 1700500000000,
    updatedAt: 1700800000000,
    size: 6144,
    data: { inputVoltageMax: 35, outputVoltage: 5, maxCurrent: 1.5 },
    dependencies: [],
    compatibility: ['kicad', 'eagle', 'protopulse'],
  },
  {
    id: 'seed-hbridge',
    name: 'H-Bridge Motor Driver',
    description: 'Bidirectional H-bridge motor driver snippet using N-channel MOSFETs with bootstrap gate drive.',
    type: 'snippet',
    category: 'Motor Control',
    tags: ['h-bridge', 'motor', 'mosfet', 'driver', 'pwm'],
    author: { id: 'community-3', name: 'MotorWizard', reputation: 90 },
    version: '1.0.0',
    license: 'MIT',
    downloads: 920,
    rating: 4.6,
    ratingCount: 73,
    createdAt: 1700600000000,
    updatedAt: 1700600000000,
    size: 5120,
    data: { componentCount: 8, maxVoltage: 36, maxCurrent: 10 },
    dependencies: [],
    compatibility: ['protopulse'],
  },
  {
    id: 'seed-i2c-sensor',
    name: 'I2C Sensor Interface',
    description: 'Reusable I2C sensor interface snippet with pull-up resistors, bypass capacitors, and address selection.',
    type: 'snippet',
    category: 'Communication',
    tags: ['i2c', 'sensor', 'interface', 'communication', 'pull-up'],
    author: { id: 'community-1', name: 'ElectronMaker', reputation: 85 },
    version: '1.1.0',
    license: 'CC0',
    downloads: 1100,
    rating: 4.2,
    ratingCount: 64,
    createdAt: 1700700000000,
    updatedAt: 1700900000000,
    size: 3584,
    data: { busSpeed: 400000, addressBits: 7, pullUpValue: 4700 },
    dependencies: [],
    compatibility: ['kicad', 'protopulse'],
  },
  {
    id: 'seed-dip8',
    name: 'DIP-8 3D Package',
    description: 'Accurate 3D model of DIP-8 through-hole package with proper lead dimensions and body profile.',
    type: '3d-model',
    category: 'Through-Hole Packages',
    tags: ['dip-8', 'through-hole', '3d', 'package', 'ic'],
    author: { id: 'community-4', name: '3DModelPro', reputation: 78 },
    version: '1.0.0',
    license: 'CC-BY-SA',
    downloads: 650,
    rating: 4.1,
    ratingCount: 38,
    createdAt: 1700800000000,
    updatedAt: 1700800000000,
    size: 15360,
    data: { format: 'STEP', pinCount: 8, bodyWidth: 6.35, bodyLength: 9.27 },
    dependencies: [],
    compatibility: ['kicad', 'protopulse'],
  },
  {
    id: 'seed-barrel-jack',
    name: 'Barrel Jack 3D Model',
    description: '3D model of standard 2.1mm x 5.5mm DC barrel jack connector for power input applications.',
    type: '3d-model',
    category: 'Connectors',
    tags: ['barrel-jack', 'dc', 'power', 'connector', '3d'],
    author: { id: 'community-4', name: '3DModelPro', reputation: 78 },
    version: '1.0.0',
    license: 'CC-BY-SA',
    downloads: 480,
    rating: 4.0,
    ratingCount: 29,
    createdAt: 1700900000000,
    updatedAt: 1700900000000,
    size: 12288,
    data: { format: 'STEP', innerDiameter: 2.1, outerDiameter: 5.5 },
    dependencies: [],
    compatibility: ['kicad', 'eagle', 'protopulse'],
  },
];

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Persistence data shape
// ---------------------------------------------------------------------------

interface LibraryData {
  components: CommunityComponent[];
  ratings: UserRating[];
  collections: LibraryCollection[];
}

// ---------------------------------------------------------------------------
// CommunityLibrary
// ---------------------------------------------------------------------------

/**
 * Manages community component library state with search, ratings, collections,
 * and discovery features. Singleton per application. Notifies subscribers on
 * state changes. Persists to localStorage.
 */
export class CommunityLibrary {
  private static instance: CommunityLibrary | null = null;

  private components: CommunityComponent[];
  private ratings: UserRating[];
  private collections: LibraryCollection[];
  private listeners = new Set<Listener>();

  constructor() {
    this.components = [];
    this.ratings = [];
    this.collections = [];
    this.load();

    // Seed components if library is empty after load
    if (this.components.length === 0) {
      this.components = SEED_COMPONENTS.map((c) => ({ ...c, tags: [...c.tags], dependencies: [...c.dependencies], compatibility: [...c.compatibility], author: { ...c.author }, data: { ...c.data } }));
      this.save();
    }
  }

  /** Get or create the singleton instance. */
  static getInstance(): CommunityLibrary {
    if (!CommunityLibrary.instance) {
      CommunityLibrary.instance = new CommunityLibrary();
    }
    return CommunityLibrary.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    CommunityLibrary.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked on any mutation.
   */
  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Component CRUD
  // -----------------------------------------------------------------------

  /** Add a new component to the library. Returns the created component. */
  addComponent(input: AddComponentInput): CommunityComponent {
    const now = Date.now();
    const component: CommunityComponent = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      type: input.type,
      category: input.category,
      tags: input.tags ?? [],
      author: {
        id: input.author.id,
        name: input.author.name,
        reputation: input.author.reputation ?? 0,
      },
      version: input.version ?? '1.0.0',
      license: input.license ?? 'CC0',
      downloads: 0,
      rating: 0,
      ratingCount: 0,
      createdAt: now,
      updatedAt: now,
      size: input.size ?? 0,
      previewUrl: input.previewUrl,
      data: input.data ?? {},
      dependencies: input.dependencies ?? [],
      compatibility: input.compatibility ?? ['protopulse'],
    };

    this.components.push(component);
    this.save();
    this.notify();
    return component;
  }

  /** Remove a component by ID. Returns false if not found. */
  removeComponent(id: string): boolean {
    const index = this.components.findIndex((c) => c.id === id);
    if (index === -1) {
      return false;
    }
    this.components.splice(index, 1);

    // Remove associated ratings
    this.ratings = this.ratings.filter((r) => r.componentId !== id);

    // Remove from collections
    this.collections.forEach((col) => {
      const idx = col.componentIds.indexOf(id);
      if (idx !== -1) {
        col.componentIds.splice(idx, 1);
      }
    });

    this.save();
    this.notify();
    return true;
  }

  /** Update a component. Returns false if not found. */
  updateComponent(id: string, updates: Partial<Pick<CommunityComponent, 'name' | 'description' | 'category' | 'tags' | 'version' | 'license' | 'size' | 'previewUrl' | 'data' | 'dependencies' | 'compatibility'>>): boolean {
    const component = this.components.find((c) => c.id === id);
    if (!component) {
      return false;
    }

    if (updates.name !== undefined) {
      component.name = updates.name;
    }
    if (updates.description !== undefined) {
      component.description = updates.description;
    }
    if (updates.category !== undefined) {
      component.category = updates.category;
    }
    if (updates.tags !== undefined) {
      component.tags = updates.tags;
    }
    if (updates.version !== undefined) {
      component.version = updates.version;
    }
    if (updates.license !== undefined) {
      component.license = updates.license;
    }
    if (updates.size !== undefined) {
      component.size = updates.size;
    }
    if (updates.previewUrl !== undefined) {
      component.previewUrl = updates.previewUrl;
    }
    if (updates.data !== undefined) {
      component.data = updates.data;
    }
    if (updates.dependencies !== undefined) {
      component.dependencies = updates.dependencies;
    }
    if (updates.compatibility !== undefined) {
      component.compatibility = updates.compatibility;
    }

    component.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  /** Get a component by ID. Returns null if not found. */
  getComponent(id: string): CommunityComponent | null {
    return this.components.find((c) => c.id === id) ?? null;
  }

  /** Get all components. */
  getAllComponents(): CommunityComponent[] {
    return [...this.components];
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  /** Search components with filters, pagination, sorting, and facets. */
  search(filters: SearchFilters): SearchResult {
    let result = [...this.components];
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;

    // Full-text search across name, description, and tags
    if (filters.query) {
      const queryLower = filters.query.toLowerCase();
      result = result.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(queryLower);
        const descMatch = c.description.toLowerCase().includes(queryLower);
        const tagMatch = c.tags.some((t) => t.toLowerCase().includes(queryLower));
        return nameMatch || descMatch || tagMatch;
      });
    }

    // Type filter
    if (filters.type) {
      result = result.filter((c) => c.type === filters.type);
    }

    // Category filter
    if (filters.category) {
      result = result.filter((c) => c.category === filters.category);
    }

    // Tags filter (match any)
    if (filters.tags && filters.tags.length > 0) {
      const filterTagsLower = filters.tags.map((t) => t.toLowerCase());
      result = result.filter((c) =>
        c.tags.some((t) => filterTagsLower.includes(t.toLowerCase())),
      );
    }

    // License filter (match any)
    if (filters.license && filters.license.length > 0) {
      result = result.filter((c) => filters.license!.includes(c.license));
    }

    // Minimum rating filter
    if (filters.minRating !== undefined) {
      result = result.filter((c) => c.rating >= filters.minRating!);
    }

    // Author filter
    if (filters.author) {
      result = result.filter((c) => c.author.id === filters.author);
    }

    // Compatibility filter (match all)
    if (filters.compatibility && filters.compatibility.length > 0) {
      result = result.filter((c) =>
        filters.compatibility!.every((compat) => c.compatibility.includes(compat)),
      );
    }

    // Build facets from filtered results (before pagination)
    const facets = this.buildFacets(result);

    // Sort
    const sort = filters.sort ?? 'popular';
    switch (sort) {
      case 'popular':
        result.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'recent':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'rating':
        result.sort((a, b) => b.rating - a.rating);
        break;
      case 'downloads':
        result.sort((a, b) => b.downloads - a.downloads);
        break;
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }

    const totalCount = result.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    // Paginate
    const startIndex = (page - 1) * pageSize;
    const paginatedComponents = result.slice(startIndex, startIndex + pageSize);

    return {
      components: paginatedComponents,
      totalCount,
      page,
      pageSize,
      totalPages,
      facets,
    };
  }

  private buildFacets(components: CommunityComponent[]): SearchResult['facets'] {
    const typeMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const licenseMap = new Map<string, number>();

    components.forEach((c) => {
      typeMap.set(c.type, (typeMap.get(c.type) ?? 0) + 1);
      categoryMap.set(c.category, (categoryMap.get(c.category) ?? 0) + 1);
      licenseMap.set(c.license, (licenseMap.get(c.license) ?? 0) + 1);
    });

    const mapToArray = (map: Map<string, number>): Array<{ value: string; count: number }> => {
      const arr: Array<{ value: string; count: number }> = [];
      map.forEach((count, value) => {
        arr.push({ value, count });
      });
      return arr.sort((a, b) => b.count - a.count);
    };

    return {
      types: mapToArray(typeMap),
      categories: mapToArray(categoryMap),
      licenses: mapToArray(licenseMap),
    };
  }

  // -----------------------------------------------------------------------
  // Ratings
  // -----------------------------------------------------------------------

  /** Rate a component. Updates existing rating if user already rated. */
  rateComponent(componentId: string, userId: string, rating: number, review?: string): UserRating | null {
    const component = this.components.find((c) => c.id === componentId);
    if (!component) {
      return null;
    }

    const clampedRating = Math.max(0, Math.min(5, rating));
    const now = Date.now();

    // Check for existing rating by this user
    const existingIndex = this.ratings.findIndex(
      (r) => r.componentId === componentId && r.userId === userId,
    );

    let userRating: UserRating;

    if (existingIndex !== -1) {
      // Update existing rating
      this.ratings[existingIndex].rating = clampedRating;
      this.ratings[existingIndex].createdAt = now;
      if (review !== undefined) {
        this.ratings[existingIndex].review = review;
      }
      userRating = { ...this.ratings[existingIndex] };
    } else {
      // Add new rating
      userRating = {
        componentId,
        userId,
        rating: clampedRating,
        review,
        createdAt: now,
      };
      this.ratings.push(userRating);
    }

    // Recalculate component average rating
    const componentRatings = this.ratings.filter((r) => r.componentId === componentId);
    const totalRating = componentRatings.reduce((sum, r) => sum + r.rating, 0);
    component.rating = componentRatings.length > 0 ? totalRating / componentRatings.length : 0;
    component.ratingCount = componentRatings.length;
    component.updatedAt = now;

    this.save();
    this.notify();
    return userRating;
  }

  /** Get a user's rating for a component. Returns null if not rated. */
  getUserRating(componentId: string, userId: string): UserRating | null {
    return this.ratings.find(
      (r) => r.componentId === componentId && r.userId === userId,
    ) ?? null;
  }

  /** Get all ratings for a component. */
  getComponentRatings(componentId: string): UserRating[] {
    return this.ratings.filter((r) => r.componentId === componentId);
  }

  // -----------------------------------------------------------------------
  // Downloads
  // -----------------------------------------------------------------------

  /** Download a component (increments download count). Returns null if not found. */
  downloadComponent(id: string): CommunityComponent | null {
    const component = this.components.find((c) => c.id === id);
    if (!component) {
      return null;
    }

    component.downloads += 1;
    component.updatedAt = Date.now();
    this.save();
    this.notify();
    return { ...component };
  }

  // -----------------------------------------------------------------------
  // Collections
  // -----------------------------------------------------------------------

  /** Create a new collection. Returns the created collection. */
  createCollection(input: CreateCollectionInput): LibraryCollection {
    const now = Date.now();
    const collection: LibraryCollection = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description ?? '',
      componentIds: [],
      isPublic: input.isPublic ?? false,
      createdAt: now,
      updatedAt: now,
    };

    this.collections.push(collection);
    this.save();
    this.notify();
    return collection;
  }

  /** Add a component to a collection. Returns false if collection or component not found. */
  addToCollection(collectionId: string, componentId: string): boolean {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) {
      return false;
    }

    if (!this.components.some((c) => c.id === componentId)) {
      return false;
    }

    if (collection.componentIds.includes(componentId)) {
      return true; // Already in collection
    }

    collection.componentIds.push(componentId);
    collection.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  /** Remove a component from a collection. Returns false if collection not found or component not in collection. */
  removeFromCollection(collectionId: string, componentId: string): boolean {
    const collection = this.collections.find((c) => c.id === collectionId);
    if (!collection) {
      return false;
    }

    const index = collection.componentIds.indexOf(componentId);
    if (index === -1) {
      return false;
    }

    collection.componentIds.splice(index, 1);
    collection.updatedAt = Date.now();
    this.save();
    this.notify();
    return true;
  }

  /** Get a collection by ID. Returns null if not found. */
  getCollection(id: string): LibraryCollection | null {
    return this.collections.find((c) => c.id === id) ?? null;
  }

  /** Get all collections. */
  getCollections(): LibraryCollection[] {
    return [...this.collections];
  }

  /** Delete a collection. Returns false if not found. */
  deleteCollection(id: string): boolean {
    const index = this.collections.findIndex((c) => c.id === id);
    if (index === -1) {
      return false;
    }
    this.collections.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Discovery
  // -----------------------------------------------------------------------

  /** Get featured components — high rating + high downloads. */
  getFeatured(limit = 10): CommunityComponent[] {
    return [...this.components]
      .filter((c) => c.ratingCount > 0)
      .sort((a, b) => {
        // Score = rating * log(downloads + 1) to balance both factors
        const scoreA = a.rating * Math.log(a.downloads + 1);
        const scoreB = b.rating * Math.log(b.downloads + 1);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /** Get trending components — recent + high download velocity. */
  getTrending(limit = 10): CommunityComponent[] {
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

    return [...this.components]
      .sort((a, b) => {
        // Recency factor: newer components get a boost
        const recencyA = Math.max(0, 1 - (now - a.updatedAt) / oneWeekMs);
        const recencyB = Math.max(0, 1 - (now - b.updatedAt) / oneWeekMs);
        // Score = downloads * (1 + recency factor)
        const scoreA = a.downloads * (1 + recencyA);
        const scoreB = b.downloads * (1 + recencyB);
        return scoreB - scoreA;
      })
      .slice(0, limit);
  }

  /** Get newest components, sorted by creation date descending. */
  getNewArrivals(limit = 10): CommunityComponent[] {
    return [...this.components]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, limit);
  }

  /** Get components by a specific author. */
  getByAuthor(authorId: string): CommunityComponent[] {
    return this.components.filter((c) => c.author.id === authorId);
  }

  /** Get related components — same category + shared tags. */
  getRelated(componentId: string, limit = 5): CommunityComponent[] {
    const component = this.components.find((c) => c.id === componentId);
    if (!component) {
      return [];
    }

    const tagSet = new Set(component.tags.map((t) => t.toLowerCase()));

    return this.components
      .filter((c) => c.id !== componentId)
      .map((c) => {
        let score = 0;
        // Same category = strong signal
        if (c.category === component.category) {
          score += 3;
        }
        // Same type = moderate signal
        if (c.type === component.type) {
          score += 2;
        }
        // Shared tags
        c.tags.forEach((t) => {
          if (tagSet.has(t.toLowerCase())) {
            score += 1;
          }
        });
        return { component: c, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => entry.component);
  }

  // -----------------------------------------------------------------------
  // Stats
  // -----------------------------------------------------------------------

  /** Get aggregate library statistics. */
  getStats(): { totalComponents: number; totalDownloads: number; totalAuthors: number; avgRating: number } {
    const totalComponents = this.components.length;
    const totalDownloads = this.components.reduce((sum, c) => sum + c.downloads, 0);

    const authorIds = new Set<string>();
    this.components.forEach((c) => {
      authorIds.add(c.author.id);
    });
    const totalAuthors = authorIds.size;

    const ratedComponents = this.components.filter((c) => c.ratingCount > 0);
    const avgRating = ratedComponents.length > 0
      ? ratedComponents.reduce((sum, c) => sum + c.rating, 0) / ratedComponents.length
      : 0;

    return { totalComponents, totalDownloads, totalAuthors, avgRating };
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export the full library state as a JSON string. */
  exportLibrary(): string {
    const data: LibraryData = {
      components: this.components,
      ratings: this.ratings,
      collections: this.collections,
    };
    return JSON.stringify(data);
  }

  /** Import library data from a JSON string. Returns counts of imported items and errors. */
  importLibrary(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      return { imported: 0, errors: ['Invalid JSON format'] };
    }

    if (typeof parsed !== 'object' || parsed === null) {
      return { imported: 0, errors: ['Data must be an object'] };
    }

    const data = parsed as Record<string, unknown>;

    // Import components
    if (Array.isArray(data.components)) {
      (data.components as unknown[]).forEach((raw, index) => {
        if (typeof raw !== 'object' || raw === null) {
          errors.push(`Component at index ${index}: invalid format`);
          return;
        }
        const comp = raw as Record<string, unknown>;
        if (typeof comp.name !== 'string' || typeof comp.type !== 'string') {
          errors.push(`Component at index ${index}: missing name or type`);
          return;
        }

        // Skip if component with same ID already exists
        if (typeof comp.id === 'string' && this.components.some((c) => c.id === comp.id)) {
          return;
        }

        const validTypes: ComponentType[] = ['schematic-symbol', 'footprint', 'pcb-module', 'snippet', '3d-model'];
        if (!validTypes.includes(comp.type as ComponentType)) {
          errors.push(`Component at index ${index}: invalid type "${String(comp.type)}"`);
          return;
        }

        const now = Date.now();
        const newComp: CommunityComponent = {
          id: typeof comp.id === 'string' ? comp.id : crypto.randomUUID(),
          name: comp.name as string,
          description: typeof comp.description === 'string' ? comp.description : '',
          type: comp.type as ComponentType,
          category: typeof comp.category === 'string' ? comp.category : 'Uncategorized',
          tags: Array.isArray(comp.tags) ? (comp.tags as unknown[]).filter((t): t is string => typeof t === 'string') : [],
          author: typeof comp.author === 'object' && comp.author !== null
            ? {
                id: typeof (comp.author as Record<string, unknown>).id === 'string' ? (comp.author as Record<string, unknown>).id as string : 'unknown',
                name: typeof (comp.author as Record<string, unknown>).name === 'string' ? (comp.author as Record<string, unknown>).name as string : 'Unknown',
                reputation: typeof (comp.author as Record<string, unknown>).reputation === 'number' ? (comp.author as Record<string, unknown>).reputation as number : 0,
              }
            : { id: 'unknown', name: 'Unknown', reputation: 0 },
          version: typeof comp.version === 'string' ? comp.version : '1.0.0',
          license: typeof comp.license === 'string' ? comp.license as LicenseType : 'CC0',
          downloads: typeof comp.downloads === 'number' ? comp.downloads : 0,
          rating: typeof comp.rating === 'number' ? comp.rating : 0,
          ratingCount: typeof comp.ratingCount === 'number' ? comp.ratingCount : 0,
          createdAt: typeof comp.createdAt === 'number' ? comp.createdAt : now,
          updatedAt: typeof comp.updatedAt === 'number' ? comp.updatedAt : now,
          size: typeof comp.size === 'number' ? comp.size : 0,
          previewUrl: typeof comp.previewUrl === 'string' ? comp.previewUrl : undefined,
          data: typeof comp.data === 'object' && comp.data !== null ? comp.data as Record<string, unknown> : {},
          dependencies: Array.isArray(comp.dependencies) ? (comp.dependencies as unknown[]).filter((d): d is string => typeof d === 'string') : [],
          compatibility: Array.isArray(comp.compatibility) ? (comp.compatibility as unknown[]).filter((c): c is string => typeof c === 'string') : ['protopulse'],
        };

        this.components.push(newComp);
        imported++;
      });
    }

    // Import ratings
    if (Array.isArray(data.ratings)) {
      (data.ratings as unknown[]).forEach((raw) => {
        if (typeof raw !== 'object' || raw === null) {
          return;
        }
        const r = raw as Record<string, unknown>;
        if (
          typeof r.componentId === 'string' &&
          typeof r.userId === 'string' &&
          typeof r.rating === 'number' &&
          this.components.some((c) => c.id === r.componentId)
        ) {
          // Skip if rating already exists
          if (!this.ratings.some((existing) => existing.componentId === r.componentId && existing.userId === r.userId)) {
            this.ratings.push({
              componentId: r.componentId,
              userId: r.userId,
              rating: r.rating,
              review: typeof r.review === 'string' ? r.review : undefined,
              createdAt: typeof r.createdAt === 'number' ? r.createdAt : Date.now(),
            });
          }
        }
      });
    }

    // Import collections
    if (Array.isArray(data.collections)) {
      (data.collections as unknown[]).forEach((raw) => {
        if (typeof raw !== 'object' || raw === null) {
          return;
        }
        const col = raw as Record<string, unknown>;
        if (typeof col.name === 'string') {
          if (typeof col.id === 'string' && this.collections.some((c) => c.id === col.id)) {
            return; // Skip duplicates
          }
          const now = Date.now();
          this.collections.push({
            id: typeof col.id === 'string' ? col.id : crypto.randomUUID(),
            name: col.name,
            description: typeof col.description === 'string' ? col.description : '',
            componentIds: Array.isArray(col.componentIds)
              ? (col.componentIds as unknown[]).filter((id): id is string => typeof id === 'string')
              : [],
            isPublic: typeof col.isPublic === 'boolean' ? col.isPublic : false,
            createdAt: typeof col.createdAt === 'number' ? col.createdAt : now,
            updatedAt: typeof col.updatedAt === 'number' ? col.updatedAt : now,
          });
        }
      });
    }

    if (imported > 0 || errors.length === 0) {
      this.save();
      this.notify();
    }

    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Clear all library data. */
  clear(): void {
    this.components = [];
    this.ratings = [];
    this.collections = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist library state to localStorage. */
  private save(): void {
    try {
      const data: LibraryData = {
        components: this.components,
        ratings: this.ratings,
        collections: this.collections,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load library state from localStorage. */
  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      if (Array.isArray(data.components)) {
        this.components = (data.components as unknown[]).filter(
          (c: unknown): c is CommunityComponent =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as CommunityComponent).id === 'string' &&
            typeof (c as CommunityComponent).name === 'string' &&
            typeof (c as CommunityComponent).type === 'string',
        );
      }

      if (Array.isArray(data.ratings)) {
        this.ratings = (data.ratings as unknown[]).filter(
          (r: unknown): r is UserRating =>
            typeof r === 'object' &&
            r !== null &&
            typeof (r as UserRating).componentId === 'string' &&
            typeof (r as UserRating).userId === 'string' &&
            typeof (r as UserRating).rating === 'number',
        );
      }

      if (Array.isArray(data.collections)) {
        this.collections = (data.collections as unknown[]).filter(
          (c: unknown): c is LibraryCollection =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as LibraryCollection).id === 'string' &&
            typeof (c as LibraryCollection).name === 'string',
        );
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the community library in React components.
 * Subscribes to the CommunityLibrary singleton and triggers re-renders on state changes.
 */
export function useCommunityLibrary(): {
  components: CommunityComponent[];
  search: (filters: SearchFilters) => SearchResult;
  rateComponent: (componentId: string, userId: string, rating: number, review?: string) => UserRating | null;
  downloadComponent: (id: string) => CommunityComponent | null;
  collections: LibraryCollection[];
  createCollection: (input: CreateCollectionInput) => LibraryCollection;
  addToCollection: (collectionId: string, componentId: string) => boolean;
  removeFromCollection: (collectionId: string, componentId: string) => boolean;
  deleteCollection: (id: string) => boolean;
  featured: CommunityComponent[];
  trending: CommunityComponent[];
  newArrivals: CommunityComponent[];
  stats: { totalComponents: number; totalDownloads: number; totalAuthors: number; avgRating: number };
  exportLibrary: () => string;
  importLibrary: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    const lib = CommunityLibrary.getInstance();
    const unsubscribe = lib.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const search = useCallback((filters: SearchFilters) => {
    return CommunityLibrary.getInstance().search(filters);
  }, []);

  const rateComponent = useCallback((componentId: string, userId: string, rating: number, review?: string) => {
    return CommunityLibrary.getInstance().rateComponent(componentId, userId, rating, review);
  }, []);

  const downloadComponent = useCallback((id: string) => {
    return CommunityLibrary.getInstance().downloadComponent(id);
  }, []);

  const createCollection = useCallback((input: CreateCollectionInput) => {
    return CommunityLibrary.getInstance().createCollection(input);
  }, []);

  const addToCollection = useCallback((collectionId: string, componentId: string) => {
    return CommunityLibrary.getInstance().addToCollection(collectionId, componentId);
  }, []);

  const removeFromCollection = useCallback((collectionId: string, componentId: string) => {
    return CommunityLibrary.getInstance().removeFromCollection(collectionId, componentId);
  }, []);

  const deleteCollection = useCallback((id: string) => {
    return CommunityLibrary.getInstance().deleteCollection(id);
  }, []);

  const exportLibrary = useCallback(() => {
    return CommunityLibrary.getInstance().exportLibrary();
  }, []);

  const importLibrary = useCallback((json: string) => {
    return CommunityLibrary.getInstance().importLibrary(json);
  }, []);

  const lib = CommunityLibrary.getInstance();

  return {
    components: lib.getAllComponents(),
    search,
    rateComponent,
    downloadComponent,
    collections: lib.getCollections(),
    createCollection,
    addToCollection,
    removeFromCollection,
    deleteCollection,
    featured: lib.getFeatured(),
    trending: lib.getTrending(),
    newArrivals: lib.getNewArrivals(),
    stats: lib.getStats(),
    exportLibrary,
    importLibrary,
  };
}
