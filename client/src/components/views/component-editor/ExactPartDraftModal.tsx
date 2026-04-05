import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { BadgeCheck, Loader2, Upload, Wand2 } from 'lucide-react';

import { useApiKeys, STORED_KEY_SENTINEL } from '@/hooks/useApiKeys';
import { useGenerateExactComponentPart } from '@/lib/component-editor/hooks';
import type { ComponentPart } from '@shared/schema';
import type { ExactPartDraftSeed } from '@shared/exact-part-resolver';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface ExactPartDraftModalProps {
  initialSeed?: ExactPartDraftSeed;
  onCreated: (part: ComponentPart) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectId: number;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected reference image.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Could not read the selected reference image.'));
        return;
      }
      const commaIndex = result.indexOf(',');
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.readAsDataURL(file);
  });
}

export default function ExactPartDraftModal({
  initialSeed,
  onCreated,
  onOpenChange,
  open,
  projectId,
}: ExactPartDraftModalProps) {
  const { apiKey, updateLocalKey } = useApiKeys();
  const generateMutation = useGenerateExactComponentPart();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [description, setDescription] = useState('');
  const [officialSourceUrl, setOfficialSourceUrl] = useState('');
  const [communitySourceUrl, setCommunitySourceUrl] = useState('');
  const [marketplaceSourceUrl, setMarketplaceSourceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>(undefined);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [imageMimeType, setImageMimeType] = useState<string | undefined>(undefined);

  const apiKeyValue = apiKey === STORED_KEY_SENTINEL ? '' : apiKey;

  const reset = useCallback(() => {
    setDescription('');
    setOfficialSourceUrl('');
    setCommunitySourceUrl('');
    setMarketplaceSourceUrl('');
    setError(null);
    setImageBase64(undefined);
    setImageFileName(null);
    setImageMimeType(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      reset();
    }
    onOpenChange(nextOpen);
  }, [onOpenChange, reset]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setDescription(initialSeed?.description?.trim() ?? '');
    setOfficialSourceUrl(initialSeed?.officialSourceUrl?.trim() ?? '');
    setCommunitySourceUrl(initialSeed?.communitySourceUrl?.trim() ?? '');
    setMarketplaceSourceUrl(initialSeed?.marketplaceSourceUrl?.trim() ?? '');
    setError(null);
  }, [initialSeed, open]);

  const handleFileChange = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Upload a PNG, JPEG, or WebP board reference image.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Reference images must stay under 10MB.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      setImageBase64(base64);
      setImageMimeType(file.type);
      setImageFileName(file.name);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not read the selected reference image.');
    }
  }, []);

  const handleCreate = useCallback(async () => {
    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setError('Describe the exact board or module you want ProtoPulse to draft.');
      return;
    }

    try {
      const created = await generateMutation.mutateAsync({
        apiKey: apiKey === STORED_KEY_SENTINEL ? undefined : apiKey || undefined,
        communitySourceUrl: communitySourceUrl.trim() || undefined,
        description: trimmedDescription,
        imageBase64,
        imageMimeType,
        marketplaceSourceUrl: marketplaceSourceUrl.trim() || undefined,
        officialSourceUrl: officialSourceUrl.trim() || undefined,
        projectId,
      });
      onCreated(created);
      handleOpenChange(false);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Could not create the exact part draft.');
    }
  }, [
    apiKey,
    communitySourceUrl,
    description,
    generateMutation,
    handleOpenChange,
    imageBase64,
    imageMimeType,
    marketplaceSourceUrl,
    officialSourceUrl,
    onCreated,
    projectId,
  ]);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void handleCreate();
  }, [handleCreate]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-card border-border" data-testid="exact-part-draft-modal">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Exact Part Draft</DialogTitle>
            <DialogDescription className="sr-only">
              Draft an exact board or module part from a description and source references.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-xl border border-amber-400/25 bg-amber-400/8 p-3 text-sm text-amber-100" data-testid="exact-part-draft-intro">
              New exact parts start as candidates. ProtoPulse can place them visually, but authoritative wiring stays blocked until review.
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive" data-testid="exact-part-draft-error">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="exact-part-description">Exact part request</Label>
              <Textarea
                id="exact-part-description"
                data-testid="input-exact-part-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Arduino Mega 2560 R3 with full header layout, USB connector, barrel jack, reset button, power header, ICSP header, and exact board outline."
                rows={5}
                className="bg-background border-border"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="exact-part-official-url">Official source URL</Label>
                <Input
                  id="exact-part-official-url"
                  data-testid="input-exact-part-official-url"
                  autoComplete="url"
                  value={officialSourceUrl}
                  onChange={(event) => setOfficialSourceUrl(event.target.value)}
                  placeholder="https://manufacturer.example.com/board"
                  className="bg-background border-border"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="exact-part-community-url">Community helper URL</Label>
                <Input
                  id="exact-part-community-url"
                  data-testid="input-exact-part-community-url"
                  autoComplete="url"
                  value={communitySourceUrl}
                  onChange={(event) => setCommunitySourceUrl(event.target.value)}
                  placeholder="https://fritzing.org/parts/example"
                  className="bg-background border-border"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exact-part-marketplace-url">Marketplace or seller URL</Label>
              <Input
                id="exact-part-marketplace-url"
                data-testid="input-exact-part-marketplace-url"
                autoComplete="url"
                value={marketplaceSourceUrl}
                onChange={(event) => setMarketplaceSourceUrl(event.target.value)}
                placeholder="https://amazon.com/... or vendor marketplace listing"
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">
                Use this for Amazon, eBay, AliExpress, or seller listings that identify the exact physical variant but
                still need review before they count as authoritative evidence.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Reference image</Label>
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-20 w-full border-dashed bg-background/50"
                data-testid="button-select-exact-part-image"
              >
                <span className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Upload className="h-5 w-5" />
                  <span className="text-xs">Upload a board/module photo or pinout image</span>
                </span>
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleFileChange}
                data-testid="input-exact-part-image"
              />
              {imageFileName && (
                <p className="text-xs text-muted-foreground" data-testid="text-exact-part-image-name">
                  Attached reference: {imageFileName}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="exact-part-api-key">Gemini API key</Label>
              <Input
                id="exact-part-api-key"
                data-testid="input-exact-part-api-key"
                type="password"
                autoComplete="current-password"
                value={apiKeyValue}
                onChange={(event) => updateLocalKey('gemini', event.target.value)}
                placeholder={apiKey === STORED_KEY_SENTINEL ? 'Stored securely on this machine' : 'AIza...'}
                className="bg-background border-border"
              />
              <p className="text-xs text-muted-foreground">
                ProtoPulse will stamp the draft as a candidate exact part and keep the source evidence with it.
              </p>
            </div>

            <div className="grid gap-2 rounded-xl border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground md:grid-cols-3">
              <div className="flex items-start gap-2">
                <Wand2 className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <span>Creates the breadboard art, pin map, and metadata draft.</span>
              </div>
              <div className="flex items-start gap-2">
                <Upload className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <span>Captures official, community, and marketplace evidence links for later review.</span>
              </div>
              <div className="flex items-start gap-2">
                <BadgeCheck className="mt-0.5 h-3.5 w-3.5 text-primary" />
                <span>Requires explicit verification before authoritative wiring is unlocked.</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => handleOpenChange(false)} data-testid="button-cancel-exact-part">
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={generateMutation.isPending}
              data-testid="button-create-exact-part"
            >
              {generateMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Create candidate draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
