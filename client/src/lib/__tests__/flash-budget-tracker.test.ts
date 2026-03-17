import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getBudgetLevel,
  getFlashSections,
  parseFlashUsage,
  resolveFlashTotal,
  formatFlashBudget,
  formatFlashSections,
  useFlashBudget,
  KNOWN_FLASH_SIZES,
} from '../flash-budget-tracker';
import type {
  BudgetLevel,
  FlashBudget,
  FlashSection,
  SectionName,
} from '../flash-budget-tracker';
import { renderHook, act } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Test data: compiler output fixtures
// ---------------------------------------------------------------------------

const ARDUINO_UNO_OUTPUT = [
  'Sketch uses 12800 bytes (39%) of program storage space. Maximum is 32256 bytes.',
  'Global variables use 456 bytes (22%) of dynamic memory, leaving 1592 bytes for local variables. Maximum is 2048 bytes.',
].join('\n');

const ARDUINO_MEGA_OUTPUT = [
  'Sketch uses 240000 bytes (94%) of program storage space. Maximum is 253952 bytes.',
  'Global variables use 4096 bytes (50%) of dynamic memory, leaving 4096 bytes for local variables. Maximum is 8192 bytes.',
].join('\n');

const PIO_ESP32_OUTPUT = [
  'RAM:   [==        ]  22.3% (used 456 bytes from 327680 bytes)',
  'FLASH: [========  ]  78.5% (used 1028614 bytes from 1310720 bytes)',
].join('\n');

const BERKELEY_OUTPUT = [
  '   text\t   data\t    bss\t    dec\t    hex\tfilename',
  '  12345\t    456\t    789\t  13590\t   3516\tsketch.ino.elf',
].join('\n');

const MAP_OUTPUT = [
  '.text   0x00000000    0x3039',
  '.data   0x00800100    0x01c8',
  '.bss    0x008002c8    0x0315',
].join('\n');

const EMPTY_OUTPUT = '';

const IRRELEVANT_OUTPUT = 'Compiling sketch...\nLinking...\nDone.\n';

const BERKELEY_ZERO_DATA_BSS = [
  '   text\t   data\t    bss\t    dec\t    hex\tfilename',
  '   4096\t      0\t      0\t   4096\t   1000\tminimal.elf',
].join('\n');

// ---------------------------------------------------------------------------
// getBudgetLevel
// ---------------------------------------------------------------------------

describe('getBudgetLevel', () => {
  it('returns "ok" for 0%', () => {
    expect(getBudgetLevel(0)).toBe('ok');
  });

  it('returns "ok" for 50%', () => {
    expect(getBudgetLevel(50)).toBe('ok');
  });

  it('returns "ok" for 74.99%', () => {
    expect(getBudgetLevel(74.99)).toBe('ok');
  });

  it('returns "warning" for exactly 75%', () => {
    expect(getBudgetLevel(75)).toBe('warning');
  });

  it('returns "warning" for 80%', () => {
    expect(getBudgetLevel(80)).toBe('warning');
  });

  it('returns "warning" for exactly 90%', () => {
    expect(getBudgetLevel(90)).toBe('warning');
  });

  it('returns "critical" for 90.01%', () => {
    expect(getBudgetLevel(90.01)).toBe('critical');
  });

  it('returns "critical" for 95%', () => {
    expect(getBudgetLevel(95)).toBe('critical');
  });

  it('returns "critical" for exactly 100%', () => {
    expect(getBudgetLevel(100)).toBe('critical');
  });

  it('returns "exceeded" for 100.01%', () => {
    expect(getBudgetLevel(100.01)).toBe('exceeded');
  });

  it('returns "exceeded" for 150%', () => {
    expect(getBudgetLevel(150)).toBe('exceeded');
  });

  it('returns "ok" for negative percentage', () => {
    expect(getBudgetLevel(-5)).toBe('ok');
  });
});

// ---------------------------------------------------------------------------
// KNOWN_FLASH_SIZES
// ---------------------------------------------------------------------------

