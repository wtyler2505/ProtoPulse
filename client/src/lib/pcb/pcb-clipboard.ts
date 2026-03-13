/**
 * PcbClipboardManager — Copy/paste/duplicate for PCB traces, zones, vias,
 * and component instances.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * All dimensions in millimeters (board coordinates).
 *
 * Pure logic — no React, no DOM.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export type ClipboardItemType = 'trace' | 'zone' | 'via' | 'instance';

export interface ClipboardItem {
  type: ClipboardItemType;
  id: string;
  data: ClipboardItemData;
  layer: string;
  netId?: string;
  properties: Record<string, unknown>;
}

export type ClipboardItemData =
  | TraceData
  | ZoneData
  | ViaData
  | InstanceData;

export interface TraceData {
  kind: 'trace';
  points: Array<{ x: number; y: number }>;
  width: number;
}

export interface ZoneData {
  kind: 'zone';
  polygon: Array<{ x: number; y: number }>;
  fillType: string;
}

export interface ViaData {
  kind: 'via';
  position: { x: number; y: number };
  drillDiameter: number;
  outerDiameter: number;
}

export interface InstanceData {
  kind: 'instance';
  position: { x: number; y: number };
  rotation: number;
  packageType: string;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ClipboardState {
  items: ClipboardItem[];
  sourceDesignId: string;
  copiedAt: number;
  boundingBox: BoundingBox;
}

export interface PasteResult {
  items: ClipboardItem[];
  offset: { dx: number; dy: number };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default offset when duplicating in place (mm). */
