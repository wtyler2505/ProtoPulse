// ---------------------------------------------------------------------------
// ESP-IDF Framework Support
// ---------------------------------------------------------------------------
// EspIdfManager singleton providing ESP target management, project scaffolding,
// CMakeLists.txt generation, partition table generation/validation, sdkconfig
// generation/parsing, IDF component declarations, SDK config options, and
// starter main.c generation for all ESP32 variants.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported ESP target chips. */
export type EspTarget = 'esp32' | 'esp32s2' | 'esp32s3' | 'esp32c3' | 'esp32c6' | 'esp32h2';

/** ESP-IDF project descriptor. */
export interface EspIdfProject {
  name: string;
  target: EspTarget;
  idfVersion: string;
  path: string;
  components: string[];
  sdkConfig: Map<string, string>;
  partitionTable: PartitionEntry[];
  createdAt: number;
}

/** Partition table entry. */
export interface PartitionEntry {
  name: string;
  type: PartitionType;
  subType: string;
  offset: string;
  size: string;
  flags: string;
}

/** Partition type. */
export type PartitionType = 'app' | 'data';

/** ESP target metadata. */
export interface EspTargetInfo {
  target: EspTarget;
  name: string;
  arch: string;
  cores: number;
  maxFlash: number;
  maxPsram: number;
  hasWifi: boolean;
  hasBle: boolean;
  hasUsb: boolean;
  defaultFlashSize: string;
  openocdTarget: string;
  description: string;
}

/** IDF component descriptor. */
export interface IdfComponent {
  name: string;
  description: string;
  requires: string[];
  includeDirs: string[];
  sources: string[];
}

/** SDK config option. */
export interface SdkConfigOption {
  key: string;
  defaultValue: string;
  description: string;
  type: 'bool' | 'int' | 'hex' | 'string' | 'choice';
  choices?: string[];
  depends?: string;
}

/** Validation result for partition tables. */
export interface PartitionValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  totalSize: number;
}

/** CMakeLists generation options. */
export interface CMakeOptions {
  minimumVersion: string;
  extraComponents: string[];
  extraFlags: string[];
}

// ---------------------------------------------------------------------------
// Target definitions
// ---------------------------------------------------------------------------

export const ESP_TARGETS: Record<EspTarget, EspTargetInfo> = {
  esp32: {
    target: 'esp32',
    name: 'ESP32',
    arch: 'xtensa-lx6',
    cores: 2,
    maxFlash: 16777216,
    maxPsram: 8388608,
    hasWifi: true,
    hasBle: true,
    hasUsb: false,
    defaultFlashSize: '4MB',
    openocdTarget: 'target/esp32.cfg',
    description: 'Dual-core Xtensa LX6, Wi-Fi + BT/BLE, up to 240 MHz. The original and most widely used ESP32.',
  },
  esp32s2: {
    target: 'esp32s2',
    name: 'ESP32-S2',
    arch: 'xtensa-lx7',
    cores: 1,
    maxFlash: 16777216,
    maxPsram: 8388608,
    hasWifi: true,
    hasBle: false,
    hasUsb: true,
    defaultFlashSize: '4MB',
    openocdTarget: 'target/esp32s2.cfg',
    description: 'Single-core Xtensa LX7 with native USB OTG, Wi-Fi only (no Bluetooth). Lower power than ESP32.',
  },
  esp32s3: {
    target: 'esp32s3',
    name: 'ESP32-S3',
    arch: 'xtensa-lx7',
    cores: 2,
    maxFlash: 16777216,
    maxPsram: 8388608,
    hasWifi: true,
    hasBle: true,
    hasUsb: true,
    defaultFlashSize: '8MB',
    openocdTarget: 'target/esp32s3.cfg',
    description: 'Dual-core Xtensa LX7, Wi-Fi + BLE 5, USB OTG, vector instructions for AI/ML workloads.',
  },
  esp32c3: {
    target: 'esp32c3',
    name: 'ESP32-C3',
    arch: 'riscv32-imc',
    cores: 1,
    maxFlash: 16777216,
    maxPsram: 0,
    hasWifi: true,
    hasBle: true,
    hasUsb: false,
    defaultFlashSize: '4MB',
    openocdTarget: 'target/esp32c3.cfg',
    description: 'Single-core RISC-V, Wi-Fi + BLE 5. Cost-effective replacement for ESP8266.',
  },
  esp32c6: {
    target: 'esp32c6',
    name: 'ESP32-C6',
    arch: 'riscv32-imac',
    cores: 1,
    maxFlash: 16777216,
    maxPsram: 0,
    hasWifi: true,
    hasBle: true,
    hasUsb: false,
    defaultFlashSize: '4MB',
    openocdTarget: 'target/esp32c6.cfg',
    description: 'Single-core RISC-V with Wi-Fi 6, BLE 5, Zigbee/Thread (802.15.4). First ESP with Wi-Fi 6.',
  },
  esp32h2: {
    target: 'esp32h2',
    name: 'ESP32-H2',
    arch: 'riscv32-imac',
    cores: 1,
    maxFlash: 4194304,
    maxPsram: 0,
    hasWifi: false,
    hasBle: true,
    hasUsb: false,
    defaultFlashSize: '4MB',
    openocdTarget: 'target/esp32h2.cfg',
    description: 'Single-core RISC-V with BLE 5, Zigbee/Thread (802.15.4). No Wi-Fi — designed for mesh networking.',
  },
};

