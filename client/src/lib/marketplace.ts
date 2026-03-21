/**
 * Marketplace for Reusable Circuit Blocks
 *
 * A singleton manager for discovering, installing, publishing, and rating
 * reusable circuit design blocks. Integrates with SnippetLibrary for
 * install/uninstall operations. Provides fuzzy search, category/tag filtering,
 * sorting, pagination, and a seed catalog of 12 built-in items.
 *
 * Usage:
 *   const mp = MarketplaceManager.getInstance();
 *   const results = mp.search({ query: 'motor', category: 'motor-control' });
 *   mp.install(itemId);
 *   mp.rate(itemId, 5);
 */

import type { DesignSnippet, SnippetCategory } from './design-reuse';
import { SnippetLibrary } from './design-reuse';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MarketplaceItem {
  id: string;
  name: string;
  description: string;
  category: SnippetCategory;
  tags: string[];
  author: string;
  version: string;
  createdAt: number;
  updatedAt: number;
  downloads: number;
  ratings: number[];
  averageRating: number;
  snippet: DesignSnippet;
  verified: boolean;
  license: MarketplaceLicense;
}

export type MarketplaceLicense = 'MIT' | 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'CC0' | 'proprietary';

export type MarketplaceSortField = 'name' | 'downloads' | 'rating' | 'createdAt' | 'updatedAt';
export type MarketplaceSortOrder = 'asc' | 'desc';

export interface MarketplaceSearchOptions {
  query?: string;
  category?: SnippetCategory;
  tags?: string[];
  verified?: boolean;
  license?: MarketplaceLicense;
  sortBy?: MarketplaceSortField;
  sortOrder?: MarketplaceSortOrder;
  page?: number;
  pageSize?: number;
}

