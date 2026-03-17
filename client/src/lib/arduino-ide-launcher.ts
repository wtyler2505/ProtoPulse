/**
 * Arduino IDE Launcher — Desktop Integration
 *
 * Provides utilities for detecting Arduino IDE installations,
 * generating launch commands, validating sketch paths, and
 * determining default sketch directories on the local filesystem.
 *
 * Designed for the native desktop context (Electron / Tauri) where
 * ProtoPulse has full filesystem and process access.
 *
 * Usage:
 *   const path = await detectArduinoIde();
 *   if (path) {
 *     const cmd = generateLaunchCommand({ sketchPath: '/home/user/my-sketch' });
 *     // spawn or exec the command
 *   }
 *
 * React hook:
 *   const { idePath, isDetecting, error, detect, launch } = useArduinoIdeLauncher();
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Describes a located Arduino IDE installation. */
export interface ArduinoIdePath {
  /** Absolute path to the Arduino IDE executable. */
  executablePath: string;
  /** Which flavour of Arduino IDE was detected. */
  variant: 'ide-2' | 'ide-1' | 'cli-only';
  /** Human-readable label for display. */
  label: string;
}

/** Configuration for launching the Arduino IDE with a sketch. */
export interface ArduinoLaunchConfig {
  /** Absolute path to the sketch directory (must contain a .ino file). */
  sketchPath: string;
  /**
   * Fully Qualified Board Name — e.g. `arduino:avr:mega`.
   * When omitted, Arduino IDE uses its last-selected board.
   */
  board?: string;
  /**
   * Serial port path — e.g. `/dev/ttyUSB0` or `COM3`.
   * When omitted, Arduino IDE uses its last-selected port.
   */
  port?: string;
}

/** Snapshot state returned by the React hook. */
export interface ArduinoIdeLauncherState {
  /** The detected IDE path, or null if not yet detected / not found. */
  idePath: ArduinoIdePath | null;
  /** True while detection is in progress. */
  isDetecting: boolean;
  /** Human-readable error string, or null if no error. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// Platform detection helpers
// ---------------------------------------------------------------------------

export type Platform = 'linux' | 'darwin' | 'win32' | 'unknown';

/**
 * Determine the current OS platform.
 *
 * In a Node/Electron context this delegates to `process.platform`.
 * Falls back to `navigator.userAgent` heuristics when `process` is
 * unavailable (e.g. pure browser context during tests).
 */
export function detectPlatform(): Platform {
  // Node / Electron
  if (typeof process !== 'undefined' && typeof process.platform === 'string') {
    const p = process.platform;
    if (p === 'linux' || p === 'darwin' || p === 'win32') {
      return p;
    }
    return 'unknown';
  }
  // Browser fallback (best effort)
  if (typeof navigator !== 'undefined') {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) { return 'win32'; }
    if (ua.includes('mac')) { return 'darwin'; }
    if (ua.includes('linux')) { return 'linux'; }
  }
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Common install paths per platform
// ---------------------------------------------------------------------------

/**
 * Well-known Arduino IDE install locations.
 *
 * Each entry is a filesystem path that may contain the Arduino IDE
 * executable.  `detectArduinoIde()` iterates them in order and
 * returns the first path where a readable file exists.
 *
 * `$HOME` is a placeholder that gets replaced with the actual home
 * directory at runtime.
 */
export const COMMON_INSTALL_PATHS: Readonly<Record<Exclude<Platform, 'unknown'>, readonly string[]>> = {
  linux: [
    // Snap / Flatpak / AppImage — Arduino IDE 2.x
    '$HOME/.local/share/arduino-ide/arduino-ide',
    '/snap/arduino-ide/current/arduino-ide',
    '/opt/arduino-ide/arduino-ide',
    '/usr/local/bin/arduino-ide',
    '/usr/bin/arduino-ide',
    // Arduino IDE 1.x
    '/usr/local/bin/arduino',
    '/usr/bin/arduino',
    '$HOME/arduino-1.8.19/arduino',
    // arduino-cli standalone
    '$HOME/.local/bin/arduino-cli',
    '/usr/local/bin/arduino-cli',
    '/usr/bin/arduino-cli',
  ],
  darwin: [
    '/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE',
    '/Applications/Arduino.app/Contents/MacOS/Arduino',
    '$HOME/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE',
    '$HOME/Applications/Arduino.app/Contents/MacOS/Arduino',
    // Homebrew CLI
    '/opt/homebrew/bin/arduino-cli',
    '/usr/local/bin/arduino-cli',
  ],
  win32: [
    'C:\\Program Files\\Arduino IDE\\Arduino IDE.exe',
    'C:\\Program Files (x86)\\Arduino IDE\\Arduino IDE.exe',
    'C:\\Program Files\\Arduino\\arduino.exe',
    'C:\\Program Files (x86)\\Arduino\\arduino.exe',
    '$HOME\\AppData\\Local\\Programs\\Arduino IDE\\Arduino IDE.exe',
    '$HOME\\AppData\\Local\\Arduino15\\arduino-cli.exe',
  ],
} as const;

// ---------------------------------------------------------------------------
// Home directory helper
// ---------------------------------------------------------------------------

/**
 * Best-effort home directory resolution.
 *
 * Tries `process.env.HOME` (Linux/macOS), `process.env.USERPROFILE`
 * (Windows), or returns an empty string when neither is available.
 */
export function getHomeDir(): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env.HOME ?? process.env.USERPROFILE ?? '';
  }
  return '';
}

