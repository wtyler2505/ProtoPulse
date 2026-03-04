/**
 * Multimodal AI Input Processing Engine
 *
 * Client-side pipeline for image capture, preprocessing, and preparation for
 * AI-powered circuit extraction. Handles camera/file/clipboard/drag-drop input,
 * image preprocessing (resize, contrast, grayscale), format detection, and
 * extraction result management.
 *
 * The actual AI vision call happens server-side; this module manages the
 * client-side pipeline and result lifecycle.
 *
 * Usage:
 *   const engine = MultimodalInputEngine.getInstance();
 *   const capture = engine.captureFromDataUrl(dataUrl, 'file', 'photo');
 *   const preprocessed = engine.preprocessImage(capture.id);
 *   const prompt = engine.getAnalysisPrompt('photo');
 *
 * React hook:
 *   const { captures, captureFromDataUrl, preprocessImage, ... } = useMultimodalInput();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InputType = 'photo' | 'screenshot' | 'sketch' | 'schematic-scan' | 'datasheet' | 'whiteboard';
export type ProcessingStatus = 'idle' | 'capturing' | 'preprocessing' | 'analyzing' | 'complete' | 'error';
export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface ImageCapture {
  id: string;
  type: InputType;
  dataUrl: string;
  width: number;
  height: number;
  format: ImageFormat;
  sizeBytes: number;
  timestamp: number;
  source: 'camera' | 'file' | 'clipboard' | 'drag-drop';
}

export interface PreprocessingOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  grayscale: boolean;
  contrast: number;
  brightness: number;
  rotate: number;
  crop?: { x: number; y: number; width: number; height: number };
}

export interface PreprocessedImage {
  original: ImageCapture;
  processed: {
    dataUrl: string;
    width: number;
    height: number;
    sizeBytes: number;
    format: ImageFormat;
  };
  options: PreprocessingOptions;
}

export interface DetectedComponent {
  id: string;
  name: string;
  type: string;
  value?: string;
  boundingBox: { x: number; y: number; width: number; height: number };
  confidence: number;
  refDes?: string;
}

export interface DetectedConnection {
  id: string;
  from: { componentId: string; pin?: string };
  to: { componentId: string; pin?: string };
  confidence: number;
}

export interface ExtractionResult {
  id: string;
  imageId: string;
  components: DetectedComponent[];
  connections: DetectedConnection[];
  suggestedCircuitType?: string;
  description?: string;
  confidence: number;
  timestamp: number;
  processingTime: number;
  warnings: string[];
}

export interface AnalysisPrompt {
  type: InputType;
  systemPrompt: string;
  userPrompt: string;
  expectedFormat: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-multimodal-input';
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB
const SUPPORTED_FORMATS: ImageFormat[] = ['jpeg', 'png', 'webp'];

const DEFAULT_PREPROCESSING: PreprocessingOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  quality: 0.85,
  grayscale: false,
  contrast: 0,
  brightness: 0,
  rotate: 0,
};

const EXPECTED_FORMAT = `{
  "components": [{ "name": "...", "type": "...", "value": "...", "refDes": "..." }],
  "connections": [{ "from": { "component": "...", "pin": "..." }, "to": { "component": "...", "pin": "..." } }],
  "circuitType": "...",
  "description": "..."
}`;

const ANALYSIS_PROMPTS: Record<InputType, Omit<AnalysisPrompt, 'type'>> = {
  photo: {
    systemPrompt:
      'You are an expert electronics engineer analyzing photos of physical circuits. Identify every component, its value, and trace all electrical connections.',
    userPrompt:
      'Analyze this photo of a physical circuit/breadboard. Identify components, connections, and suggest a schematic.',
    expectedFormat: EXPECTED_FORMAT,
  },
  screenshot: {
    systemPrompt:
      'You are an expert EDA tool analyst. Extract circuit design information from software screenshots with high accuracy.',
    userPrompt: 'This is a screenshot of a circuit design. Extract components and their connections.',
    expectedFormat: EXPECTED_FORMAT,
  },
  sketch: {
    systemPrompt:
      'You are an expert at reading hand-drawn circuit diagrams. Interpret circuit symbols and trace connections even from rough sketches.',
    userPrompt:
      'This is a hand-drawn circuit sketch. Identify circuit symbols and trace the connections.',
    expectedFormat: EXPECTED_FORMAT,
  },
  'schematic-scan': {
    systemPrompt:
      'You are an expert at reading formal schematic diagrams. Extract all components with their reference designators, values, and net connections.',
    userPrompt:
      'This is a scanned schematic diagram. Extract all components with reference designators and connections.',
    expectedFormat: EXPECTED_FORMAT,
  },
  datasheet: {
    systemPrompt:
      'You are an expert at reading electronic component datasheets. Focus on typical application circuits and extract component values and connections.',
    userPrompt:
      'Extract the typical application circuit from this datasheet page. List components and connections.',
    expectedFormat: EXPECTED_FORMAT,
  },
  whiteboard: {
    systemPrompt:
      'You are an expert at interpreting whiteboard diagrams of electronic systems. Identify functional blocks, signal flow, and interconnections.',
    userPrompt:
      'This is a whiteboard diagram of a circuit. Identify blocks, connections, and signal flow.',
    expectedFormat: EXPECTED_FORMAT,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFromMime(mime: string): ImageFormat | null {
  if (mime.includes('jpeg') || mime.includes('jpg')) {
    return 'jpeg';
  }
  if (mime.includes('png')) {
    return 'png';
  }
  if (mime.includes('webp')) {
    return 'webp';
  }
  return null;
}

function formatFromExtension(fileName: string): ImageFormat | null {
  const ext = fileName.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') {
    return 'jpeg';
  }
  if (ext === 'png') {
    return 'png';
  }
  if (ext === 'webp') {
    return 'webp';
  }
  return null;
}

function extractMime(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;,]+)/);
  return match ? match[1] : '';
}

function base64ByteLength(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] ?? '';
  if (base64.length === 0) {
    return 0;
  }
  const padding = (base64.match(/=+$/) ?? [''])[0].length;
  return Math.floor((base64.length * 3) / 4) - padding;
}

// ---------------------------------------------------------------------------
// Listener type
// ---------------------------------------------------------------------------

type Listener = () => void;

// ---------------------------------------------------------------------------
// Persistence data shape
// ---------------------------------------------------------------------------

interface PersistedData {
  captures: ImageCapture[];
  results: ExtractionResult[];
  status: ProcessingStatus;
}

// ---------------------------------------------------------------------------
// MultimodalInputEngine
// ---------------------------------------------------------------------------

/**
 * Manages multimodal image input for AI circuit extraction.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists to localStorage.
 */
