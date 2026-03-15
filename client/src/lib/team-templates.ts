/**
 * Team Templates — pre-configured project templates with team standards.
 *
 * Each template bundles DRC rules, BOM requirements, export presets,
 * and naming conventions so teams/makers can start new projects with
 * consistent, domain-appropriate defaults.
 *
 * 5 built-in templates: Arduino Starter, Power Supply, Sensor Board,
 * RF Module, Educational. Custom templates can be persisted to localStorage.
 *
 * Usage:
 *   const mgr = TeamTemplateManager.getInstance();
 *   const templates = mgr.getAllTemplates();
 *   const applied = mgr.applyTemplate('arduino-starter');
 */

import type { DRCRuleType } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TemplateCategory = 'general' | 'power' | 'sensor' | 'rf' | 'educational';

export interface TemplateDrcRule {
  readonly type: DRCRuleType;
  readonly params: Record<string, number>;
  readonly severity: 'error' | 'warning';
  readonly enabled: boolean;
}

export interface TemplateBomRequirement {
  readonly field: 'manufacturer' | 'mpn' | 'supplier' | 'datasheet' | 'category' | 'footprint';
  readonly required: boolean;
  readonly description: string;
}

export interface TemplateExportPreset {
  readonly formatId: string;
  readonly label: string;
  readonly enabled: boolean;
}

export interface TemplateNamingConvention {
  readonly entity: 'project' | 'node' | 'net' | 'component' | 'schematic';
  readonly pattern: string;
  readonly example: string;
  readonly description: string;
}

export interface TeamTemplate {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: TemplateCategory;
  readonly icon: string;
  readonly builtIn: boolean;
  readonly drcRules: readonly TemplateDrcRule[];
  readonly bomRequirements: readonly TemplateBomRequirement[];
  readonly exportPresets: readonly TemplateExportPreset[];
  readonly namingConventions: readonly TemplateNamingConvention[];
  readonly defaultProjectDescription: string;
  readonly suggestedComponents: readonly string[];
  readonly createdAt: number;
}

export interface AppliedTemplate {
  readonly templateId: string;
  readonly templateName: string;
  readonly projectName: string;
  readonly projectDescription: string;
  readonly drcRules: readonly TemplateDrcRule[];
  readonly bomRequirements: readonly TemplateBomRequirement[];
  readonly exportPresets: readonly TemplateExportPreset[];
  readonly namingConventions: readonly TemplateNamingConvention[];
  readonly suggestedComponents: readonly string[];
}

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

const COMMON_BOM_REQUIREMENTS: readonly TemplateBomRequirement[] = [
  { field: 'manufacturer', required: true, description: 'Component manufacturer name' },
  { field: 'mpn', required: true, description: 'Manufacturer part number' },
  { field: 'category', required: true, description: 'Component category (Passives, ICs, etc.)' },
];

const COMMON_NAMING_CONVENTIONS: readonly TemplateNamingConvention[] = [
  { entity: 'project', pattern: '{ProjectName}', example: 'MyArduinoBot', description: 'PascalCase project name' },
  { entity: 'net', pattern: '{NET_NAME}', example: 'VCC_3V3', description: 'UPPER_SNAKE_CASE net names' },
  { entity: 'component', pattern: '{RefDes}{Number}', example: 'R1, C5, U2', description: 'Standard reference designators' },
];

