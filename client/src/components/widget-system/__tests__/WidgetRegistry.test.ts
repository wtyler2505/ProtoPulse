import { describe, it, expect, beforeEach } from 'vitest';
import { WidgetRegistry } from '../WidgetRegistry';
import type { WidgetDefinition } from '../widget.types';

function makeDef(overrides: Partial<WidgetDefinition> = {}): WidgetDefinition {
  return {
    id: 'test-widget',
    title: 'Test Widget',
    dataSources: [],
    defaultSize: { w: 2, h: 2 },
    trust: 'builtin',
    render: () => null,
    ...overrides,
  };
}

describe('WidgetRegistry', () => {
  let registry: WidgetRegistry;

  beforeEach(() => {
    registry = new WidgetRegistry();
  });

  describe('CRUD', () => {
    it('registers and gets a definition', () => {
      const def = makeDef();
      registry.register(def);
      expect(registry.get('test-widget')).toBe(def);
      expect(registry.has('test-widget')).toBe(true);
    });

    it('returns undefined for unknown ids', () => {
      expect(registry.get('nope')).toBeUndefined();
    });

    it('rejects duplicate ids', () => {
      registry.register(makeDef());
      expect(() => registry.register(makeDef())).toThrowError(/duplicate widget id/);
    });

    it('removes a definition', () => {
      registry.register(makeDef());
      expect(registry.remove('test-widget')).toBe(true);
      expect(registry.has('test-widget')).toBe(false);
      expect(registry.remove('test-widget')).toBe(false);
    });

    it('clears all definitions', () => {
      registry.register(makeDef({ id: 'a' }));
      registry.register(makeDef({ id: 'b' }));
      registry.clear();
      expect(registry.list()).toHaveLength(0);
    });
  });

  describe('list', () => {
    beforeEach(() => {
      registry.register(makeDef({ id: 'metrics-1', category: 'metrics' }));
      registry.register(
        makeDef({ id: 'dash-only', category: 'tools', surfaces: ['dashboard'] }),
      );
      registry.register(
        makeDef({ id: 'float-tool', category: 'tools', surfaces: ['floating', 'embed'] }),
      );
    });

    it('lists everything without a filter', () => {
      expect(registry.list().map((d) => d.id)).toEqual(['metrics-1', 'dash-only', 'float-tool']);
    });

    it('treats undefined surfaces as all surfaces', () => {
      expect(registry.list({ surface: 'floating' }).map((d) => d.id)).toEqual([
        'metrics-1',
        'float-tool',
      ]);
    });

    it('filters by surface and category combined', () => {
      expect(
        registry.list({ surface: 'dashboard', category: 'tools' }).map((d) => d.id),
      ).toEqual(['dash-only']);
    });
  });

  describe('serialize / hydrate', () => {
    it('serializes metadata without the render function', () => {
      registry.register(
        makeDef({
          id: 'rich',
          category: 'metrics',
          dataSources: ['bom', 'validation'],
          minSize: { w: 1, h: 1 },
          surfaces: ['dashboard'],
          configSchema: { type: 'object' },
          trust: 'trusted',
        }),
      );
      const [entry] = registry.serialize();
      expect(entry).toEqual({
        id: 'rich',
        title: 'Test Widget',
        category: 'metrics',
        dataSources: ['bom', 'validation'],
        defaultSize: { w: 2, h: 2 },
        minSize: { w: 1, h: 1 },
        surfaces: ['dashboard'],
        configSchema: { type: 'object' },
        trust: 'trusted',
      });
      expect('render' in entry).toBe(false);
    });

    it('round-trips serialize → hydrate preserving metadata', () => {
      const original = makeDef({ id: 'rt', dataSources: ['bom'], category: 'metrics' });
      registry.register(original);
      const entries = registry.serialize();

      const fresh = new WidgetRegistry();
      const render = () => null;
      const result = fresh.hydrate(entries, () => render);

      expect(result).toEqual({ hydrated: ['rt'], missing: [] });
      const hydrated = fresh.get('rt')!;
      expect(hydrated.render).toBe(render);
      expect(fresh.serialize()).toEqual(entries);
    });

    it('reports unresolvable defs instead of throwing', () => {
      registry.register(makeDef({ id: 'known' }));
      registry.register(makeDef({ id: 'gone' }));
      const entries = registry.serialize();

      const fresh = new WidgetRegistry();
      const result = fresh.hydrate(entries, (entry) =>
        entry.id === 'known' ? () => null : undefined,
      );

      expect(result.hydrated).toEqual(['known']);
      expect(result.missing).toEqual(['gone']);
      expect(fresh.has('gone')).toBe(false);
    });

    it('leaves already-registered ids untouched on hydrate', () => {
      const live = makeDef({ id: 'live' });
      registry.register(live);
      const result = registry.hydrate(
        [{ ...registry.serialize()[0], title: 'Different Title' }],
        () => () => null,
      );
      expect(result.hydrated).toEqual(['live']);
      expect(registry.get('live')).toBe(live);
    });
  });
});
