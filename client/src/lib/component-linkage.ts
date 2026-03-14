/**
 * ComponentLinkManager — Links architecture nodes to circuit instances so
 * changes in one view can be reflected in the other.
 *
 * Singleton + subscribe pattern for useSyncExternalStore integration.
 * Pure module — no React/DOM dependencies.
 */

import Fuse from 'fuse.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Listener = () => void;

export interface ComponentLink {
  readonly architectureNodeId: string;
  readonly circuitInstanceId: number;
  readonly linkType: 'manual' | 'auto';
  /** Confidence score for auto-detected links (0–1). */
  readonly confidence?: number;
}

/** Minimal architecture node shape needed for auto-detection. */
export interface ArchNodeInfo {
  readonly nodeId: string;
  readonly label: string;
  readonly nodeType: string;
  readonly description?: string;
}

/** Minimal circuit instance shape needed for auto-detection. */
export interface CircuitInstanceInfo {
  readonly id: number;
  readonly referenceDesignator: string;
  readonly properties: Record<string, unknown>;
}

export interface ComponentLinkState {
  readonly links: readonly ComponentLink[];
  readonly version: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STORAGE_PREFIX = 'protopulse-component-links-';

/** Fuse.js threshold for considering a fuzzy match valid. */
const AUTO_LINK_THRESHOLD = 0.45;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function storageKey(projectId: number | string): string {
  return `${STORAGE_PREFIX}${projectId}`;
}

function safeGetLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLS(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage full or unavailable — silently ignore.
  }
}

function loadLinks(projectId: number | string): ComponentLink[] {
  const raw = safeGetLS(storageKey(projectId));
  if (!raw) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is ComponentLink =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ComponentLink).architectureNodeId === 'string' &&
          typeof (item as ComponentLink).circuitInstanceId === 'number' &&
          ((item as ComponentLink).linkType === 'manual' || (item as ComponentLink).linkType === 'auto'),
      );
    }
  } catch {
    // Corrupted data — start fresh.
  }
  return [];
}

/**
 * Extract a human-readable label from a circuit instance for fuzzy matching.
 * Falls back to referenceDesignator if no label/name/componentId found.
 */
function instanceLabel(inst: CircuitInstanceInfo): string {
  const props = inst.properties;
  const name = (props.name as string) ?? (props.componentId as string) ?? (props.label as string) ?? '';
  return name || inst.referenceDesignator;
}

// ---------------------------------------------------------------------------
// ComponentLinkManager
// ---------------------------------------------------------------------------

export class ComponentLinkManager {
  private _links: ComponentLink[];
  private _version = 0;
  private _listeners = new Set<Listener>();
  private _projectId: number | string;

  private constructor(projectId: number | string) {
    this._projectId = projectId;
    this._links = loadLinks(projectId);
  }

  /** Factory — creates a fresh instance (testing-friendly, no global singleton). */
  static create(projectId: number | string): ComponentLinkManager {
    return new ComponentLinkManager(projectId);
  }

  // -----------------------------------------------------------------------
  // Subscription (useSyncExternalStore compatible)
  // -----------------------------------------------------------------------

  subscribe = (listener: Listener): (() => void) => {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  };

  getSnapshot = (): ComponentLinkState => {
    return { links: this._links, version: this._version };
  };

  private notify(): void {
    this._version++;
    const listeners = Array.from(this._listeners);
    for (let i = 0; i < listeners.length; i++) {
      listeners[i]();
    }
  }

  private persist(): void {
    safeSetLS(storageKey(this._projectId), JSON.stringify(this._links));
  }

  // -----------------------------------------------------------------------
  // Link management
  // -----------------------------------------------------------------------

  /** Manually link an architecture node to a circuit instance. */
  linkComponents(nodeId: string, instanceId: number, type: 'manual' | 'auto' = 'manual', confidence?: number): void {
    // Remove any existing link for this node or instance
    this._links = this._links.filter(
      (link) => link.architectureNodeId !== nodeId && link.circuitInstanceId !== instanceId,
    );
    this._links = [...this._links, { architectureNodeId: nodeId, circuitInstanceId: instanceId, linkType: type, confidence }];
    this.persist();
    this.notify();
  }

