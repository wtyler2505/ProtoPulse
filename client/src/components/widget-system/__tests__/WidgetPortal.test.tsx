import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { WidgetPortal } from '../WidgetPortal';
import { WidgetRegistry } from '../WidgetRegistry';
import type { WidgetDefinition, WidgetInstance } from '../widget.types';

function makeRegistry(...defs: WidgetDefinition[]): WidgetRegistry {
  const registry = new WidgetRegistry();
  for (const def of defs) registry.register(def);
  return registry;
}

function makeDef(overrides: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return {
    id: 'hello',
    title: 'Hello Widget',
    dataSources: [],
    defaultSize: { w: 200, h: 150 },
    trust: 'builtin',
    render: () => <div>hello content</div>,
    ...overrides,
  };
}

function makeInstance(overrides: Partial<WidgetInstance> = {}): WidgetInstance {
  return {
    instanceId: 'inst-1',
    defId: 'hello',
    surface: 'floating',
    scope: 'pinned',
    rect: { x: 5, y: 5, w: 200, h: 150, z: 0, minimized: false },
    ...overrides,
  };
}

const noop = () => {};

describe('WidgetPortal', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders registered widget content into a body-level widget layer', () => {
    render(
      <WidgetPortal
        instances={[makeInstance()]}
        onRemove={noop}
        onConfigChange={noop}
        registry={makeRegistry(makeDef())}
      />,
    );

    expect(screen.getByText('hello content')).toBeInTheDocument();
    const layerHost = document.querySelector('[data-widget-layer]');
    expect(layerHost).not.toBeNull();
    expect(layerHost!.parentElement).toBe(document.body);
    expect(layerHost!.querySelector('[data-widget-def="hello"]')).not.toBeNull();
  });

  it('calls onRemove when the close button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <WidgetPortal
        instances={[makeInstance()]}
        onRemove={onRemove}
        onConfigChange={noop}
        registry={makeRegistry(makeDef())}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /close hello widget/i }));
    expect(onRemove).toHaveBeenCalledWith('inst-1');
  });

  it('skips unknown definitions without crashing', () => {
    render(
      <WidgetPortal
        instances={[makeInstance({ defId: 'missing' }), makeInstance({ instanceId: 'inst-2' })]}
        onRemove={noop}
        onConfigChange={noop}
        registry={makeRegistry(makeDef())}
      />,
    );

    expect(screen.getByText('hello content')).toBeInTheDocument();
    expect(document.querySelector('[data-widget-def="missing"]')).toBeNull();
  });

  it('contains a throwing widget so sibling widgets survive', () => {
    const bomb = makeDef({
      id: 'bomb',
      title: 'Bomb',
      render: () => {
        throw new Error('boom');
      },
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <WidgetPortal
        instances={[
          makeInstance({ instanceId: 'bomb-1', defId: 'bomb' }),
          makeInstance({ instanceId: 'ok-1' }),
        ]}
        onRemove={noop}
        onConfigChange={noop}
        registry={makeRegistry(makeDef(), bomb)}
      />,
    );

    expect(screen.getByTestId('widget-error')).toHaveTextContent('Bomb failed to render');
    expect(screen.getByText('hello content')).toBeInTheDocument();
    spy.mockRestore();
  });

  it('does not render minimized widget bodies', () => {
    render(
      <WidgetPortal
        instances={[
          makeInstance({
            rect: { x: 0, y: 0, w: 200, h: 150, z: 0, minimized: true },
          }),
        ]}
        onRemove={noop}
        onConfigChange={noop}
        registry={makeRegistry(makeDef())}
      />,
    );

    expect(screen.queryByText('hello content')).toBeNull();
    expect(screen.getByText('Hello Widget')).toBeInTheDocument();
  });

  it('keeps the widget layer mounted while sibling view content re-renders (cross-view proxy)', () => {
    const registry = makeRegistry(
      makeDef({
        id: 'stateful',
        title: 'Stateful',
        render: () => <StatefulBody />,
      }),
    );

    function StatefulBody() {
      const [count, setCount] = useState(0);
      return (
        <button type="button" onClick={() => setCount((c) => c + 1)}>
          count:{count}
        </button>
      );
    }

    function Shell() {
      const [view, setView] = useState('schematic');
      return (
        <div>
          <button type="button" onClick={() => setView(view === 'schematic' ? 'pcb' : 'schematic')}>
            switch view
          </button>
          <div data-testid="view">{view}</div>
          <WidgetPortal
            instances={[makeInstance({ defId: 'stateful' })]}
            onRemove={noop}
            onConfigChange={noop}
            registry={registry}
          />
        </div>
      );
    }

    render(<Shell />);

    // Build up widget-local state…
    fireEvent.click(screen.getByText('count:0'));
    fireEvent.click(screen.getByText('count:1'));
    // …then "switch views" twice.
    fireEvent.click(screen.getByText('switch view'));
    fireEvent.click(screen.getByText('switch view'));

    // Widget state survived — it was never unmounted.
    expect(screen.getByText('count:2')).toBeInTheDocument();
  });

  it('passes config and onConfigChange through the render context', () => {
    const onConfigChange = vi.fn();
    const registry = makeRegistry(
      makeDef({
        id: 'cfg',
        title: 'Config Widget',
        render: (ctx) => (
          <button type="button" onClick={() => ctx.actions.onConfigChange({ touched: true })}>
            value:{String((ctx.config as { value?: string } | undefined)?.value)}
          </button>
        ),
      }),
    );

    render(
      <WidgetPortal
        instances={[makeInstance({ defId: 'cfg', config: { value: 'abc' } })]}
        onRemove={noop}
        onConfigChange={onConfigChange}
        registry={registry}
      />,
    );

    fireEvent.click(screen.getByText('value:abc'));
    expect(onConfigChange).toHaveBeenCalledWith('inst-1', { touched: true });
  });
});
