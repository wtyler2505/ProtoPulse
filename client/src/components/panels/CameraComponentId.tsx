/**
 * CameraComponentId — Camera-based electronic component identification panel.
 *
 * Uses the browser's MediaDevices API to capture a photo of an electronic
 * component, sends the base64 image to the AI for identification, and
 * displays structured results (type, package, part number, confidence, etc.).
 * Includes an "Add to BOM" action that dispatches an add_bom_item request
 * through the chat system.
 *
 * @module components/panels/CameraComponentId
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, RefreshCw, Search, Plus, AlertTriangle, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Structured result from component identification analysis.
 */
export interface ComponentIdResult {
  componentType: string;
  packageType: string;
  partNumber: string | null;
  manufacturer: string | null;
  pinCount: number | null;
  confidence: 'high' | 'medium' | 'low';
  description: string;
  specifications: string[];
  suggestedBom: {
    partNumber: string;
    manufacturer: string;
    description: string;
    category: string;
    unitPrice: number | null;
  } | null;
  notes: string | null;
}

/**
 * Camera state machine phases.
 */
type CameraState =
  | 'idle'
  | 'requesting'
  | 'streaming'
  | 'captured'
  | 'identifying'
  | 'result'
  | 'error';

export interface CameraComponentIdProps {
  /** Callback to send an identification request to the AI chat system. */
  onIdentify?: (imageData: string, context?: string) => Promise<ComponentIdResult | null>;
  /** Callback to add identified component to the BOM. */
  onAddToBom?: (bom: NonNullable<ComponentIdResult['suggestedBom']>) => void;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Confidence level to visual styling map.
 */
const confidenceConfig: Record<
  ComponentIdResult['confidence'],
  { label: string; className: string }
> = {
  high: { label: 'High Confidence', className: 'bg-green-900/50 text-green-300 border-green-700' },
  medium: {
    label: 'Medium Confidence',
    className: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
  },
  low: { label: 'Low Confidence', className: 'bg-red-900/50 text-red-300 border-red-700' },
};

export function CameraComponentId({ onIdentify, onAddToBom, className }: CameraComponentIdProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraState, setCameraState] = useState<CameraState>('idle');
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [result, setResult] = useState<ComponentIdResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Stop all active media tracks and clean up the stream reference.
   */
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
  }, []);

  /**
   * Clean up media stream on unmount.
   */
  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  /**
   * Request camera access and start the video stream.
   */
  const startCamera = useCallback(async () => {
    // Check for mediaDevices API availability
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState('error');
      setErrorMessage(
        'Camera API is not available in this browser. Please use a modern browser with HTTPS.',
      );
      return;
    }

    setCameraState('requesting');
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraState('streaming');
    } catch (err) {
      setCameraState('error');

      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setErrorMessage(
              'Camera permission was denied. Please allow camera access in your browser settings and try again.',
            );
            break;
          case 'NotFoundError':
            setErrorMessage(
              'No camera found on this device. Please connect a camera and try again.',
            );
            break;
          case 'NotReadableError':
            setErrorMessage(
              'Camera is already in use by another application. Please close other apps using the camera.',
            );
            break;
          default:
            setErrorMessage(`Camera error: ${err.message}`);
        }
      } else {
        setErrorMessage('An unexpected error occurred while accessing the camera.');
      }
    }
  }, []);

  /**
   * Capture the current video frame to a canvas and convert to base64.
   */
  const captureImage = useCallback(() => {
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
    setCameraState('captured');

    // Stop the camera stream after capture
    stopStream();
  }, [stopStream]);

  /**
   * Retake: discard captured image and restart camera.
   */
  const retake = useCallback(() => {
    setCapturedImage(null);
    setResult(null);
    setCameraState('idle');
    void startCamera();
  }, [startCamera]);

  /**
   * Send captured image to AI for identification.
   */
  const identifyComponent = useCallback(async () => {
    if (!capturedImage || !onIdentify) {
      return;
    }

    setCameraState('identifying');

    // Strip the data URL prefix to get raw base64
    const base64Data = capturedImage.replace(/^data:image\/\w+;base64,/, '');

    try {
      const identificationResult = await onIdentify(base64Data);
      if (identificationResult) {
        setResult(identificationResult);
        setCameraState('result');
      } else {
        setCameraState('error');
        setErrorMessage('Could not identify the component. Try capturing a clearer image.');
      }
    } catch {
      setCameraState('error');
      setErrorMessage('An error occurred during identification. Please try again.');
    }
  }, [capturedImage, onIdentify]);

  /**
   * Add the identified component to the BOM.
   */
  const handleAddToBom = useCallback(() => {
    if (result?.suggestedBom && onAddToBom) {
      onAddToBom(result.suggestedBom);
    }
  }, [result, onAddToBom]);

  /**
   * Reset all state back to initial.
   */
  const reset = useCallback(() => {
    stopStream();
    setCapturedImage(null);
    setResult(null);
    setErrorMessage(null);
    setCameraState('idle');
  }, [stopStream]);

  return (
    <div
      className={cn('flex flex-col gap-4 p-4', className)}
      data-testid="camera-component-id"
    >
      <div className="flex items-center justify-between" data-testid="camera-header">
        <h3 className="text-lg font-semibold text-zinc-100">Component Identification</h3>
        {cameraState !== 'idle' && (
          <Button
            variant="ghost"
            size="sm"
            onClick={reset}
            data-testid="button-reset"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Idle state — prompt to start camera */}
      {cameraState === 'idle' && (
        <Card className="border-zinc-800 bg-zinc-900" data-testid="camera-idle-card">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <div className="rounded-full bg-zinc-800 p-4" data-testid="camera-icon-container">
              <Camera className="h-8 w-8 text-[#00F0FF]" />
            </div>
            <p className="text-center text-sm text-zinc-400" data-testid="camera-idle-description">
              Take a photo of an electronic component to identify it using AI vision analysis.
            </p>
            <Button
              onClick={() => void startCamera()}
              className="bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
              data-testid="button-start-camera"
            >
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Requesting permission */}
      {cameraState === 'requesting' && (
        <Card className="border-zinc-800 bg-zinc-900" data-testid="camera-requesting-card">
          <CardContent className="flex flex-col items-center gap-4 p-8">
            <Loader2
              className="h-8 w-8 animate-spin text-[#00F0FF]"
              data-testid="requesting-spinner"
            />
            <p className="text-center text-sm text-zinc-400" data-testid="requesting-message">
              Requesting camera permission...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Live video stream */}
      {cameraState === 'streaming' && (
        <div className="flex flex-col gap-3" data-testid="camera-streaming-container">
          <div className="relative overflow-hidden rounded-lg border border-zinc-800">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full rounded-lg"
              data-testid="camera-video"
            />
          </div>
          <Button
            onClick={captureImage}
            className="bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
            data-testid="button-capture"
          >
            <Camera className="mr-2 h-4 w-4" />
            Capture
          </Button>
        </div>
      )}

      {/* Captured image preview */}
      {(cameraState === 'captured' || cameraState === 'identifying') && capturedImage && (
        <div className="flex flex-col gap-3" data-testid="camera-captured-container">
          <div className="relative overflow-hidden rounded-lg border border-zinc-800">
            <img
              src={capturedImage}
              alt="Captured component"
              className="w-full rounded-lg"
              data-testid="captured-image"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={retake}
              disabled={cameraState === 'identifying'}
              className="flex-1"
              data-testid="button-retake"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retake
            </Button>
            <Button
              onClick={() => void identifyComponent()}
              disabled={cameraState === 'identifying' || !onIdentify}
              className="flex-1 bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
              data-testid="button-identify"
            >
              {cameraState === 'identifying' ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Identifying...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Identify
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Identification result */}
      {cameraState === 'result' && result && (
        <div className="flex flex-col gap-3" data-testid="identification-result">
          {/* Captured image (smaller) */}
          {capturedImage && (
            <div className="overflow-hidden rounded-lg border border-zinc-800">
              <img
                src={capturedImage}
                alt="Identified component"
                className="h-32 w-full object-cover rounded-lg"
                data-testid="result-image"
              />
            </div>
          )}

          <Card className="border-zinc-800 bg-zinc-900" data-testid="result-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-zinc-100" data-testid="result-component-type">
                  {result.componentType}
                </CardTitle>
                <Badge
                  className={cn('text-xs', confidenceConfig[result.confidence].className)}
                  data-testid="result-confidence"
                >
                  {confidenceConfig[result.confidence].label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-zinc-400" data-testid="result-description">
                {result.description}
              </p>

              <div className="grid grid-cols-2 gap-2 text-sm" data-testid="result-details">
                {result.packageType && (
                  <div data-testid="result-package">
                    <span className="text-zinc-400">Package:</span>{' '}
                    <span className="text-zinc-200">{result.packageType}</span>
                  </div>
                )}
                {result.partNumber && (
                  <div data-testid="result-part-number">
                    <span className="text-zinc-400">Part #:</span>{' '}
                    <span className="text-zinc-200">{result.partNumber}</span>
                  </div>
                )}
                {result.manufacturer && (
                  <div data-testid="result-manufacturer">
                    <span className="text-zinc-400">Mfg:</span>{' '}
                    <span className="text-zinc-200">{result.manufacturer}</span>
                  </div>
                )}
                {result.pinCount !== null && (
                  <div data-testid="result-pin-count">
                    <span className="text-zinc-400">Pins:</span>{' '}
                    <span className="text-zinc-200">{result.pinCount}</span>
                  </div>
                )}
              </div>

              {result.specifications.length > 0 && (
                <div data-testid="result-specifications">
                  <span className="text-xs text-zinc-400">Specifications:</span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {result.specifications.map((spec) => (
                      <Badge
                        key={spec}
                        variant="outline"
                        className="text-xs text-zinc-300"
                        data-testid="result-spec-badge"
                      >
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {result.notes && (
                <p
                  className="text-xs text-zinc-400 italic"
                  data-testid="result-notes"
                >
                  {result.notes}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                {result.suggestedBom && onAddToBom && (
                  <Button
                    onClick={handleAddToBom}
                    size="sm"
                    className="bg-[#00F0FF] text-zinc-900 hover:bg-[#00D4E0]"
                    data-testid="button-add-to-bom"
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    Add to BOM
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={retake}
                  data-testid="button-identify-another"
                >
                  <Camera className="mr-1 h-3 w-3" />
                  Identify Another
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error state */}
      {cameraState === 'error' && (
        <Card className="border-red-900/50 bg-red-950/20" data-testid="camera-error-card">
          <CardContent className="flex flex-col items-center gap-4 p-6">
            <AlertTriangle className="h-8 w-8 text-red-400" data-testid="error-icon" />
            <p
              className="text-center text-sm text-red-300"
              data-testid="error-message"
            >
              {errorMessage}
            </p>
            <Button
              variant="outline"
              onClick={() => void startCamera()}
              className="border-red-800 text-red-300 hover:bg-red-950"
              data-testid="button-try-again"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Hidden canvas for image capture */}
      <canvas ref={canvasRef} className="hidden" data-testid="capture-canvas" />
    </div>
  );
}
