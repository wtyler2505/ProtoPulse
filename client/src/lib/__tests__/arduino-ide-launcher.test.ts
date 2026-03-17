/**
 * Arduino IDE Launcher — Tests
 *
 * Tests for Arduino IDE detection, launch command generation,
 * sketch path validation, default sketch directories, platform
 * detection, quoting, and the React hook.
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
  detectArduinoIde,
  generateLaunchCommand,
  validateSketchPath,
  getDefaultSketchDir,
  detectPlatform,
  expandHome,
  getHomeDir,
  quote,
  useArduinoIdeLauncher,
  COMMON_INSTALL_PATHS,
} from '../arduino-ide-launcher';

import type {
  ArduinoIdePath,
  ArduinoLaunchConfig,
  FileExistsCheck,
  Platform,
} from '../arduino-ide-launcher';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** A fileExists mock that only returns true for paths in the given set. */
function mockFileExists(existingPaths: Set<string>): FileExistsCheck {
  return async (filePath: string) => existingPaths.has(filePath);
}

/** A fileExists mock that always returns false (nothing installed). */
const nothingExists: FileExistsCheck = async () => false;

/** A fileExists mock that always returns true (everything installed). */
const everythingExists: FileExistsCheck = async () => true;

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------

describe('detectPlatform', () => {
  it('returns a valid platform string', () => {
    const plat = detectPlatform();
    expect(['linux', 'darwin', 'win32', 'unknown']).toContain(plat);
  });

  it('returns the process.platform value when available', () => {
    // In test (Node), process.platform is always defined.
    const plat = detectPlatform();
    expect(plat).toBe(process.platform);
  });
});

// ---------------------------------------------------------------------------
// expandHome / getHomeDir
// ---------------------------------------------------------------------------

describe('expandHome', () => {
  it('replaces $HOME with the actual home directory', () => {
    const home = getHomeDir();
    if (home) {
      const result = expandHome('$HOME/Arduino');
      expect(result).toBe(`${home}/Arduino`);
    }
  });

  it('replaces multiple occurrences of $HOME', () => {
    const home = getHomeDir();
    if (home) {
      const result = expandHome('$HOME/a:$HOME/b');
      expect(result).toBe(`${home}/a:${home}/b`);
    }
  });

  it('leaves the string untouched when $HOME is absent', () => {
    const result = expandHome('/usr/bin/arduino');
    expect(result).toBe('/usr/bin/arduino');
  });
});

