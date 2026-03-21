/**
 * FilesystemUploadManager — Manages SPIFFS/LittleFS filesystem image creation
 * and upload configuration for ESP8266/ESP32 boards.
 *
 * Handles file validation (size limits, name length, nested depth), partition
 * table configs, flash time estimation, and board-aware FS type recommendation.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

/** Supported filesystem types for ESP flash. */
export type FilesystemType = 'spiffs' | 'littlefs' | 'fatfs';

/** A file entry to be included in the filesystem image. */
export interface FsFileEntry {
  /** Relative path within the filesystem (e.g. "data/config.json"). */
  readonly path: string;
  /** File size in bytes. */
  readonly size: number;
  /** MIME type hint (optional). */
  readonly mimeType?: string;
  /** Last modified timestamp (ISO string or epoch ms). */
  readonly lastModified?: string | number;
}

/** Validation issue for a single file entry. */
export interface FsValidationIssue {
  /** Path of the problematic file. */
  readonly path: string;
  /** Category of the issue. */
  readonly category: 'size' | 'name' | 'depth' | 'character' | 'duplicate' | 'total_size';
  /** Severity level. */
  readonly severity: 'error' | 'warning';
  /** Human-readable description. */
  readonly message: string;
}

/** Result of validating a set of file entries against filesystem constraints. */
export interface FsValidationResult {
  readonly valid: boolean;
  readonly issues: FsValidationIssue[];
  readonly totalSize: number;
  readonly fileCount: number;
  readonly availableSpace: number;
}

/** Partition configuration for an ESP filesystem. */
export interface PartitionConfig {
  /** Partition label (e.g. "spiffs", "littlefs"). */
  readonly label: string;
  /** Filesystem type. */
  readonly fsType: FilesystemType;
  /** Partition size in bytes. */
  readonly size: number;
  /** Partition offset in flash (bytes from start). */
  readonly offset: number;
  /** Block size in bytes. */
  readonly blockSize: number;
  /** Page size in bytes (SPIFFS only). */
  readonly pageSize: number;
}

/** Flash time estimation result. */
export interface FlashTimeEstimate {
  /** Estimated flash time in seconds. */
  readonly seconds: number;
  /** Estimated flash time as human-readable string. */
  readonly formatted: string;
  /** Baud rate used for calculation. */
  readonly baudRate: number;
  /** Image size being flashed in bytes. */
  readonly imageSize: number;
}

/** Board-specific filesystem recommendation. */
export interface FsRecommendation {
  /** Recommended filesystem type. */
  readonly fsType: FilesystemType;
  /** Reason for the recommendation. */
  readonly reason: string;
  /** Alternative filesystem types that also work. */
  readonly alternatives: FilesystemType[];
  /** Recommended partition size in bytes. */
  readonly recommendedSize: number;
}

/** Filesystem image build configuration. */
export interface FsImageConfig {
  readonly fsType: FilesystemType;
  readonly partition: PartitionConfig;
  readonly files: FsFileEntry[];
  readonly boardFqbn: string;
}

