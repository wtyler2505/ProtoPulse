import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SchematicToolbar from '../SchematicToolbar';

function renderToolbar(overrides: Partial<React.ComponentProps<typeof SchematicToolbar>> = {}) {
  const props: React.ComponentProps<typeof SchematicToolbar> = {
    activeTool: 'select',
    onToolChange: vi.fn(),
    snapEnabled: true,
    onToggleSnap: vi.fn(),
    onFitView: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<SchematicToolbar {...props} />) };
}

describe('SchematicToolbar — place-component / place-power (E2E-849, E2E-915, Plan 02 Phase 8)', () => {
  let partsSpy: ReturnType<typeof vi.fn>;
  let powerSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    partsSpy = vi.fn();
    powerSpy = vi.fn();
    window.addEventListener('protopulse:schematic-focus-parts-panel', partsSpy);
    window.addEventListener('protopulse:schematic-focus-power-panel', powerSpy);
  });

  afterEach(() => {
    window.removeEventListener('protopulse:schematic-focus-parts-panel', partsSpy);
    window.removeEventListener('protopulse:schematic-focus-power-panel', powerSpy);
  });

  it('place-component button is enabled (not perma-disabled)', () => {
    renderToolbar();
    const btn = screen.getByTestId('schematic-tool-place-component');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('place-power button is enabled (not perma-disabled)', () => {
    renderToolbar();
    const btn = screen.getByTestId('schematic-tool-place-power');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('clicking place-component dispatches protopulse:schematic-focus-parts-panel', () => {
    const { props } = renderToolbar();
    fireEvent.click(screen.getByTestId('schematic-tool-place-component'));
    expect(partsSpy).toHaveBeenCalledTimes(1);
    expect(powerSpy).not.toHaveBeenCalled();
    // Must NOT change the active tool — place-component is a panel shortcut,
    // not a drawing tool.
    expect(props.onToolChange).not.toHaveBeenCalled();
  });

  it('clicking place-power dispatches protopulse:schematic-focus-power-panel', () => {
    const { props } = renderToolbar();
    fireEvent.click(screen.getByTestId('schematic-tool-place-power'));
    expect(powerSpy).toHaveBeenCalledTimes(1);
    expect(partsSpy).not.toHaveBeenCalled();
    expect(props.onToolChange).not.toHaveBeenCalled();
  });

  it('clicking select (a drawing tool) still calls onToolChange, not dispatch', () => {
    const { props } = renderToolbar({ activeTool: 'pan' });
    fireEvent.click(screen.getByTestId('schematic-tool-select'));
    expect(props.onToolChange).toHaveBeenCalledWith('select');
    expect(partsSpy).not.toHaveBeenCalled();
    expect(powerSpy).not.toHaveBeenCalled();
  });
});
