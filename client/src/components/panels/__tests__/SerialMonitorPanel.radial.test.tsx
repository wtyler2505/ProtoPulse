import { act, render, screen } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestQueryClient } from '@/test-utils/createTestQueryClient';
import SerialMonitorPanel from '@/components/panels/SerialMonitorPanel';
import { SerialLogger } from '@/lib/arduino/serial-logger';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';
import type { SerialMonitorLine } from '@/lib/web-serial';

const mocks = vi.hoisted(() => ({
  toast: vi.fn(),
  clearMonitor: vi.fn(),
  requestPort: vi.fn(async () => true),
  connect: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
  send: vi.fn(async () => true),
  setSignals: vi.fn(async () => undefined),
  resetBoard: vi.fn(async () => undefined),
  setBaudRate: vi.fn(),
  setLineEnding: vi.fn(),
  serialState: {
    connectionState: 'connected',
    monitor: [] as SerialMonitorLine[],
    bytesReceived: 0,
    bytesSent: 0,
    baudRate: 115200,
    lineEnding: 'lf',
    dtr: true,
    rts: false,
    portInfo: null,
    error: null,
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/contexts/arduino-context', () => ({
  useArduino: () => ({
    profiles: [{ id: 'uno', name: 'Arduino Uno', isDefault: true }],
  }),
}));

vi.mock('@/lib/web-serial', () => ({
  COMMON_BAUD_RATES: [9600, 115200],
  KNOWN_BOARD_FILTERS: [{ label: 'Arduino Uno', usbVendorId: 0x2341 }],
  useWebSerial: () => ({
    state: mocks.serialState,
    requestPort: mocks.requestPort,
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    send: mocks.send,
    setSignals: mocks.setSignals,
    resetBoard: mocks.resetBoard,
    setBaudRate: mocks.setBaudRate,
    setLineEnding: mocks.setLineEnding,
    clearMonitor: mocks.clearMonitor,
    isSupported: true,
  }),
}));

vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectContent: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  SelectItem: ({ children }: React.PropsWithChildren<{ value: string }>) => <div>{children}</div>,
  SelectTrigger: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button type="button" {...props}>{children}</button>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock('@/components/ui/TrustReceiptCard', () => ({
  default: (props: Record<string, unknown>) => (
    <div data-testid={String(props['data-testid'] ?? 'trust-receipt-serial')} />
  ),
}));

vi.mock('@/components/arduino/DeviceCommandSandbox', () => ({
  default: () => <div data-testid="device-command-sandbox" />,
}));

vi.mock('@/lib/trust-receipts', () => ({
  buildSerialTrustReceipt: () => ({ title: 'Serial trust receipt' }),
}));

vi.mock('@/lib/arduino/serial-device-preflight', () => ({
  assessSerialDevicePreflight: () => ({ status: 'ready' }),
}));

vi.mock('@/lib/arduino/telemetry-parser', () => ({
  TelemetryStore: {
    getInstance: () => ({ ingest: vi.fn() }),
  },
  parseLine: () => null,
}));

vi.mock('@/lib/digital-twin/device-shadow', () => ({
  DeviceShadow: {
    getInstance: () => ({ processFrame: vi.fn() }),
  },
}));

vi.mock('@/lib/arduino/esp-exception-decoder', () => ({
  detectEspException: () => false,
  parseEspException: () => ({ detected: false, frames: [] }),
}));

vi.mock('@/lib/arduino/baud-detector', () => ({
  detectBaudMismatch: () => ({ detected: false }),
  nonPrintableRatio: () => 0,
}));

vi.mock('@/lib/arduino/hardware-co-debug', () => ({
  buildHardwareCoDebugReadiness: () => ({
    canRun: false,
    title: 'Hardware co-debug',
    blockedReason: 'No serial logs yet',
    code: '',
    serialLogs: '',
  }),
}));

function renderPanel() {
  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <SerialMonitorPanel code="void setup() {}" projectId={1} />
    </QueryClientProvider>,
  );
}

function dispatchSerialRadialCommand(
  commandId: string,
  targetId = 'serial:1000:0',
): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'serial',
      target: 'log_line',
      targetId,
      targetLabel: 'ready',
    },
    source: 'radial-menu',
  };
  act(() => {
    window.dispatchEvent(new CustomEvent(RADIAL_COMMAND_EVENT, { detail }));
  });
  return detail;
}

describe('SerialMonitorPanel radial adapter', () => {
  beforeEach(() => {
    mocks.toast.mockClear();
    mocks.clearMonitor.mockClear();
    mocks.requestPort.mockClear();
    mocks.connect.mockClear();
    mocks.disconnect.mockClear();
    mocks.serialState.connectionState = 'connected';
    mocks.serialState.monitor = [{
      timestamp: 1000,
      direction: 'rx',
      data: 'ready',
    }];
    mocks.serialState.bytesReceived = 5;
    SerialLogger.getInstance().reset();
  });

  it('exposes serial log metadata for radial targeting', () => {
    renderPanel();

    const line = document.querySelector('[data-log-line-id="serial:1000:0"]');
    expect(line).not.toBeNull();
    expect(line).toHaveAttribute('data-log-line-label', 'ready');
    expect(screen.getByTestId('serial-monitor-output')).toBeInTheDocument();
  });

  it('clears visible serial output from a radial command', () => {
    renderPanel();

    const detail = dispatchSerialRadialCommand('clear_serial');

    expect(detail.handled).toBe(true);
    expect(mocks.clearMonitor).toHaveBeenCalledTimes(1);
  });

  it('adds a recording marker from a radial command', () => {
    renderPanel();

    const detail = dispatchSerialRadialCommand('mark_event');

    expect(detail.handled).toBe(true);
    expect(SerialLogger.getInstance().hasData()).toBe(true);
    expect(SerialLogger.getInstance().getRecordedData()).toContain('RADIAL MARK');
  });

  it('drafts recent serial output to AI chat from a radial decode command', () => {
    const chatOpenListener = vi.fn();
    const chatDraftListener = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', chatOpenListener);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);

    try {
      renderPanel();

      const detail = dispatchSerialRadialCommand('ai_serial_decode');

      expect(detail.handled).toBe(true);
      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      const openEvent = chatOpenListener.mock.calls[0]?.[0] as CustomEvent<{ designAgent?: boolean }>;
      expect(openEvent.detail.designAgent).toBe(false);
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: serial_decode.');
      expect(message).toContain('Serial decode: 1 visible line(s)');
      expect(message).toContain('Target: log_line "ready"');
      expect(message).toContain('Selected log line: ready');
      expect(message).toContain('Recent serial output:');
      expect(message).toContain('RX: ready');
      expect(message).toContain('Serial settings:');
      expect(message).toContain('Baud: 115200');
      expect(message).toContain('Sketch context:');
      expect(message).toContain('void setup() {}');
    } finally {
      window.removeEventListener('protopulse:open-chat-panel', chatOpenListener);
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    }
  });
});