/** Overall manager state exposed to subscribers. */
export interface FilesystemUploadState {
  readonly fsType: FilesystemType;
  readonly files: FsFileEntry[];
  readonly partition: PartitionConfig;
  readonly boardFqbn: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-fs-upload';

/** Maximum individual file size: 1 MB. */
export const MAX_FILE_SIZE = 1 * 1024 * 1024;

/** Maximum total filesystem image size: 4 MB (common ESP32 default). */
export const MAX_TOTAL_SIZE = 4 * 1024 * 1024;

/** Maximum file name length (single component, not full path). */
export const MAX_FILENAME_LENGTH = 32;

/** Maximum path length (full path including separators). */
export const MAX_PATH_LENGTH = 64;

/** Maximum directory nesting depth. */
export const MAX_NESTING_DEPTH = 4;

/** Maximum number of files in a filesystem image. */
export const MAX_FILE_COUNT = 256;

/** Characters not allowed in SPIFFS/LittleFS file names. */
const INVALID_CHARS_RE = /[<>:"|?*\x00-\x1F\\]/;

/** Flash write overhead factor (protocol framing, verification). */
const FLASH_OVERHEAD_FACTOR = 1.15;

/** Bits per baud (start + 8 data + stop). */
const BITS_PER_BYTE = 10;

// ---------------------------------------------------------------------------
// Partition presets
// ---------------------------------------------------------------------------

/** Built-in partition configurations for common ESP boards. */
export const PARTITION_PRESETS: Record<string, PartitionConfig> = {
  'esp32_default': {
    label: 'spiffs',
    fsType: 'spiffs',
    size: 1441792, // ~1.375 MB
    offset: 0x290000,
    blockSize: 4096,
    pageSize: 256,
  },
  'esp32_large': {
    label: 'spiffs',
    fsType: 'spiffs',
    size: 3145728, // 3 MB
    offset: 0x110000,
    blockSize: 4096,
    pageSize: 256,
  },
  'esp32_littlefs': {
    label: 'littlefs',
    fsType: 'littlefs',
    size: 1441792,
    offset: 0x290000,
    blockSize: 4096,
    pageSize: 256,
  },
  'esp32_fatfs': {
    label: 'ffat',
    fsType: 'fatfs',
    size: 1048576, // 1 MB
    offset: 0x310000,
    blockSize: 4096,
    pageSize: 512,
  },
  'esp8266_1m': {
    label: 'spiffs',
    fsType: 'spiffs',
    size: 65536, // 64 KB
    offset: 0xEB000,
    blockSize: 4096,
    pageSize: 256,
  },
  'esp8266_4m': {
    label: 'spiffs',
    fsType: 'spiffs',
    size: 1044464, // ~1 MB
    offset: 0x300000,
    blockSize: 8192,
    pageSize: 256,
  },
  'esp8266_littlefs': {
    label: 'littlefs',
    fsType: 'littlefs',
    size: 1044464,
    offset: 0x300000,
    blockSize: 4096,
    pageSize: 256,
  },
  'esp32s3_default': {
    label: 'spiffs',
    fsType: 'spiffs',
    size: 1441792,
    offset: 0x290000,
    blockSize: 4096,
    pageSize: 256,
  },
};

// ---------------------------------------------------------------------------
// Board → FS type mapping
// ---------------------------------------------------------------------------

interface BoardFsProfile {
  readonly defaultFs: FilesystemType;
  readonly supported: FilesystemType[];
  readonly defaultPartition: string;
  readonly reason: string;
  readonly recommendedSize: number;
}

const BOARD_FS_PROFILES: Record<string, BoardFsProfile> = {
  'esp32:esp32:esp32': {
    defaultFs: 'littlefs',
    supported: ['littlefs', 'spiffs', 'fatfs'],
    defaultPartition: 'esp32_littlefs',
    reason: 'LittleFS provides wear leveling, power-loss resilience, and directory support on ESP32.',
    recommendedSize: 1441792,
  },
  'esp32:esp32:esp32s3': {
    defaultFs: 'littlefs',
    supported: ['littlefs', 'spiffs', 'fatfs'],
    defaultPartition: 'esp32s3_default',
    reason: 'LittleFS is the modern default for ESP32-S3 with better performance than SPIFFS.',
    recommendedSize: 1441792,
  },
  'esp8266:esp8266:nodemcuv2': {
    defaultFs: 'littlefs',
    supported: ['littlefs', 'spiffs'],
    defaultPartition: 'esp8266_littlefs',
    reason: 'LittleFS replaced SPIFFS as the recommended filesystem for ESP8266 since Arduino core 2.7.0.',
    recommendedSize: 1044464,
  },
  'esp8266:esp8266:d1_mini': {
    defaultFs: 'littlefs',
    supported: ['littlefs', 'spiffs'],
    defaultPartition: 'esp8266_littlefs',
    reason: 'LittleFS is recommended for Wemos D1 Mini for reliable file operations.',
    recommendedSize: 1044464,
  },
  'esp8266:esp8266:generic': {
    defaultFs: 'spiffs',
    supported: ['spiffs', 'littlefs'],
    defaultPartition: 'esp8266_1m',
    reason: 'SPIFFS used as conservative default for generic ESP8266 — flash size may vary.',
    recommendedSize: 65536,
  },
};

// ---------------------------------------------------------------------------
// Helpers (pure functions)
// ---------------------------------------------------------------------------

function safeGetLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage may be unavailable
  }
}

/** Split a path into its component segments. */
export function splitPath(filePath: string): string[] {
  return filePath.split('/').filter((s) => s.length > 0);
}

/** Get the nesting depth of a file path. */
export function getPathDepth(filePath: string): number {
  const segments = splitPath(filePath);
  // Depth is number of directory segments (all but the last, which is the filename)
  return Math.max(0, segments.length - 1);
}

