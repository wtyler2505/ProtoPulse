import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  extractScanline,
  toRunLengths,
  validateEAN13Checksum,
  decodeEAN13,
  isUPCA,
  toUPCA,
  matchCode128Symbol,
  decodeCode128,
  parseComponentLabel,
  BarcodeScanner,
  ScanSession,
  useBarcodeScanner,
} from '../barcode-scanner';
import type {
  BarcodeFormat,
  ParsedComponentLabel,
  ScanResult,
  RunSegment,
} from '../barcode-scanner';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal ImageData-compatible object for testing.
 * Fills a single row with alternating bright/dark pixels based on a pattern string.
 * 'D' = dark pixel (0,0,0), 'L' = light pixel (255,255,255).
 */
function createImageData(pattern: string, width?: number, height?: number): ImageData {
  const w = width ?? pattern.length;
  const h = height ?? 1;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const offset = (y * w + x) * 4;
      const charIdx = x < pattern.length ? x : pattern.length - 1;
      const isDark = pattern[charIdx] === 'D';
      const val = isDark ? 0 : 255;
      data[offset] = val;
      data[offset + 1] = val;
      data[offset + 2] = val;
      data[offset + 3] = 255;
    }
  }
  return { data, width: w, height: h, colorSpace: 'srgb' as PredefinedColorSpace };
}

/** Create an empty (all white) ImageData. */
function createEmptyImageData(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  return { data, width, height, colorSpace: 'srgb' as PredefinedColorSpace };
}

/** Create a zero-size ImageData. */
function createZeroImageData(): ImageData {
  return { data: new Uint8ClampedArray(0), width: 0, height: 0, colorSpace: 'srgb' as PredefinedColorSpace };
}

// ---------------------------------------------------------------------------
// extractScanline
// ---------------------------------------------------------------------------

describe('extractScanline', () => {
  it('converts pixels to boolean dark/light array', () => {
    const img = createImageData('DDLLD');
    const line = extractScanline(img, 0);
    expect(line).toEqual([true, true, false, false, true]);
  });

  it('uses luminance threshold to classify pixels', () => {
    // Create a pixel with mid-range gray (luminance ~127)
    const data = new Uint8ClampedArray([127, 127, 127, 255, 200, 200, 200, 255]);
    const img: ImageData = { data, width: 2, height: 1, colorSpace: 'srgb' as PredefinedColorSpace };

    // With threshold 128, the first pixel (lum=127) is dark, second (lum=200) is light
    const line = extractScanline(img, 0, 128);
    expect(line[0]).toBe(true);
    expect(line[1]).toBe(false);
  });

  it('clamps y coordinate to valid range', () => {
    const img = createImageData('DLD', 3, 2);
    // y=999 should clamp to last row
    const line = extractScanline(img, 999);
    expect(line).toHaveLength(3);
  });

  it('handles single pixel image', () => {
    const img = createImageData('D', 1, 1);
    const line = extractScanline(img, 0);
    expect(line).toEqual([true]);
  });
});

// ---------------------------------------------------------------------------
// toRunLengths
// ---------------------------------------------------------------------------

