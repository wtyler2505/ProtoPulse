import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FilesystemUploadManager,
  validateFilename,
  validatePath,
  validateFiles,
  splitPath,
  getPathDepth,
  formatBytes,
  estimateFlashTime,
  getRecommendation,
  getDefaultPartition,
  getFsTypesForBoard,
  generateImageCommand,
  generateFlashCommand,
  PARTITION_PRESETS,
  MAX_FILE_SIZE,
  MAX_FILENAME_LENGTH,
  MAX_PATH_LENGTH,
  MAX_NESTING_DEPTH,
  MAX_FILE_COUNT,
} from '../filesystem-upload';
import type {
  FsFileEntry,
  PartitionConfig,
  FsImageConfig,
} from '../filesystem-upload';

// ---------------------------------------------------------------------------
// Mock localStorage
// ---------------------------------------------------------------------------

const storage = new Map<string, string>();
const localStorageMock = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
  removeItem: vi.fn((key: string) => { storage.delete(key); }),
  clear: vi.fn(() => { storage.clear(); }),
  get length() { return storage.size; },
  key: vi.fn(() => null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

beforeEach(() => {
  storage.clear();
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// splitPath / getPathDepth
// ---------------------------------------------------------------------------

describe('splitPath', () => {
  it('splits a simple filename', () => {
    expect(splitPath('config.json')).toEqual(['config.json']);
  });

  it('splits a nested path', () => {
    expect(splitPath('data/web/config.json')).toEqual(['data', 'web', 'config.json']);
  });

  it('handles leading/trailing slashes', () => {
    expect(splitPath('/data/config.json/')).toEqual(['data', 'config.json']);
  });

  it('filters empty segments', () => {
    expect(splitPath('data//config.json')).toEqual(['data', 'config.json']);
  });

  it('returns empty array for empty string', () => {
    expect(splitPath('')).toEqual([]);
  });
});

describe('getPathDepth', () => {
  it('returns 0 for a root-level file', () => {
    expect(getPathDepth('config.json')).toBe(0);
  });

  it('returns 1 for a single-nested file', () => {
    expect(getPathDepth('data/config.json')).toBe(1);
  });

  it('returns 3 for deeply nested file', () => {
    expect(getPathDepth('a/b/c/file.txt')).toBe(3);
  });

  it('returns 0 for empty path', () => {
    expect(getPathDepth('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// validateFilename
// ---------------------------------------------------------------------------

describe('validateFilename', () => {
  it('returns no issues for a valid filename', () => {
    expect(validateFilename('config.json')).toEqual([]);
  });

  it('errors on empty filename', () => {
    const issues = validateFilename('');
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe('name');
    expect(issues[0].severity).toBe('error');
  });

  it('errors when filename exceeds max length', () => {
    const longName = 'a'.repeat(MAX_FILENAME_LENGTH + 1);
    const issues = validateFilename(longName);
    expect(issues.some((i) => i.category === 'name' && i.severity === 'error')).toBe(true);
  });

  it('accepts filename at exact max length', () => {
    const name = 'a'.repeat(MAX_FILENAME_LENGTH);
    const issues = validateFilename(name);
    expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('errors on invalid characters', () => {
    const issues = validateFilename('file<name>.txt');
    expect(issues.some((i) => i.category === 'character')).toBe(true);
  });

  it('errors on backslash in filename', () => {
    const issues = validateFilename('file\\name.txt');
    expect(issues.some((i) => i.category === 'character')).toBe(true);
  });

  it('errors on control characters', () => {
    const issues = validateFilename('file\x01.txt');
    expect(issues.some((i) => i.category === 'character')).toBe(true);
  });

  it('warns on dot-prefixed filenames', () => {
    const issues = validateFilename('.hidden');
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].category).toBe('name');
  });

  it('allows hyphens, underscores, and digits', () => {
    expect(validateFilename('my-file_2.json')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validatePath
// ---------------------------------------------------------------------------

describe('validatePath', () => {
  it('returns no issues for a valid path', () => {
    expect(validatePath('data/config.json')).toEqual([]);
  });

  it('errors on empty path', () => {
    const issues = validatePath('');
    expect(issues).toHaveLength(1);
    expect(issues[0].category).toBe('name');
  });

  it('errors when path exceeds max length', () => {
    const longPath = 'a/' + 'b'.repeat(MAX_PATH_LENGTH);
    const issues = validatePath(longPath);
    expect(issues.some((i) => i.category === 'name' && i.message.includes('exceeds maximum length'))).toBe(true);
  });

  it('errors on excessive nesting depth', () => {
    const segments = Array.from({ length: MAX_NESTING_DEPTH + 2 }, (_, i) => `d${i}`);
    const deepPath = segments.join('/');
    const issues = validatePath(deepPath);
    expect(issues.some((i) => i.category === 'depth')).toBe(true);
  });

  it('allows nesting at exactly max depth', () => {
    // MAX_NESTING_DEPTH dirs + 1 file = MAX_NESTING_DEPTH + 1 segments
    const segments = Array.from({ length: MAX_NESTING_DEPTH }, (_, i) => `d${i}`);
    segments.push('file.txt');
    const issues = validatePath(segments.join('/'));
    expect(issues.filter((i) => i.category === 'depth')).toHaveLength(0);
  });

  it('detects invalid characters in path segments', () => {
    const issues = validatePath('data/file<bad>.txt');
    expect(issues.some((i) => i.category === 'character')).toBe(true);
  });

  it('warns on hidden directories', () => {
    const issues = validatePath('.hidden/config.json');
    expect(issues.some((i) => i.severity === 'warning' && i.category === 'name')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateFiles
// ---------------------------------------------------------------------------

describe('validateFiles', () => {
  const partition: PartitionConfig = {
    label: 'littlefs',
    fsType: 'littlefs',
    size: 1441792,
    offset: 0x290000,
    blockSize: 4096,
    pageSize: 256,
  };

  it('passes for a valid file set', () => {
    const files: FsFileEntry[] = [
      { path: 'index.html', size: 1024 },
      { path: 'style.css', size: 512 },
    ];
    const result = validateFiles(files, partition);
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
    expect(result.totalSize).toBe(1536);
    expect(result.fileCount).toBe(2);
  });

  it('reports file exceeding max file size', () => {
    const files: FsFileEntry[] = [
      { path: 'big.bin', size: MAX_FILE_SIZE + 1 },
    ];
    const result = validateFiles(files, partition);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.category === 'size')).toBe(true);
  });

  it('reports negative file size', () => {
    const files: FsFileEntry[] = [
      { path: 'bad.bin', size: -100 },
    ];
    const result = validateFiles(files, partition);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.category === 'size')).toBe(true);
  });

  it('reports total size exceeding partition', () => {
    const files: FsFileEntry[] = Array.from({ length: 10 }, (_, i) => ({
      path: `file${i}.bin`,
      size: 200000,
    }));
    // 2,000,000 bytes > 1,441,792 * 0.98 ≈ 1,412,956
    const result = validateFiles(files, partition);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.category === 'total_size')).toBe(true);
  });

  it('uses 95% overhead for SPIFFS partitions', () => {
    const spiffsPartition: PartitionConfig = { ...partition, fsType: 'spiffs' };
    // Calculate boundary: 1441792 * 0.95 = 1369702.4 → 1369702
    const files: FsFileEntry[] = [
      { path: 'data.bin', size: 1369703 }, // Just over usable
    ];
    const result = validateFiles(files, spiffsPartition);
    expect(result.valid).toBe(false);
  });

  it('reports duplicate file paths (case-insensitive)', () => {
    const files: FsFileEntry[] = [
      { path: 'Config.json', size: 100 },
      { path: 'config.json', size: 100 },
    ];
    const result = validateFiles(files, partition);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.category === 'duplicate')).toBe(true);
  });

  it('reports when file count exceeds maximum', () => {
    const files: FsFileEntry[] = Array.from({ length: MAX_FILE_COUNT + 1 }, (_, i) => ({
      path: `f${i}.txt`,
      size: 1,
    }));
    const result = validateFiles(files, partition);
    expect(result.issues.some((i) => i.category === 'total_size' && i.message.includes('File count'))).toBe(true);
  });

  it('calculates available space correctly', () => {
    const files: FsFileEntry[] = [{ path: 'a.txt', size: 10 }];
    const result = validateFiles(files, partition);
    // LittleFS: 1441792 * 0.98 = 1412956.16 → 1412956
    expect(result.availableSpace).toBe(Math.floor(1441792 * 0.98));
  });

  it('allows empty file list', () => {
    const result = validateFiles([], partition);
    expect(result.valid).toBe(true);
    expect(result.totalSize).toBe(0);
    expect(result.fileCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatBytes
// ---------------------------------------------------------------------------

describe('formatBytes', () => {
  it('formats 0 bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('formats fractional values', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  it('formats negative values', () => {
    expect(formatBytes(-1024)).toBe('-1 KB');
  });

  it('formats large values', () => {
    expect(formatBytes(1073741824)).toBe('1 GB');
  });
});

// ---------------------------------------------------------------------------
// estimateFlashTime
// ---------------------------------------------------------------------------

describe('estimateFlashTime', () => {
  it('estimates time for a 1MB image at 921600 baud', () => {
    const result = estimateFlashTime(1048576, 921600);
    expect(result.seconds).toBeGreaterThan(0);
    expect(result.baudRate).toBe(921600);
    expect(result.imageSize).toBe(1048576);
    expect(result.formatted).toMatch(/\d+s|\d+m/);
  });

  it('returns 0 for zero-size image', () => {
    const result = estimateFlashTime(0, 921600);
    expect(result.seconds).toBe(0);
    expect(result.formatted).toBe('0s');
  });

  it('returns 0 for zero baud rate', () => {
    const result = estimateFlashTime(1024, 0);
    expect(result.seconds).toBe(0);
  });

  it('returns 0 for negative inputs', () => {
    expect(estimateFlashTime(-100, 921600).seconds).toBe(0);
    expect(estimateFlashTime(1024, -1).seconds).toBe(0);
  });

  it('formats minutes and seconds', () => {
    // Large image at slow baud — should produce m+s format
    const result = estimateFlashTime(4 * 1024 * 1024, 9600);
    expect(result.formatted).toMatch(/\d+m\s*\d*s?/);
    expect(result.seconds).toBeGreaterThan(60);
  });

  it('includes overhead factor', () => {
    // Raw: 1048576 / (921600/10) = 11.38s → with 1.15 overhead → ceil(13.08) = 14s
    const result = estimateFlashTime(1048576, 921600);
    const rawSeconds = 1048576 / (921600 / 10);
    expect(result.seconds).toBeGreaterThan(rawSeconds);
  });
});

// ---------------------------------------------------------------------------
// getRecommendation
// ---------------------------------------------------------------------------

describe('getRecommendation', () => {
  it('recommends LittleFS for ESP32', () => {
    const rec = getRecommendation('esp32:esp32:esp32');
    expect(rec.fsType).toBe('littlefs');
    expect(rec.alternatives).toContain('spiffs');
    expect(rec.recommendedSize).toBeGreaterThan(0);
    expect(rec.reason.length).toBeGreaterThan(0);
  });

  it('recommends LittleFS for ESP32-S3', () => {
    const rec = getRecommendation('esp32:esp32:esp32s3');
    expect(rec.fsType).toBe('littlefs');
  });

  it('recommends LittleFS for NodeMCU ESP8266', () => {
    const rec = getRecommendation('esp8266:esp8266:nodemcuv2');
    expect(rec.fsType).toBe('littlefs');
  });

  it('recommends SPIFFS for generic ESP8266', () => {
    const rec = getRecommendation('esp8266:esp8266:generic');
    expect(rec.fsType).toBe('spiffs');
  });

  it('provides fallback for unknown ESP32 board', () => {
    const rec = getRecommendation('esp32:esp32:unknownboard');
    expect(rec.fsType).toBe('littlefs');
    expect(rec.alternatives).toContain('spiffs');
  });

  it('provides fallback for unknown ESP8266 board', () => {
    const rec = getRecommendation('esp8266:esp8266:unknownboard');
    expect(rec.fsType).toBe('littlefs');
  });

  it('provides generic fallback for non-ESP boards', () => {
    const rec = getRecommendation('arduino:avr:uno');
    expect(rec.fsType).toBe('spiffs');
    expect(rec.alternatives).toContain('littlefs');
  });
});

// ---------------------------------------------------------------------------
// getDefaultPartition
// ---------------------------------------------------------------------------

describe('getDefaultPartition', () => {
  it('returns correct partition for known ESP32', () => {
    const p = getDefaultPartition('esp32:esp32:esp32');
    expect(p.fsType).toBe('littlefs');
    expect(p.size).toBe(1441792);
    expect(p.blockSize).toBe(4096);
  });

  it('returns correct partition for ESP8266', () => {
    const p = getDefaultPartition('esp8266:esp8266:nodemcuv2');
    expect(p.fsType).toBe('littlefs');
    expect(p.size).toBe(1044464);
  });

  it('falls back to ESP32 littlefs for unknown ESP32 variant', () => {
    const p = getDefaultPartition('esp32:esp32:custom');
    expect(p.fsType).toBe('littlefs');
  });

  it('falls back to ESP8266 littlefs for unknown ESP8266 variant', () => {
    const p = getDefaultPartition('esp8266:esp8266:custom');
    expect(p.fsType).toBe('littlefs');
  });

  it('falls back to default SPIFFS for non-ESP boards', () => {
    const p = getDefaultPartition('arduino:avr:uno');
    expect(p.fsType).toBe('spiffs');
  });
});

// ---------------------------------------------------------------------------
// getFsTypesForBoard
// ---------------------------------------------------------------------------

describe('getFsTypesForBoard', () => {
  it('returns all 3 types for ESP32', () => {
    const types = getFsTypesForBoard('esp32:esp32:esp32');
    expect(types).toEqual(['littlefs', 'spiffs', 'fatfs']);
  });

  it('returns 2 types for ESP8266', () => {
    const types = getFsTypesForBoard('esp8266:esp8266:nodemcuv2');
    expect(types).toEqual(['littlefs', 'spiffs']);
  });

  it('returns default types for unknown boards', () => {
    const types = getFsTypesForBoard('arduino:avr:uno');
    expect(types).toEqual(['spiffs', 'littlefs']);
  });

  it('returns fresh array (no mutation risk)', () => {
    const a = getFsTypesForBoard('esp32:esp32:esp32');
    const b = getFsTypesForBoard('esp32:esp32:esp32');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

// ---------------------------------------------------------------------------
// generateImageCommand
// ---------------------------------------------------------------------------

describe('generateImageCommand', () => {
  const partition = PARTITION_PRESETS['esp32_default'];

  it('generates mkspiffs command for SPIFFS', () => {
    const config: FsImageConfig = {
      fsType: 'spiffs',
      partition,
      files: [],
      boardFqbn: 'esp32:esp32:esp32',
    };
    const cmd = generateImageCommand(config);
    expect(cmd[0]).toBe('mkspiffs');
    expect(cmd).toContain('-c');
    expect(cmd).toContain('-p');
    expect(cmd).toContain('-b');
    expect(cmd).toContain('-s');
    expect(cmd).toContain(String(partition.size));
    expect(cmd[cmd.length - 1]).toBe('output.bin');
  });

  it('generates mklittlefs command for LittleFS', () => {
    const config: FsImageConfig = {
      fsType: 'littlefs',
      partition: PARTITION_PRESETS['esp32_littlefs'],
      files: [],
      boardFqbn: 'esp32:esp32:esp32',
    };
    const cmd = generateImageCommand(config);
    expect(cmd[0]).toBe('mklittlefs');
  });

  it('generates mkfatfs command for FAT', () => {
    const config: FsImageConfig = {
      fsType: 'fatfs',
      partition: PARTITION_PRESETS['esp32_fatfs'],
      files: [],
      boardFqbn: 'esp32:esp32:esp32',
    };
    const cmd = generateImageCommand(config);
    expect(cmd[0]).toBe('mkfatfs');
    expect(cmd).toContain('-s');
    // FAT doesn't use -p or -b
    expect(cmd).not.toContain('-p');
    expect(cmd).not.toContain('-b');
  });
});

// ---------------------------------------------------------------------------
// generateFlashCommand
// ---------------------------------------------------------------------------

describe('generateFlashCommand', () => {
  it('generates esptool command with correct offset', () => {
    const partition = PARTITION_PRESETS['esp32_default'];
    const cmd = generateFlashCommand(partition, 'image.bin', '/dev/ttyUSB0', 921600);
    expect(cmd[0]).toBe('esptool.py');
    expect(cmd).toContain('--port');
    expect(cmd).toContain('/dev/ttyUSB0');
    expect(cmd).toContain('--baud');
    expect(cmd).toContain('921600');
    expect(cmd).toContain('write_flash');
    expect(cmd).toContain(`0x${partition.offset.toString(16)}`);
    expect(cmd[cmd.length - 1]).toBe('image.bin');
  });

  it('uses auto chip detection', () => {
    const cmd = generateFlashCommand(PARTITION_PRESETS['esp32_default'], 'img.bin', '/dev/ttyS0', 115200);
    const chipIdx = cmd.indexOf('--chip');
    expect(chipIdx).toBeGreaterThan(-1);
    expect(cmd[chipIdx + 1]).toBe('auto');
  });
});

// ---------------------------------------------------------------------------
// PARTITION_PRESETS
// ---------------------------------------------------------------------------

describe('PARTITION_PRESETS', () => {
  it('contains expected presets', () => {
    expect(Object.keys(PARTITION_PRESETS).length).toBeGreaterThanOrEqual(8);
    expect(PARTITION_PRESETS['esp32_default']).toBeDefined();
    expect(PARTITION_PRESETS['esp32_large']).toBeDefined();
    expect(PARTITION_PRESETS['esp32_littlefs']).toBeDefined();
    expect(PARTITION_PRESETS['esp32_fatfs']).toBeDefined();
    expect(PARTITION_PRESETS['esp8266_1m']).toBeDefined();
    expect(PARTITION_PRESETS['esp8266_4m']).toBeDefined();
  });

  it('all presets have valid block sizes', () => {
    for (const [key, preset] of Object.entries(PARTITION_PRESETS)) {
      expect(preset.blockSize).toBeGreaterThan(0);
      expect(preset.size).toBeGreaterThan(0);
      expect(preset.offset).toBeGreaterThan(0);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(['spiffs', 'littlefs', 'fatfs']).toContain(preset.fsType);
      // Suppress unused var
      void key;
    }
  });
});

// ---------------------------------------------------------------------------
// FilesystemUploadManager — singleton + subscribe
// ---------------------------------------------------------------------------

describe('FilesystemUploadManager', () => {
  let mgr: FilesystemUploadManager;

  beforeEach(() => {
    storage.clear();
    mgr = FilesystemUploadManager.create();
  });

  describe('create & getSnapshot', () => {
    it('creates with default state', () => {
      const state = mgr.getSnapshot();
      expect(state.fsType).toBe('littlefs');
      expect(state.boardFqbn).toBe('esp32:esp32:esp32');
      expect(state.files).toEqual([]);
      expect(state.partition).toBeDefined();
    });

    it('creates independent instances', () => {
      const mgr2 = FilesystemUploadManager.create();
      mgr.addFile({ path: 'test.txt', size: 100 });
      expect(mgr2.getSnapshot().files).toEqual([]);
    });
  });

  describe('subscribe / notify', () => {
    it('notifies listeners on state change', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.addFile({ path: 'a.txt', size: 10 });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns unsubscribe function', () => {
      const listener = vi.fn();
      const unsub = mgr.subscribe(listener);
      unsub();
      mgr.addFile({ path: 'a.txt', size: 10 });
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      mgr.subscribe(l1);
      mgr.subscribe(l2);
      mgr.addFile({ path: 'a.txt', size: 10 });
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  describe('setBoard', () => {
    it('updates board and filesystem type', () => {
      mgr.setBoard('esp8266:esp8266:nodemcuv2');
      const state = mgr.getSnapshot();
      expect(state.boardFqbn).toBe('esp8266:esp8266:nodemcuv2');
      expect(state.fsType).toBe('littlefs');
    });

    it('updates partition config for board', () => {
      mgr.setBoard('esp8266:esp8266:generic');
      const state = mgr.getSnapshot();
      expect(state.fsType).toBe('spiffs');
      expect(state.partition.size).toBe(65536);
    });

    it('notifies listeners', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.setBoard('esp32:esp32:esp32s3');
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('setFsType', () => {
    it('updates filesystem type', () => {
      mgr.setFsType('spiffs');
      expect(mgr.getSnapshot().fsType).toBe('spiffs');
    });

    it('rejects unsupported FS type for board', () => {
      mgr.setBoard('esp8266:esp8266:nodemcuv2');
      mgr.setFsType('fatfs'); // Not supported on ESP8266
      expect(mgr.getSnapshot().fsType).toBe('littlefs'); // Unchanged
    });

    it('rejects invalid FS type', () => {
      mgr.setFsType('xfs' as never);
      expect(mgr.getSnapshot().fsType).toBe('littlefs');
    });

    it('updates partition label to match FS type', () => {
      mgr.setFsType('spiffs');
      expect(mgr.getSnapshot().partition.label).toBe('spiffs');
    });

    it('uses "ffat" label for fatfs', () => {
      mgr.setFsType('fatfs');
      expect(mgr.getSnapshot().partition.label).toBe('ffat');
    });
  });

  describe('setPartition', () => {
    it('replaces the partition config', () => {
      const custom: PartitionConfig = {
        label: 'custom',
        fsType: 'littlefs',
        size: 2097152,
        offset: 0x200000,
        blockSize: 4096,
        pageSize: 256,
      };
      mgr.setPartition(custom);
      expect(mgr.getSnapshot().partition).toEqual(custom);
    });
  });

  describe('addFile', () => {
    it('adds a valid file', () => {
      const issues = mgr.addFile({ path: 'config.json', size: 256 });
      expect(issues.filter((i) => i.severity === 'error')).toHaveLength(0);
      expect(mgr.getSnapshot().files).toHaveLength(1);
    });

    it('returns warning for dot-prefixed file but still adds it', () => {
      const issues = mgr.addFile({ path: '.env', size: 100 });
      expect(issues.some((i) => i.severity === 'warning')).toBe(true);
      expect(mgr.getSnapshot().files).toHaveLength(1);
    });

    it('rejects file with invalid characters', () => {
      const issues = mgr.addFile({ path: 'file<bad>.txt', size: 100 });
      expect(issues.some((i) => i.severity === 'error')).toBe(true);
      expect(mgr.getSnapshot().files).toHaveLength(0);
    });

    it('rejects duplicate file path', () => {
      mgr.addFile({ path: 'config.json', size: 100 });
      const issues = mgr.addFile({ path: 'config.json', size: 200 });
      expect(issues.some((i) => i.category === 'duplicate')).toBe(true);
      expect(mgr.getSnapshot().files).toHaveLength(1);
    });

    it('rejects file exceeding max size', () => {
      const issues = mgr.addFile({ path: 'big.bin', size: MAX_FILE_SIZE + 1 });
      expect(issues.some((i) => i.category === 'size')).toBe(true);
      expect(mgr.getSnapshot().files).toHaveLength(0);
    });

    it('preserves optional mimeType and lastModified', () => {
      mgr.addFile({ path: 'data.json', size: 50, mimeType: 'application/json', lastModified: 1234567890 });
      const file = mgr.getSnapshot().files[0];
      expect(file.mimeType).toBe('application/json');
      expect(file.lastModified).toBe(1234567890);
    });
  });

  describe('removeFile', () => {
    it('removes an existing file', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      expect(mgr.removeFile('a.txt')).toBe(true);
      expect(mgr.getSnapshot().files).toHaveLength(0);
    });

    it('returns false for non-existent file', () => {
      expect(mgr.removeFile('nope.txt')).toBe(false);
    });

    it('notifies listeners', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.removeFile('a.txt');
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('setFiles', () => {
    it('replaces all files', () => {
      mgr.addFile({ path: 'old.txt', size: 10 });
      mgr.setFiles([
        { path: 'new1.txt', size: 20 },
        { path: 'new2.txt', size: 30 },
      ]);
      expect(mgr.getSnapshot().files).toHaveLength(2);
      expect(mgr.getSnapshot().files[0].path).toBe('new1.txt');
    });
  });

  describe('clearFiles', () => {
    it('removes all files', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      mgr.addFile({ path: 'b.txt', size: 20 });
      mgr.clearFiles();
      expect(mgr.getSnapshot().files).toHaveLength(0);
    });
  });

  describe('validate', () => {
    it('validates current files against partition', () => {
      mgr.addFile({ path: 'index.html', size: 1024 });
      const result = mgr.validate();
      expect(result.valid).toBe(true);
      expect(result.totalSize).toBe(1024);
    });

    it('reports issues with current state', () => {
      // Force-set an oversized file via setFiles (bypasses addFile validation)
      mgr.setFiles([{ path: 'huge.bin', size: MAX_FILE_SIZE + 1 }]);
      const result = mgr.validate();
      expect(result.valid).toBe(false);
    });
  });

  describe('getRecommendation (instance)', () => {
    it('returns recommendation for current board', () => {
      const rec = mgr.getRecommendation();
      expect(rec.fsType).toBe('littlefs');
    });
  });

  describe('getSupportedFsTypes', () => {
    it('returns types for current board', () => {
      const types = mgr.getSupportedFsTypes();
      expect(types).toContain('littlefs');
    });
  });

  describe('estimateFlashTime (instance)', () => {
    it('estimates based on partition size', () => {
      const est = mgr.estimateFlashTime(921600);
      expect(est.seconds).toBeGreaterThan(0);
      expect(est.baudRate).toBe(921600);
    });

    it('uses default baud rate', () => {
      const est = mgr.estimateFlashTime();
      expect(est.baudRate).toBe(921600);
    });
  });

  describe('getImageConfig', () => {
    it('returns current config snapshot', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      const config = mgr.getImageConfig();
      expect(config.fsType).toBe('littlefs');
      expect(config.files).toHaveLength(1);
      expect(config.boardFqbn).toBe('esp32:esp32:esp32');
    });

    it('returns a copy of files array', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      const config = mgr.getImageConfig();
      config.files.push({ path: 'injected.txt', size: 1 });
      expect(mgr.getSnapshot().files).toHaveLength(1);
    });
  });

  describe('getImageCommand / getFlashCommand', () => {
    it('returns valid image command', () => {
      const cmd = mgr.getImageCommand();
      expect(cmd[0]).toBe('mklittlefs');
    });

    it('returns valid flash command', () => {
      const cmd = mgr.getFlashCommand('image.bin', '/dev/ttyUSB0');
      expect(cmd[0]).toBe('esptool.py');
      expect(cmd).toContain('image.bin');
    });
  });

  describe('getTotalSize / getUsableSpace / getUtilization', () => {
    it('returns 0 total for no files', () => {
      expect(mgr.getTotalSize()).toBe(0);
    });

    it('returns sum of file sizes', () => {
      mgr.addFile({ path: 'a.txt', size: 100 });
      mgr.addFile({ path: 'b.txt', size: 200 });
      expect(mgr.getTotalSize()).toBe(300);
    });

    it('returns usable space for littlefs (98%)', () => {
      const expected = Math.floor(mgr.getSnapshot().partition.size * 0.98);
      expect(mgr.getUsableSpace()).toBe(expected);
    });

    it('returns 0% utilization with no files', () => {
      expect(mgr.getUtilization()).toBe(0);
    });

    it('returns correct utilization percentage', () => {
      const usable = mgr.getUsableSpace();
      mgr.setFiles([{ path: 'data.bin', size: Math.floor(usable / 2) }]);
      expect(mgr.getUtilization()).toBe(50);
    });

    it('caps utilization at 100%', () => {
      mgr.setFiles([{ path: 'big.bin', size: mgr.getSnapshot().partition.size * 2 }]);
      expect(mgr.getUtilization()).toBe(100);
    });
  });

  describe('exportState / importState', () => {
    it('round-trips state', () => {
      mgr.addFile({ path: 'config.json', size: 512 });
      mgr.setFsType('spiffs');
      const exported = mgr.exportState();

      const mgr2 = FilesystemUploadManager.create();
      mgr2.importState(exported);
      expect(mgr2.getSnapshot().fsType).toBe('spiffs');
      expect(mgr2.getSnapshot().files).toHaveLength(1);
      expect(mgr2.getSnapshot().files[0].path).toBe('config.json');
    });

    it('returns a copy (no mutation risk)', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      const exported = mgr.exportState();
      exported.files.push({ path: 'injected.txt', size: 1 });
      expect(mgr.getSnapshot().files).toHaveLength(1);
    });
  });

  describe('reset', () => {
    it('resets to default state', () => {
      mgr.setBoard('esp8266:esp8266:nodemcuv2');
      mgr.addFile({ path: 'a.txt', size: 10 });
      mgr.reset();
      const state = mgr.getSnapshot();
      expect(state.boardFqbn).toBe('esp32:esp32:esp32');
      expect(state.fsType).toBe('littlefs');
      expect(state.files).toEqual([]);
    });

    it('notifies listeners', () => {
      const listener = vi.fn();
      mgr.subscribe(listener);
      mgr.reset();
      expect(listener).toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('persists state to localStorage', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      expect(storage.has('protopulse-fs-upload')).toBe(true);
    });

    it('loads persisted state on create', () => {
      mgr.addFile({ path: 'a.txt', size: 10 });
      mgr.setFsType('spiffs');

      const mgr2 = FilesystemUploadManager.create();
      expect(mgr2.getSnapshot().files).toHaveLength(1);
      expect(mgr2.getSnapshot().fsType).toBe('spiffs');
    });

    it('handles corrupted localStorage gracefully', () => {
      storage.set('protopulse-fs-upload', 'not-json');
      const mgr2 = FilesystemUploadManager.create();
      expect(mgr2.getSnapshot().files).toEqual([]);
      expect(mgr2.getSnapshot().fsType).toBe('littlefs');
    });

    it('handles non-object JSON gracefully', () => {
      storage.set('protopulse-fs-upload', '"string"');
      const mgr2 = FilesystemUploadManager.create();
      expect(mgr2.getSnapshot().fsType).toBe('littlefs');
    });
  });
});
