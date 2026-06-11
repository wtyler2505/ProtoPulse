import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SurfaceStatusDock } from '@/components/ui/SurfaceStatusDock';

describe('SurfaceStatusDock', () => {
  it('renders provenance, body content, and container guardrail attributes', () => {
    render(
      <SurfaceStatusDock
        ariaLabel="Schematic surface status"
        title="Main Circuit"
        origin="Local schematic model"
        trustKind="estimated"
        trustLabel="LOCAL_MODEL"
        collapsed={false}
        onToggle={vi.fn()}
        bodyTestId="schematic-surface-detail"
        testId="schematic-surface-status"
        titleTestId="schematic-surface-circuit-name"
        originTestId="schematic-surface-origin"
      >
        <p data-testid="schematic-surface-trust-summary">No active AI exact-part run is attached.</p>
      </SurfaceStatusDock>,
    );

    const dock = screen.getByTestId('schematic-surface-status');
    expect(dock.getAttribute('data-resizable')).toBe('true');
    expect(dock.getAttribute('data-resize-axis')).toBe('horizontal');
    expect(dock.getAttribute('data-collapsed')).toBe('false');
    expect(screen.getByText('LOCAL_MODEL')).toBeInTheDocument();
    expect(screen.getByTestId('schematic-surface-circuit-name')).toHaveTextContent('Main Circuit');
    expect(screen.getByTestId('schematic-surface-origin')).toHaveTextContent('Local schematic model');
    expect(screen.getByTestId('schematic-surface-detail')).toHaveTextContent('No active AI exact-part run');
  });

  it('hides body content when collapsed and exposes an expand control', () => {
    const onToggle = vi.fn();

    render(
      <SurfaceStatusDock
        ariaLabel="PCB surface status"
        title="PCB fabrication surface"
        origin="Local footprint geometry"
        trustKind="verified"
        trustLabel="PCB_LOCAL"
        collapsed
        onToggle={onToggle}
        bodyTestId="pcb-surface-detail"
        testId="pcb-surface-status"
        toggleTestId="button-toggle-pcb-surface-status"
      >
        <p>Hidden details</p>
      </SurfaceStatusDock>,
    );

    expect(screen.getByTestId('pcb-surface-status').getAttribute('data-collapsed')).toBe('true');
    expect(screen.queryByTestId('pcb-surface-detail')).not.toBeInTheDocument();

    const button = screen.getByTestId('button-toggle-pcb-surface-status');
    expect(button.getAttribute('aria-expanded')).toBe('false');

    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
