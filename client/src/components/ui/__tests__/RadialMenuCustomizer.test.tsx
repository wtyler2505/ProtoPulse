import type { ReactElement } from 'react';
import { render as renderWithTestingLibrary, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Edit, Microscope, Plus, Trash2 } from 'lucide-react';
import RadialMenuCustomizer from '@/components/ui/RadialMenuCustomizer';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { MenuContext, RadialMenuItem } from '@/lib/radial-menu-actions';
import {
  applyRadialPreferences,
  getRadialPinnedPresetId,
  getRadialPreferenceKey,
  radialPreferencesStore,
} from '@/lib/radial-menu-preferences';
import { clearRadialTelemetry, recordRadialTelemetry } from '@/lib/radial-menu-telemetry';

function makeItems(): RadialMenuItem[] {
  return [
    {
      id: 'add_node',
      label: 'Add Node',
      description: 'Drop a new architecture block on the canvas.',
      icon: Plus,
      slot: 0,
      group: 'create',
      hint: 'N',
    },
    {
      id: 'delete',
      label: 'Delete',
      description: 'Remove this block.',
      icon: Trash2,
      slot: 5,
      group: 'delete',
      hint: 'SW',
      destructive: true,
    },
    {
      id: 'edit',
      label: 'Edit',
      description: 'Open the editor.',
      icon: Edit,
      slot: 6,
      group: 'edit',
      hint: 'W',
    },
  ];
}

function makeCoachItems(): RadialMenuItem[] {
  return [
    ...makeItems(),
    {
      id: 'ai_explain_architecture',
      label: 'AI Explain',
      description: 'Explain this target.',
      icon: Microscope,
      slot: 3,
      group: 'inspect',
      hint: 'SE',
    },
  ];
}

const context: MenuContext = {
  view: 'architecture',
  target: 'canvas',
};

const DEFAULT_VIEWPORT = {
  width: window.innerWidth,
  height: window.innerHeight,
};

function render(ui: ReactElement) {
  return renderWithTestingLibrary(<TooltipProvider>{ui}</TooltipProvider>);
}

function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