/** Validate a single filename component (not full path). */
export function validateFilename(name: string): FsValidationIssue[] {
  const issues: FsValidationIssue[] = [];

  if (name.length === 0) {
    issues.push({
      path: name,
      category: 'name',
      severity: 'error',
      message: 'File name cannot be empty.',
    });
    return issues;
  }

  if (name.length > MAX_FILENAME_LENGTH) {
    issues.push({
      path: name,
      category: 'name',
      severity: 'error',
      message: `File name "${name}" exceeds maximum length of ${MAX_FILENAME_LENGTH} characters (${name.length}).`,
    });
  }

  if (INVALID_CHARS_RE.test(name)) {
    issues.push({
      path: name,
      category: 'character',
      severity: 'error',
      message: `File name "${name}" contains invalid characters. Avoid < > : " | ? * \\ and control characters.`,
    });
  }

  if (name.startsWith('.')) {
    issues.push({
      path: name,
      category: 'name',
      severity: 'warning',
      message: `File name "${name}" starts with a dot — it will be hidden on most systems.`,
    });
  }

  return issues;
}

/** Validate a full file path. */
export function validatePath(filePath: string): FsValidationIssue[] {
  const issues: FsValidationIssue[] = [];

  if (filePath.length === 0) {
    issues.push({
      path: filePath,
      category: 'name',
      severity: 'error',
      message: 'File path cannot be empty.',
    });
    return issues;
  }

  if (filePath.length > MAX_PATH_LENGTH) {
    issues.push({
      path: filePath,
      category: 'name',
      severity: 'error',
      message: `Path "${filePath}" exceeds maximum length of ${MAX_PATH_LENGTH} characters (${filePath.length}).`,
    });
  }

  const segments = splitPath(filePath);
  for (const segment of segments) {
    const segmentIssues = validateFilename(segment);
    for (const issue of segmentIssues) {
      issues.push({ ...issue, path: filePath });
    }
  }

  const depth = getPathDepth(filePath);
  if (depth > MAX_NESTING_DEPTH) {
    issues.push({
      path: filePath,
      category: 'depth',
      severity: 'error',
      message: `Path "${filePath}" exceeds maximum nesting depth of ${MAX_NESTING_DEPTH} (depth: ${depth}).`,
    });
  }

  return issues;
}

/** Validate a collection of files against filesystem constraints. */
export function validateFiles(
  files: FsFileEntry[],
  partition: PartitionConfig,
): FsValidationResult {
  const issues: FsValidationIssue[] = [];
  let totalSize = 0;
  const pathSet = new Set<string>();

  for (const file of files) {
    // Path validation
    const pathIssues = validatePath(file.path);
    issues.push(...pathIssues);

    // Duplicate detection
    const normalized = file.path.toLowerCase();
    if (pathSet.has(normalized)) {
      issues.push({
        path: file.path,
        category: 'duplicate',
        severity: 'error',
        message: `Duplicate file path "${file.path}" (case-insensitive match).`,
      });
    }
    pathSet.add(normalized);

    // Individual file size
    if (file.size > MAX_FILE_SIZE) {
      issues.push({
        path: file.path,
        category: 'size',
        severity: 'error',
        message: `File "${file.path}" (${formatBytes(file.size)}) exceeds maximum file size of ${formatBytes(MAX_FILE_SIZE)}.`,
      });
    }

    if (file.size < 0) {
      issues.push({
        path: file.path,
        category: 'size',
        severity: 'error',
        message: `File "${file.path}" has invalid negative size.`,
      });
    }

    totalSize += file.size;
  }

  // Total size check
  const availableSpace = partition.size;
  // Filesystem metadata overhead: ~5% for SPIFFS, ~2% for LittleFS
  const overheadFactor = partition.fsType === 'spiffs' ? 0.95 : 0.98;
  const usableSpace = Math.floor(availableSpace * overheadFactor);

  if (totalSize > usableSpace) {
    issues.push({
      path: '*',
      category: 'total_size',
      severity: 'error',
      message: `Total file size (${formatBytes(totalSize)}) exceeds usable partition space (${formatBytes(usableSpace)} of ${formatBytes(availableSpace)}).`,
    });
  }

  // File count check
  if (files.length > MAX_FILE_COUNT) {
    issues.push({
      path: '*',
      category: 'total_size',
      severity: 'error',
      message: `File count (${files.length}) exceeds maximum of ${MAX_FILE_COUNT}.`,
    });
  }

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    valid: !hasErrors,
    issues,
    totalSize,
    fileCount: files.length,
    availableSpace: usableSpace,
  };
}