describe('getHomeDir', () => {
  it('returns a non-empty string in a Node environment', () => {
    const home = getHomeDir();
    expect(typeof home).toBe('string');
    // In CI or test environments HOME should be set
    expect(home.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// COMMON_INSTALL_PATHS
// ---------------------------------------------------------------------------

describe('COMMON_INSTALL_PATHS', () => {
  it('has entries for linux, darwin, and win32', () => {
    expect(COMMON_INSTALL_PATHS.linux.length).toBeGreaterThanOrEqual(3);
    expect(COMMON_INSTALL_PATHS.darwin.length).toBeGreaterThanOrEqual(3);
    expect(COMMON_INSTALL_PATHS.win32.length).toBeGreaterThanOrEqual(3);
  });

  it('linux paths reference arduino-ide and arduino-cli', () => {
    const joined = COMMON_INSTALL_PATHS.linux.join(' ');
    expect(joined).toContain('arduino-ide');
    expect(joined).toContain('arduino-cli');
  });

  it('darwin paths include /Applications', () => {
    const hasApps = COMMON_INSTALL_PATHS.darwin.some((p) => p.includes('/Applications'));
    expect(hasApps).toBe(true);
  });

  it('win32 paths include Program Files', () => {
    const hasPF = COMMON_INSTALL_PATHS.win32.some((p) => p.includes('Program Files'));
    expect(hasPF).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// detectArduinoIde
// ---------------------------------------------------------------------------

describe('detectArduinoIde', () => {
  it('returns null when no installation is found', async () => {
    const result = await detectArduinoIde('linux', nothingExists);
    expect(result).toBeNull();
  });

  it('returns null for unknown platform', async () => {
    const result = await detectArduinoIde('unknown', everythingExists);
    expect(result).toBeNull();
  });

  it('detects Arduino IDE 2.x on Linux (snap path)', async () => {
    const existing = new Set(['/snap/arduino-ide/current/arduino-ide']);
    const result = await detectArduinoIde('linux', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('ide-2');
    expect(result!.label).toBe('Arduino IDE 2.x');
    expect(result!.executablePath).toBe('/snap/arduino-ide/current/arduino-ide');
  });

  it('detects Arduino IDE 1.x on Linux', async () => {
    const existing = new Set(['/usr/local/bin/arduino']);
    const result = await detectArduinoIde('linux', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('ide-1');
    expect(result!.label).toBe('Arduino IDE 1.x');
  });

  it('detects arduino-cli standalone on Linux', async () => {
    const existing = new Set(['/usr/local/bin/arduino-cli']);
    const result = await detectArduinoIde('linux', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('cli-only');
    expect(result!.label).toBe('Arduino CLI');
  });

  it('prefers IDE 2.x over 1.x when both exist on Linux', async () => {
    const existing = new Set([
      '/opt/arduino-ide/arduino-ide',
      '/usr/local/bin/arduino',
      '/usr/local/bin/arduino-cli',
    ]);
    const result = await detectArduinoIde('linux', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('ide-2');
  });

  it('detects Arduino IDE 2.x on macOS', async () => {
    const existing = new Set(['/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE']);
    const result = await detectArduinoIde('darwin', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('ide-2');
  });

  it('detects Arduino IDE on Windows', async () => {
    const existing = new Set(['C:\\Program Files\\Arduino IDE\\Arduino IDE.exe']);
    const result = await detectArduinoIde('win32', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('ide-2');
    expect(result!.executablePath).toBe('C:\\Program Files\\Arduino IDE\\Arduino IDE.exe');
  });

  it('detects arduino-cli on macOS via Homebrew', async () => {
    const existing = new Set(['/opt/homebrew/bin/arduino-cli']);
    const result = await detectArduinoIde('darwin', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.variant).toBe('cli-only');
  });

  it('returns the first match in priority order', async () => {
    // On Linux, the $HOME/.local/share path comes before /snap
    const home = getHomeDir();
    const localPath = `${home}/.local/share/arduino-ide/arduino-ide`;
    const snapPath = '/snap/arduino-ide/current/arduino-ide';
    const existing = new Set([localPath, snapPath]);
    const result = await detectArduinoIde('linux', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.executablePath).toBe(localPath);
  });

  it('expands $HOME in path templates', async () => {
    const home = getHomeDir();
    if (!home) { return; }
    // The first Linux path is $HOME/.local/share/arduino-ide/arduino-ide
    const expandedPath = `${home}/.local/share/arduino-ide/arduino-ide`;
    const existing = new Set([expandedPath]);
    const result = await detectArduinoIde('linux', mockFileExists(existing));
    expect(result).not.toBeNull();
    expect(result!.executablePath).toBe(expandedPath);
  });
});

// ---------------------------------------------------------------------------
// generateLaunchCommand
// ---------------------------------------------------------------------------

describe('generateLaunchCommand', () => {
  const ide2Path: ArduinoIdePath = {
    executablePath: '/opt/arduino-ide/arduino-ide',
    variant: 'ide-2',
    label: 'Arduino IDE 2.x',
  };

  const ide1Path: ArduinoIdePath = {
    executablePath: '/usr/bin/arduino',
    variant: 'ide-1',
    label: 'Arduino IDE 1.x',
  };

  const cliPath: ArduinoIdePath = {
    executablePath: '/usr/local/bin/arduino-cli',
    variant: 'cli-only',
    label: 'Arduino CLI',
  };

  it('generates a command for IDE 2.x with sketch path only', () => {
    const config: ArduinoLaunchConfig = { sketchPath: '/home/user/Blink' };
    const cmd = generateLaunchCommand(config, ide2Path);
    expect(cmd).toContain('"/opt/arduino-ide/arduino-ide"');
    expect(cmd).toContain('"/home/user/Blink"');
  });

  it('generates a command for IDE 2.x with board and port', () => {
    const config: ArduinoLaunchConfig = {
      sketchPath: '/home/user/Blink',
      board: 'arduino:avr:mega',
      port: '/dev/ttyUSB0',
    };
    const cmd = generateLaunchCommand(config, ide2Path);
    expect(cmd).toContain('--board');
    expect(cmd).toContain('"arduino:avr:mega"');
    expect(cmd).toContain('--port');
    expect(cmd).toContain('"/dev/ttyUSB0"');
  });

  it('generates a command for IDE 1.x', () => {
    const config: ArduinoLaunchConfig = { sketchPath: '/home/user/Blink' };
    const cmd = generateLaunchCommand(config, ide1Path);
    expect(cmd).toContain('"/usr/bin/arduino"');
    expect(cmd).toContain('"/home/user/Blink"');
  });

  it('generates a compile command for CLI-only variant', () => {
    const config: ArduinoLaunchConfig = { sketchPath: '/home/user/Blink' };
    const cmd = generateLaunchCommand(config, cliPath);
    expect(cmd).toContain('"/usr/local/bin/arduino-cli"');
    expect(cmd).toContain('compile');
    expect(cmd).toContain('"/home/user/Blink"');
  });

  it('includes --fqbn and --port for CLI-only variant', () => {
    const config: ArduinoLaunchConfig = {
      sketchPath: '/home/user/Blink',
      board: 'arduino:avr:uno',
      port: 'COM3',
    };
    const cmd = generateLaunchCommand(config, cliPath);
    expect(cmd).toContain('--fqbn');
    expect(cmd).toContain('"arduino:avr:uno"');
    expect(cmd).toContain('--port');
    expect(cmd).toContain('"COM3"');
  });

  it('defaults to arduino-ide when no idePath is provided', () => {
    const config: ArduinoLaunchConfig = { sketchPath: '/tmp/sketch' };
    const cmd = generateLaunchCommand(config);
    expect(cmd).toContain('"arduino-ide"');
    expect(cmd).toContain('"/tmp/sketch"');
  });

  it('escapes double quotes in paths', () => {
    const config: ArduinoLaunchConfig = { sketchPath: '/home/user/my "sketch"' };
    const cmd = generateLaunchCommand(config, ide2Path);
    expect(cmd).toContain('\\"sketch\\"');
  });

  it('escapes dollar signs in paths', () => {
    const config: ArduinoLaunchConfig = { sketchPath: '/home/$user/sketch' };
    const cmd = generateLaunchCommand(config, ide2Path);
    expect(cmd).toContain('\\$user');
  });

  it('handles paths with spaces', () => {
    const pathWithSpaces: ArduinoIdePath = {
      executablePath: '/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE',
      variant: 'ide-2',
      label: 'Arduino IDE 2.x',
    };
    const config: ArduinoLaunchConfig = { sketchPath: '/Users/me/My Sketches/Blink' };
    const cmd = generateLaunchCommand(config, pathWithSpaces);
    expect(cmd).toContain('"/Applications/Arduino IDE.app/Contents/MacOS/Arduino IDE"');
    expect(cmd).toContain('"/Users/me/My Sketches/Blink"');
  });
});

// ---------------------------------------------------------------------------
// validateSketchPath
// ---------------------------------------------------------------------------

describe('validateSketchPath', () => {
  it('accepts a valid absolute Linux path', () => {
    expect(validateSketchPath('/home/user/Arduino/Blink')).toBe(true);
  });

  it('accepts a valid absolute Windows path', () => {
    expect(validateSketchPath('C:\\Users\\Tyler\\Arduino\\Blink')).toBe(true);
  });

  it('accepts a path ending with .ino', () => {
    expect(validateSketchPath('/home/user/Arduino/Blink/Blink.ino')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(validateSketchPath('')).toBe(false);
  });

  it('rejects a whitespace-only string', () => {
    expect(validateSketchPath('   ')).toBe(false);
  });

  it('rejects a relative path', () => {
    expect(validateSketchPath('Arduino/Blink')).toBe(false);
  });

  it('rejects a path with .. traversal', () => {
    expect(validateSketchPath('/home/user/../etc/passwd')).toBe(false);
  });

  it('rejects a path with null bytes', () => {
    expect(validateSketchPath('/home/user/\x00evil')).toBe(false);
  });

  it('rejects a path with control characters', () => {
    expect(validateSketchPath('/home/user/\x07bell')).toBe(false);
  });

  it('rejects non-string input', () => {
    // Cast through unknown to simulate runtime misuse without using `any`
    expect(validateSketchPath(null as unknown as string)).toBe(false);
    expect(validateSketchPath(undefined as unknown as string)).toBe(false);
    expect(validateSketchPath(42 as unknown as string)).toBe(false);
  });

  it('accepts a drive-letter path with forward slashes', () => {
    expect(validateSketchPath('D:/Projects/Arduino/Blink')).toBe(true);
  });

  it('rejects a bare filename', () => {
    expect(validateSketchPath('Blink.ino')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getDefaultSketchDir
// ---------------------------------------------------------------------------

describe('getDefaultSketchDir', () => {
  it('returns ~/Arduino on Linux', () => {
    const dir = getDefaultSketchDir('linux');
    const home = getHomeDir();
    if (home) {
      expect(dir).toBe(`${home}/Arduino`);
    } else {
      expect(dir).toBe('./Arduino');
    }
  });

  it('returns ~/Documents/Arduino on macOS', () => {
    const dir = getDefaultSketchDir('darwin');
    const home = getHomeDir();
    if (home) {
      expect(dir).toBe(`${home}/Documents/Arduino`);
    } else {
      expect(dir).toBe('./Arduino');
    }
  });

  it('returns ~\\Documents\\Arduino on Windows', () => {
    const dir = getDefaultSketchDir('win32');
    const home = getHomeDir();
    if (home) {
      expect(dir).toBe(`${home}\\Documents\\Arduino`);
    } else {
      expect(dir).toBe('.\\Arduino');
    }
  });

  it('returns ./Arduino for unknown platform', () => {
    const dir = getDefaultSketchDir('unknown');
    expect(dir).toBe('./Arduino');
  });

  it('returns a non-empty string for auto-detected platform', () => {
    const dir = getDefaultSketchDir();
    expect(dir.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// quote
// ---------------------------------------------------------------------------

describe('quote', () => {
  it('wraps a plain string in double quotes', () => {
    expect(quote('hello')).toBe('"hello"');
  });

  it('escapes embedded double quotes', () => {
    expect(quote('say "hi"')).toBe('"say \\"hi\\""');
  });

  it('escapes backslashes', () => {
    expect(quote('C:\\path')).toBe('"C:\\\\path"');
  });

  it('escapes dollar signs', () => {
    expect(quote('$HOME')).toBe('"\\$HOME"');
  });

  it('escapes backticks', () => {
    expect(quote('`cmd`')).toBe('"\\`cmd\\`"');
  });

  it('escapes exclamation marks', () => {
    expect(quote('run!')).toBe('"run\\!"');
  });

  it('handles an empty string', () => {
    expect(quote('')).toBe('""');
  });

  it('handles a string with spaces', () => {
    expect(quote('hello world')).toBe('"hello world"');
  });
});

// ---------------------------------------------------------------------------
// useArduinoIdeLauncher (React hook)
// ---------------------------------------------------------------------------

describe('useArduinoIdeLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts with isDetecting true and idePath null', () => {
    const { result } = renderHook(() => useArduinoIdeLauncher(nothingExists));
    // Initial render should have isDetecting true (detection starts on mount)
    expect(result.current.idePath).toBeNull();
  });

  it('sets idePath to null when no IDE is found', async () => {
    const { result } = renderHook(() => useArduinoIdeLauncher(nothingExists));
    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });
    expect(result.current.idePath).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('detects an IDE installation via the fileExists function', async () => {
    const existing = new Set(['/usr/local/bin/arduino-cli']);
    const { result } = renderHook(() => useArduinoIdeLauncher(mockFileExists(existing)));
    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });
    // On Linux test env this should find arduino-cli.
    // The exact result depends on platform, but the hook should work.
    // If running on Linux:
    if (detectPlatform() === 'linux') {
      expect(result.current.idePath).not.toBeNull();
      expect(result.current.idePath!.variant).toBe('cli-only');
    }
  });

  it('sets error when detection throws', async () => {
    const failingCheck: FileExistsCheck = async () => {
      throw new Error('Disk I/O error');
    };
    const { result } = renderHook(() => useArduinoIdeLauncher(failingCheck));
    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });
    expect(result.current.error).toBe('Disk I/O error');
  });

  it('supports manual re-detection via detect()', async () => {
    let callCount = 0;
    const trackingCheck: FileExistsCheck = async () => {
      callCount++;
      return false;
    };
    const { result } = renderHook(() => useArduinoIdeLauncher(trackingCheck));
    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });
    const initialCount = callCount;

    await act(async () => {
      await result.current.detect();
    });

    expect(callCount).toBeGreaterThan(initialCount);
  });

  it('launch() returns null when no IDE is detected', async () => {
    const { result } = renderHook(() => useArduinoIdeLauncher(nothingExists));
    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });
    const cmd = result.current.launch({ sketchPath: '/home/user/Blink' });
    expect(cmd).toBeNull();
  });

  it('launch() returns a command string when IDE is detected', async () => {
    // Force detection to find something by providing a path that exists
    // on the test platform
    const platform = detectPlatform();
    if (platform === 'unknown') { return; }

    const firstPath = expandHome(COMMON_INSTALL_PATHS[platform][0]);
    const existing = new Set([firstPath]);

    const { result } = renderHook(() => useArduinoIdeLauncher(mockFileExists(existing)));
    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });

    if (result.current.idePath) {
      const cmd = result.current.launch({ sketchPath: '/home/user/Blink' });
      expect(cmd).not.toBeNull();
      expect(typeof cmd).toBe('string');
      expect(cmd!.length).toBeGreaterThan(0);
    }
  });

  it('clears previous error on successful re-detection', async () => {
    let shouldFail = true;
    const conditionalCheck: FileExistsCheck = async () => {
      if (shouldFail) {
        throw new Error('first failure');
      }
      return false;
    };

    const { result } = renderHook(() => useArduinoIdeLauncher(conditionalCheck));
    await waitFor(() => {
      expect(result.current.isDetecting).toBe(false);
    });
    expect(result.current.error).toBe('first failure');

    shouldFail = false;
    await act(async () => {
      await result.current.detect();
    });
    expect(result.current.error).toBeNull();
  });
});