describe('KNOWN_FLASH_SIZES', () => {
  it('has Arduino Uno at 32256 bytes', () => {
    expect(KNOWN_FLASH_SIZES['arduino:avr:uno']).toBe(32256);
  });

  it('has Arduino Mega at 253952 bytes', () => {
    expect(KNOWN_FLASH_SIZES['arduino:avr:mega']).toBe(253952);
  });

  it('has ESP32 at 1310720 bytes', () => {
    expect(KNOWN_FLASH_SIZES['esp32:esp32:esp32']).toBe(1310720);
  });

  it('has short alias "uno" matching FQBN', () => {
    expect(KNOWN_FLASH_SIZES['uno']).toBe(KNOWN_FLASH_SIZES['arduino:avr:uno']);
  });

  it('has short alias "esp32" matching FQBN', () => {
    expect(KNOWN_FLASH_SIZES['esp32']).toBe(KNOWN_FLASH_SIZES['esp32:esp32:esp32']);
  });

  it('has Teensy 4.0', () => {
    expect(KNOWN_FLASH_SIZES['teensy:avr:teensy40']).toBe(2031616);
  });

  it('has Blue Pill STM32', () => {
    expect(KNOWN_FLASH_SIZES['stm32:stm32:bluepill_f103c8']).toBe(65536);
  });
});

// ---------------------------------------------------------------------------
// getFlashSections — Berkeley format
// ---------------------------------------------------------------------------

describe('getFlashSections', () => {
  describe('Berkeley format', () => {
    it('extracts text, data, and bss sections', () => {
      const sections = getFlashSections(BERKELEY_OUTPUT);
      expect(sections).toHaveLength(3);
      expect(sections[0]).toEqual({ name: 'text', bytes: 12345 });
      expect(sections[1]).toEqual({ name: 'data', bytes: 456 });
      expect(sections[2]).toEqual({ name: 'bss', bytes: 789 });
    });

    it('omits zero-byte sections', () => {
      const sections = getFlashSections(BERKELEY_ZERO_DATA_BSS);
      expect(sections).toHaveLength(1);
      expect(sections[0]).toEqual({ name: 'text', bytes: 4096 });
    });
  });

  describe('GCC map format', () => {
    it('extracts text, data, and bss from map output', () => {
      const sections = getFlashSections(MAP_OUTPUT);
      expect(sections).toHaveLength(3);
      // 0x3039 = 12345
      expect(sections[0]).toEqual({ name: 'text', bytes: 0x3039 });
      // 0x01c8 = 456
      expect(sections[1]).toEqual({ name: 'data', bytes: 0x01c8 });
      // 0x0315 = 789
      expect(sections[2]).toEqual({ name: 'bss', bytes: 0x0315 });
    });

    it('handles partial map output (text only)', () => {
      const output = '.text   0x00000000    0x1000';
      const sections = getFlashSections(output);
      expect(sections).toHaveLength(1);
      expect(sections[0]).toEqual({ name: 'text', bytes: 0x1000 });
    });
  });

  describe('edge cases', () => {
    it('returns empty array for empty string', () => {
      expect(getFlashSections(EMPTY_OUTPUT)).toEqual([]);
    });

    it('returns empty array for irrelevant output', () => {
      expect(getFlashSections(IRRELEVANT_OUTPUT)).toEqual([]);
    });

    it('prefers Berkeley format when both are present', () => {
      const combined = BERKELEY_OUTPUT + '\n' + MAP_OUTPUT;
      const sections = getFlashSections(combined);
      // Berkeley format should win (it's tried first)
      expect(sections).toHaveLength(3);
      expect(sections[0]).toEqual({ name: 'text', bytes: 12345 });
    });
  });
});

// ---------------------------------------------------------------------------
// resolveFlashTotal
// ---------------------------------------------------------------------------

