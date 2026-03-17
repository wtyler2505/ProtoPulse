import { describe, it, expect, beforeEach } from 'vitest';
import { NetScopeManager } from '../circuit-dsl/net-naming';
import type { LocalNet, PinAlias } from '../circuit-dsl/net-naming';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let mgr: NetScopeManager;

beforeEach(() => {
  mgr = new NetScopeManager();
});

// ---------------------------------------------------------------------------
// createScope
// ---------------------------------------------------------------------------

describe('NetScopeManager.createScope', () => {
  it('creates a root scope with no parent', () => {
    const id = mgr.createScope();
    const scope = mgr.getScope(id);
    expect(scope).toBeDefined();
    expect(scope!.parentId).toBeUndefined();
    expect(scope!.nets.size).toBe(0);
  });

  it('creates a child scope under an existing parent', () => {
    const parentId = mgr.createScope();
    const childId = mgr.createScope(parentId);
    const child = mgr.getScope(childId);
    expect(child).toBeDefined();
    expect(child!.parentId).toBe(parentId);
  });

  it('throws when parent scope does not exist', () => {
    expect(() => mgr.createScope('nonexistent')).toThrow('Parent scope "nonexistent" does not exist');
  });

  it('creates multiple root scopes with distinct IDs', () => {
    const id1 = mgr.createScope();
    const id2 = mgr.createScope();
    expect(id1).not.toBe(id2);
    expect(mgr.scopeCount).toBe(2);
  });

  it('creates deeply nested scopes (3 levels)', () => {
    const root = mgr.createScope();
    const mid = mgr.createScope(root);
    const leaf = mgr.createScope(mid);
    expect(mgr.getScope(leaf)!.parentId).toBe(mid);
    expect(mgr.getScope(mid)!.parentId).toBe(root);
    expect(mgr.getScope(root)!.parentId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// defineNet
// ---------------------------------------------------------------------------

describe('NetScopeManager.defineNet', () => {
  it('defines a net and returns a LocalNet with a globally-unique name', () => {
    const scopeId = mgr.createScope();
    const net = mgr.defineNet(scopeId, 'VCC');
    expect(net.name).toBe('VCC');
    expect(net.scopeId).toBe(scopeId);
    expect(net.globalName).toContain('VCC');
    expect(net.globalName.length).toBeGreaterThan(0);
  });

  it('produces different global names for same local name in different scopes', () => {
    const s1 = mgr.createScope();
    const s2 = mgr.createScope();
    const n1 = mgr.defineNet(s1, 'VCC');
    const n2 = mgr.defineNet(s2, 'VCC');
    expect(n1.globalName).not.toBe(n2.globalName);
  });

  it('throws on duplicate net name within the same scope', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'GND');
    expect(() => mgr.defineNet(scopeId, 'GND')).toThrow('Net "GND" already defined in scope');
  });

  it('throws when scope does not exist', () => {
    expect(() => mgr.defineNet('bad_scope', 'VCC')).toThrow('Scope "bad_scope" does not exist');
  });

  it('throws on empty net name', () => {
    const scopeId = mgr.createScope();
    expect(() => mgr.defineNet(scopeId, '')).toThrow('Net name must not be empty');
  });

  it('allows same local name in parent and child scopes (shadowing)', () => {
    const parent = mgr.createScope();
    const child = mgr.createScope(parent);
    const parentNet = mgr.defineNet(parent, 'CLK');
    const childNet = mgr.defineNet(child, 'CLK');
    expect(parentNet.globalName).not.toBe(childNet.globalName);
    expect(parentNet.scopeId).toBe(parent);
    expect(childNet.scopeId).toBe(child);
  });

  it('builds qualified name including scope ancestry for nested scopes', () => {
    const root = mgr.createScope();
    const child = mgr.createScope(root);
    const net = mgr.defineNet(child, 'SDA');
    // Qualified name includes both scope IDs and the net name
    expect(net.globalName).toContain(root);
    expect(net.globalName).toContain(child);
    expect(net.globalName).toContain('SDA');
  });
});

// ---------------------------------------------------------------------------
// resolveNet
// ---------------------------------------------------------------------------

describe('NetScopeManager.resolveNet', () => {
  it('resolves a net defined in the same scope', () => {
    const scopeId = mgr.createScope();
    const defined = mgr.defineNet(scopeId, 'DATA');
    const resolved = mgr.resolveNet(scopeId, 'DATA');
    expect(resolved).toBeDefined();
    expect(resolved!.globalName).toBe(defined.globalName);
  });

  it('resolves a net from a parent scope (lexical scoping)', () => {
    const parent = mgr.createScope();
    const child = mgr.createScope(parent);
    const parentNet = mgr.defineNet(parent, 'VCC');
    const resolved = mgr.resolveNet(child, 'VCC');
    expect(resolved).toBeDefined();
    expect(resolved!.globalName).toBe(parentNet.globalName);
    expect(resolved!.scopeId).toBe(parent);
  });

  it('resolves a net from a grandparent scope', () => {
    const gp = mgr.createScope();
    const mid = mgr.createScope(gp);
    const leaf = mgr.createScope(mid);
    const gpNet = mgr.defineNet(gp, 'GND');
    const resolved = mgr.resolveNet(leaf, 'GND');
    expect(resolved).toBeDefined();
    expect(resolved!.globalName).toBe(gpNet.globalName);
  });

  it('returns the child net when it shadows a parent net', () => {
    const parent = mgr.createScope();
    const child = mgr.createScope(parent);
    mgr.defineNet(parent, 'CLK');
    const childNet = mgr.defineNet(child, 'CLK');
    const resolved = mgr.resolveNet(child, 'CLK');
    expect(resolved).toBeDefined();
    expect(resolved!.scopeId).toBe(child);
    expect(resolved!.globalName).toBe(childNet.globalName);
  });

  it('returns undefined for a name that does not exist anywhere', () => {
    const scopeId = mgr.createScope();
    expect(mgr.resolveNet(scopeId, 'NONEXISTENT')).toBeUndefined();
  });

  it('returns undefined when scope ID is invalid', () => {
    expect(mgr.resolveNet('invalid_scope', 'VCC')).toBeUndefined();
  });

  it('does not resolve nets from sibling scopes', () => {
    const parent = mgr.createScope();
    const sibling1 = mgr.createScope(parent);
    const sibling2 = mgr.createScope(parent);
    mgr.defineNet(sibling1, 'LOCAL_SIGNAL');
    const resolved = mgr.resolveNet(sibling2, 'LOCAL_SIGNAL');
    expect(resolved).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getGlobalName
// ---------------------------------------------------------------------------

describe('NetScopeManager.getGlobalName', () => {
  it('returns the same global name as the defineNet return value', () => {
    const scopeId = mgr.createScope();
    const net = mgr.defineNet(scopeId, 'RST');
    expect(mgr.getGlobalName(scopeId, 'RST')).toBe(net.globalName);
  });

  it('throws when the net is not found in the scope', () => {
    const scopeId = mgr.createScope();
    expect(() => mgr.getGlobalName(scopeId, 'MISSING')).toThrow('Net "MISSING" not found in scope');
  });

  it('throws when scope does not exist', () => {
    expect(() => mgr.getGlobalName('no_scope', 'VCC')).toThrow('Scope "no_scope" does not exist');
  });

  it('does not return parent net via getGlobalName (only direct scope lookup)', () => {
    const parent = mgr.createScope();
    const child = mgr.createScope(parent);
    mgr.defineNet(parent, 'POWER');
    // getGlobalName only looks at the direct scope, not parents
    expect(() => mgr.getGlobalName(child, 'POWER')).toThrow('Net "POWER" not found in scope');
  });
});

// ---------------------------------------------------------------------------
// getScopeNets
// ---------------------------------------------------------------------------

describe('NetScopeManager.getScopeNets', () => {
  it('returns an empty array for a scope with no nets', () => {
    const scopeId = mgr.createScope();
    expect(mgr.getScopeNets(scopeId)).toEqual([]);
  });

  it('returns all nets defined directly in the scope', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'VCC');
    mgr.defineNet(scopeId, 'GND');
    mgr.defineNet(scopeId, 'SIG');
    const nets = mgr.getScopeNets(scopeId);
    expect(nets).toHaveLength(3);
    const names = nets.map((n) => n.name).sort();
    expect(names).toEqual(['GND', 'SIG', 'VCC']);
  });

  it('does not include nets from parent scopes', () => {
    const parent = mgr.createScope();
    const child = mgr.createScope(parent);
    mgr.defineNet(parent, 'PARENT_NET');
    mgr.defineNet(child, 'CHILD_NET');
    const childNets = mgr.getScopeNets(child);
    expect(childNets).toHaveLength(1);
    expect(childNets[0].name).toBe('CHILD_NET');
  });

  it('throws when scope does not exist', () => {
    expect(() => mgr.getScopeNets('missing')).toThrow('Scope "missing" does not exist');
  });
});

// ---------------------------------------------------------------------------
// flattenScopes
// ---------------------------------------------------------------------------

describe('NetScopeManager.flattenScopes', () => {
  it('returns empty array when no scopes exist', () => {
    expect(mgr.flattenScopes()).toEqual([]);
  });

  it('returns empty array when scopes exist but have no nets', () => {
    mgr.createScope();
    mgr.createScope();
    expect(mgr.flattenScopes()).toEqual([]);
  });

  it('returns all nets across all scopes', () => {
    const s1 = mgr.createScope();
    const s2 = mgr.createScope();
    mgr.defineNet(s1, 'A');
    mgr.defineNet(s1, 'B');
    mgr.defineNet(s2, 'C');
    const all = mgr.flattenScopes();
    expect(all).toHaveLength(3);
    const names = all.map((n) => n.name).sort();
    expect(names).toEqual(['A', 'B', 'C']);
  });

  it('includes nets from nested scopes', () => {
    const root = mgr.createScope();
    const child = mgr.createScope(root);
    const grandchild = mgr.createScope(child);
    mgr.defineNet(root, 'R');
    mgr.defineNet(child, 'C');
    mgr.defineNet(grandchild, 'G');
    const all = mgr.flattenScopes();
    expect(all).toHaveLength(3);
  });

  it('every net has a unique globalName', () => {
    const s1 = mgr.createScope();
    const s2 = mgr.createScope();
    mgr.defineNet(s1, 'VCC');
    mgr.defineNet(s2, 'VCC');
    mgr.defineNet(s1, 'GND');
    const all = mgr.flattenScopes();
    const globalNames = all.map((n) => n.globalName);
    const uniqueNames = new Set(globalNames);
    expect(uniqueNames.size).toBe(globalNames.length);
  });
});

// ---------------------------------------------------------------------------
// definePinAlias
// ---------------------------------------------------------------------------

describe('NetScopeManager.definePinAlias', () => {
  it('defines an alias mapping to a net', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'VCC');
    const alias = mgr.definePinAlias(scopeId, 'INPUT', 'VCC');
    expect(alias.alias).toBe('INPUT');
    expect(alias.targetNet).toBe('VCC');
    expect(alias.targetPin).toBeUndefined();
  });

  it('defines an alias with an optional target pin', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'DATA_BUS');
    const alias = mgr.definePinAlias(scopeId, 'MOSI', 'DATA_BUS', 'pin_11');
    expect(alias.targetPin).toBe('pin_11');
  });

  it('throws on duplicate alias name within the same scope', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'VCC');
    mgr.definePinAlias(scopeId, 'POWER_IN', 'VCC');
    expect(() => mgr.definePinAlias(scopeId, 'POWER_IN', 'VCC')).toThrow(
      'Alias "POWER_IN" already defined in scope',
    );
  });

  it('throws when target net is not resolvable', () => {
    const scopeId = mgr.createScope();
    expect(() => mgr.definePinAlias(scopeId, 'OUT', 'NONEXISTENT')).toThrow(
      'Target net "NONEXISTENT" not resolvable from scope',
    );
  });

  it('throws on empty alias name', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'VCC');
    expect(() => mgr.definePinAlias(scopeId, '', 'VCC')).toThrow('Alias name must not be empty');
  });

  it('throws when scope does not exist', () => {
    expect(() => mgr.definePinAlias('bad', 'A', 'N')).toThrow('Scope "bad" does not exist');
  });

  it('allows alias to target a net defined in a parent scope', () => {
    const parent = mgr.createScope();
    const child = mgr.createScope(parent);
    mgr.defineNet(parent, 'SHARED_VCC');
    const alias = mgr.definePinAlias(child, 'PWR', 'SHARED_VCC');
    expect(alias.targetNet).toBe('SHARED_VCC');
  });

  it('allows same alias name in different scopes', () => {
    const s1 = mgr.createScope();
    const s2 = mgr.createScope();
    mgr.defineNet(s1, 'NET_A');
    mgr.defineNet(s2, 'NET_B');
    const a1 = mgr.definePinAlias(s1, 'OUTPUT', 'NET_A');
    const a2 = mgr.definePinAlias(s2, 'OUTPUT', 'NET_B');
    expect(a1.targetNet).toBe('NET_A');
    expect(a2.targetNet).toBe('NET_B');
  });
});

