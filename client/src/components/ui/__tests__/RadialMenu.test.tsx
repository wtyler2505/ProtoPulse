import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import type { RadialCommandGroup, RadialMenuItem, RadialSlot } from '@/lib/radial-menu-actions';

// Mock lucide-react icons used by the action catalog.
vi.mock('lucide-react', () => {
  const iconFactory = (name: string) => (props: Record<string, unknown>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Activity: iconFactory('activity'),
    ArrowRight: iconFactory('arrow-right'),
    BarChart3: iconFactory('bar-chart'),
    Box: iconFactory('box'),
    CheckSquare: iconFactory('check-square'),
    CircuitBoard: iconFactory('circuit-board'),
    ClipboardPaste: iconFactory('clipboard-paste'),
    Copy: iconFactory('copy'),
    Crosshair: iconFactory('crosshair'),
    Download: iconFactory('download'),
    Edit: iconFactory('edit'),
    FileCode: iconFactory('file-code'),
    FileJson: iconFactory('file-json'),
    FileText: iconFactory('file-text'),
    FlipHorizontal2: iconFactory('flip-horizontal'),
    Gauge: iconFactory('gauge'),
    Grid3X3: iconFactory('grid'),
    History: iconFactory('history'),
    Link: iconFactory('link'),
    Maximize: iconFactory('maximize'),
    MessageSquarePlus: iconFactory('message-square-plus'),
    Microscope: iconFactory('microscope'),
    Monitor: iconFactory('monitor'),
    Move: iconFactory('move'),
    Package: iconFactory('package'),
    Pentagon: iconFactory('pentagon'),
    Play: iconFactory('play'),
    Plus: iconFactory('plus'),
    Printer: iconFactory('printer'),
    RefreshCw: iconFactory('refresh-cw'),
    RotateCw: iconFactory('rotate-cw'),
    Ruler: iconFactory('ruler'),
    Search: iconFactory('search'),
    Settings2: iconFactory('settings'),
    ShieldAlert: iconFactory('shield-alert'),
    ShieldCheck: iconFactory('shield-check'),
    SlidersHorizontal: iconFactory('sliders'),
    Sparkles: iconFactory('sparkles'),
    Trash2: iconFactory('trash2'),
    Zap: iconFactory('zap'),
  };
});

import RadialMenu from '@/components/ui/RadialMenu';
import type { RadialMenuProps } from '@/components/ui/RadialMenu';
import { Edit, Trash2, Copy, Package } from 'lucide-react';
import { clearRadialTelemetry, readRadialTelemetry } from '@/lib/radial-menu-telemetry';

const DEFAULT_VIEWPORT = {
  width: window.innerWidth,
  height: window.innerHeight,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function item(
  id: string,
  label: string,
  slot: RadialSlot,
  group: RadialCommandGroup,
  icon = Edit,
  overrides: Partial<RadialMenuItem> = {},
): RadialMenuItem {
  return {
    id,
    label,
    description: `${label} command`,
    icon,
    slot,
    group,
    hint: ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][slot],
    ...overrides,
  };
}

function makeItems(count = 4): RadialMenuItem[] {
  const templates: RadialMenuItem[] = [
    item('edit', 'Edit', 6, 'edit', Edit),
    item('delete', 'Delete', 5, 'delete', Trash2, { destructive: true }),
    item('duplicate', 'Duplicate', 7, 'reuse', Copy),
    item('add_to_bom', 'Add BOM', 0, 'create', Package),
    item('transform', 'Retype', 1, 'transform'),
    item('connect', 'Connect', 2, 'connect'),
    item('inspect', 'Inspect', 3, 'inspect'),
    item('run', 'Run', 4, 'run'),
  ];
  return templates.slice(0, count);
}

