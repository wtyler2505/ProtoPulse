import { describe, it, expect } from 'vitest';
import { createComponentSearch, highlightMatches, COMPONENT_SEARCH_OPTIONS } from '../fuzzy-search';
import type { HighlightSegment } from '../fuzzy-search';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface TestItem {
  label: string;
  type?: string;
  description?: string;
}

function searchLabels(items: TestItem[], query: string) {
  const fuse = createComponentSearch(items, ['label']);
  return fuse.search(query);
}

const ITEMS: TestItem[] = [
  { label: 'Arduino Mega 2560', type: 'mcu' },
  { label: 'ESP32', type: 'mcu' },
  { label: 'NodeMCU ESP32-S3', type: 'mcu' },
  { label: '10kΩ Resistor', type: 'passive' },
  { label: 'Voltage Regulator LM7805', type: 'power' },
  { label: 'LED Red 5mm', type: 'passive' },
  { label: 'Motor Driver L298N', type: 'driver' },
  { label: 'HC-SR04 Ultrasonic Sensor', type: 'sensor' },
  { label: 'Capacitor 100μF', type: 'passive' },
  { label: 'NRF24L01 Wireless Module', type: 'comm' },
  { label: 'Relay Module 5V', type: 'power' },
  { label: 'OLED Display SSD1306', type: 'display' },
];

// ---------------------------------------------------------------------------
// createComponentSearch — basic matching
// ---------------------------------------------------------------------------

