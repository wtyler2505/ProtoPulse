import type { ReactNode } from 'react';

/**
 * Widget core contract — ONE definition serving four surfaces
 * (dashboard tiles, floating windows, embeds, plugin-loaded widgets).
 *
 * Shapes follow the feasibility research (Appendix A1/A2):
 * ~/.claude/plans/codex-is-already-doing-tingly-rivest.md
 */

/** Surfaces a widget can render on. Plugin loading is a registration path, not a surface. */
export const WIDGET_SURFACES = ['dashboard', 'floating', 'embed'] as const;
export type WidgetSurface = (typeof WIDGET_SURFACES)[number];

/**
 * Keys into existing project-context data hooks. Widgets never import hooks
 * directly — the host resolves these and injects data, keeping builtin,
 * user-composed, and (later) sandboxed plugin widgets uniform.
 */
export type DataSourceKey =
  | 'bom'
  | 'validation'
  | 'architecture'
  | 'history'
  | 'meta'
  | 'simulation'
  | 'sourcing'
  | 'readiness'
  | (string & {});

/** Trust tier drives the load + render path (builtin/trusted render in-process; sandboxed via iframe, Phase 5). */
export type WidgetTrust = 'builtin' | 'trusted' | 'sandboxed';

export interface WidgetSize {
  /** grid units on the dashboard surface; px on the floating surface */
  w: number;
  h: number;
}

export interface WidgetRenderContext<Config = unknown> {
  config: Config;
  /** Resolved, memoized, read-only data for the declared dataSources. */
  data: Partial<Record<DataSourceKey, unknown>>;
  size: WidgetSize;
  surface: WidgetSurface;
  /** Capability-gated host actions. */
  actions: {
    navigateToView(view: string): void;
    openWidget(defId: string): void;
    /** Persist a config change for this instance (validated against configSchema in Phase 3). */
    onConfigChange(config: Config): void;
  };
}

export interface WidgetDefinition<Config = unknown> {
  /** e.g. 'bom-cost', 'notes', 'plugin:acme.power' */
  id: string;
  title: string;
  category?: 'metrics' | 'sourcing' | 'validation' | 'tools' | 'notes' | (string & {});
  /** Host resolves these and passes them to render via context.data. */
  dataSources: DataSourceKey[];
  defaultSize: WidgetSize;
  minSize?: WidgetSize;
  /** Where this widget may appear. Undefined = all surfaces. */
  surfaces?: WidgetSurface[];
  /** Present ⇒ user-composable via the Add Widget picker (Phase 3). JSON Schema. */
  configSchema?: Record<string, unknown>;
  trust: WidgetTrust;
  /** builtin/trusted only — sandboxed widgets ship a URL/bundle instead (Phase 5). */
  render: (ctx: WidgetRenderContext<Config>) => ReactNode;
}

/** Which views a widget instance appears on. 'pinned' = follows the user (the persistence default). */
export type WidgetScope = 'global' | 'pinned' | { views: string[] };

export interface WidgetRect {
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
}

export interface WidgetGridPlacement {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A persisted, user-placed occurrence of a definition on a surface. */
export interface WidgetInstance {
  instanceId: string;
  /** → WidgetDefinition.id */
  defId: string;
  surface: Extract<WidgetSurface, 'dashboard' | 'floating'>;
  scope: WidgetScope;
  /** floating surface placement */
  rect?: WidgetRect;
  /** dashboard surface placement */
  grid?: WidgetGridPlacement;
  config?: unknown;
}

/** Serializable registry metadata — `render` is code and is never serialized. */
export interface SerializedRegistryEntry {
  id: string;
  title: string;
  category?: string;
  dataSources: DataSourceKey[];
  defaultSize: WidgetSize;
  minSize?: WidgetSize;
  surfaces?: WidgetSurface[];
  configSchema?: Record<string, unknown>;
  trust: WidgetTrust;
}

/** Maps a definition id back to its render function during hydrate. */
export type WidgetRenderResolver = (
  entry: SerializedRegistryEntry,
) => WidgetDefinition['render'] | undefined;
