import { useState, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Upload, FileText, ArrowRight } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useApiKeys } from '@/hooks/useApiKeys';
import type { PartMeta } from '@shared/component-types';

interface DatasheetExtractModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: number;
  partId: number;
  currentMeta: PartMeta;
  onApply: (updates: Partial<PartMeta>) => void;
}

type ModalState = 'upload' | 'loading' | 'review';

const META_FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  family: 'Family',
  manufacturer: 'Manufacturer',
  mpn: 'Part Number',
  description: 'Description',
  tags: 'Tags',
  mountingType: 'Mounting Type',
  packageType: 'Package Type',
  properties: 'Properties',
  datasheetUrl: 'Datasheet URL',
  version: 'Version',
};

function formatMetaValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '(none)';
  if (Array.isArray(value)) {
    if (value.length === 0) return '(none)';
    if (typeof value[0] === 'object' && 'key' in value[0]) {
      return value.map((p: { key: string; value: string }) => `${p.key}: ${p.value}`).join(', ');
    }
    return value.join(', ');
  }
  return String(value);
}

export default function DatasheetExtractModal({
  open,
  onOpenChange,
  projectId,
  partId,
  currentMeta,
  onApply,
}: DatasheetExtractModalProps) {
  const [modalState, setModalState] = useState<ModalState>('upload');
  const { apiKey, setApiKey: setApiKeyForProvider } = useApiKeys('gemini');
  const setApiKey = useCallback((key: string) => { setApiKeyForProvider('gemini', key); }, [setApiKeyForProvider]);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<Partial<PartMeta> | null>(null);
  const [acceptedFields, setAcceptedFields] = useState<Set<string>>(new Set());

  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const resetToUpload = useCallback(() => {
    setModalState('upload');
    setError(null);
    setExtracted(null);
    setAcceptedFields(new Set());
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

    // Create preview
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
        `/api/projects/${projectId}/component-parts/${partId}/ai/extract`,
        {
          imageBase64: base64,
          mimeType: file.type,
          apiKey: apiKey || undefined,
        },
        controller.signal,
      );

      if (controller.signal.aborted) return;

      const metadata: Partial<PartMeta> = await response.json();

      // Filter to only fields that have meaningful values
      const fields = Object.keys(metadata).filter(k => {
        const val = metadata[k as keyof PartMeta];
        if (val === undefined || val === null || val === '') return false;
        if (Array.isArray(val) && val.length === 0) return false;
        return true;
      });

      if (fields.length === 0) {
        setError('AI could not extract any metadata from this image. Try a clearer datasheet image.');
        setModalState('upload');
        return;
      }

      setExtracted(metadata);
      setAcceptedFields(new Set(fields));
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
  }, [apiKey, projectId, partId]);

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

  const handleToggleField = useCallback((field: string) => {
    setAcceptedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    if (!extracted) return;

    const updates: Partial<PartMeta> = {};
    Array.from(acceptedFields).forEach(field => {
      const key = field as keyof PartMeta;
      if (key in extracted) {
        (updates as Record<string, unknown>)[key] = extracted[key];
      }
    });

    onApply(updates);
    handleOpenChange(false);
  }, [extracted, acceptedFields, onApply, handleOpenChange]);

  const extractedFields = extracted
    ? Object.keys(extracted).filter(k => {
        const val = extracted[k as keyof PartMeta];
        if (val === undefined || val === null || val === '') return false;
        if (Array.isArray(val) && val.length === 0) return false;
        return true;
      })
    : [];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-card border-border"
        data-testid="datasheet-extract-modal"
      >
        <DialogHeader>
          <DialogTitle data-testid="datasheet-extract-title">
            {modalState === 'review' ? 'Review Extracted Metadata' : 'Extract from Datasheet'}
          </DialogTitle>
          <DialogDescription className="sr-only">Extract component metadata from a datasheet</DialogDescription>
        </DialogHeader>

        {modalState === 'upload' && (
          <div className="flex flex-col gap-4 py-2">
            {error && (
              <div
                data-testid="extract-error"
                className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
              >
                {error}
              </div>
            )}
            <p className="text-sm text-muted-foreground">
              Upload an image of a datasheet page. The AI will extract component metadata like
              manufacturer, part number, package type, and electrical specifications.
            </p>
            <div className="flex flex-col gap-2">
              <Label>Datasheet Image</Label>
              <Button
                variant="outline"
                data-testid="button-select-datasheet"
                onClick={() => fileRef.current?.click()}
                className="w-full h-20 border-dashed flex flex-col gap-1"
              >
                <Upload className="w-5 h-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Click to upload PNG, JPEG, or WebP</span>
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-datasheet-file"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="extract-api-key">API Key</Label>
              <Input
                id="extract-api-key"
                data-testid="input-extract-api-key"
                type="password"
                placeholder="Gemini API key (optional if set server-side)"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
              />
            </div>
          </div>
        )}

        {modalState === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4" data-testid="extract-loading">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Datasheet preview"
                className="max-h-32 rounded-md border border-border object-contain"
                data-testid="extract-preview-image"
              />
            )}
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI is reading the datasheet...</p>
          </div>
        )}

        {modalState === 'review' && extracted && (
          <div className="flex flex-col gap-3 py-2" data-testid="extract-review">
            {previewUrl && (
              <img
                src={previewUrl}
                alt="Datasheet preview"
                className="max-h-24 rounded-md border border-border object-contain self-center"
              />
            )}
            <div className="flex items-center gap-2">
              <Button
                data-testid="button-accept-all-fields"
                variant="outline"
                size="sm"
                className="text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                onClick={() => setAcceptedFields(new Set(extractedFields))}
              >
                Accept All
              </Button>
              <Button
                data-testid="button-reject-all-fields"
                variant="outline"
                size="sm"
                className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setAcceptedFields(new Set())}
              >
                Reject All
              </Button>
            </div>
            <ScrollArea className="max-h-[40vh]">
              <div className="flex flex-col gap-1.5">
                {extractedFields.map(field => {
                  const key = field as keyof PartMeta;
                  const currentVal = currentMeta[key];
                  const newVal = extracted[key];
                  const hasExisting = currentVal !== undefined && currentVal !== null && currentVal !== '' &&
                    !(Array.isArray(currentVal) && currentVal.length === 0);

                  return (
                    <div
                      key={field}
                      data-testid={`field-${field}`}
                      className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-muted/50"
                    >
                      <Checkbox
                        data-testid={`checkbox-field-${field}`}
                        checked={acceptedFields.has(field)}
                        onCheckedChange={() => handleToggleField(field)}
                        className="mt-0.5"
                      />
                      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground">
                            {META_FIELD_LABELS[field] || field}
                          </span>
                          {hasExisting && (
                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                              overwrites
                            </Badge>
                          )}
                        </div>
                        {hasExisting && (
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-muted-foreground truncate">{formatMetaValue(currentVal)}</span>
                            <ArrowRight className="w-2.5 h-2.5 shrink-0 text-muted-foreground" />
                          </div>
                        )}
                        <span className="text-xs text-emerald-500 truncate">{formatMetaValue(newVal)}</span>
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
              data-testid="button-cancel-extract"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
          {modalState === 'loading' && (
            <Button
              data-testid="button-cancel-extract-loading"
              variant="outline"
              onClick={handleCancel}
            >
              Cancel
            </Button>
          )}
          {modalState === 'review' && (
            <>
              <Button
                data-testid="button-discard-extract"
                variant="outline"
                onClick={() => resetToUpload()}
              >
                Try Again
              </Button>
              <Button
                data-testid="button-apply-extract"
                onClick={handleApply}
                disabled={acceptedFields.size === 0}
              >
                <FileText className="w-4 h-4 mr-1" />
                Apply {acceptedFields.size} Field{acceptedFields.size !== 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
