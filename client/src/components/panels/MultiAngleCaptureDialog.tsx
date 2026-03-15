/**
 * MultiAngleCaptureDialog — Guides the user through capturing additional
 * photos from specific angles when component identification confidence is low.
 *
 * Displays which angles are recommended, lets the user capture each one,
 * and merges all results into a single higher-confidence identification.
 *
 * @module components/panels/MultiAngleCaptureDialog
 */

import { useCallback, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ComponentIdResult } from '@/components/panels/CameraComponentId';
import {
  suggestAdditionalAngles,
  mergeMultiAngleResults,
  getAngleInfo,
  ANGLE_LABELS,
} from '@/lib/multi-angle-capture';
import type {
  PhotoAngle,
  PhotoAngleRequest,
  AngleResult,
} from '@/lib/multi-angle-capture';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MultiAngleCaptureDialogProps {
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the dialog should close. */
  onOpenChange: (open: boolean) => void;
  /** The initial low-confidence identification result. */
  initialResult: ComponentIdResult;
  /** The initial captured image data URL. */
  initialImageData: string;
  /** The angle of the initial capture, if known. */
  initialAngle?: PhotoAngle;
  /** Called to identify a captured image. Returns the AI result. */
  onIdentify: (imageData: string, context?: string) => Promise<ComponentIdResult | null>;
  /** Called with the final merged result when the user accepts. */
  onAccept: (result: ComponentIdResult) => void;
  /** Optional component type override for angle suggestions. */
  componentType?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MultiAngleCaptureDialog({
  open,
  onOpenChange,
  initialResult,
  initialImageData,
  initialAngle = 'top',
  onIdentify,
  onAccept,
  componentType,
}: MultiAngleCaptureDialogProps) {
  // Track all angle results
  const [angleResults, setAngleResults] = useState<AngleResult[]>([
    { angle: initialAngle, imageData: initialImageData, result: initialResult },
  ]);
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [streamActive, setStreamActive] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Compute suggestions based on what we already have
  const capturedAngles = angleResults.map((r) => r.angle);
  const suggestions = suggestAdditionalAngles(
    initialResult,
    componentType,
    capturedAngles,
  );

  const currentSuggestion: PhotoAngleRequest | undefined = suggestions[currentAngleIndex];
  const mergedResult = mergeMultiAngleResults(angleResults);
  const totalCaptured = angleResults.length;

  // -------------------------------------------------------------------------
  // Camera controls
  // -------------------------------------------------------------------------

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setStreamActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      return;
    }
    setIsCapturing(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setStreamActive(true);
    } catch {
      setIsCapturing(false);
    }
  }, []);

  const captureFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
    stopStream();
    setIsCapturing(false);
  }, [stopStream]);

  // -------------------------------------------------------------------------
  // Identification
  // -------------------------------------------------------------------------

  const identifyCapture = useCallback(async () => {
    if (!capturedImage || !currentSuggestion) {
      return;
    }
    setIsIdentifying(true);
    const base64 = capturedImage.replace(/^data:image\/\w+;base64,/, '');
    const context = `Additional ${ANGLE_LABELS[currentSuggestion.angle]} photo for component identification. ${currentSuggestion.instruction}`;

    try {
      const result = await onIdentify(base64, context);
      const newAngleResult: AngleResult = {
        angle: currentSuggestion.angle,
        imageData: capturedImage,
        result,
      };
      setAngleResults((prev) => [...prev, newAngleResult]);
      setCapturedImage(null);
      // Move to next suggestion
      setCurrentAngleIndex((prev) => prev + 1);
    } finally {
      setIsIdentifying(false);
    }
  }, [capturedImage, currentSuggestion, onIdentify]);

  // -------------------------------------------------------------------------
  // Actions
  // -------------------------------------------------------------------------

  const handleAccept = useCallback(() => {
    if (mergedResult) {
      onAccept(mergedResult);
      onOpenChange(false);
    }
  }, [mergedResult, onAccept, onOpenChange]);

  const handleClose = useCallback(() => {
    stopStream();
    onOpenChange(false);
  }, [stopStream, onOpenChange]);

  const handleRetake = useCallback(() => {
    setCapturedImage(null);
    void startCamera();
  }, [startCamera]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const confidenceColor = mergedResult?.confidence === 'high'
    ? 'text-green-400'
    : mergedResult?.confidence === 'medium'
      ? 'text-yellow-400'
      : 'text-red-400';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="max-w-lg bg-zinc-950 border-zinc-800"
        data-testid="multi-angle-dialog"
      >
        <DialogHeader>
          <DialogTitle
            className="text-zinc-100"
            data-testid="multi-angle-dialog-title"
          >
            Additional Photos Needed
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4" data-testid="multi-angle-content">
          {/* Progress indicator */}
          <div className="flex items-center gap-2" data-testid="angle-progress">
            {angleResults.map((ar) => {
              const info = getAngleInfo(ar.angle);
              return (
                <Badge
                  key={ar.angle}
                  className="bg-green-900/50 text-green-300 border-green-700 text-xs"
                  data-testid={`angle-badge-${ar.angle}`}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {info.label}
                </Badge>
              );
            })}
            {suggestions.slice(currentAngleIndex).map((s) => {
              const info = getAngleInfo(s.angle);
              return (
                <Badge
                  key={s.angle}
                  variant="outline"
                  className="text-zinc-400 text-xs"
                  data-testid={`angle-badge-pending-${s.angle}`}
                >
                  {info.label}
                </Badge>
              );
            })}
          </div>

          {/* Current angle instruction */}
          {currentSuggestion && !isCapturing && !capturedImage && (
            <div
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              data-testid="angle-instruction"
            >
              <div className="flex items-center gap-2 mb-2">
                <ChevronRight className="h-4 w-4 text-[#00F0FF]" />
                <span className="text-sm font-medium text-zinc-200">
                  {getAngleInfo(currentSuggestion.angle).label}
                </span>
              </div>
              <p className="text-sm text-zinc-400 mb-2">
                {currentSuggestion.instruction}
              </p>
              <p className="text-xs text-zinc-500 italic">
                {currentSuggestion.reason}
              </p>
              <Button
                onClick={() => void startCamera()}
                className="mt-3 bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
                size="sm"
                data-testid="button-start-angle-capture"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture {getAngleInfo(currentSuggestion.angle).label}
              </Button>
            </div>
          )}

          {/* Camera stream */}
          {streamActive && (
            <div className="flex flex-col gap-2" data-testid="angle-camera-stream">
              <div className="relative overflow-hidden rounded-lg border border-zinc-800">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full rounded-lg"
                  data-testid="angle-camera-video"
                />
              </div>
              <Button
                onClick={captureFrame}
                className="bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
                size="sm"
                data-testid="button-angle-capture"
              >
                <Camera className="mr-2 h-4 w-4" />
                Capture
              </Button>
            </div>
          )}

          {/* Captured image preview */}
          {capturedImage && (
            <div className="flex flex-col gap-2" data-testid="angle-captured-preview">
              <div className="overflow-hidden rounded-lg border border-zinc-800">
                <img
                  src={capturedImage}
                  alt={`Captured ${currentSuggestion?.angle ?? 'component'} view`}
                  className="w-full rounded-lg"
                  data-testid="angle-captured-image"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetake}
                  disabled={isIdentifying}
                  className="flex-1"
                  data-testid="button-angle-retake"
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Retake
                </Button>
                <Button
                  size="sm"
                  onClick={() => void identifyCapture()}
                  disabled={isIdentifying}
                  className="flex-1 bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
                  data-testid="button-angle-identify"
                >
                  {isIdentifying ? (
                    <>
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <ChevronRight className="mr-1 h-3 w-3" />
                      Analyze
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* No more suggestions — show merged result */}
          {!currentSuggestion && !isCapturing && !capturedImage && mergedResult && (
            <div
              className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
              data-testid="merged-result-summary"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-zinc-200">
                  Merged Identification
                </span>
                <span className={cn('text-xs font-medium', confidenceColor)} data-testid="merged-confidence">
                  {mergedResult.confidence.charAt(0).toUpperCase() + mergedResult.confidence.slice(1)} Confidence
                </span>
              </div>
              <p className="text-sm text-zinc-300" data-testid="merged-component-type">
                {mergedResult.componentType}
              </p>
              {mergedResult.partNumber && (
                <p className="text-xs text-zinc-400" data-testid="merged-part-number">
                  Part: {mergedResult.partNumber}
                </p>
              )}
              {mergedResult.manufacturer && (
                <p className="text-xs text-zinc-400" data-testid="merged-manufacturer">
                  Manufacturer: {mergedResult.manufacturer}
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                Based on {totalCaptured} photo{totalCaptured !== 1 ? 's' : ''} from different angles.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            size="sm"
            data-testid="button-multi-angle-cancel"
          >
            <X className="mr-1 h-3 w-3" />
            Cancel
          </Button>
          {mergedResult && (
            <Button
              onClick={handleAccept}
              size="sm"
              className="bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
              data-testid="button-multi-angle-accept"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Accept Result
            </Button>
          )}
        </DialogFooter>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" data-testid="angle-capture-canvas" />
      </DialogContent>
    </Dialog>
  );
}
