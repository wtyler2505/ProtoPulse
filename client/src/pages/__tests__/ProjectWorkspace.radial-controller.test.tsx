import { useRef } from 'react';
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadialMenuController } from '@/pages/ProjectWorkspace';
import {
  RADIAL_COMMAND_EVENT,
  type RadialCommandEventDetail,
} from '@/lib/radial-menu-actions';
import { radialPreferencesStore } from '@/lib/radial-menu-preferences';
import { clearRadialTelemetry, readRadialTelemetry } from '@/lib/radial-menu-telemetry';
import type { ViewMode } from '@/lib/project-context';

vi.mock('@/lib/project-context', () => ({
  ProjectProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useArchitecture: vi.fn(),
  useBom: vi.fn(),
  useProjectId: vi.fn(() => 'project-1'),
  useProjectMeta: vi.fn(),
  useValidation: vi.fn(() => ({ runValidation: vi.fn() })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(() => ({ dismiss: vi.fn() })),
  }),
}));

function Harness({ activeView = 'architecture' as ViewMode }: { activeView?: ViewMode }) {
  const mainRef = useRef<HTMLElement | null>(null);

  return (
    <main ref={mainRef} data-testid="workspace-main">
      <button
        type="button"
        data-testid="architecture-node-target"
        data-id="node-1"
        data-node-label="Power Module"
      >
        Power Module
      </button>
      <RadialMenuController mainRef={mainRef} activeView={activeView} />
    </main>
  );
}

function listenForRadialCommands() {
  const listener = vi.fn((event: Event) => {
    const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
    detail.handled = true;
  });
  window.addEventListener(RADIAL_COMMAND_EVENT, listener);
  return {
    listener,
    cleanup: () => window.removeEventListener(RADIAL_COMMAND_EVENT, listener),
  };
}

async function openNodeRadialMenu() {
  fireEvent.contextMenu(screen.getByTestId('architecture-node-target'), {
    clientX: 320,
    clientY: 240,
  });

  await waitFor(() => {
    expect(screen.getByTestId('radial-item-ai_explain_architecture')).toBeInTheDocument();
  });
}

describe('ProjectWorkspace RadialMenuController', () => {
  beforeEach(() => {
    clearRadialTelemetry();
    radialPreferencesStore.resetAll();
  });

  afterEach(() => {
    clearRadialTelemetry();
    radialPreferencesStore.resetAll();
    vi.restoreAllMocks();
  });

  it('dispatches rendered radial AI clicks as draft-first commands', async () => {
    const radialCommands = listenForRadialCommands();

    render(<Harness />);
    await openNodeRadialMenu();

    fireEvent.click(screen.getByTestId('radial-item-ai_explain_architecture'));

    expect(radialCommands.listener).toHaveBeenCalledTimes(1);
    const detail = (radialCommands.listener.mock.calls[0]?.[0] as CustomEvent<RadialCommandEventDetail>).detail;
    expect(detail).toMatchObject({
      commandId: 'ai_explain_architecture',
      context: {
        view: 'architecture',
        target: 'node',
        targetId: 'node-1',
        targetLabel: 'Power Module',
      },
      source: 'radial-menu',
      activation: { input: 'mouse' },
    });
    expect(detail.activation?.sendNow).toBeUndefined();

    radialCommands.cleanup();
  });

  it('dispatches rendered radial AI Shift-clicks as send-now commands', async () => {
    const radialCommands = listenForRadialCommands();

    render(<Harness />);
    await openNodeRadialMenu();

    fireEvent.click(screen.getByTestId('radial-item-ai_explain_architecture'), { shiftKey: true });

    expect(radialCommands.listener).toHaveBeenCalledTimes(1);
    const detail = (radialCommands.listener.mock.calls[0]?.[0] as CustomEvent<RadialCommandEventDetail>).detail;
    expect(detail).toMatchObject({
      commandId: 'ai_explain_architecture',
      context: {
        view: 'architecture',
        target: 'node',
        targetId: 'node-1',
        targetLabel: 'Power Module',
      },
      source: 'radial-menu',
      activation: {
        input: 'mouse',
        sendNow: true,
        modifier: 'shift',
      },
    });

    radialCommands.cleanup();
  });

  it('records command-aware telemetry when a marking gesture is cancelled after threshold', async () => {
    render(<Harness />);
    const target = screen.getByTestId('architecture-node-target');

    fireEvent.pointerDown(target, {
      button: 2,
      buttons: 2,
      clientX: 320,
      clientY: 240,
    });
    fireEvent.pointerMove(window, {
      buttons: 2,
      clientX: 390,
      clientY: 310,
    });
    fireEvent.pointerCancel(window);

    await waitFor(() => {
      expect(readRadialTelemetry()).toContainEqual(
        expect.objectContaining({
          name: 'mark-cancel',
          commandId: 'ai_explain_architecture',
          slot: 3,
          reason: 'pointer-cancel',
        }),
      );
    });
    expect(readRadialTelemetry()).toContainEqual(
      expect.objectContaining({
        name: 'mark-threshold',
        commandId: 'ai_explain_architecture',
        slot: 3,
      }),
    );
  });
});
