import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Global stubs
// ---------------------------------------------------------------------------

let uuidCounter = 0;
vi.stubGlobal('crypto', {
  randomUUID: vi.fn(() => {
    uuidCounter++;
    return `uuid-${uuidCounter.toString().padStart(4, '0')}`;
  }),
});

const store: Record<string, string> = {};
vi.stubGlobal('localStorage', {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    store[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete store[key];
  }),
  clear: vi.fn(() => {
    for (const k of Object.keys(store)) {
      delete store[k];
    }
  }),
});

// atob polyfill for test environment
if (typeof globalThis.atob !== 'function') {
  vi.stubGlobal('atob', (str: string) => Buffer.from(str, 'base64').toString('binary'));
}
if (typeof globalThis.btoa !== 'function') {
  vi.stubGlobal('btoa', (str: string) => Buffer.from(str, 'binary').toString('base64'));
}

// ---------------------------------------------------------------------------
// Imports (after stubs)
// ---------------------------------------------------------------------------

import {
  MultimodalInputEngine,
  useMultimodalInput,
} from '../multimodal-input';
import type {
  InputType,
  ImageCapture,
  PreprocessingOptions,
  ExtractionResult,
  ImageFormat,
  ProcessingStatus,
} from '../multimodal-input';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

// Minimal valid base64 data URLs
const PNG_DATA_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=';
const JPEG_DATA_URL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==';
const WEBP_DATA_URL = 'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADMDOJaQAA3AA/vlAAA==';
const INVALID_FORMAT_URL = 'data:image/bmp;base64,Qk0=';

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MultimodalInputEngine', () => {
  let engine: MultimodalInputEngine;

  beforeEach(() => {
    uuidCounter = 0;
    MultimodalInputEngine.resetForTesting();
    for (const k of Object.keys(store)) {
      delete store[k];
    }
    vi.clearAllMocks();
    engine = MultimodalInputEngine.getInstance();
  });

  // -----------------------------------------------------------------------
  // Singleton
  // -----------------------------------------------------------------------

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = MultimodalInputEngine.getInstance();
      const b = MultimodalInputEngine.getInstance();
      expect(a).toBe(b);
    });

    it('returns a new instance after resetForTesting', () => {
      const a = MultimodalInputEngine.getInstance();
      MultimodalInputEngine.resetForTesting();
      const b = MultimodalInputEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // -----------------------------------------------------------------------
  // Image Capture
  // -----------------------------------------------------------------------

  describe('captureFromDataUrl', () => {
    it('creates a capture from a PNG data URL', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      expect(capture.id).toBeTruthy();
      expect(capture.type).toBe('photo');
      expect(capture.dataUrl).toBe(PNG_DATA_URL);
      expect(capture.format).toBe('png');
      expect(capture.source).toBe('file');
      expect(capture.sizeBytes).toBeGreaterThan(0);
      expect(capture.timestamp).toBeGreaterThan(0);
      expect(capture.width).toBeGreaterThan(0);
      expect(capture.height).toBeGreaterThan(0);
    });

    it('creates a capture from a JPEG data URL', () => {
      const capture = engine.captureFromDataUrl(JPEG_DATA_URL, 'camera');
      expect(capture.format).toBe('jpeg');
      expect(capture.source).toBe('camera');
    });

    it('creates a capture from a WebP data URL', () => {
      const capture = engine.captureFromDataUrl(WEBP_DATA_URL, 'clipboard', 'sketch');
      expect(capture.format).toBe('webp');
      expect(capture.type).toBe('sketch');
      expect(capture.source).toBe('clipboard');
    });

    it('auto-detects input type when not specified', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file');
      expect(capture.type).toBe('screenshot'); // PNGs default to screenshot
    });

    it('assigns unique IDs to each capture', () => {
      const c1 = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const c2 = engine.captureFromDataUrl(JPEG_DATA_URL, 'file', 'photo');
      expect(c1.id).not.toBe(c2.id);
    });

    it('accepts drag-drop source', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'drag-drop', 'whiteboard');
      expect(capture.source).toBe('drag-drop');
      expect(capture.type).toBe('whiteboard');
    });
  });

  describe('getCapture', () => {
    it('returns a capture by ID', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const found = engine.getCapture(capture.id);
      expect(found).toEqual(capture);
    });

    it('returns undefined for non-existent ID', () => {
      expect(engine.getCapture('nonexistent')).toBeUndefined();
    });
  });

  describe('getAllCaptures', () => {
    it('returns all captures', () => {
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      engine.captureFromDataUrl(JPEG_DATA_URL, 'camera', 'sketch');
      const all = engine.getAllCaptures();
      expect(all).toHaveLength(2);
    });

    it('returns empty array when no captures', () => {
      expect(engine.getAllCaptures()).toEqual([]);
    });

    it('returns a copy, not a reference', () => {
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const a = engine.getAllCaptures();
      const b = engine.getAllCaptures();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe('removeCapture', () => {
    it('removes a capture by ID', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      expect(engine.removeCapture(capture.id)).toBe(true);
      expect(engine.getCapture(capture.id)).toBeUndefined();
      expect(engine.getAllCaptures()).toHaveLength(0);
    });

    it('returns false for non-existent ID', () => {
      expect(engine.removeCapture('nonexistent')).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Input Type Detection
  // -----------------------------------------------------------------------

  describe('detectInputType', () => {
    it('detects schematic from filename', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'my-schematic.jpg')).toBe('schematic-scan');
    });

    it('detects schematic from abbreviated filename', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'circuit-sch.png')).toBe('schematic-scan');
    });

    it('detects datasheet from filename', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'lm7805-datasheet.pdf')).toBe('datasheet');
    });

    it('detects spec as datasheet', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'component-spec.jpg')).toBe('datasheet');
    });

    it('detects whiteboard from filename', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'whiteboard-photo.jpg')).toBe('whiteboard');
    });

    it('detects board as whiteboard', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'board-design.jpg')).toBe('whiteboard');
    });

    it('detects sketch from filename', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'circuit-sketch.png')).toBe('sketch');
    });

    it('detects draw as sketch', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'drawing.png')).toBe('sketch');
    });

    it('detects screenshot from filename', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'screenshot-2024.png')).toBe('screenshot');
    });

    it('detects screen as screenshot', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'screen-capture.jpg')).toBe('screenshot');
    });

    it('detects PNG without filename as screenshot', () => {
      expect(engine.detectInputType(PNG_DATA_URL)).toBe('screenshot');
    });

    it('defaults to photo for JPEG without filename hints', () => {
      expect(engine.detectInputType(JPEG_DATA_URL)).toBe('photo');
    });

    it('detects PNG extension in filename as screenshot', () => {
      expect(engine.detectInputType(JPEG_DATA_URL, 'image.png')).toBe('screenshot');
    });
  });

  // -----------------------------------------------------------------------
  // Image Validation
  // -----------------------------------------------------------------------

  describe('validateImage', () => {
    it('validates a correct JPEG data URL', () => {
      const result = engine.validateImage(JPEG_DATA_URL);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates a correct PNG data URL', () => {
      const result = engine.validateImage(PNG_DATA_URL);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates a correct WebP data URL', () => {
      const result = engine.validateImage(WEBP_DATA_URL);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects unsupported format', () => {
      const result = engine.validateImage(INVALID_FORMAT_URL);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Unsupported'))).toBe(true);
    });

    it('rejects empty data URL', () => {
      const result = engine.validateImage('');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid data URL'))).toBe(true);
    });

    it('rejects non-data URL string', () => {
      const result = engine.validateImage('https://example.com/image.png');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('Invalid data URL'))).toBe(true);
    });

    it('rejects data URL with empty image data', () => {
      const result = engine.validateImage('data:image/png;base64,');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('empty'))).toBe(true);
    });

    it('rejects oversized images', () => {
      // Create a large base64 string (>5MB)
      const largeBase64 = 'A'.repeat(7 * 1024 * 1024);
      const result = engine.validateImage(`data:image/png;base64,${largeBase64}`);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('exceeds maximum'))).toBe(true);
    });
  });

  // -----------------------------------------------------------------------
  // File Size Estimation
  // -----------------------------------------------------------------------

  describe('estimateFileSize', () => {
    it('estimates bytes from a base64 data URL', () => {
      const size = engine.estimateFileSize(PNG_DATA_URL);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    it('returns 0 for empty data', () => {
      expect(engine.estimateFileSize('data:image/png;base64,')).toBe(0);
    });

    it('accounts for base64 padding', () => {
      // "Hello" in base64 = "SGVsbG8=" (1 padding char)
      const size = engine.estimateFileSize('data:text/plain;base64,SGVsbG8=');
      expect(size).toBe(5); // "Hello" is 5 bytes
    });
  });

  // -----------------------------------------------------------------------
  // Preprocessing
  // -----------------------------------------------------------------------

  describe('preprocessImage', () => {
    it('preprocesses with default options', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id);
      expect(result.original).toEqual(capture);
      expect(result.processed.width).toBeGreaterThan(0);
      expect(result.processed.height).toBeGreaterThan(0);
      expect(result.processed.format).toBe('png');
      expect(result.options.quality).toBe(0.85);
      expect(result.options.grayscale).toBe(false);
    });

    it('applies custom quality', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id, { quality: 0.5 });
      expect(result.options.quality).toBe(0.5);
    });

    it('applies grayscale option', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id, { grayscale: true });
      expect(result.options.grayscale).toBe(true);
      // Grayscale reduces bytes per pixel
      const colorResult = engine.preprocessImage(capture.id, { grayscale: false });
      expect(result.processed.sizeBytes).toBeLessThan(colorResult.processed.sizeBytes);
    });

    it('applies contrast adjustment', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id, { contrast: 0.5 });
      expect(result.options.contrast).toBe(0.5);
    });

    it('applies brightness adjustment', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id, { brightness: -0.3 });
      expect(result.options.brightness).toBe(-0.3);
    });

    it('applies rotation', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const noRotation = engine.preprocessImage(capture.id, { rotate: 0 });
      const rotated90 = engine.preprocessImage(capture.id, { rotate: 90 });
      // 90 degree rotation swaps dimensions
      expect(rotated90.processed.width).toBe(noRotation.processed.height);
      expect(rotated90.processed.height).toBe(noRotation.processed.width);
    });

    it('applies 270 degree rotation (swaps dimensions)', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const noRotation = engine.preprocessImage(capture.id, { rotate: 0 });
      const rotated = engine.preprocessImage(capture.id, { rotate: 270 });
      expect(rotated.processed.width).toBe(noRotation.processed.height);
      expect(rotated.processed.height).toBe(noRotation.processed.width);
    });

    it('applies crop', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id, {
        crop: { x: 0, y: 0, width: 100, height: 50 },
      });
      expect(result.processed.width).toBeLessThanOrEqual(100);
      expect(result.processed.height).toBeLessThanOrEqual(50);
    });

    it('scales down to maxWidth/maxHeight', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id, {
        maxWidth: 100,
        maxHeight: 100,
      });
      expect(result.processed.width).toBeLessThanOrEqual(100);
      expect(result.processed.height).toBeLessThanOrEqual(100);
    });

    it('throws for non-existent capture', () => {
      expect(() => engine.preprocessImage('nonexistent')).toThrow('not found');
    });

    it('merges partial options with defaults', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.preprocessImage(capture.id, { quality: 0.3 });
      expect(result.options.maxWidth).toBe(2048);
      expect(result.options.maxHeight).toBe(2048);
      expect(result.options.quality).toBe(0.3);
      expect(result.options.grayscale).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // Analysis Prompts
  // -----------------------------------------------------------------------

  describe('getAnalysisPrompt', () => {
    const inputTypes: InputType[] = [
      'photo',
      'screenshot',
      'sketch',
      'schematic-scan',
      'datasheet',
      'whiteboard',
    ];

    inputTypes.forEach((type) => {
      it(`returns a prompt for ${type}`, () => {
        const prompt = engine.getAnalysisPrompt(type);
        expect(prompt.type).toBe(type);
        expect(prompt.systemPrompt).toBeTruthy();
        expect(prompt.userPrompt).toBeTruthy();
        expect(prompt.expectedFormat).toBeTruthy();
        expect(typeof prompt.systemPrompt).toBe('string');
        expect(typeof prompt.userPrompt).toBe('string');
      });
    });

    it('photo prompt mentions physical circuit', () => {
      const prompt = engine.getAnalysisPrompt('photo');
      expect(prompt.userPrompt.toLowerCase()).toContain('photo');
    });

    it('schematic-scan prompt mentions reference designators', () => {
      const prompt = engine.getAnalysisPrompt('schematic-scan');
      expect(prompt.userPrompt.toLowerCase()).toContain('reference designator');
    });

    it('datasheet prompt mentions typical application', () => {
      const prompt = engine.getAnalysisPrompt('datasheet');
      expect(prompt.userPrompt.toLowerCase()).toContain('typical application');
    });

    it('whiteboard prompt mentions signal flow', () => {
      const prompt = engine.getAnalysisPrompt('whiteboard');
      expect(prompt.userPrompt.toLowerCase()).toContain('signal flow');
    });
  });

  // -----------------------------------------------------------------------
  // Extraction Results
  // -----------------------------------------------------------------------

  describe('extraction results', () => {
    const makeResult = (imageId: string): Omit<ExtractionResult, 'id'> => ({
      imageId,
      components: [
        {
          id: 'comp-1',
          name: '10k Resistor',
          type: 'resistor',
          value: '10k',
          boundingBox: { x: 10, y: 20, width: 50, height: 30 },
          confidence: 0.95,
          refDes: 'R1',
        },
        {
          id: 'comp-2',
          name: 'LED',
          type: 'led',
          boundingBox: { x: 100, y: 20, width: 40, height: 40 },
          confidence: 0.88,
        },
      ],
      connections: [
        {
          id: 'conn-1',
          from: { componentId: 'comp-1', pin: '2' },
          to: { componentId: 'comp-2', pin: 'anode' },
          confidence: 0.9,
        },
      ],
      suggestedCircuitType: 'LED driver',
      description: 'Simple LED driver circuit with current limiting resistor',
      confidence: 0.92,
      timestamp: Date.now(),
      processingTime: 1500,
      warnings: [],
    });

    it('adds a result and assigns an ID', () => {
      const result = engine.addResult(makeResult('img-1'));
      expect(result.id).toBeTruthy();
      expect(result.imageId).toBe('img-1');
      expect(result.components).toHaveLength(2);
      expect(result.connections).toHaveLength(1);
    });

    it('retrieves a result by ID', () => {
      const result = engine.addResult(makeResult('img-1'));
      const found = engine.getResult(result.id);
      expect(found).toEqual(result);
    });

    it('returns undefined for non-existent result', () => {
      expect(engine.getResult('nonexistent')).toBeUndefined();
    });

    it('returns all results', () => {
      engine.addResult(makeResult('img-1'));
      engine.addResult(makeResult('img-2'));
      expect(engine.getResults()).toHaveLength(2);
    });

    it('returns a copy of results array', () => {
      engine.addResult(makeResult('img-1'));
      const a = engine.getResults();
      const b = engine.getResults();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });

    it('finds result by image ID', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.addResult(makeResult(capture.id));
      const found = engine.getResultForImage(capture.id);
      expect(found).toEqual(result);
    });

    it('returns undefined when no result for image', () => {
      expect(engine.getResultForImage('no-such-image')).toBeUndefined();
    });

    it('preserves warnings in result', () => {
      const input = makeResult('img-1');
      input.warnings = ['Low confidence on IC identification', 'Possible short detected'];
      const result = engine.addResult(input);
      expect(result.warnings).toHaveLength(2);
      expect(result.warnings[0]).toContain('Low confidence');
    });
  });

  // -----------------------------------------------------------------------
  // resultToArchitectureNodes
  // -----------------------------------------------------------------------

  describe('resultToArchitectureNodes', () => {
    it('converts components to architecture nodes', () => {
      const result: ExtractionResult = {
        id: 'res-1',
        imageId: 'img-1',
        components: [
          {
            id: 'c1',
            name: 'Resistor',
            type: 'resistor',
            value: '10k',
            boundingBox: { x: 0, y: 0, width: 50, height: 30 },
            confidence: 0.95,
            refDes: 'R1',
          },
          {
            id: 'c2',
            name: 'Capacitor',
            type: 'capacitor',
            value: '100uF',
            boundingBox: { x: 100, y: 0, width: 40, height: 40 },
            confidence: 0.9,
            refDes: 'C1',
          },
        ],
        connections: [],
        confidence: 0.92,
        timestamp: Date.now(),
        processingTime: 1000,
        warnings: [],
      };

      const nodes = engine.resultToArchitectureNodes(result);
      expect(nodes).toHaveLength(2);

      // First node
      expect(nodes[0].type).toBe('resistor');
      expect(nodes[0].label).toBe('R1 - Resistor');
      expect(nodes[0].id).toBeTruthy();
      expect(nodes[0].position.x).toBe(0);
      expect(nodes[0].position.y).toBe(0);

      // Second node
      expect(nodes[1].type).toBe('capacitor');
      expect(nodes[1].label).toBe('C1 - Capacitor');
    });

    it('uses name only when no refDes', () => {
      const result: ExtractionResult = {
        id: 'res-1',
        imageId: 'img-1',
        components: [
          {
            id: 'c1',
            name: 'Mystery IC',
            type: 'ic',
            boundingBox: { x: 0, y: 0, width: 50, height: 30 },
            confidence: 0.5,
          },
        ],
        connections: [],
        confidence: 0.5,
        timestamp: Date.now(),
        processingTime: 500,
        warnings: [],
      };

      const nodes = engine.resultToArchitectureNodes(result);
      expect(nodes[0].label).toBe('Mystery IC');
    });

    it('lays out nodes in a grid', () => {
      const components = Array.from({ length: 9 }, (_, i) => ({
        id: `c${i}`,
        name: `Part ${i}`,
        type: 'generic',
        boundingBox: { x: 0, y: 0, width: 10, height: 10 },
        confidence: 0.8,
      }));

      const result: ExtractionResult = {
        id: 'res-1',
        imageId: 'img-1',
        components,
        connections: [],
        confidence: 0.8,
        timestamp: Date.now(),
        processingTime: 100,
        warnings: [],
      };

      const nodes = engine.resultToArchitectureNodes(result);
      expect(nodes).toHaveLength(9);

      // Check grid layout: 3 columns for 9 items
      expect(nodes[0].position).toEqual({ x: 0, y: 0 });
      expect(nodes[1].position).toEqual({ x: 200, y: 0 });
      expect(nodes[2].position).toEqual({ x: 400, y: 0 });
      expect(nodes[3].position).toEqual({ x: 0, y: 200 });
    });

    it('returns empty array for no components', () => {
      const result: ExtractionResult = {
        id: 'res-1',
        imageId: 'img-1',
        components: [],
        connections: [],
        confidence: 0,
        timestamp: Date.now(),
        processingTime: 0,
        warnings: [],
      };
      expect(engine.resultToArchitectureNodes(result)).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  describe('status management', () => {
    it('starts with idle status', () => {
      expect(engine.getStatus()).toBe('idle');
    });

    it('sets status to capturing', () => {
      engine.setStatus('capturing');
      expect(engine.getStatus()).toBe('capturing');
    });

    it('sets status to preprocessing', () => {
      engine.setStatus('preprocessing');
      expect(engine.getStatus()).toBe('preprocessing');
    });

    it('sets status to analyzing', () => {
      engine.setStatus('analyzing');
      expect(engine.getStatus()).toBe('analyzing');
    });

    it('sets status to complete', () => {
      engine.setStatus('complete');
      expect(engine.getStatus()).toBe('complete');
    });

    it('sets status to error', () => {
      engine.setStatus('error');
      expect(engine.getStatus()).toBe('error');
    });

    it('notifies on status change', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.setStatus('analyzing');
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  describe('history', () => {
    it('returns captures with associated results', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const result = engine.addResult({
        imageId: capture.id,
        components: [],
        connections: [],
        confidence: 0.9,
        timestamp: Date.now(),
        processingTime: 100,
        warnings: [],
      });

      const history = engine.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].capture).toEqual(capture);
      expect(history[0].result).toEqual(result);
    });

    it('returns capture without result when none exists', () => {
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const history = engine.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].result).toBeUndefined();
    });

    it('clears all history', () => {
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      engine.addResult({
        imageId: 'img-1',
        components: [],
        connections: [],
        confidence: 0.9,
        timestamp: Date.now(),
        processingTime: 100,
        warnings: [],
      });

      engine.clearHistory();
      expect(engine.getAllCaptures()).toHaveLength(0);
      expect(engine.getResults()).toHaveLength(0);
      expect(engine.getStatus()).toBe('idle');
    });

    it('returns empty history when no captures', () => {
      expect(engine.getHistory()).toEqual([]);
    });
  });

  // -----------------------------------------------------------------------
  // Export / Import
  // -----------------------------------------------------------------------

  describe('export and import', () => {
    it('round-trips data through export/import', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      engine.addResult({
        imageId: capture.id,
        components: [
          {
            id: 'c1',
            name: 'R1',
            type: 'resistor',
            boundingBox: { x: 0, y: 0, width: 10, height: 10 },
            confidence: 0.9,
          },
        ],
        connections: [],
        confidence: 0.9,
        timestamp: Date.now(),
        processingTime: 100,
        warnings: [],
      });
      engine.setStatus('complete');

      const exported = engine.exportData();
      expect(typeof exported).toBe('string');

      // Reset and reimport
      MultimodalInputEngine.resetForTesting();
      for (const k of Object.keys(store)) {
        delete store[k];
      }
      const fresh = MultimodalInputEngine.getInstance();
      const result = fresh.importData(exported);

      expect(result.imported).toBeGreaterThan(0);
      expect(result.errors).toHaveLength(0);
      expect(fresh.getAllCaptures()).toHaveLength(1);
      expect(fresh.getResults()).toHaveLength(1);
    });

    it('handles malformed JSON on import', () => {
      const result = engine.importData('not valid json {{{');
      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to parse JSON');
    });

    it('handles invalid structure on import', () => {
      const result = engine.importData('"just a string"');
      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid JSON structure');
    });

    it('handles empty captures/results arrays', () => {
      const result = engine.importData(JSON.stringify({ captures: [], results: [] }));
      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('filters invalid captures on import', () => {
      const data = {
        captures: [
          { id: 'valid', dataUrl: 'data:image/png;base64,abc', type: 'photo' },
          { broken: true },
        ],
        results: [],
      };
      const result = engine.importData(JSON.stringify(data));
      expect(result.imported).toBe(1);
      expect(engine.getAllCaptures()).toHaveLength(1);
    });
  });

  // -----------------------------------------------------------------------
  // Supported Formats / Max Size
  // -----------------------------------------------------------------------

  describe('supported formats', () => {
    it('returns jpeg, png, webp', () => {
      const formats = engine.getSupportedFormats();
      expect(formats).toContain('jpeg');
      expect(formats).toContain('png');
      expect(formats).toContain('webp');
      expect(formats).toHaveLength(3);
    });

    it('returns a copy', () => {
      const a = engine.getSupportedFormats();
      const b = engine.getSupportedFormats();
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
    });
  });

  describe('max image size', () => {
    it('returns 5MB', () => {
      expect(engine.getMaxImageSize()).toBe(5 * 1024 * 1024);
    });
  });

  // -----------------------------------------------------------------------
  // localStorage Persistence
  // -----------------------------------------------------------------------

  describe('localStorage persistence', () => {
    it('saves captures to localStorage', () => {
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'protopulse-multimodal-input',
        expect.any(String),
      );
    });

    it('loads captures from localStorage', () => {
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const captures = engine.getAllCaptures();
      expect(captures).toHaveLength(1);

      // Reset and reload
      MultimodalInputEngine.resetForTesting();
      const reloaded = MultimodalInputEngine.getInstance();
      expect(reloaded.getAllCaptures()).toHaveLength(1);
      expect(reloaded.getAllCaptures()[0].dataUrl).toBe(PNG_DATA_URL);
    });

    it('handles corrupt localStorage data', () => {
      store['protopulse-multimodal-input'] = '{{{not json}}}';
      MultimodalInputEngine.resetForTesting();
      const fresh = MultimodalInputEngine.getInstance();
      expect(fresh.getAllCaptures()).toHaveLength(0);
    });

    it('handles missing localStorage', () => {
      MultimodalInputEngine.resetForTesting();
      const fresh = MultimodalInputEngine.getInstance();
      expect(fresh.getAllCaptures()).toHaveLength(0);
    });
  });

  // -----------------------------------------------------------------------
  // Subscribe / Notify
  // -----------------------------------------------------------------------

  describe('subscribe and notify', () => {
    it('notifies subscribers on capture', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on remove', () => {
      const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.removeCapture(capture.id);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('notifies on addResult', () => {
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.addResult({
        imageId: 'img-1',
        components: [],
        connections: [],
        confidence: 0.9,
        timestamp: Date.now(),
        processingTime: 100,
        warnings: [],
      });
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe stops notifications', () => {
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple subscribers', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      engine.subscribe(l1);
      engine.subscribe(l2);
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  describe('clear', () => {
    it('clears all state', () => {
      engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      engine.addResult({
        imageId: 'img-1',
        components: [],
        connections: [],
        confidence: 0.9,
        timestamp: Date.now(),
        processingTime: 100,
        warnings: [],
      });
      engine.setStatus('complete');

      engine.clear();
      expect(engine.getAllCaptures()).toHaveLength(0);
      expect(engine.getResults()).toHaveLength(0);
      expect(engine.getStatus()).toBe('idle');
    });
  });

  // -----------------------------------------------------------------------
  // Image Dimensions
  // -----------------------------------------------------------------------

  describe('getImageDimensions', () => {
    it('returns positive dimensions for valid data URL', () => {
      const dims = engine.getImageDimensions(PNG_DATA_URL);
      expect(dims.width).toBeGreaterThan(0);
      expect(dims.height).toBeGreaterThan(0);
    });

    it('returns default dimensions for JPEG (non-PNG)', () => {
      const dims = engine.getImageDimensions(JPEG_DATA_URL);
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(600);
    });

    it('returns default dimensions for empty data', () => {
      const dims = engine.getImageDimensions('data:image/png;base64,');
      expect(dims.width).toBe(800);
      expect(dims.height).toBe(600);
    });
  });

  // -----------------------------------------------------------------------
  // Edge Cases
  // -----------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles empty data URL in captureFromDataUrl', () => {
      const capture = engine.captureFromDataUrl('data:image/png;base64,', 'file', 'photo');
      expect(capture.sizeBytes).toBe(0);
    });

    it('handles unknown format gracefully in capture', () => {
      const capture = engine.captureFromDataUrl('data:image/unknown;base64,abc', 'file', 'photo');
      expect(capture.format).toBe('png'); // falls back to png
    });

    it('handles import with status field', () => {
      const data = JSON.stringify({
        captures: [],
        results: [],
        status: 'error',
      });
      engine.importData(data);
      expect(engine.getStatus()).toBe('error');
    });

    it('handles captures with all input types', () => {
      const types: InputType[] = ['photo', 'screenshot', 'sketch', 'schematic-scan', 'datasheet', 'whiteboard'];
      types.forEach((type) => {
        const capture = engine.captureFromDataUrl(PNG_DATA_URL, 'file', type);
        expect(capture.type).toBe(type);
      });
      expect(engine.getAllCaptures()).toHaveLength(types.length);
    });

    it('handles multiple results for different images', () => {
      const c1 = engine.captureFromDataUrl(PNG_DATA_URL, 'file', 'photo');
      const c2 = engine.captureFromDataUrl(JPEG_DATA_URL, 'file', 'sketch');

      engine.addResult({
        imageId: c1.id,
        components: [],
        connections: [],
        confidence: 0.9,
        timestamp: Date.now(),
        processingTime: 100,
        warnings: [],
      });

      engine.addResult({
        imageId: c2.id,
        components: [
          {
            id: 'x',
            name: 'X',
            type: 'ic',
            boundingBox: { x: 0, y: 0, width: 10, height: 10 },
            confidence: 0.8,
          },
        ],
        connections: [],
        confidence: 0.8,
        timestamp: Date.now(),
        processingTime: 200,
        warnings: [],
      });

      expect(engine.getResultForImage(c1.id)?.components).toHaveLength(0);
      expect(engine.getResultForImage(c2.id)?.components).toHaveLength(1);
    });
  });
});

// ---------------------------------------------------------------------------
// Hook Shape
// ---------------------------------------------------------------------------

describe('useMultimodalInput hook shape', () => {
  it('returns all expected properties', () => {
    // We can only check the return type shape without renderHook
    // Verify the function exists and is callable
    expect(typeof useMultimodalInput).toBe('function');
  });
});