// ---------------------------------------------------------------------------
// Common IDF components
// ---------------------------------------------------------------------------

export const IDF_COMPONENTS: IdfComponent[] = [
  {
    name: 'esp_wifi',
    description: 'Wi-Fi driver and station/AP mode support',
    requires: ['esp_event', 'esp_netif', 'nvs_flash'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'esp_http_server',
    description: 'HTTP server for REST APIs and web interfaces',
    requires: ['esp_wifi', 'esp_event'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'esp_http_client',
    description: 'HTTP client for making outbound requests',
    requires: ['esp_event', 'esp_tls'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'mqtt',
    description: 'MQTT client for IoT messaging (supports MQTT 3.1.1 and 5.0)',
    requires: ['esp_event', 'esp_tls'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'nvs_flash',
    description: 'Non-volatile storage for key-value pairs in flash',
    requires: ['spi_flash'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'spiffs',
    description: 'SPI Flash File System for storing files in flash',
    requires: ['spi_flash'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'fatfs',
    description: 'FAT filesystem support for SD cards and flash',
    requires: ['spi_flash', 'wear_levelling'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'driver',
    description: 'Peripheral drivers (GPIO, SPI, I2C, UART, ADC, PWM, etc.)',
    requires: [],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'esp_adc',
    description: 'ADC (Analog-to-Digital Converter) driver',
    requires: ['driver'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'bt',
    description: 'Bluetooth (Classic + BLE) stack',
    requires: ['nvs_flash'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'esp_timer',
    description: 'High-resolution timer and periodic callbacks',
    requires: [],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'freertos',
    description: 'FreeRTOS real-time operating system (included by default)',
    requires: [],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'esp_ota_ops',
    description: 'Over-the-air firmware update support',
    requires: ['esp_http_client', 'app_update'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'esp_websocket_client',
    description: 'WebSocket client for real-time communication',
    requires: ['esp_event', 'esp_tls'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'mdns',
    description: 'mDNS/DNS-SD for network service discovery',
    requires: ['esp_netif'],
    includeDirs: ['include'],
    sources: [],
  },
  {
    name: 'esp_tls',
    description: 'TLS/SSL transport layer for secure connections',
    requires: [],
    includeDirs: ['include'],
    sources: [],
  },
];

// ---------------------------------------------------------------------------
// SDK config options
// ---------------------------------------------------------------------------

export const SDK_CONFIG_OPTIONS: SdkConfigOption[] = [
  { key: 'CONFIG_ESP_WIFI_SSID', defaultValue: 'myssid', description: 'Wi-Fi SSID to connect to', type: 'string' },
  { key: 'CONFIG_ESP_WIFI_PASSWORD', defaultValue: 'mypassword', description: 'Wi-Fi password', type: 'string' },
  { key: 'CONFIG_ESP_WIFI_AUTH_MODE', defaultValue: 'WIFI_AUTH_WPA2_PSK', description: 'Wi-Fi authentication mode', type: 'choice', choices: ['WIFI_AUTH_OPEN', 'WIFI_AUTH_WEP', 'WIFI_AUTH_WPA_PSK', 'WIFI_AUTH_WPA2_PSK', 'WIFI_AUTH_WPA_WPA2_PSK', 'WIFI_AUTH_WPA3_PSK'] },
  { key: 'CONFIG_ESP_MAXIMUM_RETRY', defaultValue: '5', description: 'Maximum Wi-Fi connection retry count', type: 'int' },
  { key: 'CONFIG_FREERTOS_HZ', defaultValue: '1000', description: 'FreeRTOS tick rate (Hz)', type: 'int' },
  { key: 'CONFIG_ESP_TASK_WDT_TIMEOUT_S', defaultValue: '5', description: 'Task watchdog timeout in seconds', type: 'int' },
  { key: 'CONFIG_ESP_TASK_WDT_EN', defaultValue: 'y', description: 'Enable task watchdog timer', type: 'bool' },
  { key: 'CONFIG_LOG_DEFAULT_LEVEL', defaultValue: '3', description: 'Default log level (0=None, 1=Error, 2=Warn, 3=Info, 4=Debug, 5=Verbose)', type: 'int' },
  { key: 'CONFIG_PARTITION_TABLE_CUSTOM', defaultValue: 'n', description: 'Use custom partition table CSV', type: 'bool' },
  { key: 'CONFIG_PARTITION_TABLE_FILENAME', defaultValue: 'partitions.csv', description: 'Custom partition table filename', type: 'string', depends: 'CONFIG_PARTITION_TABLE_CUSTOM' },
  { key: 'CONFIG_ESPTOOLPY_FLASHSIZE', defaultValue: '4MB', description: 'Flash chip size', type: 'choice', choices: ['1MB', '2MB', '4MB', '8MB', '16MB'] },
  { key: 'CONFIG_ESPTOOLPY_FLASHMODE', defaultValue: 'dio', description: 'Flash SPI mode', type: 'choice', choices: ['qio', 'qout', 'dio', 'dout'] },
  { key: 'CONFIG_ESPTOOLPY_FLASHFREQ', defaultValue: '40m', description: 'Flash SPI speed', type: 'choice', choices: ['20m', '26m', '40m', '80m'] },
  { key: 'CONFIG_ESPTOOLPY_MONITOR_BAUD', defaultValue: '115200', description: 'Serial monitor baud rate', type: 'int' },
  { key: 'CONFIG_ESP_CONSOLE_UART_BAUDRATE', defaultValue: '115200', description: 'UART console baud rate', type: 'int' },
  { key: 'CONFIG_COMPILER_OPTIMIZATION', defaultValue: 'CONFIG_COMPILER_OPTIMIZATION_DEFAULT', description: 'Compiler optimization level', type: 'choice', choices: ['CONFIG_COMPILER_OPTIMIZATION_DEFAULT', 'CONFIG_COMPILER_OPTIMIZATION_SIZE', 'CONFIG_COMPILER_OPTIMIZATION_PERF', 'CONFIG_COMPILER_OPTIMIZATION_NONE'] },
  { key: 'CONFIG_ESP_SYSTEM_PANIC', defaultValue: 'CONFIG_ESP_SYSTEM_PANIC_PRINT_REBOOT', description: 'Panic handler behavior', type: 'choice', choices: ['CONFIG_ESP_SYSTEM_PANIC_PRINT_HALT', 'CONFIG_ESP_SYSTEM_PANIC_PRINT_REBOOT', 'CONFIG_ESP_SYSTEM_PANIC_SILENT_REBOOT', 'CONFIG_ESP_SYSTEM_PANIC_GDBSTUB'] },
  { key: 'CONFIG_BOOTLOADER_LOG_LEVEL', defaultValue: '3', description: 'Bootloader log level', type: 'int' },
  { key: 'CONFIG_ESP_INT_WDT_TIMEOUT_MS', defaultValue: '300', description: 'Interrupt watchdog timeout (ms)', type: 'int' },
  { key: 'CONFIG_HEAP_TRACING_DEST', defaultValue: 'CONFIG_HEAP_TRACING_STANDALONE', description: 'Heap tracing destination', type: 'choice', choices: ['CONFIG_HEAP_TRACING_OFF', 'CONFIG_HEAP_TRACING_STANDALONE', 'CONFIG_HEAP_TRACING_TOHOST'] },
  { key: 'CONFIG_LWIP_MAX_SOCKETS', defaultValue: '10', description: 'Maximum number of open sockets', type: 'int' },
];

// ---------------------------------------------------------------------------
// Default partition tables
// ---------------------------------------------------------------------------

const DEFAULT_PARTITION_TABLE: PartitionEntry[] = [
  { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
  { name: 'phy_init', type: 'data', subType: 'phy', offset: '0xf000', size: '0x1000', flags: '' },
  { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
];

const OTA_PARTITION_TABLE: PartitionEntry[] = [
  { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x4000', flags: '' },
  { name: 'otadata', type: 'data', subType: 'ota', offset: '0xd000', size: '0x2000', flags: '' },
  { name: 'phy_init', type: 'data', subType: 'phy', offset: '0xf000', size: '0x1000', flags: '' },
  { name: 'ota_0', type: 'app', subType: 'ota_0', offset: '0x10000', size: '0x1E0000', flags: '' },
  { name: 'ota_1', type: 'app', subType: 'ota_1', offset: '0x1F0000', size: '0x1E0000', flags: '' },
];

// ---------------------------------------------------------------------------
// Generation functions
// ---------------------------------------------------------------------------

/**
 * Generate a project-level CMakeLists.txt.
 */
export function generateProjectCMakeLists(projectName: string, options?: Partial<CMakeOptions>): string {
  const minVersion = options?.minimumVersion ?? '3.16';
  const lines: string[] = [];

  lines.push(`cmake_minimum_required(VERSION ${minVersion})`);
  lines.push('');

  // Extra component directories
  const extraComponents = options?.extraComponents ?? [];
  if (extraComponents.length > 0) {
    lines.push(`set(EXTRA_COMPONENT_DIRS ${extraComponents.join(' ')})`);
    lines.push('');
  }

  lines.push('include($ENV{IDF_PATH}/tools/cmake/project.cmake)');
  lines.push(`project(${projectName})`);

  // Extra flags
  const extraFlags = options?.extraFlags ?? [];
  if (extraFlags.length > 0) {
    lines.push('');
    for (const flag of extraFlags) {
      lines.push(flag);
    }
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a component-level CMakeLists.txt (main component).
 */
export function generateComponentCMakeLists(
  sources: string[],
  requires: string[],
  includeDirs: string[] = ['.'],
): string {
  const lines: string[] = [];

  lines.push('idf_component_register(');
  lines.push(`    SRCS ${sources.map((s) => `"${s}"`).join(' ')}`);
  lines.push(`    INCLUDE_DIRS ${includeDirs.map((d) => `"${d}"`).join(' ')}`);

  if (requires.length > 0) {
    lines.push(`    REQUIRES ${requires.join(' ')}`);
  }

  lines.push(')');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate a partition table CSV file.
 */
export function generatePartitionTableCsv(entries: PartitionEntry[]): string {
  const lines: string[] = [];
  lines.push('# Name,   Type, SubType, Offset,   Size, Flags');

  for (const entry of entries) {
    const flags = entry.flags || '';
    lines.push(`${entry.name}, ${entry.type}, ${entry.subType}, ${entry.offset}, ${entry.size}, ${flags}`);
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Parse a partition table CSV string into entries.
 */
export function parsePartitionTableCsv(csv: string): PartitionEntry[] {
  const entries: PartitionEntry[] = [];
  const lines = csv.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const parts = trimmed.split(',').map((p) => p.trim());
    if (parts.length < 5) {
      continue;
    }

    entries.push({
      name: parts[0],
      type: parts[1] as PartitionType,
      subType: parts[2],
      offset: parts[3],
      size: parts[4],
      flags: parts[5] ?? '',
    });
  }

  return entries;
}

/**
 * Parse a size string (e.g., "1M", "0x10000", "4096") to bytes.
 */
export function parseSizeToBytes(size: string): number {
  const trimmed = size.trim().toUpperCase();

  if (trimmed.endsWith('K')) {
    return parseInt(trimmed.slice(0, -1), 10) * 1024;
  }
  if (trimmed.endsWith('M')) {
    return parseInt(trimmed.slice(0, -1), 10) * 1024 * 1024;
  }
  if (trimmed.startsWith('0X')) {
    return parseInt(trimmed, 16);
  }

  return parseInt(trimmed, 10);
}

/**
 * Validate a partition table for correctness.
 */
export function validatePartitionTable(entries: PartitionEntry[], flashSizeBytes: number): PartitionValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let totalSize = 0;

  if (entries.length === 0) {
    errors.push('Partition table is empty.');
    return { valid: false, errors, warnings, totalSize: 0 };
  }

  // Check for duplicate names
  const names = new Set<string>();
  for (const entry of entries) {
    if (names.has(entry.name)) {
      errors.push(`Duplicate partition name: '${entry.name}'.`);
    }
    names.add(entry.name);
  }

  // Check for valid types
  for (const entry of entries) {
    if (entry.type !== 'app' && entry.type !== 'data') {
      errors.push(`Invalid partition type '${entry.type}' for '${entry.name}'. Must be 'app' or 'data'.`);
    }
  }

  // Check for at least one app partition
  const hasApp = entries.some((e) => e.type === 'app');
  if (!hasApp) {
    errors.push('Partition table must contain at least one app partition.');
  }

  // Check overlaps and total size
  const sorted = [...entries].sort((a, b) => parseSizeToBytes(a.offset) - parseSizeToBytes(b.offset));

  for (let i = 0; i < sorted.length; i++) {
    const offset = parseSizeToBytes(sorted[i].offset);
    const size = parseSizeToBytes(sorted[i].size);

    if (size <= 0) {
      errors.push(`Partition '${sorted[i].name}' has invalid size: ${sorted[i].size}.`);
      continue;
    }

    totalSize += size;
    const end = offset + size;

    // Check overlap with next partition
    if (i + 1 < sorted.length) {
      const nextOffset = parseSizeToBytes(sorted[i + 1].offset);
      if (end > nextOffset) {
        errors.push(
          `Partition '${sorted[i].name}' (ends at 0x${end.toString(16)}) overlaps with '${sorted[i + 1].name}' (starts at 0x${nextOffset.toString(16)}).`,
        );
      }
    }

    // Check if it exceeds flash size
    if (end > flashSizeBytes) {
      errors.push(
        `Partition '${sorted[i].name}' exceeds flash size (ends at 0x${end.toString(16)}, flash is 0x${flashSizeBytes.toString(16)}).`,
      );
    }
  }

  // Warnings
  const hasNvs = entries.some((e) => e.subType === 'nvs');
  if (!hasNvs) {
    warnings.push('No NVS partition found. Wi-Fi calibration data and key-value storage will not work.');
  }

  const nvsEntry = entries.find((e) => e.subType === 'nvs');
  if (nvsEntry && parseSizeToBytes(nvsEntry.size) < 0x3000) {
    warnings.push('NVS partition is smaller than 12KB (0x3000). This may be too small for Wi-Fi credentials and settings.');
  }

  const otaEntries = entries.filter((e) => e.subType.startsWith('ota_'));
  if (otaEntries.length === 1) {
    warnings.push('Only one OTA partition found. OTA updates require at least two app partitions (ota_0 and ota_1).');
  }

  return { valid: errors.length === 0, errors, warnings, totalSize };
}

/**
 * Generate sdkconfig file contents from a config map.
 */
export function generateSdkConfig(config: Map<string, string>): string {
  const lines: string[] = [];
  lines.push('# Auto-generated by ProtoPulse ESP-IDF Support');
  lines.push(`# Generated: ${new Date().toISOString().split('T')[0]}`);
  lines.push('');

  const sortedKeys = Array.from(config.keys()).sort();

  for (const key of sortedKeys) {
    const value = config.get(key)!;
    if (value === 'n') {
      lines.push(`# ${key} is not set`);
    } else if (value === 'y') {
      lines.push(`${key}=y`);
    } else if (/^\d+$/.test(value) || value.startsWith('0x')) {
      lines.push(`${key}=${value}`);
    } else if (value.startsWith('CONFIG_')) {
      // Enum/choice values are unquoted
      lines.push(`${key}=${value}`);
    } else {
      lines.push(`${key}="${value}"`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

/**
 * Parse sdkconfig file contents into a config map.
 */
export function parseSdkConfig(content: string): Map<string, string> {
  const config = new Map<string, string>();
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Handle "# CONFIG_XXX is not set"
    const notSetMatch = /^#\s*(CONFIG_\S+)\s+is not set$/.exec(trimmed);
    if (notSetMatch) {
      config.set(notSetMatch[1], 'n');
      continue;
    }

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    // Handle KEY=VALUE
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Remove quotes from string values
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    config.set(key, value);
  }

  return config;
}

/**
 * Generate a starter main.c file for an ESP-IDF project.
 */
export function generateMainC(target: EspTarget, components: string[]): string {
  const lines: string[] = [];
  const targetInfo = ESP_TARGETS[target];

  lines.push('/**');
  lines.push(` * ProtoPulse ESP-IDF Project — ${targetInfo.name}`);
  lines.push(' * Auto-generated starter application.');
  lines.push(' */');
  lines.push('');

  // Standard includes
  lines.push('#include <stdio.h>');
  lines.push('#include "freertos/FreeRTOS.h"');
  lines.push('#include "freertos/task.h"');
  lines.push('#include "esp_system.h"');
  lines.push('#include "esp_log.h"');

  // Conditional includes based on components
  if (components.includes('nvs_flash')) {
    lines.push('#include "nvs_flash.h"');
  }
  if (components.includes('esp_wifi')) {
    lines.push('#include "esp_wifi.h"');
    lines.push('#include "esp_event.h"');
    lines.push('#include "esp_netif.h"');
  }
  if (components.includes('driver')) {
    lines.push('#include "driver/gpio.h"');
  }
  if (components.includes('esp_http_server')) {
    lines.push('#include "esp_http_server.h"');
  }
  if (components.includes('mqtt')) {
    lines.push('#include "mqtt_client.h"');
  }
  if (components.includes('bt')) {
    lines.push('#include "esp_bt.h"');
  }
  if (components.includes('esp_adc')) {
    lines.push('#include "esp_adc/adc_oneshot.h"');
  }

  lines.push('');
  lines.push('static const char *TAG = "app_main";');
  lines.push('');

  // NVS init helper
  if (components.includes('nvs_flash')) {
    lines.push('static void init_nvs(void) {');
    lines.push('    esp_err_t ret = nvs_flash_init();');
    lines.push('    if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {');
    lines.push('        ESP_ERROR_CHECK(nvs_flash_erase());');
    lines.push('        ret = nvs_flash_init();');
    lines.push('    }');
    lines.push('    ESP_ERROR_CHECK(ret);');
    lines.push('}');
    lines.push('');
  }

  // app_main
  lines.push('void app_main(void) {');
  lines.push(`    ESP_LOGI(TAG, "Starting ${targetInfo.name} application");`);
  lines.push('');

  if (components.includes('nvs_flash')) {
    lines.push('    // Initialize NVS');
    lines.push('    init_nvs();');
    lines.push('');
  }

  if (components.includes('esp_wifi')) {
    lines.push('    // Initialize networking');
    lines.push('    ESP_ERROR_CHECK(esp_netif_init());');
    lines.push('    ESP_ERROR_CHECK(esp_event_loop_create_default());');
    lines.push('');
  }

  lines.push('    // TODO: Add your application logic here');
  lines.push('');
  lines.push('    while (1) {');
  lines.push('        vTaskDelay(pdMS_TO_TICKS(1000));');
  lines.push('    }');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

/**
 * Generate the idf.py set-target command for a given target.
 */
export function generateSetTargetCommand(target: EspTarget): string {
  return `idf.py set-target ${target}`;
}

/**
 * Generate common idf.py commands for a project.
 */
export function generateBuildCommands(target: EspTarget, port?: string): Record<string, string> {
  const commands: Record<string, string> = {
    'set-target': `idf.py set-target ${target}`,
    'menuconfig': 'idf.py menuconfig',
    'build': 'idf.py build',
    'flash': port ? `idf.py -p ${port} flash` : 'idf.py flash',
    'monitor': port ? `idf.py -p ${port} monitor` : 'idf.py monitor',
    'flash-monitor': port ? `idf.py -p ${port} flash monitor` : 'idf.py flash monitor',
    'clean': 'idf.py fullclean',
    'size': 'idf.py size',
    'size-components': 'idf.py size-components',
    'erase-flash': port ? `idf.py -p ${port} erase-flash` : 'idf.py erase-flash',
  };
  return commands;
}

// ---------------------------------------------------------------------------
// EspIdfManager — singleton + subscribe
// ---------------------------------------------------------------------------

export type EspIdfListener = (project: EspIdfProject | null) => void;

export class EspIdfManager {
  private static instance: EspIdfManager | null = null;

  private projects: Map<string, EspIdfProject> = new Map();
  private activeProjectName: string | null = null;
  private listeners: Set<EspIdfListener> = new Set();

  private constructor() {
    // singleton
  }

  static getInstance(): EspIdfManager {
    if (!EspIdfManager.instance) {
      EspIdfManager.instance = new EspIdfManager();
    }
    return EspIdfManager.instance;
  }

  static resetInstance(): void {
    EspIdfManager.instance = null;
  }

  // -- Subscribe ---

  subscribe(listener: EspIdfListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    const project = this.getActiveProject();
    this.listeners.forEach((listener) => listener(project));
  }

  // -- Project management ---

  createProject(
    name: string,
    target: EspTarget,
    options?: {
      idfVersion?: string;
      path?: string;
      components?: string[];
      partitionTable?: PartitionEntry[];
    },
  ): EspIdfProject {
    const components = options?.components ?? ['driver', 'nvs_flash'];
    const sdkConfig = new Map<string, string>();

    // Set defaults from SDK_CONFIG_OPTIONS
    for (const opt of SDK_CONFIG_OPTIONS) {
      sdkConfig.set(opt.key, opt.defaultValue);
    }

    // Set flash size based on target
    const targetInfo = ESP_TARGETS[target];
    sdkConfig.set('CONFIG_ESPTOOLPY_FLASHSIZE', targetInfo.defaultFlashSize);

    const project: EspIdfProject = {
      name,
      target,
      idfVersion: options?.idfVersion ?? '5.2',
      path: options?.path ?? `/projects/${name}`,
      components,
      sdkConfig,
      partitionTable: options?.partitionTable ?? [...DEFAULT_PARTITION_TABLE],
      createdAt: Date.now(),
    };

    this.projects.set(name, project);
    this.activeProjectName = name;
    this.notify();

    return project;
  }

  deleteProject(name: string): boolean {
    const deleted = this.projects.delete(name);
    if (deleted && this.activeProjectName === name) {
      this.activeProjectName = null;
      this.notify();
    }
    return deleted;
  }

  getProject(name: string): EspIdfProject | null {
    return this.projects.get(name) ?? null;
  }

  getActiveProject(): EspIdfProject | null {
    if (!this.activeProjectName) {
      return null;
    }
    return this.projects.get(this.activeProjectName) ?? null;
  }

  setActiveProject(name: string): boolean {
    if (!this.projects.has(name)) {
      return false;
    }
    this.activeProjectName = name;
    this.notify();
    return true;
  }

  listProjects(): EspIdfProject[] {
    return Array.from(this.projects.values());
  }

  // -- Target info ---

  getTargetInfo(target: EspTarget): EspTargetInfo {
    return ESP_TARGETS[target];
  }

  listTargets(): EspTargetInfo[] {
    return Object.values(ESP_TARGETS);
  }

  getTargetsWithWifi(): EspTargetInfo[] {
    return Object.values(ESP_TARGETS).filter((t) => t.hasWifi);
  }

  getTargetsWithBle(): EspTargetInfo[] {
    return Object.values(ESP_TARGETS).filter((t) => t.hasBle);
  }

  getTargetsWithUsb(): EspTargetInfo[] {
    return Object.values(ESP_TARGETS).filter((t) => t.hasUsb);
  }

  // -- Component management ---

  addComponent(projectName: string, componentName: string): boolean {
    const project = this.projects.get(projectName);
    if (!project) {
      return false;
    }

    if (project.components.includes(componentName)) {
      return false;
    }

    // Also add required dependencies
    const component = IDF_COMPONENTS.find((c) => c.name === componentName);
    if (component) {
      for (const req of component.requires) {
        if (!project.components.includes(req)) {
          project.components.push(req);
        }
      }
    }

    project.components.push(componentName);
    this.notify();
    return true;
  }

  removeComponent(projectName: string, componentName: string): boolean {
    const project = this.projects.get(projectName);
    if (!project) {
      return false;
    }

    const idx = project.components.indexOf(componentName);
    if (idx === -1) {
      return false;
    }

    project.components.splice(idx, 1);
    this.notify();
    return true;
  }

  getAvailableComponents(): IdfComponent[] {
    return [...IDF_COMPONENTS];
  }

  getComponentInfo(name: string): IdfComponent | null {
    return IDF_COMPONENTS.find((c) => c.name === name) ?? null;
  }

  // -- SDK config ---

  setSdkConfigValue(projectName: string, key: string, value: string): boolean {
    const project = this.projects.get(projectName);
    if (!project) {
      return false;
    }
    project.sdkConfig.set(key, value);
    this.notify();
    return true;
  }

  getSdkConfigValue(projectName: string, key: string): string | null {
    const project = this.projects.get(projectName);
    if (!project) {
      return null;
    }
    return project.sdkConfig.get(key) ?? null;
  }

  getAvailableSdkConfigOptions(): SdkConfigOption[] {
    return [...SDK_CONFIG_OPTIONS];
  }

  // -- Partition table ---

  setPartitionTable(projectName: string, entries: PartitionEntry[]): boolean {
    const project = this.projects.get(projectName);
    if (!project) {
      return false;
    }
    project.partitionTable = entries;
    this.notify();
    return true;
  }

  getDefaultPartitionTable(): PartitionEntry[] {
    return [...DEFAULT_PARTITION_TABLE];
  }

  getOtaPartitionTable(): PartitionEntry[] {
    return [...OTA_PARTITION_TABLE];
  }

  validateProjectPartitions(projectName: string): PartitionValidationResult | null {
    const project = this.projects.get(projectName);
    if (!project) {
      return null;
    }

    const targetInfo = ESP_TARGETS[project.target];
    const flashSizeStr = project.sdkConfig.get('CONFIG_ESPTOOLPY_FLASHSIZE') ?? targetInfo.defaultFlashSize;
    const flashSizeBytes = parseSizeToBytes(flashSizeStr);

    return validatePartitionTable(project.partitionTable, flashSizeBytes);
  }

  // -- File generation ---

  generateProjectFiles(projectName: string): Record<string, string> | null {
    const project = this.projects.get(projectName);
    if (!project) {
      return null;
    }

    const files: Record<string, string> = {};

    // Project CMakeLists.txt
    files['CMakeLists.txt'] = generateProjectCMakeLists(project.name);

    // Main component CMakeLists.txt
    files['main/CMakeLists.txt'] = generateComponentCMakeLists(
      ['main.c'],
      project.components,
    );

    // main.c
    files['main/main.c'] = generateMainC(project.target, project.components);

    // sdkconfig.defaults
    files['sdkconfig.defaults'] = generateSdkConfig(project.sdkConfig);

    // Partition table
    files['partitions.csv'] = generatePartitionTableCsv(project.partitionTable);

    return files;
  }

  generateBuildCommandsForProject(projectName: string, port?: string): Record<string, string> | null {
    const project = this.projects.get(projectName);
    if (!project) {
      return null;
    }
    return generateBuildCommands(project.target, port);
  }
}
