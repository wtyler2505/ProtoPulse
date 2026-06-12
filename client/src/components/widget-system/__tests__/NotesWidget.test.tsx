import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { widgetRegistry } from '../WidgetRegistry';
import { notesWidgetDefinition, type NotesWidgetConfig } from '../definitions/NotesWidget';
import type { WidgetRenderContext } from '../widget.types';

function makeCtx(
  config: NotesWidgetConfig,
  onConfigChange: (config: NotesWidgetConfig) => void = () => {},
): WidgetRenderContext<NotesWidgetConfig> {
  return {
    config,
    data: {},
    size: { w: 280, h: 200 },
    surface: 'floating',
    actions: {
      navigateToView: () => {},
      openWidget: () => {},
      onConfigChange,
    },
  };
}

describe('NotesWidget', () => {
  it('registers itself on the app singleton at import time', () => {
    expect(widgetRegistry.get('notes')).toBe(notesWidgetDefinition);
  });

  it('declares a builtin, data-source-free, user-composable contract', () => {
    expect(notesWidgetDefinition.trust).toBe('builtin');
    expect(notesWidgetDefinition.dataSources).toEqual([]);
    expect(notesWidgetDefinition.configSchema).toBeDefined();
  });

  it('renders config text', () => {
    render(<>{notesWidgetDefinition.render(makeCtx({ text: 'remember the vias' }))}</>);
    expect(screen.getByLabelText('Notes')).toHaveValue('remember the vias');
  });

  it('propagates edits through onConfigChange', () => {
    const onConfigChange = vi.fn();
    render(<>{notesWidgetDefinition.render(makeCtx({ text: '' }, onConfigChange))}</>);

    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'new text' } });
    expect(onConfigChange).toHaveBeenCalledWith({ text: 'new text' });
  });
});
