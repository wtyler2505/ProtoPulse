import { describe, it, expect } from 'vitest';
import {
  encodeQRData,
  parseQRData,
  generateLabelSVG,
  generateBatchLabels,
  generatePrintPage,
} from '../qr-labels';
import type { QRLabelItem } from '../qr-labels';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const fullItem: QRLabelItem = {
  id: 'item-1',
  name: 'ATmega328P',
  location: 'Bin A3',
  quantity: 25,
  partNumber: 'ATMEGA328P-PU',
  category: 'Microcontrollers',
};

const minimalItem: QRLabelItem = {
  id: 'item-2',
  name: 'LED Red 5mm',
};

// ---------------------------------------------------------------------------
// encodeQRData
// ---------------------------------------------------------------------------

describe('encodeQRData', () => {
  it('encodes a full item with PP: prefix and compact keys', () => {
    const encoded = encodeQRData(fullItem);
    expect(encoded).toMatch(/^PP:/);
    const json = JSON.parse(encoded.slice(3));
    expect(json.i).toBe('item-1');
    expect(json.n).toBe('ATmega328P');
    expect(json.l).toBe('Bin A3');
    expect(json.q).toBe(25);
    expect(json.p).toBe('ATMEGA328P-PU');
    expect(json.c).toBe('Microcontrollers');
  });

  it('encodes a minimal item without optional fields', () => {
    const encoded = encodeQRData(minimalItem);
    const json = JSON.parse(encoded.slice(3));
    expect(json.i).toBe('item-2');
    expect(json.n).toBe('LED Red 5mm');
    expect(json.l).toBeUndefined();
    expect(json.q).toBeUndefined();
    expect(json.p).toBeUndefined();
    expect(json.c).toBeUndefined();
  });

  it('omits empty string fields', () => {
    const item: QRLabelItem = { id: '3', name: 'Cap', location: '', partNumber: '', category: '' };
    const encoded = encodeQRData(item);
    const json = JSON.parse(encoded.slice(3));
    expect(json.l).toBeUndefined();
    expect(json.p).toBeUndefined();
    expect(json.c).toBeUndefined();
  });

  it('includes quantity of zero', () => {
    const item: QRLabelItem = { id: '4', name: 'Resistor', quantity: 0 };
    const encoded = encodeQRData(item);
    const json = JSON.parse(encoded.slice(3));
    expect(json.q).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseQRData
// ---------------------------------------------------------------------------

describe('parseQRData', () => {
  it('round-trips a full item', () => {
    const encoded = encodeQRData(fullItem);
    const parsed = parseQRData(encoded);
    expect(parsed).toEqual(fullItem);
  });

  it('round-trips a minimal item', () => {
    const encoded = encodeQRData(minimalItem);
    const parsed = parseQRData(encoded);
    expect(parsed).toEqual(minimalItem);
  });

  it('returns null for data without PP: prefix', () => {
    expect(parseQRData('{"i":"1","n":"test"}')).toBeNull();
  });

  it('returns null for invalid JSON', () => {
    expect(parseQRData('PP:not-json')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(parseQRData('PP:"just a string"')).toBeNull();
    expect(parseQRData('PP:42')).toBeNull();
    expect(parseQRData('PP:null')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseQRData('PP:{"i":"1"}')).toBeNull();
    expect(parseQRData('PP:{"n":"test"}')).toBeNull();
  });

  it('returns null for empty string input', () => {
    expect(parseQRData('')).toBeNull();
  });

  it('ignores non-finite quantity values', () => {
    const data = 'PP:{"i":"1","n":"test","q":null}';
    const parsed = parseQRData(data);
    expect(parsed).not.toBeNull();
    expect(parsed!.quantity).toBeUndefined();
  });

  it('preserves quantity of zero', () => {
    const data = 'PP:{"i":"1","n":"test","q":0}';
    const parsed = parseQRData(data);
    expect(parsed!.quantity).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// generateLabelSVG
// ---------------------------------------------------------------------------

describe('generateLabelSVG', () => {
  it('returns valid SVG markup', () => {
    const svg = generateLabelSVG(fullItem);
    expect(svg).toMatch(/^<svg xmlns/);
    expect(svg).toMatch(/<\/svg>$/);
  });

  it('includes the component name', () => {
    const svg = generateLabelSVG(fullItem);
    expect(svg).toContain('ATmega328P');
  });

  it('includes part number when present', () => {
    const svg = generateLabelSVG(fullItem);
    expect(svg).toContain('ATMEGA328P-PU');
  });

  it('includes location and quantity', () => {
    const svg = generateLabelSVG(fullItem);
    expect(svg).toContain('Bin A3');
    expect(svg).toContain('Qty: 25');
  });

  it('includes category', () => {
    const svg = generateLabelSVG(fullItem);
    expect(svg).toContain('Microcontrollers');
  });

  it('omits text when includeText is false', () => {
    const svg = generateLabelSVG(fullItem, { includeText: false });
    expect(svg).not.toContain('ATmega328P');
    // Should still have the QR pattern rects
    expect(svg).toContain('<rect');
  });

  it('respects custom size', () => {
    const svg = generateLabelSVG(minimalItem, { size: 300 });
    expect(svg).toContain('width="300"');
  });

  it('returns data URL when format is dataurl', () => {
    const result = generateLabelSVG(minimalItem, { format: 'dataurl' });
    expect(result).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('produces deterministic output for same input', () => {
    const svg1 = generateLabelSVG(fullItem);
    const svg2 = generateLabelSVG(fullItem);
    expect(svg1).toBe(svg2);
  });

  it('produces different patterns for different items', () => {
    const svg1 = generateLabelSVG(fullItem);
    const svg2 = generateLabelSVG(minimalItem);
    expect(svg1).not.toBe(svg2);
  });

  it('escapes special XML characters in names', () => {
    const item: QRLabelItem = { id: '5', name: 'R1 <100> & "special"' };
    const svg = generateLabelSVG(item);
    expect(svg).toContain('&lt;');
    expect(svg).toContain('&amp;');
    expect(svg).toContain('&quot;');
    expect(svg).not.toContain('<100>');
  });

  it('handles minimal item without optional fields', () => {
    const svg = generateLabelSVG(minimalItem);
    expect(svg).toContain('LED Red 5mm');
    // Should not contain undefined or null text
    expect(svg).not.toContain('undefined');
    expect(svg).not.toContain('null');
  });
});

// ---------------------------------------------------------------------------
// generateBatchLabels
// ---------------------------------------------------------------------------

describe('generateBatchLabels', () => {
  it('returns one SVG per item', () => {
    const items = [fullItem, minimalItem];
    const labels = generateBatchLabels(items);
    expect(labels).toHaveLength(2);
    expect(labels[0]).toMatch(/^<svg/);
    expect(labels[1]).toMatch(/^<svg/);
  });

  it('returns empty array for empty input', () => {
    expect(generateBatchLabels([])).toEqual([]);
  });

  it('passes options through to individual labels', () => {
    const labels = generateBatchLabels([minimalItem], { size: 400 });
    expect(labels[0]).toContain('width="400"');
  });
});

// ---------------------------------------------------------------------------
// generatePrintPage
// ---------------------------------------------------------------------------

describe('generatePrintPage', () => {
  it('returns complete HTML document', () => {
    const html = generatePrintPage([fullItem]);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html');
    expect(html).toContain('</html>');
  });

  it('includes title', () => {
    const html = generatePrintPage([fullItem]);
    expect(html).toContain('<title>ProtoPulse Inventory Labels</title>');
  });

  it('uses specified columns', () => {
    const html = generatePrintPage([fullItem], { columns: 4 });
    expect(html).toContain('repeat(4, 1fr)');
  });

  it('defaults to 3 columns', () => {
    const html = generatePrintPage([fullItem]);
    expect(html).toContain('repeat(3, 1fr)');
  });

  it('includes all items as label cells', () => {
    const items = [fullItem, minimalItem, { id: '3', name: 'Cap 100uF' }];
    const html = generatePrintPage(items);
    const cellCount = (html.match(/class="label-cell"/g) ?? []).length;
    expect(cellCount).toBe(3);
  });

  it('includes print media query', () => {
    const html = generatePrintPage([fullItem]);
    expect(html).toContain('@media print');
  });

  it('handles empty items array', () => {
    const html = generatePrintPage([]);
    expect(html).toContain('label-grid');
    const cellCount = (html.match(/class="label-cell"/g) ?? []).length;
    expect(cellCount).toBe(0);
  });

  it('passes label size through', () => {
    const html = generatePrintPage([minimalItem], { labelSize: 300 });
    expect(html).toContain('width="300"');
  });
});
