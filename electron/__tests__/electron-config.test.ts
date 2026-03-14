import { describe, it, expect } from 'vitest';
import {
  CONFIG,
  IPC_CHANNELS,
  BUILDER_CONFIG,
  PRELOAD_API_KEYS,
  PRELOAD_IPC_INVOKE_CHANNELS,
  PRELOAD_IPC_ON_CHANNELS,
  buildMenuTemplate,
} from '../config';
import type { MenuItemConfig } from '../config';

// ── Window configuration ─────────────────────────────────────────────────────

describe('Electron window configuration', () => {
  it('uses 1400x900 default dimensions', () => {
    expect(CONFIG.WINDOW_WIDTH).toBe(1400);
    expect(CONFIG.WINDOW_HEIGHT).toBe(900);
  });

  it('sets minimum window size to 800x600', () => {
    expect(CONFIG.MIN_WIDTH).toBe(800);
    expect(CONFIG.MIN_HEIGHT).toBe(600);
  });

  it('uses the ProtoPulse dark background color', () => {
    expect(CONFIG.BACKGROUND_COLOR).toBe('#0a0a0f');
  });

  it('points dev server at http://localhost:5000', () => {
    expect(CONFIG.DEV_SERVER_URL).toBe('http://localhost:5000');
  });

  it('minimum dimensions are smaller than default dimensions', () => {
    expect(CONFIG.MIN_WIDTH).toBeLessThan(CONFIG.WINDOW_WIDTH);
    expect(CONFIG.MIN_HEIGHT).toBeLessThan(CONFIG.WINDOW_HEIGHT);
  });
});

// ── IPC channels ─────────────────────────────────────────────────────────────

describe('IPC channel registry', () => {
  it('defines all expected IPC handle channels', () => {
    expect(IPC_CHANNELS.DIALOG_SHOW_SAVE).toBe('dialog:showSave');
    expect(IPC_CHANNELS.DIALOG_SHOW_OPEN).toBe('dialog:showOpen');
    expect(IPC_CHANNELS.FS_READ_FILE).toBe('fs:readFile');
    expect(IPC_CHANNELS.FS_WRITE_FILE).toBe('fs:writeFile');
    expect(IPC_CHANNELS.SHELL_OPEN_EXTERNAL).toBe('shell:openExternal');
    expect(IPC_CHANNELS.PROCESS_SPAWN).toBe('process:spawn');
    expect(IPC_CHANNELS.APP_GET_VERSION).toBe('app:getVersion');
    expect(IPC_CHANNELS.APP_GET_PLATFORM).toBe('app:getPlatform');
  });

  it('defines all expected menu action channels', () => {
    expect(IPC_CHANNELS.MENU_NEW_PROJECT).toBe('menu:new-project');
    expect(IPC_CHANNELS.MENU_OPEN_PROJECT).toBe('menu:open-project');
    expect(IPC_CHANNELS.MENU_SAVE).toBe('menu:save');
  });

  it('uses colon-separated namespace format for all channels', () => {
    const channels = Object.values(IPC_CHANNELS);
    for (const channel of channels) {
      expect(channel).toMatch(/^[a-z]+:[a-zA-Z-]+$/);
    }
  });

  it('has no duplicate channel names', () => {
    const channels = Object.values(IPC_CHANNELS);
    const uniqueChannels = new Set(channels);
    expect(uniqueChannels.size).toBe(channels.length);
  });

  it('has exactly 11 registered channels', () => {
    const channels = Object.values(IPC_CHANNELS);
    expect(channels).toHaveLength(11);
  });
});

// ── Preload API surface ──────────────────────────────────────────────────────

describe('Preload API surface', () => {
  it('exposes the expected API keys', () => {
    const expected = [
      'platform',
      'openExternal',
      'showSaveDialog',
      'showOpenDialog',
      'readFile',
      'writeFile',
      'spawnProcess',
      'getVersion',
      'getPlatform',
      'onMenuAction',
    ];
    expect(PRELOAD_API_KEYS).toEqual(expected);
  });

  it('exposes exactly 10 API methods/properties', () => {
    expect(PRELOAD_API_KEYS).toHaveLength(10);
  });

  it('lists all IPC invoke channels used by preload', () => {
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('shell:openExternal');
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('dialog:showSave');
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('dialog:showOpen');
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('fs:readFile');
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('fs:writeFile');
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('process:spawn');
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('app:getVersion');
    expect(PRELOAD_IPC_INVOKE_CHANNELS).toContain('app:getPlatform');
  });

  it('lists all IPC on channels for menu actions', () => {
    expect(PRELOAD_IPC_ON_CHANNELS).toContain('menu:new-project');
    expect(PRELOAD_IPC_ON_CHANNELS).toContain('menu:open-project');
    expect(PRELOAD_IPC_ON_CHANNELS).toContain('menu:save');
  });

  it('has matching IPC invoke channels between main and preload', () => {
    const mainChannels = new Set(Object.values(IPC_CHANNELS));
    for (const channel of PRELOAD_IPC_INVOKE_CHANNELS) {
      expect(mainChannels.has(channel)).toBe(true);
    }
  });

  it('has matching IPC on channels between main and preload', () => {
    const mainChannels = new Set(Object.values(IPC_CHANNELS));
    for (const channel of PRELOAD_IPC_ON_CHANNELS) {
      expect(mainChannels.has(channel)).toBe(true);
    }
  });

  it('invoke channels have no duplicates', () => {
    const unique = new Set(PRELOAD_IPC_INVOKE_CHANNELS);
    expect(unique.size).toBe(PRELOAD_IPC_INVOKE_CHANNELS.length);
  });
});