// ---------------------------------------------------------------------------
// getScopeAliases & resolveAlias
// ---------------------------------------------------------------------------

describe('NetScopeManager alias queries', () => {
  it('getScopeAliases returns all aliases in a scope', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'VCC');
    mgr.defineNet(scopeId, 'GND');
    mgr.definePinAlias(scopeId, 'POWER', 'VCC');
    mgr.definePinAlias(scopeId, 'GROUND', 'GND');
    const aliases = mgr.getScopeAliases(scopeId);
    expect(aliases).toHaveLength(2);
    const names = aliases.map((a) => a.alias).sort();
    expect(names).toEqual(['GROUND', 'POWER']);
  });

  it('getScopeAliases returns empty array for scope with no aliases', () => {
    const scopeId = mgr.createScope();
    expect(mgr.getScopeAliases(scopeId)).toEqual([]);
  });

  it('getScopeAliases throws for nonexistent scope', () => {
    expect(() => mgr.getScopeAliases('nope')).toThrow('Scope "nope" does not exist');
  });

  it('resolveAlias returns the alias when found', () => {
    const scopeId = mgr.createScope();
    mgr.defineNet(scopeId, 'SIG');
    mgr.definePinAlias(scopeId, 'TX', 'SIG', 'pin_1');
    const result = mgr.resolveAlias(scopeId, 'TX');
    expect(result).toBeDefined();
    expect(result!.alias).toBe('TX');
    expect(result!.targetNet).toBe('SIG');
    expect(result!.targetPin).toBe('pin_1');
  });

  it('resolveAlias returns undefined when alias not found', () => {
    const scopeId = mgr.createScope();
    expect(mgr.resolveAlias(scopeId, 'MISSING')).toBeUndefined();
  });

  it('resolveAlias returns undefined for nonexistent scope', () => {
    expect(mgr.resolveAlias('bad_id', 'ANY')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getChildScopes & scopeCount
// ---------------------------------------------------------------------------

describe('NetScopeManager scope queries', () => {
  it('getChildScopes returns child scope IDs', () => {
    const parent = mgr.createScope();
    const c1 = mgr.createScope(parent);
    const c2 = mgr.createScope(parent);
    const children = mgr.getChildScopes(parent);
    expect(children).toHaveLength(2);
    expect(children).toContain(c1);
    expect(children).toContain(c2);
  });

  it('getChildScopes returns empty array when no children', () => {
    const root = mgr.createScope();
    expect(mgr.getChildScopes(root)).toEqual([]);
  });

  it('getChildScopes throws for nonexistent scope', () => {
    expect(() => mgr.getChildScopes('none')).toThrow('Scope "none" does not exist');
  });

  it('getChildScopes does not include grandchildren', () => {
    const root = mgr.createScope();
    const child = mgr.createScope(root);
    mgr.createScope(child); // grandchild
    const children = mgr.getChildScopes(root);
    expect(children).toHaveLength(1);
    expect(children[0]).toBe(child);
  });

  it('scopeCount reflects total number of scopes', () => {
    expect(mgr.scopeCount).toBe(0);
    mgr.createScope();
    expect(mgr.scopeCount).toBe(1);
    const p = mgr.createScope();
    mgr.createScope(p);
    expect(mgr.scopeCount).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Integration: complex hierarchy
// ---------------------------------------------------------------------------

describe('NetScopeManager integration', () => {
  it('models a multi-level subcircuit hierarchy with proper isolation', () => {
    // Root scope (top-level design)
    const top = mgr.createScope();
    mgr.defineNet(top, 'VCC');
    mgr.defineNet(top, 'GND');

    // Power supply subcircuit
    const psu = mgr.createScope(top);
    mgr.defineNet(psu, 'VREG_OUT');
    mgr.definePinAlias(psu, 'OUTPUT', 'VREG_OUT');

    // MCU subcircuit
    const mcu = mgr.createScope(top);
    mgr.defineNet(mcu, 'SDA');
    mgr.defineNet(mcu, 'SCL');
    mgr.definePinAlias(mcu, 'I2C_DATA', 'SDA');
    mgr.definePinAlias(mcu, 'I2C_CLK', 'SCL');

    // Sensor subcircuit nested under MCU
    const sensor = mgr.createScope(mcu);
    mgr.defineNet(sensor, 'MEAS');

    // Verify isolation: PSU can't see MCU nets
    expect(mgr.resolveNet(psu, 'SDA')).toBeUndefined();

    // Verify inheritance: sensor can see MCU and top nets
    expect(mgr.resolveNet(sensor, 'SDA')!.scopeId).toBe(mcu);
    expect(mgr.resolveNet(sensor, 'VCC')!.scopeId).toBe(top);

    // Verify flatten collects all nets
    const all = mgr.flattenScopes();
    expect(all).toHaveLength(6); // VCC, GND, VREG_OUT, SDA, SCL, MEAS

    // Verify global name uniqueness
    const globalNames = all.map((n) => n.globalName);
    expect(new Set(globalNames).size).toBe(globalNames.length);

    // Verify aliases
    const mcuAliases = mgr.getScopeAliases(mcu);
    expect(mcuAliases).toHaveLength(2);
    expect(mgr.resolveAlias(mcu, 'I2C_DATA')!.targetNet).toBe('SDA');
  });
});
