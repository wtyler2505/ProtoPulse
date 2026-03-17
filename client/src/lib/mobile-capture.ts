/**
 * Mobile Capture Manager — Multi-Modal Hardware Input for Makers
 *
 * Provides a unified capture pipeline for photo-to-part identification,
 * handwritten-note-to-BOM parsing, barcode scanning, and voice note
 * transcription. Designed for mobile/tablet workflows where a maker
 * snaps a photo of a component, scribbles a note, scans a bag label,
 * or dictates a build log entry — and ProtoPulse turns it into
 * structured project data without leaving the app.
 *
 * Features:
 * - Photo capture via getUserMedia or file input (returns data URL)
 * - Photo-to-part extraction (component name, value, package, confidence)
 * - Note-to-BOM parsing (quantity, designator, value, description)
 * - Multi-step CaptureSession with ordered steps and completion tracking
 * - Singleton+subscribe pattern with React hook
 *
 * Usage:
 *   const manager = MobileCaptureManager.getInstance();
 *   const dataUrl = await manager.capturePhoto();
 *   const part = manager.photoToPart(dataUrl);
 *
 * React hook:
 *   const { captures, capturePhoto, photoToPart, noteToBom, ... } = useMobileCapture();
 */

import { useCallback, useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaptureType = 'photo_to_part' | 'note_to_bom' | 'barcode_scan' | 'voice_note';

export interface CaptureResult {
  type: CaptureType;
  data: string;
  timestamp: number;
  metadata: Record<string, unknown>;
}

export interface ExtractedPart {
  name: string;
  value: string | null;
  packageType: string | null;
  confidence: number;
  rawText: string;
}

export interface ParsedBomEntry {
  quantity: number;
  designator: string | null;
  value: string | null;
  description: string;
  rawText: string;
}

export type CaptureSessionStatus = 'idle' | 'in_progress' | 'complete' | 'cancelled';

export interface CaptureStep {
  id: string;
  label: string;
  type: CaptureType;
  completed: boolean;
  result: CaptureResult | null;
}

export interface CaptureSession {
  id: string;
  steps: CaptureStep[];
  status: CaptureSessionStatus;
  createdAt: number;
  completedAt: number | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'protopulse-mobile-captures';
const MAX_CAPTURES = 100;

/**
 * Common passive component patterns: "<quantity>x <value> <package>", "R1 10K 0805", etc.
 * Used by photoToPart heuristic extraction.
 */
const COMPONENT_PATTERN =
  /(?:(\d+)\s*[xX]\s+)?(\d+(?:\.\d+)?)\s*(p|n|u|µ|m|k|K|M|G)?\s*(F|H|Ω|ohm|R|C|L)?\s*(?:(\d{4}|SOT-?\d+|SOP-?\d+|DIP-?\d+|QFP-?\d+|SOIC-?\d+|TO-?\d+))?/i;

/**
 * BOM note patterns: "3x 10K resistor 0805", "C1 100nF ceramic", "U1 ATmega328P DIP-28"
 */
const BOM_LINE_PATTERN =
  /^(?:(\d+)\s*[xX]\s+)?(?:([A-Z]{1,3}\d{1,4})\s+)?(.+?)(?:\s+(\d{4}|SOT-?\d+|SOP-?\d+|DIP-?\d+|QFP-?\d+|SOIC-?\d+|TO-?\d+))?$/i;

const VALUE_PATTERN = /(\d+(?:\.\d+)?)\s*(p|n|u|µ|m|k|K|M|G)?\s*(F|H|Ω|ohm|R|C|L)?/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Listener = () => void;

/**
 * Extract component info from a text string (e.g., OCR output or filename).
 * Returns null if no recognisable component pattern is found.
 */
function extractPartFromText(text: string): ExtractedPart | null {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const match = COMPONENT_PATTERN.exec(trimmed);
  if (!match) {
    // Fall back: treat the whole string as a component name with low confidence
    return {
      name: trimmed,
      value: null,
      packageType: null,
      confidence: 0.2,
      rawText: trimmed,
    };
  }

  const numericValue = match[2] ?? '';
  const prefix = match[3] ?? '';
  const unit = match[4] ?? '';
  const pkg = match[5] ?? null;

  const value = numericValue ? `${numericValue}${prefix}${unit}`.trim() : null;

  // Derive a human-readable name from the unit
  let name = 'Component';
  const unitLower = unit.toLowerCase();
  if (unitLower === 'r' || unitLower === 'ω' || unitLower === 'ohm') {
    name = 'Resistor';
  } else if (unitLower === 'f') {
    name = 'Capacitor';
  } else if (unitLower === 'h') {
    name = 'Inductor';
  } else if (unitLower === 'c') {
    name = 'Capacitor';
  } else if (unitLower === 'l') {
    name = 'Inductor';
  }

  // Confidence based on how much information we could extract
  let confidence = 0.4;
  if (value) {
    confidence += 0.2;
  }
  if (pkg) {
    confidence += 0.2;
  }
  if (unit) {
    confidence += 0.1;
  }
  confidence = Math.min(confidence, 1.0);

  return {
    name,
    value,
    packageType: pkg,
    confidence,
    rawText: trimmed,
  };
}

/**
 * Parse a freeform text note into a BOM entry.
 * Handles patterns like "3x 10K resistor 0805" or "C1 100nF ceramic".
 */
function parseBomFromText(text: string): ParsedBomEntry {
  const trimmed = text.trim();
  const match = BOM_LINE_PATTERN.exec(trimmed);

  if (!match) {
    return {
      quantity: 1,
      designator: null,
      value: null,
      description: trimmed,
      rawText: trimmed,
    };
  }

  const qty = match[1] ? parseInt(match[1], 10) : 1;
  const designator = match[2] ?? null;
  const body = match[3]?.trim() ?? trimmed;

  // Try to pull a value (e.g., "10K", "100nF") from the body
  const valueMatch = VALUE_PATTERN.exec(body);
  let value: string | null = null;
  if (valueMatch) {
    const numVal = valueMatch[1] ?? '';
    const pfx = valueMatch[2] ?? '';
    const u = valueMatch[3] ?? '';
    value = `${numVal}${pfx}${u}`.trim() || null;
  }

  return {
    quantity: qty,
    designator,
    value,
    description: body,
    rawText: trimmed,
  };
}

// ---------------------------------------------------------------------------
// Persistence data shape
// ---------------------------------------------------------------------------

interface PersistedData {
  captures: CaptureResult[];
  sessions: CaptureSession[];
}

// ---------------------------------------------------------------------------
// MobileCaptureManager
// ---------------------------------------------------------------------------

/**
 * Manages mobile capture workflows: photo, note, barcode, voice.
 * Singleton per application. Notifies subscribers on state changes.
 * Persists capture history to localStorage.
 */
export class MobileCaptureManager {
  private static instance: MobileCaptureManager | null = null;

  private captures: CaptureResult[] = [];
  private sessions: CaptureSession[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  /** Get or create the singleton instance. */
  static getInstance(): MobileCaptureManager {
    if (!MobileCaptureManager.instance) {
      MobileCaptureManager.instance = new MobileCaptureManager();
    }
    return MobileCaptureManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetInstance(): void {
    MobileCaptureManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  /** Subscribe to state changes. Returns an unsubscribe function. */
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
  // Queries
  // -----------------------------------------------------------------------

  /** Get all capture results, newest first. Returns a copy. */
  getCaptures(): CaptureResult[] {
    return [...this.captures].sort((a, b) => b.timestamp - a.timestamp);
  }

  /** Get captures filtered by type. */
  getCapturesByType(type: CaptureType): CaptureResult[] {
    return this.getCaptures().filter((c) => c.type === type);
  }

  /** Get the total number of captures. */
  getCaptureCount(): number {
    return this.captures.length;
  }

  /** Get all sessions. */
  getSessions(): CaptureSession[] {
    return [...this.sessions];
  }

  /** Get a session by ID, or null if not found. */
  getSession(sessionId: string): CaptureSession | null {
    return this.sessions.find((s) => s.id === sessionId) ?? null;
  }

  // -----------------------------------------------------------------------
  // Photo Capture
  // -----------------------------------------------------------------------

  /**
   * Capture a photo using getUserMedia (camera) and return a data URL.
   * Falls back gracefully when getUserMedia is unavailable (e.g., desktop, tests).
   * In a real mobile environment this opens the rear camera, takes a snapshot
   * via a hidden <video>+<canvas>, and returns the result.
   *
   * This is a simplified implementation; the full camera UI would be in a
   * React component that calls this method.
   */
  async capturePhoto(): Promise<string> {
    // Check for getUserMedia support
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      throw new Error('Camera access is not available in this environment');
    }

    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      });

      const video = document.createElement('video');
      video.srcObject = stream;
      video.setAttribute('playsinline', 'true');

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          video.play().then(resolve).catch(reject);
        };
        video.onerror = () => {
          reject(new Error('Failed to load video stream'));
        };
      });

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to create canvas context');
      }
      ctx.drawImage(video, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      return dataUrl;
    } finally {
      if (stream) {
        for (const track of stream.getTracks()) {
          track.stop();
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Photo-to-Part
  // -----------------------------------------------------------------------

  /**
   * Extract part information from a photo data URL.
   * In production this would call an AI vision endpoint; here we use
   * heuristic text extraction from the data URL metadata / filename hint
   * embedded in the metadata query parameter.
   *
   * For real AI-powered extraction, the caller should send the data URL
   * to the server's vision tool (identify_component_from_image).
   */
  photoToPart(dataUrl: string, hintText?: string): ExtractedPart | null {
    // Validate input
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      return null;
    }

    // Use hint text if provided (e.g., filename or OCR result)
    const textToAnalyze = hintText ?? '';
    if (textToAnalyze.length === 0) {
      // Without a text hint, return a minimal result indicating the image was received
      return {
        name: 'Unknown Component',
        value: null,
        packageType: null,
        confidence: 0.1,
        rawText: '',
      };
    }

    return extractPartFromText(textToAnalyze);
  }

  // -----------------------------------------------------------------------
  // Note-to-BOM
  // -----------------------------------------------------------------------

  /**
   * Parse a freeform text note into a structured BOM entry.
   * Handles patterns like:
   * - "3x 10K resistor 0805"
   * - "C1 100nF ceramic cap"
   * - "ATmega328P DIP-28"
   * - "5x LED red 5mm"
   */
  noteToBom(text: string): ParsedBomEntry {
    return parseBomFromText(text);
  }

  // -----------------------------------------------------------------------
  // Record a capture
  // -----------------------------------------------------------------------

  /**
   * Record a capture result and persist it. Enforces the MAX_CAPTURES limit
   * by evicting the oldest entry when exceeded.
   */
  addCapture(result: CaptureResult): void {
    this.captures.push(result);

    // Enforce max limit — evict oldest
    if (this.captures.length > MAX_CAPTURES) {
      const sorted = [...this.captures].sort((a, b) => a.timestamp - b.timestamp);
      const oldest = sorted[0];
      this.captures = this.captures.filter((c) => c !== oldest);
    }

    this.save();
    this.notify();
  }

  /** Clear all capture history. */
  clearCaptures(): void {
    if (this.captures.length === 0) {
      return;
    }
    this.captures = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // CaptureSession
  // -----------------------------------------------------------------------

  /**
   * Create a new multi-step capture session.
   * Each step defines a capture type and label; the user completes them in order.
   */
  createSession(steps: Array<{ label: string; type: CaptureType }>): CaptureSession {
    if (steps.length === 0) {
      throw new Error('Session must have at least one step');
    }

    const session: CaptureSession = {
      id: crypto.randomUUID(),
      steps: steps.map((s) => ({
        id: crypto.randomUUID(),
        label: s.label,
        type: s.type,
        completed: false,
        result: null,
      })),
      status: 'in_progress',
      createdAt: Date.now(),
      completedAt: null,
    };

    this.sessions.push(session);
    this.save();
    this.notify();
    return session;
  }

  /**
   * Complete a step in a session by providing its capture result.
   * Marks the step as completed. If all steps are done, the session
   * status transitions to 'complete'.
   */
  completeStep(sessionId: string, stepId: string, result: CaptureResult): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status === 'cancelled') {
      throw new Error('Cannot complete a step in a cancelled session');
    }
    if (session.status === 'complete') {
      throw new Error('Session is already complete');
    }

    const step = session.steps.find((s) => s.id === stepId);
    if (!step) {
      throw new Error(`Step not found: ${stepId}`);
    }

    step.completed = true;
    step.result = result;

    // Check if all steps are done
    const allDone = session.steps.every((s) => s.completed);
    if (allDone) {
      session.status = 'complete';
      session.completedAt = Date.now();
    }

    this.save();
    this.notify();
  }

  /** Cancel a session. */
  cancelSession(sessionId: string): void {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status === 'complete' || session.status === 'cancelled') {
      return; // Idempotent
    }

    session.status = 'cancelled';
    this.save();
    this.notify();
  }

  /**
   * Get the next incomplete step in a session, or null if the session
   * is complete or cancelled.
   */
  getNextStep(sessionId: string): CaptureStep | null {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session || session.status !== 'in_progress') {
      return null;
    }
    return session.steps.find((s) => !s.completed) ?? null;
  }

  /** Get session progress as a fraction [0, 1]. */
  getSessionProgress(sessionId: string): number {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (!session || session.steps.length === 0) {
      return 0;
    }
    const completed = session.steps.filter((s) => s.completed).length;
    return completed / session.steps.length;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  /** Persist state to localStorage. */
  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data: PersistedData = {
        captures: this.captures,
        sessions: this.sessions,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  /** Load state from localStorage. */
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

      const data = parsed as Partial<PersistedData>;

      // Validate captures array
      if (Array.isArray(data.captures)) {
        this.captures = data.captures.filter(
          (item: unknown): item is CaptureResult =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as CaptureResult).type === 'string' &&
            typeof (item as CaptureResult).data === 'string' &&
            typeof (item as CaptureResult).timestamp === 'number',
        );
      }

      // Validate sessions array
      if (Array.isArray(data.sessions)) {
        this.sessions = data.sessions.filter(
          (item: unknown): item is CaptureSession =>
            typeof item === 'object' &&
            item !== null &&
            typeof (item as CaptureSession).id === 'string' &&
            Array.isArray((item as CaptureSession).steps) &&
            typeof (item as CaptureSession).status === 'string',
        );
      }
    } catch {
      // Corrupt data — start fresh
      this.captures = [];
      this.sessions = [];
    }
  }
}