describe('resolveFlashTotal', () => {
  it('resolves exact FQBN', () => {
    expect(resolveFlashTotal('', 'arduino:avr:uno')).toBe(32256);
  });

  it('resolves short alias', () => {
    expect(resolveFlashTotal('', 'uno')).toBe(32256);
  });

  it('resolves case-insensitive alias', () => {
    expect(resolveFlashTotal('', 'UNO')).toBe(32256);
  });

  it('resolves last segment of FQBN', () => {
    expect(resolveFlashTotal('', 'mega')).toBe(253952);
  });

  it('falls back to Arduino compile output', () => {
    expect(resolveFlashTotal(ARDUINO_UNO_OUTPUT)).toBe(32256);
  });

  it('falls back to PIO compile output', () => {
    expect(resolveFlashTotal(PIO_ESP32_OUTPUT)).toBe(1310720);
  });

  it('returns 0 when nothing can be determined', () => {
    expect(resolveFlashTotal(IRRELEVANT_OUTPUT)).toBe(0);
  });

  it('prefers board parameter over compile output', () => {
    // Even though compile output says 32256, the board says Mega
    expect(resolveFlashTotal(ARDUINO_UNO_OUTPUT, 'arduino:avr:mega')).toBe(253952);
  });
});

// ---------------------------------------------------------------------------
// parseFlashUsage
// ---------------------------------------------------------------------------

describe('parseFlashUsage', () => {
  describe('Arduino output', () => {
    it('parses Uno sketch usage', () => {
      const budget = parseFlashUsage(ARDUINO_UNO_OUTPUT);
      expect(budget).not.toBeNull();
      expect(budget!.used).toBe(12800);
      expect(budget!.total).toBe(32256);
      expect(budget!.percentage).toBeCloseTo(39.68, 1);
      expect(budget!.level).toBe('ok');
    });

    it('parses Mega near-full sketch', () => {
      const budget = parseFlashUsage(ARDUINO_MEGA_OUTPUT);
      expect(budget).not.toBeNull();
      expect(budget!.used).toBe(240000);
      expect(budget!.total).toBe(253952);
      expect(budget!.percentage).toBeCloseTo(94.51, 1);
      expect(budget!.level).toBe('critical');
    });

    it('uses board parameter to override total', () => {
      const budget = parseFlashUsage(ARDUINO_UNO_OUTPUT, 'arduino:avr:mega');
      expect(budget).not.toBeNull();
      expect(budget!.used).toBe(12800);
      expect(budget!.total).toBe(253952);
      // 12800 / 253952 ≈ 5.04%
      expect(budget!.percentage).toBeCloseTo(5.04, 1);
      expect(budget!.level).toBe('ok');
    });
  });

  describe('PlatformIO output', () => {
    it('parses ESP32 flash usage', () => {
      const budget = parseFlashUsage(PIO_ESP32_OUTPUT);
      expect(budget).not.toBeNull();
      expect(budget!.used).toBe(1028614);
      expect(budget!.total).toBe(1310720);
      expect(budget!.percentage).toBeCloseTo(78.48, 1);
      expect(budget!.level).toBe('warning');
    });
  });

  describe('Berkeley size output', () => {
    it('computes flash usage as text + data', () => {
      const budget = parseFlashUsage(BERKELEY_OUTPUT, 'arduino:avr:uno');
      expect(budget).not.toBeNull();
      // text (12345) + data (456) = 12801
      expect(budget!.used).toBe(12801);
      expect(budget!.total).toBe(32256);
      expect(budget!.level).toBe('ok');
    });
  });

  describe('GCC map output', () => {
    it('computes flash usage from hex sections', () => {
      const budget = parseFlashUsage(MAP_OUTPUT, 'arduino:avr:uno');
      expect(budget).not.toBeNull();
      // 0x3039 + 0x01c8 = 12345 + 456 = 12801
      expect(budget!.used).toBe(0x3039 + 0x01c8);
      expect(budget!.total).toBe(32256);
    });
  });

  describe('edge cases', () => {
    it('returns null for empty input with no board', () => {
      expect(parseFlashUsage(EMPTY_OUTPUT)).toBeNull();
    });

    it('returns null for irrelevant output with no board', () => {
      expect(parseFlashUsage(IRRELEVANT_OUTPUT)).toBeNull();
    });

    it('returns budget with total=0 when board is unknown and output has only sections', () => {
      // Berkeley has no "Maximum is X bytes" line, so total comes from board only
      const budget = parseFlashUsage(BERKELEY_OUTPUT);
      expect(budget).not.toBeNull();
      expect(budget!.used).toBe(12801); // text + data
      expect(budget!.total).toBe(0);
      expect(budget!.percentage).toBe(0);
      expect(budget!.level).toBe('ok');
    });

    it('handles exceeded budget level', () => {
      // Fake output claiming more than maximum
      const output = 'Sketch uses 35000 bytes (108%) of program storage space. Maximum is 32256 bytes.';
      const budget = parseFlashUsage(output);
      expect(budget).not.toBeNull();
      expect(budget!.used).toBe(35000);
      expect(budget!.total).toBe(32256);
      expect(budget!.level).toBe('exceeded');
    });
  });
});