export interface MarketplaceSearchResult {
  items: MarketplaceItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface PublishInput {
  name: string;
  description: string;
  category: SnippetCategory;
  tags: string[];
  author: string;
  version?: string;
  snippet: DesignSnippet;
  license?: MarketplaceLicense;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-marketplace';
const INSTALLED_KEY = 'protopulse-marketplace-installed';
const DEFAULT_PAGE_SIZE = 10;

// ---------------------------------------------------------------------------
// Fuzzy matching
// ---------------------------------------------------------------------------

/**
 * Simple fuzzy match scoring. Returns a score >= 0 if text matches query,
 * or -1 if no match. Higher scores indicate better matches.
 * Exact substring match scores highest, then character-order match.
 */
export function fuzzyMatch(text: string, query: string): number {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();

  // Exact substring match — highest score
  if (lowerText.includes(lowerQuery)) {
    // Bonus for starting at the beginning
    const idx = lowerText.indexOf(lowerQuery);
    return 100 - idx + lowerQuery.length;
  }

  // Character-order fuzzy match
  let qi = 0;
  let score = 0;
  let consecutiveBonus = 0;
  for (let ti = 0; ti < lowerText.length && qi < lowerQuery.length; ti++) {
    if (lowerText[ti] === lowerQuery[qi]) {
      qi++;
      consecutiveBonus++;
      score += consecutiveBonus;
    } else {
      consecutiveBonus = 0;
    }
  }

  if (qi === lowerQuery.length) {
    return score;
  }

  return -1;
}

// ---------------------------------------------------------------------------
// Seed catalog
// ---------------------------------------------------------------------------

function createSeedCatalog(): MarketplaceItem[] {
  const now = Date.now();

  const makeSnippet = (
    id: string,
    name: string,
    description: string,
    category: SnippetCategory,
    tags: string[],
    author: string,
  ): DesignSnippet => ({
    id,
    name,
    description,
    category,
    tags,
    nodes: [
      { id: `${id}-n1`, type: 'component', label: name, properties: {}, position: { x: 0, y: 0 } },
    ],
    edges: [],
    wires: [],
    metadata: {
      author,
      createdAt: now - 86400000 * 30,
      updatedAt: now - 86400000 * 5,
      version: 1,
      usageCount: 0,
      rating: 0,
    },
  });

  return [
    {
      id: 'mp-voltage-regulator',
      name: 'LM7805 Voltage Regulator',
      description: 'Classic 5V linear regulator with input/output capacitors for stable DC power supply.',
      category: 'power',
      tags: ['regulator', '5v', 'linear', 'lm7805', 'power-supply'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 30,
      updatedAt: now - 86400000 * 5,
      downloads: 342,
      ratings: [5, 4, 5, 5, 4],
      averageRating: 4.6,
      snippet: makeSnippet('mp-vreg', 'LM7805 Voltage Regulator', 'Classic 5V linear regulator', 'power', ['regulator', '5v'], 'ProtoPulse'),
      verified: true,
      license: 'MIT',
    },
    {
      id: 'mp-h-bridge',
      name: 'H-Bridge Motor Driver',
      description: 'Full H-bridge circuit for bidirectional DC motor control with flyback diodes.',
      category: 'motor-control',
      tags: ['h-bridge', 'motor', 'driver', 'bidirectional', 'pwm'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 28,
      updatedAt: now - 86400000 * 3,
      downloads: 278,
      ratings: [5, 5, 4, 5],
      averageRating: 4.75,
      snippet: makeSnippet('mp-hbridge', 'H-Bridge Motor Driver', 'Full H-bridge for DC motors', 'motor-control', ['h-bridge', 'motor'], 'ProtoPulse'),
      verified: true,
      license: 'MIT',
    },
    {
      id: 'mp-uart-level-shifter',
      name: 'UART Level Shifter (3.3V/5V)',
      description: 'Bidirectional MOSFET-based level shifter for UART communication between 3.3V and 5V logic.',
      category: 'communication',
      tags: ['uart', 'level-shifter', '3v3', '5v', 'mosfet', 'serial'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 25,
      updatedAt: now - 86400000 * 2,
      downloads: 195,
      ratings: [4, 5, 4],
      averageRating: 4.33,
      snippet: makeSnippet('mp-uart-ls', 'UART Level Shifter', 'Bidirectional 3.3V/5V level shifter', 'communication', ['uart', 'level-shifter'], 'ProtoPulse'),
      verified: true,
      license: 'CC-BY-4.0',
    },
    {
      id: 'mp-rc-lowpass',
      name: 'RC Low-Pass Filter',
      description: 'Simple first-order RC low-pass filter for noise reduction and signal conditioning.',
      category: 'filtering',
      tags: ['filter', 'low-pass', 'rc', 'passive', 'analog'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 22,
      updatedAt: now - 86400000 * 1,
      downloads: 412,
      ratings: [5, 5, 5, 4, 5],
      averageRating: 4.8,
      snippet: makeSnippet('mp-rc-lp', 'RC Low-Pass Filter', 'First-order passive low-pass', 'filtering', ['filter', 'low-pass'], 'ProtoPulse'),
      verified: true,
      license: 'CC0',
    },
    {
      id: 'mp-esd-protection',
      name: 'ESD Protection Circuit',
      description: 'TVS diode-based ESD protection for sensitive I/O pins with series resistance.',
      category: 'protection',
      tags: ['esd', 'tvs', 'protection', 'diode', 'io'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 20,
      updatedAt: now - 86400000 * 1,
      downloads: 167,
      ratings: [4, 4, 5],
      averageRating: 4.33,
      snippet: makeSnippet('mp-esd', 'ESD Protection', 'TVS diode ESD protection', 'protection', ['esd', 'tvs'], 'ProtoPulse'),
      verified: true,
      license: 'MIT',
    },
    {
      id: 'mp-spi-flash',
      name: 'SPI Flash Memory Interface',
      description: 'SPI NOR flash memory connection with decoupling capacitors and pull-up resistors.',
      category: 'digital',
      tags: ['spi', 'flash', 'memory', 'nor', 'digital'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 18,
      updatedAt: now - 86400000 * 1,
      downloads: 89,
      ratings: [4, 3, 4],
      averageRating: 3.67,
      snippet: makeSnippet('mp-spi-flash', 'SPI Flash Memory', 'SPI NOR flash interface', 'digital', ['spi', 'flash'], 'ProtoPulse'),
      verified: true,
      license: 'MIT',
    },
    {
      id: 'mp-opamp-inverting',
      name: 'Inverting Op-Amp Amplifier',
      description: 'Classic inverting amplifier configuration with gain set by R2/R1 ratio.',
      category: 'analog',
      tags: ['op-amp', 'amplifier', 'inverting', 'gain', 'analog'],
      author: 'CommunityUser',
      version: '1.2.0',
      createdAt: now - 86400000 * 15,
      updatedAt: now - 86400000 * 2,
      downloads: 231,
      ratings: [5, 5, 4, 5, 4, 5],
      averageRating: 4.67,
      snippet: makeSnippet('mp-opamp-inv', 'Inverting Op-Amp', 'Inverting amplifier configuration', 'analog', ['op-amp', 'inverting'], 'CommunityUser'),
      verified: false,
      license: 'CC-BY-4.0',
    },
    {
      id: 'mp-current-sensor',
      name: 'INA219 Current Sensor',
      description: 'I2C current/power monitor using INA219 with shunt resistor and bypass capacitors.',
      category: 'sensor',
      tags: ['current', 'sensor', 'i2c', 'ina219', 'power-monitor'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 12,
      updatedAt: now - 86400000 * 1,
      downloads: 156,
      ratings: [5, 4, 5, 4],
      averageRating: 4.5,
      snippet: makeSnippet('mp-ina219', 'INA219 Current Sensor', 'I2C current/power monitor', 'sensor', ['current', 'i2c'], 'ProtoPulse'),
      verified: true,
      license: 'MIT',
    },
    {
      id: 'mp-buck-converter',
      name: 'Buck Converter (LM2596)',
      description: 'Step-down switching regulator with inductor, Schottky diode, and output LC filter.',
      category: 'power',
      tags: ['buck', 'converter', 'switching', 'lm2596', 'dc-dc'],
      author: 'CommunityUser',
      version: '2.0.0',
      createdAt: now - 86400000 * 10,
      updatedAt: now - 86400000 * 1,
      downloads: 198,
      ratings: [4, 5, 4, 4, 5],
      averageRating: 4.4,
      snippet: makeSnippet('mp-buck', 'Buck Converter', 'LM2596 step-down regulator', 'power', ['buck', 'dc-dc'], 'CommunityUser'),
      verified: false,
      license: 'CC-BY-SA-4.0',
    },
    {
      id: 'mp-can-transceiver',
      name: 'CAN Bus Transceiver',
      description: 'MCP2551 CAN transceiver with termination resistor and bus filtering.',
      category: 'communication',
      tags: ['can', 'bus', 'transceiver', 'mcp2551', 'automotive'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 8,
      updatedAt: now - 86400000 * 1,
      downloads: 73,
      ratings: [4, 4],
      averageRating: 4.0,
      snippet: makeSnippet('mp-can', 'CAN Bus Transceiver', 'MCP2551 CAN interface', 'communication', ['can', 'bus'], 'ProtoPulse'),
      verified: true,
      license: 'MIT',
    },
    {
      id: 'mp-servo-driver',
      name: 'PCA9685 Servo Driver',
      description: '16-channel I2C PWM/servo driver with external power input and level shifting.',
      category: 'motor-control',
      tags: ['servo', 'pwm', 'i2c', 'pca9685', 'driver'],
      author: 'CommunityUser',
      version: '1.1.0',
      createdAt: now - 86400000 * 5,
      updatedAt: now - 86400000 * 1,
      downloads: 124,
      ratings: [5, 4, 5],
      averageRating: 4.67,
      snippet: makeSnippet('mp-servo', 'PCA9685 Servo Driver', '16-ch I2C PWM driver', 'motor-control', ['servo', 'pwm'], 'CommunityUser'),
      verified: false,
      license: 'CC-BY-4.0',
    },
    {
      id: 'mp-custom-pcb-template',
      name: 'Custom PCB Breakout Template',
      description: 'Blank breakout board template with mounting holes, power header, and GPIO headers.',
      category: 'custom',
      tags: ['pcb', 'breakout', 'template', 'gpio', 'headers'],
      author: 'ProtoPulse',
      version: '1.0.0',
      createdAt: now - 86400000 * 3,
      updatedAt: now,
      downloads: 45,
      ratings: [4, 5],
      averageRating: 4.5,
      snippet: makeSnippet('mp-breakout', 'PCB Breakout Template', 'Blank breakout board', 'custom', ['pcb', 'template'], 'ProtoPulse'),
      verified: true,
      license: 'CC0',
    },
  ];
}

// ---------------------------------------------------------------------------
// MarketplaceManager
// ---------------------------------------------------------------------------

type MarketplaceListener = () => void;

export class MarketplaceManager {
  private static instance: MarketplaceManager | null = null;

  private items: MarketplaceItem[];
  private installedIds: Set<string>;
  private listeners: Set<MarketplaceListener> = new Set();

  private constructor() {
    this.items = this.load();
    this.installedIds = this.loadInstalled();
  }

  static getInstance(): MarketplaceManager {
    if (!MarketplaceManager.instance) {
      MarketplaceManager.instance = new MarketplaceManager();
    }
    return MarketplaceManager.instance;
  }

  /** Reset singleton (for testing). */
  static resetInstance(): void {
    MarketplaceManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private load(): MarketplaceItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as MarketplaceItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Corrupt data — fall through to seed
    }
    const seed = createSeedCatalog();
    this.saveItems(seed);
    return seed;
  }

  private loadInstalled(): Set<string> {
    try {
      const raw = localStorage.getItem(INSTALLED_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        return new Set(parsed);
      }
    } catch {
      // Ignore
    }
    return new Set();
  }

  private saveItems(items?: MarketplaceItem[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items ?? this.items));
  }

  private saveInstalled(): void {
    localStorage.setItem(INSTALLED_KEY, JSON.stringify(Array.from(this.installedIds)));
  }

  private save(): void {
    this.saveItems();
    this.saveInstalled();
  }

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  subscribe(listener: MarketplaceListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => fn());
  }

  // -----------------------------------------------------------------------
  // Read
  // -----------------------------------------------------------------------

  /** Get a marketplace item by ID. */
  getItem(id: string): MarketplaceItem | undefined {
    return this.items.find((item) => item.id === id);
  }

  /** Get all marketplace items. */
  getAllItems(): MarketplaceItem[] {
    return [...this.items];
  }

  /** Get count of items in the marketplace. */
  getItemCount(): number {
    return this.items.length;
  }

  /** Check if an item is installed. */
  isInstalled(id: string): boolean {
    return this.installedIds.has(id);
  }

  /** Get IDs of all installed items. */
  getInstalledIds(): string[] {
    return Array.from(this.installedIds);
  }

  /** Get all unique categories present in the catalog. */
  getCategories(): SnippetCategory[] {
    const cats = new Set<SnippetCategory>();
    this.items.forEach((item) => cats.add(item.category));
    return Array.from(cats);
  }

  /** Get all unique tags present in the catalog. */
  getAllTags(): string[] {
    const tags = new Set<string>();
    this.items.forEach((item) => item.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }

  // -----------------------------------------------------------------------
  // Search
  // -----------------------------------------------------------------------

  /**
   * Search and filter the marketplace catalog.
   * Supports fuzzy text search, category/tag/verified/license filtering,
   * sorting, and pagination.
   */
  search(options: MarketplaceSearchOptions = {}): MarketplaceSearchResult {
    const {
      query,
      category,
      tags,
      verified,
      license,
      sortBy = 'downloads',
      sortOrder = 'desc',
      page = 1,
      pageSize = DEFAULT_PAGE_SIZE,
    } = options;

    let filtered = [...this.items];

    // Category filter
    if (category) {
      filtered = filtered.filter((item) => item.category === category);
    }

    // Tag filter (all specified tags must be present)
    if (tags && tags.length > 0) {
      filtered = filtered.filter((item) =>
        tags.every((t) => item.tags.some((it) => it.toLowerCase() === t.toLowerCase())),
      );
    }

    // Verified filter
    if (verified !== undefined) {
      filtered = filtered.filter((item) => item.verified === verified);
    }

    // License filter
    if (license) {
      filtered = filtered.filter((item) => item.license === license);
    }

    // Fuzzy text search
    if (query && query.trim().length > 0) {
      const q = query.trim();
      const scored = filtered
        .map((item) => {
          const nameScore = fuzzyMatch(item.name, q);
          const descScore = fuzzyMatch(item.description, q);
          const tagScores = item.tags.map((t) => fuzzyMatch(t, q));
          const bestTagScore = tagScores.length > 0 ? Math.max(...tagScores) : -1;
          const bestScore = Math.max(nameScore * 2, descScore, bestTagScore * 1.5);
          return { item, score: bestScore };
        })
        .filter((entry) => entry.score > 0);

      // If we have a search query, default sort by relevance unless explicitly overridden
      if (sortBy === 'downloads' && !options.sortBy) {
        scored.sort((a, b) => b.score - a.score);
        filtered = scored.map((entry) => entry.item);
      } else {
        filtered = scored.map((entry) => entry.item);
      }
    }

    // Sort
    if (!query || options.sortBy) {
      filtered.sort((a, b) => {
        let cmp = 0;
        switch (sortBy) {
          case 'name':
            cmp = a.name.localeCompare(b.name);
            break;
          case 'downloads':
            cmp = a.downloads - b.downloads;
            break;
          case 'rating':
            cmp = a.averageRating - b.averageRating;
            break;
          case 'createdAt':
            cmp = a.createdAt - b.createdAt;
            break;
          case 'updatedAt':
            cmp = a.updatedAt - b.updatedAt;
            break;
        }
        return sortOrder === 'desc' ? -cmp : cmp;
      });
    }

    // Pagination
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const clampedPage = Math.max(1, Math.min(page, totalPages));
    const start = (clampedPage - 1) * pageSize;
    const paged = filtered.slice(start, start + pageSize);

    return {
      items: paged,
      total,
      page: clampedPage,
      pageSize,
      totalPages,
    };
  }

  // -----------------------------------------------------------------------
  // Install / Uninstall
  // -----------------------------------------------------------------------

  /**
   * Install a marketplace item into the local SnippetLibrary.
   * Returns the installed snippet, or null if the item doesn't exist.
   */
  install(id: string): DesignSnippet | null {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      return null;
    }

    if (this.installedIds.has(id)) {
      // Already installed — return the snippet without re-adding
      return item.snippet;
    }

    const snippetLib = SnippetLibrary.getInstance();
    const installed = snippetLib.addSnippet({
      name: item.snippet.name,
      description: item.snippet.description,
      category: item.snippet.category,
      tags: item.snippet.tags,
      nodes: item.snippet.nodes,
      edges: item.snippet.edges,
      wires: item.snippet.wires,
      circuitInstances: item.snippet.circuitInstances,
      circuitNets: item.snippet.circuitNets,
      author: item.author,
      thumbnail: item.snippet.thumbnail,
    });

    item.downloads++;
    this.installedIds.add(id);
    this.save();
    this.notify();

    return installed;
  }

  /**
   * Uninstall a marketplace item — removes from installed set.
   * Note: Does NOT remove from SnippetLibrary (user may have modified it).
   * Returns true if the item was installed and is now uninstalled.
   */
  uninstall(id: string): boolean {
    if (!this.installedIds.has(id)) {
      return false;
    }
    this.installedIds.delete(id);
    this.saveInstalled();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Rate
  // -----------------------------------------------------------------------

  /**
   * Rate a marketplace item (1-5 stars).
   * Returns the updated average rating, or null if item not found or invalid rating.
   */
  rate(id: string, stars: number): number | null {
    if (stars < 1 || stars > 5 || !Number.isInteger(stars)) {
      return null;
    }

    const item = this.items.find((i) => i.id === id);
    if (!item) {
      return null;
    }

    item.ratings.push(stars);
    item.averageRating = Math.round(
      (item.ratings.reduce((sum, r) => sum + r, 0) / item.ratings.length) * 100,
    ) / 100;
    item.updatedAt = Date.now();

    this.saveItems();
    this.notify();

    return item.averageRating;
  }

  // -----------------------------------------------------------------------
  // Publish
  // -----------------------------------------------------------------------

  /**
   * Publish a new item to the marketplace.
   * Returns the created MarketplaceItem.
   */
  publish(input: PublishInput): MarketplaceItem {
    const now = Date.now();
    const item: MarketplaceItem = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      category: input.category,
      tags: [...input.tags],
      author: input.author,
      version: input.version ?? '1.0.0',
      createdAt: now,
      updatedAt: now,
      downloads: 0,
      ratings: [],
      averageRating: 0,
      snippet: { ...input.snippet },
      verified: false,
      license: input.license ?? 'MIT',
    };

    this.items.push(item);
    this.saveItems();
    this.notify();

    return item;
  }

  /**
   * Remove a published item from the marketplace.
   * Returns true if removed, false if not found.
   */
  unpublish(id: string): boolean {
    const index = this.items.findIndex((i) => i.id === id);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    this.installedIds.delete(id);
    this.save();
    this.notify();
    return true;
  }
}
