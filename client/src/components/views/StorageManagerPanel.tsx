import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import { sanitizeSvg } from '@/lib/svg-sanitize';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
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

import type { BomItem } from '@shared/schema';
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
  critical: { icon: AlertTriangle, className: 'text-destructive', bgClassName: 'bg-destructive/15 border-destructive/30' },
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
        <circle
          cx="40"
          cy="40"
          r="36"
          fill="none"
          stroke="currentColor"
          className="text-muted/30"
          strokeWidth="6"
        />
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
        <span
          className={cn('text-2xl font-bold', GRADE_COLORS[grade])}
          data-testid="health-score-grade"
        >
          {grade}
        </span>
        <span
          className="text-[10px] text-muted-foreground"
          data-testid="health-score-value"
        >
          {score}/100
        </span>
      </div>
    </div>
  );
}

function FactorBar({ factor }: { factor: HealthFactor }) {
  return (
    <div className="space-y-0.5" data-testid={`health-factor-${factor.name.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-center justify-between text-[10px]">
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
      <span className="text-[10px] text-foreground leading-relaxed">{issue.message}</span>
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
      <Badge variant="outline" className={cn('text-[9px] px-1 py-0 shrink-0 mt-0.5', config.badgeClass)}>
        {recommendation.priority}
      </Badge>
      <div className="min-w-0">
        <div className="text-[10px] font-medium text-foreground">{recommendation.action}</div>
        <div className="text-[9px] text-muted-foreground">{recommendation.impact}</div>
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
                <Activity className="h-3.5 w-3.5 text-[#00F0FF]" />
                Inventory Health
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => { setShowDetails((prev) => !prev); }}
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
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Issues</h4>
                <div className="space-y-1">
                  {report.issues.map((issue, idx) => (
                    <IssueItem key={idx} issue={issue} />
                  ))}
                </div>
              </div>
            )}

            {report.recommendations.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
      streamRef.current.getTracks().forEach((track) => { track.stop(); });
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
            <ScanBarcode className="h-4 w-4 text-[#00F0FF]" />
            Barcode Scanner
          </DialogTitle>
          <DialogDescription className="text-xs">
            Point your camera at a barcode or QR code to scan component data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Camera viewport */}
          <div
            className="relative rounded-md overflow-hidden bg-black aspect-video"
            data-testid="scanner-viewport"
          >
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
                  onClick={() => { void startCamera(); }}
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
                <Badge className="bg-emerald-500/80 text-white text-[9px] animate-pulse">
                  Scanning...
                </Badge>
              </div>
            )}
          </div>

          {cameraError && (
            <div className="rounded-md bg-destructive/15 border border-destructive/30 px-3 py-2 text-xs text-destructive" data-testid="scanner-error">
              {cameraError}
            </div>
          )}

          {/* Scan results list */}
          <div className="space-y-1.5" data-testid="scanner-results">
            <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Scan Results ({scanResults.length})
            </h4>
            {scanResults.length === 0 ? (
              <div className="text-[10px] text-muted-foreground py-2 text-center">
                No barcodes scanned yet.
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {scanResults.map((result, idx) => (
                  <div
                    key={idx}
                    className="rounded-md bg-muted/30 border border-border/50 px-2.5 py-1.5"
                    data-testid={`scan-result-${idx}`}
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px] px-1 py-0 shrink-0">
                        {result.format}
                      </Badge>
                      <span className="text-[10px] font-mono text-foreground truncate">{result.rawValue}</span>
                    </div>
                    {result.parsedComponent && (
                      <div className="mt-1 text-[9px] text-muted-foreground space-y-0.5" data-testid={`scan-parsed-${idx}`}>
                        <div>
                          <span className="text-[#00F0FF]">Part:</span> {result.parsedComponent.partNumber}
                        </div>
                        {result.parsedComponent.location && (
                          <div>
                            <span className="text-[#00F0FF]">Location:</span> {result.parsedComponent.location}
                          </div>
                        )}
                        {result.parsedComponent.quantity != null && (
                          <div>
                            <span className="text-[#00F0FF]">Qty:</span> {result.parsedComponent.quantity}
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
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

  const toggleItem = useCallback((id: number) => {
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
  const handlePreview = useCallback((item: BomItem) => {
    setPreviewItem(item);
    const labelItem = bomToLabelItem(item);
    const options: QRLabelOptions = { size: parseInt(labelSize, 10), includeText: true };
    setPreviewSvg(generateLabelSVG(labelItem, options));
  }, [labelSize]);

  const handlePrint = useCallback(() => {
    const selectedItems = bomItems
      .filter((b) => selectedIds.has(b.id))
      .map(bomToLabelItem);

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
            <Printer className="h-4 w-4 text-[#00F0FF]" />
            Print Inventory Labels
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select components to print QR labels for your storage bins.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Label options */}
          <div className="flex gap-3" data-testid="label-options">
            <div className="flex-1">
              <Label className="text-[10px] text-muted-foreground">Label Size (px)</Label>
              <Select value={labelSize} onValueChange={setLabelSize}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="label-size-select">
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
              <Label className="text-[10px] text-muted-foreground">Columns</Label>
              <Select value={columns} onValueChange={setColumns}>
                <SelectTrigger className="h-8 text-xs mt-1" data-testid="label-columns-select">
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
            <span className="text-[10px] text-muted-foreground" data-testid="label-selected-count">
              {selectedIds.size} selected
            </span>
          </div>

          {/* Item checklist */}
          <div className="max-h-48 overflow-y-auto space-y-1 border border-border/50 rounded-md p-2" data-testid="label-item-list">
            {bomItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-muted/30 transition-colors"
                data-testid={`label-item-${String(item.id)}`}
              >
                <Checkbox
                  checked={selectedIds.has(item.id)}
                  onCheckedChange={() => { toggleItem(item.id); }}
                  data-testid={`label-check-${String(item.id)}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{item.partNumber}</div>
                  <div className="text-[10px] text-muted-foreground truncate">{item.description}</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[9px] px-1.5 shrink-0"
                  onClick={() => { handlePreview(item); }}
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
                <h4 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Preview: {previewItem.partNumber}
                </h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0"
                  onClick={() => { setPreviewItem(null); setPreviewSvg(''); }}
                  data-testid="label-preview-close"
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
            onClick={() => { onOpenChange(false); }}
            data-testid="label-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            disabled={selectedIds.size === 0}
            data-testid="label-print-btn"
          >
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
}

const LocationGroup = memo(function LocationGroup({ location, items, defaultOpen = false }: LocationGroupProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} data-testid={`location-group-${location}`}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          data-testid={`location-trigger-${location}`}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
        >
          {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
          <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
          <span className="font-medium">{location}</span>
          <Badge variant="outline" className="ml-auto text-[10px]" data-testid={`location-count-${location}`}>
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="ml-6 space-y-1 pb-2" data-testid={`location-items-${location}`}>
          {items.map((item) => {
            const status = getStockStatus(item);
            const badgeProps = getStockBadgeProps(status);

            return (
              <div
                key={item.id}
                data-testid={`storage-item-${String(item.id)}`}
                className="flex items-center gap-3 rounded-md px-3 py-1.5 text-xs hover:bg-muted/30 transition-colors"
              >
                <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate" data-testid={`item-part-${String(item.id)}`}>
                    {item.partNumber}
                  </div>
                  <div className="text-muted-foreground truncate" data-testid={`item-desc-${String(item.id)}`}>
                    {item.description}
                  </div>
                </div>
                <div className="text-right shrink-0 text-muted-foreground" data-testid={`item-qty-${String(item.id)}`}>
                  {item.quantityOnHand != null && item.minimumStock != null
                    ? `${String(item.quantityOnHand)} / ${String(item.minimumStock)}`
                    : '--'}
                </div>
                <Badge
                  variant="outline"
                  className={cn('text-[10px] px-1.5 py-0 shrink-0', badgeProps.className)}
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
const StorageManagerPanel = memo(function StorageManagerPanel({ projectId, className }: StorageManagerPanelProps) {
  const [search, setSearch] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);

  const { data: bomItems = [], isLoading } = useQuery<BomItem[]>({
    queryKey: ['/api/projects', projectId, 'bom'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/projects/${String(projectId)}/bom`);
      const json = (await res.json()) as { data: BomItem[] };
      return json.data;
    },
  });

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
      if (a === 'Unassigned') { return 1; }
      if (b === 'Unassigned') { return -1; }
      return a.localeCompare(b);
    });

    return sorted;
  }, [bomItems, search]);

  const totalItems = bomItems.length;
  const lowStockCount = bomItems.filter((item) => {
    const status = getStockStatus(item);
    return status === 'low' || status === 'critical';
  }).length;

  return (
    <Card className={cn('border-border/50', className)} data-testid="storage-manager-panel">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MapPin className="h-4 w-4 text-cyan-400" />
            Storage Manager
          </CardTitle>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setScannerOpen(true); }}
              data-testid="storage-scan-btn"
            >
              <ScanBarcode className="h-3.5 w-3.5 mr-1" />
              Scan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => { setPrintOpen(true); }}
              data-testid="storage-print-btn"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Labels
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
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
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Filter by part number or location..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); }}
            className="h-8 pl-8 text-xs"
            data-testid="storage-search-input"
          />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {/* Inventory Health Card */}
        {!isLoading && bomItems.length > 0 && (
          <InventoryHealthCard report={healthReport} />
        )}

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
          <div className="space-y-1" data-testid="storage-locations-list">
            {filteredAndGrouped.map(([location, items]) => (
              <LocationGroup key={location} location={location} items={items} defaultOpen={filteredAndGrouped.length <= 3} />
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