// ---------------------------------------------------------------------------
// formatFlashBudget
// ---------------------------------------------------------------------------

describe('formatFlashBudget', () => {
  it('formats a normal budget', () => {
    const budget: FlashBudget = { used: 12800, total: 32256, percentage: 39.68, level: 'ok' };
    expect(formatFlashBudget(budget)).toBe('12.50 KB / 31.50 KB (39.68%) [OK]');
  });

  it('formats a critical budget', () => {
    const budget: FlashBudget = { used: 240000, total: 253952, percentage: 94.51, level: 'critical' };
    expect(formatFlashBudget(budget)).toBe('234.38 KB / 248.00 KB (94.51%) [CRITICAL]');
  });

  it('formats a budget with unknown total', () => {
    const budget: FlashBudget = { used: 12800, total: 0, percentage: 0, level: 'ok' };
    expect(formatFlashBudget(budget)).toBe('12.50 KB / unknown [OK]');
  });

  it('formats zero usage', () => {
    const budget: FlashBudget = { used: 0, total: 32256, percentage: 0, level: 'ok' };
    expect(formatFlashBudget(budget)).toBe('0 B / 31.50 KB (0.00%) [OK]');
  });

  it('formats exceeded level', () => {
    const budget: FlashBudget = { used: 35000, total: 32256, percentage: 108.51, level: 'exceeded' };
    expect(formatFlashBudget(budget)).toBe('34.18 KB / 31.50 KB (108.51%) [EXCEEDED]');
  });

  it('formats MB-scale values', () => {
    const budget: FlashBudget = { used: 1028614, total: 1310720, percentage: 78.48, level: 'warning' };
    // 1028614 B = 1004.51 KB (< 1 MB), 1310720 B = 1.25 MB
    expect(formatFlashBudget(budget)).toBe('1004.51 KB / 1.25 MB (78.48%) [WARNING]');
  });
});

// ---------------------------------------------------------------------------
// formatFlashSections
// ---------------------------------------------------------------------------

describe('formatFlashSections', () => {
  it('formats multiple sections', () => {
    const sections: FlashSection[] = [
      { name: 'text', bytes: 12345 },
      { name: 'data', bytes: 456 },
      { name: 'bss', bytes: 789 },
    ];
    expect(formatFlashSections(sections)).toBe('text: 12.06 KB, data: 456 B, bss: 789 B');
  });

  it('formats a single section', () => {
    const sections: FlashSection[] = [{ name: 'text', bytes: 4096 }];
    expect(formatFlashSections(sections)).toBe('text: 4.00 KB');
  });

  it('returns placeholder for empty sections', () => {
    expect(formatFlashSections([])).toBe('no section data');
  });

  it('formats bootloader section', () => {
    const sections: FlashSection[] = [{ name: 'bootloader', bytes: 512 }];
    expect(formatFlashSections(sections)).toBe('bootloader: 512 B');
  });
});

// ---------------------------------------------------------------------------
// useFlashBudget hook
// ---------------------------------------------------------------------------

