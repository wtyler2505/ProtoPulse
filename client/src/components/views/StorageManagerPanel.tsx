import { useState, useMemo, useRef, useCallback, useEffect, memo, type ComponentType } from 'react';
import { sanitizeSvg } from '@/lib/svg-sanitize';
import {
  ChevronDown,
  ChevronRight,
  Package,
  Search,
  MapPin,
  ScanBarcode,
  Printer,
  Activity,
  AlertTriangle,
  Info,
  X,
  Video,
  VideoOff,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { InventoryHealthAnalyzer } from '@/lib/inventory-health';
import { useBarcodeScanner } from '@/lib/barcode-scanner';
import { generateLabelSVG, generatePrintPage } from '@/lib/qr-labels';
import { runExportPrecheck, type ExportPrecheck, type PrecheckStatus } from '@/lib/export-precheck';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';
import { useToast } from '@/hooks/use-toast';

import { useBom } from '@/lib/contexts/bom-context';
import type { BomItem } from '@/lib/project-context';
import type { ProjectExportData } from '@/lib/export-validation';
import type { HealthReport, HealthFactor, HealthIssue, HealthRecommendation } from '@/lib/inventory-health';
import type { ScanResult } from '@/lib/barcode-scanner';
import type { QRLabelItem, QRLabelOptions, PrintPageOptions } from '@/lib/qr-labels';

interface StorageManagerPanelProps {
  projectId: number;
  className?: string;
}

/** Returns stock status: 'ok' | 'low' | 'critical' | 'untracked'. */
function getStockStatus(item: BomItem): 'ok' | 'low' | 'critical' | 'untracked' {
  if (item.quantityOnHand == null || item.minimumStock == null) {
    return 'untracked';
  }
  if (item.quantityOnHand <= item.minimumStock) {
    return 'critical';
  }
  if (item.quantityOnHand < item.minimumStock * 2) {
    return 'low';
  }
  return 'ok';
}

/** Badge variant and label for each stock status. */
function getStockBadgeProps(status: 'ok' | 'low' | 'critical' | 'untracked'): {
  label: string;
  className: string;
} {
  switch (status) {
    case 'ok':
      return {
        label: 'OK',
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      };
    case 'low':
      return {
        label: 'Low',
        className: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      };
    case 'critical':
      return {
        label: 'Critical',
        className: 'bg-destructive/15 text-destructive border-destructive/30',
      };
    case 'untracked':
      return {
        label: 'Not tracked',
        className: 'bg-muted/50 text-muted-foreground border-muted',
      };
  }
}

const SESSION_KEY = 'protopulse-session-id';

const ESTIMATED_CONFIDENCE_VALUES = new Set([
  'estimated',
  'estimate',
  'unknown',
  'unverified',
  'fallback',
  'fallback-unknown',
  'historical-estimate',
  'mock',
]);

type InventoryTrustTone = 'verified' | 'warning' | 'info' | 'muted';

interface InventoryTrustMarker {
  id: string;
  label: string;
  title: string;
  tone: InventoryTrustTone;
}

const VERIFIED_EXACT_VALUES = new Set([
  'official-backed',
  'mixed-source',
  'verified',
  'exact',
  'exact-part',
  'authoritative',
]);

const GENERATED_SOURCE_VALUES = ['ai', 'agent', 'generated', 'generative', 'assistant', 'eve'];

const VERIFIED_MECHANICAL_VALUES = new Set(['verified', 'official-backed', 'exact', 'exact-part', 'authoritative']);

const REVIEW_MECHANICAL_VALUES = new Set(['candidate', 'draft', 'missing', 'unknown', 'unverified', 'generated']);

const TRUST_MARKER_CLASS: Record<InventoryTrustTone, string> = {
  verified: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  warning: 'border-amber-500/50 bg-amber-500/10 text-amber-300',
  info: 'border-blue-500/40 bg-blue-500/10 text-blue-300',
  muted: 'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
};

function readHasSession(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem(SESSION_KEY));
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeConfidenceValue(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-');
}

function readFirstMetadataString(records: Array<Record<string, unknown>>, keys: string[]): string {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value.trim();
      }
    }
  }

  return '';
}

function readFirstMetadataBoolean(records: Array<Record<string, unknown>>, keys: string[]): boolean | null {
  for (const record of records) {
    for (const key of keys) {
      const value = record[key];
      if (typeof value === 'boolean') {
        return value;
      }
    }
  }

  return null;
}

function getItemMetadataRecords(item: BomItem): Array<Record<string, unknown>> {
  const record = item as unknown as Record<string, unknown>;
  return [
    record,
    readRecord(record.meta),
    readRecord(record.properties),
    readRecord(record.trust),
    readRecord(record.exactPartTrust),
    readRecord(record.inventoryTrust),
  ];
}

function isEstimatedTrustBoundary(value: unknown): boolean {
  const trust = readRecord(value);
  if (trust.verified === false || trust.isMock === true) {
    return true;
  }

  return ESTIMATED_CONFIDENCE_VALUES.has(normalizeConfidenceValue(trust.source));
}