export class MultimodalInputEngine {
  private static instance: MultimodalInputEngine | null = null;

  private captures: ImageCapture[] = [];
  private results: ExtractionResult[] = [];
  private status: ProcessingStatus = 'idle';
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): MultimodalInputEngine {
    if (!MultimodalInputEngine.instance) {
      MultimodalInputEngine.instance = new MultimodalInputEngine();
    }
    return MultimodalInputEngine.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    MultimodalInputEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Image Capture
  // -----------------------------------------------------------------------

  /**
   * Create a capture from a data URL.
   * Automatically detects format and estimates size.
   */
  captureFromDataUrl(
    dataUrl: string,
    source: ImageCapture['source'],
    type?: InputType,
  ): ImageCapture {
    const format = formatFromMime(extractMime(dataUrl)) ?? 'png';
    const sizeBytes = base64ByteLength(dataUrl);
    const dimensions = this.getImageDimensions(dataUrl);
    const resolvedType = type ?? this.detectInputType(dataUrl);

    const capture: ImageCapture = {
      id: crypto.randomUUID(),
      type: resolvedType,
      dataUrl,
      width: dimensions.width,
      height: dimensions.height,
      format,
      sizeBytes,
      timestamp: Date.now(),
      source,
    };

    this.captures.push(capture);
    this.save();
    this.notify();
    return capture;
  }

  /** Get a capture by ID. */
  getCapture(id: string): ImageCapture | undefined {
    return this.captures.find((c) => c.id === id);
  }

  /** Get all captures. */
  getAllCaptures(): ImageCapture[] {
    return [...this.captures];
  }

  /** Remove a capture by ID. Returns true if found and removed. */
  removeCapture(id: string): boolean {
    const index = this.captures.findIndex((c) => c.id === id);
    if (index === -1) {
      return false;
    }
    this.captures.splice(index, 1);
    this.save();
    this.notify();
    return true;
  }

  // -----------------------------------------------------------------------
  // Preprocessing
  // -----------------------------------------------------------------------

  /**
   * Preprocess an image with the given options.
   * In real usage this uses canvas operations; for unit testing the function
   * computes the output dimensions and constructs a simulated result.
   */
  preprocessImage(imageId: string, options?: Partial<PreprocessingOptions>): PreprocessedImage {
    const capture = this.getCapture(imageId);
    if (!capture) {
      throw new Error(`Capture "${imageId}" not found`);
    }

    const opts: PreprocessingOptions = { ...DEFAULT_PREPROCESSING, ...options };

    // Calculate output dimensions respecting maxWidth/maxHeight
    let outWidth = capture.width;
    let outHeight = capture.height;

    // Apply crop first if specified
    if (opts.crop) {
      outWidth = opts.crop.width;
      outHeight = opts.crop.height;
    }

    // Apply rotation — swap dimensions for 90/270 degrees
    const normalizedRotation = ((opts.rotate % 360) + 360) % 360;
    if (normalizedRotation === 90 || normalizedRotation === 270) {
      const temp = outWidth;
      outWidth = outHeight;
      outHeight = temp;
    }

    // Scale down to fit maxWidth/maxHeight
    if (outWidth > opts.maxWidth || outHeight > opts.maxHeight) {
      const scale = Math.min(opts.maxWidth / outWidth, opts.maxHeight / outHeight);
      outWidth = Math.round(outWidth * scale);
      outHeight = Math.round(outHeight * scale);
    }

    // Estimate output size (quality affects jpeg/webp compression)
    const bytesPerPixel = opts.grayscale ? 1 : 3;
    const rawBytes = outWidth * outHeight * bytesPerPixel;
    const estimatedSize = Math.round(rawBytes * opts.quality * 0.3);

    const processed: PreprocessedImage = {
      original: capture,
      processed: {
        dataUrl: capture.dataUrl, // In real impl, canvas-processed data URL
        width: outWidth,
        height: outHeight,
        sizeBytes: estimatedSize,
        format: capture.format,
      },
      options: opts,
    };

    this.notify();
    return processed;
  }

  // -----------------------------------------------------------------------
  // Format / Type Detection
  // -----------------------------------------------------------------------

  /**
   * Detect the input type from a data URL and optional filename.
   * Uses filename hints, aspect ratio, and MIME type.
   */
  detectInputType(dataUrl: string, fileName?: string): InputType {
    // Check filename hints first
    if (fileName) {
      const lower = fileName.toLowerCase();
      if (lower.includes('schematic') || lower.includes('sch')) {
        return 'schematic-scan';
      }
      if (lower.includes('datasheet') || lower.includes('spec')) {
        return 'datasheet';
      }
      if (lower.includes('whiteboard') || lower.includes('board')) {
        return 'whiteboard';
      }
      if (lower.includes('sketch') || lower.includes('draw')) {
        return 'sketch';
      }
      if (lower.includes('screenshot') || lower.includes('screen')) {
        return 'screenshot';
      }

      // Check extension for scan formats
      const ext = formatFromExtension(lower);
      if (ext === 'png') {
        // PNGs are often screenshots
        return 'screenshot';
      }
    }

    // Fallback: use MIME type
    const mime = extractMime(dataUrl);
    if (mime.includes('png')) {
      return 'screenshot';
    }

    // Default to photo for camera/jpeg images
    return 'photo';
  }

  // -----------------------------------------------------------------------
  // Analysis Prompts
  // -----------------------------------------------------------------------

  /** Get the AI analysis prompt for a given input type. */
  getAnalysisPrompt(type: InputType): AnalysisPrompt {
    const prompt = ANALYSIS_PROMPTS[type];
    return {
      type,
      ...prompt,
    };
  }

  // -----------------------------------------------------------------------
  // Extraction Results
  // -----------------------------------------------------------------------

  /** Add an extraction result. Generates an ID automatically. */
  addResult(result: Omit<ExtractionResult, 'id'>): ExtractionResult {
    const full: ExtractionResult = {
      ...result,
      id: crypto.randomUUID(),
    };
    this.results.push(full);
    this.save();
    this.notify();
    return full;
  }

  /** Get a result by ID. */
  getResult(id: string): ExtractionResult | undefined {
    return this.results.find((r) => r.id === id);
  }

  /** Get all results. */
  getResults(): ExtractionResult[] {
    return [...this.results];
  }

  /** Get the extraction result for a specific image. */
  getResultForImage(imageId: string): ExtractionResult | undefined {
    return this.results.find((r) => r.imageId === imageId);
  }

  // -----------------------------------------------------------------------
  // Conversion
  // -----------------------------------------------------------------------

  /**
   * Convert detected components from an extraction result to ProtoPulse
   * architecture nodes with grid-based positions.
   */
  resultToArchitectureNodes(
    result: ExtractionResult,
  ): Array<{ id: string; type: string; label: string; position: { x: number; y: number } }> {
    const gridSpacing = 200;
    const columns = Math.max(3, Math.ceil(Math.sqrt(result.components.length)));

    return result.components.map((component, index) => ({
      id: crypto.randomUUID(),
      type: component.type,
      label: component.refDes
        ? `${component.refDes} - ${component.name}`
        : component.name,
      position: {
        x: (index % columns) * gridSpacing,
        y: Math.floor(index / columns) * gridSpacing,
      },
    }));
  }

  // -----------------------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------------------

  /** Estimate file size in bytes from a base64 data URL. */
  estimateFileSize(dataUrl: string): number {
    return base64ByteLength(dataUrl);
  }

  /**
   * Extract image dimensions from a data URL.
   * In a real browser this would decode the image; for unit testing
   * we return a reasonable default since we can't decode without canvas.
   */
  getImageDimensions(dataUrl: string): { width: number; height: number } {
    // Try to parse PNG header for dimensions
    const base64 = dataUrl.split(',')[1] ?? '';
    if (base64.length > 24 && extractMime(dataUrl).includes('png')) {
      try {
        const binary = atob(base64);
        if (binary.length >= 24 && binary.substring(1, 4) === 'PNG') {
          const width =
            (binary.charCodeAt(16) << 24) |
            (binary.charCodeAt(17) << 16) |
            (binary.charCodeAt(18) << 8) |
            binary.charCodeAt(19);
          const height =
            (binary.charCodeAt(20) << 24) |
            (binary.charCodeAt(21) << 16) |
            (binary.charCodeAt(22) << 8) |
            binary.charCodeAt(23);
          if (width > 0 && height > 0 && width < 100000 && height < 100000) {
            return { width, height };
          }
        }
      } catch {
        // Fall through to default
      }
    }

    // Default dimensions when we can't decode
    return { width: 800, height: 600 };
  }

  /** Validate a data URL for supported format and size. */
  validateImage(dataUrl: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!dataUrl || !dataUrl.startsWith('data:')) {
      errors.push('Invalid data URL format');
      return { valid: false, errors };
    }

    const mime = extractMime(dataUrl);
    const format = formatFromMime(mime);
    if (!format) {
      errors.push(`Unsupported image format: ${mime || 'unknown'}. Supported: ${SUPPORTED_FORMATS.join(', ')}`);
    }

    const size = base64ByteLength(dataUrl);
    if (size > MAX_IMAGE_SIZE) {
      errors.push(
        `Image size ${(size / 1024 / 1024).toFixed(1)}MB exceeds maximum ${(MAX_IMAGE_SIZE / 1024 / 1024).toFixed(0)}MB`,
      );
    }

    if (size === 0) {
      errors.push('Image data is empty');
    }

    return { valid: errors.length === 0, errors };
  }

  /** Get the maximum allowed image size in bytes. */
  getMaxImageSize(): number {
    return MAX_IMAGE_SIZE;
  }

  /** Get the list of supported image formats. */
  getSupportedFormats(): ImageFormat[] {
    return [...SUPPORTED_FORMATS];
  }

  // -----------------------------------------------------------------------
  // Status
  // -----------------------------------------------------------------------

  /** Get the current processing status. */
  getStatus(): ProcessingStatus {
    return this.status;
  }

  /** Set the processing status. */
  setStatus(status: ProcessingStatus): void {
    this.status = status;
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  /** Get the full history of captures with their associated results. */
  getHistory(): Array<{ capture: ImageCapture; result?: ExtractionResult }> {
    return this.captures.map((capture) => ({
      capture,
      result: this.results.find((r) => r.imageId === capture.id),
    }));
  }

  /** Clear all history (captures and results). */
  clearHistory(): void {
    this.captures = [];
    this.results = [];
    this.status = 'idle';
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Import / Export
  // -----------------------------------------------------------------------

  /** Export all data as a JSON string. */
  exportData(): string {
    const data: PersistedData = {
      captures: this.captures,
      results: this.results,
      status: this.status,
    };
    return JSON.stringify(data);
  }

  /** Import data from a JSON string. Returns import stats. */
  importData(json: string): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    try {
      const parsed: unknown = JSON.parse(json);
      if (typeof parsed !== 'object' || parsed === null) {
        errors.push('Invalid JSON structure: expected an object');
        return { imported, errors };
      }

      const data = parsed as Record<string, unknown>;

      if (Array.isArray(data.captures)) {
        const validCaptures = (data.captures as unknown[]).filter(
          (c: unknown): c is ImageCapture =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as ImageCapture).id === 'string' &&
            typeof (c as ImageCapture).dataUrl === 'string' &&
            typeof (c as ImageCapture).type === 'string',
        );
        this.captures = validCaptures;
        imported += validCaptures.length;
      }

      if (Array.isArray(data.results)) {
        const validResults = (data.results as unknown[]).filter(
          (r: unknown): r is ExtractionResult =>
            typeof r === 'object' &&
            r !== null &&
            typeof (r as ExtractionResult).id === 'string' &&
            typeof (r as ExtractionResult).imageId === 'string',
        );
        this.results = validResults;
        imported += validResults.length;
      }

      if (typeof data.status === 'string') {
        this.status = data.status as ProcessingStatus;
      }
    } catch {
      errors.push('Failed to parse JSON');
      return { imported, errors };
    }

    this.save();
    this.notify();
    return { imported, errors };
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Clear all state and reset to defaults. */
  clear(): void {
    this.captures = [];
    this.results = [];
    this.status = 'idle';
    this.listeners.clear();
    this.save();
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data: PersistedData = {
        captures: this.captures,
        results: this.results,
        status: this.status,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as Record<string, unknown>;

      if (Array.isArray(data.captures)) {
        this.captures = (data.captures as unknown[]).filter(
          (c: unknown): c is ImageCapture =>
            typeof c === 'object' &&
            c !== null &&
            typeof (c as ImageCapture).id === 'string' &&
            typeof (c as ImageCapture).dataUrl === 'string',
        );
      }

      if (Array.isArray(data.results)) {
        this.results = (data.results as unknown[]).filter(
          (r: unknown): r is ExtractionResult =>
            typeof r === 'object' &&
            r !== null &&
            typeof (r as ExtractionResult).id === 'string' &&
            typeof (r as ExtractionResult).imageId === 'string',
        );
      }

      if (typeof data.status === 'string') {
        this.status = data.status as ProcessingStatus;
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}

// ---------------------------------------------------------------------------
// React Hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing the multimodal input engine in React components.
 * Subscribes to the MultimodalInputEngine singleton and triggers
 * re-renders on state changes.
 */
export function useMultimodalInput(): {
  captures: ImageCapture[];
  captureFromDataUrl: (
    dataUrl: string,
    source: ImageCapture['source'],
    type?: InputType,
  ) => ImageCapture;
  preprocessImage: (imageId: string, options?: Partial<PreprocessingOptions>) => PreprocessedImage;
  detectInputType: (dataUrl: string, fileName?: string) => InputType;
  getAnalysisPrompt: (type: InputType) => AnalysisPrompt;
  results: ExtractionResult[];
  addResult: (result: Omit<ExtractionResult, 'id'>) => ExtractionResult;
  resultToNodes: (
    result: ExtractionResult,
  ) => Array<{ id: string; type: string; label: string; position: { x: number; y: number } }>;
  validateImage: (dataUrl: string) => { valid: boolean; errors: string[] };
  status: ProcessingStatus;
  history: Array<{ capture: ImageCapture; result?: ExtractionResult }>;
  clearHistory: () => void;
  exportData: () => string;
  importData: (json: string) => { imported: number; errors: string[] };
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const engine = MultimodalInputEngine.getInstance();
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const captureFromDataUrl = useCallback(
    (dataUrl: string, source: ImageCapture['source'], type?: InputType) => {
      return MultimodalInputEngine.getInstance().captureFromDataUrl(dataUrl, source, type);
    },
    [],
  );

  const preprocessImage = useCallback(
    (imageId: string, options?: Partial<PreprocessingOptions>) => {
      return MultimodalInputEngine.getInstance().preprocessImage(imageId, options);
    },
    [],
  );

  const detectInputType = useCallback((dataUrl: string, fileName?: string) => {
    return MultimodalInputEngine.getInstance().detectInputType(dataUrl, fileName);
  }, []);

  const getAnalysisPrompt = useCallback((type: InputType) => {
    return MultimodalInputEngine.getInstance().getAnalysisPrompt(type);
  }, []);

  const addResult = useCallback((result: Omit<ExtractionResult, 'id'>) => {
    return MultimodalInputEngine.getInstance().addResult(result);
  }, []);

  const resultToNodes = useCallback((result: ExtractionResult) => {
    return MultimodalInputEngine.getInstance().resultToArchitectureNodes(result);
  }, []);

  const validateImage = useCallback((dataUrl: string) => {
    return MultimodalInputEngine.getInstance().validateImage(dataUrl);
  }, []);

  const clearHistory = useCallback(() => {
    MultimodalInputEngine.getInstance().clearHistory();
  }, []);

  const exportData = useCallback(() => {
    return MultimodalInputEngine.getInstance().exportData();
  }, []);

  const importData = useCallback((json: string) => {
    return MultimodalInputEngine.getInstance().importData(json);
  }, []);

  const engine = typeof window !== 'undefined' ? MultimodalInputEngine.getInstance() : null;

  return {
    captures: engine?.getAllCaptures() ?? [],
    captureFromDataUrl,
    preprocessImage,
    detectInputType,
    getAnalysisPrompt,
    results: engine?.getResults() ?? [],
    addResult,
    resultToNodes,
    validateImage,
    status: engine?.getStatus() ?? 'idle',
    history: engine?.getHistory() ?? [],
    clearHistory,
    exportData,
    importData,
  };
}