describe('useFlashBudget', () => {
  it('initializes with null budget and empty sections', () => {
    const { result } = renderHook(() => useFlashBudget());
    expect(result.current.budget).toBeNull();
    expect(result.current.sections).toEqual([]);
    expect(result.current.formatted).toBe('No flash data');
  });

  it('updates budget from Arduino compile output', () => {
    const { result } = renderHook(() => useFlashBudget());

    act(() => {
      result.current.update(ARDUINO_UNO_OUTPUT);
    });

    expect(result.current.budget).not.toBeNull();
    expect(result.current.budget!.used).toBe(12800);
    expect(result.current.budget!.total).toBe(32256);
    expect(result.current.budget!.level).toBe('ok');
  });

  it('updates sections from Berkeley output', () => {
    const { result } = renderHook(() => useFlashBudget());

    act(() => {
      result.current.update(BERKELEY_OUTPUT, 'arduino:avr:uno');
    });

    expect(result.current.sections).toHaveLength(3);
    expect(result.current.sections[0]).toEqual({ name: 'text', bytes: 12345 });
  });

  it('returns the new budget from update()', () => {
    const { result } = renderHook(() => useFlashBudget());

    let returned: ReturnType<typeof parseFlashUsage> = null;
    act(() => {
      returned = result.current.update(ARDUINO_UNO_OUTPUT);
    });

    expect(returned).not.toBeNull();
    expect(returned!.used).toBe(12800);
  });

  it('returns formatted string after update', () => {
    const { result } = renderHook(() => useFlashBudget());

    act(() => {
      result.current.update(ARDUINO_UNO_OUTPUT);
    });

    expect(result.current.formatted).toContain('12.50 KB');
    expect(result.current.formatted).toContain('31.50 KB');
    expect(result.current.formatted).toContain('[OK]');
  });

  it('clears budget and sections', () => {
    const { result } = renderHook(() => useFlashBudget());

    act(() => {
      result.current.update(ARDUINO_UNO_OUTPUT);
    });
    expect(result.current.budget).not.toBeNull();

    act(() => {
      result.current.clear();
    });
    expect(result.current.budget).toBeNull();
    expect(result.current.sections).toEqual([]);
    expect(result.current.formatted).toBe('No flash data');
  });

  it('handles irrelevant output gracefully', () => {
    const { result } = renderHook(() => useFlashBudget());

    act(() => {
      result.current.update(IRRELEVANT_OUTPUT);
    });

    expect(result.current.budget).toBeNull();
    expect(result.current.sections).toEqual([]);
  });

  it('can update multiple times', () => {
    const { result } = renderHook(() => useFlashBudget());

    act(() => {
      result.current.update(ARDUINO_UNO_OUTPUT);
    });
    expect(result.current.budget!.used).toBe(12800);

    act(() => {
      result.current.update(ARDUINO_MEGA_OUTPUT);
    });
    expect(result.current.budget!.used).toBe(240000);
    expect(result.current.budget!.level).toBe('critical');
  });
});

// ---------------------------------------------------------------------------
// Type exports smoke tests
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('BudgetLevel accepts valid values', () => {
    const levels: BudgetLevel[] = ['ok', 'warning', 'critical', 'exceeded'];
    expect(levels).toHaveLength(4);
  });

  it('SectionName accepts valid values', () => {
    const names: SectionName[] = ['text', 'data', 'bss', 'bootloader'];
    expect(names).toHaveLength(4);
  });

  it('FlashBudget has required fields', () => {
    const budget: FlashBudget = { used: 0, total: 0, percentage: 0, level: 'ok' };
    expect(budget.used).toBeDefined();
    expect(budget.total).toBeDefined();
    expect(budget.percentage).toBeDefined();
    expect(budget.level).toBeDefined();
  });

  it('FlashSection has required fields', () => {
    const section: FlashSection = { name: 'text', bytes: 0 };
    expect(section.name).toBeDefined();
    expect(section.bytes).toBeDefined();
  });
});