function defaultProps(overrides: Partial<RadialMenuProps> = {}): RadialMenuProps {
  return {
    items: makeItems(),
    context: { view: 'architecture', target: 'node', targetId: 'node-1', targetLabel: 'Arduino Mega' },
    position: { x: 400, y: 300 },
    onClose: vi.fn(),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function renderMenu(overrides: Partial<RadialMenuProps> = {}) {
  const props = defaultProps(overrides);
  const result = render(<RadialMenu {...props} />);
  return { ...result, props };
}

function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RadialMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearRadialTelemetry();
  });

  afterEach(() => {
    setViewportSize(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height);
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('renders the radial-menu container', () => {
      renderMenu();
      expect(screen.getByTestId('radial-menu')).toBeDefined();
    });

    it('keeps the overlay isolated for fast transform and hover paints', () => {
      renderMenu();
      const menu = screen.getByTestId('radial-menu');
      expect(menu.className).toContain('transform-gpu');
      expect(menu.className).toContain('[contain:layout_paint_style]');
      expect(menu.className).toContain('[will-change:transform,opacity]');
    });

    it('records a mounted open-latency event inside the hot-path budget', () => {
      renderMenu({ openedAt: performance.now() });
      const mountedEvent = readRadialTelemetry().find((event) => event.name === 'visible-mounted');

      expect(mountedEvent).toMatchObject({
        name: 'visible-mounted',
        view: 'architecture',
        target: 'node',
        actionCount: 4,
      });
      expect(mountedEvent?.durationMs).toBeGreaterThanOrEqual(0);
      expect(mountedEvent?.durationMs).toBeLessThan(32);
    });

    it('renders the correct number of menu items', () => {
      renderMenu({ items: makeItems(5) });
      expect(screen.getAllByRole('menuitem')).toHaveLength(5);
      expect(screen.getByTestId('radial-item-edit')).toBeDefined();
      expect(screen.getByTestId('radial-item-delete')).toBeDefined();
      expect(screen.getByTestId('radial-item-duplicate')).toBeDefined();
      expect(screen.getByTestId('radial-item-add_to_bom')).toBeDefined();
      expect(screen.getByTestId('radial-item-transform')).toBeDefined();
    });

    it('does not render when items array is empty', () => {
      const { container } = renderMenu({ items: [] });
      expect(container.innerHTML).toBe('');
    });

    it('exposes menu semantics and active descendant support', () => {
      renderMenu();
      const menu = screen.getByTestId('radial-menu');
      expect(menu.getAttribute('role')).toBe('menu');
      expect(menu.getAttribute('aria-label')).toBe('Radial context menu');
      expect(menu.getAttribute('aria-orientation')).toBe('vertical');
    });

    it('sets aria-label and aria-disabled on every item', () => {
      const items = makeItems(2);
      items[0].disabled = true;
      renderMenu({ items });
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems[0].getAttribute('aria-label')).toBe('Edit');
      expect(menuItems[0].getAttribute('aria-disabled')).toBe('true');
      expect(menuItems[0].getAttribute('aria-keyshortcuts')).toBe('7');
      expect(menuItems[0].querySelector('title')?.textContent).toBe('Edit: press 7 or flick W');
      expect(menuItems[1].getAttribute('aria-label')).toBe('Delete');
      expect(menuItems[1].getAttribute('aria-disabled')).toBe('false');
      expect(menuItems[1].getAttribute('aria-keyshortcuts')).toBe('6');
    });

    it('renders visible labels immediately so hover does not create layout churn', () => {
      renderMenu({ items: makeItems(3) });
      expect(screen.getByTestId('radial-label-edit')).toHaveTextContent('Edit');
      expect(screen.getByTestId('radial-label-delete')).toHaveTextContent('Delete');
      expect(screen.getByTestId('radial-label-duplicate')).toHaveTextContent('Duplicate');
    });

    it('teaches the slot number and gesture direction on every label', () => {
      renderMenu({ items: makeItems(4) });
      expect(screen.getByTestId('radial-shortcut-add_to_bom')).toHaveTextContent('1 / N');
      expect(screen.getByTestId('radial-shortcut-delete')).toHaveTextContent('6 / SW');
      expect(screen.getByTestId('radial-shortcut-edit')).toHaveTextContent('7 / W');
      expect(screen.getByTestId('radial-shortcut-duplicate')).toHaveTextContent('8 / NW');
      expect(screen.getByTestId('radial-item-add_to_bom')).toHaveAttribute('data-shortcut', '1');
    });

    it('renders with the full 8-slot command limit', () => {
      renderMenu({ items: makeItems(8) });
      expect(screen.getAllByRole('menuitem')).toHaveLength(8);
    });

    it('shows context target in the center well before hover', () => {
      renderMenu();
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Arduino Mega');
      expect(screen.getByTestId('radial-center-description')).toHaveTextContent('Architecture node');
    });

    it('exposes each command slot for customization and tests', () => {
      renderMenu();
      expect(screen.getByTestId('radial-item-edit')).toHaveAttribute('data-slot', '6');
      expect(screen.getByTestId('radial-label-add_to_bom')).toHaveAttribute('data-slot', '0');
    });
  });

  describe('positioning', () => {
    it('applies a fixed-position offset style', () => {
      renderMenu({ position: { x: 500, y: 400 } });
      const menu = screen.getByTestId('radial-menu');
      expect(menu.style.left).toBeTruthy();
      expect(menu.style.top).toBeTruthy();
    });

    it('clamps position so menu stays within the viewport', () => {
      renderMenu({ position: { x: 5, y: 5 } });
      const menu = screen.getByTestId('radial-menu');
      expect(parseInt(menu.style.left, 10)).toBeGreaterThanOrEqual(0);
      expect(parseInt(menu.style.top, 10)).toBeGreaterThanOrEqual(0);
    });

    it('clamps near bottom-right corner', () => {
      renderMenu({ position: { x: 9999, y: 9999 } });
      const menu = screen.getByTestId('radial-menu');
      expect(parseInt(menu.style.left, 10)).toBeLessThan(9999);
      expect(parseInt(menu.style.top, 10)).toBeLessThan(9999);
    });

    it('scales and clamps the visual wheel on narrow mobile viewports', () => {
      setViewportSize(360, 520);
      renderMenu({ position: { x: 9999, y: 9999 } });
      const menu = screen.getByTestId('radial-menu');
      const scale = Number(menu.getAttribute('data-radial-scale'));
      const menuSize = parseFloat(menu.style.width);
      const visualLeft = parseFloat(menu.style.left) + menuSize / 2 - (menuSize * scale) / 2;
      const visualRight = parseFloat(menu.style.left) + menuSize / 2 + (menuSize * scale) / 2;

      expect(scale).toBeLessThan(1);
      expect(menu.style.transform).toContain('translateZ(0) scale(');
      expect(visualLeft).toBeGreaterThanOrEqual(11.5);
      expect(visualRight).toBeLessThanOrEqual(348.5);
    });
  });

  describe('mouse interaction', () => {
    it('calls onSelect and onClose when an item is clicked', () => {
      const { props } = renderMenu();
      fireEvent.click(screen.getByTestId('radial-item-edit'));
      expect(props.onSelect).toHaveBeenCalledWith('edit', { input: 'mouse' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('passes send-now activation when an item is shift-clicked', () => {
      const { props } = renderMenu();
      fireEvent.click(screen.getByTestId('radial-item-edit'), { shiftKey: true });
      expect(props.onSelect).toHaveBeenCalledWith('edit', {
        input: 'mouse',
        sendNow: true,
        modifier: 'shift',
      });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('does not call onSelect when a disabled item is clicked', () => {
      const items = makeItems(2);
      items[0].disabled = true;
      const { props } = renderMenu({ items });
      fireEvent.click(screen.getByTestId('radial-item-edit'));
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('updates the center well on hover without adding or removing labels', () => {
      const onPreviewChange = vi.fn();
      renderMenu({ onPreviewChange });
      fireEvent.mouseEnter(screen.getByTestId('radial-item-edit'));
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Edit');
      expect(screen.getByTestId('radial-center-description')).toHaveTextContent('Edit command');
      expect(screen.getByText('7/W')).toBeDefined();
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
      expect(onPreviewChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({ id: 'edit' }),
          position: { x: 400, y: 300 },
        }),
      );

      const svg = screen.getByTestId('radial-menu').querySelector('svg');
      expect(svg).not.toBeNull();
      fireEvent.mouseLeave(svg as SVGElement);
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Arduino Mega');
      expect(onPreviewChange).toHaveBeenLastCalledWith(null);
    });

    it('shows disabled reasons in the center well', () => {
      const items = makeItems(1);
      items[0].disabled = true;
      items[0].disabledReason = 'Select a component first';
      renderMenu({ items });
      fireEvent.mouseEnter(screen.getByTestId('radial-item-edit'));
      expect(screen.getByTestId('radial-center-description')).toHaveTextContent('Select a component first');
    });

    it('calls onClose on click-away after delay', () => {
      const { props } = renderMenu();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      fireEvent.mouseDown(document.body);
      expect(props.onClose).toHaveBeenCalled();
    });

    it('does not close on click-away during initial delay', () => {
      const { props } = renderMenu();
      fireEvent.mouseDown(document.body);
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('opens customization from the tool button', () => {
      const onCustomize = vi.fn();
      renderMenu({ onCustomize });
      fireEvent.click(screen.getByTestId('radial-customize'));
      expect(onCustomize).toHaveBeenCalledTimes(1);
    });

    it('opens repeat AI from the tool button when history exists', () => {
      const onRepeatLastAi = vi.fn();
      const { props } = renderMenu({
        onRepeatLastAi,
        repeatLastAiLabel: 'Repeat AI: Explain architecture',
        repeatLastAiDescription: 'Resend Explain architecture to AI chat.',
      });

      const repeatButton = screen.getByTestId('radial-repeat-ai');
      expect(repeatButton).toHaveTextContent('Repeat AI');
      expect(repeatButton).toHaveAttribute('aria-label', 'Repeat AI: Explain architecture');
      expect(screen.getByTestId('radial-menu').getAttribute('aria-keyshortcuts')).toContain('R');

      fireEvent.click(repeatButton);

      expect(onRepeatLastAi).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('requires a second click before running destructive commands', () => {
      const { props } = renderMenu();

      fireEvent.click(screen.getByTestId('radial-item-delete'));

      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Confirm Delete');
      expect(screen.getByTestId('radial-center-description')).toHaveTextContent('Click Delete again');
      expect(screen.getByTestId('radial-confirm-state')).toHaveTextContent('Confirm');
      expect(screen.getByTestId('radial-label-delete')).toHaveTextContent('Confirm Delete');

      fireEvent.click(screen.getByTestId('radial-item-delete'));

      expect(props.onSelect).toHaveBeenCalledWith('delete', { input: 'mouse' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('clears destructive confirmation if the user waits too long', () => {
      const { props } = renderMenu();

      fireEvent.click(screen.getByTestId('radial-item-delete'));
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Confirm Delete');

      act(() => {
        vi.advanceTimersByTime(5300);
      });

      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Delete');
      fireEvent.click(screen.getByTestId('radial-item-delete'));
      expect(props.onSelect).not.toHaveBeenCalled();
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Confirm Delete');
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape', () => {
      const { props } = renderMenu();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('navigates forward with ArrowRight', () => {
      const onPreviewChange = vi.fn();
      renderMenu({ items: makeItems(3), onPreviewChange });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Edit');
      expect(screen.getByTestId('radial-menu')).toHaveAttribute('aria-activedescendant', 'radial-menuitem-edit');
      expect(onPreviewChange).toHaveBeenLastCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({ id: 'edit' }),
        }),
      );
    });

    it('navigates forward with ArrowDown', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Edit');
    });

    it('navigates backward with ArrowLeft', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Edit');
    });

    it('wraps forward from last item to first', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Edit');
    });

    it('wraps backward from first item to last', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowLeft' });
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Duplicate');
    });

    it('selects item with Enter key', () => {
      const { props } = renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).toHaveBeenCalledWith('edit', { input: 'keyboard' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('selects item with Space key', () => {
      const { props } = renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: ' ' });
      expect(props.onSelect).toHaveBeenCalledWith('edit', { input: 'keyboard' });
    });

    it('passes send-now activation when Enter is used with Shift', () => {
      const { props } = renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'Enter', shiftKey: true });
      expect(props.onSelect).toHaveBeenCalledWith('edit', {
        input: 'keyboard',
        sendNow: true,
        modifier: 'shift',
      });
    });

    it('selects commands directly with 1 through 8 slot hotkeys', () => {
      const onPreviewChange = vi.fn();
      const { props } = renderMenu({ items: makeItems(8), onPreviewChange });

      fireEvent.keyDown(window, { key: '7', code: 'Digit7' });

      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Edit');
      expect(screen.getByTestId('radial-menu')).toHaveAttribute('aria-activedescendant', 'radial-menuitem-edit');
      expect(onPreviewChange).toHaveBeenCalledWith(
        expect.objectContaining({
          item: expect.objectContaining({ id: 'edit' }),
        }),
      );
      expect(props.onSelect).toHaveBeenCalledWith('edit', { input: 'keyboard' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('does not steal modified number shortcuts', () => {
      const { props } = renderMenu({ items: makeItems(8) });

      fireEvent.keyDown(window, { key: '7', code: 'Digit7', ctrlKey: true });

      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('does not run disabled commands from number hotkeys', () => {
      const items = makeItems(8);
      items[0].disabled = true;
      const { props } = renderMenu({ items });

      fireEvent.keyDown(window, { key: '7', code: 'Digit7' });

      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
    });

    it('requires a second slot hotkey before running a destructive command', () => {
      const { props } = renderMenu({ items: makeItems(8) });

      fireEvent.keyDown(window, { key: '6', code: 'Digit6' });
      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Confirm Delete');

      fireEvent.keyDown(window, { key: '6', code: 'Digit6' });
      expect(props.onSelect).toHaveBeenCalledWith('delete', { input: 'keyboard' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('opens customization with the C key', () => {
      const onCustomize = vi.fn();
      const onPreviewChange = vi.fn();
      renderMenu({ onCustomize, onPreviewChange });
      fireEvent.keyDown(window, { key: 'ArrowRight' });

      fireEvent.keyDown(window, { key: 'c', code: 'KeyC' });

      expect(onCustomize).toHaveBeenCalledTimes(1);
      expect(onPreviewChange).toHaveBeenLastCalledWith(null);
    });

    it('does not steal modified C shortcuts for customization', () => {
      const onCustomize = vi.fn();
      renderMenu({ onCustomize });

      fireEvent.keyDown(window, { key: 'c', code: 'KeyC', ctrlKey: true });

      expect(onCustomize).not.toHaveBeenCalled();
    });

    it('runs repeat AI with the R key', () => {
      const onRepeatLastAi = vi.fn();
      const onPreviewChange = vi.fn();
      const { props } = renderMenu({
        onPreviewChange,
        onRepeatLastAi,
        repeatLastAiLabel: 'Repeat AI: Fix issue',
      });

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'r', code: 'KeyR' });

      expect(onPreviewChange).toHaveBeenLastCalledWith(null);
      expect(onRepeatLastAi).toHaveBeenCalledTimes(1);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    });

    it('requires a second Enter before running a destructive keyboard command', () => {
      const { props } = renderMenu({ items: makeItems(3) });

      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Delete');

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).not.toHaveBeenCalled();
      expect(props.onClose).not.toHaveBeenCalled();
      expect(screen.getByTestId('radial-center-title')).toHaveTextContent('Confirm Delete');

      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).toHaveBeenCalledWith('delete', { input: 'keyboard' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('does not select disabled item with Enter', () => {
      const items = makeItems(3);
      items[0].disabled = true;
      const { props } = renderMenu({ items });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('Enter does nothing when no item is hovered', () => {
      const { props } = renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).not.toHaveBeenCalled();
    });
  });

  describe('animation', () => {
    it('starts with scale-50 opacity-0 class', () => {
      renderMenu();
      const menu = screen.getByTestId('radial-menu');
      expect(menu.className).toContain('scale-50');
      expect(menu.className).toContain('opacity-0');
    });
  });

  describe('destructive styling', () => {
    it('applies destructive tone to delete item on hover', () => {
      renderMenu();
      fireEvent.mouseEnter(screen.getByTestId('radial-item-delete'));
      expect(screen.getByTestId('radial-label-delete').className).toContain('text-red-100');
    });
  });

  describe('cleanup', () => {
    it('removes keydown listener on unmount', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderMenu();
      unmount();
      expect(spy.mock.calls.filter((c) => c[0] === 'keydown').length).toBeGreaterThanOrEqual(1);
      spy.mockRestore();
    });

    it('removes mousedown listener on unmount', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderMenu();
      act(() => {
        vi.advanceTimersByTime(100);
      });
      unmount();
      expect(spy.mock.calls.filter((c) => c[0] === 'mousedown').length).toBeGreaterThanOrEqual(1);
      spy.mockRestore();
    });
  });
});
