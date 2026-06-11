import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ExportPanel from '@/components/panels/ExportPanel';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import { RADIAL_AI_CHAT_DRAFT_EVENT } from '@/lib/radial-ai-commands';

const mocks = vi.hoisted(() => ({
  addOutputLog: vi.fn(),
  apiRequest: vi.fn(),
  downloadBlob: vi.fn(),
  fetch: vi.fn(),
  toast: vi.fn(),
  writeText: vi.fn(),
}));

vi.mock('@/lib/contexts/project-id-context', () => ({
  useProjectId: () => 1,
}));

vi.mock('@/lib/project-context', () => ({
  useProjectMeta: () => ({ projectName: 'Radial Test Project' }),
}));

vi.mock('@/lib/parts/use-bom-shortfalls', () => ({
  useBomShortfalls: () => ({ data: null }),
}));

vi.mock('@/lib/contexts/architecture-context', () => ({
  useArchitecture: () => ({ nodes: [{ id: 'n1', type: 'mcu', data: { label: 'MCU' } }], edges: [] }),
}));

vi.mock('@/lib/contexts/bom-context', () => ({
  useBom: () => ({ bom: [{ id: 'b1', partNumber: 'ESP32-S3', description: 'MCU' }] }),
}));

vi.mock('@/lib/contexts/arduino-context', () => ({
  useArduino: () => ({ profiles: [{ id: 1, name: 'Uno', fqbn: 'arduino:avr:uno' }] }),
}));

vi.mock('@/lib/contexts/output-context', () => ({
  useOutput: () => ({ addOutputLog: mocks.addOutputLog }),
}));

vi.mock('@/lib/contexts/validation-context', () => ({
  useValidation: () => ({ issues: [] }),
}));

vi.mock('@/lib/circuit-editor/hooks', () => ({
  useCircuitDesigns: () => ({ data: [{ id: 1, name: 'Main Circuit' }] }),
  useCircuitInstances: () => ({ data: [{ id: 1, referenceDesignator: 'R1', pcbX: 10, pcbY: 10, properties: {} }] }),
  useCircuitNets: () => ({ data: [] }),
}));

vi.mock('@/lib/component-editor/hooks', () => ({
  useComponentParts: () => ({ data: [] }),
}));

vi.mock('@/lib/circuit-selector', () => ({
  useCircuitSelector: () => ({ selected: { circuitId: 1, circuitName: 'Main Circuit' } }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mocks.toast }),
}));

vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children, ...props }: Record<string, unknown>) => <span {...props}>{children as React.ReactNode}</span>,
}));

vi.mock('@/components/ui/styled-tooltip', () => ({
  StyledTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/components/ui/ReleaseConfidenceCard', () => ({
  default: () => <div data-testid="release-confidence-panel" />,
}));

vi.mock('@/components/ui/TrustReceiptCard', () => ({
  default: () => <div data-testid="trust-receipt-export" />,
}));

vi.mock('@/components/panels/ExportResultsPanel', () => ({
  default: () => <div data-testid="export-results-panel" />,
}));

vi.mock('@/components/panels/ExportProfileSelector', () => ({
  default: ({ onExportProfile }: { onExportProfile: (formatIds: readonly string[]) => void }) => (
    <div data-testid="export-profile-selector">
      <button type="button" data-testid="mock-export-profile" onClick={() => onExportProfile(['fab-package'])}>
        Fab Profile
      </button>
    </div>
  ),
}));

vi.mock('@/components/panels/CircuitSelectorDropdown', () => ({
  default: () => <div data-testid="circuit-selector-dropdown" />,
}));

vi.mock('@/components/panels/ExportPrecheckPanel', () => ({
  default: ({ format, formatLabel }: { format: string; formatLabel: string }) => (
    <div data-testid={`export-precheck-panel-${format}`}>{formatLabel}</div>
  ),
}));

vi.mock('@/components/panels/ImportPreviewDialog', () => ({ default: () => null }));
vi.mock('@/components/panels/ImportWarningsPanel', () => ({ default: () => null }));
vi.mock('@/components/panels/ImportHistoryPanel', () => ({ default: () => null }));
vi.mock('@/components/panels/ImportRepairDialog', () => ({ default: () => null }));
vi.mock('@/components/panels/PickPlacePreview', () => ({ default: () => <div data-testid="pick-place-preview" /> }));
vi.mock('@/components/panels/DesignDiffPanel', () => ({ default: () => <div data-testid="design-diff-panel" /> }));

vi.mock('@/lib/export-validation', () => ({
  validateExportPreflight: () => ({ canExport: true, errors: [], warnings: [], suggestions: [] }),
}));

vi.mock('@/lib/export-precheck', () => ({
  runExportPrecheck: () => ({ passed: true, warnings: [], blockers: [] }),
}));

vi.mock('@/lib/validation-safety-gates', () => ({
  buildValidationSafetyGateData: () => ({}),
}));

vi.mock('@/lib/export-snapshot', () => ({
  shouldAutoSnapshot: () => false,
  createExportSnapshot: () => ({ label: 'Snapshot', timestamp: 'now' }),
}));

vi.mock('@/lib/trust-receipts', () => ({
  buildExportTrustReceipt: () => ({}),
}));

vi.mock('@/lib/workspace-release-confidence', () => ({
  buildWorkspaceReleaseConfidence: () => ({
    confidence: {
      label: 'Ready',
      sourceNote: '',
      band: 'strong',
      evidenceLabel: 'Test evidence',
      summary: 'Ready',
      blockers: [],
      nextActions: [],
    },
  }),
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: (...args: unknown[]) => mocks.apiRequest(...args),
}));

vi.mock('@/lib/csv', () => ({
  downloadBlob: (...args: unknown[]) => mocks.downloadBlob(...args),
}));