const ARDUINO_STARTER: TeamTemplate = {
  id: 'arduino-starter',
  name: 'Arduino Starter',
  description: 'Beginner-friendly template for Arduino-based projects with relaxed DRC rules and common shield-compatible components.',
  category: 'general',
  icon: 'Cpu',
  builtIn: true,
  drcRules: [
    { type: 'min-clearance', params: { clearance: 0.254 }, severity: 'error', enabled: true },
    { type: 'min-trace-width', params: { width: 0.254 }, severity: 'error', enabled: true },
    { type: 'courtyard-overlap', params: { margin: 0.5 }, severity: 'warning', enabled: true },
    { type: 'pad-size', params: { minPad: 1.0 }, severity: 'warning', enabled: true },
    { type: 'annular-ring', params: { minRing: 0.15 }, severity: 'error', enabled: true },
  ],
  bomRequirements: [
    ...COMMON_BOM_REQUIREMENTS,
    { field: 'footprint', required: true, description: 'Through-hole preferred for breadboard compatibility' },
  ],
  exportPresets: [
    { formatId: 'kicad', label: 'KiCad Project', enabled: true },
    { formatId: 'bom-csv', label: 'BOM CSV', enabled: true },
    { formatId: 'firmware', label: 'Firmware Scaffold', enabled: true },
    { formatId: 'gerber', label: 'Gerber Files', enabled: false },
  ],
  namingConventions: [
    ...COMMON_NAMING_CONVENTIONS,
    { entity: 'schematic', pattern: '{BoardName}_schematic', example: 'shield_schematic', description: 'Board-level schematic naming' },
  ],
  defaultProjectDescription: 'Arduino-based project with shield-compatible header layout.',
  suggestedComponents: ['Arduino Mega 2560', 'LED', '220R Resistor', '10K Resistor', 'Push Button', 'Ceramic Capacitor 100nF'],
  createdAt: 0,
};

const POWER_SUPPLY: TeamTemplate = {
  id: 'power-supply',
  name: 'Power Supply',
  description: 'Template for power supply and voltage regulator designs with strict clearance rules and thermal considerations.',
  category: 'power',
  icon: 'Zap',
  builtIn: true,
  drcRules: [
    { type: 'min-clearance', params: { clearance: 0.5 }, severity: 'error', enabled: true },
    { type: 'min-trace-width', params: { width: 0.5 }, severity: 'error', enabled: true },
    { type: 'courtyard-overlap', params: { margin: 1.0 }, severity: 'error', enabled: true },
    { type: 'thermal-relief', params: { spokeWidth: 0.3, gap: 0.3 }, severity: 'error', enabled: true },
    { type: 'trace-to-edge', params: { minDistance: 0.5 }, severity: 'error', enabled: true },
    { type: 'pad-size', params: { minPad: 1.5 }, severity: 'warning', enabled: true },
    { type: 'annular-ring', params: { minRing: 0.2 }, severity: 'error', enabled: true },
  ],
  bomRequirements: [
    ...COMMON_BOM_REQUIREMENTS,
    { field: 'datasheet', required: true, description: 'Datasheet URL required for all power components' },
    { field: 'footprint', required: true, description: 'Thermal pad footprint required for regulators' },
  ],
  exportPresets: [
    { formatId: 'kicad', label: 'KiCad Project', enabled: true },
    { formatId: 'bom-csv', label: 'BOM CSV', enabled: true },
    { formatId: 'gerber', label: 'Gerber Files', enabled: true },
    { formatId: 'design-report', label: 'Design Report', enabled: true },
    { formatId: 'fmea', label: 'FMEA Report', enabled: true },
  ],
  namingConventions: [
    ...COMMON_NAMING_CONVENTIONS,
    { entity: 'node', pattern: '{RAIL_VOLTAGE}', example: 'VCC_5V, VCC_3V3, VCC_12V', description: 'Power rail naming with voltage' },
  ],
  defaultProjectDescription: 'Power supply design with thermal management and voltage regulation.',
  suggestedComponents: ['LM7805', 'LM317', '1N4007 Diode', '470uF Electrolytic Capacitor', '100nF Ceramic Capacitor', 'Fuse Holder'],
  createdAt: 0,
};

