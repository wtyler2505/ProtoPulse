/**
 * Community Template Packs
 *
 * Curated bundles of project/circuit/BOM/firmware templates that users can
 * browse, search, filter, install, and uninstall.  Ships with 5 built-in
 * packs.  Installed state persists to localStorage.  Singleton + subscribe
 * pattern with a React hook for easy integration.
 *
 * Usage:
 *   const mgr = CommunityPackManager.getInstance();
 *   mgr.installPack('arduino-starter');
 *   mgr.getInstalledPacks(); // [TemplatePack]
 *
 * React hook:
 *   const { packs, installed, install, uninstall, search, filterByCategory } = useTemplatePacks();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateType = 'project' | 'circuit' | 'bom' | 'firmware';

export type PackCategory =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'power'
  | 'sensors'
  | 'displays'
  | 'motors'
  | 'communication';

export interface TemplateEntry {
  id: string;
  name: string;
  type: TemplateType;
  data: Record<string, unknown>;
}

export interface TemplatePack {
  id: string;
  name: string;
  author: string;
  description: string;
  category: PackCategory;
  tags: string[];
  templates: TemplateEntry[];
  downloads: number;
  rating: number; // 0-5
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Built-in packs
// ---------------------------------------------------------------------------

export const BUILT_IN_PACKS: TemplatePack[] = [
  {
    id: 'arduino-starter',
    name: 'Arduino Starter',
    author: 'ProtoPulse',
    description: 'Essential templates for getting started with Arduino — blink, button, serial, and more.',
    category: 'beginner',
    tags: ['arduino', 'beginner', 'led', 'serial', 'button'],
    templates: [
      {
        id: 'arduino-blink',
        name: 'Blink LED',
        type: 'firmware',
        data: { board: 'arduino-uno', sketch: 'blink', pins: ['D13'] },
      },
      {
        id: 'arduino-button',
        name: 'Button Input',
        type: 'circuit',
        data: { components: ['push-button', 'resistor-10k', 'arduino-uno'], connections: 3 },
      },
      {
        id: 'arduino-serial',
        name: 'Serial Monitor',
        type: 'firmware',
        data: { board: 'arduino-uno', baudRate: 9600, sketch: 'serial-hello' },
      },
      {
        id: 'arduino-starter-bom',
        name: 'Arduino Starter BOM',
        type: 'bom',
        data: { items: ['Arduino Uno', 'Breadboard', 'LED x10', 'Resistor 220R x10', 'Jumper wires'] },
      },
    ],
    downloads: 12450,
    rating: 4.8,
    createdAt: 1704067200000, // 2024-01-01
  },
  {
    id: 'sensor-hub',
    name: 'Sensor Hub',
    author: 'ProtoPulse',
    description: 'Multi-sensor data acquisition templates — temperature, humidity, light, and motion.',
    category: 'sensors',
    tags: ['sensors', 'dht22', 'bme280', 'pir', 'ldr', 'i2c'],
    templates: [
      {
        id: 'sensor-dht22',
        name: 'DHT22 Temperature & Humidity',
        type: 'circuit',
        data: { sensor: 'DHT22', protocol: 'one-wire', pins: ['D2'] },
      },
      {
        id: 'sensor-bme280',
        name: 'BME280 Environmental',
        type: 'circuit',
        data: { sensor: 'BME280', protocol: 'i2c', address: '0x76' },
      },
      {
        id: 'sensor-pir',
        name: 'PIR Motion Detector',
        type: 'firmware',
        data: { sensor: 'HC-SR501', pin: 'D7', debounceMs: 2000 },
      },
      {
        id: 'sensor-hub-project',
        name: 'Multi-Sensor Dashboard',
        type: 'project',
        data: { sensors: ['DHT22', 'BME280', 'LDR'], display: 'OLED-SSD1306' },
      },
    ],
    downloads: 8320,
    rating: 4.6,
    createdAt: 1706745600000, // 2024-02-01
  },
  {
    id: 'power-supply',
    name: 'Power Supply',
    author: 'ProtoPulse',
    description: 'Regulated power supply designs — linear regulators, buck converters, and battery management.',
    category: 'power',
    tags: ['power', 'ldo', 'buck', 'battery', 'voltage-regulator', '7805'],
    templates: [
      {
        id: 'psu-7805',
        name: '7805 Linear Regulator',
        type: 'circuit',
        data: { regulator: 'LM7805', inputRange: '7-35V', output: '5V/1A', caps: ['100uF', '10uF'] },
      },
      {
        id: 'psu-buck',
        name: 'LM2596 Buck Converter',
        type: 'circuit',
        data: { regulator: 'LM2596', inputRange: '4.5-40V', output: '1.25-37V/3A' },
      },
      {
        id: 'psu-lipo-charger',
        name: 'LiPo Battery Charger',
        type: 'circuit',
        data: { charger: 'TP4056', cellCount: 1, maxCurrent: '1A' },
      },
      {
        id: 'psu-bom',
        name: 'Power Supply BOM',
        type: 'bom',
        data: { items: ['LM7805', 'LM2596 module', 'TP4056 module', 'Electrolytic caps', 'Schottky diode'] },
      },
    ],
    downloads: 6780,
    rating: 4.5,
    createdAt: 1709251200000, // 2024-03-01
  },
  {
    id: 'led-matrix',
    name: 'LED Matrix',
    author: 'ProtoPulse',
    description: 'LED matrix and strip control — WS2812B, MAX7219, charlieplexing, and shift registers.',
    category: 'displays',
    tags: ['led', 'neopixel', 'ws2812b', 'max7219', 'spi', 'charlieplex'],
    templates: [
      {
        id: 'led-neopixel-strip',
        name: 'NeoPixel Strip',
        type: 'firmware',
        data: { ledType: 'WS2812B', pin: 'D6', count: 30, library: 'FastLED' },
      },
      {
        id: 'led-max7219-matrix',
        name: 'MAX7219 8x8 Matrix',
        type: 'circuit',
        data: { driver: 'MAX7219', protocol: 'spi', modules: 4, resolution: '32x8' },
      },
      {
        id: 'led-charlieplex',
        name: 'Charlieplexed LEDs',
        type: 'circuit',
        data: { technique: 'charlieplex', pins: 5, leds: 20 },
      },
      {
        id: 'led-matrix-project',
        name: 'LED Matrix Display Project',
        type: 'project',
        data: { display: 'MAX7219', controller: 'ESP32', features: ['scrolling-text', 'animations'] },
      },
    ],
    downloads: 5140,
    rating: 4.3,
    createdAt: 1711929600000, // 2024-04-01
  },
  {
    id: 'robot-arm',
    name: 'Robot Arm',
    author: 'ProtoPulse',
    description: 'Robotic arm control templates — servo drivers, inverse kinematics, and joystick input.',
    category: 'motors',
    tags: ['robot', 'servo', 'pca9685', 'joystick', 'kinematics', 'i2c'],
    templates: [
      {
        id: 'robot-pca9685',
        name: 'PCA9685 Servo Driver',
        type: 'circuit',
        data: { driver: 'PCA9685', protocol: 'i2c', channels: 16, frequency: '50Hz' },
      },
      {
        id: 'robot-joystick',
        name: 'Joystick Control',
        type: 'circuit',
        data: { joystick: 'KY-023', axes: 2, button: true, pins: ['A0', 'A1', 'D2'] },
      },
      {
        id: 'robot-firmware',
        name: 'Arm Control Firmware',
        type: 'firmware',
        data: { servos: 6, library: 'Adafruit_PWMServoDriver', dof: '6-axis' },
      },
      {
        id: 'robot-arm-bom',
        name: 'Robot Arm BOM',
        type: 'bom',
        data: { items: ['PCA9685', 'MG996R servo x6', 'Arduino Mega', 'Joystick module x2', '6V 5A PSU'] },
      },
      {
        id: 'robot-arm-project',
        name: 'Robot Arm Full Project',
        type: 'project',
        data: { dof: 6, controller: 'arduino-mega', driver: 'PCA9685', input: 'joystick' },
      },
    ],
    downloads: 4210,
    rating: 4.7,
    createdAt: 1714521600000, // 2024-05-01
  },
];

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-installed-template-packs';

// ---------------------------------------------------------------------------
// CommunityPackManager
// ---------------------------------------------------------------------------

/**
 * Manages community template packs with localStorage persistence.
 * Singleton per application. Notifies subscribers on state changes.
 */
