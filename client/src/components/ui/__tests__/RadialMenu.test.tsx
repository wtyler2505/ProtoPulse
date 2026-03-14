import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import type { RadialMenuItem } from '@/lib/radial-menu-actions';

// Mock lucide-react icons
vi.mock('lucide-react', () => {
  const iconFactory = (name: string) =>
    (props: Record<string, unknown>) => <svg data-testid={`icon-${name}`} {...props} />;
  return {
    Edit: iconFactory('edit'),
    Trash2: iconFactory('trash2'),
    Link: iconFactory('link'),
    RefreshCw: iconFactory('refresh-cw'),
    Copy: iconFactory('copy'),
    Package: iconFactory('package'),
    RotateCw: iconFactory('rotate-cw'),
    FlipHorizontal2: iconFactory('flip-horizontal'),
    Settings2: iconFactory('settings'),
    Ruler: iconFactory('ruler'),
    FileText: iconFactory('file-text'),
    Plus: iconFactory('plus'),
    Minus: iconFactory('minus'),
    Search: iconFactory('search'),
    ArrowRight: iconFactory('arrow-right'),
    CircuitBoard: iconFactory('circuit-board'),
    ShieldCheck: iconFactory('shield-check'),
    Move: iconFactory('move'),
    Zap: iconFactory('zap'),
    Grid3X3: iconFactory('grid'),
  };
});

import RadialMenu from '@/components/ui/RadialMenu';
import type { RadialMenuProps } from '@/components/ui/RadialMenu';
import { Edit, Trash2, Copy, Package } from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeItems(count: number = 4): RadialMenuItem[] {
  const templates: RadialMenuItem[] = [
    { id: 'edit', label: 'Edit', icon: Edit },
    { id: 'delete', label: 'Delete', icon: Trash2, destructive: true },
    { id: 'duplicate', label: 'Duplicate', icon: Copy },
    { id: 'add_to_bom', label: 'Add to BOM', icon: Package },
    { id: 'extra1', label: 'Extra 1', icon: Edit },
    { id: 'extra2', label: 'Extra 2', icon: Edit },
    { id: 'extra3', label: 'Extra 3', icon: Edit },
    { id: 'extra4', label: 'Extra 4', icon: Edit },
  ];
  return templates.slice(0, count);
}

