import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, MapPin, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiRequest } from '@/lib/queryClient';
import type { Connector, PartMeta } from '@shared/component-types';

interface PinExtractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  partId: number;
  currentMeta: PartMeta;
  onApply: (connectors: Connector[]) => void;
}

type ModalState = 'upload' | 'loading' | 'review';

const API_KEY_STORAGE_KEY = 'gemini_api_key';

const CONNECTOR_TYPE_STYLES: Record<string, { label: string; className: string }> = {
  pad: { label: 'SMD Pad', className: 'bg-blue-500/10 text-blue-500' },
  male: { label: 'THT Pin', className: 'bg-emerald-500/10 text-emerald-500' },
  female: { label: 'Socket', className: 'bg-purple-500/10 text-purple-500' },
};

export default function PinExtractModal({
  open,
  onOpenChange,
  projectId,
  partId,
  currentMeta,
  onApply,
}: PinExtractModalProps) {
  const [modalState, setModalState] = useState<ModalState>('upload');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE_KEY) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extractedPins, setExtractedPins] = useState<Connector[]>([]);
  const [acceptedPinIds, setAcceptedPinIds] = useState<Set<string>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetToUpload = useCallback(() => {
    setModalState('upload');
    setError(null);
    setExtractedPins([]);
    setAcceptedPinIds(new Set());
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }, [previewUrl]);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      abortRef.current?.abort();
      abortRef.current = null;
      resetToUpload();
    }
    onOpenChange(nextOpen);
  }, [onOpenChange, resetToUpload]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      setError('Please upload an image file (PNG, JPEG, WebP, or GIF).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10MB.');
      return;
    }

    setError(null);
    setModalState('loading');

    if (apiKey) {
      localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    }

    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), ''),
      );

      const response = await apiRequest(
        'POST',
        `/api/projects/${projectId}/component-parts/${partId}/ai/extract-pins`,
        {
          imageBase64: base64,
          mimeType: file.type,
          apiKey: apiKey || undefined,
          existingMeta: currentMeta,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const result: { connectors: Connector[] } = await response.json();

      if (!result.connectors || result.connectors.length === 0) {
        setError('AI could not identify any pins from this image. Try a clearer photo with visible pin markings.');
        setModalState('upload');
        return;
      }

      setExtractedPins(result.connectors);
      setAcceptedPinIds(new Set(result.connectors.map(c => c.id)));
      setModalState('review');
    } catch (err) {
      if (controller.signal.aborted) return;
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
      setModalState('upload');
    } finally {
      abortRef.current = null;
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [apiKey, projectId, partId, currentMeta]);

  const handleCancel = useCallback(() => {
    if (modalState === 'loading') {
      abortRef.current?.abort();
      abortRef.current = null;
      setModalState('upload');
      setError(null);
    } else {
      handleOpenChange(false);
    }
  }, [modalState, handleOpenChange]);

  const handleTogglePin = useCallback((pinId: string) => {
    setAcceptedPinIds(prev => {
      const next = new Set(prev);
      if (next.has(pinId)) next.delete(pinId);
      else next.add(pinId);
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    const selected = extractedPins.filter(c => acceptedPinIds.has(c.id));
    if (selected.length === 0) return;
    onApply(selected);
    handleOpenChange(false);
  }, [extractedPins, acceptedPinIds, onApply, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border"
        data-testid="pin-extract-modal"
      >
        <DialogHeader>
          <DialogTitle data-testid="pin-extract-title">
            {modalState === 'review' ? 'Review Extracted Pins' : 'Extract Pins from Photo'}
          </DialogTitle>
        </DialogHeader>

        {modalState === 'upload' && (
          <div className="flex flex-col gap-4 py-2">
            {error && (
              <div
                data-testid="pin-extract-error"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Upload a photo of the physical chip. The AI will identify pin locations,
              names, and functions from visible markings and package type.
            </p>
            <div className="flex flex-col gap-2">
              <Label>Chip Photo</Label>
              <Button
                variant="outline"
                data-testid="button-select-photo"
                onClick={() => fileRef.current?.click()}
                className="w-full h-20 border-dashed flex flex-col gap-1"
              >
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Click to upload a photo of the chip</span>
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-photo-file"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="pin-extract-api-key">API Key</Label>
              <Input
                id="pin-extract-api-key"
                data-testid="input-pin-extract-api-key"
                type="password"
                placeholder="Gemini API key (optional if set server-side)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          </div>
        )}

        {modalState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="pin-extract-loading">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Chip photo preview"
                className="max-h-32 rounded-md border border-border object-contain"
                data-testid="pin-extract-preview-image"
              />
            )}
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI is analyzing pin layout...</p>
          </div>
        )}

        {modalState === 'review' && extractedPins.length > 0 && (
          <div className="flex flex-col gap-3 py-2" data-testid="pin-extract-review">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Chip photo"
                className="max-h-24 rounded-md border border-border object-contain self-center"
              />
            )}
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {extractedPins.length} pin{extractedPins.length !== 1 ? 's' : ''} detected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  data-testid="button-accept-all-pins"
                  variant="outline"
                  size="sm"
                  className="text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                  onClick={() => setAcceptedPinIds(new Set(extractedPins.map(c => c.id)))}
                >
                  Accept All
                </Button>
                <Button
                  data-testid="button-reject-all-pins"
                  variant="outline"
                  size="sm"
                  className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => setAcceptedPinIds(new Set())}
                >
                  Reject All
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-[40vh]">
              <div className="flex flex-col gap-1">
                {extractedPins.map(pin => {
                  const typeStyle = CONNECTOR_TYPE_STYLES[pin.connectorType] ?? {
                    label: pin.connectorType,
                    className: 'bg-muted text-muted-foreground',
                  };

                  return (
                    <div
                      key={pin.id}
                      data-testid={`pin-${pin.id}`}
                      className={cn(
                        'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs',
                        acceptedPinIds.has(pin.id) ? 'bg-emerald-500/5' : 'bg-muted/30 opacity-60',
                      )}
                    >
                      <Checkbox
                        data-testid={`checkbox-pin-${pin.id}`}
                        checked={acceptedPinIds.has(pin.id)}
                        onCheckedChange={() => handleTogglePin(pin.id)}
                      />
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-primary" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground">{pin.name}</span>
                          <Badge className={cn('text-[10px] px-1 py-0 border-transparent', typeStyle.className)}>
                            {typeStyle.label}
                          </Badge>
                        </div>
                        {pin.description && (
                          <span className="text-muted-foreground text-[10px] truncate">{pin.description}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        )}

        <DialogFooter>
          {modalState === 'upload' && (
            <Button
              data-testid="button-cancel-pin-extract"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
          {modalState === 'loading' && (
            <Button
              data-testid="button-cancel-pin-extract-loading"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
          {modalState === 'review' && (
            <>
              <Button
                data-testid="button-discard-pins"
                variant="outline"
                onClick={() => resetToUpload()}
              >
                Try Again
              </Button>
              <Button
                data-testid="button-apply-pins"
                onClick={handleApply}
                disabled={acceptedPinIds.size === 0}
              >
                <MapPin className="w-4 h-4 mr-1" />
                Add {acceptedPinIds.size} Pin{acceptedPinIds.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
