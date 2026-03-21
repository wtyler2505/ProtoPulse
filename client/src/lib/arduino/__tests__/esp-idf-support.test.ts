import { describe, it, expect, beforeEach } from 'vitest';
import {
  EspIdfManager,
  ESP_TARGETS,
  IDF_COMPONENTS,
  SDK_CONFIG_OPTIONS,
  generateProjectCMakeLists,
  generateComponentCMakeLists,
  generatePartitionTableCsv,
  parsePartitionTableCsv,
  parseSizeToBytes,
  validatePartitionTable,
  generateSdkConfig,
  parseSdkConfig,
  generateMainC,
  generateSetTargetCommand,
  generateBuildCommands,
} from '../esp-idf-support';
import type {
  EspTarget,
  PartitionEntry,
  EspIdfProject,
} from '../esp-idf-support';

// ---------------------------------------------------------------------------
// ESP_TARGETS
// ---------------------------------------------------------------------------

describe('ESP_TARGETS', () => {
  it('contains 6 targets', () => {
    const keys = Object.keys(ESP_TARGETS);
    expect(keys).toHaveLength(6);
    expect(keys).toContain('esp32');
    expect(keys).toContain('esp32s2');
    expect(keys).toContain('esp32s3');
    expect(keys).toContain('esp32c3');
    expect(keys).toContain('esp32c6');
    expect(keys).toContain('esp32h2');
  });

  it('each target has required fields', () => {
    for (const [key, info] of Object.entries(ESP_TARGETS)) {
      expect(info.target).toBe(key);
      expect(info.name.length).toBeGreaterThan(0);
      expect(info.arch.length).toBeGreaterThan(0);
      expect(info.cores).toBeGreaterThanOrEqual(1);
      expect(info.maxFlash).toBeGreaterThan(0);
      expect(info.defaultFlashSize.length).toBeGreaterThan(0);
      expect(info.openocdTarget.length).toBeGreaterThan(0);
      expect(info.description.length).toBeGreaterThan(0);
    }
  });

  it('ESP32 has dual cores, Wi-Fi, BLE, no USB', () => {
    const esp32 = ESP_TARGETS.esp32;
    expect(esp32.cores).toBe(2);
    expect(esp32.hasWifi).toBe(true);
    expect(esp32.hasBle).toBe(true);
    expect(esp32.hasUsb).toBe(false);
    expect(esp32.arch).toBe('xtensa-lx6');
  });

  it('ESP32-S3 has dual cores, Wi-Fi, BLE, USB', () => {
    const s3 = ESP_TARGETS.esp32s3;
    expect(s3.cores).toBe(2);
    expect(s3.hasWifi).toBe(true);
    expect(s3.hasBle).toBe(true);
    expect(s3.hasUsb).toBe(true);
  });

  it('ESP32-S2 has no BLE', () => {
    expect(ESP_TARGETS.esp32s2.hasBle).toBe(false);
    expect(ESP_TARGETS.esp32s2.hasUsb).toBe(true);
  });

  it('ESP32-H2 has no Wi-Fi', () => {
    expect(ESP_TARGETS.esp32h2.hasWifi).toBe(false);
    expect(ESP_TARGETS.esp32h2.hasBle).toBe(true);
  });

  it('ESP32-C3 and C6 use RISC-V architecture', () => {
    expect(ESP_TARGETS.esp32c3.arch).toContain('riscv');
    expect(ESP_TARGETS.esp32c6.arch).toContain('riscv');
  });

  it('ESP32-C6 has Wi-Fi 6 (mentioned in description)', () => {
    expect(ESP_TARGETS.esp32c6.description).toContain('Wi-Fi 6');
  });
});

// ---------------------------------------------------------------------------
// IDF_COMPONENTS
// ---------------------------------------------------------------------------

