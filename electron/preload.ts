import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS, PRELOAD_IPC_ON_CHANNELS } from './config';

/**
 * Preload script — runs in an isolated context with access to Node.js and
 * Electron APIs. Uses contextBridge to expose a safe, typed API surface
 * to the renderer process.
 */

export interface ElectronAPI {
  platform: NodeJS.Platform;
  openExternal: (url: string) => Promise<void>;
  showSaveDialog: (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
  }) => Promise<{ canceled: boolean; filePath?: string }>;
  showOpenDialog: (options: {
    title?: string;
    defaultPath?: string;
    filters?: Array<{ name: string; extensions: string[] }>;
    properties?: Array<'openFile' | 'openDirectory' | 'multiSelections'>;
  }) => Promise<{ canceled: boolean; filePaths: string[] }>;
  readFile: (filePath: string) => Promise<string>;
  writeFile: (filePath: string, data: string) => Promise<void>;
  spawnProcess: (command: string, args: string[]) => Promise<{
    stdout: string;
    stderr: string;
    exitCode: number | null;
  }>;
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<string>;
  onMenuAction: (callback: (action: string) => void) => () => void;
}

const electronAPI: ElectronAPI = {
  platform: process.platform,

  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),

  showSaveDialog: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SHOW_SAVE, options),

  showOpenDialog: (options) => ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SHOW_OPEN, options),

  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_READ_FILE, filePath),

  writeFile: (filePath: string, data: string) => ipcRenderer.invoke(IPC_CHANNELS.FS_WRITE_FILE, filePath, data),

  spawnProcess: (command: string, args: string[]) => ipcRenderer.invoke(IPC_CHANNELS.PROCESS_SPAWN, command, args),

  getVersion: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_VERSION),

  getPlatform: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_PLATFORM),

  onMenuAction: (callback: (action: string) => void) => {
    const channels = [...PRELOAD_IPC_ON_CHANNELS];
    const listeners = channels.map((channel) => {
      const listener = () => {
        callback(channel);
      };
      ipcRenderer.on(channel, listener);
      return { channel, listener };
    });

    // Return unsubscribe function
    return () => {
      for (const { channel, listener } of listeners) {
        ipcRenderer.removeListener(channel, listener);
      }
    };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);
