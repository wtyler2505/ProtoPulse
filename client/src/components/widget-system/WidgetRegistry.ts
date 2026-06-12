import type {
  SerializedRegistryEntry,
  WidgetDefinition,
  WidgetRenderResolver,
  WidgetSurface,
} from './widget.types';

export interface RegistryListFilter {
  surface?: WidgetSurface;
  category?: string;
}

export interface HydrateResult {
  /** ids successfully re-bound to a render function */
  hydrated: string[];
  /** ids whose resolver returned no render function — reported, never thrown */
  missing: string[];
}

/**
 * The single widget registry behind all four surfaces. Built-ins register
 * statically at import time; plugins register dynamically at runtime (Phase 5).
 */
export class WidgetRegistry {
  private defs = new Map<string, WidgetDefinition>();

  register(def: WidgetDefinition): void {
    if (this.defs.has(def.id)) {
      throw new Error(`WidgetRegistry: duplicate widget id "${def.id}"`);
    }
    this.defs.set(def.id, def);
  }

  get(id: string): WidgetDefinition | undefined {
    return this.defs.get(id);
  }

  has(id: string): boolean {
    return this.defs.has(id);
  }

  remove(id: string): boolean {
    return this.defs.delete(id);
  }

  list(filter?: RegistryListFilter): WidgetDefinition[] {
    let result = Array.from(this.defs.values());
    if (filter?.surface) {
      // Undefined surfaces = available on all surfaces.
      result = result.filter((def) => !def.surfaces || def.surfaces.includes(filter.surface!));
    }
    if (filter?.category) {
      result = result.filter((def) => def.category === filter.category);
    }
    return result;
  }

  /** Metadata only — `render` is code and is never serialized. */
  serialize(): SerializedRegistryEntry[] {
    return Array.from(this.defs.values()).map((def) => ({
      id: def.id,
      title: def.title,
      ...(def.category !== undefined ? { category: def.category } : {}),
      dataSources: [...def.dataSources],
      defaultSize: { ...def.defaultSize },
      ...(def.minSize !== undefined ? { minSize: { ...def.minSize } } : {}),
      ...(def.surfaces !== undefined ? { surfaces: [...def.surfaces] } : {}),
      ...(def.configSchema !== undefined ? { configSchema: def.configSchema } : {}),
      trust: def.trust,
    }));
  }

  /**
   * Re-binds serialized metadata to render functions via the resolver.
   * Already-registered ids are left untouched; unresolved ids are reported.
   */
  hydrate(entries: SerializedRegistryEntry[], resolve: WidgetRenderResolver): HydrateResult {
    const hydrated: string[] = [];
    const missing: string[] = [];
    for (const entry of entries) {
      if (this.defs.has(entry.id)) {
        hydrated.push(entry.id);
        continue;
      }
      const render = resolve(entry);
      if (!render) {
        missing.push(entry.id);
        continue;
      }
      this.defs.set(entry.id, { ...entry, render });
      hydrated.push(entry.id);
    }
    return { hydrated, missing };
  }

  clear(): void {
    this.defs.clear();
  }
}

/** App-wide singleton. Tests should construct their own `new WidgetRegistry()`. */
export const widgetRegistry = new WidgetRegistry();
