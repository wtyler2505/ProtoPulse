import { contextBridge, ipcRenderer } from 'electron';

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

  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

  showSaveDialog: (options) => ipcRenderer.invoke('dialog:showSave', options),

  showOpenDialog: (options) => ipcRenderer.invoke('dialog:showOpen', options),

  readFile: (filePath: string) => ipcRenderer.invoke('fs:readFile', filePath),

  writeFile: (filePath: string, data: string) => ipcRenderer.invoke('fs:writeFile', filePath, data),

  spawnProcess: (command: string, args: string[]) => ipcRenderer.invoke('process:spawn', command, args),

  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),

  onMenuAction: (callback: (action: string) => void) => {
    const channels = ['menu:new-project', 'menu:open-project', 'menu:save'];
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

// ── Exported constants for testing ───────────────────────────────────────────

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
