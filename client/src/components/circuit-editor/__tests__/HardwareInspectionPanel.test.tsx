import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HardwareInspectionPanel from '../HardwareInspectionPanel';

const mockRunVisualHardwareInspection = vi.fn();
const mockRunEmbodiedLayoutAnalysis = vi.fn();
const mockSaveV3InspectionReport = vi.fn();

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
vi.mock('remark-gfm', () => ({ default: vi.fn() }));
vi.mock('rehype-sanitize', () => ({ default: vi.fn() }));

vi.mock('@/lib/hardware-inspection-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/hardware-inspection-api')>('@/lib/hardware-inspection-api');
  return {
    ...actual,
    runVisualHardwareInspection: (...args: unknown[]) => mockRunVisualHardwareInspection(...args),
    runEmbodiedLayoutAnalysis: (...args: unknown[]) => mockRunEmbodiedLayoutAnalysis(...args),
  };
});

vi.mock('@/lib/v3-architecture-api', async () => {
  const actual = await vi.importActual<typeof import('@/lib/v3-architecture-api')>('@/lib/v3-architecture-api');
  return {
    ...actual,
    saveV3InspectionReport: (...args: unknown[]) => mockSaveV3InspectionReport(...args),
  };
});

class MockFileReader {
  result: string | ArrayBuffer | null = null;
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  readAsDataURL() {
    this.result = 'data:image/png;base64,aGVsbG8=';
    this.onload?.();
  }
}

function renderPanel() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <HardwareInspectionPanel open onOpenChange={vi.fn()} projectId={42} />
    </QueryClientProvider>,
  );
}

describe('HardwareInspectionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveV3InspectionReport.mockResolvedValue({
      id: 99,
      projectId: 42,
      mode: 'visual',
      query: 'Stored report',
      markdown: '## Stored',
      createdAt: new Date().toISOString(),
    });
    localStorage.clear();
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      writable: true,
      value: MockFileReader,
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('uploads an image and sends the visual inspection payload', async () => {
    mockRunVisualHardwareInspection.mockResolvedValue({ result: '## Report\nNo issues.' });
    renderPanel();

    const file = new File(['hello'], 'bench.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('hardware-inspection-file-input'), {
      target: { files: [file] },
    });

    expect(await screen.findByTestId('hardware-inspection-image-preview')).toBeInTheDocument();
    fireEvent.change(screen.getByTestId('hardware-inspection-query'), {
      target: { value: 'Check the breadboard wiring.' },
    });
    fireEvent.click(screen.getByTestId('hardware-inspection-submit'));

    await waitFor(() => {
      expect(mockRunVisualHardwareInspection).toHaveBeenCalledWith({
        projectId: 42,
        imageUrl: 'data:image/png;base64,aGVsbG8=',
        query: 'Check the breadboard wiring.',
      });
    });
    await waitFor(() => {
      expect(mockSaveV3InspectionReport).toHaveBeenCalledWith(42, expect.objectContaining({
        mode: 'visual',
        query: 'Check the breadboard wiring.',
        markdown: '## Report\nNo issues.',
        provenance: ['visualHardwareInspectionFlow', 'HardwareInspectionPanel'],
      }));
    });
    expect(await screen.findByTestId('hardware-inspection-result')).toHaveTextContent('No issues.');
    expect(await screen.findByTestId('hardware-inspection-v3-storage-status')).toHaveTextContent('Stored in v3 inspection reports #99');
  });

  it('switches to layout mode and sends chassis constraints', async () => {
    mockRunEmbodiedLayoutAnalysis.mockResolvedValue({ result: 'Keep hot parts away from battery.' });
    renderPanel();

    fireEvent.click(screen.getByTestId('hardware-inspection-mode-layout'));
    fireEvent.change(screen.getByTestId('hardware-inspection-chassis'), {
      target: { value: 'Tiny rover chassis with rear battery.' },
    });
    fireEvent.change(screen.getByTestId('hardware-inspection-query'), {
      target: { value: 'Where should the regulator go?' },
    });
    fireEvent.click(screen.getByTestId('hardware-inspection-submit'));

    await waitFor(() => {
      expect(mockRunEmbodiedLayoutAnalysis).toHaveBeenCalledWith({
        projectId: 42,
        chassisDescription: 'Tiny rover chassis with rear battery.',
        query: 'Where should the regulator go?',
        imageUrl: undefined,
      });
    });
    await waitFor(() => {
      expect(mockSaveV3InspectionReport).toHaveBeenCalledWith(42, expect.objectContaining({
        mode: 'layout',
        chassisDescription: 'Tiny rover chassis with rear battery.',
        query: 'Where should the regulator go?',
        markdown: 'Keep hot parts away from battery.',
        provenance: ['embodiedLayoutAnalysisFlow', 'HardwareInspectionPanel'],
      }));
    });
    expect(await screen.findByTestId('hardware-inspection-result')).toHaveTextContent('Keep hot parts away from battery.');
  });

  it('saves reports to project history and supports copy/delete', async () => {
    mockRunVisualHardwareInspection.mockResolvedValue({ result: '## Saved Report\nInspect this later.' });
    const { unmount } = renderPanel();

    const file = new File(['hello'], 'bench.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('hardware-inspection-file-input'), {
      target: { files: [file] },
    });
    await screen.findByTestId('hardware-inspection-image-preview');
    fireEvent.change(screen.getByTestId('hardware-inspection-query'), {
      target: { value: 'Save this report.' },
    });
    fireEvent.click(screen.getByTestId('hardware-inspection-submit'));

    expect(await screen.findByTestId('hardware-inspection-history')).toHaveTextContent('Save this report.');
    expect(screen.getByTestId('hardware-inspection-result')).toHaveTextContent('Inspect this later.');

    unmount();
    renderPanel();

    expect(await screen.findByTestId('hardware-inspection-history')).toHaveTextContent('Save this report.');
    expect(await screen.findByTestId('hardware-inspection-result')).toHaveTextContent('Inspect this later.');

    fireEvent.click(screen.getByText('Copy Markdown'));
    await waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('## Saved Report\nInspect this later.');
    });
    expect(await screen.findByTestId('hardware-inspection-copy-status')).toHaveTextContent('Copied');

    fireEvent.click(screen.getAllByText('Delete')[0]);
    expect(screen.queryByTestId('hardware-inspection-history')).not.toBeInTheDocument();
    expect(screen.getByText('Reports you run will stay here for this project.')).toBeInTheDocument();
  });
});
