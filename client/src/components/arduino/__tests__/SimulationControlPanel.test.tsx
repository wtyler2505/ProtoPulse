import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SimulationControlPanel from '../SimulationControlPanel';

// ---------------------------------------------------------------------------
// Mock fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Mock EventSource
// ---------------------------------------------------------------------------

type EventSourceListener = (event: MessageEvent | Event) => void;

class MockEventSource {
  url: string;
  listeners = new Map<string, EventSourceListener[]>();

  constructor(url: string) {
    this.url = url;
    MockEventSource.lastInstance = this;
  }

  addEventListener(type: string, listener: EventSourceListener) {
    const existing = this.listeners.get(type) ?? [];
    existing.push(listener);
    this.listeners.set(type, existing);
  }

  close = vi.fn();

  emit(type: string, data?: string) {
    const handlers = this.listeners.get(type) ?? [];
    for (const handler of handlers) {
      if (type === 'error' && data) {
        handler({ data } as unknown as Event);
      } else if (data !== undefined) {
        handler(new MessageEvent(type, { data }));
      } else {
        handler(new Event(type));
      }
    }
  }

  static lastInstance: MockEventSource | null = null;
}

vi.stubGlobal('EventSource', MockEventSource);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPanel(props: Partial<React.ComponentProps<typeof SimulationControlPanel>> = {}) {
  return render(
    <SimulationControlPanel
      projectId={1}
      {...props}
    />,
  );
}

function mockStartResponse(sessionId = 'sim-session-123') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ sessionId }),
  });
}

function mockStopResponse() {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
}

function mockResetResponse() {
  mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({}) });
}