function hasEstimatedInventoryConfidence(item: BomItem): boolean {
  if (item.quantityOnHand == null || item.minimumStock == null) {
    return true;
  }

  const record = item as unknown as Record<string, unknown>;
  if (isEstimatedTrustBoundary(record.pricingTrust) || isEstimatedTrustBoundary(record.inventoryTrust)) {
    return true;
  }

  return [
    record.inventoryConfidence,
    record.stockConfidence,
    record.quantityConfidence,
    record.confidence,
    record.source,
  ].some((value) => ESTIMATED_CONFIDENCE_VALUES.has(normalizeConfidenceValue(value)));
}

function getInventoryTrustMarkers(item: BomItem): InventoryTrustMarker[] {
  const records = getItemMetadataRecords(item);
  const markers: InventoryTrustMarker[] = [];
  let hasOriginMarker = false;

  const exactPartValue = normalizeConfidenceValue(
    readFirstMetadataString(records, [
      'verificationLevel',
      'verificationStatus',
      'exactPartVerification',
      'exactPartStatus',
      'status',
    ]),
  );
  if (
    VERIFIED_EXACT_VALUES.has(exactPartValue) ||
    readFirstMetadataBoolean(records, ['authoritativeWiringAllowed', 'exactPartVerified']) === true
  ) {
    markers.push({
      id: 'exact',
      label: 'Verified exact',
      title: 'This saved part carries exact-part verification metadata.',
      tone: 'verified',
    });
    hasOriginMarker = true;
  }

  const generatedFrom = readFirstMetadataString(records, ['generatedFrom', 'source', 'origin', 'createdBy']);
  const normalizedGeneratedFrom = normalizeConfidenceValue(generatedFrom);
  if (GENERATED_SOURCE_VALUES.some((marker) => normalizedGeneratedFrom.includes(marker))) {
    markers.push({
      id: 'generated',
      label: 'AI generated',
      title: `Generated provenance: ${generatedFrom}`,
      tone: 'warning',
    });
    hasOriginMarker = true;
  }

  if (!hasOriginMarker) {
    markers.push({
      id: 'local',
      label: 'Local unverified',
      title: 'No exact-part, generated, or community provenance is attached to this inventory line.',
      tone: 'muted',
    });
  }

  if (hasEstimatedInventoryConfidence(item)) {
    markers.push({
      id: 'confidence',
      label: 'Qty review',
      title: 'Inventory quantity confidence is estimated, unknown, or not fully tracked.',
      tone: 'warning',
    });
  }

  const mechanicalValue = normalizeConfidenceValue(
    readFirstMetadataString(records, [
      'mechanicalModelQuality',
      'mechanicalModelStatus',
      'model3dStatus',
      'threeDModelStatus',
      'viewer3DStatus',
    ]),
  );
  const hasVerified3D = readFirstMetadataBoolean(records, [
    'hasVerified3D',
    'verifiedMechanicalModel',
    'hasVerifiedMechanicalModel',
  ]);
  if (hasVerified3D === true || VERIFIED_MECHANICAL_VALUES.has(mechanicalValue)) {
    markers.push({
      id: 'mechanical',
      label: '3D verified',
      title: 'Verified 3D or mechanical model metadata is attached.',
      tone: 'verified',
    });
  } else if (hasVerified3D === false || REVIEW_MECHANICAL_VALUES.has(mechanicalValue)) {
    markers.push({
      id: 'mechanical-review',
      label: '3D review',
      title: '3D or mechanical model metadata is missing, generated, or still a candidate.',
      tone: 'warning',
    });
  }

  return markers;
}

function readFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getBomDemandShortfallSummary(items: readonly BomItem[]): {
  totalUnits: number;
  lineCount: number;
} {
  let totalUnits = 0;
  let lineCount = 0;

  for (const item of items) {
    const needed = readFiniteNumber(item.quantity) ?? 0;
    const onHand = readFiniteNumber(item.quantityOnHand);
    if (needed <= 0 || onHand == null) {
      continue;
    }

    const shortfall = Math.max(0, needed - onHand);
    if (shortfall > 0) {
      totalUnits += shortfall;
      lineCount += 1;
    }
  }

  return { totalUnits, lineCount };
}

function buildInventoryReviewData(items: readonly BomItem[]): ProjectExportData {
  const shortfall = getBomDemandShortfallSummary(items);

  return {
    projectName: null,
    hasSession: readHasSession(),
    architectureNodeCount: 0,
    hasCircuitInstances: false,
    hasPcbLayout: false,
    bomItemCount: items.length,
    bomItemsWithPartNumber: items.filter((item) => item.partNumber.trim().length > 0).length,
    hasCircuitSource: false,
    hasCircuitComponent: false,
    hasBoardProfile: false,
    bomItemsWithFailureData: 0,
    estimatedInventoryLineCount: items.filter(hasEstimatedInventoryConfidence).length,
    bomShortfallUnits: shortfall.totalUnits,
    bomShortfallLineCount: shortfall.lineCount,
  };
}

// ---------------------------------------------------------------------------
// Map BomItem to InventoryItem for the health analyzer
// ---------------------------------------------------------------------------