describe('IDF_COMPONENTS', () => {
  it('contains at least 15 components', () => {
    expect(IDF_COMPONENTS.length).toBeGreaterThanOrEqual(15);
  });

  it('each component has name and description', () => {
    for (const comp of IDF_COMPONENTS) {
      expect(comp.name.length).toBeGreaterThan(0);
      expect(comp.description.length).toBeGreaterThan(0);
      expect(Array.isArray(comp.requires)).toBe(true);
    }
  });

  it('esp_wifi requires esp_event, esp_netif, nvs_flash', () => {
    const wifi = IDF_COMPONENTS.find((c) => c.name === 'esp_wifi');
    expect(wifi).toBeDefined();
    expect(wifi!.requires).toContain('esp_event');
    expect(wifi!.requires).toContain('esp_netif');
    expect(wifi!.requires).toContain('nvs_flash');
  });

  it('driver has no requires', () => {
    const driver = IDF_COMPONENTS.find((c) => c.name === 'driver');
    expect(driver).toBeDefined();
    expect(driver!.requires).toHaveLength(0);
  });

  it('mqtt requires esp_event and esp_tls', () => {
    const mqtt = IDF_COMPONENTS.find((c) => c.name === 'mqtt');
    expect(mqtt).toBeDefined();
    expect(mqtt!.requires).toContain('esp_event');
    expect(mqtt!.requires).toContain('esp_tls');
  });
});

// ---------------------------------------------------------------------------
// SDK_CONFIG_OPTIONS
// ---------------------------------------------------------------------------

describe('SDK_CONFIG_OPTIONS', () => {
  it('contains at least 20 options', () => {
    expect(SDK_CONFIG_OPTIONS.length).toBeGreaterThanOrEqual(20);
  });

  it('each option has key, defaultValue, description, type', () => {
    for (const opt of SDK_CONFIG_OPTIONS) {
      expect(opt.key.startsWith('CONFIG_')).toBe(true);
      expect(opt.defaultValue.length).toBeGreaterThan(0);
      expect(opt.description.length).toBeGreaterThan(0);
      expect(['bool', 'int', 'hex', 'string', 'choice']).toContain(opt.type);
    }
  });

  it('choice options have choices array', () => {
    const choiceOpts = SDK_CONFIG_OPTIONS.filter((o) => o.type === 'choice');
    expect(choiceOpts.length).toBeGreaterThan(0);
    for (const opt of choiceOpts) {
      expect(opt.choices).toBeDefined();
      expect(opt.choices!.length).toBeGreaterThan(0);
    }
  });

  it('CONFIG_ESPTOOLPY_FLASHSIZE has valid choices', () => {
    const opt = SDK_CONFIG_OPTIONS.find((o) => o.key === 'CONFIG_ESPTOOLPY_FLASHSIZE');
    expect(opt).toBeDefined();
    expect(opt!.choices).toContain('4MB');
    expect(opt!.choices).toContain('8MB');
  });
});

// ---------------------------------------------------------------------------
// parseSizeToBytes
// ---------------------------------------------------------------------------

describe('parseSizeToBytes', () => {
  it('parses decimal bytes', () => {
    expect(parseSizeToBytes('4096')).toBe(4096);
  });

  it('parses hex values', () => {
    expect(parseSizeToBytes('0x10000')).toBe(65536);
    expect(parseSizeToBytes('0x9000')).toBe(0x9000);
  });

  it('parses kilobytes', () => {
    expect(parseSizeToBytes('64K')).toBe(65536);
    expect(parseSizeToBytes('4k')).toBe(4096);
  });

  it('parses megabytes', () => {
    expect(parseSizeToBytes('4M')).toBe(4194304);
    expect(parseSizeToBytes('1m')).toBe(1048576);
  });
});

// ---------------------------------------------------------------------------
// CMakeLists generation
// ---------------------------------------------------------------------------

