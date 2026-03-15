import { describe, it, expect, beforeEach } from 'vitest';
import {
  getKnowledgeLinks,
  getKnowledgeLinksForTranslation,
  linkErrorsToKnowledge,
  getRuleCount,
  getReferencedArticleIds,
} from '../error-knowledge-linker';
import type { KnowledgeLink, LinkedError } from '../error-knowledge-linker';
import type { ErrorTranslation } from '../error-translator';
import { ElectronicsKnowledgeBase } from '@/lib/electronics-knowledge';

// ---------------------------------------------------------------------------
// Reset singleton between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  ElectronicsKnowledgeBase.resetForTesting();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function primaryIds(links: KnowledgeLink[]): string[] {
  return links.filter((l) => l.relevance === 'primary').map((l) => l.articleId);
}

function secondaryIds(links: KnowledgeLink[]): string[] {
  return links.filter((l) => l.relevance === 'secondary').map((l) => l.articleId);
}

function allIds(links: KnowledgeLink[]): string[] {
  return links.map((l) => l.articleId);
}

// ---------------------------------------------------------------------------
// getKnowledgeLinks — basic matching
// ---------------------------------------------------------------------------

describe('getKnowledgeLinks', () => {
  it('returns empty array for empty string', () => {
    expect(getKnowledgeLinks('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(getKnowledgeLinks('   ')).toEqual([]);
  });

  it('returns empty array for unmatched error messages', () => {
    const links = getKnowledgeLinks('some completely unrelated compiler message about foo bar');
    expect(links).toEqual([]);
  });

  // --- Serial / UART errors ---
  it('links Serial not declared to UART article', () => {
    const links = getKnowledgeLinks("'Serial' was not declared in this scope");
    expect(primaryIds(links)).toContain('uart');
  });

  it('links HardwareSerial does not name a type to UART', () => {
    const links = getKnowledgeLinks("'HardwareSerial' does not name a type");
    expect(primaryIds(links)).toContain('uart');
  });

  // --- I2C / Wire errors ---
  it('links Wire not declared to I2C article', () => {
    const links = getKnowledgeLinks("'Wire' was not declared in this scope");
    expect(primaryIds(links)).toContain('i2c');
  });

  it('links TwoWire no matching function to I2C', () => {
    const links = getKnowledgeLinks("no matching function for call to 'TwoWire::begin'");
    expect(primaryIds(links)).toContain('i2c');
  });

  it('includes pull-up-pull-down as secondary for Wire errors', () => {
    const links = getKnowledgeLinks("'Wire' was not declared in this scope");
    expect(secondaryIds(links)).toContain('pull-up-pull-down');
  });

  // --- SPI errors ---
  it('links SPI not declared to SPI article', () => {
    const links = getKnowledgeLinks("'SPI' was not declared in this scope");
    expect(primaryIds(links)).toContain('spi');
  });

  it('links SPIClass does not name a type to SPI', () => {
    const links = getKnowledgeLinks("'SPIClass' does not name a type");
    expect(primaryIds(links)).toContain('spi');
  });

  // --- ADC/DAC errors ---
  it('links analogRead to ADC/DAC article', () => {
    const links = getKnowledgeLinks("'analogRead' was not declared in this scope");
    expect(primaryIds(links)).toContain('adc-dac');
  });

  it('links analogWrite to ADC/DAC and PWM', () => {
    const links = getKnowledgeLinks("cannot find 'analogWrite' function");
    expect(primaryIds(links)).toContain('adc-dac');
    expect(secondaryIds(links)).toContain('pwm');
  });

  it('links ADC attenuation errors to ADC/DAC', () => {
    const links = getKnowledgeLinks("'analogSetAttenuation' was not declared in this scope");
    expect(primaryIds(links)).toContain('adc-dac');
  });

  // --- PWM errors ---
  it('links ledcSetup to PWM article', () => {
    const links = getKnowledgeLinks("'ledcSetup' was not declared in this scope");
    expect(primaryIds(links)).toContain('pwm');
  });

  it('links ledcAttachPin to PWM article', () => {
    const links = getKnowledgeLinks("'ledcAttachPin' was not declared in this scope");
    expect(primaryIds(links)).toContain('pwm');
  });

  // --- Servo errors ---
  it('links Servo not declared to PWM', () => {
    const links = getKnowledgeLinks("'Servo' was not declared in this scope");
    expect(primaryIds(links)).toContain('pwm');
  });

  // --- Pull-up / pull-down errors ---
  it('links INPUT_PULLUP to pull-up-pull-down', () => {
    const links = getKnowledgeLinks("'INPUT_PULLUP' was not declared in this scope");
    expect(primaryIds(links)).toContain('pull-up-pull-down');
  });

  it('links pinMode to pull-up-pull-down', () => {
    const links = getKnowledgeLinks("'pinMode' was not declared in this scope");
    expect(primaryIds(links)).toContain('pull-up-pull-down');
  });

  // --- Memory overflow errors ---
  it('links .text overflow to pcb-basics', () => {
    const links = getKnowledgeLinks("section '.text' will not fit in region 'text'");
    expect(primaryIds(links)).toContain('pcb-basics');
  });

  it('links RAM overflow to pcb-basics', () => {
    const links = getKnowledgeLinks("region 'RAM' overflowed by 128 bytes");
    expect(primaryIds(links)).toContain('pcb-basics');
  });

  // --- Upload / communication errors ---
  it('links avrdude sync error to UART', () => {
    const links = getKnowledgeLinks('avrdude: stk500_getsync() attempt 10 of 10: not in sync');
    expect(primaryIds(links)).toContain('uart');
  });

  it('links esptool timeout to UART', () => {
    const links = getKnowledgeLinks('esptool.py: serial connection timeout');
    expect(primaryIds(links)).toContain('uart');
  });

  it('links device signature mismatch to pcb-basics', () => {
    const links = getKnowledgeLinks('avrdude: device signature = 0x1e9587 (probably not m328p)');
    expect(primaryIds(links)).toContain('pcb-basics');
  });

  it('links serial port not found to UART', () => {
    const links = getKnowledgeLinks('serial port COM3 not found');
    expect(primaryIds(links)).toContain('uart');
  });

  it('links port busy to UART', () => {
    const links = getKnowledgeLinks('Error: port /dev/ttyUSB0 is busy');
    expect(primaryIds(links)).toContain('uart');
  });

  it('links baud rate errors to UART', () => {
    const links = getKnowledgeLinks('invalid baud rate 123456');
    expect(primaryIds(links)).toContain('uart');
  });

  // --- Motor / H-bridge errors ---
  it('links L298 not declared to H-bridges', () => {
    const links = getKnowledgeLinks("'L298' was not declared in this scope");
    expect(primaryIds(links)).toContain('h-bridges');
    expect(secondaryIds(links)).toContain('mosfets');
  });

  it('links Motor not declared to H-bridges', () => {
    const links = getKnowledgeLinks("'Motor' does not name a type");
    expect(primaryIds(links)).toContain('h-bridges');
  });

  // --- Display / OLED errors ---
  it('links SSD1306 not declared to I2C', () => {
    const links = getKnowledgeLinks("'Adafruit_SSD1306' was not declared in this scope");
    expect(primaryIds(links)).toContain('i2c');
  });

  it('links OLED display errors to I2C', () => {
    const links = getKnowledgeLinks("'display' no matching function for call to OLED constructor");
    expect(primaryIds(links)).toContain('i2c');
  });

  // --- Sensor errors ---
  it('links BME280 to I2C', () => {
    const links = getKnowledgeLinks("'BME280' was not declared in this scope");
    expect(primaryIds(links)).toContain('i2c');
  });

  it('links MPU6050 to I2C', () => {
    const links = getKnowledgeLinks("'MPU6050' does not name a type");
    expect(primaryIds(links)).toContain('i2c');
  });

  // --- Voltage regulator errors ---
  it('links LM1117 to voltage-regulators', () => {
    const links = getKnowledgeLinks('LM1117 voltage regulator output mismatch');
    expect(primaryIds(links)).toContain('voltage-regulators');
  });

  it('links decoupling errors to decoupling-capacitors', () => {
    const links = getKnowledgeLinks('missing bypass decoupling cap on VCC');
    expect(primaryIds(links)).toContain('decoupling-capacitors');
  });

  // --- MOSFET / transistor errors ---
  it('links MOSFET references to mosfets article', () => {
    const links = getKnowledgeLinks("'IRLZ44' was not declared in this scope");
    expect(primaryIds(links)).toContain('mosfets');
  });

  it('links NPN transistor references to transistors', () => {
    const links = getKnowledgeLinks("2N2222 base resistor calculation");
    expect(primaryIds(links)).toContain('transistors');
  });

  it('links BJT references to transistors', () => {
    const links = getKnowledgeLinks("BJT saturation region check");
    expect(primaryIds(links)).toContain('transistors');
  });

  // --- Diode / LED errors ---
  it('links 1N4001 to diodes', () => {
    const links = getKnowledgeLinks('1N4001 flyback protection missing');
    expect(primaryIds(links)).toContain('diodes');
  });

  it('links Zener diode to diodes', () => {
    const links = getKnowledgeLinks('Zener voltage reference clamp');
    expect(primaryIds(links)).toContain('diodes');
  });

  it('links LED current limit to diodes', () => {
    const links = getKnowledgeLinks("LED current limiting resistor too small");
    expect(primaryIds(links)).toContain('diodes');
    expect(secondaryIds(links)).toContain('resistors');
  });

  // --- Filter related ---
  it('links low-pass filter to rc-lc-filters', () => {
    const links = getKnowledgeLinks('RC low-pass filter cutoff frequency mismatch');
    expect(primaryIds(links)).toContain('rc-lc-filters');
  });

  it('links band-pass to rc-lc-filters', () => {
    const links = getKnowledgeLinks('band-pass filter Q factor too low');
    expect(primaryIds(links)).toContain('rc-lc-filters');
  });

  // --- PCB errors ---
  it('links trace/via errors to pcb-basics', () => {
    const links = getKnowledgeLinks('trace width too narrow for current');
    expect(primaryIds(links)).toContain('pcb-basics');
  });

  it('links DRC errors to pcb-basics', () => {
    const links = getKnowledgeLinks('DRC clearance violation on net VCC');
    expect(primaryIds(links)).toContain('pcb-basics');
  });

  it('links solder-related to pcb-basics and soldering-tips', () => {
    const links = getKnowledgeLinks('solder bridge detected between pads');
    expect(primaryIds(links)).toContain('pcb-basics');
    expect(secondaryIds(links)).toContain('soldering-tips');
  });

  // --- Voltage divider / resistor errors ---
  it('links voltage divider to voltage-dividers', () => {
    const links = getKnowledgeLinks('voltage divider ratio incorrect for 3.3V level shift');
    expect(primaryIds(links)).toContain('voltage-dividers');
  });

  it('links pull-up resistor to voltage-dividers', () => {
    const links = getKnowledgeLinks('pull-up resistor missing on I2C SDA line');
    expect(primaryIds(links)).toContain('voltage-dividers');
  });

  // --- Signed/unsigned comparison ---
  it('links signed/unsigned comparison to adc-dac', () => {
    const links = getKnowledgeLinks('comparison between signed and unsigned integer expressions');
    expect(primaryIds(links)).toContain('adc-dac');
  });

  // --- Op-amp related ---
  it('links op-amp references to op-amps', () => {
    const links = getKnowledgeLinks('LM358 amplifier gain too high');
    expect(primaryIds(links)).toContain('op-amps');
  });

  it('links gain-related messages to op-amps', () => {
    const links = getKnowledgeLinks('gain calculation for inverting amplifier stage');
    expect(primaryIds(links)).toContain('op-amps');
  });
});

// ---------------------------------------------------------------------------
// Link properties
// ---------------------------------------------------------------------------

describe('KnowledgeLink properties', () => {
  it('includes article title from knowledge hub', () => {
    const links = getKnowledgeLinks("'Wire' was not declared in this scope");
    const i2cLink = links.find((l) => l.articleId === 'i2c');
    expect(i2cLink).toBeDefined();
    expect(i2cLink!.title).toBe('I2C (Inter-Integrated Circuit)');
  });

  it('marks primary links as primary', () => {
    const links = getKnowledgeLinks("'SPI' was not declared in this scope");
    const spiLink = links.find((l) => l.articleId === 'spi');
    expect(spiLink?.relevance).toBe('primary');
  });

  it('marks secondary links as secondary', () => {
    const links = getKnowledgeLinks("'Wire' was not declared in this scope");
    const pullLink = links.find((l) => l.articleId === 'pull-up-pull-down');
    expect(pullLink?.relevance).toBe('secondary');
  });

  it('does not duplicate article IDs across primary and secondary', () => {
    const links = getKnowledgeLinks("INPUT_PULLUP not declared in this scope");
    const ids = links.map((l) => l.articleId);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

// ---------------------------------------------------------------------------
// getKnowledgeLinksForTranslation
// ---------------------------------------------------------------------------

describe('getKnowledgeLinksForTranslation', () => {
  it('matches against the original error line', () => {
    const t: ErrorTranslation = {
      original: "sketch.ino:10: error: 'Serial' was not declared in this scope",
      translated: "The name 'Serial' doesn't exist here.",
      suggestion: 'Add #include <Arduino.h> or check board selection.',
      severity: 'error',
      lineNumber: 10,
      file: 'sketch.ino',
    };
    const links = getKnowledgeLinksForTranslation(t);
    expect(primaryIds(links)).toContain('uart');
  });

  it('matches against the translated text', () => {
    const t: ErrorTranslation = {
      original: 'generic error message',
      translated: 'You need to configure the baud rate correctly.',
      suggestion: 'Set the correct baud rate.',
      severity: 'error',
    };
    const links = getKnowledgeLinksForTranslation(t);
    expect(primaryIds(links)).toContain('uart');
  });

  it('matches against the suggestion text', () => {
    const t: ErrorTranslation = {
      original: 'generic error',
      translated: 'generic translation',
      suggestion: 'Use INPUT_PULLUP mode on the pin.',
      severity: 'warning',
    };
    const links = getKnowledgeLinksForTranslation(t);
    expect(primaryIds(links)).toContain('pull-up-pull-down');
  });

  it('combines matches from all fields without duplicates', () => {
    const t: ErrorTranslation = {
      original: "Serial port busy",
      translated: 'UART communication error',
      suggestion: 'Check baud rate settings.',
      severity: 'error',
    };
    const links = getKnowledgeLinksForTranslation(t);
    const uartCount = links.filter((l) => l.articleId === 'uart').length;
    expect(uartCount).toBe(1);
  });

  it('returns empty for unmatched translations', () => {
    const t: ErrorTranslation = {
      original: 'some random error',
      translated: 'something went wrong',
      suggestion: 'try again later',
      severity: 'error',
    };
    const links = getKnowledgeLinksForTranslation(t);
    expect(links).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// linkErrorsToKnowledge
// ---------------------------------------------------------------------------

describe('linkErrorsToKnowledge', () => {
  it('returns empty array for empty input', () => {
    expect(linkErrorsToKnowledge([])).toEqual([]);
  });

  it('enriches each translation with knowledgeLinks', () => {
    const translations: ErrorTranslation[] = [
      {
        original: "'Wire' was not declared in this scope",
        translated: "Wire is not available.",
        suggestion: 'Add #include <Wire.h>',
        severity: 'error',
        lineNumber: 5,
        file: 'sketch.ino',
      },
      {
        original: "random unmatched error",
        translated: "something",
        suggestion: "do something",
        severity: 'warning',
      },
    ];

    const linked = linkErrorsToKnowledge(translations);
    expect(linked).toHaveLength(2);

    // First one should have I2C links
    expect(linked[0].knowledgeLinks.length).toBeGreaterThan(0);
    expect(primaryIds(linked[0].knowledgeLinks)).toContain('i2c');

    // Second one should have empty links
    expect(linked[1].knowledgeLinks).toEqual([]);
  });

  it('preserves all original ErrorTranslation fields', () => {
    const translations: ErrorTranslation[] = [
      {
        original: "'SPI' was not declared in this scope",
        translated: "SPI not available",
        suggestion: 'Add #include <SPI.h>',
        severity: 'error',
        lineNumber: 42,
        file: 'main.ino',
      },
    ];

    const linked = linkErrorsToKnowledge(translations);
    const first: LinkedError = linked[0];
    expect(first.original).toBe("'SPI' was not declared in this scope");
    expect(first.translated).toBe('SPI not available');
    expect(first.suggestion).toBe('Add #include <SPI.h>');
    expect(first.severity).toBe('error');
    expect(first.lineNumber).toBe(42);
    expect(first.file).toBe('main.ino');
  });

  it('does not mutate the input array', () => {
    const translations: ErrorTranslation[] = [
      {
        original: "'Wire' was not declared in this scope",
        translated: "Wire missing",
        suggestion: 'Include Wire.h',
        severity: 'error',
      },
    ];

    const originalRef = translations[0];
    linkErrorsToKnowledge(translations);
    // Original should not have knowledgeLinks
    expect((originalRef as Record<string, unknown>).knowledgeLinks).toBeUndefined();
  });

  it('handles multiple errors with different link sets', () => {
    const translations: ErrorTranslation[] = [
      {
        original: "'Serial' was not declared in this scope",
        translated: "Serial not found",
        suggestion: 'Add Arduino.h',
        severity: 'error',
      },
      {
        original: "'BME280' does not name a type",
        translated: "BME280 unknown",
        suggestion: 'Install library',
        severity: 'error',
      },
      {
        original: "region 'RAM' overflowed by 512 bytes",
        translated: "Out of RAM",
        suggestion: 'Reduce variables',
        severity: 'error',
      },
    ];

    const linked = linkErrorsToKnowledge(translations);
    expect(linked).toHaveLength(3);

    // Serial → UART
    expect(primaryIds(linked[0].knowledgeLinks)).toContain('uart');
    // BME280 → I2C
    expect(primaryIds(linked[1].knowledgeLinks)).toContain('i2c');
    // RAM overflow → pcb-basics
    expect(primaryIds(linked[2].knowledgeLinks)).toContain('pcb-basics');
  });
});

// ---------------------------------------------------------------------------
// getRuleCount
// ---------------------------------------------------------------------------

describe('getRuleCount', () => {
  it('returns a positive number of rules', () => {
    expect(getRuleCount()).toBeGreaterThanOrEqual(20);
  });
});

// ---------------------------------------------------------------------------
// getReferencedArticleIds
// ---------------------------------------------------------------------------

describe('getReferencedArticleIds', () => {
  it('returns a sorted array of unique article IDs', () => {
    const ids = getReferencedArticleIds();
    expect(ids.length).toBeGreaterThan(0);

    // Verify sorted
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);

    // Verify unique
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('all referenced article IDs exist in the knowledge hub', () => {
    const kb = ElectronicsKnowledgeBase.getInstance();
    const ids = getReferencedArticleIds();

    for (const id of ids) {
      const article = kb.getArticle(id);
      expect(article, `Article '${id}' referenced in rules but not found in knowledge hub`).not.toBeNull();
    }
  });

  it('covers at least 10 distinct articles', () => {
    const ids = getReferencedArticleIds();
    expect(ids.length).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Edge cases & robustness
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('handles null-ish inputs gracefully', () => {
    expect(getKnowledgeLinks('')).toEqual([]);
    expect(getKnowledgeLinks('  \n\t  ')).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const lower = getKnowledgeLinks("'serial' was not declared in this scope");
    const upper = getKnowledgeLinks("'SERIAL' WAS NOT DECLARED IN THIS SCOPE");
    // Both should match the same rule
    expect(allIds(lower).length).toBeGreaterThan(0);
    expect(allIds(upper).length).toBeGreaterThan(0);
  });

  it('handles multi-line error messages', () => {
    const multiline = "sketch.ino:10: error: 'Wire' was not declared in this scope\n  included from here";
    const links = getKnowledgeLinks(multiline);
    expect(primaryIds(links)).toContain('i2c');
  });

  it('handles errors with special regex characters', () => {
    // Should not throw
    const links = getKnowledgeLinks("error: expected ')' before ';'");
    expect(Array.isArray(links)).toBe(true);
  });

  it('returns primary links before secondary links', () => {
    const links = getKnowledgeLinks("'Wire' was not declared in this scope");
    if (links.length >= 2) {
      const firstPrimary = links.findIndex((l) => l.relevance === 'primary');
      const firstSecondary = links.findIndex((l) => l.relevance === 'secondary');
      if (firstPrimary >= 0 && firstSecondary >= 0) {
        expect(firstPrimary).toBeLessThan(firstSecondary);
      }
    }
  });
});