const SENSOR_BOARD: TeamTemplate = {
  id: 'sensor-board',
  name: 'Sensor Board',
  description: 'Template for sensor interfacing boards with I2C/SPI bus conventions and signal integrity considerations.',
  category: 'sensor',
  icon: 'Activity',
  builtIn: true,
  drcRules: [
    { type: 'min-clearance', params: { clearance: 0.2 }, severity: 'error', enabled: true },
    { type: 'min-trace-width', params: { width: 0.2 }, severity: 'error', enabled: true },
    { type: 'courtyard-overlap', params: { margin: 0.5 }, severity: 'warning', enabled: true },
    { type: 'silk-overlap', params: { margin: 0.15 }, severity: 'warning', enabled: true },
    { type: 'pad-size', params: { minPad: 0.8 }, severity: 'warning', enabled: true },
    { type: 'annular-ring', params: { minRing: 0.15 }, severity: 'error', enabled: true },
  ],
  bomRequirements: [
    ...COMMON_BOM_REQUIREMENTS,
    { field: 'datasheet', required: true, description: 'Datasheet required for sensor communication protocol verification' },
    { field: 'supplier', required: false, description: 'Preferred supplier for sensor modules' },
  ],
  exportPresets: [
    { formatId: 'kicad', label: 'KiCad Project', enabled: true },
    { formatId: 'bom-csv', label: 'BOM CSV', enabled: true },
    { formatId: 'firmware', label: 'Firmware Scaffold', enabled: true },
    { formatId: 'spice', label: 'SPICE Netlist', enabled: true },
  ],
  namingConventions: [
    ...COMMON_NAMING_CONVENTIONS,
    { entity: 'net', pattern: '{BUS}_{SIGNAL}', example: 'I2C_SDA, SPI_MOSI, UART_TX', description: 'Bus-prefixed signal naming' },
  ],
  defaultProjectDescription: 'Sensor interfacing board with I2C/SPI bus support and signal conditioning.',
  suggestedComponents: ['BME280', 'MPU6050', '4.7K Resistor', '100nF Capacitor', 'Level Shifter', 'JST Connector'],
  createdAt: 0,
};

const RF_MODULE: TeamTemplate = {
  id: 'rf-module',
  name: 'RF Module',
  description: 'Template for RF and wireless designs with strict impedance-controlled trace rules, shielding conventions, and EMI awareness.',
  category: 'rf',
  icon: 'Radio',
  builtIn: true,
  drcRules: [
    { type: 'min-clearance', params: { clearance: 0.15 }, severity: 'error', enabled: true },
    { type: 'min-trace-width', params: { width: 0.15 }, severity: 'error', enabled: true },
    { type: 'courtyard-overlap', params: { margin: 0.8 }, severity: 'error', enabled: true },
    { type: 'trace-to-edge', params: { minDistance: 1.0 }, severity: 'error', enabled: true },
    { type: 'via-in-pad', params: { allowed: 0 }, severity: 'error', enabled: true },
    { type: 'annular-ring', params: { minRing: 0.125 }, severity: 'error', enabled: true },
    { type: 'solder-mask', params: { expansion: 0.05 }, severity: 'warning', enabled: true },
  ],
  bomRequirements: [
    ...COMMON_BOM_REQUIREMENTS,
    { field: 'datasheet', required: true, description: 'Datasheet with RF characteristics and matching network required' },
    { field: 'supplier', required: true, description: 'Supplier with RF-grade components required' },
    { field: 'footprint', required: true, description: 'Impedance-matched footprint required' },
  ],
  exportPresets: [
    { formatId: 'kicad', label: 'KiCad Project', enabled: true },
    { formatId: 'bom-csv', label: 'BOM CSV', enabled: true },
    { formatId: 'gerber', label: 'Gerber Files', enabled: true },
    { formatId: 'design-report', label: 'Design Report', enabled: true },
    { formatId: 'ipc2581', label: 'IPC-2581', enabled: true },
  ],
  namingConventions: [
    ...COMMON_NAMING_CONVENTIONS,
    { entity: 'net', pattern: 'RF_{SIGNAL}', example: 'RF_ANT, RF_TX, RF_RX, RF_GND', description: 'RF-prefixed signal nets for clarity' },
    { entity: 'node', pattern: '{Module}_SHIELD', example: 'BT_SHIELD, WIFI_SHIELD', description: 'Shield/ground plane naming' },
  ],
  defaultProjectDescription: 'RF/wireless module design with impedance-controlled routing and EMI shielding.',
  suggestedComponents: ['ESP32', 'SMA Connector', 'Balun', '0402 Capacitor', '0402 Inductor', 'RF Shield Can'],
  createdAt: 0,
};

