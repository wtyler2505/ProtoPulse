import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.stubGlobal('crypto', { randomUUID: vi.fn(() => `uuid-${Math.random().toString(36).slice(2, 10)}`) });

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => { store[key] = val; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(store)) { delete store[k]; } }),
});

// Use Object.keys(store) workaround for iteration
Object.defineProperty(localStorage, Symbol.iterator, {
  value: function* () { for (const k of Object.keys(store)) { yield k; } },
});

import {
  PluginSdkManager,
  ALL_PERMISSIONS,
  ALL_HOOKS,
  BUILT_IN_PLUGINS,
  usePluginSdk,
} from '../plugin-sdk';
import type {
  PluginManifest,
  PluginInitFn,
  PluginPermission,
  HookName,
} from '../plugin-sdk';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: 'test.plugin',
    name: 'Test Plugin',
    version: '1.0.0',
    description: 'A test plugin',
    author: 'Test Author',
    permissions: ['project:read', 'storage:read', 'storage:write'],
    hooks: ['onProjectOpen', 'onProjectSave'],
    entryPoint: 'test.js',
    ...overrides,
  };
}

const noopInit: PluginInitFn = () => { /* noop */ };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PluginSdkManager', () => {
  beforeEach(() => {
    PluginSdkManager.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    vi.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('should return the same instance', () => {
      const a = PluginSdkManager.getInstance();
      const b = PluginSdkManager.getInstance();
      expect(a).toBe(b);
    });

    it('should return a new instance after resetForTesting', () => {
      const a = PluginSdkManager.getInstance();
      PluginSdkManager.resetForTesting();
      const b = PluginSdkManager.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  describe('subscription', () => {
    it('should notify listeners on change', () => {
      const mgr = PluginSdkManager.getInstance();
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.loadPlugin(makeManifest(), noopInit);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const mgr = PluginSdkManager.getInstance();
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.loadPlugin(makeManifest(), noopInit);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  describe('persistence', () => {
    it('should persist plugins to localStorage', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should load plugins from localStorage on init', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      PluginSdkManager.resetForTesting();
      const mgr2 = PluginSdkManager.getInstance();
      expect(mgr2.getPlugin('test.plugin')).not.toBeNull();
    });

    it('should handle corrupted localStorage gracefully', () => {
      store['protopulse:plugins:state'] = '{{bad';
      const mgr = PluginSdkManager.getInstance();
      expect(mgr.getAllPlugins()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Manifest validation
  // -----------------------------------------------------------------------

  describe('manifest validation', () => {
    it('should validate a correct manifest', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject missing id', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({ id: '' }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('id'))).toBe(true);
    });

    it('should reject invalid id format', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({ id: 'INVALID ID!' }));
      expect(result.valid).toBe(false);
    });

    it('should accept valid id formats', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(mgr.validateManifest(makeManifest({ id: 'my-plugin' })).valid).toBe(true);
      expect(mgr.validateManifest(makeManifest({ id: 'my.plugin' })).valid).toBe(true);
      expect(mgr.validateManifest(makeManifest({ id: 'my_plugin' })).valid).toBe(true);
      expect(mgr.validateManifest(makeManifest({ id: 'plugin123' })).valid).toBe(true);
    });

    it('should reject missing name', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({ name: '' }));
      expect(result.valid).toBe(false);
    });

    it('should reject invalid version format', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({ version: 'abc' }));
      expect(result.valid).toBe(false);
    });

    it('should accept valid semver', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(mgr.validateManifest(makeManifest({ version: '1.0.0' })).valid).toBe(true);
      expect(mgr.validateManifest(makeManifest({ version: '2.3.4-beta' })).valid).toBe(true);
    });

    it('should reject invalid permissions', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({
        permissions: ['invalid:permission' as PluginPermission],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid permission'))).toBe(true);
    });

    it('should reject invalid hooks', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({
        hooks: ['invalidHook' as HookName],
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid hook'))).toBe(true);
    });

    it('should reject missing entryPoint', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({ entryPoint: '' }));
      expect(result.valid).toBe(false);
    });

    it('should reject missing description', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({ description: '' }));
      expect(result.valid).toBe(false);
    });

    it('should reject missing author', () => {
      const mgr = PluginSdkManager.getInstance();
      const result = mgr.validateManifest(makeManifest({ author: '' }));
      expect(result.valid).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Plugin lifecycle
  // -----------------------------------------------------------------------

  describe('plugin lifecycle', () => {
    it('should load a plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      const plugin = mgr.loadPlugin(makeManifest(), noopInit);
      expect(plugin.status).toBe('installed');
      expect(plugin.manifest.id).toBe('test.plugin');
    });

    it('should reject loading an already installed plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      expect(() => mgr.loadPlugin(makeManifest(), noopInit)).toThrow('already installed');
    });

    it('should reject loading with invalid manifest', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(() => mgr.loadPlugin(makeManifest({ id: '' }), noopInit)).toThrow('Invalid manifest');
    });

    it('should enable a plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      const enabled = mgr.enablePlugin('test.plugin');
      expect(enabled.status).toBe('enabled');
      expect(enabled.enabledAt).not.toBeNull();
    });

    it('should run init function when enabling', () => {
      const mgr = PluginSdkManager.getInstance();
      const init = vi.fn();
      mgr.loadPlugin(makeManifest(), init);
      mgr.enablePlugin('test.plugin');
      expect(init).toHaveBeenCalledTimes(1);
    });

    it('should set error status when init throws', () => {
      const mgr = PluginSdkManager.getInstance();
      const badInit: PluginInitFn = () => { throw new Error('Init failed'); };
      mgr.loadPlugin(makeManifest(), badInit);
      const plugin = mgr.enablePlugin('test.plugin');
      expect(plugin.status).toBe('error');
      expect(plugin.errorMessage).toBe('Init failed');
    });

    it('should return same plugin if already enabled', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      mgr.enablePlugin('test.plugin');
      const second = mgr.enablePlugin('test.plugin');
      expect(second.status).toBe('enabled');
    });

    it('should throw when enabling nonexistent plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(() => mgr.enablePlugin('nope')).toThrow('Plugin not found');
    });

    it('should disable a plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      mgr.enablePlugin('test.plugin');
      const disabled = mgr.disablePlugin('test.plugin');
      expect(disabled.status).toBe('disabled');
      expect(disabled.disabledAt).not.toBeNull();
      expect(disabled.panels).toHaveLength(0);
      expect(disabled.toolbarButtons).toHaveLength(0);
    });

    it('should return same plugin if already disabled', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      const disabled = mgr.disablePlugin('test.plugin');
      expect(disabled.status).toBe('disabled');
    });

    it('should throw when disabling nonexistent plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(() => mgr.disablePlugin('nope')).toThrow('Plugin not found');
    });

    it('should unload a plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      mgr.unloadPlugin('test.plugin');
      expect(mgr.getPlugin('test.plugin')).toBeNull();
    });

    it('should throw when unloading nonexistent plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(() => mgr.unloadPlugin('nope')).toThrow('Plugin not found');
    });

    it('should clean up plugin storage on unload', () => {
      const mgr = PluginSdkManager.getInstance();
      const manifest = makeManifest({ permissions: ['project:read', 'storage:read', 'storage:write'] });
      mgr.loadPlugin(manifest, (ctx) => {
        ctx.storage.set('testKey', 'testValue');
      });
      mgr.enablePlugin('test.plugin');
      expect(store['protopulse:plugin-data:test.plugin:testKey']).toBeTruthy();
      mgr.unloadPlugin('test.plugin');
      expect(store['protopulse:plugin-data:test.plugin:testKey']).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // Hook system
  // -----------------------------------------------------------------------

  describe('hook system', () => {
    it('should register and call hooks', () => {
      const mgr = PluginSdkManager.getInstance();
      const handler = vi.fn();
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.hooks.on('onProjectOpen', handler);
      });
      mgr.enablePlugin('test.plugin');
      mgr.callHook('onProjectOpen', { projectId: '1' });
      expect(handler).toHaveBeenCalledWith({ projectId: '1' });
    });

    it('should not call hooks for disabled plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      const handler = vi.fn();
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.hooks.on('onProjectOpen', handler);
      });
      mgr.enablePlugin('test.plugin');
      mgr.disablePlugin('test.plugin');
      mgr.callHook('onProjectOpen', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should reject registering for undeclared hook', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ hooks: ['onProjectOpen'] }), (ctx) => {
        expect(() => ctx.hooks.on('onDrcCompleted', vi.fn())).toThrow('not registered for hook');
      });
      mgr.enablePlugin('test.plugin');
    });

    it('should unregister hook handlers', () => {
      const mgr = PluginSdkManager.getInstance();
      const handler = vi.fn();
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.hooks.on('onProjectOpen', handler);
        ctx.hooks.off('onProjectOpen', handler);
      });
      mgr.enablePlugin('test.plugin');
      mgr.callHook('onProjectOpen', {});
      expect(handler).not.toHaveBeenCalled();
    });

    it('should handle hook errors gracefully', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.hooks.on('onProjectOpen', () => {
          throw new Error('Hook error!');
        });
      });
      mgr.enablePlugin('test.plugin');
      // Should not throw
      expect(() => mgr.callHook('onProjectOpen', {})).not.toThrow();
      // Should log the error
      const logs = mgr.getPluginLogs('test.plugin');
      expect(logs.some((l) => l.level === 'error' && l.message.includes('Hook error!'))).toBe(true);
    });

    it('should call hooks across multiple plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      const h1 = vi.fn();
      const h2 = vi.fn();
      mgr.loadPlugin(makeManifest({ id: 'plugin.a' }), (ctx) => {
        ctx.hooks.on('onProjectOpen', h1);
      });
      mgr.loadPlugin(makeManifest({ id: 'plugin.b' }), (ctx) => {
        ctx.hooks.on('onProjectOpen', h2);
      });
      mgr.enablePlugin('plugin.a');
      mgr.enablePlugin('plugin.b');
      mgr.callHook('onProjectOpen', {});
      expect(h1).toHaveBeenCalledTimes(1);
      expect(h2).toHaveBeenCalledTimes(1);
    });

    it('should do nothing when calling hook with no handlers', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(() => mgr.callHook('onProjectOpen', {})).not.toThrow();
    });
  });

  // -----------------------------------------------------------------------
  // Plugin storage (sandboxed)
  // -----------------------------------------------------------------------

  describe('plugin storage', () => {
    it('should get and set values', () => {
      const mgr = PluginSdkManager.getInstance();
      let storedValue: unknown;
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.storage.set('key', 'value');
        storedValue = ctx.storage.get('key');
      });
      mgr.enablePlugin('test.plugin');
      expect(storedValue).toBe('value');
    });

    it('should store complex objects', () => {
      const mgr = PluginSdkManager.getInstance();
      let storedValue: unknown;
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.storage.set('obj', { a: 1, b: [2, 3] });
        storedValue = ctx.storage.get('obj');
      });
      mgr.enablePlugin('test.plugin');
      expect(storedValue).toEqual({ a: 1, b: [2, 3] });
    });

    it('should return undefined for missing keys', () => {
      const mgr = PluginSdkManager.getInstance();
      let storedValue: unknown = 'not-undefined';
      mgr.loadPlugin(makeManifest(), (ctx) => {
        storedValue = ctx.storage.get('nonexistent');
      });
      mgr.enablePlugin('test.plugin');
      expect(storedValue).toBeUndefined();
    });

    it('should delete values', () => {
      const mgr = PluginSdkManager.getInstance();
      let result: unknown;
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.storage.set('key', 'value');
        ctx.storage.delete('key');
        result = ctx.storage.get('key');
      });
      mgr.enablePlugin('test.plugin');
      expect(result).toBeUndefined();
    });

    it('should list keys', () => {
      const mgr = PluginSdkManager.getInstance();
      let keys: string[] = [];
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.storage.set('a', 1);
        ctx.storage.set('b', 2);
        keys = ctx.storage.keys();
      });
      mgr.enablePlugin('test.plugin');
      expect(keys).toContain('a');
      expect(keys).toContain('b');
    });

    it('should clear all plugin storage', () => {
      const mgr = PluginSdkManager.getInstance();
      let keys: string[] = [];
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.storage.set('a', 1);
        ctx.storage.set('b', 2);
        ctx.storage.clear();
        keys = ctx.storage.keys();
      });
      mgr.enablePlugin('test.plugin');
      expect(keys).toHaveLength(0);
    });

    it('should isolate storage between plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ id: 'plugin.a' }), (ctx) => {
        ctx.storage.set('key', 'A');
      });
      mgr.loadPlugin(makeManifest({ id: 'plugin.b' }), (ctx) => {
        ctx.storage.set('key', 'B');
      });
      mgr.enablePlugin('plugin.a');
      mgr.enablePlugin('plugin.b');
      expect(store['protopulse:plugin-data:plugin.a:key']).toBe('"A"');
      expect(store['protopulse:plugin-data:plugin.b:key']).toBe('"B"');
    });

    it('should reject storage:read without permission', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read'] }), (ctx) => {
        expect(() => ctx.storage.get('key')).toThrow('storage:read permission');
      });
      mgr.enablePlugin('test.plugin');
    });

    it('should reject storage:write without permission', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read', 'storage:read'] }), (ctx) => {
        expect(() => ctx.storage.set('key', 'val')).toThrow('storage:write permission');
      });
      mgr.enablePlugin('test.plugin');
    });
  });

  // -----------------------------------------------------------------------
  // Plugin UI API
  // -----------------------------------------------------------------------

  describe('plugin UI API', () => {
    it('should register a panel', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read', 'ui:panel', 'storage:read', 'storage:write'] }), (ctx) => {
        ctx.ui.registerPanel({ id: 'my-panel', title: 'My Panel', position: 'right' });
      });
      mgr.enablePlugin('test.plugin');
      const plugin = mgr.getPlugin('test.plugin');
      expect(plugin!.panels).toHaveLength(1);
      expect(plugin!.panels[0].title).toBe('My Panel');
    });

    it('should not register duplicate panels', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read', 'ui:panel', 'storage:read', 'storage:write'] }), (ctx) => {
        ctx.ui.registerPanel({ id: 'my-panel', title: 'My Panel', position: 'right' });
        ctx.ui.registerPanel({ id: 'my-panel', title: 'Duplicate', position: 'left' });
      });
      mgr.enablePlugin('test.plugin');
      const plugin = mgr.getPlugin('test.plugin');
      expect(plugin!.panels).toHaveLength(1);
    });

    it('should reject panel without ui:panel permission', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read', 'storage:read', 'storage:write'] }), (ctx) => {
        expect(() => ctx.ui.registerPanel({ id: 'p', title: 'P', position: 'left' })).toThrow('ui:panel permission');
      });
      mgr.enablePlugin('test.plugin');
    });

    it('should register a toolbar button', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read', 'ui:toolbar', 'storage:read', 'storage:write'] }), (ctx) => {
        ctx.ui.registerToolbarButton({ id: 'my-btn', label: 'My Button' });
      });
      mgr.enablePlugin('test.plugin');
      const plugin = mgr.getPlugin('test.plugin');
      expect(plugin!.toolbarButtons).toHaveLength(1);
    });

    it('should reject toolbar button without ui:toolbar permission', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read', 'storage:read', 'storage:write'] }), (ctx) => {
        expect(() => ctx.ui.registerToolbarButton({ id: 'b', label: 'B' })).toThrow('ui:toolbar permission');
      });
      mgr.enablePlugin('test.plugin');
    });

    it('should show notifications', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.ui.showNotification('Hello!', 'success');
      });
      mgr.enablePlugin('test.plugin');
      const notifs = mgr.getPluginNotifications('test.plugin');
      expect(notifs).toHaveLength(1);
      expect(notifs[0].message).toBe('Hello!');
      expect(notifs[0].type).toBe('success');
    });
  });

  // -----------------------------------------------------------------------
  // Plugin logging
  // -----------------------------------------------------------------------

  describe('plugin logging', () => {
    it('should log messages', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.log('info', 'Test message');
        ctx.log('debug', 'Debug message');
      });
      mgr.enablePlugin('test.plugin');
      const logs = mgr.getPluginLogs('test.plugin');
      expect(logs.length).toBeGreaterThanOrEqual(2);
    });

    it('should throw when getting logs for nonexistent plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(() => mgr.getPluginLogs('nope')).toThrow('Plugin not found');
    });

    it('should throw when getting notifications for nonexistent plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(() => mgr.getPluginNotifications('nope')).toThrow('Plugin not found');
    });
  });

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  describe('queries', () => {
    it('should get plugin by id', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), noopInit);
      expect(mgr.getPlugin('test.plugin')).not.toBeNull();
    });

    it('should return null for unknown plugin', () => {
      const mgr = PluginSdkManager.getInstance();
      expect(mgr.getPlugin('nope')).toBeNull();
    });

    it('should get all plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ id: 'a' }), noopInit);
      mgr.loadPlugin(makeManifest({ id: 'b' }), noopInit);
      expect(mgr.getAllPlugins()).toHaveLength(2);
    });

    it('should get enabled plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ id: 'a' }), noopInit);
      mgr.loadPlugin(makeManifest({ id: 'b' }), noopInit);
      mgr.enablePlugin('a');
      expect(mgr.getEnabledPlugins()).toHaveLength(1);
    });

    it('should get plugins by permission', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ id: 'a', permissions: ['project:read'] }), noopInit);
      mgr.loadPlugin(makeManifest({ id: 'b', permissions: ['bom:read'] }), noopInit);
      expect(mgr.getPluginsByPermission('project:read')).toHaveLength(1);
    });

    it('should check permission', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ permissions: ['project:read'] }), noopInit);
      expect(mgr.checkPermission('test.plugin', 'project:read')).toBe(true);
      expect(mgr.checkPermission('test.plugin', 'bom:write')).toBe(false);
      expect(mgr.checkPermission('nonexistent', 'project:read')).toBe(false);
    });

    it('should get all panels from enabled plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ id: 'a', permissions: ['project:read', 'ui:panel', 'storage:read', 'storage:write'] }), (ctx) => {
        ctx.ui.registerPanel({ id: 'p1', title: 'Panel 1', position: 'left' });
      });
      mgr.enablePlugin('a');
      const panels = mgr.getAllPanels();
      expect(panels).toHaveLength(1);
      expect(panels[0].pluginId).toBe('a');
    });

    it('should not include panels from disabled plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ id: 'a', permissions: ['project:read', 'ui:panel', 'storage:read', 'storage:write'] }), (ctx) => {
        ctx.ui.registerPanel({ id: 'p1', title: 'Panel 1', position: 'left' });
      });
      mgr.enablePlugin('a');
      mgr.disablePlugin('a');
      expect(mgr.getAllPanels()).toHaveLength(0);
    });

    it('should get all toolbar buttons from enabled plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest({ id: 'a', permissions: ['project:read', 'ui:toolbar', 'storage:read', 'storage:write'] }), (ctx) => {
        ctx.ui.registerToolbarButton({ id: 'b1', label: 'Button 1' });
      });
      mgr.enablePlugin('a');
      const buttons = mgr.getAllToolbarButtons();
      expect(buttons).toHaveLength(1);
      expect(buttons[0].pluginId).toBe('a');
    });
  });

  // -----------------------------------------------------------------------
  // Built-in plugins
  // -----------------------------------------------------------------------

  describe('built-in plugins', () => {
    it('should have 3 built-in plugin factories', () => {
      expect(BUILT_IN_PLUGINS).toHaveLength(3);
    });

    it('should load all built-in plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      const loaded = mgr.loadBuiltInPlugins();
      expect(loaded).toHaveLength(3);
      expect(loaded.every((p) => p.status === 'installed')).toBe(true);
    });

    it('should not duplicate built-in plugins on second call', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadBuiltInPlugins();
      const second = mgr.loadBuiltInPlugins();
      expect(second).toHaveLength(0);
      expect(mgr.getAllPlugins()).toHaveLength(3);
    });

    it('should have valid manifests for all built-in plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      BUILT_IN_PLUGINS.forEach((createPlugin) => {
        const { manifest } = createPlugin();
        const result = mgr.validateManifest(manifest);
        expect(result.valid).toBe(true);
      });
    });

    it('should enable and init BOM Export Helper', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadBuiltInPlugins();
      const enabled = mgr.enablePlugin('protopulse.bom-export-helper');
      expect(enabled.status).toBe('enabled');
      expect(enabled.toolbarButtons.length).toBeGreaterThan(0);
    });

    it('should enable and init Design Linter', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadBuiltInPlugins();
      const enabled = mgr.enablePlugin('protopulse.design-linter');
      expect(enabled.status).toBe('enabled');
      expect(enabled.panels.length).toBeGreaterThan(0);
    });

    it('should enable and init Project Stats', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadBuiltInPlugins();
      const enabled = mgr.enablePlugin('protopulse.project-stats');
      expect(enabled.status).toBe('enabled');
      expect(enabled.panels.length).toBeGreaterThan(0);
    });

    it('should trigger hooks on built-in plugins', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadBuiltInPlugins();
      mgr.enablePlugin('protopulse.project-stats');
      // Should not throw
      mgr.callHook('onProjectOpen', { projectId: '1' });
      mgr.callHook('onProjectSave', {});
      mgr.callHook('onBomItemAdded', {});
    });
  });

  // -----------------------------------------------------------------------
  // Constants
  // -----------------------------------------------------------------------

  describe('constants', () => {
    it('should have 13 permissions defined', () => {
      expect(ALL_PERMISSIONS).toHaveLength(13);
    });

    it('should have 12 hooks defined', () => {
      expect(ALL_HOOKS).toHaveLength(12);
    });

    it('should include expected permissions', () => {
      expect(ALL_PERMISSIONS).toContain('project:read');
      expect(ALL_PERMISSIONS).toContain('project:write');
      expect(ALL_PERMISSIONS).toContain('ui:panel');
      expect(ALL_PERMISSIONS).toContain('storage:read');
      expect(ALL_PERMISSIONS).toContain('network:fetch');
    });

    it('should include expected hooks', () => {
      expect(ALL_HOOKS).toContain('onProjectOpen');
      expect(ALL_HOOKS).toContain('onDrcCompleted');
      expect(ALL_HOOKS).toContain('onSimulationCompleted');
    });
  });

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  describe('utility', () => {
    it('should clear all plugins and storage', () => {
      const mgr = PluginSdkManager.getInstance();
      mgr.loadPlugin(makeManifest(), (ctx) => {
        ctx.storage.set('key', 'val');
      });
      mgr.enablePlugin('test.plugin');
      mgr.clearAll();
      expect(mgr.getAllPlugins()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // React hook
  // -----------------------------------------------------------------------

  describe('usePluginSdk', () => {
    it('should be exported as a function', () => {
      expect(typeof usePluginSdk).toBe('function');
    });
  });
});