function defaultProps(overrides: Partial<RadialMenuProps> = {}): RadialMenuProps {
  return {
    items: makeItems(),
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RadialMenu', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ----- Rendering -----

  describe('rendering', () => {
    it('renders the radial-menu container', () => {
      renderMenu();
      expect(screen.getByTestId('radial-menu')).toBeDefined();
    });

    it('renders correct number of menu items', () => {
      renderMenu({ items: makeItems(5) });
      expect(screen.getByTestId('radial-item-edit')).toBeDefined();
      expect(screen.getByTestId('radial-item-delete')).toBeDefined();
      expect(screen.getByTestId('radial-item-duplicate')).toBeDefined();
      expect(screen.getByTestId('radial-item-add_to_bom')).toBeDefined();
      expect(screen.getByTestId('radial-item-extra1')).toBeDefined();
    });

    it('does not render when items array is empty', () => {
      const { container } = renderMenu({ items: [] });
      expect(container.innerHTML).toBe('');
    });

    it('has role="menu" on the container', () => {
      renderMenu();
      const menu = screen.getByTestId('radial-menu');
      expect(menu.getAttribute('role')).toBe('menu');
    });

    it('each item has role="menuitem"', () => {
      renderMenu({ items: makeItems(3) });
      const items = screen.getAllByRole('menuitem');
      expect(items.length).toBe(3);
    });

    it('sets aria-label on each menuitem', () => {
      renderMenu({ items: makeItems(2) });
      const items = screen.getAllByRole('menuitem');
      expect(items[0].getAttribute('aria-label')).toBe('Edit');
      expect(items[1].getAttribute('aria-label')).toBe('Delete');
    });

    it('sets aria-disabled for disabled items', () => {
      const items = makeItems(2);
      items[0].disabled = true;
      renderMenu({ items });
      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems[0].getAttribute('aria-disabled')).toBe('true');
      expect(menuItems[1].getAttribute('aria-disabled')).toBe('false');
    });

    it('renders with 3 items', () => {
      renderMenu({ items: makeItems(3) });
      expect(screen.getAllByRole('menuitem').length).toBe(3);
    });

    it('renders with 8 items', () => {
      renderMenu({ items: makeItems(8) });
      expect(screen.getAllByRole('menuitem').length).toBe(8);
    });
  });

  // ----- Positioning -----

  describe('positioning', () => {
    it('applies position as fixed offset style', () => {
      renderMenu({ position: { x: 500, y: 400 } });
      const menu = screen.getByTestId('radial-menu');
      const style = menu.style;
      // Should be positioned — exact values depend on clamping logic
      expect(style.position).toBe('');  // class-based "fixed"
      expect(style.left).toBeTruthy();
      expect(style.top).toBeTruthy();
    });

    it('clamps position so menu stays within viewport', () => {
      // Position at extreme edge — should be clamped inward
      renderMenu({ position: { x: 5, y: 5 } });
      const menu = screen.getByTestId('radial-menu');
      const left = parseInt(menu.style.left, 10);
      const top = parseInt(menu.style.top, 10);
      // The menu should not have a negative left/top
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
    });

    it('clamps near bottom-right corner', () => {
      renderMenu({ position: { x: 9999, y: 9999 } });
      const menu = screen.getByTestId('radial-menu');
      const left = parseInt(menu.style.left, 10);
      const top = parseInt(menu.style.top, 10);
      // Should be clamped to reasonable values
      expect(left).toBeLessThan(9999);
      expect(top).toBeLessThan(9999);
    });
  });

  // ----- Mouse interaction -----

  describe('mouse interaction', () => {
    it('calls onSelect and onClose when an item is clicked', () => {
      const { props } = renderMenu();
      const item = screen.getByTestId('radial-item-edit');
      fireEvent.click(item);
      expect(props.onSelect).toHaveBeenCalledWith('edit');
      expect(props.onClose).toHaveBeenCalled();
    });

    it('does not call onSelect when a disabled item is clicked', () => {
      const items = makeItems(2);
      items[0].disabled = true;
      const { props } = renderMenu({ items });
      const item = screen.getByTestId('radial-item-edit');
      fireEvent.click(item);
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('shows label on hover', () => {
      renderMenu();
      const item = screen.getByTestId('radial-item-edit');
      fireEvent.mouseEnter(item);
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
      expect(screen.getByTestId('radial-label-edit').textContent).toBe('Edit');
    });

    it('hides label on mouse leave', () => {
      renderMenu();
      const item = screen.getByTestId('radial-item-edit');
      fireEvent.mouseEnter(item);
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
      fireEvent.mouseLeave(item);
      expect(screen.queryByTestId('radial-label-edit')).toBeNull();
    });

    it('calls onClose on click-away after delay', () => {
      const { props } = renderMenu();
      // Advance past the 50ms attach delay
      act(() => { vi.advanceTimersByTime(100); });
      fireEvent.mouseDown(document.body);
      expect(props.onClose).toHaveBeenCalled();
    });

    it('does not close on click-away during initial delay', () => {
      const { props } = renderMenu();
      // Fire immediately before the 50ms delay
      fireEvent.mouseDown(document.body);
      expect(props.onClose).not.toHaveBeenCalled();
    });
  });

  // ----- Keyboard navigation -----

  describe('keyboard navigation', () => {
    it('closes on Escape', () => {
      const { props } = renderMenu();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(props.onClose).toHaveBeenCalled();
    });

    it('navigates forward with ArrowRight', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      // First item should now be hovered (index 0)
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
    });

    it('navigates forward with ArrowDown', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowDown' });
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
    });

    it('navigates backward with ArrowLeft', () => {
      renderMenu({ items: makeItems(3) });
      // Go forward twice then back once
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // index 0
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // index 1
      fireEvent.keyDown(window, { key: 'ArrowLeft' });   // back to index 0
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
    });

    it('wraps forward from last item to first', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // 0
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // 1
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // 2
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // wraps to 0
      expect(screen.getByTestId('radial-label-edit')).toBeDefined();
    });

    it('wraps backward from first item to last', () => {
      renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowLeft' }); // wraps to last (index 2)
      expect(screen.getByTestId('radial-label-duplicate')).toBeDefined();
    });

    it('selects item with Enter key', () => {
      const { props } = renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // hover first
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).toHaveBeenCalledWith('edit');
      expect(props.onClose).toHaveBeenCalled();
    });

    it('selects item with Space key', () => {
      const { props } = renderMenu({ items: makeItems(3) });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: ' ' });
      expect(props.onSelect).toHaveBeenCalledWith('edit');
    });

    it('does not select disabled item with Enter', () => {
      const items = makeItems(3);
      items[0].disabled = true;
      const { props } = renderMenu({ items });
      fireEvent.keyDown(window, { key: 'ArrowRight' }); // hover disabled item
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).not.toHaveBeenCalled();
    });

    it('Enter does nothing when no item is hovered', () => {
      const { props } = renderMenu({ items: makeItems(3) });
      // No arrow key pressed — hoveredIndex is -1
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(props.onSelect).not.toHaveBeenCalled();
    });
  });

  // ----- Animation -----

  describe('animation', () => {
    it('starts with scale-50 opacity-0 class', () => {
      renderMenu();
      const menu = screen.getByTestId('radial-menu');
      expect(menu.className).toContain('scale-50');
      expect(menu.className).toContain('opacity-0');
    });
  });

  // ----- Destructive items -----

  describe('destructive styling', () => {
    it('applies destructive class to delete item on hover', () => {
      renderMenu();
      const item = screen.getByTestId('radial-item-delete');
      fireEvent.mouseEnter(item);
      // The label should render with destructive text color
      const label = screen.getByTestId('radial-label-delete');
      expect(label.className).toContain('text-destructive');
    });
  });

  // ----- Cleanup -----

  describe('cleanup', () => {
    it('removes keydown listener on unmount', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderMenu();
      unmount();
      const keydownCalls = spy.mock.calls.filter((c) => c[0] === 'keydown');
      expect(keydownCalls.length).toBeGreaterThanOrEqual(1);
      spy.mockRestore();
    });

    it('removes mousedown listener on unmount', () => {
      const spy = vi.spyOn(window, 'removeEventListener');
      const { unmount } = renderMenu();
      act(() => { vi.advanceTimersByTime(100); });
      unmount();
      const mousedownCalls = spy.mock.calls.filter((c) => c[0] === 'mousedown');
      expect(mousedownCalls.length).toBeGreaterThanOrEqual(1);
      spy.mockRestore();
    });
  });
});