describe('generateProjectCMakeLists', () => {
  it('generates valid CMakeLists with project name', () => {
    const output = generateProjectCMakeLists('my_project');
    expect(output).toContain('cmake_minimum_required(VERSION 3.16)');
    expect(output).toContain('project(my_project)');
    expect(output).toContain('include($ENV{IDF_PATH}/tools/cmake/project.cmake)');
  });

  it('uses custom minimum version', () => {
    const output = generateProjectCMakeLists('test', { minimumVersion: '3.20' });
    expect(output).toContain('VERSION 3.20');
  });

  it('includes extra component directories', () => {
    const output = generateProjectCMakeLists('test', { extraComponents: ['../shared', '../drivers'] });
    expect(output).toContain('EXTRA_COMPONENT_DIRS ../shared ../drivers');
  });

  it('includes extra flags', () => {
    const output = generateProjectCMakeLists('test', { extraFlags: ['set(CMAKE_C_FLAGS "-Wall")'] });
    expect(output).toContain('set(CMAKE_C_FLAGS "-Wall")');
  });
});

describe('generateComponentCMakeLists', () => {
  it('generates component registration', () => {
    const output = generateComponentCMakeLists(['main.c'], ['driver', 'nvs_flash']);
    expect(output).toContain('idf_component_register(');
    expect(output).toContain('SRCS "main.c"');
    expect(output).toContain('REQUIRES driver nvs_flash');
  });

  it('handles multiple sources', () => {
    const output = generateComponentCMakeLists(['main.c', 'wifi.c', 'http.c'], []);
    expect(output).toContain('"main.c" "wifi.c" "http.c"');
  });

  it('includes custom include dirs', () => {
    const output = generateComponentCMakeLists(['main.c'], [], ['include', 'generated']);
    expect(output).toContain('INCLUDE_DIRS "include" "generated"');
  });

  it('omits REQUIRES when empty', () => {
    const output = generateComponentCMakeLists(['main.c'], []);
    expect(output).not.toContain('REQUIRES');
  });
});

// ---------------------------------------------------------------------------
// Partition table
// ---------------------------------------------------------------------------

describe('generatePartitionTableCsv', () => {
  it('generates valid CSV with header', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const csv = generatePartitionTableCsv(entries);
    expect(csv).toContain('# Name');
    expect(csv).toContain('nvs, data, nvs, 0x9000, 0x6000,');
    expect(csv).toContain('factory, app, factory, 0x10000, 1M,');
  });
});

describe('parsePartitionTableCsv', () => {
  it('parses a partition table CSV', () => {
    const csv = `# Name, Type, SubType, Offset, Size, Flags
nvs, data, nvs, 0x9000, 0x6000,
factory, app, factory, 0x10000, 1M,`;
    const entries = parsePartitionTableCsv(csv);
    expect(entries).toHaveLength(2);
    expect(entries[0].name).toBe('nvs');
    expect(entries[0].type).toBe('data');
    expect(entries[1].name).toBe('factory');
    expect(entries[1].size).toBe('1M');
  });

  it('skips comments and empty lines', () => {
    const csv = `# comment

nvs, data, nvs, 0x9000, 0x6000,`;
    const entries = parsePartitionTableCsv(csv);
    expect(entries).toHaveLength(1);
  });

  it('skips lines with too few columns', () => {
    const csv = 'nvs, data, nvs';
    const entries = parsePartitionTableCsv(csv);
    expect(entries).toHaveLength(0);
  });

  it('round-trips with generatePartitionTableCsv', () => {
    const original: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const csv = generatePartitionTableCsv(original);
    const parsed = parsePartitionTableCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].name).toBe('nvs');
    expect(parsed[1].name).toBe('factory');
  });
});