describe('toRunLengths', () => {
  it('converts boolean array to run-length segments', () => {
    const runs = toRunLengths([true, true, false, false, false, true]);
    expect(runs).toEqual([
      { dark: true, length: 2 },
      { dark: false, length: 3 },
      { dark: true, length: 1 },
    ]);
  });

  it('handles all-dark scanline', () => {
    const runs = toRunLengths([true, true, true]);
    expect(runs).toEqual([{ dark: true, length: 3 }]);
  });

  it('handles all-light scanline', () => {
    const runs = toRunLengths([false, false]);
    expect(runs).toEqual([{ dark: false, length: 2 }]);
  });

  it('returns empty array for empty input', () => {
    expect(toRunLengths([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(toRunLengths([true])).toEqual([{ dark: true, length: 1 }]);
  });

  it('handles alternating pattern', () => {
    const runs = toRunLengths([true, false, true, false]);
    expect(runs).toHaveLength(4);
    expect(runs.every((r) => r.length === 1)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EAN-13 checksum validation
// ---------------------------------------------------------------------------

describe('validateEAN13Checksum', () => {
  it('validates a correct EAN-13 checksum (4006381333931)', () => {
    const digits = [4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3, 1];
    expect(validateEAN13Checksum(digits)).toBe(true);
  });

  it('validates another correct EAN-13 (5901234123457)', () => {
    const digits = [5, 9, 0, 1, 2, 3, 4, 1, 2, 3, 4, 5, 7];
    expect(validateEAN13Checksum(digits)).toBe(true);
  });

  it('rejects invalid checksum', () => {
    const digits = [4, 0, 0, 6, 3, 8, 1, 3, 3, 3, 9, 3, 0]; // wrong check digit
    expect(validateEAN13Checksum(digits)).toBe(false);
  });

  it('rejects array with wrong length', () => {
    expect(validateEAN13Checksum([1, 2, 3])).toBe(false);
    expect(validateEAN13Checksum([])).toBe(false);
  });

  it('validates UPC-A as EAN-13 with leading zero (0036000291452)', () => {
    // UPC-A 036000291452 = EAN-13 0036000291452
    const digits = [0, 0, 3, 6, 0, 0, 0, 2, 9, 1, 4, 5, 2];
    expect(validateEAN13Checksum(digits)).toBe(true);
  });

  it('validates EAN-13 with check digit 0 (8901234567894 → check=4, but 2000000000008)', () => {
    // 2000000000008: check = (10 - (2+0+0+0+0+0)*1 + (0+0+0+0+0+0)*3) % 10 = (10-2)%10 = 8
    const digits = [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8];
    expect(validateEAN13Checksum(digits)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// UPC-A detection
// ---------------------------------------------------------------------------

describe('isUPCA / toUPCA', () => {
  it('identifies UPC-A (EAN-13 with leading zero)', () => {
    expect(isUPCA('0036000291452')).toBe(true);
  });

  it('rejects non-UPC-A EAN-13', () => {
    expect(isUPCA('4006381333931')).toBe(false);
  });

  it('rejects wrong-length strings', () => {
    expect(isUPCA('012345')).toBe(false);
  });

  it('converts EAN-13 to 12-digit UPC-A', () => {
    expect(toUPCA('0036000291452')).toBe('036000291452');
  });

  it('returns non-UPC strings unchanged', () => {
    expect(toUPCA('4006381333931')).toBe('4006381333931');
  });
});

// ---------------------------------------------------------------------------
// Code128 symbol matching
// ---------------------------------------------------------------------------

describe('matchCode128Symbol', () => {
  it('matches Start Code B pattern (value 104)', () => {
    // Start Code B: [2, 1, 1, 2, 1, 4]
    const result = matchCode128Symbol([2, 1, 1, 2, 1, 4]);
    expect(result).toBe(104);
  });

  it('matches value 0 pattern (space character)', () => {
    // Value 0: [2, 1, 2, 2, 2, 2]
    const result = matchCode128Symbol([2, 1, 2, 2, 2, 2]);
    expect(result).toBe(0);
  });

  it('handles proportionally scaled widths', () => {
    // Value 0 doubled: [4, 2, 4, 4, 4, 4]
    const result = matchCode128Symbol([4, 2, 4, 4, 4, 4]);
    expect(result).toBe(0);
  });

  it('rejects invalid width count', () => {
    expect(matchCode128Symbol([1, 2, 3])).toBe(-1);
    expect(matchCode128Symbol([])).toBe(-1);
  });

  it('rejects all-zero widths', () => {
    expect(matchCode128Symbol([0, 0, 0, 0, 0, 0])).toBe(-1);
  });
});

// ---------------------------------------------------------------------------
// decodeEAN13 from run segments
// ---------------------------------------------------------------------------

describe('decodeEAN13', () => {
  it('returns null for empty runs', () => {
    expect(decodeEAN13([])).toBeNull();
  });

  it('returns null for insufficient runs', () => {
    const runs: RunSegment[] = [
      { dark: true, length: 1 },
      { dark: false, length: 1 },
    ];
    expect(decodeEAN13(runs)).toBeNull();
  });

  it('returns null when start guard has wrong pattern', () => {
    // Start guard should be dark-light-dark, but provide light-dark-light
    const runs: RunSegment[] = Array.from({ length: 70 }, (_, i) => ({
      dark: i % 2 === 1,
      length: 1,
    }));
    expect(decodeEAN13(runs)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// decodeCode128 from run segments
// ---------------------------------------------------------------------------

describe('decodeCode128', () => {
  it('returns null for empty runs', () => {
    expect(decodeCode128([])).toBeNull();
  });

  it('returns null for too few runs', () => {
    const runs: RunSegment[] = [
      { dark: true, length: 2 },
      { dark: false, length: 1 },
    ];
    expect(decodeCode128(runs)).toBeNull();
  });

  it('returns null when no start code found', () => {
    // All equal-width bars won't match any start pattern
    const runs: RunSegment[] = Array.from({ length: 20 }, (_, i) => ({
      dark: i % 2 === 0,
      length: 5,
    }));
    expect(decodeCode128(runs)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ProtoPulse label parsing
// ---------------------------------------------------------------------------

describe('parseComponentLabel', () => {
  it('parses PP: format with part number in "p" field', () => {
    const data = 'PP:{"i":"1","n":"ATmega328P","p":"ATMEGA328P-PU","l":"Bin A3","q":25}';
    const result = parseComponentLabel(data);
    expect(result).not.toBeNull();
    expect(result!.partNumber).toBe('ATMEGA328P-PU');
    expect(result!.location).toBe('Bin A3');
    expect(result!.quantity).toBe(25);
  });

  it('falls back to "n" field as part number when "p" is absent', () => {
    const data = 'PP:{"i":"2","n":"LED Red 5mm"}';
    const result = parseComponentLabel(data);
    expect(result).not.toBeNull();
    expect(result!.partNumber).toBe('LED Red 5mm');
  });

  it('parses numeric "i" field as projectId', () => {
    const data = 'PP:{"i":"42","n":"Cap 100uF"}';
    const result = parseComponentLabel(data);
    expect(result).not.toBeNull();
    expect(result!.projectId).toBe(42);
  });

  it('does not set projectId for non-numeric "i"', () => {
    const data = 'PP:{"i":"abc","n":"Resistor"}';
    const result = parseComponentLabel(data);
    expect(result).not.toBeNull();
    expect(result!.projectId).toBeUndefined();
  });

  it('returns null for invalid JSON after PP:', () => {
    expect(parseComponentLabel('PP:not-valid-json')).toBeNull();
  });

  it('returns null for PP: with non-object JSON', () => {
    expect(parseComponentLabel('PP:"just a string"')).toBeNull();
    expect(parseComponentLabel('PP:42')).toBeNull();
    expect(parseComponentLabel('PP:null')).toBeNull();
  });

  it('returns null for PP: with missing required fields', () => {
    expect(parseComponentLabel('PP:{"i":"1"}')).toBeNull();
    expect(parseComponentLabel('PP:{}')).toBeNull();
  });

  it('parses base64url-encoded JSON with partNumber', () => {
    const payload = JSON.stringify({ partNumber: 'ATMEGA328P-PU', location: 'Shelf B', quantity: 10 });
    const encoded = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const result = parseComponentLabel(encoded);
    expect(result).not.toBeNull();
    expect(result!.partNumber).toBe('ATMEGA328P-PU');
    expect(result!.location).toBe('Shelf B');
    expect(result!.quantity).toBe(10);
  });

  it('parses base64url with short field names (pn, loc, pid, qty)', () => {
    const payload = JSON.stringify({ pn: 'ESP32-WROOM', loc: 'Drawer 1', pid: 5, qty: 3 });
    const encoded = btoa(payload).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const result = parseComponentLabel(encoded);
    expect(result).not.toBeNull();
    expect(result!.partNumber).toBe('ESP32-WROOM');
    expect(result!.location).toBe('Drawer 1');
    expect(result!.projectId).toBe(5);
    expect(result!.quantity).toBe(3);
  });

  it('returns null for base64url without partNumber field', () => {
    const payload = JSON.stringify({ name: 'LED', location: 'Box A' });
    const encoded = btoa(payload);
    expect(parseComponentLabel(encoded)).toBeNull();
  });

  it('returns null for non-base64 non-PP: strings', () => {
    expect(parseComponentLabel('just-some-random-text-!!!')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseComponentLabel('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// BarcodeScanner class
// ---------------------------------------------------------------------------

describe('BarcodeScanner', () => {
  it('returns null for empty image data', () => {
    const scanner = new BarcodeScanner();
    const img = createZeroImageData();
    expect(scanner.scanFrame(img)).toBeNull();
  });

  it('returns null for all-white image (no barcode)', () => {
    const scanner = new BarcodeScanner();
    const img = createEmptyImageData(200, 100);
    expect(scanner.scanFrame(img)).toBeNull();
  });

  it('returns null for all-dark image (no barcode)', () => {
    const scanner = new BarcodeScanner();
    const data = new Uint8ClampedArray(200 * 100 * 4);
    // All dark (alpha = 255)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
    const img: ImageData = { data, width: 200, height: 100, colorSpace: 'srgb' as PredefinedColorSpace };
    expect(scanner.scanFrame(img)).toBeNull();
  });

  it('parseRawValue returns QR format for PP: prefixed data', () => {
    const scanner = new BarcodeScanner();
    const result = scanner.parseRawValue('PP:{"i":"1","n":"ATmega328P","p":"ATMEGA328P-PU"}');
    expect(result.format).toBe('qr');
    expect(result.rawValue).toContain('PP:');
    expect(result.parsedComponent).toBeDefined();
    expect(result.parsedComponent!.partNumber).toBe('ATMEGA328P-PU');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('parseRawValue returns unknown format for non-PP: data', () => {
    const scanner = new BarcodeScanner();
    const result = scanner.parseRawValue('https://example.com');
    expect(result.format).toBe('unknown');
    expect(result.rawValue).toBe('https://example.com');
    expect(result.confidence).toBe(0.5);
  });

  it('parseRawValue includes timestamp', () => {
    const scanner = new BarcodeScanner();
    const before = Date.now();
    const result = scanner.parseRawValue('test');
    expect(result.timestamp).toBeGreaterThanOrEqual(before);
    expect(result.timestamp).toBeLessThanOrEqual(Date.now());
  });

  it('accepts custom scanline count and threshold', () => {
    const scanner = new BarcodeScanner({ scanlineCount: 10, luminanceThreshold: 64 });
    const img = createEmptyImageData(100, 100);
    // Should not throw, just return null for blank image
    expect(scanner.scanFrame(img)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ScanSession
// ---------------------------------------------------------------------------

describe('ScanSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeScanResult(rawValue: string, format: BarcodeFormat = 'qr'): ScanResult {
    return {
      format,
      rawValue,
      confidence: 0.9,
      timestamp: Date.now(),
    };
  }

  it('starts in inactive state', () => {
    const session = new ScanSession();
    expect(session.isActive).toBe(false);
  });

  it('becomes active after start()', () => {
    const session = new ScanSession();
    session.start();
    expect(session.isActive).toBe(true);
  });

  it('becomes inactive after stop()', () => {
    const session = new ScanSession();
    session.start();
    session.stop();
    expect(session.isActive).toBe(false);
  });

  it('rejects results when not active', () => {
    const session = new ScanSession();
    const result = makeScanResult('TEST123');
    expect(session.processResult(result)).toBe(false);
    expect(session.scanResults).toHaveLength(0);
  });

  it('accepts first scan result', () => {
    const session = new ScanSession();
    session.start();
    const result = makeScanResult('TEST123');
    expect(session.processResult(result)).toBe(true);
    expect(session.scanResults).toHaveLength(1);
  });

  it('deduplicates same value within window', () => {
    const session = new ScanSession({ deduplicateWindowMs: 2000 });
    session.start();

    const result1 = makeScanResult('SAME');
    expect(session.processResult(result1)).toBe(true);

    // 500ms later, same value should be deduplicated
    vi.advanceTimersByTime(500);
    const result2 = makeScanResult('SAME');
    expect(session.processResult(result2)).toBe(false);

    expect(session.scanResults).toHaveLength(1);
  });

  it('allows same value after deduplication window expires', () => {
    const session = new ScanSession({ deduplicateWindowMs: 2000 });
    session.start();

    const result1 = makeScanResult('SAME');
    expect(session.processResult(result1)).toBe(true);

    // 2100ms later, same value should be accepted again
    vi.advanceTimersByTime(2100);
    const result2 = makeScanResult('SAME');
    expect(session.processResult(result2)).toBe(true);

    expect(session.scanResults).toHaveLength(2);
  });

  it('accepts different values within window', () => {
    const session = new ScanSession({ deduplicateWindowMs: 2000 });
    session.start();

    expect(session.processResult(makeScanResult('VALUE_A'))).toBe(true);
    expect(session.processResult(makeScanResult('VALUE_B'))).toBe(true);
    expect(session.processResult(makeScanResult('VALUE_C'))).toBe(true);

    expect(session.scanResults).toHaveLength(3);
  });

  it('reset() clears results and dedup state', () => {
    const session = new ScanSession();
    session.start();
    session.processResult(makeScanResult('TEST'));
    expect(session.scanResults).toHaveLength(1);

    session.reset();
    expect(session.scanResults).toHaveLength(0);

    // Same value should be accepted again after reset
    expect(session.processResult(makeScanResult('TEST'))).toBe(true);
  });

  it('start() clears previous state', () => {
    const session = new ScanSession();
    session.start();
    session.processResult(makeScanResult('OLD'));
    expect(session.scanResults).toHaveLength(1);

    session.stop();
    session.start();
    expect(session.scanResults).toHaveLength(0);
  });

  it('uses default 2000ms dedup window', () => {
    const session = new ScanSession();
    session.start();

    session.processResult(makeScanResult('X'));

    vi.advanceTimersByTime(1999);
    expect(session.processResult(makeScanResult('X'))).toBe(false);

    vi.advanceTimersByTime(2);
    expect(session.processResult(makeScanResult('X'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// useBarcodeScanner hook
// ---------------------------------------------------------------------------

describe('useBarcodeScanner', () => {
  it('starts in non-scanning state', () => {
    const { result } = renderHook(() => useBarcodeScanner());
    expect(result.current.isScanning).toBe(false);
    expect(result.current.lastResult).toBeNull();
  });

  it('start() activates scanning', () => {
    const { result } = renderHook(() => useBarcodeScanner());
    act(() => {
      result.current.start();
    });
    expect(result.current.isScanning).toBe(true);
  });

  it('stop() deactivates scanning', () => {
    const { result } = renderHook(() => useBarcodeScanner());
    act(() => {
      result.current.start();
    });
    act(() => {
      result.current.stop();
    });
    expect(result.current.isScanning).toBe(false);
  });

  it('parseRaw updates lastResult and calls onScan', () => {
    const onScan = vi.fn<(result: ScanResult) => void>();
    const { result } = renderHook(() => useBarcodeScanner({ onScan }));

    act(() => {
      result.current.parseRaw('PP:{"i":"1","n":"LED","p":"LED-5MM"}');
    });

    expect(result.current.lastResult).not.toBeNull();
    expect(result.current.lastResult!.rawValue).toContain('PP:');
    expect(onScan).toHaveBeenCalledTimes(1);
  });

  it('processFrame returns null for blank image', () => {
    const { result } = renderHook(() => useBarcodeScanner());

    act(() => {
      result.current.start();
    });

    const img = createEmptyImageData(100, 50);
    let scanResult: ScanResult | null = null;
    act(() => {
      scanResult = result.current.processFrame(img);
    });

    expect(scanResult).toBeNull();
  });

  it('processFrame returns null when not scanning', () => {
    const { result } = renderHook(() => useBarcodeScanner());
    const img = createEmptyImageData(100, 50);

    let scanResult: ScanResult | null = null;
    act(() => {
      scanResult = result.current.processFrame(img);
    });

    expect(scanResult).toBeNull();
  });

  it('cleans up on unmount', () => {
    const { result, unmount } = renderHook(() => useBarcodeScanner());
    act(() => {
      result.current.start();
    });
    expect(result.current.isScanning).toBe(true);

    // Should not throw
    unmount();
  });
});

// ---------------------------------------------------------------------------
// Type exports verification
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('BarcodeFormat type accepts valid values', () => {
    const formats: BarcodeFormat[] = ['qr', 'code128', 'ean13', 'upc-a', 'unknown'];
    expect(formats).toHaveLength(5);
  });

  it('ParsedComponentLabel has required and optional fields', () => {
    const label: ParsedComponentLabel = { partNumber: 'TEST-001' };
    expect(label.partNumber).toBe('TEST-001');
    expect(label.location).toBeUndefined();
    expect(label.projectId).toBeUndefined();
    expect(label.quantity).toBeUndefined();
  });

  it('ScanResult has all required fields', () => {
    const result: ScanResult = {
      format: 'qr',
      rawValue: 'test',
      confidence: 0.9,
      timestamp: Date.now(),
    };
    expect(result.format).toBe('qr');
    expect(result.parsedComponent).toBeUndefined();
  });
});
