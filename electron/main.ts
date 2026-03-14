import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { MenuItemConstructorOptions } from 'electron';

// ── Constants ────────────────────────────────────────────────────────────────

const WINDOW_WIDTH = 1400;
const WINDOW_HEIGHT = 900;
const BACKGROUND_COLOR = '#0a0a0f';
const DEV_SERVER_URL = 'http://localhost:5000';

// ── State ────────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;

// ── Server lifecycle ─────────────────────────────────────────────────────────

function startExpressServer(): ChildProcess | null {
  if (!app.isPackaged) {
    // In dev mode the Express server is started separately via `npm run dev`
    return null;
  }

  const serverEntry = path.join(__dirname, '..', 'dist', 'index.cjs');
  const child = spawn(process.execPath, [serverEntry], {
    env: { ...process.env, NODE_ENV: 'production' },
    stdio: 'pipe',
  });

  child.stdout?.on('data', (data: Buffer) => {
    console.log(`[server] ${data.toString().trim()}`);
  });

  child.stderr?.on('data', (data: Buffer) => {
    console.error(`[server] ${data.toString().trim()}`);
  });

  child.on('error', (err) => {
    console.error('Failed to start Express server:', err);
  });

  return child;
}

function stopExpressServer(): void {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// ── Window creation ──────────────────────────────────────────────────────────

function createMainWindow(): BrowserWindow {
  const preloadPath = path.join(__dirname, 'preload.js');

  const win = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: BACKGROUND_COLOR,
    title: 'ProtoPulse',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Show window once ready to avoid white flash
  win.once('ready-to-show', () => {
    win.show();
  });

  // Open external links in the default browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    void win.loadFile(path.join(__dirname, '..', 'dist', 'public', 'index.html'));
  } else {
    void win.loadURL(DEV_SERVER_URL);
  }

  return win;
}

// ── Menu ─────────────────────────────────────────────────────────────────────

export function buildMenuTemplate(): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  const fileMenu: MenuItemConstructorOptions = {
    label: 'File',
    submenu: [
      {
        label: 'New Project',
        accelerator: 'CmdOrCtrl+N',
        click: () => {
          mainWindow?.webContents.send('menu:new-project');
        },
      },
      {
        label: 'Open Project…',
        accelerator: 'CmdOrCtrl+O',
        click: () => {
          mainWindow?.webContents.send('menu:open-project');
        },
      },
      {
        label: 'Save',
        accelerator: 'CmdOrCtrl+S',
        click: () => {
          mainWindow?.webContents.send('menu:save');
        },
      },
      { type: 'separator' },
      isMac ? { role: 'close' } : { role: 'quit' },
    ],
  };

  const editMenu: MenuItemConstructorOptions = {
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

  const viewMenu: MenuItemConstructorOptions = {
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

  const helpMenu: MenuItemConstructorOptions = {
    label: 'Help',
    submenu: [
      {
        label: 'About ProtoPulse',
        click: () => {
          void dialog.showMessageBox({
            type: 'info',
            title: 'About ProtoPulse',
            message: 'ProtoPulse',
            detail: `Version ${app.getVersion()}\nAI-assisted EDA platform for makers, hobbyists, and embedded engineers.`,
          });
        },
      },
      { type: 'separator' },
      {
        label: 'Learn More',
        click: () => {
          void shell.openExternal('https://github.com/protopulse');
        },
      },
    ],
  };

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: app.name,
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

// ── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle('dialog:showSave', async (_event, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) {
      return { canceled: true, filePath: undefined };
    }
    return dialog.showSaveDialog(mainWindow, options);
  });

  ipcMain.handle('dialog:showOpen', async (_event, options: Electron.OpenDialogOptions) => {
    if (!mainWindow) {
      return { canceled: true, filePaths: [] };
    }
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle('fs:readFile', async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('fs:writeFile', async (_event, filePath: string, data: string) => {
    await fs.writeFile(filePath, data, 'utf-8');
  });

  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('process:spawn', (_event, command: string, args: string[]) => {
    return new Promise<{ stdout: string; stderr: string; exitCode: number | null }>((resolve, reject) => {
      const child = spawn(command, args);
      let stdout = '';
      let stderr = '';

      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (exitCode) => {
        resolve({ stdout, stderr, exitCode });
      });

      child.on('error', (err) => {
        reject(err);
      });
    });
  });

  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  ipcMain.handle('app:getPlatform', () => {
    return process.platform;
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.on('ready', () => {
  serverProcess = startExpressServer();
  registerIpcHandlers();

  const menuTemplate = buildMenuTemplate();
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow = createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopExpressServer();
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});

app.on('before-quit', () => {
  stopExpressServer();
});

// ── Exported constants for testing ───────────────────────────────────────────

export const CONFIG = {
  WINDOW_WIDTH,
  WINDOW_HEIGHT,
  BACKGROUND_COLOR,
  DEV_SERVER_URL,
  MIN_WIDTH: 800,
  MIN_HEIGHT: 600,
} as const;

export const IPC_CHANNELS = {
  DIALOG_SHOW_SAVE: 'dialog:showSave',
  DIALOG_SHOW_OPEN: 'dialog:showOpen',
  FS_READ_FILE: 'fs:readFile',
  FS_WRITE_FILE: 'fs:writeFile',
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  PROCESS_SPAWN: 'process:spawn',
  APP_GET_VERSION: 'app:getVersion',
  APP_GET_PLATFORM: 'app:getPlatform',
  MENU_NEW_PROJECT: 'menu:new-project',
  MENU_OPEN_PROJECT: 'menu:open-project',
  MENU_SAVE: 'menu:save',
} as const;

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