  /** Remove the link between a specific node and instance. */
  unlinkComponents(nodeId: string, instanceId: number): void {
    const before = this._links.length;
    this._links = this._links.filter(
      (link) => !(link.architectureNodeId === nodeId && link.circuitInstanceId === instanceId),
    );
    if (this._links.length !== before) {
      this.persist();
      this.notify();
    }
  }

  /** Remove all links for a given architecture node. */
  unlinkNode(nodeId: string): void {
    const before = this._links.length;
    this._links = this._links.filter((link) => link.architectureNodeId !== nodeId);
    if (this._links.length !== before) {
      this.persist();
      this.notify();
    }
  }

  /** Get the circuit instance linked to an architecture node. */
  getLinkedInstance(nodeId: string): ComponentLink | undefined {
    return this._links.find((link) => link.architectureNodeId === nodeId);
  }

  /** Get the architecture node linked to a circuit instance. */
  getLinkedNode(instanceId: number): ComponentLink | undefined {
    return this._links.find((link) => link.circuitInstanceId === instanceId);
  }

  /** Return all current links. */
  getAllLinks(): readonly ComponentLink[] {
    return this._links;
  }

  /** Clear all links. */
  clearAll(): void {
    if (this._links.length === 0) {
      return;
    }
    this._links = [];
    this.persist();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Auto-detection
  // -----------------------------------------------------------------------

  /**
   * Attempt to auto-detect links between architecture nodes and circuit
   * instances by fuzzy-matching labels/names/types.
   *
   * Only creates links for nodes and instances that are not already linked.
   * Returns the newly created links.
   */
  autoDetectLinks(
    archNodes: readonly ArchNodeInfo[],
    circuitInstances: readonly CircuitInstanceInfo[],
  ): ComponentLink[] {
    const newLinks: ComponentLink[] = [];
    const linkedNodeIds = new Set(this._links.map((l) => l.architectureNodeId));
    const linkedInstanceIds = new Set(this._links.map((l) => l.circuitInstanceId));

    // Filter to unlinked nodes and instances
    const unlinkedNodes = archNodes.filter((n) => !linkedNodeIds.has(n.nodeId));
    const unlinkedInstances = circuitInstances.filter((i) => !linkedInstanceIds.has(i.id));

    if (unlinkedNodes.length === 0 || unlinkedInstances.length === 0) {
      return newLinks;
    }

    // Build a Fuse index over circuit instances
    const searchItems = unlinkedInstances.map((inst) => ({
      id: inst.id,
      label: instanceLabel(inst),
      refDes: inst.referenceDesignator,
    }));

    const fuse = new Fuse(searchItems, {
      keys: ['label', 'refDes'],
      threshold: AUTO_LINK_THRESHOLD,
      includeScore: true,
      shouldSort: true,
    });

    // Track which instances have been claimed in this pass
    const claimedInstances = new Set<number>();

    for (const node of unlinkedNodes) {
      // Try matching against node label, then nodeType, then description
      const searchTerms = [node.label, node.nodeType, node.description].filter(Boolean) as string[];

      let bestMatch: { id: number; score: number } | null = null;

      for (const term of searchTerms) {
        const results = fuse.search(term);
        for (const result of results) {
          if (claimedInstances.has(result.item.id)) {
            continue;
          }
          const score = 1 - (result.score ?? 1);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { id: result.item.id, score };
          }
          break; // Take only the best match for this search term
        }
      }

      if (bestMatch) {
        claimedInstances.add(bestMatch.id);
        const link: ComponentLink = {
          architectureNodeId: node.nodeId,
          circuitInstanceId: bestMatch.id,
          linkType: 'auto',
          confidence: Math.round(bestMatch.score * 100) / 100,
        };
        newLinks.push(link);
      }
    }

    if (newLinks.length > 0) {
      this._links = [...this._links, ...newLinks];
      this.persist();
      this.notify();
    }

    return newLinks;
  }
}

// ---------------------------------------------------------------------------
// Global singleton
// ---------------------------------------------------------------------------

let _instance: ComponentLinkManager | null = null;

/** Get or create the global ComponentLinkManager singleton for a project. */
export function getComponentLinkManager(projectId: number | string): ComponentLinkManager {
  if (!_instance || ((_instance as unknown as { _projectId: number | string })._projectId !== projectId)) {
    _instance = ComponentLinkManager.create(projectId);
  }
  return _instance;
}

/** Reset the global singleton (for testing). */
export function resetComponentLinkManager(): void {
  _instance = null;
}