export class CommunityPackManager {
  private static instance: CommunityPackManager | null = null;

  private packs: TemplatePack[];
  private installedIds: Set<string>;
  private subscribers: Set<() => void>;

  constructor() {
    this.packs = [...BUILT_IN_PACKS];
    this.installedIds = new Set();
    this.subscribers = new Set();
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): CommunityPackManager {
    if (!CommunityPackManager.instance) {
      CommunityPackManager.instance = new CommunityPackManager();
    }
    return CommunityPackManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    CommunityPackManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Return all available packs. Returns a shallow copy. */
  getAllPacks(): TemplatePack[] {
    return [...this.packs];
  }

  /** Get a single pack by ID, or undefined if not found. */
  getPackById(id: string): TemplatePack | undefined {
    return this.packs.find((p) => p.id === id);
  }

  /** Whether a pack is currently installed. */
  isInstalled(packId: string): boolean {
    return this.installedIds.has(packId);
  }

  /** Return only installed packs. */
  getInstalledPacks(): TemplatePack[] {
    return this.packs.filter((p) => this.installedIds.has(p.id));
  }

  /** Return the number of installed packs. */
  getInstalledCount(): number {
    return this.installedIds.size;
  }

  /**
   * Full-text search across pack name, description, author, and tags.
   * Case-insensitive. Returns packs whose any field matches all query tokens.
   */
  searchPacks(query: string): TemplatePack[] {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return this.getAllPacks();
    }
    const tokens = trimmed.toLowerCase().split(/\s+/);
    return this.packs.filter((pack) => {
      const haystack = [pack.name, pack.description, pack.author, ...pack.tags].join(' ').toLowerCase();
      return tokens.every((token) => haystack.includes(token));
    });
  }