describe('validatePartitionTable', () => {
  const FLASH_4MB = 4 * 1024 * 1024;

  it('validates a valid default table', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
      { name: 'phy_init', type: 'data', subType: 'phy', offset: '0xf000', size: '0x1000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('detects empty partition table', () => {
    const result = validatePartitionTable([], FLASH_4MB);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
  });

  it('detects duplicate names', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x10000', size: '0x6000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x20000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate'))).toBe(true);
  });

  it('detects missing app partition', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('app partition'))).toBe(true);
  });

  it('detects overlapping partitions', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x10000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('overlaps'))).toBe(true);
  });

  it('detects exceeding flash size', () => {
    const entries: PartitionEntry[] = [
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '8M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('exceeds flash'))).toBe(true);
  });

  it('warns about missing NVS', () => {
    const entries: PartitionEntry[] = [
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.warnings.some((w) => w.includes('NVS'))).toBe(true);
  });

  it('warns about small NVS', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x1000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.warnings.some((w) => w.includes('smaller than'))).toBe(true);
  });

  it('warns about single OTA partition', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
      { name: 'ota_0', type: 'app', subType: 'ota_0', offset: '0x10000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.warnings.some((w) => w.includes('OTA'))).toBe(true);
  });

  it('calculates total size', () => {
    const entries: PartitionEntry[] = [
      { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.totalSize).toBe(0x6000 + 1048576);
  });

  it('detects invalid partition type', () => {
    const entries: PartitionEntry[] = [
      { name: 'bad', type: 'unknown' as PartitionEntry['type'], subType: 'x', offset: '0x9000', size: '0x6000', flags: '' },
      { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '1M', flags: '' },
    ];
    const result = validatePartitionTable(entries, FLASH_4MB);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid partition type'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// sdkconfig generation/parsing
// ---------------------------------------------------------------------------

describe('generateSdkConfig', () => {
  it('generates config with bool/string/int values', () => {
    const config = new Map<string, string>([
      ['CONFIG_ESP_TASK_WDT_EN', 'y'],
      ['CONFIG_ESP_WIFI_SSID', 'TestNet'],
      ['CONFIG_FREERTOS_HZ', '1000'],
    ]);
    const output = generateSdkConfig(config);
    expect(output).toContain('CONFIG_ESP_TASK_WDT_EN=y');
    expect(output).toContain('CONFIG_ESP_WIFI_SSID="TestNet"');
    expect(output).toContain('CONFIG_FREERTOS_HZ=1000');
  });

  it('generates "not set" for n values', () => {
    const config = new Map([['CONFIG_PARTITION_TABLE_CUSTOM', 'n']]);
    const output = generateSdkConfig(config);
    expect(output).toContain('# CONFIG_PARTITION_TABLE_CUSTOM is not set');
  });

  it('generates hex values unquoted', () => {
    const config = new Map([['CONFIG_SOME_HEX', '0xFF00']]);
    const output = generateSdkConfig(config);
    expect(output).toContain('CONFIG_SOME_HEX=0xFF00');
  });

  it('generates choice values unquoted', () => {
    const config = new Map([['CONFIG_ESP_SYSTEM_PANIC', 'CONFIG_ESP_SYSTEM_PANIC_PRINT_REBOOT']]);
    const output = generateSdkConfig(config);
    expect(output).toContain('CONFIG_ESP_SYSTEM_PANIC=CONFIG_ESP_SYSTEM_PANIC_PRINT_REBOOT');
  });

  it('includes header comment', () => {
    const config = new Map<string, string>();
    const output = generateSdkConfig(config);
    expect(output).toContain('Auto-generated by ProtoPulse');
  });
});

describe('parseSdkConfig', () => {
  it('parses key=value pairs', () => {
    const config = parseSdkConfig('CONFIG_FREERTOS_HZ=1000\nCONFIG_ESP_TASK_WDT_EN=y');
    expect(config.get('CONFIG_FREERTOS_HZ')).toBe('1000');
    expect(config.get('CONFIG_ESP_TASK_WDT_EN')).toBe('y');
  });

  it('parses "not set" comments', () => {
    const config = parseSdkConfig('# CONFIG_PARTITION_TABLE_CUSTOM is not set');
    expect(config.get('CONFIG_PARTITION_TABLE_CUSTOM')).toBe('n');
  });

  it('strips quotes from string values', () => {
    const config = parseSdkConfig('CONFIG_ESP_WIFI_SSID="MyNetwork"');
    expect(config.get('CONFIG_ESP_WIFI_SSID')).toBe('MyNetwork');
  });

  it('skips comments and empty lines', () => {
    const config = parseSdkConfig('# comment\n\nCONFIG_X=1');
    expect(config.size).toBe(1);
    expect(config.get('CONFIG_X')).toBe('1');
  });

  it('round-trips with generateSdkConfig', () => {
    const original = new Map([
      ['CONFIG_A', 'y'],
      ['CONFIG_B', 'n'],
      ['CONFIG_C', 'hello'],
      ['CONFIG_D', '42'],
    ]);
    const generated = generateSdkConfig(original);
    const parsed = parseSdkConfig(generated);
    expect(parsed.get('CONFIG_A')).toBe('y');
    expect(parsed.get('CONFIG_B')).toBe('n');
    expect(parsed.get('CONFIG_C')).toBe('hello');
    expect(parsed.get('CONFIG_D')).toBe('42');
  });
});

// ---------------------------------------------------------------------------
// Main C generation
// ---------------------------------------------------------------------------

describe('generateMainC', () => {
  it('generates basic main.c with freertos includes', () => {
    const code = generateMainC('esp32', []);
    expect(code).toContain('#include "freertos/FreeRTOS.h"');
    expect(code).toContain('#include "freertos/task.h"');
    expect(code).toContain('void app_main(void)');
    expect(code).toContain('vTaskDelay');
  });

  it('includes target name in comment', () => {
    const code = generateMainC('esp32s3', []);
    expect(code).toContain('ESP32-S3');
  });

  it('includes NVS init when nvs_flash component present', () => {
    const code = generateMainC('esp32', ['nvs_flash']);
    expect(code).toContain('#include "nvs_flash.h"');
    expect(code).toContain('init_nvs()');
    expect(code).toContain('nvs_flash_init()');
  });

  it('includes Wi-Fi init when esp_wifi component present', () => {
    const code = generateMainC('esp32', ['esp_wifi']);
    expect(code).toContain('#include "esp_wifi.h"');
    expect(code).toContain('#include "esp_event.h"');
    expect(code).toContain('esp_netif_init()');
    expect(code).toContain('esp_event_loop_create_default()');
  });

  it('includes GPIO header when driver component present', () => {
    const code = generateMainC('esp32', ['driver']);
    expect(code).toContain('#include "driver/gpio.h"');
  });

  it('includes HTTP server header when esp_http_server present', () => {
    const code = generateMainC('esp32', ['esp_http_server']);
    expect(code).toContain('#include "esp_http_server.h"');
  });

  it('includes MQTT header when mqtt present', () => {
    const code = generateMainC('esp32', ['mqtt']);
    expect(code).toContain('#include "mqtt_client.h"');
  });

  it('includes BT header when bt present', () => {
    const code = generateMainC('esp32', ['bt']);
    expect(code).toContain('#include "esp_bt.h"');
  });

  it('includes ADC header when esp_adc present', () => {
    const code = generateMainC('esp32', ['esp_adc']);
    expect(code).toContain('#include "esp_adc/adc_oneshot.h"');
  });
});

// ---------------------------------------------------------------------------
// Build commands
// ---------------------------------------------------------------------------

describe('generateSetTargetCommand', () => {
  it('generates set-target for esp32', () => {
    expect(generateSetTargetCommand('esp32')).toBe('idf.py set-target esp32');
  });

  it('generates set-target for esp32c3', () => {
    expect(generateSetTargetCommand('esp32c3')).toBe('idf.py set-target esp32c3');
  });
});

describe('generateBuildCommands', () => {
  it('generates all standard commands', () => {
    const cmds = generateBuildCommands('esp32');
    expect(cmds['set-target']).toBe('idf.py set-target esp32');
    expect(cmds['build']).toBe('idf.py build');
    expect(cmds['flash']).toBe('idf.py flash');
    expect(cmds['monitor']).toBe('idf.py monitor');
    expect(cmds['clean']).toBe('idf.py fullclean');
    expect(cmds['menuconfig']).toBe('idf.py menuconfig');
    expect(cmds['size']).toBe('idf.py size');
  });

  it('includes port when specified', () => {
    const cmds = generateBuildCommands('esp32', '/dev/ttyUSB0');
    expect(cmds['flash']).toBe('idf.py -p /dev/ttyUSB0 flash');
    expect(cmds['monitor']).toBe('idf.py -p /dev/ttyUSB0 monitor');
    expect(cmds['flash-monitor']).toBe('idf.py -p /dev/ttyUSB0 flash monitor');
    expect(cmds['erase-flash']).toBe('idf.py -p /dev/ttyUSB0 erase-flash');
  });
});

// ---------------------------------------------------------------------------
// EspIdfManager — singleton
// ---------------------------------------------------------------------------

describe('EspIdfManager', () => {
  let mgr: EspIdfManager;

  beforeEach(() => {
    EspIdfManager.resetInstance();
    mgr = EspIdfManager.getInstance();
  });

  it('is a singleton', () => {
    const mgr2 = EspIdfManager.getInstance();
    expect(mgr).toBe(mgr2);
  });

  // -- Project management ---

  describe('project management', () => {
    it('creates a project with defaults', () => {
      const project = mgr.createProject('test', 'esp32');
      expect(project.name).toBe('test');
      expect(project.target).toBe('esp32');
      expect(project.idfVersion).toBe('5.2');
      expect(project.components).toContain('driver');
      expect(project.components).toContain('nvs_flash');
      expect(project.partitionTable.length).toBeGreaterThan(0);
    });

    it('creates a project with custom options', () => {
      const project = mgr.createProject('custom', 'esp32s3', {
        idfVersion: '5.1',
        path: '/home/user/custom',
        components: ['esp_wifi', 'mqtt'],
      });
      expect(project.idfVersion).toBe('5.1');
      expect(project.path).toBe('/home/user/custom');
      expect(project.components).toContain('esp_wifi');
    });

    it('sets the created project as active', () => {
      mgr.createProject('test', 'esp32');
      const active = mgr.getActiveProject();
      expect(active).not.toBeNull();
      expect(active!.name).toBe('test');
    });

    it('gets project by name', () => {
      mgr.createProject('test', 'esp32');
      const project = mgr.getProject('test');
      expect(project).not.toBeNull();
      expect(project!.name).toBe('test');
    });

    it('returns null for unknown project', () => {
      expect(mgr.getProject('unknown')).toBeNull();
    });

    it('deletes a project', () => {
      mgr.createProject('test', 'esp32');
      expect(mgr.deleteProject('test')).toBe(true);
      expect(mgr.getProject('test')).toBeNull();
      expect(mgr.getActiveProject()).toBeNull();
    });

    it('deleteProject returns false for unknown', () => {
      expect(mgr.deleteProject('unknown')).toBe(false);
    });

    it('lists all projects', () => {
      mgr.createProject('a', 'esp32');
      mgr.createProject('b', 'esp32c3');
      expect(mgr.listProjects()).toHaveLength(2);
    });

    it('sets active project', () => {
      mgr.createProject('a', 'esp32');
      mgr.createProject('b', 'esp32s3');
      expect(mgr.setActiveProject('a')).toBe(true);
      expect(mgr.getActiveProject()!.name).toBe('a');
    });

    it('setActiveProject returns false for unknown', () => {
      expect(mgr.setActiveProject('unknown')).toBe(false);
    });

    it('notifies listeners on project changes', () => {
      const events: Array<EspIdfProject | null> = [];
      mgr.subscribe((p) => events.push(p));
      mgr.createProject('test', 'esp32');
      expect(events).toHaveLength(1);
      expect(events[0]!.name).toBe('test');
    });

    it('unsubscribe stops notifications', () => {
      const events: Array<EspIdfProject | null> = [];
      const unsub = mgr.subscribe((p) => events.push(p));
      unsub();
      mgr.createProject('test', 'esp32');
      expect(events).toHaveLength(0);
    });

    it('sets flash size from target default', () => {
      const project = mgr.createProject('test', 'esp32s3');
      expect(project.sdkConfig.get('CONFIG_ESPTOOLPY_FLASHSIZE')).toBe('8MB');
    });
  });

  // -- Target info ---

  describe('target info', () => {
    it('getTargetInfo returns correct info', () => {
      const info = mgr.getTargetInfo('esp32c3');
      expect(info.name).toBe('ESP32-C3');
      expect(info.arch).toContain('riscv');
    });

    it('listTargets returns all 6', () => {
      expect(mgr.listTargets()).toHaveLength(6);
    });

    it('getTargetsWithWifi excludes ESP32-H2', () => {
      const targets = mgr.getTargetsWithWifi();
      expect(targets.every((t) => t.target !== 'esp32h2')).toBe(true);
      expect(targets.length).toBe(5);
    });

    it('getTargetsWithBle includes 5 targets (excludes S2)', () => {
      const targets = mgr.getTargetsWithBle();
      expect(targets.every((t) => t.target !== 'esp32s2')).toBe(true);
      expect(targets.length).toBe(5);
    });

    it('getTargetsWithUsb returns S2 and S3 only', () => {
      const targets = mgr.getTargetsWithUsb();
      expect(targets).toHaveLength(2);
      const names = targets.map((t) => t.target);
      expect(names).toContain('esp32s2');
      expect(names).toContain('esp32s3');
    });
  });

  // -- Component management ---

  describe('component management', () => {
    beforeEach(() => {
      mgr.createProject('test', 'esp32');
    });

    it('adds a component', () => {
      expect(mgr.addComponent('test', 'esp_wifi')).toBe(true);
      const project = mgr.getProject('test')!;
      expect(project.components).toContain('esp_wifi');
    });

    it('adds required dependencies automatically', () => {
      mgr.addComponent('test', 'esp_wifi');
      const project = mgr.getProject('test')!;
      expect(project.components).toContain('esp_event');
      expect(project.components).toContain('esp_netif');
    });

    it('rejects duplicate component', () => {
      expect(mgr.addComponent('test', 'driver')).toBe(false);
    });

    it('returns false for unknown project', () => {
      expect(mgr.addComponent('unknown', 'esp_wifi')).toBe(false);
    });

    it('removes a component', () => {
      expect(mgr.removeComponent('test', 'driver')).toBe(true);
      expect(mgr.getProject('test')!.components).not.toContain('driver');
    });

    it('removeComponent returns false for unknown component', () => {
      expect(mgr.removeComponent('test', 'nonexistent')).toBe(false);
    });

    it('removeComponent returns false for unknown project', () => {
      expect(mgr.removeComponent('unknown', 'driver')).toBe(false);
    });

    it('getAvailableComponents returns all', () => {
      expect(mgr.getAvailableComponents().length).toBeGreaterThanOrEqual(15);
    });

    it('getComponentInfo returns info for known component', () => {
      const info = mgr.getComponentInfo('esp_wifi');
      expect(info).not.toBeNull();
      expect(info!.description).toContain('Wi-Fi');
    });

    it('getComponentInfo returns null for unknown', () => {
      expect(mgr.getComponentInfo('nonexistent')).toBeNull();
    });
  });

  // -- SDK config ---

  describe('SDK config', () => {
    beforeEach(() => {
      mgr.createProject('test', 'esp32');
    });

    it('sets a config value', () => {
      expect(mgr.setSdkConfigValue('test', 'CONFIG_ESP_WIFI_SSID', 'MyNet')).toBe(true);
      expect(mgr.getSdkConfigValue('test', 'CONFIG_ESP_WIFI_SSID')).toBe('MyNet');
    });

    it('returns false for unknown project', () => {
      expect(mgr.setSdkConfigValue('unknown', 'CONFIG_X', 'y')).toBe(false);
    });

    it('getSdkConfigValue returns null for unknown project', () => {
      expect(mgr.getSdkConfigValue('unknown', 'CONFIG_X')).toBeNull();
    });

    it('getSdkConfigValue returns null for unset key', () => {
      expect(mgr.getSdkConfigValue('test', 'CONFIG_NONEXISTENT')).toBeNull();
    });

    it('getAvailableSdkConfigOptions returns all options', () => {
      expect(mgr.getAvailableSdkConfigOptions().length).toBeGreaterThanOrEqual(20);
    });
  });

  // -- Partition table ---

  describe('partition table', () => {
    beforeEach(() => {
      mgr.createProject('test', 'esp32');
    });

    it('sets custom partition table', () => {
      const entries: PartitionEntry[] = [
        { name: 'nvs', type: 'data', subType: 'nvs', offset: '0x9000', size: '0x6000', flags: '' },
        { name: 'app', type: 'app', subType: 'factory', offset: '0x10000', size: '2M', flags: '' },
      ];
      expect(mgr.setPartitionTable('test', entries)).toBe(true);
      expect(mgr.getProject('test')!.partitionTable).toHaveLength(2);
    });

    it('setPartitionTable returns false for unknown project', () => {
      expect(mgr.setPartitionTable('unknown', [])).toBe(false);
    });

    it('getDefaultPartitionTable returns default entries', () => {
      const table = mgr.getDefaultPartitionTable();
      expect(table.length).toBeGreaterThan(0);
      expect(table.some((e) => e.subType === 'nvs')).toBe(true);
      expect(table.some((e) => e.subType === 'factory')).toBe(true);
    });

    it('getOtaPartitionTable returns OTA entries', () => {
      const table = mgr.getOtaPartitionTable();
      expect(table.some((e) => e.subType === 'ota')).toBe(true);
      expect(table.some((e) => e.subType === 'ota_0')).toBe(true);
      expect(table.some((e) => e.subType === 'ota_1')).toBe(true);
    });

    it('validateProjectPartitions validates current partition table', () => {
      const result = mgr.validateProjectPartitions('test');
      expect(result).not.toBeNull();
      expect(result!.valid).toBe(true);
    });

    it('validateProjectPartitions returns null for unknown project', () => {
      expect(mgr.validateProjectPartitions('unknown')).toBeNull();
    });

    it('uses target flash size for validation', () => {
      // Set an oversized partition for ESP32-H2 (4MB flash)
      mgr.createProject('h2test', 'esp32h2');
      mgr.setPartitionTable('h2test', [
        { name: 'factory', type: 'app', subType: 'factory', offset: '0x10000', size: '8M', flags: '' },
      ]);
      const result = mgr.validateProjectPartitions('h2test');
      expect(result!.valid).toBe(false);
      expect(result!.errors.some((e) => e.includes('exceeds flash'))).toBe(true);
    });
  });

  // -- File generation ---

  describe('file generation', () => {
    it('generates all project files', () => {
      mgr.createProject('test', 'esp32', { components: ['driver', 'nvs_flash', 'esp_wifi'] });
      const files = mgr.generateProjectFiles('test');
      expect(files).not.toBeNull();
      expect(files!['CMakeLists.txt']).toContain('project(test)');
      expect(files!['main/CMakeLists.txt']).toContain('idf_component_register');
      expect(files!['main/main.c']).toContain('app_main');
      expect(files!['sdkconfig.defaults']).toContain('CONFIG_');
      expect(files!['partitions.csv']).toContain('nvs');
    });

    it('returns null for unknown project', () => {
      expect(mgr.generateProjectFiles('unknown')).toBeNull();
    });

    it('generated main.c matches project components', () => {
      mgr.createProject('wifi_proj', 'esp32', { components: ['esp_wifi', 'nvs_flash'] });
      const files = mgr.generateProjectFiles('wifi_proj');
      expect(files!['main/main.c']).toContain('esp_wifi.h');
      expect(files!['main/main.c']).toContain('nvs_flash.h');
    });

    it('component CMakeLists includes project requires', () => {
      mgr.createProject('test', 'esp32', { components: ['driver', 'nvs_flash'] });
      const files = mgr.generateProjectFiles('test');
      expect(files!['main/CMakeLists.txt']).toContain('REQUIRES driver nvs_flash');
    });
  });

  // -- Build commands ---

  describe('build commands', () => {
    it('generates build commands for active project', () => {
      mgr.createProject('test', 'esp32c3');
      const cmds = mgr.generateBuildCommandsForProject('test', '/dev/ttyUSB0');
      expect(cmds).not.toBeNull();
      expect(cmds!['set-target']).toBe('idf.py set-target esp32c3');
      expect(cmds!['flash']).toContain('/dev/ttyUSB0');
    });

    it('returns null for unknown project', () => {
      expect(mgr.generateBuildCommandsForProject('unknown')).toBeNull();
    });
  });
});
