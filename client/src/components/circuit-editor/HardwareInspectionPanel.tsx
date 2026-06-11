import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, Clipboard, FileImage, Loader2, SearchCheck, ThermometerSun, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MarkdownContent } from '@/components/panels/chat/MessageBubble';
import { MultimodalInputEngine } from '@/lib/multimodal-input';
import { MobileCaptureManager } from '@/lib/mobile-capture';
import {
  runEmbodiedLayoutAnalysis,
  runVisualHardwareInspection,
  type HardwareInspectionMode,
} from '@/lib/hardware-inspection-api';
import { saveV3InspectionReport } from '@/lib/v3-architecture-api';
import { cn } from '@/lib/utils';

interface HardwareInspectionPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
}

interface HardwareInspectionReport {
  id: string;
  mode: HardwareInspectionMode;
  createdAt: string;
  query: string;
  chassisDescription?: string;
  imageName?: string;
  imagePreviewUrl?: string;
  result: string;
  v3InspectionReportId?: number;
  v3StorageError?: string;
}

const REPORT_HISTORY_LIMIT = 12;

function getHistoryStorageKey(projectId: number): string {
  return `protopulse:hardware-inspection:reports:${String(projectId)}`;
}

function createReportId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `report-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function readReportHistory(projectId: number): HardwareInspectionReport[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(getHistoryStorageKey(projectId));
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((report): report is HardwareInspectionReport => (
      report != null
      && typeof report === 'object'
      && typeof report.id === 'string'
      && (report.mode === 'visual' || report.mode === 'layout')
      && typeof report.createdAt === 'string'
      && typeof report.query === 'string'
      && typeof report.result === 'string'
    ));
  } catch {
    return [];
  }
}

function writeReportHistory(projectId: number, reports: HardwareInspectionReport[]): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    window.localStorage.setItem(getHistoryStorageKey(projectId), JSON.stringify(reports.slice(0, REPORT_HISTORY_LIMIT)));
  } catch {
    const withoutImages = reports.map((report) => ({
      id: report.id,
      mode: report.mode,
      createdAt: report.createdAt,
      query: report.query,
      chassisDescription: report.chassisDescription,
      imageName: report.imageName,
      result: report.result,
    }));
    try {
      window.localStorage.setItem(getHistoryStorageKey(projectId), JSON.stringify(withoutImages.slice(0, REPORT_HISTORY_LIMIT)));
    } catch {
      // Storage can be full or disabled. The report still stays visible for this session.
    }
  }
}

function getReportModeLabel(mode: HardwareInspectionMode): string {
  return mode === 'visual' ? 'Wiring' : 'Layout';
}

function formatReportDate(createdAt: string): string {
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) {
    return 'Saved report';
  }
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Could not read image file'));
    };
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

async function createImageDigest(imageDataUrl: string): Promise<string | undefined> {
  if (!imageDataUrl) {
    return undefined;
  }
  const encoder = new TextEncoder();
  const data = encoder.encode(imageDataUrl);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hex = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    return `sha256:${hex}`;
  }
  return `data-url:${String(imageDataUrl.length)}:${imageDataUrl.slice(0, 24)}`;
}

async function attachV3Storage(
  projectId: number,
  report: HardwareInspectionReport,
): Promise<HardwareInspectionReport> {
  try {
    const stored = await saveV3InspectionReport(projectId, {
      mode: report.mode,
      query: report.query,
      chassisDescription: report.chassisDescription,
      imageDigest: await createImageDigest(report.imagePreviewUrl ?? ''),
      markdown: report.result,
      provenance: [
        report.mode === 'visual' ? 'visualHardwareInspectionFlow' : 'embodiedLayoutAnalysisFlow',
        'HardwareInspectionPanel',
      ],
    });
    return {
      ...report,
      v3InspectionReportId: stored.id,
      v3StorageError: undefined,
    };
  } catch (error) {
    return {
      ...report,
      v3StorageError: error instanceof Error ? error.message : 'Could not save report to v3 storage',
    };
  }
}

export default function HardwareInspectionPanel({
  open,
  onOpenChange,
  projectId,
}: HardwareInspectionPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const engine = useMemo(() => MultimodalInputEngine.getInstance(), []);
  const [mode, setMode] = useState<HardwareInspectionMode>('visual');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageName, setImageName] = useState<string>('');
  const [query, setQuery] = useState('Find wiring mistakes, missing parts, reversed polarity, and anything that does not match the digital schematic.');
  const [chassisDescription, setChassisDescription] = useState('');
  const [inputError, setInputError] = useState<string>('');
  const [reports, setReports] = useState<HardwareInspectionReport[]>(() => readReportHistory(projectId));
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    const nextReports = readReportHistory(projectId);
    setReports(nextReports);
    setSelectedReportId(nextReports[0]?.id ?? null);
  }, [projectId]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!query.trim()) {
        throw new Error('Add a question for the inspection.');
      }
      if (mode === 'visual') {
        if (!imageUrl) {
          throw new Error('Add a hardware photo first.');
        }
        const response = await runVisualHardwareInspection({
          projectId,
          imageUrl,
          query: query.trim(),
        });
        const report = {
          id: createReportId(),
          mode,
          createdAt: new Date().toISOString(),
          query: query.trim(),
          imageName: imageName || undefined,
          imagePreviewUrl: imageUrl || undefined,
          result: response.result,
        } satisfies HardwareInspectionReport;
        return attachV3Storage(projectId, report);
      }
      if (!chassisDescription.trim()) {
        throw new Error('Describe the chassis or enclosure first.');
      }
      const response = await runEmbodiedLayoutAnalysis({
        projectId,
        chassisDescription: chassisDescription.trim(),
        query: query.trim(),
        imageUrl: imageUrl || undefined,
      });
      const report = {
        id: createReportId(),
        mode,
        createdAt: new Date().toISOString(),
        query: query.trim(),
        chassisDescription: chassisDescription.trim(),
        imageName: imageName || undefined,
        imagePreviewUrl: imageUrl || undefined,
        result: response.result,
      } satisfies HardwareInspectionReport;
      return attachV3Storage(projectId, report);
    },
    onSuccess: (report) => {
      setReports((currentReports) => {
        const nextReports = [report, ...currentReports.filter((item) => item.id !== report.id)].slice(0, REPORT_HISTORY_LIMIT);
        writeReportHistory(projectId, nextReports);
        return nextReports;
      });
      setSelectedReportId(report.id);
      setCopyStatus('');
    },
  });

  const handleDataUrl = (dataUrl: string, source: 'camera' | 'file', name: string) => {
    const validation = engine.validateImage(dataUrl);
    if (!validation.valid) {
      setInputError(validation.errors.join(' '));
      return;
    }
    const capture = engine.captureFromDataUrl(dataUrl, source, 'photo');
    const preprocessed = engine.preprocessImage(capture.id, {
      maxWidth: 2048,
      maxHeight: 2048,
      quality: 0.85,
    });
    setImageUrl(preprocessed.processed.dataUrl);
    setImageName(name);
    setInputError('');
    mutation.reset();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      handleDataUrl(dataUrl, 'file', file.name);
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Could not read image file');
    } finally {
      event.target.value = '';
    }
  };

  const handleCameraCapture = async () => {
    try {
      const dataUrl = await MobileCaptureManager.getInstance().capturePhoto();
      handleDataUrl(dataUrl, 'camera', 'Camera capture');
    } catch (error) {
      setInputError(error instanceof Error ? error.message : 'Camera capture failed');
    }
  };

  const canSubmit = mode === 'visual'
    ? Boolean(imageUrl && query.trim())
    : Boolean(query.trim() && chassisDescription.trim());

  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? null;
  const result = selectedReport?.result ?? mutation.data?.result ?? '';
  const errorMessage = inputError || (mutation.error instanceof Error ? mutation.error.message : '');

  const handleCopyReport = async (report: HardwareInspectionReport) => {
    try {
      await navigator.clipboard.writeText(report.result);
      setCopyStatus('Copied');
    } catch {
      setCopyStatus('Copy failed');
    }
  };

  const handleDeleteReport = (reportId: string) => {
    setReports((currentReports) => {
      const nextReports = currentReports.filter((report) => report.id !== reportId);
      writeReportHistory(projectId, nextReports);
      if (selectedReportId === reportId) {
        setSelectedReportId(nextReports[0]?.id ?? null);
      }
      return nextReports;
    });
    setCopyStatus('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="hardware-inspection-panel"
        className="flex max-h-[min(760px,calc(100vh-2rem))] w-[min(920px,calc(100vw-2rem))] max-w-[920px] flex-col overflow-hidden border border-border bg-background/95 p-0"
      >
        <DialogHeader className="border-b border-border/70 px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-base">
            <SearchCheck className="h-4 w-4 text-primary" />
            Hardware Inspection
          </DialogTitle>
          <DialogDescription className="sr-only">
            Upload or capture a hardware photo, ask a question, and run the Gemini Robotics inspection flows.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[20rem_minmax(0,1fr)]">
          <section className="min-h-0 overflow-y-auto border-b border-border/70 p-3 lg:border-b-0 lg:border-r">
            <div className="grid grid-cols-2 gap-1 rounded-sm border border-border/60 bg-muted/20 p-1">
              <button
                data-testid="hardware-inspection-mode-visual"
                type="button"
                onClick={() => {
                  setMode('visual');
                  mutation.reset();
                }}
                className={cn(
                  'flex h-8 items-center justify-center gap-1.5 rounded-sm text-[11px] font-medium transition-colors',
                  mode === 'visual' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <SearchCheck className="h-3.5 w-3.5" />
                Inspect wiring
              </button>
              <button
                data-testid="hardware-inspection-mode-layout"
                type="button"
                onClick={() => {
                  setMode('layout');
                  mutation.reset();
                }}
                className={cn(
                  'flex h-8 items-center justify-center gap-1.5 rounded-sm text-[11px] font-medium transition-colors',
                  mode === 'layout' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground',
                )}
              >
                <ThermometerSun className="h-3.5 w-3.5" />
                Analyze layout
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <input
                ref={fileInputRef}
                data-testid="hardware-inspection-file-input"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => void handleFileChange(event)}
              />
              <div className="grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-[11px]"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FileImage className="h-3.5 w-3.5" />
                  Upload
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 text-[11px]"
                  onClick={() => void handleCameraCapture()}
                >
                  <Camera className="h-3.5 w-3.5" />
                  Camera
                </Button>
              </div>

              {imageUrl ? (
                <div className="relative overflow-hidden rounded-sm border border-border/60 bg-muted/20">
                  <img
                    data-testid="hardware-inspection-image-preview"
                    src={imageUrl}
                    alt={imageName || 'Hardware capture'}
                    className="max-h-48 w-full object-contain"
                  />
                  <button
                    type="button"
                    data-testid="hardware-inspection-clear-image"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-sm border border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
                    aria-label="Remove image"
                    onClick={() => {
                      setImageUrl('');
                      setImageName('');
                      mutation.reset();
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  <p className="truncate border-t border-border/50 px-2 py-1 text-[11px] text-muted-foreground">
                    {imageName}
                  </p>
                </div>
              ) : (
                <div className="flex min-h-28 items-center justify-center rounded-sm border border-dashed border-border/70 bg-muted/10 p-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                  Add a photo of the breadboard, PCB, wiring harness, or chassis.
                </div>
              )}

              {mode === 'layout' && (
                <label className="block space-y-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Chassis / enclosure constraints</span>
                  <textarea
                    data-testid="hardware-inspection-chassis"
                    value={chassisDescription}
                    onChange={(event) => setChassisDescription(event.target.value)}
                    className="min-h-24 w-full resize-y border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    placeholder="Example: Small acrylic rover chassis, battery on rear left, motor driver near center, wires must clear wheel travel."
                  />
                </label>
              )}

              <label className="block space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground">Question</span>
                <textarea
                  data-testid="hardware-inspection-query"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="min-h-28 w-full resize-y border border-border/60 bg-muted/20 px-2 py-1.5 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              {errorMessage && (
                <p data-testid="hardware-inspection-error" className="rounded-sm border border-destructive/40 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">
                  {errorMessage}
                </p>
              )}

              <Button
                data-testid="hardware-inspection-submit"
                type="button"
                className="h-8 w-full gap-1.5 text-[11px]"
                disabled={!canSubmit || mutation.isPending}
                onClick={() => mutation.mutate()}
              >
                {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <SearchCheck className="h-3.5 w-3.5" />}
                {mutation.isPending ? 'Analyzing...' : mode === 'visual' ? 'Run inspection' : 'Run layout analysis'}
              </Button>

              <div className="border-t border-border/60 pt-2">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-muted-foreground">Recent reports</p>
                  {reports.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{reports.length}/{REPORT_HISTORY_LIMIT}</span>
                  )}
                </div>
                {reports.length > 0 ? (
                  <div className="max-h-56 space-y-1 overflow-y-auto pr-1" data-testid="hardware-inspection-history">
                    {reports.map((report) => (
                      <div
                        key={report.id}
                        className={cn(
                          'group rounded-sm border p-1.5 transition-colors',
                          selectedReportId === report.id ? 'border-primary/50 bg-primary/10' : 'border-border/60 bg-muted/10 hover:bg-muted/25',
                        )}
                      >
                        <button
                          type="button"
                          data-testid={`hardware-inspection-report-${report.id}`}
                          className="flex w-full items-start gap-2 text-left"
                          onClick={() => {
                            setSelectedReportId(report.id);
                            setCopyStatus('');
                          }}
                        >
                          {report.imagePreviewUrl ? (
                            <img
                              src={report.imagePreviewUrl}
                              alt=""
                              className="h-10 w-10 shrink-0 rounded-sm border border-border/50 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border/50 bg-muted/20">
                              {report.mode === 'visual' ? <SearchCheck className="h-4 w-4 text-primary" /> : <ThermometerSun className="h-4 w-4 text-primary" />}
                            </div>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                              <span>{getReportModeLabel(report.mode)}</span>
                              <span className="text-muted-foreground">-</span>
                              <span className="text-muted-foreground">{formatReportDate(report.createdAt)}</span>
                            </span>
                            <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                              {report.query}
                            </span>
                            {report.v3InspectionReportId && (
                              <span className="mt-0.5 block text-[10px] text-emerald-500">
                                Stored in v3 reports #{report.v3InspectionReportId}
                              </span>
                            )}
                          </span>
                        </button>
                        <div className="mt-1 flex justify-end gap-1">
                          <button
                            type="button"
                            className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-[10px] text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                            onClick={() => void handleCopyReport(report)}
                          >
                            <Clipboard className="h-3 w-3" />
                            Copy
                          </button>
                          <button
                            type="button"
                            className="flex h-6 items-center gap-1 rounded-sm px-1.5 text-[10px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => handleDeleteReport(report.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-sm border border-dashed border-border/60 bg-muted/10 p-2 text-[11px] leading-relaxed text-muted-foreground">
                    Reports you run will stay here for this project.
                  </div>
                )}
                {copyStatus && (
                  <p data-testid="hardware-inspection-copy-status" className="mt-1 text-[10px] text-muted-foreground">
                    {copyStatus}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="min-h-0 overflow-y-auto p-4">
            {result ? (
              <div className="space-y-2">
                {selectedReport && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-border/60 bg-muted/10 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                    <span className="space-y-0.5">
                      <span className="block">
                        {getReportModeLabel(selectedReport.mode)} report - {formatReportDate(selectedReport.createdAt)}
                      </span>
                      {selectedReport.v3InspectionReportId ? (
                        <span data-testid="hardware-inspection-v3-storage-status" className="block text-emerald-500">
                          Stored in v3 inspection reports #{selectedReport.v3InspectionReportId}
                        </span>
                      ) : selectedReport.v3StorageError ? (
                        <span data-testid="hardware-inspection-v3-storage-status" className="block text-amber-500">
                          Local only - v3 save failed: {selectedReport.v3StorageError}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-[11px]"
                        onClick={() => void handleCopyReport(selectedReport)}
                      >
                        <Clipboard className="h-3.5 w-3.5" />
                        Copy Markdown
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1.5 text-[11px] text-destructive hover:text-destructive"
                        onClick={() => handleDeleteReport(selectedReport.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
                <div data-testid="hardware-inspection-result" className="rounded-sm border border-border/60 bg-card/40 p-3 text-sm">
                  <MarkdownContent content={result} />
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-64 items-center justify-center rounded-sm border border-border/50 bg-muted/10 p-5 text-center text-sm leading-relaxed text-muted-foreground">
                The VLM report will appear here after the backend compares your physical hardware against the project data.
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