/** Format byte count to human-readable string. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) {
    return '0 B';
  }
  if (bytes < 0) {
    return `-${formatBytes(-bytes)}`;
  }
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), units.length - 1);
  const value = bytes / Math.pow(k, i);
  return `${parseFloat(value.toFixed(2))} ${units[i]}`;
}

/** Estimate flash upload time based on image size and baud rate. */
export function estimateFlashTime(imageSize: number, baudRate: number): FlashTimeEstimate {
  if (baudRate <= 0 || imageSize <= 0) {
    return {
      seconds: 0,
      formatted: '0s',
      baudRate,
      imageSize,
    };
  }

  const bytesPerSecond = baudRate / BITS_PER_BYTE;
  const rawSeconds = imageSize / bytesPerSecond;
  const totalSeconds = Math.ceil(rawSeconds * FLASH_OVERHEAD_FACTOR);

  let formatted: string;
  if (totalSeconds < 60) {
    formatted = `${totalSeconds}s`;
  } else {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    formatted = secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  }

  return {
    seconds: totalSeconds,
    formatted,
    baudRate,
    imageSize,
  };
}

/** Get a filesystem recommendation for a given board FQBN. */
export function getRecommendation(boardFqbn: string): FsRecommendation {
  const profile = BOARD_FS_PROFILES[boardFqbn];

  if (profile) {
    return {
      fsType: profile.defaultFs,
      reason: profile.reason,
      alternatives: profile.supported.filter((t) => t !== profile.defaultFs),
      recommendedSize: profile.recommendedSize,
    };
  }

  // Default for unknown boards
  if (boardFqbn.startsWith('esp32:')) {
    return {
      fsType: 'littlefs',
      reason: 'LittleFS is the recommended filesystem for ESP32 boards.',
      alternatives: ['spiffs', 'fatfs'],
      recommendedSize: 1441792,
    };
  }

  if (boardFqbn.startsWith('esp8266:')) {
    return {
      fsType: 'littlefs',
      reason: 'LittleFS is the recommended filesystem for ESP8266 boards.',
      alternatives: ['spiffs'],
      recommendedSize: 1044464,
    };
  }

  return {
    fsType: 'spiffs',
    reason: 'SPIFFS is the broadest-compatibility fallback for unknown boards.',
    alternatives: ['littlefs'],
    recommendedSize: 1441792,
  };
}

/** Get the default partition config for a board FQBN. */
export function getDefaultPartition(boardFqbn: string): PartitionConfig {
  const profile = BOARD_FS_PROFILES[boardFqbn];
  if (profile) {
    return PARTITION_PRESETS[profile.defaultPartition];
  }

  // Fallback by prefix
  if (boardFqbn.startsWith('esp32:')) {
    return PARTITION_PRESETS['esp32_littlefs'];
  }
  if (boardFqbn.startsWith('esp8266:')) {
    return PARTITION_PRESETS['esp8266_littlefs'];
  }

  return PARTITION_PRESETS['esp32_default'];
}

/** Get the FQBN prefix category. */
export function getFsTypesForBoard(boardFqbn: string): FilesystemType[] {
  const profile = BOARD_FS_PROFILES[boardFqbn];
  if (profile) {
    return [...profile.supported];
  }

  if (boardFqbn.startsWith('esp32:')) {
    return ['littlefs', 'spiffs', 'fatfs'];
  }
  if (boardFqbn.startsWith('esp8266:')) {
    return ['littlefs', 'spiffs'];
  }

  return ['spiffs', 'littlefs'];
}

/** Generate the mkspiffs / mklittlefs CLI command args for image creation. */
export function generateImageCommand(config: FsImageConfig): string[] {
  const { fsType, partition } = config;

  if (fsType === 'spiffs') {
    return [
      'mkspiffs',
      '-c', '.',
      '-p', String(partition.pageSize),
      '-b', String(partition.blockSize),
      '-s', String(partition.size),
      'output.bin',
    ];
  }

  if (fsType === 'littlefs') {
    return [
      'mklittlefs',
      '-c', '.',
      '-p', String(partition.pageSize),
      '-b', String(partition.blockSize),
      '-s', String(partition.size),
      'output.bin',
    ];
  }

  // fatfs
  return [
    'mkfatfs',
    '-c', '.',
    '-s', String(partition.size),
    'output.bin',
  ];
}