const EDUCATIONAL: TeamTemplate = {
  id: 'educational',
  name: 'Educational',
  description: 'Relaxed template for learning and experimentation. Warnings instead of errors, no mandatory BOM fields, all exports enabled.',
  category: 'educational',
  icon: 'GraduationCap',
  builtIn: true,
  drcRules: [
    { type: 'min-clearance', params: { clearance: 0.254 }, severity: 'warning', enabled: true },
    { type: 'min-trace-width', params: { width: 0.254 }, severity: 'warning', enabled: true },
    { type: 'courtyard-overlap', params: { margin: 0.25 }, severity: 'warning', enabled: true },
    { type: 'pad-size', params: { minPad: 0.8 }, severity: 'warning', enabled: false },
  ],
  bomRequirements: [
    { field: 'manufacturer', required: false, description: 'Manufacturer (optional for learning)' },
    { field: 'mpn', required: false, description: 'Part number (optional for learning)' },
    { field: 'category', required: true, description: 'Component category for organization' },
  ],
  exportPresets: [
    { formatId: 'kicad', label: 'KiCad Project', enabled: true },
    { formatId: 'bom-csv', label: 'BOM CSV', enabled: true },
    { formatId: 'spice', label: 'SPICE Netlist', enabled: true },
    { formatId: 'firmware', label: 'Firmware Scaffold', enabled: true },
    { formatId: 'gerber', label: 'Gerber Files', enabled: true },
    { formatId: 'design-report', label: 'Design Report', enabled: true },
  ],
  namingConventions: [
    { entity: 'project', pattern: '{ProjectName}', example: 'BlinkingLED', description: 'Simple descriptive name' },
    { entity: 'component', pattern: '{RefDes}{Number}', example: 'R1, LED1', description: 'Standard reference designators' },
    { entity: 'net', pattern: '{NAME}', example: 'VCC, GND, LED_OUT', description: 'Simple descriptive net names' },
  ],
  defaultProjectDescription: 'Educational electronics project for learning and experimentation.',
  suggestedComponents: ['LED', '220R Resistor', '10K Resistor', 'Push Button', 'Breadboard Wire', '9V Battery Clip'],
  createdAt: 0,
};

export const BUILT_IN_TEMPLATES: readonly TeamTemplate[] = [
  ARDUINO_STARTER,
  POWER_SUPPLY,
  SENSOR_BOARD,
  RF_MODULE,
  EDUCATIONAL,
];

// ---------------------------------------------------------------------------
// Manager (singleton + subscribe pattern)
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-team-templates';

type Listener = () => void;