  /** Filter packs by category. */
  filterByCategory(category: PackCategory): TemplatePack[] {
    return this.packs.filter((p) => p.category === category);
  }

  /** Filter packs by tag (case-insensitive, any match). */
  filterByTag(tag: string): TemplatePack[] {
    const lower = tag.toLowerCase();
    return this.packs.filter((p) => p.tags.some((t) => t.toLowerCase() === lower));
  }

  /** Get all unique categories present in the pack list. */
  getCategories(): PackCategory[] {
    const categories = new Set<PackCategory>();
    for (const pack of this.packs) {
      categories.add(pack.category);
    }
    return Array.from(categories);
  }

  /** Get all unique tags across all packs. */
  getAllTags(): string[] {
    const tags = new Set<string>();
    for (const pack of this.packs) {
      for (const tag of pack.tags) {
        tags.add(tag.toLowerCase());
      }
    }
    return Array.from(tags).sort();
  }

  // -----------------------------------------------------------------------
  // Mutations
  // -----------------------------------------------------------------------

  /**
   * Install a pack by ID. Increments the pack's download count.
   * Idempotent — installing an already-installed pack is a no-op.
   * Returns false if the pack ID does not exist.
   */
  installPack(packId: string): boolean {
    const pack = this.packs.find((p) => p.id === packId);
    if (!pack) {
      return false;
    }
    if (this.installedIds.has(packId)) {
      return true;
    }
    this.installedIds.add(packId);
    pack.downloads += 1;
    this.save();
    this.notify();
    return true;
  }

