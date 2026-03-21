/**
 * Plugin/Extension SDK
 *
 * Manages a plugin system with manifest validation, permission checking,
 * plugin lifecycle (load/unload), sandboxed plugin context (API/UI/Storage),
 * hook registration, and 3 built-in example plugins.
 * Singleton with localStorage persistence and subscription-based reactivity.
 *
 * Usage:
 *   const sdk = PluginSdkManager.getInstance();
 *   sdk.loadPlugin(manifest, initFn);
 *   sdk.enablePlugin('my-plugin');
 *   sdk.callHook('onProjectOpen', { projectId: '1' });
 *
 * React hook:
 *   const { plugins, loadPlugin, enablePlugin, disablePlugin } = usePluginSdk();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type PluginStatus = 'installed' | 'enabled' | 'disabled' | 'error';

export type PluginPermission =
  | 'project:read'
  | 'project:write'
  | 'bom:read'
  | 'bom:write'
  | 'circuit:read'
  | 'circuit:write'
  | 'ai:invoke'
  | 'export:execute'
  | 'ui:panel'
  | 'ui:toolbar'
  | 'storage:read'
  | 'storage:write'
  | 'network:fetch';

export const ALL_PERMISSIONS: PluginPermission[] = [
  'project:read',
  'project:write',
  'bom:read',
  'bom:write',
  'circuit:read',
  'circuit:write',
  'ai:invoke',
  'export:execute',
  'ui:panel',
  'ui:toolbar',
  'storage:read',
  'storage:write',
  'network:fetch',
];

export type HookName =
  | 'onProjectOpen'
  | 'onProjectClose'
  | 'onProjectSave'
  | 'onNodeAdded'
  | 'onNodeDeleted'
  | 'onBomItemAdded'
  | 'onBomItemUpdated'
  | 'onExportStarted'
  | 'onExportCompleted'
  | 'onSimulationStarted'
  | 'onSimulationCompleted'
  | 'onDrcCompleted';

export const ALL_HOOKS: HookName[] = [
  'onProjectOpen',
  'onProjectClose',
  'onProjectSave',
  'onNodeAdded',
  'onNodeDeleted',
  'onBomItemAdded',
  'onBomItemUpdated',
  'onExportStarted',
  'onExportCompleted',
  'onSimulationStarted',
  'onSimulationCompleted',
  'onDrcCompleted',
];

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  permissions: PluginPermission[];
  hooks: HookName[];
  entryPoint: string;
  minAppVersion?: string;
  maxAppVersion?: string;
  tags?: string[];
  homepage?: string;
  icon?: string;
}

export interface PluginStorageApi {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
  keys(): string[];
  clear(): void;
}

export interface PluginUiApi {
  showNotification(message: string, type?: 'info' | 'warning' | 'error' | 'success'): void;
  registerPanel(config: PanelConfig): void;
  registerToolbarButton(config: ToolbarButtonConfig): void;
}

export interface PanelConfig {
  id: string;
  title: string;
  icon?: string;
  position: 'left' | 'right' | 'bottom';
}

export interface ToolbarButtonConfig {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  onClick?: () => void;
}

export interface PluginApiContext {
  pluginId: string;
  permissions: PluginPermission[];
  storage: PluginStorageApi;
  ui: PluginUiApi;
  hooks: {
    on(hook: HookName, handler: HookHandler): void;
    off(hook: HookName, handler: HookHandler): void;
  };
  log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void;
}

export type HookHandler = (data: Record<string, unknown>) => void | Promise<void>;
export type PluginInitFn = (ctx: PluginApiContext) => void | Promise<void>;

export interface Plugin {
  manifest: PluginManifest;
  status: PluginStatus;
  installedAt: number;
  enabledAt: number | null;
  disabledAt: number | null;
  errorMessage: string | null;
  panels: PanelConfig[];
  toolbarButtons: ToolbarButtonConfig[];
  notifications: Array<{ message: string; type: string; timestamp: number }>;
  logs: Array<{ level: string; message: string; timestamp: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY_PLUGINS = 'protopulse:plugins:state';
const STORAGE_PREFIX = 'protopulse:plugin-data:';
const MAX_STORAGE_KEYS = 100;
const MAX_LOGS = 200;
const MAX_NOTIFICATIONS = 50;

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function validateManifest(manifest: PluginManifest): string[] {
  const errors: string[] = [];

  if (!manifest.id || typeof manifest.id !== 'string') {
    errors.push('id is required and must be a string');
  } else if (!/^[a-z0-9]([a-z0-9._-]*[a-z0-9])?$/.test(manifest.id)) {
    errors.push('id must be lowercase alphanumeric with dots, dashes, or underscores');
  }
  if (!manifest.name || typeof manifest.name !== 'string') {
    errors.push('name is required');
  }
  if (!manifest.version || typeof manifest.version !== 'string') {
    errors.push('version is required');
  } else if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
    errors.push('version must follow semver (e.g., 1.0.0)');
  }
  if (!manifest.description || typeof manifest.description !== 'string') {
    errors.push('description is required');
  }
  if (!manifest.author || typeof manifest.author !== 'string') {
    errors.push('author is required');
  }
  if (!Array.isArray(manifest.permissions)) {
    errors.push('permissions must be an array');
  } else {
    manifest.permissions.forEach((p) => {
      if (!ALL_PERMISSIONS.includes(p)) {
        errors.push(`Invalid permission: ${p}`);
      }
    });
  }
  if (!Array.isArray(manifest.hooks)) {
    errors.push('hooks must be an array');
  } else {
    manifest.hooks.forEach((h) => {
      if (!ALL_HOOKS.includes(h)) {
        errors.push(`Invalid hook: ${h}`);
      }
    });
  }
  if (!manifest.entryPoint || typeof manifest.entryPoint !== 'string') {
    errors.push('entryPoint is required');
  }

  return errors;
}

function hasPermission(plugin: Plugin, permission: PluginPermission): boolean {
  return plugin.manifest.permissions.includes(permission);
}

// ---------------------------------------------------------------------------
// Built-in example plugins
// ---------------------------------------------------------------------------

function createBomExportPlugin(): { manifest: PluginManifest; init: PluginInitFn } {
  return {
    manifest: {
      id: 'protopulse.bom-export-helper',
      name: 'BOM Export Helper',
      version: '1.0.0',
      description: 'Automatically formats and validates BOM data before export',
      author: 'ProtoPulse Team',
      permissions: ['bom:read', 'export:execute', 'ui:toolbar', 'storage:read', 'storage:write'],
      hooks: ['onExportStarted', 'onExportCompleted'],
      entryPoint: 'built-in',
      tags: ['bom', 'export', 'utility'],
    },
    init: (ctx) => {
      ctx.log('info', 'BOM Export Helper initialized');
      ctx.ui.registerToolbarButton({
        id: 'bom-export-btn',
        label: 'Quick BOM Export',
        tooltip: 'Export BOM with validation',
      });
      ctx.hooks.on('onExportStarted', (data) => {
        ctx.log('info', `Export started: ${JSON.stringify(data)}`);
        ctx.storage.set('lastExportAt', Date.now());
      });
      ctx.hooks.on('onExportCompleted', () => {
        ctx.ui.showNotification('BOM export completed successfully', 'success');
      });
    },
  };
}

function createDesignLinterPlugin(): { manifest: PluginManifest; init: PluginInitFn } {
  return {
    manifest: {
      id: 'protopulse.design-linter',
      name: 'Design Linter',
      version: '1.0.0',
      description: 'Runs custom lint rules on architecture and circuit designs',
      author: 'ProtoPulse Team',
      permissions: ['project:read', 'circuit:read', 'ui:panel'],
      hooks: ['onNodeAdded', 'onNodeDeleted', 'onDrcCompleted'],
      entryPoint: 'built-in',
      tags: ['lint', 'validation', 'quality'],
    },
    init: (ctx) => {
      ctx.log('info', 'Design Linter initialized');
      ctx.ui.registerPanel({
        id: 'lint-panel',
        title: 'Design Lint',
        position: 'right',
      });
      ctx.hooks.on('onNodeAdded', (data) => {
        ctx.log('debug', `Node added: ${String(data['label'] ?? 'unknown')}`);
      });
      ctx.hooks.on('onDrcCompleted', (data) => {
        const violations = (data['violationCount'] as number | undefined) ?? 0;
        if (violations > 0) {
          ctx.ui.showNotification(`DRC found ${String(violations)} issues`, 'warning');
        }
      });
    },
  };
}

function createProjectStatsPlugin(): { manifest: PluginManifest; init: PluginInitFn } {
  return {
    manifest: {
      id: 'protopulse.project-stats',
      name: 'Project Statistics',
      version: '1.0.0',
      description: 'Tracks and displays project activity statistics',
      author: 'ProtoPulse Team',
      permissions: ['project:read', 'bom:read', 'ui:panel', 'storage:read', 'storage:write'],
      hooks: ['onProjectOpen', 'onProjectSave', 'onBomItemAdded'],
      entryPoint: 'built-in',
      tags: ['stats', 'analytics', 'tracking'],
    },
    init: (ctx) => {
      ctx.log('info', 'Project Stats initialized');
      ctx.ui.registerPanel({
        id: 'stats-panel',
        title: 'Project Stats',
        position: 'left',
      });
      ctx.hooks.on('onProjectOpen', () => {
        const opens = (ctx.storage.get('openCount') as number | undefined) ?? 0;
        ctx.storage.set('openCount', opens + 1);
      });
      ctx.hooks.on('onProjectSave', () => {
        ctx.storage.set('lastSaveAt', Date.now());
      });
      ctx.hooks.on('onBomItemAdded', () => {
        const adds = (ctx.storage.get('bomAdds') as number | undefined) ?? 0;
        ctx.storage.set('bomAdds', adds + 1);
      });
    },
  };
}

export const BUILT_IN_PLUGINS = [
  createBomExportPlugin,
  createDesignLinterPlugin,
  createProjectStatsPlugin,
];

// ---------------------------------------------------------------------------
// PluginSdkManager
// ---------------------------------------------------------------------------

export class PluginSdkManager {
  private static instance: PluginSdkManager | null = null;

  private plugins: Map<string, Plugin> = new Map();
  private hookHandlers: Map<HookName, Map<string, HookHandler[]>> = new Map();
  private initFns: Map<string, PluginInitFn> = new Map();
  private listeners = new Set<Listener>();

  constructor() {
    this.loadState();
  }

  static getInstance(): PluginSdkManager {
    if (!PluginSdkManager.instance) {
      PluginSdkManager.instance = new PluginSdkManager();
    }
    return PluginSdkManager.instance;
  }

  static resetForTesting(): void {
    PluginSdkManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

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
  // Persistence
  // -----------------------------------------------------------------------

  private loadState(): void {
    try {
      const json = localStorage.getItem(STORAGE_KEY_PLUGINS);
      if (json) {
        const entries = JSON.parse(json) as Array<[string, Plugin]>;
        this.plugins = new Map(entries);
      }
    } catch {
      this.plugins = new Map();
    }
  }

  private saveState(): void {
    const entries = Array.from(this.plugins.entries());
    localStorage.setItem(STORAGE_KEY_PLUGINS, JSON.stringify(entries));
  }

  // -----------------------------------------------------------------------
  // Plugin storage (sandboxed per-plugin)
  // -----------------------------------------------------------------------

  private createPluginStorage(pluginId: string, plugin: Plugin): PluginStorageApi {
    const prefix = `${STORAGE_PREFIX}${pluginId}:`;

    return {
      get(key: string): unknown {
        if (!hasPermission(plugin, 'storage:read')) {
          throw new Error(`Plugin "${pluginId}" lacks storage:read permission`);
        }
        const val = localStorage.getItem(`${prefix}${key}`);
        if (val === null) {
          return undefined;
        }
        try {
          return JSON.parse(val) as unknown;
        } catch {
          return val;
        }
      },
      set(key: string, value: unknown): void {
        if (!hasPermission(plugin, 'storage:write')) {
          throw new Error(`Plugin "${pluginId}" lacks storage:write permission`);
        }
        // Check key limit
        const existingKeys = this.keys();
        if (!existingKeys.includes(key) && existingKeys.length >= MAX_STORAGE_KEYS) {
          throw new Error(`Plugin storage limit exceeded (max ${String(MAX_STORAGE_KEYS)} keys)`);
        }
        localStorage.setItem(`${prefix}${key}`, JSON.stringify(value));
      },
      delete(key: string): void {
        if (!hasPermission(plugin, 'storage:write')) {
          throw new Error(`Plugin "${pluginId}" lacks storage:write permission`);
        }
        localStorage.removeItem(`${prefix}${key}`);
      },
      keys(): string[] {
        if (!hasPermission(plugin, 'storage:read')) {
          throw new Error(`Plugin "${pluginId}" lacks storage:read permission`);
        }
        const result: string[] = [];
        for (const k of Object.keys(localStorage)) {
          if (typeof k === 'string' && k.startsWith(prefix)) {
            result.push(k.slice(prefix.length));
          }
        }
        return result;
      },
      clear(): void {
        if (!hasPermission(plugin, 'storage:write')) {
          throw new Error(`Plugin "${pluginId}" lacks storage:write permission`);
        }
        const keysToRemove: string[] = [];
        for (const k of Object.keys(localStorage)) {
          if (typeof k === 'string' && k.startsWith(prefix)) {
            keysToRemove.push(k);
          }
        }
        keysToRemove.forEach((k) => {
          localStorage.removeItem(k);
        });
      },
    };
  }

  // -----------------------------------------------------------------------
  // Plugin UI API (sandboxed)
  // -----------------------------------------------------------------------

  private createPluginUiApi(pluginId: string, plugin: Plugin): PluginUiApi {
    const self = this;
    return {
      showNotification(message: string, type: 'info' | 'warning' | 'error' | 'success' = 'info'): void {
        const p = self.plugins.get(pluginId);
        if (!p) {
          return;
        }
        const notifications = [...p.notifications, { message, type, timestamp: Date.now() }];
        if (notifications.length > MAX_NOTIFICATIONS) {
          notifications.splice(0, notifications.length - MAX_NOTIFICATIONS);
        }
        self.plugins.set(pluginId, { ...p, notifications });
        self.saveState();
        self.notify();
      },
      registerPanel(config: PanelConfig): void {
        if (!hasPermission(plugin, 'ui:panel')) {
          throw new Error(`Plugin "${pluginId}" lacks ui:panel permission`);
        }
        const p = self.plugins.get(pluginId);
        if (!p) {
          return;
        }
        // Avoid duplicate panels
        if (p.panels.some((panel) => panel.id === config.id)) {
          return;
        }
        self.plugins.set(pluginId, { ...p, panels: [...p.panels, config] });
        self.saveState();
        self.notify();
      },
      registerToolbarButton(config: ToolbarButtonConfig): void {
        if (!hasPermission(plugin, 'ui:toolbar')) {
          throw new Error(`Plugin "${pluginId}" lacks ui:toolbar permission`);
        }
        const p = self.plugins.get(pluginId);
        if (!p) {
          return;
        }
        if (p.toolbarButtons.some((btn) => btn.id === config.id)) {
          return;
        }
        self.plugins.set(pluginId, { ...p, toolbarButtons: [...p.toolbarButtons, config] });
        self.saveState();
        self.notify();
      },
    };
  }

  // -----------------------------------------------------------------------
  // Plugin context builder
  // -----------------------------------------------------------------------

  private createPluginContext(pluginId: string, plugin: Plugin): PluginApiContext {
    const self = this;
    const storage = this.createPluginStorage(pluginId, plugin);
    const ui = this.createPluginUiApi(pluginId, plugin);

    return {
      pluginId,
      permissions: [...plugin.manifest.permissions],
      storage,
      ui,
      hooks: {
        on(hook: HookName, handler: HookHandler): void {
          if (!plugin.manifest.hooks.includes(hook)) {
            throw new Error(`Plugin "${pluginId}" is not registered for hook "${hook}"`);
          }
          if (!self.hookHandlers.has(hook)) {
            self.hookHandlers.set(hook, new Map());
          }
          const hookMap = self.hookHandlers.get(hook)!;
          if (!hookMap.has(pluginId)) {
            hookMap.set(pluginId, []);
          }
          hookMap.get(pluginId)!.push(handler);
        },
        off(hook: HookName, handler: HookHandler): void {
          const hookMap = self.hookHandlers.get(hook);
          if (!hookMap) {
            return;
          }
          const handlers = hookMap.get(pluginId);
          if (!handlers) {
            return;
          }
          const idx = handlers.indexOf(handler);
          if (idx !== -1) {
            handlers.splice(idx, 1);
          }
        },
      },
      log(level: 'debug' | 'info' | 'warn' | 'error', message: string): void {
        const p = self.plugins.get(pluginId);
        if (!p) {
          return;
        }
        const logs = [...p.logs, { level, message, timestamp: Date.now() }];
        if (logs.length > MAX_LOGS) {
          logs.splice(0, logs.length - MAX_LOGS);
        }
        self.plugins.set(pluginId, { ...p, logs });
        // Don't save/notify on every log to avoid perf issues — save on major changes only
      },
    };
  }

  // -----------------------------------------------------------------------
  // Plugin lifecycle
  // -----------------------------------------------------------------------

  validateManifest(manifest: PluginManifest): { valid: boolean; errors: string[] } {
    const errors = validateManifest(manifest);
    return { valid: errors.length === 0, errors };
  }

  loadPlugin(manifest: PluginManifest, initFn: PluginInitFn): Plugin {
    const validation = this.validateManifest(manifest);
    if (!validation.valid) {
      throw new Error(`Invalid manifest: ${validation.errors.join('; ')}`);
    }

    if (this.plugins.has(manifest.id)) {
      throw new Error(`Plugin already installed: ${manifest.id}`);
    }

    const plugin: Plugin = {
      manifest,
      status: 'installed',
      installedAt: Date.now(),
      enabledAt: null,
      disabledAt: null,
      errorMessage: null,
      panels: [],
      toolbarButtons: [],
      notifications: [],
      logs: [],
    };

    this.plugins.set(manifest.id, plugin);
    this.initFns.set(manifest.id, initFn);
    this.saveState();
    this.notify();
    return plugin;
  }

  enablePlugin(pluginId: string): Plugin {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    if (plugin.status === 'enabled') {
      return plugin;
    }

    const initFn = this.initFns.get(pluginId);
    if (!initFn) {
      throw new Error(`No init function registered for plugin: ${pluginId}`);
    }

    try {
      const ctx = this.createPluginContext(pluginId, plugin);
      initFn(ctx);
      const updated: Plugin = {
        ...this.plugins.get(pluginId)!, // re-read since init may have modified
        status: 'enabled',
        enabledAt: Date.now(),
        errorMessage: null,
      };
      this.plugins.set(pluginId, updated);
      this.saveState();
      this.notify();
      return updated;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const errored: Plugin = {
        ...plugin,
        status: 'error',
        errorMessage,
      };
      this.plugins.set(pluginId, errored);
      this.saveState();
      this.notify();
      return errored;
    }
  }

  disablePlugin(pluginId: string): Plugin {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    if (plugin.status === 'disabled') {
      return plugin;
    }

    // Remove all hook handlers for this plugin
    this.hookHandlers.forEach((hookMap) => {
      hookMap.delete(pluginId);
    });

    const updated: Plugin = {
      ...plugin,
      status: 'disabled',
      disabledAt: Date.now(),
      panels: [],
      toolbarButtons: [],
    };
    this.plugins.set(pluginId, updated);
    this.saveState();
    this.notify();
    return updated;
  }

  unloadPlugin(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Remove hook handlers
    this.hookHandlers.forEach((hookMap) => {
      hookMap.delete(pluginId);
    });

    // Clear plugin storage
    const prefix = `${STORAGE_PREFIX}${pluginId}:`;
    const keysToRemove: string[] = [];
    for (const k of Object.keys(localStorage)) {
      if (typeof k === 'string' && k.startsWith(prefix)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => {
      localStorage.removeItem(k);
    });

    this.plugins.delete(pluginId);
    this.initFns.delete(pluginId);
    this.saveState();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Hook execution
  // -----------------------------------------------------------------------

  callHook(hook: HookName, data: Record<string, unknown> = {}): void {
    const hookMap = this.hookHandlers.get(hook);
    if (!hookMap) {
      return;
    }
    hookMap.forEach((handlers, pluginId) => {
      const plugin = this.plugins.get(pluginId);
      if (!plugin || plugin.status !== 'enabled') {
        return;
      }
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          const p = this.plugins.get(pluginId);
          if (p) {
            this.plugins.set(pluginId, {
              ...p,
              logs: [...p.logs, { level: 'error', message: `Hook ${hook} error: ${errorMessage}`, timestamp: Date.now() }],
            });
          }
        }
      });
    });
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  getPlugin(id: string): Plugin | null {
    return this.plugins.get(id) ?? null;
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.status === 'enabled');
  }

  getPluginsByPermission(permission: PluginPermission): Plugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.manifest.permissions.includes(permission));
  }

  getPluginLogs(pluginId: string): Array<{ level: string; message: string; timestamp: number }> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    return [...plugin.logs];
  }

  getPluginNotifications(pluginId: string): Array<{ message: string; type: string; timestamp: number }> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }
    return [...plugin.notifications];
  }

  getAllPanels(): Array<PanelConfig & { pluginId: string }> {
    const panels: Array<PanelConfig & { pluginId: string }> = [];
    this.plugins.forEach((plugin, pluginId) => {
      if (plugin.status === 'enabled') {
        plugin.panels.forEach((panel) => {
          panels.push({ ...panel, pluginId });
        });
      }
    });
    return panels;
  }

  getAllToolbarButtons(): Array<ToolbarButtonConfig & { pluginId: string }> {
    const buttons: Array<ToolbarButtonConfig & { pluginId: string }> = [];
    this.plugins.forEach((plugin, pluginId) => {
      if (plugin.status === 'enabled') {
        plugin.toolbarButtons.forEach((btn) => {
          buttons.push({ ...btn, pluginId });
        });
      }
    });
    return buttons;
  }

  checkPermission(pluginId: string, permission: PluginPermission): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return false;
    }
    return hasPermission(plugin, permission);
  }

  // -----------------------------------------------------------------------
  // Built-in plugins
  // -----------------------------------------------------------------------

  loadBuiltInPlugins(): Plugin[] {
    const loaded: Plugin[] = [];
    BUILT_IN_PLUGINS.forEach((createPlugin) => {
      const { manifest, init } = createPlugin();
      if (!this.plugins.has(manifest.id)) {
        const plugin = this.loadPlugin(manifest, init);
        loaded.push(plugin);
      }
    });
    return loaded;
  }

  // -----------------------------------------------------------------------
  // Utility
  // -----------------------------------------------------------------------

  clearAll(): void {
    // Clear all plugin storage
    this.plugins.forEach((_plugin, pluginId) => {
      const prefix = `${STORAGE_PREFIX}${pluginId}:`;
      const keysToRemove: string[] = [];
      for (const k of Object.keys(localStorage)) {
        if (typeof k === 'string' && k.startsWith(prefix)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => {
        localStorage.removeItem(k);
      });
    });
    this.plugins = new Map();
    this.hookHandlers = new Map();
    this.initFns = new Map();
    this.saveState();
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

export function usePluginSdk(): {
  plugins: Plugin[];
  enabledPlugins: Plugin[];
  panels: Array<PanelConfig & { pluginId: string }>;
  toolbarButtons: Array<ToolbarButtonConfig & { pluginId: string }>;
  loadPlugin: (manifest: PluginManifest, initFn: PluginInitFn) => Plugin;
  enablePlugin: (pluginId: string) => Plugin;
  disablePlugin: (pluginId: string) => Plugin;
  unloadPlugin: (pluginId: string) => void;
  loadBuiltInPlugins: () => Plugin[];
  checkPermission: (pluginId: string, permission: PluginPermission) => boolean;
} {
  const mgr = PluginSdkManager.getInstance();
  const [, setTick] = useState(0);

  useEffect(() => {
    return mgr.subscribe(() => {
      setTick((t) => t + 1);
    });
  }, [mgr]);

  return {
    plugins: mgr.getAllPlugins(),
    enabledPlugins: mgr.getEnabledPlugins(),
    panels: mgr.getAllPanels(),
    toolbarButtons: mgr.getAllToolbarButtons(),
    loadPlugin: useCallback((manifest: PluginManifest, initFn: PluginInitFn) => mgr.loadPlugin(manifest, initFn), [mgr]),
    enablePlugin: useCallback((pluginId: string) => mgr.enablePlugin(pluginId), [mgr]),
    disablePlugin: useCallback((pluginId: string) => mgr.disablePlugin(pluginId), [mgr]),
    unloadPlugin: useCallback((pluginId: string) => mgr.unloadPlugin(pluginId), [mgr]),
    loadBuiltInPlugins: useCallback(() => mgr.loadBuiltInPlugins(), [mgr]),
    checkPermission: useCallback((pluginId: string, permission: PluginPermission) => mgr.checkPermission(pluginId, permission), [mgr]),
  };
}
