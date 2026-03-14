import { app, BrowserWindow, Menu, shell, ipcMain, dialog } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import type { MenuItemConstructorOptions } from 'electron';
import { CONFIG, IPC_CHANNELS } from './config';
import type { MenuItemConfig } from './config';
import { buildMenuTemplate as buildMenuTemplateConfig } from './config';

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
  const preloadPath = path.join(__dirname, 'preload.cjs');

  const win = new BrowserWindow({
    width: CONFIG.WINDOW_WIDTH,
    height: CONFIG.WINDOW_HEIGHT,
    minWidth: CONFIG.MIN_WIDTH,
    minHeight: CONFIG.MIN_HEIGHT,
    backgroundColor: CONFIG.BACKGROUND_COLOR,
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
    void win.loadURL(CONFIG.DEV_SERVER_URL);
  }

  return win;
}

// ── Menu ─────────────────────────────────────────────────────────────────────

/**
 * Converts the platform-agnostic menu config into Electron MenuItemConstructorOptions,
 * wiring up click handlers for custom menu items.
 */
function toElectronMenuItems(items: MenuItemConfig[]): MenuItemConstructorOptions[] {
  return items.map((item) => {
    const electronItem: MenuItemConstructorOptions = {};

    if (item.label) {
      electronItem.label = item.label;
    }
    if (item.role) {
      electronItem.role = item.role as MenuItemConstructorOptions['role'];
    }
    if (item.accelerator) {
      electronItem.accelerator = item.accelerator;
    }
    if (item.type) {
      electronItem.type = item.type;
    }
    if (item.submenu) {
      electronItem.submenu = toElectronMenuItems(item.submenu);
    }

    // Wire up click handlers for custom actions
    if (item.label === 'New Project') {
      electronItem.click = () => {
        mainWindow?.webContents.send(IPC_CHANNELS.MENU_NEW_PROJECT);
      };
    } else if (item.label === 'Open Project\u2026') {
      electronItem.click = () => {
        mainWindow?.webContents.send(IPC_CHANNELS.MENU_OPEN_PROJECT);
      };
    } else if (item.label === 'Save') {
      electronItem.click = () => {
        mainWindow?.webContents.send(IPC_CHANNELS.MENU_SAVE);
      };
    } else if (item.label === 'About ProtoPulse') {
      electronItem.click = () => {
        void dialog.showMessageBox({
          type: 'info',
          title: 'About ProtoPulse',
          message: 'ProtoPulse',
          detail: `Version ${app.getVersion()}\nAI-assisted EDA platform for makers, hobbyists, and embedded engineers.`,
        });
      };
    } else if (item.label === 'Learn More') {
      electronItem.click = () => {
        void shell.openExternal('https://github.com/protopulse');
      };
    }

    return electronItem;
  });
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.DIALOG_SHOW_SAVE, async (_event, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) {
      return { canceled: true, filePath: undefined };
    }
    return dialog.showSaveDialog(mainWindow, options);
  });

  ipcMain.handle(IPC_CHANNELS.DIALOG_SHOW_OPEN, async (_event, options: Electron.OpenDialogOptions) => {
    if (!mainWindow) {
      return { canceled: true, filePaths: [] };
    }
    return dialog.showOpenDialog(mainWindow, options);
  });

  ipcMain.handle(IPC_CHANNELS.FS_READ_FILE, async (_event, filePath: string) => {
    return fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle(IPC_CHANNELS.FS_WRITE_FILE, async (_event, filePath: string, data: string) => {
    await fs.writeFile(filePath, data, 'utf-8');
  });

  ipcMain.handle(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(IPC_CHANNELS.PROCESS_SPAWN, (_event, command: string, args: string[]) => {
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

  ipcMain.handle(IPC_CHANNELS.APP_GET_VERSION, () => {
    return app.getVersion();
  });

  ipcMain.handle(IPC_CHANNELS.APP_GET_PLATFORM, () => {
    return process.platform;
  });
}

// ── App lifecycle ────────────────────────────────────────────────────────────

app.on('ready', () => {
  serverProcess = startExpressServer();
  registerIpcHandlers();

  const menuConfig = buildMenuTemplateConfig();
  const menu = Menu.buildFromTemplate(toElectronMenuItems(menuConfig));
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
