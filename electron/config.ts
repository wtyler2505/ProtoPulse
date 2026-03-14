// ---------------------------------------------------------------------------
// Electron configuration — pure data, no Electron imports
// ---------------------------------------------------------------------------
// Exported for use by both main.ts and tests. This module has zero
// dependencies on Electron APIs so it can be imported in any environment.
// ---------------------------------------------------------------------------

// ── Window configuration ─────────────────────────────────────────────────────

export const CONFIG = {
  WINDOW_WIDTH: 1400,
  WINDOW_HEIGHT: 900,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
  BACKGROUND_COLOR: '#0a0a0f',
  DEV_SERVER_URL: 'http://localhost:5000',
} as const;

// ── IPC channel registry ─────────────────────────────────────────────────────

export const IPC_CHANNELS = {
  // Dialog channels
  DIALOG_SHOW_SAVE: 'dialog:showSave',
  DIALOG_SHOW_OPEN: 'dialog:showOpen',

  // Filesystem channels
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',

  // Shell channels
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',

  // Process channels
  PROCESS_SPAWN: 'process:spawn',

  // App info channels
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PLATFORM: 'app:getPlatform',

  // Menu action channels (main → renderer via webContents.send)
  MENU_NEW_PROJECT: 'menu:new-project',
  MENU_OPEN_PROJECT: 'menu:open-project',
  MENU_SAVE: 'menu:save',
} as const;

// ── Preload API surface ──────────────────────────────────────────────────────

export const PRELOAD_API_KEYS: readonly string[] = [
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
] as const;

export const PRELOAD_IPC_INVOKE_CHANNELS: readonly string[] = [
  'shell:openExternal',
  'dialog:showSave',
  'dialog:showOpen',
  'fs:readFile',
  'fs:writeFile',
  'process:spawn',
  'app:getVersion',
  'app:getPlatform',
] as const;

export const PRELOAD_IPC_ON_CHANNELS: readonly string[] = [
  'menu:new-project',
  'menu:open-project',
  'menu:save',
] as const;

// ── electron-builder configuration ───────────────────────────────────────────

export const BUILDER_CONFIG = {
  appId: 'com.protopulse.app',
  productName: 'ProtoPulse',
  directories: {
    output: 'release',
  },
  files: [
    'dist/**/*',
    'electron/**/*.js',
    'electron/**/*.cjs',
  ],
  linux: {
    target: ['AppImage', 'deb'],
    category: 'Development',
    icon: 'client/public/icon.png',
  },
  mac: {
    target: ['dmg'],
    icon: 'client/public/icon.icns',
  },
  win: {
    target: ['nsis'],
    icon: 'client/public/icon.ico',
  },
} as const;

// ── Menu template structure (Electron-free representation) ───────────────────

export interface MenuItemConfig {
  label?: string;
  role?: string;
  accelerator?: string;
  type?: 'separator';
  submenu?: MenuItemConfig[];
}

/**
 * Returns the application menu template as plain objects.
 * This is platform-aware (macOS gets an app menu) but does not
 * depend on Electron APIs — main.ts converts it to MenuItemConstructorOptions.
 */
export function buildMenuTemplate(platform: NodeJS.Platform = process.platform): MenuItemConfig[] {
  const isMac = platform === 'darwin';

  const fileMenu: MenuItemConfig = {
    label: 'File',
    submenu: [
      { label: 'New Project', accelerator: 'CmdOrCtrl+N' },
      { label: 'Open Project\u2026', accelerator: 'CmdOrCtrl+O' },
      { label: 'Save', accelerator: 'CmdOrCtrl+S' },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  };

  const editMenu: MenuItemConfig = {
    label: 'Edit',
    submenu: [
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' },
    ],
  };

  const viewMenu: MenuItemConfig = {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'forceReload' },
      { role: 'toggleDevTools' },
      { type: 'separator' },
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  };

  const helpMenu: MenuItemConfig = {
    label: 'Help',
    submenu: [
      { label: 'About ProtoPulse' },
      { type: 'separator' },
      { label: 'Learn More' },
    ],
  };

  const template: MenuItemConfig[] = [];

  if (isMac) {
    template.push({
      label: 'ProtoPulse',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push(fileMenu, editMenu, viewMenu, helpMenu);

  return template;
}
