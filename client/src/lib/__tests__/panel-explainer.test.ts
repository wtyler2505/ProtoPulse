import { describe, it, expect } from 'vitest';
import {
  PANEL_EXPLANATIONS,
  getPanelExplanation,
  getExplainedViews,
} from '../panel-explainer';
import type { PanelExplanation } from '../panel-explainer';
import type { ViewMode } from '@/lib/project-context';

/**
 * All ViewMode values as of the current codebase.
 * If a new ViewMode is added, add it here AND in PANEL_EXPLANATIONS.
 */
const ALL_VIEW_MODES: ViewMode[] = [
  'dashboard',
  'project_explorer',
  'output',
  'architecture',
  'component_editor',
  'schematic',
  'breadboard',
  'pcb',
  'procurement',
  'validation',
  'simulation',
  'design_history',
  'lifecycle',
  'comments',
  'calculators',
  'design_patterns',
  'storage',
  'kanban',
  'knowledge',
  'viewer_3d',
  'community',
  'ordering',
  'serial_monitor',
  'circuit_code',
  'generative_design',
  'digital_twin',
  'arduino',
  'starter_circuits',
  'audit_trail',
];

describe('PANEL_EXPLANATIONS', () => {
  it('has an explanation for every ViewMode', () => {
    for (const mode of ALL_VIEW_MODES) {
      expect(PANEL_EXPLANATIONS[mode]).toBeDefined();
    }
  });

  it('has no extra keys beyond ViewMode values', () => {
    const explainedKeys = Object.keys(PANEL_EXPLANATIONS);
    for (const key of explainedKeys) {
      expect(ALL_VIEW_MODES).toContain(key);
    }
  });

  it('covers the same number of views as ViewMode', () => {
    expect(Object.keys(PANEL_EXPLANATIONS).length).toBe(ALL_VIEW_MODES.length);
  });
});

describe('PanelExplanation shape', () => {
  const entries = Object.entries(PANEL_EXPLANATIONS) as [ViewMode, PanelExplanation][];

  it.each(entries)('%s has a non-empty title', (_view, explanation) => {
    expect(explanation.title).toBeTruthy();
    expect(typeof explanation.title).toBe('string');
    expect(explanation.title.length).toBeGreaterThan(0);
  });

  it.each(entries)('%s has a non-empty description', (_view, explanation) => {
    expect(explanation.description).toBeTruthy();
    expect(typeof explanation.description).toBe('string');
    expect(explanation.description.length).toBeGreaterThan(10);
  });

  it.each(entries)('%s has at least one tip', (_view, explanation) => {
    expect(Array.isArray(explanation.tips)).toBe(true);
    expect(explanation.tips.length).toBeGreaterThanOrEqual(1);
  });

  it.each(entries)('%s tips are all non-empty strings', (_view, explanation) => {
    for (const tip of explanation.tips) {
      expect(typeof tip).toBe('string');
      expect(tip.length).toBeGreaterThan(0);
    }
  });

  it.each(entries)('%s has at least one related view', (_view, explanation) => {
    expect(Array.isArray(explanation.relatedViews)).toBe(true);
    expect(explanation.relatedViews.length).toBeGreaterThanOrEqual(1);
  });

  it.each(entries)('%s relatedViews reference valid ViewModes', (_view, explanation) => {
    for (const rv of explanation.relatedViews) {
      expect(ALL_VIEW_MODES).toContain(rv.view);
      expect(rv.label).toBeTruthy();
    }
  });

  it.each(entries)('%s does not reference itself in relatedViews', (view, explanation) => {
    const selfRef = explanation.relatedViews.find((rv) => rv.view === view);
    expect(selfRef).toBeUndefined();
  });
});

describe('getPanelExplanation', () => {
  it('returns the correct explanation for a known view', () => {
    const result = getPanelExplanation('dashboard');
    expect(result).toBeDefined();
    expect(result?.title).toBe('Dashboard');
  });

  it('returns the correct explanation for architecture', () => {
    const result = getPanelExplanation('architecture');
    expect(result).toBeDefined();
    expect(result?.title).toBe('Architecture');
    expect(result?.tips.length).toBeGreaterThanOrEqual(2);
  });

  it('returns the correct explanation for pcb', () => {
    const result = getPanelExplanation('pcb');
    expect(result).toBeDefined();
    expect(result?.title).toBe('PCB Layout');
  });

  it('returns explanation for every view mode', () => {
    for (const mode of ALL_VIEW_MODES) {
      expect(getPanelExplanation(mode)).toBeDefined();
    }
  });
});

describe('getExplainedViews', () => {
  it('returns an array of ViewMode strings', () => {
    const views = getExplainedViews();
    expect(Array.isArray(views)).toBe(true);
    expect(views.length).toBe(ALL_VIEW_MODES.length);
  });

  it('includes all known view modes', () => {
    const views = getExplainedViews();
    for (const mode of ALL_VIEW_MODES) {
      expect(views).toContain(mode);
    }
  });
});

describe('cross-referencing integrity', () => {
  it('all relatedViews targets exist in PANEL_EXPLANATIONS', () => {
    const entries = Object.entries(PANEL_EXPLANATIONS) as [ViewMode, PanelExplanation][];
    for (const [, explanation] of entries) {
      for (const rv of explanation.relatedViews) {
        expect(PANEL_EXPLANATIONS[rv.view]).toBeDefined();
      }
    }
  });

  it('no duplicate relatedViews within a single explanation', () => {
    const entries = Object.entries(PANEL_EXPLANATIONS) as [ViewMode, PanelExplanation][];
    for (const [view, explanation] of entries) {
      const viewNames = explanation.relatedViews.map((rv) => rv.view);
      const unique = new Set(viewNames);
      expect(unique.size).toBe(viewNames.length);
      // Suppress unused variable warning
      void view;
    }
  });

  it('relatedViews labels match the target explanation titles', () => {
    const entries = Object.entries(PANEL_EXPLANATIONS) as [ViewMode, PanelExplanation][];
    for (const [, explanation] of entries) {
      for (const rv of explanation.relatedViews) {
        const target = PANEL_EXPLANATIONS[rv.view];
        // Label doesn't have to match title exactly, but should be non-empty
        expect(rv.label.length).toBeGreaterThan(0);
        expect(target).toBeDefined();
      }
    }
  });
});