/** Generate the esptool flash command args for uploading. */
export function generateFlashCommand(
  partition: PartitionConfig,
  imagePath: string,
  port: string,
  baudRate: number,
): string[] {
  return [
    'esptool.py',
    '--chip', 'auto',
    '--port', port,
    '--baud', String(baudRate),
    'write_flash',
    `0x${partition.offset.toString(16)}`,
    imagePath,
  ];
}

// ---------------------------------------------------------------------------
// State management helpers
// ---------------------------------------------------------------------------

function loadState(): FilesystemUploadState {
  const raw = safeGetLS(STORAGE_KEY);
  if (raw === null) {
    return defaultState();
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) {
      return defaultState();
    }

    const obj = parsed as Record<string, unknown>;
    const boardFqbn = typeof obj.boardFqbn === 'string' ? obj.boardFqbn : 'esp32:esp32:esp32';
    const fsType = isValidFsType(obj.fsType) ? obj.fsType : 'littlefs';
    const partition = parsePartition(obj.partition) ?? getDefaultPartition(boardFqbn);
    const files = parseFiles(obj.files);

    return { fsType, files, partition, boardFqbn };
  } catch {
    return defaultState();
  }
}

function defaultState(): FilesystemUploadState {
  const boardFqbn = 'esp32:esp32:esp32';
  return {
    fsType: 'littlefs',
    files: [],
    partition: getDefaultPartition(boardFqbn),
    boardFqbn,
  };
}

function isValidFsType(value: unknown): value is FilesystemType {
  return value === 'spiffs' || value === 'littlefs' || value === 'fatfs';
}

function parsePartition(value: unknown): PartitionConfig | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const obj = value as Record<string, unknown>;
  if (
    typeof obj.label !== 'string' ||
    !isValidFsType(obj.fsType) ||
    typeof obj.size !== 'number' ||
    typeof obj.offset !== 'number' ||
    typeof obj.blockSize !== 'number' ||
    typeof obj.pageSize !== 'number'
  ) {
    return null;
  }
  return {
    label: obj.label,
    fsType: obj.fsType,
    size: obj.size,
    offset: obj.offset,
    blockSize: obj.blockSize,
    pageSize: obj.pageSize,
  };
}