function mockStartError(status = 500, error = 'Simulation engine not found') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: 'Internal Server Error',
    json: () => Promise.resolve({ error }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SimulationControlPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockReset();
    MockEventSource.lastInstance = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Rendering ──────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the panel container', () => {
      renderPanel();
      expect(screen.getByTestId('simulation-control-panel')).toBeInTheDocument();
    });

    it('renders start, stop, and reset buttons', () => {
      renderPanel();
      expect(screen.getByTestId('button-sim-start')).toBeInTheDocument();
      expect(screen.getByTestId('button-sim-stop')).toBeInTheDocument();
      expect(screen.getByTestId('button-sim-reset')).toBeInTheDocument();
    });

    it('renders status badge with idle state initially', () => {
      renderPanel();
      const badge = screen.getByTestId('sim-status-badge');
      expect(badge).toHaveTextContent('Idle');
    });

    it('renders MCU info section', () => {
      renderPanel();
      const mcuInfo = screen.getByTestId('sim-mcu-info');
      expect(mcuInfo).toHaveTextContent('ATmega328P @ 16 MHz');
    });

    it('renders metrics section with initial values', () => {
      renderPanel();
      expect(screen.getByTestId('sim-cycle-count')).toHaveTextContent('0');
      expect(screen.getByTestId('sim-uptime')).toHaveTextContent('00:00');
    });

    it('renders serial output section', () => {
      renderPanel();
      expect(screen.getByTestId('sim-serial-output')).toBeInTheDocument();
    });

    it('renders pin monitor with digital and analog pins', () => {
      renderPanel();
      const digitalPins = screen.getByTestId('sim-digital-pins');
      const analogPins = screen.getByTestId('sim-analog-pins');
      expect(digitalPins).toBeInTheDocument();
      expect(analogPins).toBeInTheDocument();
    });

    it('renders all 14 digital pin indicators', () => {
      renderPanel();
      for (let i = 0; i < 14; i++) {
        expect(screen.getByTestId(`sim-pin-D${i}`)).toBeInTheDocument();
      }
    });

    it('renders all 6 analog pin indicators', () => {
      renderPanel();
      for (let i = 0; i < 6; i++) {
        expect(screen.getByTestId(`sim-pin-A${i}`)).toBeInTheDocument();
      }
    });

    it('displays firmware path when provided', () => {
      renderPanel({ firmwarePath: '/projects/1/build/sketch.hex' });
      expect(screen.getByTestId('sim-mcu-info')).toHaveTextContent('sketch.hex');
    });

    it('does not show error panel when idle', () => {
      renderPanel();
      expect(screen.queryByTestId('sim-error-panel')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      renderPanel({ className: 'my-custom-class' });
      const panel = screen.getByTestId('simulation-control-panel');
      expect(panel.className).toContain('my-custom-class');
    });
  });

  // ── Button states ──────────────────────────────────────────────────────

  describe('button states', () => {
    it('start button is enabled when idle', () => {
      renderPanel();
      expect(screen.getByTestId('button-sim-start')).not.toBeDisabled();
    });

    it('stop button is disabled when idle', () => {
      renderPanel();
      expect(screen.getByTestId('button-sim-stop')).toBeDisabled();
    });

    it('reset button is disabled when idle', () => {
      renderPanel();
      expect(screen.getByTestId('button-sim-reset')).toBeDisabled();
    });

    it('start button is disabled while running', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('button-sim-start')).toBeDisabled();
    });

    it('stop button is enabled while running', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('button-sim-stop')).not.toBeDisabled();
    });

    it('reset button is enabled while running', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('button-sim-reset')).not.toBeDisabled();
    });
  });

  // ── Start simulation ──────────────────────────────────────────────────

  describe('start simulation', () => {
    it('sends POST to start endpoint', async () => {
      renderPanel({ firmwarePath: '/build/sketch.hex' });
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1/firmware/simulate',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firmwarePath: '/build/sketch.hex' }),
        }),
      );
    });

    it('updates status to running on success', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Running');
    });

    it('opens an EventSource for events', async () => {
      renderPanel();
      mockStartResponse('my-session');

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(MockEventSource.lastInstance).not.toBeNull();
      expect(MockEventSource.lastInstance?.url).toBe(
        '/api/projects/1/firmware/simulate/my-session/events',
      );
    });

    it('shows error status when start fails', async () => {
      renderPanel();
      mockStartError(500, 'No firmware binary found');

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Error');
      expect(screen.getByTestId('sim-error-panel')).toBeInTheDocument();
      expect(screen.getByTestId('sim-error-message')).toHaveTextContent('No firmware binary found');
    });

    it('shows Try Again button in error state', async () => {
      renderPanel();
      mockStartError();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('button-sim-try-again')).toBeInTheDocument();
    });

    it('Try Again button retries starting simulation', async () => {
      renderPanel();
      mockStartError();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-try-again'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Running');
    });

    it('clears previous events on new start', async () => {
      renderPanel();
      mockStartResponse();

      // First start
      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      // Emit a uart event
      act(() => {
        MockEventSource.lastInstance?.emit('uart', 'Hello World');
      });

      expect(screen.getByTestId('sim-serial-line-0')).toHaveTextContent('Hello World');

      // Stop and restart
      mockStopResponse();
      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-stop'));
      });

      mockStartResponse();
      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.queryByTestId('sim-serial-line-0')).not.toBeInTheDocument();
    });
  });

  // ── Stop simulation ───────────────────────────────────────────────────

  describe('stop simulation', () => {
    it('sends POST to stop endpoint', async () => {
      renderPanel();
      mockStartResponse('session-abc');

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      mockStopResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-stop'));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1/firmware/simulate/session-abc/stop',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('updates status to idle after stop', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      mockStopResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-stop'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Idle');
    });

    it('closes the EventSource on stop', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      const es = MockEventSource.lastInstance;
      mockStopResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-stop'));
      });

      expect(es?.close).toHaveBeenCalled();
    });
  });

  // ── Reset simulation ──────────────────────────────────────────────────

  describe('reset simulation', () => {
    it('sends POST to reset endpoint', async () => {
      renderPanel();
      mockStartResponse('session-xyz');

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      mockResetResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-reset'));
      });

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/1/firmware/simulate/session-xyz/reset',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('clears all state after reset', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      // Emit some events
      act(() => {
        MockEventSource.lastInstance?.emit('uart', 'test output');
        MockEventSource.lastInstance?.emit('cycle', '5000');
      });

      mockResetResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-reset'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Idle');
      expect(screen.getByTestId('sim-cycle-count')).toHaveTextContent('0');
      expect(screen.getByTestId('sim-uptime')).toHaveTextContent('00:00');
      expect(screen.queryByTestId('sim-serial-line-0')).not.toBeInTheDocument();
    });
  });

  // ── SSE events ────────────────────────────────────────────────────────

  describe('SSE events', () => {
    it('displays uart events in serial output', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('uart', 'Hello from Arduino');
      });

      expect(screen.getByTestId('sim-serial-line-0')).toHaveTextContent('Hello from Arduino');
    });

    it('accumulates multiple uart events', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('uart', 'Line 1');
        MockEventSource.lastInstance?.emit('uart', 'Line 2');
        MockEventSource.lastInstance?.emit('uart', 'Line 3');
      });

      expect(screen.getByTestId('sim-serial-line-0')).toHaveTextContent('Line 1');
      expect(screen.getByTestId('sim-serial-line-1')).toHaveTextContent('Line 2');
      expect(screen.getByTestId('sim-serial-line-2')).toHaveTextContent('Line 3');
    });

    it('updates cycle count from cycle events', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('cycle', '42000');
      });

      expect(screen.getByTestId('sim-cycle-count')).toHaveTextContent('42.0K');
    });

    it('updates pin state from pin events', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('pin', JSON.stringify({ pin: 'D13', value: 'HIGH' }));
      });

      const pinDot = screen.getByTestId('sim-pin-dot-D13');
      expect(pinDot.className).toContain('bg-emerald-500');
    });

    it('handles error events from SSE', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('error', 'Segfault in firmware');
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Error');
      expect(screen.getByTestId('sim-error-message')).toHaveTextContent('Segfault in firmware');
    });

    it('handles stopped event from SSE', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      const es = MockEventSource.lastInstance;

      act(() => {
        es?.emit('stopped');
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Idle');
      expect(es?.close).toHaveBeenCalled();
    });

    it('ignores malformed pin events', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      // Should not throw
      act(() => {
        MockEventSource.lastInstance?.emit('pin', 'not-json');
      });

      // All pins should still be LOW
      const pinDot = screen.getByTestId('sim-pin-dot-D0');
      expect(pinDot.className).toContain('bg-zinc-700');
    });
  });

  // ── Metrics formatting ────────────────────────────────────────────────

  describe('metrics formatting', () => {
    it('formats cycle count in millions', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('cycle', '2500000');
      });

      expect(screen.getByTestId('sim-cycle-count')).toHaveTextContent('2.50M');
    });

    it('formats cycle count in thousands', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('cycle', '1500');
      });

      expect(screen.getByTestId('sim-cycle-count')).toHaveTextContent('1.5K');
    });

    it('formats small cycle counts as plain numbers', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('cycle', '42');
      });

      expect(screen.getByTestId('sim-cycle-count')).toHaveTextContent('42');
    });
  });

  // ── Serial output display ─────────────────────────────────────────────

  describe('serial output display', () => {
    it('shows placeholder when idle', () => {
      renderPanel();
      expect(screen.getByTestId('sim-serial-output')).toHaveTextContent('No serial output yet');
    });

    it('shows waiting message while running with no output', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('sim-serial-output')).toHaveTextContent('Waiting for serial data');
    });

    it('shows event count badge', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('uart', 'a');
        MockEventSource.lastInstance?.emit('uart', 'b');
      });

      // Badge shows count of serial events
      const output = screen.getByTestId('sim-serial-output');
      expect(output).toHaveTextContent('2');
    });
  });

  // ── Pin monitor display ───────────────────────────────────────────────

  describe('pin monitor display', () => {
    it('all pins default to LOW (gray)', () => {
      renderPanel();
      const d13Dot = screen.getByTestId('sim-pin-dot-D13');
      expect(d13Dot.className).toContain('bg-zinc-700');
    });

    it('pin turns green when set to HIGH', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('pin', JSON.stringify({ pin: 'A0', value: 'HIGH' }));
      });

      const pinDot = screen.getByTestId('sim-pin-dot-A0');
      expect(pinDot.className).toContain('bg-emerald-500');
    });

    it('pin returns to gray when set back to LOW', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      act(() => {
        MockEventSource.lastInstance?.emit('pin', JSON.stringify({ pin: 'D5', value: 'HIGH' }));
      });
      expect(screen.getByTestId('sim-pin-dot-D5').className).toContain('bg-emerald-500');

      act(() => {
        MockEventSource.lastInstance?.emit('pin', JSON.stringify({ pin: 'D5', value: 'LOW' }));
      });
      expect(screen.getByTestId('sim-pin-dot-D5').className).toContain('bg-zinc-700');
    });
  });

  // ── Error handling edge cases ─────────────────────────────────────────

  describe('error handling edge cases', () => {
    it('handles network error on start', async () => {
      renderPanel();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Error');
      expect(screen.getByTestId('sim-error-message')).toHaveTextContent('Network error');
    });

    it('handles non-JSON error response', async () => {
      renderPanel();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('not json')),
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      expect(screen.getByTestId('sim-error-message')).toHaveTextContent('Simulation failed (502)');
    });

    it('handles stop failure gracefully', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      mockFetch.mockRejectedValueOnce(new Error('stop failed'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-stop'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Error');
    });

    it('handles reset failure gracefully', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      mockFetch.mockRejectedValueOnce(new Error('reset failed'));

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-reset'));
      });

      expect(screen.getByTestId('sim-status-badge')).toHaveTextContent('Error');
    });

    it('does not start again if already running', async () => {
      renderPanel();
      mockStartResponse();

      await act(async () => {
        fireEvent.click(screen.getByTestId('button-sim-start'));
      });

      // Button is disabled so click shouldn't trigger fetch again
      const callCount = mockFetch.mock.calls.length;
      fireEvent.click(screen.getByTestId('button-sim-start'));
      expect(mockFetch.mock.calls.length).toBe(callCount);
    });
  });
});
