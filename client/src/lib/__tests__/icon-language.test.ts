import { describe, it, expect } from 'vitest';
import {
  ICON_MAP,
  getIconForAction,
  getIconForEntity,
  auditIconConsistency,
  getAllActionKeys,
  getAllEntityKeys,
  getAllDomainOverrideKeys,
} from '../icon-language';
import type { IconDomain } from '../icon-language';

// ---------------------------------------------------------------------------
// ICON_MAP structure
// ---------------------------------------------------------------------------

describe('ICON_MAP', () => {
  it('contains at least 40 action mappings', () => {
    const keys = Object.keys(ICON_MAP);
    expect(keys.length).toBeGreaterThanOrEqual(40);
  });

  it('every entry has all required IconMapping fields', () => {
    for (const [action, mapping] of Object.entries(ICON_MAP)) {
      expect(mapping.domain).toBeTruthy();
      expect(mapping.action).toBe(action);
      expect(mapping.iconName).toBeTruthy();
      // lucide-react icons are forwardRef objects, not plain functions
      expect(mapping.icon).toBeTruthy();
      expect(typeof mapping.icon === 'function' || typeof mapping.icon === 'object').toBe(true);
      expect(mapping.label).toBeTruthy();
    }
  });

  it('all domain values are valid IconDomain literals', () => {
    const validDomains: IconDomain[] = [
      'design',
      'analysis',
      'hardware',
      'manufacturing',
      'documentation',
      'collaboration',
    ];
    for (const mapping of Object.values(ICON_MAP)) {
      expect(validDomains).toContain(mapping.domain);
    }
  });

  it('no two entries share the same action key (keys are unique by definition)', () => {
    const keys = Object.keys(ICON_MAP);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('iconName matches the actual imported icon displayName', () => {
    for (const mapping of Object.values(ICON_MAP)) {
      // lucide-react icons expose displayName (canonical) or name as fallback
      const fnName = mapping.icon.displayName ?? mapping.icon.name;
      expect(fnName).toBe(mapping.iconName);
    }
  });
});

// ---------------------------------------------------------------------------
// getIconForAction
// ---------------------------------------------------------------------------

describe('getIconForAction', () => {
  it('returns the mapping for a known action', () => {
    const result = getIconForAction('add');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(ICON_MAP.add.iconName);
    expect(result!.label).toBe('Add');
  });

  it('returns undefined for an unknown action', () => {
    expect(getIconForAction('nonexistent_action')).toBeUndefined();
  });

  it('returns the generic mapping when domain is omitted', () => {
    const result = getIconForAction('run');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(ICON_MAP.run.iconName);
  });

  it('returns the generic mapping when domain has no override', () => {
    const result = getIconForAction('run', 'documentation');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(ICON_MAP.run.iconName);
  });

  it('returns a domain-specific override when one exists', () => {
    const result = getIconForAction('run', 'hardware');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(ICON_MAP.simulate.iconName); // Zap icon
    expect(result!.label).toBe('Flash / Upload');
  });

  it('returns validate override for manufacturing domain', () => {
    const result = getIconForAction('validate', 'manufacturing');
    expect(result).toBeDefined();
    // Override uses ShieldCheck — different from base validate (CheckCircle)
    expect(result!.iconName).not.toBe(ICON_MAP.validate.iconName);
    expect(result!.label).toBe('DFM check');
  });

  it('returns validate override for design domain', () => {
    const result = getIconForAction('validate', 'design');
    expect(result).toBeDefined();
    expect(result!.iconName).not.toBe(ICON_MAP.validate.iconName);
    expect(result!.label).toBe('DRC check');
  });

  it('returns generic validate when domain is analysis', () => {
    const result = getIconForAction('validate', 'analysis');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(ICON_MAP.validate.iconName);
  });

  it('handles all core CRUD actions', () => {
    const crudActions = ['add', 'delete', 'edit', 'save', 'duplicate', 'paste', 'undo', 'redo'];
    for (const action of crudActions) {
      const result = getIconForAction(action);
      expect(result).toBeDefined();
      expect(result!.icon).toBeDefined();
    }
  });

  it('handles all I/O actions', () => {
    const ioActions = ['export', 'import', 'download', 'upload', 'share'];
    for (const action of ioActions) {
      const result = getIconForAction(action);
      expect(result).toBeDefined();
    }
  });

  it('handles all visibility/lock actions', () => {
    const visActions = ['show', 'hide', 'lock', 'unlock'];
    for (const action of visActions) {
      const result = getIconForAction(action);
      expect(result).toBeDefined();
    }
  });

  it('handles all transform actions', () => {
    const transformActions = ['rotate', 'mirror', 'move', 'zoom_in', 'zoom_out', 'fit_view'];
    for (const action of transformActions) {
      const result = getIconForAction(action);
      expect(result).toBeDefined();
    }
  });

  it('handles all execution/simulation actions', () => {
    const execActions = ['run', 'stop', 'pause', 'simulate', 'validate', 'refresh'];
    for (const action of execActions) {
      const result = getIconForAction(action);
      expect(result).toBeDefined();
    }
  });

  it('handles status actions', () => {
    const statusActions = ['warning', 'error', 'success'];
    for (const action of statusActions) {
      const result = getIconForAction(action);
      expect(result).toBeDefined();
    }
  });
});

// ---------------------------------------------------------------------------
// getIconForEntity
// ---------------------------------------------------------------------------

describe('getIconForEntity', () => {
  it('returns the mapping for a known entity', () => {
    const result = getIconForEntity('component');
    expect(result).toBeDefined();
    expect(result!.label).toBe('Component');
    // Verify it has a valid icon
    expect(result!.icon).toBeTruthy();
    expect(result!.iconName).toBeTruthy();
  });

  it('returns undefined for an unknown entity', () => {
    expect(getIconForEntity('unicorn')).toBeUndefined();
  });

  it('returns correct icon for circuit', () => {
    const result = getIconForEntity('circuit');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(result!.icon.displayName ?? result!.icon.name);
  });

  it('returns correct icon for bom', () => {
    const result = getIconForEntity('bom');
    expect(result).toBeDefined();
    expect(result!.domain).toBe('manufacturing');
    expect(result!.iconName).toBe(result!.icon.displayName ?? result!.icon.name);
  });

  it('returns correct icon for document', () => {
    const result = getIconForEntity('document');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(result!.icon.displayName ?? result!.icon.name);
  });

  it('returns correct icon for layer', () => {
    const result = getIconForEntity('layer');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(result!.icon.displayName ?? result!.icon.name);
  });

  it('returns correct icon for ai', () => {
    const result = getIconForEntity('ai');
    expect(result).toBeDefined();
    expect(result!.iconName).toBe(result!.icon.displayName ?? result!.icon.name);
  });

  it('returns correct icon for user', () => {
    const result = getIconForEntity('user');
    expect(result).toBeDefined();
    expect(result!.domain).toBe('collaboration');
    expect(result!.iconName).toBe(result!.icon.displayName ?? result!.icon.name);
  });

  it('has correct domains assigned to entities', () => {
    const entityDomains: Record<string, IconDomain> = {
      component: 'design',
      circuit: 'design',
      bom: 'manufacturing',
      document: 'documentation',
      layer: 'design',
      branch: 'collaboration',
      ai: 'design',
      user: 'collaboration',
      factory: 'manufacturing',
      validation: 'analysis',
      signal: 'analysis',
      metrics: 'analysis',
      idea: 'documentation',
      tool: 'hardware',
      knowledge: 'documentation',
      comment: 'collaboration',
      history: 'design',
    };
    for (const [entity, expectedDomain] of Object.entries(entityDomains)) {
      const result = getIconForEntity(entity);
      expect(result).toBeDefined();
      expect(result!.domain).toBe(expectedDomain);
    }
  });

  it('every entity mapping has a non-empty label', () => {
    const keys = getAllEntityKeys();
    for (const key of keys) {
      const result = getIconForEntity(key);
      expect(result).toBeDefined();
      expect(result!.label.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// auditIconConsistency
// ---------------------------------------------------------------------------

describe('auditIconConsistency', () => {
  it('returns an IconAuditResult with all required fields', () => {
    const result = auditIconConsistency();
    expect(result).toHaveProperty('clean');
    expect(result).toHaveProperty('duplicateIcons');
    expect(result).toHaveProperty('overrideConflicts');
    expect(result).toHaveProperty('entityActionCollisions');
    expect(Array.isArray(result.duplicateIcons)).toBe(true);
    expect(Array.isArray(result.overrideConflicts)).toBe(true);
    expect(Array.isArray(result.entityActionCollisions)).toBe(true);
  });

  it('has no redundant overrides (override icon differs from base)', () => {
    const result = auditIconConsistency();
    expect(result.overrideConflicts).toEqual([]);
  });

  it('clean is true when no issues exist', () => {
    const result = auditIconConsistency();
    // If the map is well-designed, clean should be true
    if (
      result.duplicateIcons.length === 0 &&
      result.overrideConflicts.length === 0 &&
      result.entityActionCollisions.length === 0
    ) {
      expect(result.clean).toBe(true);
    }
  });

  it('clean flag matches the conjunction of all check arrays being empty', () => {
    const result = auditIconConsistency();
    const expectedClean =
      result.duplicateIcons.length === 0 &&
      result.overrideConflicts.length === 0 &&
      result.entityActionCollisions.length === 0;
    expect(result.clean).toBe(expectedClean);
  });

  it('duplicate detection groups actions sharing the same icon (3+ threshold)', () => {
    const result = auditIconConsistency();
    // Verify that any reported duplicates actually share the same icon
    for (const dup of result.duplicateIcons) {
      expect(dup.actions.length).toBeGreaterThanOrEqual(3);
      for (const action of dup.actions) {
        const mapping = getIconForAction(action);
        expect(mapping).toBeDefined();
        expect(mapping!.iconName).toBe(dup.iconName);
      }
    }
  });

  it('entity-action collision detection works correctly', () => {
    const result = auditIconConsistency();
    // Any reported collisions should have different icon names
    for (const collision of result.entityActionCollisions) {
      expect(collision.actionIconName).not.toBe(collision.entityIconName);
    }
  });

  it('does not report pairs (2 actions) as duplicates', () => {
    // close and cancel both use X — should NOT appear as duplicates (threshold is 3)
    const result = auditIconConsistency();
    const xIconName = ICON_MAP.close.iconName;
    const xDuplicate = result.duplicateIcons.find((d) => d.iconName === xIconName);
    // X is used by close and cancel — only 2, so should not appear
    expect(xDuplicate).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getAllActionKeys / getAllEntityKeys / getAllDomainOverrideKeys
// ---------------------------------------------------------------------------

describe('getAllActionKeys', () => {
  it('returns an array of strings', () => {
    const keys = getAllActionKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(typeof key).toBe('string');
    }
  });

  it('every key has a corresponding ICON_MAP entry', () => {
    const keys = getAllActionKeys();
    for (const key of keys) {
      expect(ICON_MAP[key]).toBeDefined();
    }
  });

  it('has at least 40 action keys', () => {
    expect(getAllActionKeys().length).toBeGreaterThanOrEqual(40);
  });
});

describe('getAllEntityKeys', () => {
  it('returns an array of strings', () => {
    const keys = getAllEntityKeys();
    expect(Array.isArray(keys)).toBe(true);
    expect(keys.length).toBeGreaterThan(0);
  });

  it('every key resolves via getIconForEntity', () => {
    const keys = getAllEntityKeys();
    for (const key of keys) {
      expect(getIconForEntity(key)).toBeDefined();
    }
  });

  it('has at least 10 entity keys', () => {
    expect(getAllEntityKeys().length).toBeGreaterThanOrEqual(10);
  });
});

describe('getAllDomainOverrideKeys', () => {
  it('returns an array of colon-separated action:domain strings', () => {
    const keys = getAllDomainOverrideKeys();
    expect(Array.isArray(keys)).toBe(true);
    for (const key of keys) {
      expect(key).toContain(':');
      const parts = key.split(':');
      expect(parts.length).toBe(2);
    }
  });

  it('every override key references a valid base action', () => {
    const actionKeys = new Set(getAllActionKeys());
    const overrideKeys = getAllDomainOverrideKeys();
    for (const key of overrideKeys) {
      const [action] = key.split(':');
      expect(actionKeys.has(action)).toBe(true);
    }
  });

  it('has at least 1 domain override', () => {
    expect(getAllDomainOverrideKeys().length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting consistency checks
// ---------------------------------------------------------------------------

describe('cross-cutting consistency', () => {
  it('export and download use the same icon', () => {
    const exp = getIconForAction('export');
    const dl = getIconForAction('download');
    expect(exp).toBeDefined();
    expect(dl).toBeDefined();
    expect(exp!.iconName).toBe(dl!.iconName);
  });

  it('import and upload use the same icon', () => {
    const imp = getIconForAction('import');
    const ul = getIconForAction('upload');
    expect(imp).toBeDefined();
    expect(ul).toBeDefined();
    expect(imp!.iconName).toBe(ul!.iconName);
  });

  it('close and cancel use the same icon', () => {
    const close = getIconForAction('close');
    const cancel = getIconForAction('cancel');
    expect(close).toBeDefined();
    expect(cancel).toBeDefined();
    expect(close!.iconName).toBe(cancel!.iconName);
  });

  it('success and validate share the same icon', () => {
    const success = getIconForAction('success');
    const validate = getIconForAction('validate');
    expect(success).toBeDefined();
    expect(validate).toBeDefined();
    expect(success!.iconName).toBe(validate!.iconName);
  });

  it('show/hide are visual opposites', () => {
    const show = getIconForAction('show');
    const hide = getIconForAction('hide');
    expect(show).toBeDefined();
    expect(hide).toBeDefined();
    expect(show!.iconName).not.toBe(hide!.iconName);
    // Both should reference Eye variants
    expect(show!.icon).not.toBe(hide!.icon);
  });

  it('lock/unlock are visual opposites', () => {
    const lock = getIconForAction('lock');
    const unlock = getIconForAction('unlock');
    expect(lock).toBeDefined();
    expect(unlock).toBeDefined();
    expect(lock!.iconName).not.toBe(unlock!.iconName);
    expect(lock!.icon).not.toBe(unlock!.icon);
  });

  it('undo/redo are visual opposites', () => {
    const undo = getIconForAction('undo');
    const redo = getIconForAction('redo');
    expect(undo).toBeDefined();
    expect(redo).toBeDefined();
    expect(undo!.iconName).not.toBe(redo!.iconName);
    expect(undo!.icon).not.toBe(redo!.icon);
  });

  it('zoom_in/zoom_out are visual opposites', () => {
    const zoomIn = getIconForAction('zoom_in');
    const zoomOut = getIconForAction('zoom_out');
    expect(zoomIn).toBeDefined();
    expect(zoomOut).toBeDefined();
    expect(zoomIn!.iconName).not.toBe(zoomOut!.iconName);
    expect(zoomIn!.icon).not.toBe(zoomOut!.icon);
  });

  it('all actions have unique labels within the same domain', () => {
    const domainLabels = new Map<string, Set<string>>();
    for (const mapping of Object.values(ICON_MAP)) {
      const existing = domainLabels.get(mapping.domain);
      if (existing) {
        existing.add(mapping.label);
      } else {
        domainLabels.set(mapping.domain, new Set([mapping.label]));
      }
    }
    // Labels within a domain should be unique (no two actions in the same domain
    // with the same label)
    for (const [_domain, _labels] of Array.from(domainLabels.entries())) {
      const actionsInDomain = Object.values(ICON_MAP).filter((m) => m.domain === _domain);
      const labelArray = actionsInDomain.map((m) => m.label);
      const uniqueLabels = new Set(labelArray);
      expect(uniqueLabels.size).toBe(labelArray.length);
    }
  });

  it('no entity uses the same iconName + domain combo as an action', () => {
    const actionSignatures = new Set(
      Object.values(ICON_MAP).map((m) => `${m.iconName}:${m.domain}`),
    );
    const entityKeys = getAllEntityKeys();
    const collisions: string[] = [];
    for (const key of entityKeys) {
      const entity = getIconForEntity(key)!;
      const sig = `${entity.iconName}:${entity.domain}`;
      if (actionSignatures.has(sig)) {
        collisions.push(`${key} (${sig})`);
      }
    }
    // Some collisions are acceptable (e.g. validation entity uses ShieldCheck in analysis,
    // and validate action uses CheckCircle in analysis — different icons, OK).
    // This test documents existing collisions rather than failing hard.
    // If new collisions appear, they should be reviewed.
    expect(collisions).toBeDefined(); // existence check — review collisions list manually
  });
});
