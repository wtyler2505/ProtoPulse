import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', {
  randomUUID: vi.fn<() => string>(() => `uuid-${Math.random().toString(36).slice(2, 10)}`),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn<(key: string) => string | null>((key: string) => store[key] ?? null),
  setItem: vi.fn<(key: string, val: string) => void>((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn<(key: string) => void>((key: string) => {
    delete store[key];
  }),
  clear: vi.fn<() => void>(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// Must import after mocks
// eslint-disable-next-line import-x/first
import {
  TeamTemplateManager,
  BUILT_IN_TEMPLATES,
  TEMPLATE_CATEGORIES,
  getTemplateCategoryLabel,
} from '../team-templates';
import type {
  TeamTemplate,
  TemplateCategory,
  AppliedTemplate,
} from '../team-templates';

beforeEach(() => {
  TeamTemplateManager.resetInstance();
  for (const k of Object.keys(store)) {
    delete store[k];
  }
});

// ---------------------------------------------------------------------------
// Built-in templates
// ---------------------------------------------------------------------------

describe('BUILT_IN_TEMPLATES', () => {
  it('should have exactly 5 built-in templates', () => {
    expect(BUILT_IN_TEMPLATES).toHaveLength(5);
  });

  it('should include Arduino Starter template', () => {
    const t = BUILT_IN_TEMPLATES.find((t) => t.id === 'arduino-starter');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Arduino Starter');
    expect(t!.category).toBe('general');
    expect(t!.builtIn).toBe(true);
  });

  it('should include Power Supply template', () => {
    const t = BUILT_IN_TEMPLATES.find((t) => t.id === 'power-supply');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Power Supply');
    expect(t!.category).toBe('power');
  });

  it('should include Sensor Board template', () => {
    const t = BUILT_IN_TEMPLATES.find((t) => t.id === 'sensor-board');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Sensor Board');
    expect(t!.category).toBe('sensor');
  });

  it('should include RF Module template', () => {
    const t = BUILT_IN_TEMPLATES.find((t) => t.id === 'rf-module');
    expect(t).toBeDefined();
    expect(t!.name).toBe('RF Module');
    expect(t!.category).toBe('rf');
  });

  it('should include Educational template', () => {
    const t = BUILT_IN_TEMPLATES.find((t) => t.id === 'educational');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Educational');
    expect(t!.category).toBe('educational');
  });

  it('should mark all built-in templates as builtIn: true', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.builtIn).toBe(true);
    }
  });

  it('each template should have at least one DRC rule', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.drcRules.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each template should have BOM requirements', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.bomRequirements.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each template should have export presets', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.exportPresets.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each template should have naming conventions', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.namingConventions.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each template should have suggested components', () => {
    for (const t of BUILT_IN_TEMPLATES) {
      expect(t.suggestedComponents.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('each template should have unique IDs', () => {
    const ids = BUILT_IN_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ---------------------------------------------------------------------------
// TeamTemplateManager — singleton
// ---------------------------------------------------------------------------

describe('TeamTemplateManager', () => {
  it('should return the same instance on repeated getInstance calls', () => {
    const a = TeamTemplateManager.getInstance();
    const b = TeamTemplateManager.getInstance();
    expect(a).toBe(b);
  });

  it('should return a new instance after resetInstance', () => {
    const a = TeamTemplateManager.getInstance();
    TeamTemplateManager.resetInstance();
    const b = TeamTemplateManager.getInstance();
    expect(a).not.toBe(b);
  });
});

// ---------------------------------------------------------------------------
// TeamTemplateManager — queries
// ---------------------------------------------------------------------------

describe('TeamTemplateManager queries', () => {
  let mgr: TeamTemplateManager;

  beforeEach(() => {
    mgr = TeamTemplateManager.getInstance();
  });

  it('getAllTemplates returns built-in templates when no custom ones exist', () => {
    const all = mgr.getAllTemplates();
    expect(all).toHaveLength(5);
  });

  it('getBuiltInTemplates returns only built-in', () => {
    expect(mgr.getBuiltInTemplates()).toHaveLength(5);
  });

  it('getCustomTemplates returns empty array initially', () => {
    expect(mgr.getCustomTemplates()).toHaveLength(0);
  });

  it('getTemplateById returns correct template', () => {
    const t = mgr.getTemplateById('arduino-starter');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Arduino Starter');
  });

  it('getTemplateById returns undefined for unknown id', () => {
    expect(mgr.getTemplateById('nonexistent')).toBeUndefined();
  });

  it('getTemplatesByCategory filters correctly', () => {
    const power = mgr.getTemplatesByCategory('power');
    expect(power).toHaveLength(1);
    expect(power[0].id).toBe('power-supply');
  });

  it('searchTemplates matches by name', () => {
    const results = mgr.searchTemplates('Arduino');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((t) => t.id === 'arduino-starter')).toBe(true);
  });

  it('searchTemplates matches by description', () => {
    const results = mgr.searchTemplates('impedance');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((t) => t.id === 'rf-module')).toBe(true);
  });

  it('searchTemplates matches by category', () => {
    const results = mgr.searchTemplates('educational');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((t) => t.id === 'educational')).toBe(true);
  });

  it('searchTemplates with empty query returns all templates', () => {
    const results = mgr.searchTemplates('');
    expect(results).toHaveLength(5);
  });

  it('searchTemplates is case-insensitive', () => {
    const results = mgr.searchTemplates('POWER');
    expect(results.some((t) => t.id === 'power-supply')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// TeamTemplateManager — applyTemplate
// ---------------------------------------------------------------------------

describe('TeamTemplateManager applyTemplate', () => {
  let mgr: TeamTemplateManager;

  beforeEach(() => {
    mgr = TeamTemplateManager.getInstance();
  });

  it('returns AppliedTemplate with all fields populated', () => {
    const applied = mgr.applyTemplate('arduino-starter');
    expect(applied).not.toBeNull();
    expect(applied!.templateId).toBe('arduino-starter');
    expect(applied!.templateName).toBe('Arduino Starter');
    expect(applied!.drcRules.length).toBeGreaterThan(0);
    expect(applied!.bomRequirements.length).toBeGreaterThan(0);
    expect(applied!.exportPresets.length).toBeGreaterThan(0);
    expect(applied!.namingConventions.length).toBeGreaterThan(0);
    expect(applied!.suggestedComponents.length).toBeGreaterThan(0);
  });

  it('uses template name as default project name', () => {
    const applied = mgr.applyTemplate('power-supply');
    expect(applied!.projectName).toBe('Power Supply');
  });

  it('uses custom project name when provided', () => {
    const applied = mgr.applyTemplate('power-supply', 'My PSU');
    expect(applied!.projectName).toBe('My PSU');
  });

  it('returns null for unknown template id', () => {
    expect(mgr.applyTemplate('nonexistent')).toBeNull();
  });

  it('includes default project description', () => {
    const applied = mgr.applyTemplate('sensor-board');
    expect(applied!.projectDescription).toBeTruthy();
    expect(typeof applied!.projectDescription).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// TeamTemplateManager — custom template CRUD
// ---------------------------------------------------------------------------

describe('TeamTemplateManager custom templates', () => {
  let mgr: TeamTemplateManager;

  const customData: Omit<TeamTemplate, 'id' | 'builtIn' | 'createdAt'> = {
    name: 'My Custom Template',
    description: 'A custom template for testing',
    category: 'general',
    icon: 'Wrench',
    drcRules: [{ type: 'min-clearance', params: { clearance: 0.3 }, severity: 'error', enabled: true }],
    bomRequirements: [{ field: 'manufacturer', required: true, description: 'Required' }],
    exportPresets: [{ formatId: 'kicad', label: 'KiCad', enabled: true }],
    namingConventions: [{ entity: 'project', pattern: '{Name}', example: 'Test', description: 'Test' }],
    defaultProjectDescription: 'Custom project',
    suggestedComponents: ['Resistor'],
  };

  beforeEach(() => {
    mgr = TeamTemplateManager.getInstance();
  });

  it('addCustomTemplate creates a template with generated id', () => {
    const created = mgr.addCustomTemplate(customData);
    expect(created.id).toMatch(/^custom-/);
    expect(created.builtIn).toBe(false);
    expect(created.name).toBe('My Custom Template');
    expect(created.createdAt).toBeGreaterThan(0);
  });

  it('addCustomTemplate makes it visible in getAllTemplates', () => {
    mgr.addCustomTemplate(customData);
    expect(mgr.getAllTemplates()).toHaveLength(6);
  });

  it('addCustomTemplate persists to localStorage', () => {
    mgr.addCustomTemplate(customData);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      'protopulse-team-templates',
      expect.any(String),
    );
  });

  it('removeCustomTemplate removes by id', () => {
    const created = mgr.addCustomTemplate(customData);
    expect(mgr.removeCustomTemplate(created.id)).toBe(true);
    expect(mgr.getAllTemplates()).toHaveLength(5);
  });

  it('removeCustomTemplate returns false for unknown id', () => {
    expect(mgr.removeCustomTemplate('nonexistent')).toBe(false);
  });

  it('removeCustomTemplate cannot remove built-in templates', () => {
    expect(mgr.removeCustomTemplate('arduino-starter')).toBe(false);
    expect(mgr.getAllTemplates()).toHaveLength(5);
  });

  it('updateCustomTemplate updates fields', () => {
    const created = mgr.addCustomTemplate(customData);
    const updated = mgr.updateCustomTemplate(created.id, { name: 'Renamed Template' });
    expect(updated).not.toBeNull();
    expect(updated!.name).toBe('Renamed Template');
    expect(updated!.id).toBe(created.id);
    expect(updated!.createdAt).toBe(created.createdAt);
  });

  it('updateCustomTemplate returns null for unknown id', () => {
    expect(mgr.updateCustomTemplate('nonexistent', { name: 'X' })).toBeNull();
  });

  it('updateCustomTemplate preserves builtIn=false and original id', () => {
    const created = mgr.addCustomTemplate(customData);
    const updated = mgr.updateCustomTemplate(created.id, { name: 'New Name' });
    expect(updated!.builtIn).toBe(false);
    expect(updated!.id).toBe(created.id);
  });

  it('custom templates survive singleton reset when persisted', () => {
    mgr.addCustomTemplate(customData);
    TeamTemplateManager.resetInstance();
    const newMgr = TeamTemplateManager.getInstance();
    expect(newMgr.getCustomTemplates()).toHaveLength(1);
    expect(newMgr.getCustomTemplates()[0].name).toBe('My Custom Template');
  });
});

// ---------------------------------------------------------------------------
// TeamTemplateManager — subscribe/notify
// ---------------------------------------------------------------------------

describe('TeamTemplateManager subscribe', () => {
  let mgr: TeamTemplateManager;

  beforeEach(() => {
    mgr = TeamTemplateManager.getInstance();
  });

  it('notifies listeners on addCustomTemplate', () => {
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.addCustomTemplate({
      name: 'Test',
      description: 'Test',
      category: 'general',
      icon: 'X',
      drcRules: [],
      bomRequirements: [],
      exportPresets: [],
      namingConventions: [],
      defaultProjectDescription: '',
      suggestedComponents: [],
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notifies listeners on removeCustomTemplate', () => {
    const created = mgr.addCustomTemplate({
      name: 'Test',
      description: 'Test',
      category: 'general',
      icon: 'X',
      drcRules: [],
      bomRequirements: [],
      exportPresets: [],
      namingConventions: [],
      defaultProjectDescription: '',
      suggestedComponents: [],
    });
    const listener = vi.fn();
    mgr.subscribe(listener);
    mgr.removeCustomTemplate(created.id);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = mgr.subscribe(listener);
    unsub();
    mgr.addCustomTemplate({
      name: 'Test',
      description: 'Test',
      category: 'general',
      icon: 'X',
      drcRules: [],
      bomRequirements: [],
      exportPresets: [],
      namingConventions: [],
      defaultProjectDescription: '',
      suggestedComponents: [],
    });
    expect(listener).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

describe('TEMPLATE_CATEGORIES', () => {
  it('has 6 entries (all + 5 categories)', () => {
    expect(TEMPLATE_CATEGORIES).toHaveLength(6);
  });

  it('first entry is "all"', () => {
    expect(TEMPLATE_CATEGORIES[0].value).toBe('all');
  });
});

describe('getTemplateCategoryLabel', () => {
  it('returns label for known category', () => {
    expect(getTemplateCategoryLabel('power')).toBe('Power');
    expect(getTemplateCategoryLabel('rf')).toBe('RF / Wireless');
  });

  it('returns raw category string for unknown category', () => {
    expect(getTemplateCategoryLabel('unknown' as TemplateCategory)).toBe('unknown');
  });
});

// ---------------------------------------------------------------------------
// Template content validation
// ---------------------------------------------------------------------------

describe('template content validation', () => {
  it('Power Supply has strict clearance rules (wider traces for current)', () => {
    const ps = BUILT_IN_TEMPLATES.find((t) => t.id === 'power-supply')!;
    const clearance = ps.drcRules.find((r) => r.type === 'min-clearance');
    expect(clearance).toBeDefined();
    expect(clearance!.params.clearance).toBeGreaterThanOrEqual(0.5);
    expect(clearance!.severity).toBe('error');
  });

  it('Educational has warning severity for most rules (not errors)', () => {
    const edu = BUILT_IN_TEMPLATES.find((t) => t.id === 'educational')!;
    const warnCount = edu.drcRules.filter((r) => r.severity === 'warning').length;
    expect(warnCount).toBeGreaterThanOrEqual(edu.drcRules.length - 1);
  });

  it('RF Module requires datasheet in BOM', () => {
    const rf = BUILT_IN_TEMPLATES.find((t) => t.id === 'rf-module')!;
    const ds = rf.bomRequirements.find((r) => r.field === 'datasheet');
    expect(ds).toBeDefined();
    expect(ds!.required).toBe(true);
  });

  it('Arduino Starter has firmware scaffold export enabled', () => {
    const arduino = BUILT_IN_TEMPLATES.find((t) => t.id === 'arduino-starter')!;
    const fw = arduino.exportPresets.find((p) => p.formatId === 'firmware');
    expect(fw).toBeDefined();
    expect(fw!.enabled).toBe(true);
  });

  it('Sensor Board has bus-prefixed naming convention', () => {
    const sensor = BUILT_IN_TEMPLATES.find((t) => t.id === 'sensor-board')!;
    const busConv = sensor.namingConventions.find((n) => n.pattern.includes('BUS'));
    expect(busConv).toBeDefined();
  });
});
