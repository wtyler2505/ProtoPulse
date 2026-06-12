import { Component, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { widgetRegistry, type WidgetRegistry } from './WidgetRegistry';
import type { WidgetInstance, WidgetRenderContext } from './widget.types';

/**
 * Floating widget surface — the cross-view persistence layer.
 *
 * Phase 1: self-contained. The portal creates its own host element on
 * document.body, so it requires NO edits to ProjectWorkspace/ViewRenderer.
 * Phase 2 mounts <WidgetPortal> at the ProjectWorkspace shell (sibling of the
 * view tabpanel) so view switches re-render ViewRenderer but never unmount
 * this layer.
 */

/** Owned z-scale base for the widget layer (above view content, below modals). */
export const Z_WIDGET_LAYER = 60;

export interface WidgetPortalProps {
  /** Pre-filtered by the caller via useWidgets().instancesFor('floating', activeView). */
  instances: WidgetInstance[];
  onRemove(instanceId: string): void;
  onConfigChange(instanceId: string, config: unknown): void;
  actions?: Partial<WidgetRenderContext['actions']>;
  /** Injectable for tests; defaults to the app singleton. */
  registry?: WidgetRegistry;
}

interface WidgetErrorBoundaryProps {
  title: string;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
}

/**
 * Per-widget containment: a broken widget renders a compact failure card and
 * never takes down the layer or its sibling widgets. (The app-level
 * ErrorBoundary offers full-page recovery chrome — too heavy per-widget.)
 */
class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): WidgetErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-3 text-sm text-destructive" role="alert" data-testid="widget-error">
          {this.props.title} failed to render.
        </div>
      );
    }
    return this.props.children;
  }
}

/** Defers def.render into a child so the boundary above it can catch throws. */
function WidgetBody({
  render,
  ctx,
}: {
  render: (ctx: WidgetRenderContext) => ReactNode;
  ctx: WidgetRenderContext;
}) {
  return <>{render(ctx)}</>;
}

function useWidgetLayerHost(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const element = document.createElement('div');
    element.setAttribute('data-widget-layer', 'true');
    document.body.appendChild(element);
    setHost(element);
    return () => {
      element.remove();
    };
  }, []);

  return host;
}

export function WidgetPortal({
  instances,
  onRemove,
  onConfigChange,
  actions,
  registry = widgetRegistry,
}: WidgetPortalProps) {
  const host = useWidgetLayerHost();

  const resolvedActions = useMemo<Omit<WidgetRenderContext['actions'], 'onConfigChange'>>(
    () => ({
      navigateToView: actions?.navigateToView ?? (() => {}),
      openWidget: actions?.openWidget ?? (() => {}),
    }),
    [actions?.navigateToView, actions?.openWidget],
  );

  if (!host) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0"
      style={{ zIndex: Z_WIDGET_LAYER }}
      role="region"
      aria-label="Floating widgets"
    >
      {instances.map((instance) => {
        const def = registry.get(instance.defId);
        if (!def) {
          if (import.meta.env.DEV) {
            console.warn(`WidgetPortal: unknown widget definition "${instance.defId}" — skipped`);
          }
          return null;
        }

        const rect = instance.rect ?? {
          x: 24,
          y: 24,
          w: def.defaultSize.w,
          h: def.defaultSize.h,
          z: 0,
          minimized: false,
        };

        const ctx: WidgetRenderContext = {
          config: instance.config,
          data: {}, // dataSources resolution (useWidgetData) lands in Phase 2
          size: { w: rect.w, h: rect.h },
          surface: 'floating',
          actions: {
            ...resolvedActions,
            onConfigChange: (config) => onConfigChange(instance.instanceId, config),
          },
        };

        return (
          <Card
            key={instance.instanceId}
            data-testid={`widget-${instance.instanceId}`}
            data-widget-def={def.id}
            className="pointer-events-auto absolute flex flex-col overflow-hidden shadow-lg"
            style={{
              left: rect.x,
              top: rect.y,
              width: rect.w,
              height: rect.minimized ? undefined : rect.h,
              zIndex: Z_WIDGET_LAYER + 1 + rect.z,
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b p-2">
              <CardTitle className="text-sm font-medium">{def.title}</CardTitle>
              <button
                type="button"
                aria-label={`Close ${def.title}`}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => onRemove(instance.instanceId)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </CardHeader>
            {!rect.minimized && (
              <CardContent className="min-h-0 flex-1 overflow-auto p-3">
                <WidgetErrorBoundary title={def.title}>
                  <WidgetBody render={def.render} ctx={ctx} />
                </WidgetErrorBoundary>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>,
    host,
  );
}

export { instanceMatchesView } from './useWidgets';
export type { WidgetInstance };