// ---------------------------------------------------------------------------
// React hook
// ---------------------------------------------------------------------------

/**
 * Hook for accessing mobile capture capabilities in React components.
 * Subscribes to the MobileCaptureManager and triggers re-renders on state changes.
 * Safe for SSR (checks typeof window).
 */
export function useMobileCapture(): {
  captures: CaptureResult[];
  captureCount: number;
  sessions: CaptureSession[];
  capturePhoto: () => Promise<string>;
  photoToPart: (dataUrl: string, hintText?: string) => ExtractedPart | null;
  noteToBom: (text: string) => ParsedBomEntry;
  addCapture: (result: CaptureResult) => void;
  clearCaptures: () => void;
  createSession: (steps: Array<{ label: string; type: CaptureType }>) => CaptureSession;
  completeStep: (sessionId: string, stepId: string, result: CaptureResult) => void;
  cancelSession: (sessionId: string) => void;
  getNextStep: (sessionId: string) => CaptureStep | null;
  getSessionProgress: (sessionId: string) => number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const manager = MobileCaptureManager.getInstance();
    const unsubscribe = manager.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const capturePhoto = useCallback(async () => {
    return MobileCaptureManager.getInstance().capturePhoto();
  }, []);

  const photoToPart = useCallback((dataUrl: string, hintText?: string) => {
    return MobileCaptureManager.getInstance().photoToPart(dataUrl, hintText);
  }, []);

  const noteToBom = useCallback((text: string) => {
    return MobileCaptureManager.getInstance().noteToBom(text);
  }, []);

  const addCapture = useCallback((result: CaptureResult) => {
    MobileCaptureManager.getInstance().addCapture(result);
  }, []);

  const clearCaptures = useCallback(() => {
    MobileCaptureManager.getInstance().clearCaptures();
  }, []);

  const createSession = useCallback((steps: Array<{ label: string; type: CaptureType }>) => {
    return MobileCaptureManager.getInstance().createSession(steps);
  }, []);

  const completeStep = useCallback((sessionId: string, stepId: string, result: CaptureResult) => {
    MobileCaptureManager.getInstance().completeStep(sessionId, stepId, result);
  }, []);

  const cancelSession = useCallback((sessionId: string) => {
    MobileCaptureManager.getInstance().cancelSession(sessionId);
  }, []);

  const getNextStep = useCallback((sessionId: string) => {
    return MobileCaptureManager.getInstance().getNextStep(sessionId);
  }, []);

  const getSessionProgress = useCallback((sessionId: string) => {
    return MobileCaptureManager.getInstance().getSessionProgress(sessionId);
  }, []);

  const manager = typeof window !== 'undefined' ? MobileCaptureManager.getInstance() : null;

  return {
    captures: manager?.getCaptures() ?? [],
    captureCount: manager?.getCaptureCount() ?? 0,
    sessions: manager?.getSessions() ?? [],
    capturePhoto,
    photoToPart,
    noteToBom,
    addCapture,
    clearCaptures,
    createSession,
    completeStep,
    cancelSession,
    getNextStep,
    getSessionProgress,
  };
}