/**
 * Replace `$HOME` in a path template with the actual home directory.
 */
export function expandHome(pathTemplate: string): string {
  const home = getHomeDir();
  if (!home) { return pathTemplate; }
  return pathTemplate.replace(/\$HOME/g, home);
}

// ---------------------------------------------------------------------------
// File-existence abstraction (injectable for testing)
// ---------------------------------------------------------------------------

/**
 * Check whether a path exists and is accessible.
 *
 * Default implementation uses the Node.js `fs` module.  Tests can
 * replace this by passing a custom function to `detectArduinoIde`.
 */
export type FileExistsCheck = (filePath: string) => Promise<boolean>;

const defaultFileExists: FileExistsCheck = async (filePath: string): Promise<boolean> => {
  try {
    // Dynamic import keeps the module tree-shakeable in non-Node contexts.
    const fs = await import('fs/promises');
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// Variant classifier
// ---------------------------------------------------------------------------

function classifyVariant(execPath: string): ArduinoIdePath['variant'] {
  const lower = execPath.toLowerCase();
  if (lower.includes('arduino-cli')) { return 'cli-only'; }
  if (lower.includes('arduino-ide') || lower.includes('arduino ide')) { return 'ide-2'; }
  return 'ide-1';
}

function labelForVariant(variant: ArduinoIdePath['variant']): string {
  switch (variant) {
    case 'ide-2': return 'Arduino IDE 2.x';
    case 'ide-1': return 'Arduino IDE 1.x';
    case 'cli-only': return 'Arduino CLI';
  }
}

// ---------------------------------------------------------------------------
// Core API
// ---------------------------------------------------------------------------

/**
 * Detect the Arduino IDE installation by scanning well-known paths.
 *
 * Returns the first match, preferring IDE 2.x over 1.x over CLI.
 * Returns `null` when no installation is found.
 *
 * @param platform  Override the auto-detected platform (useful for tests).
 * @param fileExists  Override the filesystem check (useful for tests).
 */
export async function detectArduinoIde(
  platform?: Platform,
  fileExists: FileExistsCheck = defaultFileExists,
): Promise<ArduinoIdePath | null> {
  const plat = platform ?? detectPlatform();
  if (plat === 'unknown') { return null; }

  const candidates = COMMON_INSTALL_PATHS[plat];

  for (const rawPath of candidates) {
    const expanded = expandHome(rawPath);
    if (await fileExists(expanded)) {
      const variant = classifyVariant(expanded);
      return {
        executablePath: expanded,
        variant,
        label: labelForVariant(variant),
      };
    }
  }

  return null;
}

/**
 * Generate a shell command to launch the Arduino IDE with a sketch.
 *
 * The returned string is suitable for `child_process.exec` or
 * Tauri's `Command` API.  Arguments are always quoted to handle
 * paths with spaces.
 */
export function generateLaunchCommand(config: ArduinoLaunchConfig, idePath?: ArduinoIdePath): string {
  const executable = idePath?.executablePath ?? 'arduino-ide';
  const args: string[] = [];

  // For IDE 2.x or IDE 1.x, the sketch path is a positional argument.
  // For the CLI, we open it in a way that makes sense (monitor or compile).
  if (idePath?.variant === 'cli-only') {
    args.push('compile');
    if (config.board) {
      args.push('--fqbn', quote(config.board));
    }
    if (config.port) {
      args.push('--port', quote(config.port));
    }
    args.push(quote(config.sketchPath));
  } else {
    // Arduino IDE 1.x/2.x: pass sketch path as positional arg
    args.push(quote(config.sketchPath));
    if (config.board) {
      args.push('--board', quote(config.board));
    }
    if (config.port) {
      args.push('--port', quote(config.port));
    }
  }

  return `${quote(executable)} ${args.join(' ')}`;
}

/**
 * Validate that a sketch path looks structurally correct.
 *
 * A valid sketch path:
 * 1. Is a non-empty string.
 * 2. Does not contain path traversal sequences (`..`).
 * 3. Ends with a `/` (directory) or contains a `.ino` filename.
 * 4. Contains only printable characters (no null bytes).
 *
 * This is a *structural* check, not a filesystem check.
 */
export function validateSketchPath(path: string): boolean {
  if (!path || typeof path !== 'string') { return false; }

  // No null bytes or non-printable control chars
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(path)) { return false; }

  // No path traversal
  if (path.includes('..')) { return false; }

  // Must reference a .ino file or a directory that presumably contains one
  const trimmed = path.trim();
  if (trimmed.length === 0) { return false; }

  // Absolute path required
  const isAbsolute = trimmed.startsWith('/') || /^[A-Za-z]:[/\\]/.test(trimmed);
  if (!isAbsolute) { return false; }

  return true;
}

/**
 * Return the default Arduino sketch directory for the current platform.
 *
 * - Linux / macOS: `$HOME/Arduino`
 * - Windows: `$HOME\Documents\Arduino`
 * - Unknown: `./Arduino`
 */
export function getDefaultSketchDir(platform?: Platform): string {
  const plat = platform ?? detectPlatform();
  const home = getHomeDir();

  switch (plat) {
    case 'linux':
      return home ? `${home}/Arduino` : './Arduino';
    case 'darwin':
      return home ? `${home}/Documents/Arduino` : './Arduino';
    case 'win32':
      return home ? `${home}\\Documents\\Arduino` : '.\\Arduino';
    default:
      return './Arduino';
  }
}

// ---------------------------------------------------------------------------
// Shell quoting helper
// ---------------------------------------------------------------------------

/**
 * Quote a string for safe shell usage.
 *
 * Uses double quotes and escapes any embedded double quotes,
 * backslashes, backticks, dollar signs, and exclamation marks.
 */
export function quote(value: string): string {
  // Replace characters that are special inside double quotes
  const escaped = value.replace(/([\\"`$!])/g, '\\$1');
  return `"${escaped}"`;
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * React hook for Arduino IDE detection and launch command generation.
 *
 * Runs detection on mount (once) and exposes `detect()` for manual
 * re-detection. `launch()` generates a command string for the given
 * sketch configuration.
 */
export function useArduinoIdeLauncher(fileExists?: FileExistsCheck): {
  idePath: ArduinoIdePath | null;
  isDetecting: boolean;
  error: string | null;
  detect: () => Promise<void>;
  launch: (config: ArduinoLaunchConfig) => string | null;
} {
  const [state, setState] = useState<ArduinoIdeLauncherState>({
    idePath: null,
    isDetecting: false,
    error: null,
  });

  // Keep a ref to the fileExists function so the callbacks don't
  // trigger re-detection when the reference changes.
  const fileExistsRef = useRef(fileExists);
  fileExistsRef.current = fileExists;

  const detect = useCallback(async () => {
    setState((prev) => ({ ...prev, isDetecting: true, error: null }));
    try {
      const result = await detectArduinoIde(undefined, fileExistsRef.current);
      setState({ idePath: result, isDetecting: false, error: null });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Detection failed';
      setState((prev) => ({ ...prev, isDetecting: false, error: message }));
    }
  }, []);

  const launch = useCallback(
    (config: ArduinoLaunchConfig): string | null => {
      if (!state.idePath) { return null; }
      return generateLaunchCommand(config, state.idePath);
    },
    [state.idePath],
  );

  // Auto-detect on mount
  useEffect(() => {
    void detect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    idePath: state.idePath,
    isDetecting: state.isDetecting,
    error: state.error,
    detect,
    launch,
  };
}
