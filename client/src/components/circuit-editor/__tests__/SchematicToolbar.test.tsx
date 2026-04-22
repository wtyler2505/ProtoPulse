import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
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
  return {
    props,
    ...render(
      <TooltipProvider>
        <SchematicToolbar {...props} />
      </TooltipProvider>,
    ),
  };
}

describe('SchematicToolbar — place-component / place-power (E2E-849, E2E-915, Plan 02 Phase 8)', () => {
  let partsSpy: Mock<() => void>;
  let powerSpy: Mock<() => void>;
  let partsListener: EventListener;
  let powerListener: EventListener;

  beforeEach(() => {
    partsSpy = vi.fn<() => void>();
    powerSpy = vi.fn<() => void>();
    partsListener = (() => { partsSpy(); }) as EventListener;
    powerListener = (() => { powerSpy(); }) as EventListener;
    window.addEventListener('protopulse:schematic-focus-parts-panel', partsListener);
    window.addEventListener('protopulse:schematic-focus-power-panel', powerListener);
  });

  afterEach(() => {
    window.removeEventListener('protopulse:schematic-focus-parts-panel', partsListener);
    window.removeEventListener('protopulse:schematic-focus-power-panel', powerListener);
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