export class TeamTemplateManager {
  private static instance: TeamTemplateManager | null = null;
  private customTemplates: TeamTemplate[] = [];
  private listeners: Set<Listener> = new Set();

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): TeamTemplateManager {
    if (!TeamTemplateManager.instance) {
      TeamTemplateManager.instance = new TeamTemplateManager();
    }
    return TeamTemplateManager.instance;
  }

  /** Reset singleton — test use only. */
  static resetInstance(): void {
    TeamTemplateManager.instance = null;
  }

  // -------------------------------------------------------------------------
  // Subscribe
  // -------------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const fn of Array.from(this.listeners)) {
      fn();
    }
  }

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  getAllTemplates(): readonly TeamTemplate[] {
    return [...BUILT_IN_TEMPLATES, ...this.customTemplates];
  }

  getBuiltInTemplates(): readonly TeamTemplate[] {
    return BUILT_IN_TEMPLATES;
  }

  getCustomTemplates(): readonly TeamTemplate[] {
    return [...this.customTemplates];
  }

  getTemplateById(id: string): TeamTemplate | undefined {
    return this.getAllTemplates().find((t) => t.id === id);
  }

  getTemplatesByCategory(category: TemplateCategory): readonly TeamTemplate[] {
    return this.getAllTemplates().filter((t) => t.category === category);
  }

  searchTemplates(query: string): readonly TeamTemplate[] {
    if (!query.trim()) {
      return this.getAllTemplates();
    }
    const q = query.toLowerCase().trim();
    return this.getAllTemplates().filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q),
    );
  }

  // -------------------------------------------------------------------------
  // Apply template
  // -------------------------------------------------------------------------

  applyTemplate(templateId: string, projectName?: string): AppliedTemplate | null {
    const template = this.getTemplateById(templateId);
    if (!template) {
      return null;
    }

    return {
      templateId: template.id,
      templateName: template.name,
      projectName: projectName ?? template.name,
      projectDescription: template.defaultProjectDescription,
      drcRules: [...template.drcRules],
      bomRequirements: [...template.bomRequirements],
      exportPresets: [...template.exportPresets],
      namingConventions: [...template.namingConventions],
      suggestedComponents: [...template.suggestedComponents],
    };
  }

  // -------------------------------------------------------------------------
  // Custom template CRUD
  // -------------------------------------------------------------------------

  addCustomTemplate(template: Omit<TeamTemplate, 'id' | 'builtIn' | 'createdAt'>): TeamTemplate {
    const newTemplate: TeamTemplate = {
      ...template,
      id: `custom-${crypto.randomUUID()}`,
      builtIn: false,
      createdAt: Date.now(),
    };
    this.customTemplates.push(newTemplate);
    this.saveToStorage();
    this.notify();
    return newTemplate;
  }

  removeCustomTemplate(id: string): boolean {
    const idx = this.customTemplates.findIndex((t) => t.id === id);
    if (idx === -1) {
      return false;
    }
    this.customTemplates.splice(idx, 1);
    this.saveToStorage();
    this.notify();
    return true;
  }

  updateCustomTemplate(id: string, updates: Partial<Omit<TeamTemplate, 'id' | 'builtIn' | 'createdAt'>>): TeamTemplate | null {
    const idx = this.customTemplates.findIndex((t) => t.id === id);
    if (idx === -1) {
      return null;
    }
    const existing = this.customTemplates[idx];
    const updated: TeamTemplate = { ...existing, ...updates, id: existing.id, builtIn: false, createdAt: existing.createdAt };
    this.customTemplates[idx] = updated;
    this.saveToStorage();
    this.notify();
    return updated;
  }

  // -------------------------------------------------------------------------
  // Persistence
  // -------------------------------------------------------------------------

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this.customTemplates = parsed as TeamTemplate[];
        }
      }
    } catch {
      this.customTemplates = [];
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.customTemplates));
    } catch {
      // localStorage unavailable
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

export function useTeamTemplates() {
  const mgr = TeamTemplateManager.getInstance();

  const allTemplates = useSyncExternalStore(
    useCallback((cb: () => void) => mgr.subscribe(cb), [mgr]),
    () => mgr.getAllTemplates(),
  );

  const builtInTemplates = mgr.getBuiltInTemplates();
  const customTemplates = mgr.getCustomTemplates();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');

  const filteredTemplates = useMemo(() => {
    let result = searchQuery ? mgr.searchTemplates(searchQuery) : allTemplates;
    if (selectedCategory !== 'all') {
      result = result.filter((t) => t.category === selectedCategory);
    }
    return result;
  }, [searchQuery, selectedCategory, allTemplates, mgr]);

  const applyTemplate = useCallback(
    (templateId: string, projectName?: string) => mgr.applyTemplate(templateId, projectName),
    [mgr],
  );

  const addCustomTemplate = useCallback(
    (template: Omit<TeamTemplate, 'id' | 'builtIn' | 'createdAt'>) => mgr.addCustomTemplate(template),
    [mgr],
  );

  const removeCustomTemplate = useCallback((id: string) => mgr.removeCustomTemplate(id), [mgr]);

  return {
    allTemplates,
    builtInTemplates,
    customTemplates,
    filteredTemplates,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    applyTemplate,
    addCustomTemplate,
    removeCustomTemplate,
    getTemplateById: (id: string) => mgr.getTemplateById(id),
  };
}

// Need useMemo import
import { useMemo } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const TEMPLATE_CATEGORIES: readonly { value: TemplateCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'All Templates' },
  { value: 'general', label: 'General' },
  { value: 'power', label: 'Power' },
  { value: 'sensor', label: 'Sensor' },
  { value: 'rf', label: 'RF / Wireless' },
  { value: 'educational', label: 'Educational' },
];

export function getTemplateCategoryLabel(category: TemplateCategory): string {
  const found = TEMPLATE_CATEGORIES.find((c) => c.value === category);
  return found ? found.label : category;
}