function bomToInventoryItem(item: BomItem): {
  id: string;
  name: string;
  partNumber?: string;
  quantity?: number;
  minimumStock?: number;
  storageLocation?: string;
  category?: string;
} {
  return {
    id: String(item.id),
    name: item.description || item.partNumber,
    partNumber: item.partNumber,
    quantity: item.quantityOnHand ?? undefined,
    minimumStock: item.minimumStock ?? undefined,
    storageLocation: item.storageLocation ?? undefined,
    category: item.assemblyCategory ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Map BomItem to QRLabelItem for label generation
// ---------------------------------------------------------------------------

function bomToLabelItem(item: BomItem): QRLabelItem {
  return {
    id: String(item.id),
    name: item.description || item.partNumber,
    partNumber: item.partNumber,
    location: item.storageLocation ?? undefined,
    quantity: item.quantityOnHand ?? undefined,
    category: item.assemblyCategory ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// Health Score Gauge
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG = {
  critical: {
    icon: AlertTriangle,
    className: 'text-destructive',
    bgClassName: 'bg-destructive/15 border-destructive/30',
  },
  warning: { icon: AlertTriangle, className: 'text-yellow-400', bgClassName: 'bg-yellow-500/15 border-yellow-500/30' },
  info: { icon: Info, className: 'text-blue-400', bgClassName: 'bg-blue-500/15 border-blue-500/30' },
} as const;

const PRIORITY_CONFIG = {
  high: { className: 'text-destructive', badgeClass: 'bg-destructive/15 text-destructive border-destructive/30' },
  medium: { className: 'text-yellow-400', badgeClass: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  low: { className: 'text-blue-400', badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
} as const;

const GRADE_COLORS: Record<HealthReport['grade'], string> = {
  A: 'text-emerald-400',
  B: 'text-cyan-400',
  C: 'text-yellow-400',
  D: 'text-orange-400',
  F: 'text-destructive',
};

const GRADE_STROKE_COLORS: Record<HealthReport['grade'], string> = {
  A: 'stroke-emerald-400',
  B: 'stroke-cyan-400',
  C: 'stroke-yellow-400',
  D: 'stroke-orange-400',
  F: 'stroke-destructive',
};

function HealthScoreGauge({ score, grade }: { score: number; grade: HealthReport['grade'] }) {
  const circumference = 2 * Math.PI * 36;
  const progress = (score / 100) * circumference;
  const dashOffset = circumference - progress;

  return (
    <div className="relative w-24 h-24 shrink-0" data-testid="health-score-gauge">
      <svg viewBox="0 0 80 80" className="w-full h-full -rotate-90">
        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          className={GRADE_STROKE_COLORS[grade]}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn('text-2xl font-bold', GRADE_COLORS[grade])} data-testid="health-score-grade">
          {grade}
        </span>
        <span className="text-[11px] text-muted-foreground" data-testid="health-score-value">
          {score}/100
        </span>
      </div>
    </div>
  );
}

function FactorBar({ factor }: { factor: HealthFactor }) {
  return (
    <div className="space-y-0.5" data-testid={`health-factor-${factor.name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">{factor.name}</span>
        <span className="font-mono text-foreground">{factor.score}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            factor.score >= 80 ? 'bg-emerald-500' : factor.score >= 60 ? 'bg-yellow-500' : 'bg-destructive',
          )}
          style={{ width: `${factor.score}%` }}
        />
      </div>
    </div>
  );
}

function IssueItem({ issue }: { issue: HealthIssue }) {
  const config = SEVERITY_CONFIG[issue.severity];
  const Icon = config.icon;

  return (
    <div
      className={cn('flex items-start gap-2 rounded-md border px-2 py-1.5', config.bgClassName)}
      data-testid={`health-issue-${issue.severity}`}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', config.className)} />
      <span className="text-[11px] text-foreground leading-relaxed">{issue.message}</span>
    </div>
  );
}

function RecommendationItem({ recommendation }: { recommendation: HealthRecommendation }) {
  const config = PRIORITY_CONFIG[recommendation.priority];

  return (
    <div
      className="flex items-start gap-2 rounded-md bg-muted/20 border border-border/50 px-2 py-1.5"
      data-testid={`health-recommendation-${recommendation.priority}`}
    >
      <Badge variant="outline" className={cn('text-[11px] px-1 py-0 shrink-0 mt-0.5', config.badgeClass)}>
        {recommendation.priority}
      </Badge>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-foreground">{recommendation.action}</div>
        <div className="text-[11px] text-muted-foreground">{recommendation.impact}</div>
      </div>
    </div>
  );
}

function InventoryHealthCard({ report }: { report: HealthReport }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <Card className="border-border/50 mb-3" data-testid="inventory-health-card">
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-4">
          <HealthScoreGauge score={report.overallScore} grade={report.grade} />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-[var(--color-editor-accent)]" />
                Inventory Health
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[11px] px-2.5"
                onClick={() => {
                  setShowDetails((prev) => !prev);
                }}
                data-testid="health-toggle-details"
              >
                {showDetails ? 'Less' : 'Details'}
              </Button>
            </div>
            <div className="space-y-1">
              {report.factors.map((f) => (
                <FactorBar key={f.name} factor={f} />
              ))}
            </div>
          </div>
        </div>

        {showDetails && (
          <div className="mt-3 space-y-3 border-t border-border/50 pt-3" data-testid="health-details-panel">
            {report.issues.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Issues</h4>
                <div className="space-y-1">
                  {report.issues.map((issue, idx) => (
                    <IssueItem key={idx} issue={issue} />
                  ))}
                </div>
              </div>
            )}

            {report.recommendations.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Recommendations
                </h4>
                <div className="space-y-1">
                  {report.recommendations.map((rec, idx) => (
                    <RecommendationItem key={idx} recommendation={rec} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const INVENTORY_GATE_STATUS: Record<
  PrecheckStatus,
  {
    icon: ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
    className: string;
    label: string;
  }
> = {
  pass: { icon: CheckCircle2, className: 'text-emerald-400', label: 'Passed' },
  warn: { icon: AlertTriangle, className: 'text-amber-400', label: 'Warning' },
  fail: { icon: XCircle, className: 'text-destructive', label: 'Blocked' },
};

function InventoryConfidenceGate({ precheck }: { precheck: ExportPrecheck }) {
  const blockers = precheck.checks.filter((check) => check.status === 'fail');
  const warnings = precheck.checks.filter((check) => check.status === 'warn');
  const passes = precheck.checks.length - blockers.length - warnings.length;
  const gateStatus: PrecheckStatus = blockers.length > 0 ? 'fail' : warnings.length > 0 ? 'warn' : 'pass';
  const statusLabel = blockers.length > 0 ? 'Blocked' : warnings.length > 0 ? 'Review' : 'Ready';
  const StatusIcon = INVENTORY_GATE_STATUS[gateStatus].icon;

  return (
    <section
      id="inventory-confidence-gate"
      data-testid="inventory-confidence-gate"
      aria-labelledby="inventory-confidence-gate-title"
      aria-live="polite"
      className={cn(
        'mb-3 rounded-md border px-3 py-2.5 text-sm',
        blockers.length > 0
          ? 'border-destructive/50 bg-card/70'
          : warnings.length > 0
            ? 'border-amber-500/50 bg-card/70'
            : 'border-emerald-500/40 bg-card/70',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <StatusIcon
            className={cn('mt-0.5 h-4 w-4 shrink-0', INVENTORY_GATE_STATUS[gateStatus].className)}
            aria-hidden
          />
          <div className="min-w-0">
            <h3 id="inventory-confidence-gate-title" className="text-sm font-semibold">
              Inventory Confidence Gate
            </h3>
            <p data-testid="inventory-confidence-summary" className="text-xs text-muted-foreground">
              {passes} passed, {warnings.length} warning{warnings.length === 1 ? '' : 's'}, {blockers.length} blocker
              {blockers.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          data-testid="inventory-confidence-status"
          className={cn(
            blockers.length > 0 && 'border-destructive/60 bg-destructive/10 text-foreground',
            warnings.length > 0 && blockers.length === 0 && 'border-amber-500/60 bg-amber-500/10 text-foreground',
            blockers.length === 0 && warnings.length === 0 && 'border-emerald-500/60 bg-emerald-500/10 text-foreground',
          )}
        >
          {statusLabel}
        </Badge>
      </div>

      {blockers.length > 0 && (
        <ul data-testid="inventory-confidence-blockers" className="mt-2 space-y-1">
          {blockers.map((check) => (
            <li
              key={`${check.name}-${check.message}`}
              data-testid="inventory-confidence-blocker"
              className="text-xs text-foreground"
            >
              <span className="font-medium">{check.name}:</span> {check.message}
            </li>
          ))}
        </ul>
      )}

      {warnings.length > 0 && (
        <ul data-testid="inventory-confidence-warnings" className="mt-2 space-y-1">
          {warnings.map((check) => (
            <li
              key={`${check.name}-${check.message}`}
              data-testid="inventory-confidence-warning"
              className="text-xs text-foreground"
            >
              <span className="font-medium">{check.name}:</span> {check.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Barcode Scanner Dialog
// ---------------------------------------------------------------------------

function BarcodeScannerDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [scanResults, setScanResults] = useState<ScanResult[]>([]);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const { start, stop, processFrame, isScanning } = useBarcodeScanner({
    onScan: (result) => {
      setScanResults((prev) => [result, ...prev].slice(0, 20));
    },
  });

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
      start();
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to access camera');
      setCameraActive(false);
    }
  }, [start]);

  const stopCamera = useCallback(() => {
    stop();
    cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, [stop]);

  // Scan frames from the video
  useEffect(() => {
    if (!cameraActive || !isScanning) {
      return;
    }

    const scanLoop = () => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < video.HAVE_ENOUGH_DATA) {
        rafRef.current = requestAnimationFrame(scanLoop);
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        processFrame(imageData);
      }

      rafRef.current = requestAnimationFrame(scanLoop);
    };

    rafRef.current = requestAnimationFrame(scanLoop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [cameraActive, isScanning, processFrame]);

  // Cleanup when dialog closes
  useEffect(() => {
    if (!open) {
      stopCamera();
      setScanResults([]);
    }
  }, [open, stopCamera]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" data-testid="barcode-scanner-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ScanBarcode className="h-4 w-4 text-[var(--color-editor-accent)]" />
            Barcode Scanner
          </DialogTitle>
          <DialogDescription className="text-xs">
            Point your camera at a barcode or QR code to scan component data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Camera viewport */}
          <div className="relative rounded-md overflow-hidden bg-black aspect-video" data-testid="scanner-viewport">
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              playsInline
              muted
              data-testid="scanner-video"
            />
            <canvas ref={canvasRef} className="hidden" />
            {!cameraActive && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    void startCamera();
                  }}
                  data-testid="scanner-start-camera"
                >
                  <Video className="h-4 w-4 mr-1.5" />
                  Start Camera
                </Button>
              </div>
            )}
            {cameraActive && (
              <div className="absolute top-2 right-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 bg-black/50 hover:bg-black/70 text-white"
                  onClick={stopCamera}
                  data-testid="scanner-stop-camera"
                >
                  <VideoOff className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            {isScanning && cameraActive && (
              <div className="absolute bottom-2 left-2">
                <Badge className="bg-emerald-500/80 text-white text-[11px] animate-pulse">Scanning...</Badge>
              </div>
            )}
          </div>

          {cameraError && (
            <div
              className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-xs text-destructive"
              data-testid="scanner-error"
            >
              {cameraError}
            </div>
          )}

          {/* Scan results list */}
          <div className="space-y-1.5" data-testid="scanner-results">
            <h4 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Scan Results ({scanResults.length})
            </h4>
            {scanResults.length === 0 ? (
              <div className="text-[11px] text-muted-foreground py-2 text-center">No barcodes scanned yet.</div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {scanResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="rounded-md bg-muted/30 border border-border/50 px-2.5 py-1.5"
                    data-testid={`scan-result-${idx}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[11px] px-1 py-0 shrink-0">
                        {result.format}
                      </Badge>
                      <span className="text-[11px] font-mono text-foreground truncate">{result.rawValue}</span>
                    </div>
                    {result.parsedComponent && (
                      <div
                        className="mt-1 text-[11px] text-muted-foreground space-y-0.5"
                        data-testid={`scan-parsed-${idx}`}
                      >
                        <div>
                          <span className="text-[var(--color-editor-accent)]">Part:</span>{' '}
                          {result.parsedComponent.partNumber}
                        </div>
                        {result.parsedComponent.location && (
                          <div>
                            <span className="text-[var(--color-editor-accent)]">Location:</span>{' '}
                            {result.parsedComponent.location}
                          </div>
                        )}
                        {result.parsedComponent.quantity != null && (
                          <div>
                            <span className="text-[var(--color-editor-accent)]">Qty:</span>{' '}
                            {result.parsedComponent.quantity}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Print Labels Dialog
// ---------------------------------------------------------------------------

function PrintLabelsDialog({
  open,
  onOpenChange,
  bomItems,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bomItems: BomItem[];
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [labelSize, setLabelSize] = useState<string>('200');
  const [columns, setColumns] = useState<string>('3');
  const [previewItem, setPreviewItem] = useState<BomItem | null>(null);
  const [previewSvg, setPreviewSvg] = useState<string>('');

  // Reset selection when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedIds(new Set());
      setPreviewItem(null);
      setPreviewSvg('');
    }
  }, [open]);

  const toggleItem = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === bomItems.length) {
        return new Set();
      }
      return new Set(bomItems.map((b) => b.id));
    });
  }, [bomItems]);

  // Generate preview when an item is selected for preview
  const handlePreview = useCallback(
    (item: BomItem) => {
      setPreviewItem(item);
      const labelItem = bomToLabelItem(item);
      const options: QRLabelOptions = { size: parseInt(labelSize, 10), includeText: true };
      setPreviewSvg(generateLabelSVG(labelItem, options));
    },
    [labelSize],
  );

  const handlePrint = useCallback(() => {
    const selectedItems = bomItems.filter((b) => selectedIds.has(b.id)).map(bomToLabelItem);

    if (selectedItems.length === 0) {
      return;
    }

    const pageOptions: PrintPageOptions = {
      columns: parseInt(columns, 10),
      labelSize: parseInt(labelSize, 10),
    };

    const html = generatePrintPage(selectedItems, pageOptions);
    const printWindow = window.open('', '_blank', 'noopener,noreferrer');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
    }
  }, [bomItems, selectedIds, columns, labelSize]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="print-labels-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Printer className="h-4 w-4 text-[var(--color-editor-accent)]" />
            Print Inventory Labels
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select components to print QR labels for your storage bins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Label options */}
          <div className="flex gap-3.5" data-testid="label-options">
            <div className="flex-1">
              <Label className="text-[11px] text-muted-foreground">Label Size (px)</Label>
              <Select value={labelSize} onValueChange={setLabelSize}>
                <SelectTrigger
                  className="h-8.5 text-xs mt-1"
                  data-testid="label-size-select"
                  aria-label="Select label size"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="150">Small (150px)</SelectItem>
                  <SelectItem value="200">Medium (200px)</SelectItem>
                  <SelectItem value="300">Large (300px)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="text-[11px] text-muted-foreground">Columns</Label>
              <Select value={columns} onValueChange={setColumns}>
                <SelectTrigger
                  className="h-8.5 text-xs mt-1"
                  data-testid="label-columns-select"
                  aria-label="Select label print columns"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 columns</SelectItem>
                  <SelectItem value="3">3 columns</SelectItem>
                  <SelectItem value="4">4 columns</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Select all / count */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="select-all-labels"
                checked={selectedIds.size === bomItems.length && bomItems.length > 0}
                onCheckedChange={toggleAll}
                data-testid="label-select-all"
              />
              <Label htmlFor="select-all-labels" className="text-xs cursor-pointer">
                Select all
              </Label>
            </div>
            <span className="text-[11px] text-muted-foreground" data-testid="label-selected-count">
              {selectedIds.size} selected
            </span>
          </div>

          {/* Item checklist */}
          <div
            className="max-h-48 overflow-y-auto space-y-1 border border-border/50 rounded-md p-2"
            data-testid="label-item-list"
          >
            {bomItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/30 transition-colors"
                data-testid={`label-item-${String(item.id)}`}
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => {
                    toggleItem(item.id);
                  }}
                  data-testid={`label-check-${String(item.id)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.partNumber}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{item.description}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-[10px] px-2 shrink-0"
                  onClick={() => {
                    handlePreview(item);
                  }}
                  data-testid={`label-preview-${String(item.id)}`}
                >
                  Preview
                </Button>
              </div>
            ))}
          </div>

          {/* Label preview */}
          {previewItem && previewSvg && (
            <div className="space-y-1.5" data-testid="label-preview-area">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-semibold text-muted-foreground">Preview: {previewItem.partNumber}</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setPreviewItem(null);
                    setPreviewSvg('');
                  }}
                  data-testid="label-preview-close"
                  aria-label="Close label preview"
                  title="Close preview"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div
                className="flex items-center justify-center bg-white rounded-md p-2 border border-border/50"
                dangerouslySetInnerHTML={{ __html: sanitizeSvg(previewSvg) }}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onOpenChange(false);
            }}
            data-testid="label-cancel-btn"
          >
            Cancel
          </Button>
          <Button size="sm" onClick={handlePrint} disabled={selectedIds.size === 0} data-testid="label-print-btn">
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print {selectedIds.size} Label{selectedIds.size !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Location Group (unchanged from original)
// ---------------------------------------------------------------------------

interface LocationGroupProps {
  location: string;
  items: BomItem[];
  defaultOpen?: boolean;
  highlightedItemId?: string | null;
}

const LocationGroup = memo(function LocationGroup({
  location,
  items,
  defaultOpen = false,
  highlightedItemId = null,
}: LocationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={`location-group-${location}`}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-testid={`location-trigger-${location}`}
          className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs hover:bg-muted/50 transition-colors"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0" />}
          <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
          <span className="font-medium truncate">{location}</span>
          <Badge variant="outline" className="ml-auto text-[11px]" data-testid={`location-count-${location}`}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-5 space-y-1 pb-1.5" data-testid={`location-items-${location}`}>
          {items.map((item) => {
            const status = getStockStatus(item);
            const badgeProps = getStockBadgeProps(status);

            return (
              <div
                key={item.id}
                data-testid={`storage-item-${String(item.id)}`}
                data-part-id={String(item.id)}
                data-part-label={item.partNumber}
                className={cn(
                  'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] hover:bg-muted/30 transition-colors',
                  highlightedItemId === String(item.id) && 'bg-primary/10 ring-1 ring-primary/40',
                )}
              >
                <Package className="h-3 w-3 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" data-testid={`item-part-${String(item.id)}`}>
                    {item.partNumber}
                  </div>
                  <div className="text-muted-foreground truncate" data-testid={`item-desc-${String(item.id)}`}>
                    {item.description}
                  </div>
                  <div
                    className="mt-1 flex min-w-0 flex-wrap items-center gap-1"
                    data-testid={`item-trust-${String(item.id)}`}
                  >
                    {getInventoryTrustMarkers(item).map((marker) => (
                      <Badge
                        key={marker.id}
                        variant="outline"
                        title={marker.title}
                        className={cn(
                          'max-w-full shrink-0 px-1.5 py-0 text-[10px] leading-4',
                          TRUST_MARKER_CLASS[marker.tone],
                        )}
                        data-testid={`item-trust-marker-${String(item.id)}-${marker.id}`}
                      >
                        {marker.label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div
                  className="text-right shrink-0 text-[11px] text-muted-foreground"
                  data-testid={`item-qty-${String(item.id)}`}
                >
                  {item.quantityOnHand != null && item.minimumStock != null
                    ? `${String(item.quantityOnHand)} / ${String(item.minimumStock)}`
                    : '--'}
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[11px] px-1.5 py-0 shrink-0', badgeProps.className)}
                  data-testid={`item-status-${String(item.id)}`}
                >
                  {badgeProps.label}
                </Badge>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
});

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

/**
 * StorageManagerPanel — shows BOM items organized by storage location with stock level indicators.
 *
 * Features:
 * - Inventory Health Score card (powered by InventoryHealthAnalyzer)
 * - Groups BOM items by storageLocation (null => "Unassigned")
 * - Collapsible location sections with item count
 * - Stock warning badges: green (OK), yellow (Low), red (Critical), gray (Not tracked)
 * - Search/filter by part number or location
 * - Barcode scanner dialog for scanning component labels
 * - Print labels dialog for generating and printing QR inventory labels
 */
const StorageManagerPanel = memo(function StorageManagerPanel({
  projectId: _projectId,
  className,
}: StorageManagerPanelProps) {
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

  const { bom: bomItems, deleteBomItem, updateBomItem } = useBom();
  const { toast } = useToast();
  const isLoading = false;

  const inventoryPrecheckData = useMemo(() => buildInventoryReviewData(bomItems), [bomItems]);
  const inventoryPrecheck = useMemo(
    () => runExportPrecheck('inventory-review', inventoryPrecheckData),
    [inventoryPrecheckData],
  );
  const hasInventoryBlockers = inventoryPrecheck.blockers.length > 0;

  // Compute health report
  const healthReport = useMemo(() => {
    const analyzer = new InventoryHealthAnalyzer();
    const inventoryItems = bomItems.map(bomToInventoryItem);
    return analyzer.analyze(inventoryItems);
  }, [bomItems]);

  const filteredAndGrouped = useMemo(() => {
    const lowerSearch = search.toLowerCase().trim();
    const filtered = lowerSearch
      ? bomItems.filter(
          (item) =>
            item.partNumber.toLowerCase().includes(lowerSearch) ||
            item.description.toLowerCase().includes(lowerSearch) ||
            (item.storageLocation ?? '').toLowerCase().includes(lowerSearch),
        )
      : bomItems;

    const groups = new Map<string, BomItem[]>();
    for (const item of filtered) {
      const loc = item.storageLocation ?? 'Unassigned';
      const existing = groups.get(loc);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(loc, [item]);
      }
    }

    // Sort groups: named locations first (alphabetically), "Unassigned" last
    const sorted = Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === 'Unassigned') {
        return 1;
      }
      if (b === 'Unassigned') {
        return -1;
      }
      return a.localeCompare(b);
    });

    return sorted;
  }, [bomItems, search]);

  const totalItems = bomItems.length;
  const lowStockCount = bomItems.filter((item) => {
    const status = getStockStatus(item);
    return status === 'low' || status === 'critical';
  }).length;

  const findRadialItem = useCallback(
    (detail: RadialCommandEventDetail): BomItem | undefined => {
      const targetId = detail.context.targetId;
      if (!targetId) {
        return undefined;
      }

      return bomItems.find((item) => String(item.id) === String(targetId));
    },
    [bomItems],
  );

  const focusInventoryItem = useCallback((item: BomItem) => {
    setHighlightedItemId(String(item.id));
    setSearch(item.partNumber);
  }, []);

  const handleAiInventoryPlan = useCallback(
    (detail: RadialCommandEventDetail, item: BomItem | undefined) => {
      const delivery = getRadialAiPromptDelivery(detail);
      const deliveryVerb = getRadialAiDeliveryVerb(delivery);
      const targetItems = item ? [item] : bomItems.slice(0, 8);
      const itemLines = targetItems.map((part) => {
        const stockStatus = getStockStatus(part);
        return `${part.partNumber}: needed ${String(part.quantity)}, on hand ${String(part.quantityOnHand ?? 'unknown')}, min ${String(part.minimumStock ?? 'unset')}, bin ${part.storageLocation ?? 'Unassigned'}, status ${stockStatus}`;
      });
      const gateLines = inventoryPrecheck.checks
        .filter((check) => check.status !== 'pass')
        .slice(0, 8)
        .map((check) => `${check.status.toUpperCase()}: ${check.name} - ${check.message}`);
      const healthLines = [
        `Health score: ${String(healthReport.overallScore)} (${healthReport.grade})`,
        `Total inventory lines: ${String(totalItems)}`,
        `Low or critical stock lines: ${String(lowStockCount)}`,
        `Hard blockers: ${String(inventoryPrecheck.blockers.length)}`,
        `Warnings: ${String(inventoryPrecheck.warnings.length)}`,
      ];
      const sections: RadialAiPromptSection[] = [
        {
          title: 'Inventory health',
          lines: healthLines,
        },
        {
          title: 'Clicked or representative parts',
          lines: itemLines.length > 0 ? itemLines : ['No inventory lines are available.'],
        },
        {
          title: 'Inventory confidence gate',
          lines: gateLines.length > 0 ? gateLines : ['Inventory confidence gate is clear.'],
        },
        {
          title: 'Health recommendations',
          lines:
            healthReport.recommendations.length > 0
              ? healthReport.recommendations
                  .slice(0, 6)
                  .map(
                    (recommendation) =>
                      `${recommendation.priority}: ${recommendation.action} (${recommendation.impact})`,
                  )
              : ['No inventory recommendations are currently visible.'],
        },
      ];

      runRadialAiCommand({
        intent: 'inventory_plan',
        intro:
          'Review this ProtoPulse inventory state like a practical parts-bin manager. Focus on stock risk, missing counts, label/bin hygiene, procurement follow-up, and the next safe inventory action.',
        summary: `Inventory plan: ${String(totalItems)} lines, ${String(lowStockCount)} low-stock lines, grade ${healthReport.grade}.`,
        historyLabel: item ? `Inventory plan: ${item.partNumber}` : 'Inventory plan',
        context: detail.context,
        delivery,
        targetDetails: [
          `Project id: ${String(_projectId)}`,
          item ? `Selected part: ${item.partNumber}` : 'Selected part: none',
          `Inventory grade: ${healthReport.grade}`,
        ],
        sections,
        finalInstruction:
          'Give Tyler a concise inventory action plan: what to count first, what to label or move, what to reorder, and which uncertainty could block a build.',
      });
      toast({
        title: `AI Inventory Plan ${deliveryVerb}`,
        description:
          delivery === 'send-now'
            ? 'Sent inventory readiness prompt to AI chat.'
            : 'Drafted inventory readiness prompt in AI chat.',
      });
    },
    [_projectId, bomItems, healthReport, inventoryPrecheck, lowStockCount, toast, totalItems],
  );

  const handleRadialCommand = useCallback(
    (detail: RadialCommandEventDetail): boolean => {
      if (detail.source !== 'radial-menu' || detail.context.view !== 'inventory') {
        return false;
      }

      const item = findRadialItem(detail);

      switch (detail.commandId) {
        case 'add_inventory_item':
          setScannerOpen(true);
          toast({ title: 'Inventory intake opened', description: 'Scan a label or QR code to add a physical part.' });
          return true;
        case 'ai_inventory_plan':
          if (item) {
            focusInventoryItem(item);
          }
          handleAiInventoryPlan(detail, item);
          return true;
        case 'find_alternates':
          if (!item) {
            toast({
              title: 'Pick a part row',
              description: 'Right-click a specific inventory row to search alternates.',
            });
            return true;
          }
          focusInventoryItem(item);
          toast({
            title: 'Alternates cue ready',
            description: `${item.partNumber} is filtered for substitute review.`,
          });
          return true;
        case 'inspect_part':
          if (!item) {
            toast({
              title: 'Pick a part row',
              description: 'Right-click an inventory row to inspect its stock metadata.',
            });
            return true;
          }
          focusInventoryItem(item);
          toast({ title: 'Part centered', description: `${item.partNumber} inventory metadata is highlighted.` });
          return true;
        case 'stock_audit':
          if (item) {
            focusInventoryItem(item);
            toast({ title: 'Stock audit focused', description: `${item.partNumber} is ready for count review.` });
          } else {
            setSearch('');
            setHighlightedItemId(null);
            toast({
              title: 'Stock audit ready',
              description: `${String(lowStockCount)} low-stock line(s) need review.`,
            });
          }
          return true;
        case 'remove_inventory_item':
          if (!item) {
            toast({ title: 'Pick a part row', description: 'Right-click an inventory row before removing it.' });
            return true;
          }
          deleteBomItem(item.id);
          toast({
            title: 'Inventory item removed',
            description: `${item.partNumber} was removed from the BOM inventory list.`,
          });
          return true;
        case 'edit_inventory_item':
          if (!item) {
            toast({
              title: 'Pick a part row',
              description: 'Right-click an inventory row before editing stock fields.',
            });
            return true;
          }
          updateBomItem(item.id, {
            quantityOnHand: item.quantityOnHand ?? item.quantity,
            minimumStock: item.minimumStock ?? Math.max(1, Math.ceil(item.quantity / 2)),
            storageLocation: item.storageLocation ?? 'Unassigned',
          });
          focusInventoryItem(item);
          toast({
            title: 'Inventory fields staged',
            description: `${item.partNumber} stock tracking fields were filled for review.`,
          });
          return true;
        case 'print_inventory_label':
          if (item) {
            focusInventoryItem(item);
          }
          setPrintOpen(true);
          toast({
            title: 'Inventory labels opened',
            description: item
              ? `${item.partNumber} is centered before printing labels.`
              : 'Choose inventory rows to print QR bin labels.',
          });
          return true;
        default:
          return false;
      }
    },
    [deleteBomItem, findRadialItem, focusInventoryItem, handleAiInventoryPlan, lowStockCount, toast, updateBomItem],
  );

  useEffect(() => {
    const handleCommandEvent = (event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      if (!detail) {
        return;
      }
      if (handleRadialCommand(detail)) {
        detail.handled = true;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
  }, [handleRadialCommand]);

  return (
    <Card className={cn('border-border/50', className)} data-testid="storage-manager-panel">
      <CardHeader className="pb-2.5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400" />
            Storage Manager
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => {
                setScannerOpen(true);
              }}
              data-testid="storage-scan-btn"
            >
              <ScanBarcode className="h-3.5 w-3.5 mr-1.5" />
              Scan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => {
                setPrintOpen(true);
              }}
              disabled={hasInventoryBlockers}
              aria-describedby={hasInventoryBlockers ? 'inventory-confidence-gate-title' : undefined}
              title={hasInventoryBlockers ? inventoryPrecheck.blockers[0] : undefined}
              data-testid="storage-print-btn"
            >
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Labels
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
          <span data-testid="storage-total-count">{totalItems} items</span>
          {lowStockCount > 0 && (
            <Badge
              variant="outline"
              className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-[10px] px-1.5 py-0"
              data-testid="storage-low-stock-count"
            >
              {lowStockCount} low stock
            </Badge>
          )}
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter by part number or location..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
            }}
            className="h-8.5 pl-9 text-xs"
            data-testid="storage-search-input"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-3">
        <InventoryConfidenceGate precheck={inventoryPrecheck} />

        {/* Inventory Health Card */}
        {!isLoading && bomItems.length > 0 && <InventoryHealthCard report={healthReport} />}

        {isLoading && (
          <div className="py-8 text-center text-xs text-muted-foreground" data-testid="storage-loading">
            Loading inventory...
          </div>
        )}

        {!isLoading && filteredAndGrouped.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground" data-testid="storage-empty">
            {search ? 'No items match your search.' : 'No BOM items to display.'}
          </div>
        )}

        {!isLoading && filteredAndGrouped.length > 0 && (
          <div className="space-y-0.5" data-testid="storage-locations-list">
            {filteredAndGrouped.map(([location, items]) => (
              <LocationGroup
                key={location}
                location={location}
                items={items}
                defaultOpen={filteredAndGrouped.length <= 3}
                highlightedItemId={highlightedItemId}
              />
            ))}
          </div>
        )}
      </CardContent>

      {/* Dialogs */}
      <BarcodeScannerDialog open={scannerOpen} onOpenChange={setScannerOpen} />
      <PrintLabelsDialog open={printOpen} onOpenChange={setPrintOpen} bomItems={bomItems} />
    </Card>
  );
});

export default StorageManagerPanel;