describe('RadialMenuCustomizer', () => {
  let clipboardWriteText: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearRadialTelemetry();
    window.localStorage.clear();
    radialPreferencesStore.resetAll();
    clipboardWriteText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: clipboardWriteText,
      },
    });
  });

  afterEach(() => {
    setViewportSize(DEFAULT_VIEWPORT.width, DEFAULT_VIEWPORT.height);
  });

  it('renders command rows with active slot buttons', () => {
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer')).toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-layout', 'floating');
    expect(screen.getByTestId('radial-customizer-preview-wheel')).toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '0');
    expect(screen.getByTestId('radial-customizer-preview-title')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('radial-customizer-gesture-coach')).toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-coverage-map')).toHaveAttribute(
      'data-current-key',
      'architecture-canvas',
    );
    expect(
      Number(screen.getByTestId('radial-customizer-coverage-map').getAttribute('data-context-count')),
    ).toBeGreaterThan(10);
    expect(screen.getByTestId('radial-customizer-coverage-current-summary')).toHaveAttribute('data-command-count', '8');
    expect(screen.getByTestId('radial-customizer-coverage-current-summary')).toHaveAttribute(
      'data-empty-slot-count',
      '0',
    );
    expect(screen.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
      'data-current',
      'true',
    );
    expect(screen.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
      'data-coverage',
      'full',
    );
    expect(screen.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
      'data-command-count',
      '8',
    );
    expect(screen.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute(
      'data-empty-slots',
      'none',
    );
    expect(screen.getByTestId('radial-customizer-coverage-architecture-canvas')).toHaveAttribute('data-ai-count', '2');
    expect(screen.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-coverage', 'full');
    expect(screen.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-command-count', '8');
    expect(screen.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-empty-slot-count', '0');
    expect(screen.getByTestId('radial-customizer-coverage-bom-canvas')).toHaveAttribute('data-ai-count', '1');
    expect(screen.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
      'data-coverage',
      'full',
    );
    expect(screen.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
      'data-command-count',
      '8',
    );
    expect(screen.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
      'data-empty-slot-count',
      '0',
    );
    expect(screen.getByTestId('radial-customizer-coverage-starter_circuits-canvas')).toHaveAttribute(
      'data-ai-count',
      '1',
    );
    expect(screen.getByTestId('radial-customizer-gesture-selected-direction')).toHaveTextContent('N');
    expect(screen.getByTestId('radial-customizer-gesture-slot-label-0')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('radial-customizer-gesture-slot-label-2')).toHaveTextContent('Empty');
    expect(screen.getByTestId('radial-telemetry-inspector')).toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-row-add_node')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('radial-customizer-slot-add_node-0')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('radial-customizer-slot-add_node-2')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');
    expect(screen.getByTestId('radial-customizer-apply')).toBeDisabled();
  });

  it('focuses command search on open and returns focus with keyboard shortcuts', async () => {
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const search = screen.getByTestId('radial-customizer-command-search') as HTMLInputElement;
    await waitFor(() => {
      expect(document.activeElement).toBe(search);
    });

    const collapseButton = screen.getByTestId('radial-customizer-collapse') as HTMLButtonElement;
    collapseButton.focus();
    expect(document.activeElement).toBe(collapseButton);

    fireEvent.keyDown(screen.getByTestId('radial-customizer'), { key: '/', code: 'Slash' });
    await waitFor(() => {
      expect(document.activeElement).toBe(search);
    });

    collapseButton.focus();
    expect(document.activeElement).toBe(collapseButton);
    fireEvent.keyDown(screen.getByTestId('radial-customizer'), { key: 'f', code: 'KeyF', ctrlKey: true });
    await waitFor(() => {
      expect(document.activeElement).toBe(search);
    });
  });

  it('uses a viewport-bounded compact sheet on narrow screens', () => {
    setViewportSize(360, 520);
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 999, y: 999 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const customizer = screen.getByTestId('radial-customizer');
    expect(customizer).toHaveAttribute('data-layout', 'compact-sheet');
    expect(customizer.style.left).toBe('8px');
    expect(customizer.style.top).toBe('8px');
    expect(customizer.style.width).toContain('calc(');
    expect(customizer.style.width).toContain('16px');
    expect(customizer.style.height).toContain('calc(');
    expect(customizer.style.height).toContain('16px');
    expect(customizer.className).toContain('resize-y');
    expect(screen.getByTestId('radial-customizer-body').className).toContain('overflow-y-auto');
    expect(screen.getByTestId('radial-customizer-footer')).toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-apply')).toBeVisible();

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));
    expect(customizer).toHaveAttribute('data-collapsed', 'true');
    expect(customizer.style.height).toBe('');
    expect(screen.queryByTestId('radial-customizer-body')).not.toBeInTheDocument();
    expect(screen.queryByTestId('radial-customizer-footer')).not.toBeInTheDocument();
  });

  it('collapses without losing draft slot changes', async () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const customizer = screen.getByTestId('radial-customizer');
    const collapseButton = screen.getByTestId('radial-customizer-collapse');
    expect(customizer).toHaveAttribute('data-collapsed', 'false');
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(screen.getByTestId('radial-customizer-slot-add_node-2'));
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('1 unsaved slot');

    fireEvent.click(collapseButton);
    expect(customizer).toHaveAttribute('data-collapsed', 'true');
    expect(collapseButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-summary')).toHaveTextContent('1 unsaved slot');
    expect(screen.getByTestId('radial-customizer-collapsed-mastery-trained')).toHaveTextContent('0 trained');
    expect(screen.getByTestId('radial-customizer-collapsed-mastery-building')).toHaveTextContent('0 building');
    expect(screen.getByTestId('radial-customizer-collapsed-mastery-cold')).toHaveTextContent('3 cold');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'idle');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '0/3');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress-percent', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-cue', 'practice');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-quick-open-mode', 'focus');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-cleared', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-flash', 'none');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-a11y-status',
      'Practice status: 0/3 local practice coverage.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-help',
      '0/3 practice coverage. Expand practice to drill the remaining cold gestures.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-action-hint',
      'Enter/Space opens practice.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveAttribute('aria-atomic', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveTextContent(
      'Practice status: 0/3 local practice coverage.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-progress', '0/3');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-progress-percent', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-cue', 'practice');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-replay-cleared', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-flash', 'none');
    expect(
      screen.getByTestId('radial-customizer-collapsed-idle').style.getPropertyValue('--collapsed-practice-progress'),
    ).toBe('0%');
    expect(screen.getByTestId('radial-customizer-collapsed-idle').className).toContain(
      'before:w-[var(--collapsed-practice-progress)]',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
      'aria-describedby',
      'radial-customizer-collapsed-practice-status',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('role', 'button');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
      'aria-label',
      'Open practice lane: Practice 0/3',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('aria-keyshortcuts', 'Enter Space');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-quick-open', 'practice-pad');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-quick-open-mode', 'focus');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
      'data-action-hint',
      'Enter/Space opens practice.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveTextContent('Practice 0/3');
    const idleChip = screen.getByTestId('radial-customizer-collapsed-idle');
    idleChip.focus();
    expect(document.activeElement).toBe(idleChip);
    expect(screen.queryByTestId('radial-customizer-body')).not.toBeInTheDocument();
    expect(screen.queryByTestId('radial-customizer-footer')).not.toBeInTheDocument();

    fireEvent.keyDown(idleChip, { key: 'Enter', code: 'Enter' });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('radial-customizer-practice-pad'));
    });
    expect(customizer).toHaveAttribute('data-collapsed', 'false');
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('1 unsaved slot');

    fireEvent.click(screen.getByTestId('radial-customizer-apply'));
    expect(onMove).toHaveBeenCalledWith('add_node', 2);
  });

  it('filters command rows while keeping the preview wheel visible', async () => {
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const search = screen.getByTestId('radial-customizer-command-search') as HTMLInputElement;
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('3/3');
    expect(screen.getByTestId('radial-customizer-preview-wheel')).toBeInTheDocument();

    fireEvent.change(search, { target: { value: 'remove block' } });

    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('1/3');
    expect(screen.queryByTestId('radial-customizer-row-add_node')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-row-delete')).toHaveTextContent('Delete');
    await waitFor(() => {
      expect(screen.getByTestId('radial-customizer-preview-title')).toHaveTextContent('Delete');
    });

    fireEvent.change(search, { target: { value: 'nope nope' } });
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('0/3');
    expect(screen.getByTestId('radial-customizer-command-empty')).toHaveTextContent('No commands match');
    expect(screen.getByTestId('radial-customizer-preview-wheel')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('radial-customizer-command-search-clear'));
    expect(search.value).toBe('');
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('3/3');
    expect(screen.getByTestId('radial-customizer-row-add_node')).toHaveTextContent('Add Node');
    expect(screen.queryByTestId('radial-customizer-command-empty')).not.toBeInTheDocument();
  }, 10_000);

  it('surfaces recent commands for the current context without moving commands', async () => {
    const onMove = vi.fn();
    recordRadialTelemetry({
      name: 'visible-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
    });
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
    });
    recordRadialTelemetry({
      name: 'visible-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'delete',
      slot: 5,
    });
    recordRadialTelemetry({
      name: 'visible-select',
      view: 'schematic',
      target: 'canvas',
      commandId: 'edit',
      slot: 6,
    });

    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-recent-commands')).toHaveTextContent('Recent here');
    expect(screen.getByTestId('radial-customizer-recent-commands')).toHaveTextContent('Architecture / Canvas');
    expect(screen.getByTestId('radial-customizer-recent-command-add_node')).toHaveAttribute(
      'data-command-id',
      'add_node',
    );
    expect(screen.getByTestId('radial-customizer-recent-command-add_node')).toHaveAttribute('data-count', '2');
    expect(screen.getByTestId('radial-customizer-recent-command-add_node')).toHaveAttribute('data-slot', '0');
    expect(screen.getByTestId('radial-customizer-recent-command-add_node')).toHaveAttribute('data-direction', 'N');
    expect(screen.getByTestId('radial-customizer-recent-command-add_node')).toHaveTextContent('2 uses');
    expect(screen.getByTestId('radial-customizer-recent-command-delete')).toHaveAttribute('data-count', '1');
    expect(screen.queryByTestId('radial-customizer-recent-command-edit')).not.toBeInTheDocument();

    const search = screen.getByTestId('radial-customizer-command-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'nope' } });
    fireEvent.click(screen.getByTestId('radial-customizer-mastery-filter-cold'));
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('0/3');

    fireEvent.click(screen.getByTestId('radial-customizer-recent-command-delete'));

    expect(search.value).toBe('');
    expect(screen.getByTestId('radial-customizer-mastery-filter-all')).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(screen.getByTestId('radial-customizer-preview-title')).toHaveTextContent('Delete');
    });
    expect(screen.getByTestId('radial-customizer-row-delete')).toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();
  }, 10_000);

  it('stages a smart layout from recent use and gesture misses without committing', async () => {
    const onMove = vi.fn();
    recordRadialTelemetry({
      name: 'visible-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
    });
    Array.from({ length: 2 }, () => {
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 2,
        reason: 'wrong-direction',
      });
    });

    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const smartSuggestion = screen.getByTestId('radial-customizer-smart-layout-suggestion');
    expect(screen.getByTestId('radial-customizer-smart-layout')).toHaveTextContent('Smart wheel');
    expect(screen.getByTestId('radial-customizer-smart-layout-count')).toHaveTextContent('1 staged move');
    expect(smartSuggestion).toHaveAttribute('data-change-count', '1');
    expect(smartSuggestion).toHaveAttribute('data-recent-count', '1');
    expect(smartSuggestion).toHaveAttribute('data-friction-misses', '2');
    expect(smartSuggestion).toHaveAttribute('data-primary-command-id', 'add_node');
    expect(smartSuggestion).toHaveTextContent('Tune wheel');
    expect(smartSuggestion).toHaveTextContent('2 gesture misses');
    expect(screen.getByTestId('radial-customizer-smart-layout-moves')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
      'data-command-id',
      'add_node',
    );
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
      'data-from-direction',
      'N',
    );
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
      'data-to-direction',
      'E',
    );
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
      'data-reasons',
      'gesture-miss',
    );
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveAttribute(
      'data-evidence',
      '2 tried toward E',
    );
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveTextContent('N -> E');
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveTextContent('Gesture miss');
    expect(screen.getByTestId('radial-customizer-smart-layout-move-add_node')).toHaveTextContent('2 tried toward E');
    expect(screen.getByTestId('radial-customizer-smart-layout-preview')).toHaveAttribute('data-slot-count', '8');
    expect(screen.getByTestId('radial-customizer-smart-layout-preview')).toHaveAttribute('data-change-count', '1');
    expect(screen.getByTestId('radial-customizer-smart-layout-preview-slot-2')).toHaveAttribute(
      'data-command-id',
      'add_node',
    );
    expect(screen.getByTestId('radial-customizer-smart-layout-preview-slot-2')).toHaveAttribute('data-direction', 'E');
    expect(screen.getByTestId('radial-customizer-smart-layout-preview-slot-2')).toHaveAttribute('data-changed', 'true');
    expect(screen.getByTestId('radial-customizer-smart-layout-preview-slot-2')).toHaveAttribute(
      'data-reasons',
      'gesture-miss',
    );
    expect(screen.getByTestId('radial-customizer-smart-layout-preview-slot-2')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('radial-customizer-smart-layout-preview-slot-2')).toHaveTextContent('New');

    fireEvent.click(smartSuggestion);

    await waitFor(() => {
      expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
    });
    expect(screen.getByTestId('radial-customizer-preview-title')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('1 unsaved slot');
    expect(screen.queryByTestId('radial-customizer-smart-layout-suggestion')).not.toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('radial-customizer-apply'));
    expect(onMove).toHaveBeenCalledWith('add_node', 2);
  }, 10_000);

  it('clears search on first Escape and closes on second Escape', async () => {
    const onClose = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={onClose}
      />,
    );

    const search = screen.getByTestId('radial-customizer-command-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'delete' } });
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('1/3');

    fireEvent.keyDown(search, { key: 'Escape', code: 'Escape' });
    expect(search.value).toBe('');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('3/3');

    fireEvent.keyDown(search, { key: 'Escape', code: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('moves the selected command with Alt plus slot number', async () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const search = screen.getByTestId('radial-customizer-command-search') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'remove' } });
    await waitFor(() => {
      expect(screen.getByTestId('radial-customizer-preview-title')).toHaveTextContent('Delete');
    });

    fireEvent.keyDown(search, { key: '3', code: 'Digit3', altKey: true });

    expect(screen.getByTestId('radial-customizer-preview-item-delete')).toHaveAttribute('data-slot', '2');
    expect(screen.getByTestId('radial-customizer-slot-delete-2')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('1 unsaved slot');
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('radial-customizer-apply'));
    expect(onMove).toHaveBeenCalledWith('delete', 2);
  });

  it('uses the gesture coach as a fast draft slot mover', () => {
    const onMove = vi.fn();
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
    });
    recordRadialTelemetry({
      name: 'mark-cancel',
      view: 'architecture',
      target: 'canvas',
      slot: 5,
      reason: 'wrong-direction',
    });

    render(
      <RadialMenuCustomizer
        items={makeCoachItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-gesture-slot-ai-3')).toHaveTextContent('AI');
    expect(screen.getByTestId('radial-customizer-gesture-slot-risk-5')).toHaveTextContent('Risk');
    expect(screen.getByTestId('radial-customizer-gesture-fastest')).toHaveTextContent('Fast N 42ms');
    expect(screen.getByTestId('radial-customizer-gesture-watch')).toHaveTextContent('Watch SW 1 miss');
    expect(screen.queryByTestId('radial-customizer-gesture-suggestion')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-gesture-slot-usage-0')).toHaveTextContent('1 mark');
    expect(screen.getByTestId('radial-customizer-gesture-slot-usage-5')).toHaveTextContent('0 marks / 1 miss');
    expect(screen.getByTestId('radial-customizer-gesture-slot-2')).toHaveAttribute('data-command-id', '');

    fireEvent.click(screen.getByTestId('radial-customizer-gesture-slot-2'));

    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
    expect(screen.getByTestId('radial-customizer-gesture-slot-2')).toHaveAttribute('data-command-id', 'add_node');
    expect(screen.getByTestId('radial-customizer-gesture-slot-label-2')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('radial-customizer-gesture-slot-label-0')).toHaveTextContent('Empty');
    expect(screen.getByTestId('radial-customizer-gesture-slot-moved-2')).toHaveTextContent('Moved');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('1 unsaved slot');
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('radial-customizer-apply'));
    expect(onMove).toHaveBeenCalledWith('add_node', 2);
  });

  it('practices the selected gesture without moving slots or running commands', () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const practicePad = screen.getByTestId('radial-customizer-practice-pad');
    expect(screen.getByTestId('radial-customizer-practice-target')).toHaveTextContent('N');
    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Aim N');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('0/0 hits / streak 0');

    fireEvent.pointerDown(practicePad, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(practicePad, { clientX: 100, clientY: 56, pointerId: 1 });
    expect(screen.getByTestId('radial-customizer-practice-vector')).toBeInTheDocument();
    fireEvent.pointerUp(practicePad, { clientX: 100, clientY: 56, pointerId: 1 });

    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Hit N');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('1/1 hits / streak 1');
    expect(screen.queryByTestId('radial-customizer-practice-vector')).not.toBeInTheDocument();

    fireEvent.pointerDown(practicePad, { clientX: 100, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(practicePad, { clientX: 100, clientY: 56, pointerId: 2 });

    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Hit N');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('2/2 hits / streak 2');

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));

    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak', '2');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-active', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-label', '2x');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-streak-source-command-id',
      'add_node',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-streak-source-label',
      'Add Node N',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-streak-source-direction',
      'N',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveTextContent(
      'Practice status: 1/3 local practice coverage. Best local streak: 2x.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-streak', '2');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-streak-active', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute(
      'data-streak-source-label',
      'Add Node N',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveAttribute('data-streak', '2');
    expect(screen.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveAttribute(
      'data-streak-source-command-id',
      'add_node',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveAttribute(
      'data-streak-source-label',
      'Add Node N',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice-streak')).toHaveTextContent('2x');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveTextContent('Practice 1/3');

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));

    const expandedPracticePad = screen.getByTestId('radial-customizer-practice-pad');
    fireEvent.pointerDown(expandedPracticePad, { clientX: 100, clientY: 100, pointerId: 3 });
    fireEvent.pointerUp(expandedPracticePad, { clientX: 144, clientY: 100, pointerId: 3 });

    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Miss E');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('2/3 hits / streak 0');
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '0');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('radial-customizer-practice-reset'));
    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Aim N');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('0/0 hits / streak 0');
  });

  it('clears local practice from the collapsed chip without moving commands', () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const practicePad = screen.getByTestId('radial-customizer-practice-pad');
    fireEvent.pointerDown(practicePad, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(practicePad, { clientX: 100, clientY: 56, pointerId: 1 });
    fireEvent.pointerDown(practicePad, { clientX: 100, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(practicePad, { clientX: 100, clientY: 56, pointerId: 2 });

    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('2/2 hits / streak 2');

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));

    const collapsedPractice = screen.getByTestId('radial-customizer-collapsed-practice');
    const collapsedIdle = screen.getByTestId('radial-customizer-collapsed-idle');
    expect(collapsedPractice).toHaveAttribute('data-reset-available', 'true');
    expect(collapsedPractice).toHaveAttribute('data-reset-hint', 'Shift+Backspace clears local practice.');
    expect(collapsedIdle).toHaveAttribute('aria-keyshortcuts', 'Enter Space Shift+Backspace');
    expect(collapsedIdle).toHaveAttribute('data-streak-active', 'true');

    fireEvent.keyDown(collapsedIdle, { key: 'Backspace', shiftKey: true });

    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-reset-available', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-reset-hint', '');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-streak-active', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveTextContent(
      'Practice status: 0/3 local practice coverage.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveTextContent('Practice 0/3');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('aria-keyshortcuts', 'Enter Space');
    expect(screen.queryByTestId('radial-customizer-collapsed-practice-streak')).not.toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '0');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('0/0 hits / streak 0');
  });

  it('jumps to the first cold command and focuses the safe practice pad', async () => {
    Array.from({ length: 3 }, () => {
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 0,
        durationMs: 36,
      });
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'edit',
        slot: 6,
        durationMs: 44,
      });
    });
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-practice-target')).toHaveTextContent('N');
    expect(screen.getByTestId('radial-customizer-practice-cold')).toHaveAttribute('data-command-id', 'delete');

    fireEvent.click(screen.getByTestId('radial-customizer-practice-cold'));

    const practicePad = screen.getByTestId('radial-customizer-practice-pad');
    await waitFor(() => {
      expect(document.activeElement).toBe(practicePad);
    });
    expect(screen.getByTestId('radial-customizer-mastery-filter-cold')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('1/3');
    expect(screen.getByTestId('radial-customizer-practice-label')).toHaveTextContent('Delete');
    expect(screen.getByTestId('radial-customizer-practice-target')).toHaveTextContent('SW');
    expect(screen.getByTestId('radial-customizer-row-delete')).toBeInTheDocument();
    expect(screen.queryByTestId('radial-customizer-row-add_node')).not.toBeInTheDocument();

    fireEvent.keyDown(practicePad, { key: '6', code: 'Digit6' });

    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Hit SW');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('1/1 hits / streak 1');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('drills cold commands in a local queue without firing real moves', async () => {
    Array.from({ length: 3 }, () => {
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 0,
        durationMs: 36,
      });
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'edit',
        slot: 6,
        durationMs: 44,
      });
    });
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeCoachItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-practice-queue'));

    const practicePad = screen.getByTestId('radial-customizer-practice-pad');
    await waitFor(() => {
      expect(document.activeElement).toBe(practicePad);
    });
    expect(screen.getByTestId('radial-customizer-practice-queue')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('radial-customizer-practice-queue')).toHaveAttribute('data-progress', '0/2');
    expect(screen.getByTestId('radial-customizer-practice-label')).toHaveTextContent('Delete');
    expect(screen.getByTestId('radial-customizer-practice-target')).toHaveTextContent('SW');
    expect(screen.getByTestId('radial-customizer-practice-queue-status')).toHaveTextContent('Queue 0/2 - Drill SW');

    fireEvent.keyDown(practicePad, { key: '6', code: 'Digit6' });

    await waitFor(() => {
      expect(screen.getByTestId('radial-customizer-practice-label')).toHaveTextContent('AI Explain');
    });
    expect(screen.getByTestId('radial-customizer-practice-target')).toHaveTextContent('SE');
    expect(screen.getByTestId('radial-customizer-practice-queue')).toHaveAttribute('data-progress', '1/2');
    expect(screen.getByTestId('radial-customizer-practice-queue-status')).toHaveTextContent('Queue 1/2 - Next SE');
    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Aim SE');

    fireEvent.keyDown(practicePad, { key: '4', code: 'Digit4' });

    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Hit SE');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('1/1 hits / streak 1');
    expect(screen.getByTestId('radial-customizer-practice-queue')).toHaveAttribute('data-progress', '2/2');
    expect(screen.getByTestId('radial-customizer-practice-queue-status')).toHaveTextContent('Queue 2/2 - Queue done');
    expect(screen.getByTestId('radial-customizer-practice-recap')).toHaveAttribute('data-hits', '2');
    expect(screen.getByTestId('radial-customizer-practice-recap')).toHaveAttribute('data-attempts', '2');
    expect(screen.getByTestId('radial-customizer-practice-recap')).toHaveAttribute('data-weak', '0');
    expect(screen.getByTestId('radial-customizer-practice-recap')).toHaveAttribute('data-next-command-id', '');
    expect(screen.getByTestId('radial-customizer-practice-recap-hits')).toHaveTextContent('2/2 hits');
    expect(screen.getByTestId('radial-customizer-practice-recap-weak')).toHaveTextContent('0 weak');
    expect(screen.getByTestId('radial-customizer-practice-recap-next')).toHaveTextContent('Replay clear');
    expect(screen.getByTestId('radial-customizer-practice-recap-replay')).toBeDisabled();
    expect(screen.getByTestId('radial-customizer-practice-milestone')).toHaveAttribute('data-clean', 'true');
    expect(screen.getByTestId('radial-customizer-practice-milestone')).toHaveAttribute('data-attempts', '2');
    expect(screen.getByTestId('radial-customizer-practice-milestone')).toHaveTextContent('Clean run');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));

    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'clean');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-priority',
      'clean replay idle',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '2/2');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress-percent', '100');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-cue', 'complete');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-quick-open-mode', 'focus');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-cleared', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-flash', 'none');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-count', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-a11y-status',
      'Practice status: clean local run, 2/2 hits.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-help',
      'Clean practice run. Every local target was hit, so replay is clear.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-action-hint',
      'Enter/Space opens practice.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveTextContent(
      'Practice status: clean local run, 2/2 hits.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-clean', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-attempts', '2');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-progress-percent', '100');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-cue', 'complete');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-replay-cleared', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-flash', 'none');
    expect(
      screen.getByTestId('radial-customizer-collapsed-clean').style.getPropertyValue('--collapsed-practice-progress'),
    ).toBe('100%');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
      'aria-describedby',
      'radial-customizer-collapsed-practice-status',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('role', 'button');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
      'aria-label',
      'Open practice lane: Clean run',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-quick-open', 'practice-pad');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('data-quick-open-mode', 'focus');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute(
      'data-action-hint',
      'Enter/Space opens practice.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-clean')).toHaveTextContent('Clean run');

    fireEvent.click(screen.getByTestId('radial-customizer-collapsed-clean'));
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('radial-customizer-practice-pad'));
    });
    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'false');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('replays weak practice items after a local miss without changing real telemetry', async () => {
    Array.from({ length: 3 }, () => {
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 0,
        durationMs: 36,
      });
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'edit',
        slot: 6,
        durationMs: 44,
      });
    });
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeCoachItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-practice-queue'));
    const practicePad = screen.getByTestId('radial-customizer-practice-pad');
    await waitFor(() => {
      expect(document.activeElement).toBe(practicePad);
    });

    fireEvent.keyDown(practicePad, { key: '5', code: 'Digit5' });

    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Miss S');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('0/1 hits / streak 0');
    expect(screen.getByTestId('radial-customizer-practice-replay')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('radial-customizer-practice-queue-status')).toHaveTextContent('Queue 0/2 - Retry SW');
    expect(screen.getByTestId('radial-customizer-practice-heat')).toHaveAttribute('data-total', '2');
    expect(screen.getByTestId('radial-customizer-practice-heat')).toHaveAttribute('data-tried', '1');
    expect(screen.getByTestId('radial-customizer-practice-heat')).toHaveAttribute('data-idle', '1');
    expect(screen.getByTestId('radial-customizer-practice-heat-summary')).toHaveTextContent('1 tried / 1 idle');
    expect(screen.getByTestId('radial-customizer-practice-heat-delete')).toHaveAttribute('data-rank', '1');
    expect(screen.getByTestId('radial-customizer-practice-heat-delete')).toHaveAttribute('data-attempts', '1');
    expect(screen.getByTestId('radial-customizer-practice-heat-delete')).toHaveAttribute('data-hits', '0');
    expect(screen.getByTestId('radial-customizer-practice-heat-delete')).toHaveAttribute('data-status', 'weak');
    expect(screen.getByTestId('radial-customizer-practice-heat-delete')).toHaveTextContent('Delete');
    expect(screen.getByTestId('radial-customizer-practice-heat-delete')).toHaveTextContent('1x');
    expect(screen.getByTestId('radial-customizer-practice-heat-ai_explain_architecture')).toHaveAttribute(
      'data-rank',
      '2',
    );
    expect(screen.getByTestId('radial-customizer-practice-heat-ai_explain_architecture')).toHaveAttribute(
      'data-status',
      'idle',
    );

    fireEvent.click(screen.getByTestId('radial-customizer-practice-heat-ai_explain_architecture'));

    await waitFor(() => {
      expect(document.activeElement).toBe(practicePad);
    });
    expect(screen.getByTestId('radial-customizer-practice-label')).toHaveTextContent('AI Explain');
    expect(screen.getByTestId('radial-customizer-practice-target')).toHaveTextContent('SE');
    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Aim SE');
    expect(screen.getByTestId('radial-customizer-practice-replay')).toHaveAttribute('data-count', '1');

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));
    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'replay');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '0/2');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress-percent', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-cue', 'replay');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-quick-open-mode',
      'replay',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-cleared', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-flash', 'none');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-count', '1');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-a11y-status',
      'Practice status: 1 replay ready for replay, 0/2 coverage.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-help',
      '1 replay queued for replay. Expand practice to retry weak gestures safely.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-action-hint',
      'Enter/Space opens replay practice.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveTextContent(
      'Practice status: 1 replay ready for replay, 0/2 coverage.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-progress-percent', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-cue', 'replay');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-replay-cleared', 'false');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-flash', 'none');
    expect(
      screen.getByTestId('radial-customizer-collapsed-replay').style.getPropertyValue('--collapsed-practice-progress'),
    ).toBe('0%');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
      'aria-describedby',
      'radial-customizer-collapsed-practice-status',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('role', 'button');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
      'aria-label',
      'Open replay practice: 1 replay',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-quick-open', 'practice-pad');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('data-quick-open-mode', 'replay');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute(
      'data-action-hint',
      'Enter/Space opens replay practice.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveAttribute('tabindex', '0');
    expect(screen.getByTestId('radial-customizer-collapsed-replay')).toHaveTextContent('1 replay');

    fireEvent.keyDown(screen.getByTestId('radial-customizer-collapsed-replay'), { key: ' ', code: 'Space' });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('radial-customizer-practice-pad'));
    });
    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'false');
    const replayPad = screen.getByTestId('radial-customizer-practice-pad');
    expect(screen.getByTestId('radial-customizer-practice-replay')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('radial-customizer-practice-label')).toHaveTextContent('Delete');
    expect(screen.getByTestId('radial-customizer-practice-target')).toHaveTextContent('SW');
    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Aim SW');
    expect(screen.getByTestId('radial-customizer-practice-queue-status')).toHaveTextContent('Queue 0/2 - Replay SW');

    fireEvent.keyDown(replayPad, { key: '6', code: 'Digit6' });

    expect(screen.getByTestId('radial-customizer-practice-status')).toHaveTextContent('Hit SW');
    expect(screen.getByTestId('radial-customizer-practice-score')).toHaveTextContent('1/2 hits / streak 1');
    expect(screen.getByTestId('radial-customizer-practice-replay')).toHaveAttribute('data-count', '0');
    expect(screen.getByTestId('radial-customizer-practice-queue-status')).toHaveTextContent('Queue 1/2 - Replay clear');
    expect(screen.queryByTestId('radial-customizer-practice-milestone')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-mastery-delete')).toHaveAttribute('data-status', 'cold');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));

    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-state', 'idle');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress', '1/2');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-progress-percent', '50');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-cue', 'practice');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-replay-cleared', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute('data-flash', 'replay-clear');
    expect(screen.getByTestId('radial-customizer-collapsed-practice-status')).toHaveTextContent(
      'Practice status: replay cleared, 1/2 local practice coverage.',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-practice')).toHaveAttribute(
      'data-help',
      'Replay cleared. Weak gestures are back under control.',
    );
    expect(screen.queryByTestId('radial-customizer-collapsed-clean')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-progress-percent', '50');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-replay-cleared', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveAttribute('data-flash', 'replay-clear');
    expect(
      screen.getByTestId('radial-customizer-collapsed-idle').style.getPropertyValue('--collapsed-practice-progress'),
    ).toBe('50%');
    expect(screen.getByTestId('radial-customizer-collapsed-idle').className).toContain('after:opacity-100');
    expect(screen.getByTestId('radial-customizer-collapsed-idle').className).toContain('before:bg-emerald-300/80');
    expect(screen.getByTestId('radial-customizer-collapsed-idle')).toHaveTextContent('Practice 1/2');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('filters command rows by current gesture mastery', () => {
    Array.from({ length: 3 }, () => {
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 0,
        durationMs: 36,
      });
    });
    Array.from({ length: 2 }, () => {
      recordRadialTelemetry({
        name: 'mark-select',
        view: 'architecture',
        target: 'canvas',
        commandId: 'edit',
        slot: 6,
        durationMs: 48,
      });
    });
    recordRadialTelemetry({
      name: 'mark-cancel',
      view: 'architecture',
      target: 'canvas',
      commandId: 'delete',
      slot: 5,
      reason: 'wrong-direction',
    });

    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-mastery-filter-count-all')).toHaveTextContent('3');
    expect(screen.getByTestId('radial-customizer-mastery-filter-count-trained')).toHaveTextContent('1');
    expect(screen.getByTestId('radial-customizer-mastery-filter-count-building')).toHaveTextContent('1');
    expect(screen.getByTestId('radial-customizer-mastery-filter-count-cold')).toHaveTextContent('1');
    expect(screen.getByTestId('radial-customizer-mastery-add_node')).toHaveAttribute('data-status', 'trained');
    expect(screen.getByTestId('radial-customizer-mastery-add_node')).toHaveTextContent('3x');
    expect(screen.getByTestId('radial-customizer-mastery-edit')).toHaveAttribute('data-status', 'building');
    expect(screen.getByTestId('radial-customizer-mastery-edit')).toHaveTextContent('2x');
    expect(screen.getByTestId('radial-customizer-mastery-delete')).toHaveAttribute('data-status', 'cold');
    expect(screen.getByTestId('radial-customizer-mastery-delete')).toHaveTextContent('Cold');

    fireEvent.click(screen.getByTestId('radial-customizer-mastery-filter-trained'));
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('1/3');
    expect(screen.getByTestId('radial-customizer-row-add_node')).toBeInTheDocument();
    expect(screen.queryByTestId('radial-customizer-row-edit')).not.toBeInTheDocument();
    expect(screen.queryByTestId('radial-customizer-row-delete')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('radial-customizer-mastery-filter-building'));
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('1/3');
    expect(screen.queryByTestId('radial-customizer-row-add_node')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-row-edit')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('radial-customizer-mastery-filter-cold'));
    expect(screen.getByTestId('radial-customizer-command-count')).toHaveTextContent('1/3');
    expect(screen.getByTestId('radial-customizer-row-delete')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));
    expect(screen.getByTestId('radial-customizer-collapsed-mastery-trained')).toHaveTextContent('1 trained');
    expect(screen.getByTestId('radial-customizer-collapsed-mastery-building')).toHaveTextContent('1 building');
    expect(screen.getByTestId('radial-customizer-collapsed-mastery-cold')).toHaveTextContent('1 cold');
  });

  it('ignores gesture misses from other radial contexts', () => {
    [0, 1, 2].forEach(() => {
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: 'pcb',
        target: 'canvas',
        commandId: 'add_node',
        slot: 5,
        reason: 'wrong-direction',
      });
    });
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
    });

    render(
      <RadialMenuCustomizer
        items={makeCoachItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-gesture-fastest')).toHaveTextContent('Fast N 42ms');
    expect(screen.queryByTestId('radial-customizer-gesture-watch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('radial-customizer-gesture-suggestion')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-gesture-slot-usage-5')).toHaveTextContent('No marks');
  });

  it('suggests a draft move after repeated gesture misses', () => {
    const onMove = vi.fn();
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
    });
    recordRadialTelemetry({
      name: 'mark-cancel',
      view: 'architecture',
      target: 'canvas',
      slot: 5,
      reason: 'wrong-direction',
    });
    recordRadialTelemetry({
      name: 'mark-cancel',
      view: 'architecture',
      target: 'canvas',
      slot: 5,
      reason: 'wrong-direction',
    });

    render(
      <RadialMenuCustomizer
        items={makeCoachItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-gesture-watch')).toHaveTextContent('Watch SW 2 misses');
    expect(screen.getByTestId('radial-customizer-gesture-suggestion')).toHaveTextContent('Try Add Node in SW');
    expect(screen.getByTestId('radial-customizer-gesture-suggestion')).toHaveAttribute('data-source', 'slot');
    expect(screen.getByTestId('radial-customizer-gesture-suggestion-impact')).toHaveTextContent('Swap Delete');
    expect(screen.getByTestId('radial-customizer-gesture-suggestion-dismiss')).toHaveAttribute(
      'aria-label',
      'Hide suggestion to move Add Node for now',
    );
    expect(screen.getByTestId('radial-customizer-gesture-suggestion-dismiss')).toHaveAttribute(
      'title',
      'Hide this Add Node suggestion for now. It can return when new gesture misses appear.',
    );
    expect(screen.getByTestId('radial-customizer-gesture-suggestion-never')).toHaveAttribute(
      'aria-label',
      'Never suggest moving Add Node to SW on this wheel',
    );
    expect(screen.getByTestId('radial-customizer-gesture-suggestion-never')).toHaveAttribute(
      'title',
      'Never suggest moving Add Node to SW on this wheel.',
    );

    fireEvent.click(screen.getByTestId('radial-customizer-gesture-suggestion'));

    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '5');
    expect(screen.getByTestId('radial-customizer-gesture-slot-5')).toHaveAttribute('data-command-id', 'add_node');
    expect(screen.getByTestId('radial-customizer-gesture-slot-label-5')).toHaveTextContent('Add Node');
    expect(screen.getByTestId('radial-customizer-gesture-slot-label-0')).toHaveTextContent('Delete');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('2 unsaved slots');
    expect(screen.queryByTestId('radial-customizer-gesture-suggestion')).not.toBeInTheDocument();
    expect(onMove).not.toHaveBeenCalled();
  });

  it('dismisses a gesture suggestion without changing the draft', () => {
    const onMove = vi.fn();
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
    });
    [0, 1].forEach(() => {
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: 'architecture',
        target: 'canvas',
        slot: 5,
        reason: 'wrong-direction',
      });
    });

    render(
      <RadialMenuCustomizer
        items={makeCoachItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-gesture-suggestion')).toHaveTextContent('Try Add Node in SW');

    fireEvent.click(screen.getByTestId('radial-customizer-gesture-suggestion-dismiss'));

    expect(screen.queryByTestId('radial-customizer-gesture-suggestion')).not.toBeInTheDocument();
    expect(screen.queryByTestId('radial-customizer-gesture-suggestion-dismiss')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-gesture-watch')).toHaveTextContent('Watch SW 2 misses');
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '0');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('persists a hidden gesture suggestion for the current wheel layout', () => {
    const onMove = vi.fn();
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
    });
    [0, 1].forEach(() => {
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: 'architecture',
        target: 'canvas',
        slot: 5,
        reason: 'wrong-direction',
      });
    });

    const props = {
      items: makeCoachItems(),
      context,
      position: { x: 400, y: 280 },
      onMove,
      onReset: vi.fn(),
      onClose: vi.fn(),
    };
    const { unmount } = render(<RadialMenuCustomizer {...props} />);

    expect(screen.getByTestId('radial-customizer-gesture-suggestion')).toHaveTextContent('Try Add Node in SW');

    fireEvent.click(screen.getByTestId('radial-customizer-gesture-suggestion-never'));

    expect(screen.queryByTestId('radial-customizer-gesture-suggestion')).not.toBeInTheDocument();
    expect(window.localStorage.getItem('protopulse-radial-preferences-v1')).toContain('add_node:5');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');
    expect(onMove).not.toHaveBeenCalled();

    unmount();
    render(<RadialMenuCustomizer {...props} />);

    expect(screen.queryByTestId('radial-customizer-gesture-suggestion')).not.toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-gesture-watch')).toHaveTextContent('Watch SW 2 misses');
  });

  it('prefers command-specific missed slots over generic rough slots', () => {
    const onMove = vi.fn();
    recordRadialTelemetry({
      name: 'mark-select',
      view: 'architecture',
      target: 'canvas',
      commandId: 'add_node',
      slot: 0,
      durationMs: 42,
    });
    [0, 1, 2].forEach(() => {
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: 'architecture',
        target: 'canvas',
        slot: 5,
        reason: 'wrong-direction',
      });
    });
    [0, 1].forEach(() => {
      recordRadialTelemetry({
        name: 'mark-cancel',
        view: 'architecture',
        target: 'canvas',
        commandId: 'add_node',
        slot: 2,
        reason: 'pointer-cancel',
      });
    });

    render(
      <RadialMenuCustomizer
        items={makeCoachItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByTestId('radial-customizer-gesture-watch')).toHaveTextContent('Watch SW 3 misses');
    expect(screen.getByTestId('radial-customizer-gesture-suggestion')).toHaveTextContent('Try Add Node in E');
    expect(screen.getByTestId('radial-customizer-gesture-suggestion')).toHaveAttribute('data-source', 'command');
    expect(screen.getByTestId('radial-customizer-gesture-suggestion-impact')).toHaveTextContent('Empty slot');

    fireEvent.click(screen.getByTestId('radial-customizer-gesture-suggestion'));

    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
    expect(screen.getByTestId('radial-customizer-gesture-slot-label-2')).toHaveTextContent('Add Node');
    expect(onMove).not.toHaveBeenCalled();
  });

  it('copies the current draft as a portable preset', async () => {
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-preset-toggle'));
    fireEvent.click(screen.getByTestId('radial-customizer-slot-add_node-2'));
    fireEvent.click(screen.getByTestId('radial-customizer-preset-copy'));

    await waitFor(() => {
      expect(clipboardWriteText).toHaveBeenCalledTimes(1);
    });

    const presetText = screen.getByTestId('radial-customizer-preset-text') as HTMLTextAreaElement;
    const preset = JSON.parse(presetText.value) as {
      version: number;
      layoutKey: string;
      slots: Record<string, number>;
    };

    expect(preset).toMatchObject({
      version: 1,
      layoutKey: 'architecture:canvas',
      slots: {
        add_node: 2,
        delete: 5,
        edit: 6,
      },
    });
    expect(clipboardWriteText).toHaveBeenCalledWith(presetText.value);
    await waitFor(() => {
      expect(screen.getByTestId('radial-customizer-preset-status')).toHaveTextContent('Preset copied');
    });
  });

  it('imports a preset into the draft before applying it', () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-preset-toggle'));
    fireEvent.change(screen.getByTestId('radial-customizer-preset-text'), {
      target: {
        value: JSON.stringify({
          version: 1,
          layoutKey: 'architecture:canvas',
          exportedAt: '2026-06-03T12:00:00.000Z',
          slots: {
            add_node: 2,
            delete: 5,
            edit: 6,
          },
        }),
      },
    });
    fireEvent.click(screen.getByTestId('radial-customizer-preset-import'));

    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('1 unsaved slot');
    expect(screen.getByTestId('radial-customizer-preset-status')).toHaveTextContent('Preset loaded');

    fireEvent.click(screen.getByTestId('radial-customizer-apply'));
    expect(onMove).toHaveBeenCalledWith('add_node', 2);
  });

  it('saves and loads named presets from the shelf before applying them', async () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-preset-toggle'));
    fireEvent.change(screen.getByTestId('radial-customizer-preset-name'), {
      target: { value: 'Fast build' },
    });
    fireEvent.click(screen.getByTestId('radial-customizer-slot-add_node-2'));
    fireEvent.click(screen.getByTestId('radial-customizer-preset-save'));

    expect(await screen.findByText('Fast build')).toBeInTheDocument();
    expect(screen.getByTestId('radial-customizer-preset-status')).toHaveTextContent('Fast build saved');

    fireEvent.click(screen.getByTestId('radial-customizer-revert'));
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '0');

    fireEvent.click(screen.getByText('Fast build'));
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('1 unsaved slot');

    fireEvent.click(screen.getByTestId('radial-customizer-apply'));
    expect(onMove).toHaveBeenCalledWith('add_node', 2);
  }, 10_000);

  it('pins and unpins a named preset for the current context without moving commands', async () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-preset-toggle'));
    fireEvent.change(screen.getByTestId('radial-customizer-preset-name'), {
      target: { value: 'Fast build' },
    });
    fireEvent.click(screen.getByTestId('radial-customizer-slot-add_node-2'));
    fireEvent.click(screen.getByTestId('radial-customizer-preset-save'));

    const pinButton = await screen.findByLabelText('Pin Fast build to this context');
    expect(screen.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute('data-pinned', 'false');
    expect(screen.getByTestId('radial-customizer-preset-recommendation')).toHaveAttribute(
      'data-preset-id',
      pinButton.getAttribute('data-testid')?.replace('radial-customizer-preset-pin-', '') ?? '',
    );
    expect(screen.getByTestId('radial-customizer-preset-recommendation')).toHaveTextContent(
      'Suggested: Fast build for Architecture / Canvas.',
    );

    fireEvent.click(screen.getByTestId('radial-customizer-preset-recommendation'));

    const layoutKey = getRadialPreferenceKey(context);
    const pinnedPresetId = getRadialPinnedPresetId(radialPreferencesStore.getSnapshot(), layoutKey);
    expect(pinnedPresetId).toBeTruthy();
    expect(screen.getByTestId('radial-customizer-preset-status')).toHaveTextContent(
      'Fast build pinned to this context',
    );
    expect(screen.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute('data-pinned', 'true');
    expect(screen.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute(
      'data-preset-id',
      pinnedPresetId ?? '',
    );
    expect(screen.getByTestId('radial-customizer-pinned-preset')).toHaveTextContent(
      'Fast build pinned to Architecture / Canvas.',
    );
    expect(screen.queryByTestId('radial-customizer-preset-recommendation')).not.toBeInTheDocument();
    expect(applyRadialPreferences(makeItems(), layoutKey).find((item) => item.id === 'add_node')).toMatchObject({
      slot: 2,
      hint: 'E',
    });
    expect(onMove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('radial-customizer-collapse'));
    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByTestId('radial-customizer-collapsed-pinned-preset')).toHaveAttribute(
      'data-preset-id',
      pinnedPresetId ?? '',
    );
    expect(screen.getByTestId('radial-customizer-collapsed-pinned-preset')).toHaveTextContent('Fast build');
    expect(screen.getByTestId('radial-customizer-collapsed-pinned-preset')).toHaveAttribute(
      'aria-label',
      'Open pinned preset: Fast build',
    );

    fireEvent.keyDown(screen.getByTestId('radial-customizer-collapsed-pinned-preset'), { key: 'Enter' });
    expect(screen.getByTestId('radial-customizer')).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByTestId('radial-customizer-preset-panel')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Unpin Fast build from this context'));

    expect(getRadialPinnedPresetId(radialPreferencesStore.getSnapshot(), layoutKey)).toBeNull();
    expect(screen.getByTestId('radial-customizer-preset-status')).toHaveTextContent('Fast build unpinned');
    expect(screen.getByTestId('radial-customizer-pinned-preset')).toHaveAttribute('data-pinned', 'false');
    expect(screen.getByLabelText('Pin Fast build to this context')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('radial-customizer-preset-recommendation')).toHaveTextContent(
      'Suggested: Fast build for Architecture / Canvas.',
    );
    expect(onMove).not.toHaveBeenCalled();
  }, 10_000);

  it('deletes named presets from the shelf', async () => {
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-preset-toggle'));
    fireEvent.change(screen.getByTestId('radial-customizer-preset-name'), {
      target: { value: 'Fast build' },
    });
    fireEvent.click(screen.getByTestId('radial-customizer-preset-save'));

    expect(await screen.findByText('Fast build')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Delete Fast build'));

    await waitFor(() => {
      expect(screen.queryByText('Fast build')).not.toBeInTheDocument();
    });
    expect(screen.getByTestId('radial-customizer-preset-status')).toHaveTextContent('Fast build deleted');
  });

  it('keeps the draft unchanged when preset import fails', () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-preset-toggle'));
    fireEvent.change(screen.getByTestId('radial-customizer-preset-text'), {
      target: { value: '{nope' },
    });
    fireEvent.click(screen.getByTestId('radial-customizer-preset-import'));

    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '0');
    expect(screen.getByTestId('radial-customizer-preset-status')).toHaveTextContent('Preset is not valid JSON.');
  });

  it('previews slot moves before applying them', () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-slot-add_node-5'));
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('radial-customizer-slot-add_node-5')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '5');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('2 unsaved slots');

    fireEvent.click(screen.getByTestId('radial-customizer-apply'));
    expect(onMove).toHaveBeenCalledWith('add_node', 5);
    expect(onMove).toHaveBeenCalledWith('delete', 0);
  });

  it('reverts draft moves without calling onMove', () => {
    const onMove = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={onMove}
        onReset={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-slot-add_node-2'));
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '2');
    fireEvent.click(screen.getByTestId('radial-customizer-revert'));

    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByTestId('radial-customizer-slot-add_node-0')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('radial-customizer-preview-item-add_node')).toHaveAttribute('data-slot', '0');
    expect(screen.getByTestId('radial-customizer-draft-status')).toHaveTextContent('Layout saved');
  });

  it('calls reset and close handlers', () => {
    const onReset = vi.fn();
    const onClose = vi.fn();
    render(
      <RadialMenuCustomizer
        items={makeItems()}
        context={context}
        position={{ x: 400, y: 280 }}
        onMove={vi.fn()}
        onReset={onReset}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByTestId('radial-customizer-reset'));
    fireEvent.click(screen.getByTestId('radial-customizer-close'));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