const DUPLICATE_OFFSET = 2.54; // 100 mil

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Compute the axis-aligned bounding box of a set of clipboard items. */
export function computeBoundingBox(items: ReadonlyArray<ClipboardItem>): BoundingBox {
  if (items.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const item of items) {
    const pts = getItemPoints(item);
    for (const p of pts) {
      if (p.x < minX) { minX = p.x; }
      if (p.y < minY) { minY = p.y; }
      if (p.x > maxX) { maxX = p.x; }
      if (p.y > maxY) { maxY = p.y; }
    }
  }

  if (!isFinite(minX)) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/** Extract all coordinate points from a clipboard item. */
function getItemPoints(item: ClipboardItem): Array<{ x: number; y: number }> {
  const d = item.data;
  switch (d.kind) {
    case 'trace':
      return d.points;
    case 'zone':
      return d.polygon;
    case 'via':
      return [d.position];
    case 'instance':
      return [d.position];
  }
}

/** Compute offset from bbox center to target position. */
export function computeOffset(
  bbox: BoundingBox,
  target: { x: number; y: number },
): { dx: number; dy: number } {
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  return {
    dx: target.x - centerX,
    dy: target.y - centerY,
  };
}

/** Deep-clone a clipboard item, translating all coordinates by (dx, dy). */
function translateItem(
  item: ClipboardItem,
  dx: number,
  dy: number,
): ClipboardItem {
  const d = item.data;
  let translatedData: ClipboardItemData;

  switch (d.kind) {
    case 'trace':
      translatedData = {
        kind: 'trace',
        points: d.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        width: d.width,
      };
      break;
    case 'zone':
      translatedData = {
        kind: 'zone',
        polygon: d.polygon.map((p) => ({ x: p.x + dx, y: p.y + dy })),
        fillType: d.fillType,
      };
      break;
    case 'via':
      translatedData = {
        kind: 'via',
        position: { x: d.position.x + dx, y: d.position.y + dy },
        drillDiameter: d.drillDiameter,
        outerDiameter: d.outerDiameter,
      };
      break;
    case 'instance':
      translatedData = {
        kind: 'instance',
        position: { x: d.position.x + dx, y: d.position.y + dy },
        rotation: d.rotation,
        packageType: d.packageType,
      };
      break;
  }

  return {
    type: item.type,
    id: item.id,
    data: translatedData,
    layer: item.layer,
    netId: item.netId,
    properties: { ...item.properties },
  };
}

/**
 * Deep-clone items with new UUIDs. Internal references (e.g. netId)
 * are preserved since they refer to external design nets, not item IDs.
 */
export function remapIds(items: ReadonlyArray<ClipboardItem>): ClipboardItem[] {
  return items.map((item) => ({
    ...item,
    id: crypto.randomUUID(),
    data: cloneData(item.data),
    properties: { ...item.properties },
  }));
}

/** Deep-clone item data. */
function cloneData(data: ClipboardItemData): ClipboardItemData {
  switch (data.kind) {
    case 'trace':
      return {
        kind: 'trace',
        points: data.points.map((p) => ({ ...p })),
        width: data.width,
      };
    case 'zone':
      return {
        kind: 'zone',
        polygon: data.polygon.map((p) => ({ ...p })),
        fillType: data.fillType,
      };
    case 'via':
      return {
        kind: 'via',
        position: { ...data.position },
        drillDiameter: data.drillDiameter,
        outerDiameter: data.outerDiameter,
      };
    case 'instance':
      return {
        kind: 'instance',
        position: { ...data.position },
        rotation: data.rotation,
        packageType: data.packageType,
      };
  }
}

// ---------------------------------------------------------------------------
// PcbClipboardManager
// ---------------------------------------------------------------------------

export class PcbClipboardManager {
  private static instance: PcbClipboardManager | null = null;

  private clipboard: ClipboardState | null = null;
  private listeners = new Set<Listener>();

  private constructor() {}

  /** Get or create the singleton instance. */
  static getInstance(): PcbClipboardManager {
    if (!PcbClipboardManager.instance) {
      PcbClipboardManager.instance = new PcbClipboardManager();
    }
    return PcbClipboardManager.instance;
  }

  /** Reset the singleton (useful for testing). */
  static resetForTesting(): void {
    PcbClipboardManager.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Snapshot identity changes when clipboard changes. */
  getSnapshot(): ClipboardState | null {
    return this.clipboard;
  }

  private notify(): void {
    Array.from(this.listeners).forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Copy
  // -----------------------------------------------------------------------

  /**
   * Copy selected items to the internal clipboard. Computes bounding box
   * and stores a deep clone. Empty selections are ignored.
   */
  copy(selectedItems: ReadonlyArray<ClipboardItem>, designId: string = ''): void {
    if (selectedItems.length === 0) {
      return;
    }

    const cloned = remapIds(selectedItems);
    // Preserve original positions (cloned keeps coordinates), but store
    // under fresh IDs so repeated pastes don't collide.
    // Actually, keep original coordinates; ID remapping happens on paste.
    // Store raw copies so preview uses original positions.
    const raw: ClipboardItem[] = selectedItems.map((item) => ({
      type: item.type,
      id: item.id,
      data: cloneData(item.data),
      layer: item.layer,
      netId: item.netId,
      properties: { ...item.properties },
    }));

    const bbox = computeBoundingBox(raw);

    this.clipboard = {
      items: raw,
      sourceDesignId: designId,
      copiedAt: Date.now(),
      boundingBox: bbox,
    };
    // Discard unused cloned to avoid lint warning — copy stores originals.
    void cloned;

    this.notify();
  }

  // -----------------------------------------------------------------------
  // Paste
  // -----------------------------------------------------------------------

  /**
   * Paste clipboard items at the target position with new UUIDs.
   * Returns null if clipboard is empty.
   */
  paste(
    targetPosition: { x: number; y: number },
    designId: string = '',
  ): PasteResult | null {
    if (!this.clipboard || this.clipboard.items.length === 0) {
      return null;
    }

    const offset = computeOffset(this.clipboard.boundingBox, targetPosition);
    const remapped = remapIds(this.clipboard.items);
    const translated = remapped.map((item) =>
      translateItem(item, offset.dx, offset.dy),
    );

    // If pasting into a different design, clear net associations
    if (designId && this.clipboard.sourceDesignId && designId !== this.clipboard.sourceDesignId) {
      for (const item of translated) {
        item.netId = undefined;
      }
    }

    return {
      items: translated,
      offset,
    };
  }

  // -----------------------------------------------------------------------
  // Preview
  // -----------------------------------------------------------------------

  /**
   * Get a set of ghost items translated to the cursor position for paste
   * preview rendering. Returns empty array if clipboard is empty.
   */
  getClipboardPreview(cursorPosition: { x: number; y: number }): ClipboardItem[] {
    if (!this.clipboard || this.clipboard.items.length === 0) {
      return [];
    }

    const offset = computeOffset(this.clipboard.boundingBox, cursorPosition);
    return this.clipboard.items.map((item) =>
      translateItem(item, offset.dx, offset.dy),
    );
  }

  // -----------------------------------------------------------------------
  // Duplicate in place
  // -----------------------------------------------------------------------

  /**
   * Convenience for Ctrl+D — paste with a small fixed offset from originals.
   * Returns null if no items provided.
   */
  duplicateInPlace(
    items: ReadonlyArray<ClipboardItem>,
    offset: { dx: number; dy: number } = { dx: DUPLICATE_OFFSET, dy: DUPLICATE_OFFSET },
  ): ClipboardItem[] | null {
    if (items.length === 0) {
      return null;
    }

    const remapped = remapIds(items);
    return remapped.map((item) =>
      translateItem(item, offset.dx, offset.dy),
    );
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------

  /** Whether the clipboard has items available to paste. */
  canPaste(): boolean {
    return this.clipboard !== null && this.clipboard.items.length > 0;
  }

  /** Number of items currently on the clipboard. */
  getItemCount(): number {
    return this.clipboard?.items.length ?? 0;
  }

  /** Get the stored source design ID. */
  getSourceDesignId(): string {
    return this.clipboard?.sourceDesignId ?? '';
  }

  // -----------------------------------------------------------------------
  // Clear
  // -----------------------------------------------------------------------

  /** Clear the clipboard. */
  clear(): void {
    if (this.clipboard === null) {
      return;
    }
    this.clipboard = null;
    this.notify();
  }
}