describe('createComponentSearch', () => {
  it('matches abbreviated text — "ESP3" finds "ESP32"', () => {
    const results = searchLabels(ITEMS, 'ESP3');
    const labels = results.map((r) => r.item.label);
    expect(labels).toContain('ESP32');
  });

  it('matches with typos — "arduno" finds "Arduino"', () => {
    const results = searchLabels(ITEMS, 'arduno');
    const labels = results.map((r) => r.item.label);
    expect(labels.some((l) => l.includes('Arduino'))).toBe(true);
  });

  it('matches partial alphanumeric — "10k" finds "10kΩ Resistor"', () => {
    const results = searchLabels(ITEMS, '10k');
    const labels = results.map((r) => r.item.label);
    expect(labels).toContain('10kΩ Resistor');
  });

  it('matches partial word — "volt" finds "Voltage Regulator"', () => {
    const results = searchLabels(ITEMS, 'volt');
    const labels = results.map((r) => r.item.label);
    expect(labels.some((l) => l.includes('Voltage'))).toBe(true);
  });

  it('is case insensitive — "esp32" matches "ESP32"', () => {
    const results = searchLabels(ITEMS, 'esp32');
    const labels = results.map((r) => r.item.label);
    expect(labels).toContain('ESP32');
  });

  it('handles special characters — searching for "μF" finds capacitor', () => {
    const results = searchLabels(ITEMS, 'μF');
    const labels = results.map((r) => r.item.label);
    expect(labels.some((l) => l.includes('Capacitor'))).toBe(true);
  });

  it('returns empty array when no items match', () => {
    const results = searchLabels(ITEMS, 'zzzznotfound');
    expect(results).toHaveLength(0);
  });

  it('returns results ordered by score — exact match ranks higher', () => {
    const results = searchLabels(ITEMS, 'ESP32');
    expect(results.length).toBeGreaterThanOrEqual(1);
    // The exact "ESP32" item should rank above "NodeMCU ESP32-S3"
    const topLabel = results[0].item.label;
    expect(topLabel).toBe('ESP32');
  });

  it('matches across multiple search keys', () => {
    const fuse = createComponentSearch(ITEMS, ['label', 'type']);
    const results = fuse.search('mcu');
    const labels = results.map((r) => r.item.label);
    expect(labels.some((l) => l.includes('Arduino') || l.includes('ESP32') || l.includes('NodeMCU'))).toBe(true);
  });

  it('handles empty items array gracefully', () => {
    const fuse = createComponentSearch<TestItem>([], ['label']);
    const results = fuse.search('anything');
    expect(results).toHaveLength(0);
  });

  it('matches multi-word queries — "motor driver" finds L298N', () => {
    const results = searchLabels(ITEMS, 'motor driver');
    const labels = results.map((r) => r.item.label);
    expect(labels.some((l) => l.includes('Motor Driver'))).toBe(true);
  });

  it('matches with transposed characters — "Ardunio" finds "Arduino"', () => {
    const results = searchLabels(ITEMS, 'Ardunio');
    const labels = results.map((r) => r.item.label);
    expect(labels.some((l) => l.includes('Arduino'))).toBe(true);
  });

  it('includes score metadata in results', () => {
    const results = searchLabels(ITEMS, 'ESP32');
    expect(results.length).toBeGreaterThanOrEqual(1);
    // Fuse includes score when includeScore is true
    expect(results[0].score).toBeDefined();
    expect(typeof results[0].score).toBe('number');
  });

  it('includes match indices in results', () => {
    const results = searchLabels(ITEMS, 'ESP32');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].matches).toBeDefined();
    expect(results[0].matches!.length).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// COMPONENT_SEARCH_OPTIONS
// ---------------------------------------------------------------------------

describe('COMPONENT_SEARCH_OPTIONS', () => {
  it('has expected default values', () => {
    expect(COMPONENT_SEARCH_OPTIONS.threshold).toBe(0.4);
    expect(COMPONENT_SEARCH_OPTIONS.distance).toBe(100);
    expect(COMPONENT_SEARCH_OPTIONS.includeScore).toBe(true);
    expect(COMPONENT_SEARCH_OPTIONS.includeMatches).toBe(true);
    expect(COMPONENT_SEARCH_OPTIONS.minMatchCharLength).toBe(2);
    expect(COMPONENT_SEARCH_OPTIONS.shouldSort).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// highlightMatches
// ---------------------------------------------------------------------------

describe('highlightMatches', () => {
  it('returns full text as non-match when no matches provided', () => {
    const result = highlightMatches('Hello World', undefined);
    expect(result).toEqual([{ text: 'Hello World', isMatch: false }]);
  });

  it('returns full text as non-match for empty matches array', () => {
    const result = highlightMatches('Hello World', []);
    expect(result).toEqual([{ text: 'Hello World', isMatch: false }]);
  });

  it('correctly identifies match segments', () => {
    const matches = [
      { indices: [[0, 4] as [number, number]], value: 'ESP32', key: 'label' },
    ] as const;
    const result = highlightMatches('ESP32 Dev Board', matches);

    const matchedParts = result.filter((s: HighlightSegment) => s.isMatch);
    expect(matchedParts.length).toBeGreaterThanOrEqual(1);
    expect(matchedParts[0].text).toBe('ESP32');
  });

  it('handles match at end of string', () => {
    const matches = [
      { indices: [[10, 14] as [number, number]], value: 'Board', key: 'label' },
    ] as const;
    const result = highlightMatches('ESP32 Dev Board', matches);

    const lastSegment = result[result.length - 1];
    expect(lastSegment.text).toBe('Board');
    expect(lastSegment.isMatch).toBe(true);
  });

  it('handles match at start of string', () => {
    const matches = [
      { indices: [[0, 2] as [number, number]], value: 'ESP', key: 'label' },
    ] as const;
    const result = highlightMatches('ESP32', matches);

    expect(result[0].text).toBe('ESP');
    expect(result[0].isMatch).toBe(true);
  });

  it('merges overlapping match ranges', () => {
    const matches = [
      { indices: [[0, 3] as [number, number], [2, 5] as [number, number]], value: 'test', key: 'label' },
    ] as const;
    const result = highlightMatches('HelloWorld', matches);

    // Should be merged into a single [0, 5] range
    const matchSegments = result.filter((s: HighlightSegment) => s.isMatch);
    expect(matchSegments).toHaveLength(1);
    expect(matchSegments[0].text).toBe('HelloW');
  });

  it('handles multiple non-contiguous match regions', () => {
    const matches = [
      { indices: [[0, 2] as [number, number], [6, 8] as [number, number]], value: 'test', key: 'label' },
    ] as const;
    const result = highlightMatches('ESP32 Dev', matches);

    // Should have: "ESP" (match), "32 " (no match), "Dev" (match)
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ text: 'ESP', isMatch: true });
    expect(result[1]).toEqual({ text: '32 ', isMatch: false });
    expect(result[2]).toEqual({ text: 'Dev', isMatch: true });
  });

  it('handles matches with empty indices', () => {
    const matches = [
      { indices: [] as Array<[number, number]>, value: 'test', key: 'label' },
    ] as const;
    const result = highlightMatches('Hello', matches);
    expect(result).toEqual([{ text: 'Hello', isMatch: false }]);
  });
});