function parseFiles(value: unknown): FsFileEntry[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const result: FsFileEntry[] = [];
  for (const item of value) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const obj = item as Record<string, unknown>;
    if (typeof obj.path !== 'string' || typeof obj.size !== 'number') {
      continue;
    }
    result.push({
      path: obj.path,
      size: obj.size,
      mimeType: typeof obj.mimeType === 'string' ? obj.mimeType : undefined,
      lastModified: typeof obj.lastModified === 'string' || typeof obj.lastModified === 'number'
        ? obj.lastModified
        : undefined,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// FilesystemUploadManager
// ---------------------------------------------------------------------------

export class FilesystemUploadManager {
  private _state: FilesystemUploadState;
  private _listeners = new Set<Listener>();

  private constructor() {
    this._state = loadState();
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(): FilesystemUploadManager {
    return new FilesystemUploadManager();
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): FilesystemUploadState => {
    return this._state;
  };

  private notify(): void {
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  private setState(partial: Partial<FilesystemUploadState>): void {
    this._state = { ...this._state, ...partial };
    this.persist();
    this.notify();
  }

  private persist(): void {
    safeSetLS(STORAGE_KEY, JSON.stringify(this._state));
  }

  // -----------------------------------------------------------------------
  // Board & filesystem type
  // -----------------------------------------------------------------------

  /** Set the target board. Automatically updates FS type and partition. */
  setBoard(boardFqbn: string): void {
    const recommendation = getRecommendation(boardFqbn);
    const partition = getDefaultPartition(boardFqbn);
    this.setState({
      boardFqbn,
      fsType: recommendation.fsType,
      partition,
    });
  }

  /** Set the filesystem type. Updates partition label accordingly. */
  setFsType(fsType: FilesystemType): void {
    if (!isValidFsType(fsType)) {
      return;
    }
    const supported = getFsTypesForBoard(this._state.boardFqbn);
    if (!supported.includes(fsType)) {
      return;
    }
    this.setState({
      fsType,
      partition: { ...this._state.partition, fsType, label: fsType === 'fatfs' ? 'ffat' : fsType },
    });
  }

  /** Set a custom partition configuration. */
  setPartition(partition: PartitionConfig): void {
    this.setState({ partition });
  }

  // -----------------------------------------------------------------------
  // File management
  // -----------------------------------------------------------------------

  /** Add a file entry. Returns validation issues (empty if none). */
  addFile(file: FsFileEntry): FsValidationIssue[] {
    const issues = validatePath(file.path);
    if (file.size > MAX_FILE_SIZE) {
      issues.push({
        path: file.path,
        category: 'size',
        severity: 'error',
        message: `File "${file.path}" (${formatBytes(file.size)}) exceeds maximum file size of ${formatBytes(MAX_FILE_SIZE)}.`,
      });
    }

    // Check duplicate
    const normalized = file.path.toLowerCase();
    const existing = this._state.files.some((f) => f.path.toLowerCase() === normalized);
    if (existing) {
      issues.push({
        path: file.path,
        category: 'duplicate',
        severity: 'error',
        message: `File "${file.path}" already exists in the file list.`,
      });
    }

    // Add even if there are warnings (only block on errors)
    const hasErrors = issues.some((i) => i.severity === 'error');
    if (!hasErrors) {
      this.setState({ files: [...this._state.files, file] });
    }

    return issues;
  }

  /** Remove a file by path. Returns true if removed. */
  removeFile(path: string): boolean {
    const idx = this._state.files.findIndex((f) => f.path === path);
    if (idx === -1) {
      return false;
    }
    const updated = [...this._state.files];
    updated.splice(idx, 1);
    this.setState({ files: updated });
    return true;
  }

  /** Replace all files at once. */
  setFiles(files: FsFileEntry[]): void {
    this.setState({ files: [...files] });
  }

  /** Clear all files. */
  clearFiles(): void {
    this.setState({ files: [] });
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Validate all current files against the current partition. */
  validate(): FsValidationResult {
    return validateFiles(this._state.files, this._state.partition);
  }

  /** Get a filesystem type recommendation for the current board. */
  getRecommendation(): FsRecommendation {
    return getRecommendation(this._state.boardFqbn);
  }

  /** Get supported filesystem types for the current board. */
  getSupportedFsTypes(): FilesystemType[] {
    return getFsTypesForBoard(this._state.boardFqbn);
  }

  /** Estimate flash time for the current file set. */
  estimateFlashTime(baudRate: number = 921600): FlashTimeEstimate {
    const totalSize = this._state.files.reduce((sum, f) => sum + f.size, 0);
    // Use partition size for estimation (full image is written)
    const imageSize = Math.max(totalSize, this._state.partition.size);
    return estimateFlashTime(imageSize, baudRate);
  }

  /** Generate the image creation config. */
  getImageConfig(): FsImageConfig {
    return {
      fsType: this._state.fsType,
      partition: this._state.partition,
      files: [...this._state.files],
      boardFqbn: this._state.boardFqbn,
    };
  }

  /** Generate CLI command for creating the filesystem image. */
  getImageCommand(): string[] {
    return generateImageCommand(this.getImageConfig());
  }

  /** Generate CLI command for flashing the image. */
  getFlashCommand(imagePath: string, port: string, baudRate: number = 921600): string[] {
    return generateFlashCommand(this._state.partition, imagePath, port, baudRate);
  }

  /** Get the current total file size. */
  getTotalSize(): number {
    return this._state.files.reduce((sum, f) => sum + f.size, 0);
  }

  /** Get the usable space in the current partition. */
  getUsableSpace(): number {
    const factor = this._state.partition.fsType === 'spiffs' ? 0.95 : 0.98;
    return Math.floor(this._state.partition.size * factor);
  }

  /** Get utilization percentage (0-100). */
  getUtilization(): number {
    const usable = this.getUsableSpace();
    if (usable <= 0) {
      return 0;
    }
    return Math.min(100, Math.round((this.getTotalSize() / usable) * 100));
  }

  // -----------------------------------------------------------------------
  // Serialization
  // -----------------------------------------------------------------------

  /** Export the current state for persistence. */
  exportState(): FilesystemUploadState {
    return { ...this._state, files: [...this._state.files] };
  }

  /** Import state (replaces current state entirely). */
  importState(state: FilesystemUploadState): void {
    this.setState({
      fsType: state.fsType,
      files: [...state.files],
      partition: { ...state.partition },
      boardFqbn: state.boardFqbn,
    });
  }

  /** Reset to defaults. */
  reset(): void {
    this.setState(defaultState());
  }
}