// ── electron-builder configuration ───────────────────────────────────────────

describe('electron-builder configuration', () => {
  it('uses the correct appId', () => {
    expect(BUILDER_CONFIG.appId).toBe('com.protopulse.app');
  });

  it('uses ProtoPulse as the product name', () => {
    expect(BUILDER_CONFIG.productName).toBe('ProtoPulse');
  });

  it('includes dist and electron files', () => {
    expect(BUILDER_CONFIG.files).toContain('dist/**/*');
    expect(BUILDER_CONFIG.files.some((f: string) => f.startsWith('electron/'))).toBe(true);
  });

  it('targets AppImage and deb for Linux', () => {
    expect(BUILDER_CONFIG.linux.target).toContain('AppImage');
    expect(BUILDER_CONFIG.linux.target).toContain('deb');
  });

  it('targets dmg for macOS', () => {
    expect(BUILDER_CONFIG.mac.target).toContain('dmg');
  });

  it('targets nsis for Windows', () => {
    expect(BUILDER_CONFIG.win.target).toContain('nsis');
  });

  it('categorizes the Linux app as Development', () => {
    expect(BUILDER_CONFIG.linux.category).toBe('Development');
  });

  it('outputs releases to the release directory', () => {
    expect(BUILDER_CONFIG.directories.output).toBe('release');
  });
});

// ── Menu template ────────────────────────────────────────────────────────────

describe('Menu template', () => {
  it('includes File, Edit, View, and Help menus on non-macOS', () => {
    const template = buildMenuTemplate('linux');
    const labels = template.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('File');
    expect(labels).toContain('Edit');
    expect(labels).toContain('View');
    expect(labels).toContain('Help');
  });

  it('adds an app menu on macOS', () => {
    const template = buildMenuTemplate('darwin');
    expect(template[0].label).toBe('ProtoPulse');
    expect(template).toHaveLength(5); // App + File + Edit + View + Help
  });

  it('has 4 menus on non-macOS platforms', () => {
    const template = buildMenuTemplate('linux');
    expect(template).toHaveLength(4); // File + Edit + View + Help
  });

  it('File menu contains New Project, Open Project, Save', () => {
    const template = buildMenuTemplate('linux');
    const fileMenu = template.find((item) => item.label === 'File');
    expect(fileMenu).toBeDefined();
    const submenu = fileMenu!.submenu as MenuItemConfig[];
    const labels = submenu.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('New Project');
    expect(labels).toContain('Open Project\u2026');
    expect(labels).toContain('Save');
  });

  it('Help menu contains About ProtoPulse', () => {
    const template = buildMenuTemplate('linux');
    const helpMenu = template.find((item) => item.label === 'Help');
    expect(helpMenu).toBeDefined();
    const submenu = helpMenu!.submenu as MenuItemConfig[];
    const labels = submenu.map((item) => item.label).filter(Boolean);
    expect(labels).toContain('About ProtoPulse');
  });

  it('File menu items have keyboard accelerators', () => {
    const template = buildMenuTemplate('linux');
    const fileMenu = template.find((item) => item.label === 'File');
    const submenu = fileMenu!.submenu as MenuItemConfig[];
    const newProject = submenu.find((item) => item.label === 'New Project');
    const openProject = submenu.find((item) => item.label === 'Open Project\u2026');
    const save = submenu.find((item) => item.label === 'Save');
    expect(newProject?.accelerator).toBe('CmdOrCtrl+N');
    expect(openProject?.accelerator).toBe('CmdOrCtrl+O');
    expect(save?.accelerator).toBe('CmdOrCtrl+S');
  });

  it('File menu ends with quit on Linux', () => {
    const template = buildMenuTemplate('linux');
    const fileMenu = template.find((item) => item.label === 'File');
    const submenu = fileMenu!.submenu as MenuItemConfig[];
    const lastItem = submenu[submenu.length - 1];
    expect(lastItem.role).toBe('quit');
  });

  it('File menu ends with close on macOS', () => {
    const template = buildMenuTemplate('darwin');
    const fileMenu = template.find((item) => item.label === 'File');
    const submenu = fileMenu!.submenu as MenuItemConfig[];
    const lastItem = submenu[submenu.length - 1];
    expect(lastItem.role).toBe('close');
  });

  it('Edit menu has standard editing roles', () => {
    const template = buildMenuTemplate('linux');
    const editMenu = template.find((item) => item.label === 'Edit');
    const submenu = editMenu!.submenu as MenuItemConfig[];
    const roles = submenu.map((item) => item.role).filter(Boolean);
    expect(roles).toContain('undo');
    expect(roles).toContain('redo');
    expect(roles).toContain('cut');
    expect(roles).toContain('copy');
    expect(roles).toContain('paste');
    expect(roles).toContain('selectAll');
  });

  it('View menu has dev tools and zoom controls', () => {
    const template = buildMenuTemplate('linux');
    const viewMenu = template.find((item) => item.label === 'View');
    const submenu = viewMenu!.submenu as MenuItemConfig[];
    const roles = submenu.map((item) => item.role).filter(Boolean);
    expect(roles).toContain('toggleDevTools');
    expect(roles).toContain('zoomIn');
    expect(roles).toContain('zoomOut');
    expect(roles).toContain('resetZoom');
    expect(roles).toContain('togglefullscreen');
  });
});