  /**
   * Uninstall a pack by ID.
   * Idempotent — uninstalling a non-installed pack is a no-op.
   * Returns false if the pack ID does not exist.
   */
  uninstallPack(packId: string): boolean {
    const pack = this.packs.find((p) => p.id === packId);
    if (!pack) {
      return false;
    }
    if (!this.installedIds.has(packId)) {
      return true;
    }
    this.installedIds.delete(packId);
    this.save();
    this.notify();
    return true;
  }

  /**
   * Add a custom pack to the registry. Rejects if the ID already exists.
   * Returns true on success, false if the ID is a duplicate.
   */
  addPack(pack: TemplatePack): boolean {
    if (this.packs.some((p) => p.id === pack.id)) {
      return false;
    }
    this.packs.push(pack);
    this.notify();
    return true;
  }

  /**
   * Remove a custom pack from the registry. Also uninstalls it.
   * Built-in packs cannot be removed — returns false.
   */
  removePack(packId: string): boolean {
    const isBuiltIn = BUILT_IN_PACKS.some((p) => p.id === packId);
    if (isBuiltIn) {
      return false;
    }
    const index = this.packs.findIndex((p) => p.id === packId);
    if (index === -1) {
      return false;
    }
    this.packs.splice(index, 1);
    this.installedIds.delete(packId);
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /**
   * Subscribe to state changes. Returns an unsubscribe function.
   * Callback is invoked whenever packs are installed, uninstalled, added, or removed.
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

  /** Persist installed pack IDs to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(this.installedIds)));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load installed pack IDs from localStorage. */
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
      if (!Array.isArray(parsed)) {
        this.installedIds = new Set();
        return;
      }
      // Validate each entry is a string
      this.installedIds = new Set(parsed.filter((item): item is string => typeof item === 'string'));
    } catch {
      // Corrupt data — start fresh
      this.installedIds = new Set();
    }
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
 * Hook for accessing community template packs in React components.
 * Subscribes to the CommunityPackManager and triggers re-renders on state changes.
 */
export function useTemplatePacks(): {
  packs: TemplatePack[];
  installed: TemplatePack[];
  installedCount: number;
  install: (packId: string) => boolean;
  uninstall: (packId: string) => boolean;
  isInstalled: (packId: string) => boolean;
  search: (query: string) => TemplatePack[];
  filterByCategory: (category: PackCategory) => TemplatePack[];
  filterByTag: (tag: string) => TemplatePack[];
  getPackById: (id: string) => TemplatePack | undefined;
  categories: PackCategory[];
  tags: string[];
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = CommunityPackManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const install = useCallback((packId: string) => {
    return CommunityPackManager.getInstance().installPack(packId);
  }, []);

  const uninstall = useCallback((packId: string) => {
    return CommunityPackManager.getInstance().uninstallPack(packId);
  }, []);

  const isInstalled = useCallback((packId: string) => {
    return CommunityPackManager.getInstance().isInstalled(packId);
  }, []);

  const search = useCallback((query: string) => {
    return CommunityPackManager.getInstance().searchPacks(query);
  }, []);

  const filterByCategory = useCallback((category: PackCategory) => {
    return CommunityPackManager.getInstance().filterByCategory(category);
  }, []);

  const filterByTag = useCallback((tag: string) => {
    return CommunityPackManager.getInstance().filterByTag(tag);
  }, []);

  const getPackById = useCallback((id: string) => {
    return CommunityPackManager.getInstance().getPackById(id);
  }, []);

  const manager = CommunityPackManager.getInstance();

  return {
    packs: typeof window !== 'undefined' ? manager.getAllPacks() : [],
    installed: typeof window !== 'undefined' ? manager.getInstalledPacks() : [],
    installedCount: typeof window !== 'undefined' ? manager.getInstalledCount() : 0,
    install,
    uninstall,
    isInstalled,
    search,
    filterByCategory,
    filterByTag,
    getPackById,
    categories: typeof window !== 'undefined' ? manager.getCategories() : [],
    tags: typeof window !== 'undefined' ? manager.getAllTags() : [],
  };
}