function dispatchExportRadial(commandId: string, targetId?: string, targetLabel?: string): RadialCommandEventDetail {
  const detail: RadialCommandEventDetail = {
    commandId,
    context: {
      view: 'exports',
      target: targetId ? 'file' : 'canvas',
      targetId,
      targetLabel,
    },
    source: 'radial-menu',
  };

  act(() => {
    window.dispatchEvent(new CustomEvent<RadialCommandEventDetail>(RADIAL_COMMAND_EVENT, { detail }));
  });

  return detail;
}

describe('ExportPanel radial commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.localStorage.setItem('protopulse-session-id', 'test-session');
    vi.stubGlobal('fetch', mocks.fetch);
    mocks.fetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'attachment; filename="fab-package.zip"' },
      blob: async () => new Blob(['fab-package']),
    });
    mocks.downloadBlob.mockResolvedValue(undefined);
    mocks.writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: mocks.writeText },
    });
  });

  it('marks export formats as radial file targets', () => {
    render(<ExportPanel />);

    expect(screen.getByTestId('export-format-fab-package').getAttribute('data-file-id')).toBe('fab-package');
    expect(screen.getByTestId('export-format-fab-package').getAttribute('data-file-label')).toBe(
      'Complete Fab Package',
    );
  });

  it('handles radial export creation for the clicked format', async () => {
    render(<ExportPanel />);

    const detail = dispatchExportRadial('create_export', 'fab-package', 'Complete Fab Package');

    await waitFor(() => {
      expect(mocks.fetch).toHaveBeenCalledWith(
        '/api/projects/1/export/fab-package',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    expect(detail.handled).toBe(true);
    expect(mocks.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'fab-package.zip');
    expect(mocks.addOutputLog).toHaveBeenCalledWith('[EXPORT] Radial export requested: Complete Fab Package.');
  });

  it('opens radial export precheck for the clicked format', async () => {
    render(<ExportPanel />);

    const detail = dispatchExportRadial('run_export_precheck', 'gerber', 'Gerber + Drill');

    await waitFor(() => {
      expect(screen.getByTestId('export-precheck-panel-gerber')).toBeDefined();
    });

    expect(detail.handled).toBe(true);
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export precheck opened' }));
  });

  it('drafts export readiness context to AI chat from a radial command', () => {
    const chatOpenListener = vi.fn();
    const chatDraftListener = vi.fn();
    window.addEventListener('protopulse:open-chat-panel', chatOpenListener);
    window.addEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);

    try {
      render(<ExportPanel />);

      const detail = dispatchExportRadial('ai_export_plan', 'fab-package', 'Complete Fab Package');

      expect(detail.handled).toBe(true);
      expect(chatOpenListener).toHaveBeenCalledTimes(1);
      expect(chatDraftListener).toHaveBeenCalledTimes(1);
      const message = (chatDraftListener.mock.calls[0]?.[0] as CustomEvent<{ message: string }>).detail.message;
      expect(message).toContain('AI intent: export_plan.');
      expect(message).toContain('Export readiness prompt: Complete Fab Package');
      expect(message).toContain('Target: file "Complete Fab Package"');
      expect(message).toContain('Workspace signals:');
      expect(message).toContain('BOM lines: 1');
      expect(message).toContain('Representative BOM lines:');
      expect(message).toContain('ESP32-S3 x1');
      expect(mocks.addOutputLog).toHaveBeenCalledWith('[EXPORT] Drafted AI export plan for Complete Fab Package.');
      expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'AI Export Plan Drafted' }));
    } finally {
      window.removeEventListener('protopulse:open-chat-panel', chatOpenListener);
      window.removeEventListener(RADIAL_AI_CHAT_DRAFT_EVENT, chatDraftListener);
    }
  });

  it('reveals import surfaces from radial export utility commands', async () => {
    render(<ExportPanel />);

    const revealDetail = dispatchExportRadial('reveal_export_format', 'gerber', 'Gerber + Drill');
    expect(revealDetail.handled).toBe(true);
    expect(mocks.addOutputLog).toHaveBeenCalledWith('[EXPORT] Revealed radial export target: Gerber + Drill.');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export format revealed' }));

    const importDetail = dispatchExportRadial('open_import_design');
    expect(importDetail.handled).toBe(true);
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByTestId('import-design-file-button'));
    });
    expect(mocks.addOutputLog).toHaveBeenCalledWith('[IMPORT] Radial import chooser focused.');

    const historyDetail = dispatchExportRadial('open_import_history');
    expect(historyDetail.handled).toBe(true);
    await waitFor(() => {
      expect(screen.getByTestId('import-history-toggle').getAttribute('aria-expanded')).toBe('true');
    });
    expect(mocks.addOutputLog).toHaveBeenCalledWith('[IMPORT] Radial import history opened.');
  });

  it('focuses quick export settings from the radial settings command', () => {
    render(<ExportPanel />);

    const detail = dispatchExportRadial('export_settings');

    expect(detail.handled).toBe(true);
    expect(document.activeElement).toBe(screen.getByTestId('mock-export-profile'));
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export settings' }));
  });

  it('copies a radial export summary to the clipboard', async () => {
    render(<ExportPanel />);

    const detail = dispatchExportRadial('copy_export_summary', 'firmware', 'Firmware Scaffold');

    await waitFor(() => {
      expect(mocks.writeText).toHaveBeenCalledWith(expect.stringContaining('ProtoPulse export summary'));
    });

    expect(detail.handled).toBe(true);
    expect(mocks.writeText.mock.calls[0][0]).toContain('Format: Firmware Scaffold (firmware)');
    expect(mocks.writeText.mock.calls[0][0]).toContain('Release confidence: Ready');
    expect(mocks.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Export summary copied' }));
  });
});
