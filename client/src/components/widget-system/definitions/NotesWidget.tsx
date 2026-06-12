import type { WidgetDefinition, WidgetRenderContext } from '../widget.types';
import { widgetRegistry } from '../WidgetRegistry';

/**
 * Demo builtin widget proving the core contract end-to-end: no dataSources,
 * config-driven content, works on every surface.
 */

export interface NotesWidgetConfig {
  text: string;
}

function NotesWidgetBody({ ctx }: { ctx: WidgetRenderContext<NotesWidgetConfig> }) {
  const text = ctx.config?.text ?? '';
  return (
    <textarea
      aria-label="Notes"
      className="h-full w-full resize-none bg-transparent text-sm outline-none"
      value={text}
      placeholder="Jot something down…"
      onChange={(event) => ctx.actions.onConfigChange({ text: event.target.value })}
    />
  );
}

export const notesWidgetDefinition: WidgetDefinition<NotesWidgetConfig> = {
  id: 'notes',
  title: 'Notes',
  category: 'notes',
  dataSources: [],
  defaultSize: { w: 280, h: 200 },
  minSize: { w: 160, h: 120 },
  trust: 'builtin',
  configSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
  },
  render: (ctx) => <NotesWidgetBody ctx={ctx} />,
};

// Built-ins register statically at import time (feasibility A1).
if (!widgetRegistry.has(notesWidgetDefinition.id)) {
  widgetRegistry.register(notesWidgetDefinition as WidgetDefinition);
}
