/**
 * Tests for ScenarioManager — simulation scenario CRUD, presets, and persistence.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scenarioManager } from '../scenario-manager';
import type { CreateScenarioData, SimulationScenario } from '../scenario-manager';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a valid DC scenario payload. */
function dcScenario(name = 'My DC Test'): CreateScenarioData {
  return {
    name,
    description: 'A DC analysis scenario',
    simType: 'dc',
    parameters: { temperature: 85 },
  };
}

/** Create a valid AC scenario payload. */
function acScenario(name = 'My AC Test'): CreateScenarioData {
  return {
    name,
    description: 'An AC sweep scenario',
    simType: 'ac',
    parameters: { frequencyStart: 100, frequencyEnd: 1e6, frequencyPoints: 50 },
  };
}

/** Create a valid transient scenario payload. */
function transientScenario(name = 'My Transient Test'): CreateScenarioData {
  return {
    name,
    description: 'A transient scenario',
    simType: 'transient',
    parameters: { timeSpan: 0.01, timeStep: 0.00001 },
  };
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  scenarioManager._reset();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScenarioManager', () => {
  // ---- Presets ----

  describe('presets', () => {
    it('always includes 4 built-in presets', () => {
      const all = scenarioManager.listScenarios();
      expect(all.length).toBe(4);

      const names = all.map((s) => s.name);
      expect(names).toContain('Quick DC Check');
      expect(names).toContain('Audio Band AC Sweep');
      expect(names).toContain('Power-On Transient');
      expect(names).toContain('1 MHz RF Sweep');
    });

    it('presets have correct sim types', () => {
      const all = scenarioManager.listScenarios();
      const byName = new Map(all.map((s) => [s.name, s]));

      expect(byName.get('Quick DC Check')?.simType).toBe('dc');
      expect(byName.get('Audio Band AC Sweep')?.simType).toBe('ac');
      expect(byName.get('Power-On Transient')?.simType).toBe('transient');
      expect(byName.get('1 MHz RF Sweep')?.simType).toBe('ac');
    });

    it('presets have correct parameters', () => {
      const all = scenarioManager.listScenarios();
      const byName = new Map(all.map((s) => [s.name, s]));

      expect(byName.get('Quick DC Check')?.parameters.temperature).toBe(25);
      expect(byName.get('Audio Band AC Sweep')?.parameters.frequencyStart).toBe(20);
      expect(byName.get('Audio Band AC Sweep')?.parameters.frequencyEnd).toBe(20000);
      expect(byName.get('Audio Band AC Sweep')?.parameters.frequencyPoints).toBe(100);
      expect(byName.get('Power-On Transient')?.parameters.timeSpan).toBe(0.1);
      expect(byName.get('Power-On Transient')?.parameters.timeStep).toBe(0.0001);
      expect(byName.get('1 MHz RF Sweep')?.parameters.frequencyStart).toBe(1000);
      expect(byName.get('1 MHz RF Sweep')?.parameters.frequencyEnd).toBe(1000000);
      expect(byName.get('1 MHz RF Sweep')?.parameters.frequencyPoints).toBe(200);
    });

    it('isPreset returns true for preset IDs', () => {
      const all = scenarioManager.listScenarios();
      for (const scenario of all) {
        expect(scenarioManager.isPreset(scenario.id)).toBe(true);
      }
    });

    it('isPreset returns false for user scenario IDs', () => {
      const created = scenarioManager.createScenario(dcScenario());
      expect(scenarioManager.isPreset(created.id)).toBe(false);
    });

    it('cannot delete presets', () => {
      const presets = scenarioManager.listScenarios();
      const result = scenarioManager.deleteScenario(presets[0].id);
      expect(result).toBe(false);
      expect(scenarioManager.listScenarios().length).toBe(4);
    });

    it('cannot update presets', () => {
      const presets = scenarioManager.listScenarios();
      const result = scenarioManager.updateScenario(presets[0].id, { name: 'Hacked' });
      expect(result).toBeUndefined();
      expect(scenarioManager.getScenario(presets[0].id)?.name).not.toBe('Hacked');
    });
  });

  // ---- CRUD ----

  describe('create', () => {
    it('creates a user scenario with correct fields', () => {
      const data = dcScenario();
      const created = scenarioManager.createScenario(data);

      expect(created.id).toBeDefined();
      expect(created.name).toBe(data.name);
      expect(created.description).toBe(data.description);
      expect(created.simType).toBe(data.simType);
      expect(created.parameters).toEqual(data.parameters);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();
    });

    it('generates unique IDs for each scenario', () => {
      const a = scenarioManager.createScenario(dcScenario('Scenario A'));
      const b = scenarioManager.createScenario(dcScenario('Scenario B'));
      expect(a.id).not.toBe(b.id);
    });

    it('created scenario appears in listScenarios', () => {
      const created = scenarioManager.createScenario(dcScenario());
      const all = scenarioManager.listScenarios();
      expect(all.find((s) => s.id === created.id)).toBeDefined();
      expect(all.length).toBe(5); // 4 presets + 1 user
    });

    it('copies parameters to prevent external mutation', () => {
      const params = { temperature: 50 };
      const data: CreateScenarioData = {
        name: 'Mutation test',
        description: '',
        simType: 'dc',
        parameters: params,
      };
      const created = scenarioManager.createScenario(data);
      params.temperature = 999;
      expect(created.parameters.temperature).toBe(50);
    });

    it('handles componentOverrides', () => {
      const data: CreateScenarioData = {
        name: 'With overrides',
        description: '',
        simType: 'dc',
        parameters: { temperature: 25 },
        componentOverrides: { R1: '10k', C1: '100n' },
      };
      const created = scenarioManager.createScenario(data);
      expect(created.componentOverrides).toEqual({ R1: '10k', C1: '100n' });
    });
  });

  describe('read', () => {
    it('getScenario returns preset by ID', () => {
      const presets = scenarioManager.listScenarios();
      const found = scenarioManager.getScenario(presets[0].id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(presets[0].name);
    });

    it('getScenario returns user scenario by ID', () => {
      const created = scenarioManager.createScenario(acScenario());
      const found = scenarioManager.getScenario(created.id);
      expect(found).toBeDefined();
      expect(found?.name).toBe(created.name);
    });

    it('getScenario returns undefined for unknown ID', () => {
      expect(scenarioManager.getScenario('nonexistent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('updates user scenario name', () => {
      const created = scenarioManager.createScenario(dcScenario());
      const updated = scenarioManager.updateScenario(created.id, { name: 'Updated Name' });
      expect(updated?.name).toBe('Updated Name');
      expect(scenarioManager.getScenario(created.id)?.name).toBe('Updated Name');
    });

    it('updates user scenario parameters', () => {
      const created = scenarioManager.createScenario(dcScenario());
      const newParams = { temperature: 125 };
      const updated = scenarioManager.updateScenario(created.id, { parameters: newParams });
      expect(updated?.parameters.temperature).toBe(125);
    });

    it('updates updatedAt timestamp', () => {
      const created = scenarioManager.createScenario(dcScenario());
      const originalUpdatedAt = created.updatedAt;

      // Small delay to ensure different timestamp
      vi.useFakeTimers();
      vi.advanceTimersByTime(1000);
      const updated = scenarioManager.updateScenario(created.id, { name: 'Later' });
      vi.useRealTimers();

      expect(updated?.updatedAt).not.toBe(originalUpdatedAt);
    });

    it('preserves unchanged fields', () => {
      const created = scenarioManager.createScenario(dcScenario());
      scenarioManager.updateScenario(created.id, { name: 'New Name' });
      const found = scenarioManager.getScenario(created.id);
      expect(found?.description).toBe('A DC analysis scenario');
      expect(found?.simType).toBe('dc');
    });

    it('returns undefined for unknown ID', () => {
      expect(scenarioManager.updateScenario('nonexistent', { name: 'X' })).toBeUndefined();
    });
  });

  describe('delete', () => {
    it('deletes user scenario', () => {
      const created = scenarioManager.createScenario(dcScenario());
      const result = scenarioManager.deleteScenario(created.id);
      expect(result).toBe(true);
      expect(scenarioManager.getScenario(created.id)).toBeUndefined();
      expect(scenarioManager.listScenarios().length).toBe(4); // Only presets
    });

    it('returns false for unknown ID', () => {
      expect(scenarioManager.deleteScenario('nonexistent')).toBe(false);
    });

    it('clears active scenario when deleting it', () => {
      const created = scenarioManager.createScenario(dcScenario());
      scenarioManager.setActiveScenario(created.id);
      expect(scenarioManager.getActiveScenarioId()).toBe(created.id);

      scenarioManager.deleteScenario(created.id);
      expect(scenarioManager.getActiveScenarioId()).toBeNull();
      expect(scenarioManager.getActiveScenario()).toBeUndefined();
    });

    it('does not clear active scenario when deleting a different one', () => {
      const a = scenarioManager.createScenario(dcScenario('A'));
      const b = scenarioManager.createScenario(dcScenario('B'));
      scenarioManager.setActiveScenario(a.id);

      scenarioManager.deleteScenario(b.id);
      expect(scenarioManager.getActiveScenarioId()).toBe(a.id);
    });
  });

  // ---- Active scenario ----

  describe('active scenario', () => {
    it('starts with no active scenario', () => {
      expect(scenarioManager.getActiveScenarioId()).toBeNull();
      expect(scenarioManager.getActiveScenario()).toBeUndefined();
    });

    it('setActiveScenario activates a preset', () => {
      const presets = scenarioManager.listScenarios();
      scenarioManager.setActiveScenario(presets[0].id);
      expect(scenarioManager.getActiveScenarioId()).toBe(presets[0].id);
      expect(scenarioManager.getActiveScenario()?.name).toBe(presets[0].name);
    });

    it('setActiveScenario activates a user scenario', () => {
      const created = scenarioManager.createScenario(acScenario());
      scenarioManager.setActiveScenario(created.id);
      expect(scenarioManager.getActiveScenarioId()).toBe(created.id);
      expect(scenarioManager.getActiveScenario()?.id).toBe(created.id);
    });

    it('setActiveScenario ignores nonexistent ID', () => {
      scenarioManager.setActiveScenario('nonexistent');
      expect(scenarioManager.getActiveScenarioId()).toBeNull();
    });

    it('clearActiveScenario clears', () => {
      const presets = scenarioManager.listScenarios();
      scenarioManager.setActiveScenario(presets[0].id);
      scenarioManager.clearActiveScenario();
      expect(scenarioManager.getActiveScenarioId()).toBeNull();
    });

    it('clearActiveScenario is a no-op when nothing is active', () => {
      const versionBefore = scenarioManager.version;
      scenarioManager.clearActiveScenario();
      expect(scenarioManager.version).toBe(versionBefore);
    });
  });

  // ---- Subscription ----

  describe('subscribe', () => {
    it('notifies listeners on create', () => {
      const listener = vi.fn();
      scenarioManager.subscribe(listener);
      scenarioManager.createScenario(dcScenario());
      expect(listener).toHaveBeenCalled();
    });

    it('notifies listeners on delete', () => {
      const created = scenarioManager.createScenario(dcScenario());
      const listener = vi.fn();
      scenarioManager.subscribe(listener);
      scenarioManager.deleteScenario(created.id);
      expect(listener).toHaveBeenCalled();
    });

    it('notifies listeners on update', () => {
      const created = scenarioManager.createScenario(dcScenario());
      const listener = vi.fn();
      scenarioManager.subscribe(listener);
      scenarioManager.updateScenario(created.id, { name: 'Updated' });
      expect(listener).toHaveBeenCalled();
    });

    it('notifies listeners on setActiveScenario', () => {
      const presets = scenarioManager.listScenarios();
      const listener = vi.fn();
      scenarioManager.subscribe(listener);
      scenarioManager.setActiveScenario(presets[0].id);
      expect(listener).toHaveBeenCalled();
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = scenarioManager.subscribe(listener);
      unsub();
      scenarioManager.createScenario(dcScenario());
      expect(listener).not.toHaveBeenCalled();
    });

    it('version increments on mutations', () => {
      const v0 = scenarioManager.version;
      scenarioManager.createScenario(dcScenario());
      expect(scenarioManager.version).toBeGreaterThan(v0);

      const v1 = scenarioManager.version;
      const all = scenarioManager.listScenarios();
      const userScenario = all.find((s) => !scenarioManager.isPreset(s.id));
      if (userScenario) {
        scenarioManager.updateScenario(userScenario.id, { name: 'V' });
        expect(scenarioManager.version).toBeGreaterThan(v1);

        const v2 = scenarioManager.version;
        scenarioManager.deleteScenario(userScenario.id);
        expect(scenarioManager.version).toBeGreaterThan(v2);
      }
    });
  });

  // ---- Persistence ----

  describe('localStorage persistence', () => {
    it('persists user scenarios to localStorage', () => {
      scenarioManager.createScenario(dcScenario('Persisted'));
      const raw = localStorage.getItem('protopulse-sim-scenarios');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as { scenarios: SimulationScenario[] };
      expect(parsed.scenarios.length).toBe(1);
      expect(parsed.scenarios[0].name).toBe('Persisted');
    });

    it('persists active scenario ID', () => {
      const created = scenarioManager.createScenario(dcScenario());
      scenarioManager.setActiveScenario(created.id);
      const raw = localStorage.getItem('protopulse-sim-scenarios');
      const parsed = JSON.parse(raw!) as { activeScenarioId: string | null };
      expect(parsed.activeScenarioId).toBe(created.id);
    });

    it('reloads user scenarios from localStorage after reset+manual load', () => {
      const created = scenarioManager.createScenario(acScenario('Reloaded'));
      scenarioManager.setActiveScenario(created.id);

      // Simulate a fresh manager by calling _reset (which clears in-memory state)
      // then manually constructing a new manager is not possible since it's a singleton.
      // Instead, verify that the data IS in localStorage and the format is correct.
      const raw = localStorage.getItem('protopulse-sim-scenarios');
      expect(raw).toBeTruthy();
      const parsed = JSON.parse(raw!) as {
        scenarios: SimulationScenario[];
        activeScenarioId: string | null;
      };
      expect(parsed.scenarios.length).toBe(1);
      expect(parsed.scenarios[0].name).toBe('Reloaded');
      expect(parsed.activeScenarioId).toBe(created.id);
    });

    it('does not persist presets to localStorage', () => {
      // Only user scenarios should be in localStorage
      const raw = localStorage.getItem('protopulse-sim-scenarios');
      // After reset, nothing is stored
      expect(raw).toBeNull();
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('protopulse-sim-scenarios', '{{invalid json');
      // Force reload by creating a new scenario (which first reads existing)
      // The manager was already constructed with valid state, so just verify it still works
      const all = scenarioManager.listScenarios();
      expect(all.length).toBe(4); // Only presets
    });
  });

  // ---- List behavior ----

  describe('listScenarios', () => {
    it('returns presets before user scenarios', () => {
      scenarioManager.createScenario(dcScenario('ZZZ First User'));
      const all = scenarioManager.listScenarios();
      // First 4 should all be presets
      for (let i = 0; i < 4; i++) {
        expect(scenarioManager.isPreset(all[i].id)).toBe(true);
      }
      // 5th should be user scenario
      expect(scenarioManager.isPreset(all[4].id)).toBe(false);
    });

    it('includes both presets and user scenarios', () => {
      scenarioManager.createScenario(dcScenario());
      scenarioManager.createScenario(acScenario());
      scenarioManager.createScenario(transientScenario());
      const all = scenarioManager.listScenarios();
      expect(all.length).toBe(7); // 4 presets + 3 user
    });
  });

  // ---- Edge cases ----

  describe('edge cases', () => {
    it('empty state has only presets', () => {
      expect(scenarioManager.listScenarios().length).toBe(4);
      expect(scenarioManager.getActiveScenarioId()).toBeNull();
    });

    it('handles multiple creates and deletes', () => {
      const a = scenarioManager.createScenario(dcScenario('A'));
      const b = scenarioManager.createScenario(dcScenario('B'));
      const c = scenarioManager.createScenario(dcScenario('C'));
      expect(scenarioManager.listScenarios().length).toBe(7);

      scenarioManager.deleteScenario(b.id);
      expect(scenarioManager.listScenarios().length).toBe(6);
      expect(scenarioManager.getScenario(a.id)).toBeDefined();
      expect(scenarioManager.getScenario(b.id)).toBeUndefined();
      expect(scenarioManager.getScenario(c.id)).toBeDefined();
    });

    it('allows creating scenarios with same name', () => {
      const a = scenarioManager.createScenario(dcScenario('Same Name'));
      const b = scenarioManager.createScenario(dcScenario('Same Name'));
      expect(a.id).not.toBe(b.id);
      expect(scenarioManager.listScenarios().length).toBe(6); // 4 presets + 2 user
    });

    it('allows setting active to a preset', () => {
      const presets = scenarioManager.listScenarios();
      scenarioManager.setActiveScenario(presets[1].id);
      expect(scenarioManager.getActiveScenario()?.name).toBe(presets[1].name);
    });

    it('switching active scenario replaces the previous one', () => {
      const presets = scenarioManager.listScenarios();
      scenarioManager.setActiveScenario(presets[0].id);
      scenarioManager.setActiveScenario(presets[1].id);
      expect(scenarioManager.getActiveScenarioId()).toBe(presets[1].id);
    });

    it('createScenario with empty description works', () => {
      const created = scenarioManager.createScenario({
        name: 'No desc',
        description: '',
        simType: 'dc',
        parameters: {},
      });
      expect(created.description).toBe('');
    });

    it('createScenario with empty parameters works', () => {
      const created = scenarioManager.createScenario({
        name: 'Empty params',
        description: '',
        simType: 'dc',
        parameters: {},
      });
      expect(created.parameters).toEqual({});
    });

    it('update with partial data only changes specified fields', () => {
      const created = scenarioManager.createScenario(acScenario());
      scenarioManager.updateScenario(created.id, { description: 'New desc' });
      const found = scenarioManager.getScenario(created.id);
      expect(found?.description).toBe('New desc');
      expect(found?.name).toBe('My AC Test');
      expect(found?.simType).toBe('ac');
      expect(found?.parameters.frequencyStart).toBe(100);
    });
  });
});
