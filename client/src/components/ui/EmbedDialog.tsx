/* eslint-disable jsx-a11y/no-noninteractive-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Code2, Link2, FileText, Loader2 } from 'lucide-react';

import { EmbedManager } from '@/lib/embed-viewer';

import type { EmbedCircuitData, EmbedFormat, EmbedTheme } from '@/lib/embed-viewer';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EmbedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  circuitData: EmbedCircuitData;
}

// ---------------------------------------------------------------------------
// Tab definition
// ---------------------------------------------------------------------------

interface TabDef {
  id: EmbedFormat;
  label: string;
  icon: typeof Link2;
}

const TABS: TabDef[] = [
  { id: 'link', label: 'Link', icon: Link2 },
  { id: 'iframe', label: 'Embed Code', icon: Code2 },
  { id: 'markdown', label: 'Markdown', icon: FileText },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EmbedDialog({ open, onOpenChange, circuitData }: EmbedDialogProps) {
  const [activeTab, setActiveTab] = useState<EmbedFormat>('link');
  const [copied, setCopied] = useState(false);
  const [encodedData, setEncodedData] = useState<string | null>(null);
  const [shortCode, setShortCode] = useState<string | null>(null);
  const [shortUrlLoading, setShortUrlLoading] = useState(false);
  const [shortUrlError, setShortUrlError] = useState<string | null>(null);
  const [encoding, setEncoding] = useState(false);

  // Theme options
  const [themeDark, setThemeDark] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const manager = useMemo(() => new EmbedManager(), []);

  const themeOptions = useMemo<Partial<EmbedTheme>>(
    () => ({ dark: themeDark, showGrid, showLabels }),
    [themeDark, showGrid, showLabels],
  );

  // Encode the circuit data when dialog opens
  useEffect(() => {
    if (!open) {
      return;
    }
    setEncoding(true);
    setEncodedData(null);
    setShortCode(null);
    setShortUrlError(null);

    manager
      .encode(circuitData)
      .then((encoded) => {
        setEncodedData(encoded);
        setEncoding(false);
      })
      .catch(() => {
        setEncoding(false);
      });
  }, [open, circuitData, manager]);

  // Determine if we need a short URL (encoded data too long for URL)
  const needsShortUrl = useMemo(() => {
    if (!encodedData) {
      return false;
    }
    return manager.exceedsUrlLimit(encodedData, themeOptions);
  }, [encodedData, manager, themeOptions]);

  // Build the embed URL
  const embedUrl = useMemo(() => {
    if (shortCode) {
      return manager.getShortEmbedUrl(shortCode, themeOptions);
    }
    if (encodedData && !needsShortUrl) {
      return manager.getEmbedUrl(encodedData, themeOptions);
    }
    return null;
  }, [encodedData, shortCode, needsShortUrl, manager, themeOptions]);

  // Generate code for active tab
  const embedCode = useMemo(() => {
    if (!embedUrl) {
      return '';
    }
    return manager.generateEmbedCode(activeTab, embedUrl, {
      title: circuitData.metadata?.name,
    });
  }, [activeTab, embedUrl, manager, circuitData.metadata?.name]);

  // Create short URL handler
  const handleCreateShortUrl = useCallback(async () => {
    if (!encodedData) {
      return;
    }
    setShortUrlLoading(true);
    setShortUrlError(null);
    try {
      const result = await manager.createShortUrl(encodedData);
      setShortCode(result.code);
    } catch (err) {
      setShortUrlError(err instanceof Error ? err.message : 'Failed to create short URL');
    } finally {
      setShortUrlLoading(false);
    }
  }, [encodedData, manager]);

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!embedCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch {
      // Fallback for browsers that don't support clipboard API
      const textarea = document.createElement('textarea');
      textarea.value = embedCode;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    }
  }, [embedCode]);

  // Close on Escape
  useEffect(() => {
    if (!open) {
      return;
    }
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
    };
  }, [open, onOpenChange]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      data-testid="embed-dialog-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onOpenChange(false);
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Share & Embed"
      tabIndex={-1}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" />

      {/* Dialog */}
      <div
        className="relative bg-card border border-border rounded-lg shadow-xl w-full max-w-lg mx-4"
        data-testid="embed-dialog"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground" data-testid="embed-dialog-title">
            Share & Embed
          </h2>
          <button
            onClick={() => {
              onOpenChange(false);
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid="embed-dialog-close"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border" data-testid="embed-tabs">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'text-primary border-b-2 border-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                data-testid={`embed-tab-${tab.id}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {encoding ? (
            <div className="flex items-center justify-center py-8" data-testid="embed-encoding">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">Encoding circuit data...</span>
            </div>
          ) : needsShortUrl && !shortCode ? (
            <div className="space-y-3" data-testid="embed-needs-short-url">
              <p className="text-sm text-muted-foreground">
                This circuit is too large for a URL-encoded link. Create a short URL to share it.
              </p>
              <button
                onClick={() => void handleCreateShortUrl()}
                disabled={shortUrlLoading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                data-testid="embed-create-short-url"
              >
                {shortUrlLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Link2 className="w-4 h-4" />
                    Create Short URL
                  </>
                )}
              </button>
              {shortUrlError && (
                <p className="text-sm text-destructive" data-testid="embed-short-url-error">
                  {shortUrlError}
                </p>
              )}
            </div>
          ) : (
            <>
              {/* Code display */}
              <div className="relative" data-testid="embed-code-container">
                <pre className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto max-h-40 text-foreground whitespace-pre-wrap break-all">
                  <code data-testid="embed-code-output">{embedCode}</code>
                </pre>
                <button
                  onClick={() => void handleCopy()}
                  className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-background transition-colors"
                  data-testid="embed-copy-button"
                  aria-label="Copy to clipboard"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Short URL option for small circuits */}
              {!needsShortUrl && !shortCode && (
                <button
                  onClick={() => void handleCreateShortUrl()}
                  disabled={shortUrlLoading}
                  className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  data-testid="embed-optional-short-url"
                >
                  {shortUrlLoading ? 'Creating short URL...' : 'Create a shorter URL'}
                </button>
              )}
              {shortCode && (
                <p className="text-xs text-muted-foreground" data-testid="embed-short-url-info">
                  Using short URL (code: {shortCode}) — expires in 30 days.
                </p>
              )}
            </>
          )}

          {/* Theme options */}
          <div className="space-y-2 pt-2 border-t border-border" data-testid="embed-theme-options">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Theme Options
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={themeDark}
                  onChange={(e) => {
                    setThemeDark(e.target.checked);
                  }}
                  className="rounded"
                  data-testid="embed-theme-dark"
                />
                Dark mode
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => {
                    setShowGrid(e.target.checked);
                  }}
                  className="rounded"
                  data-testid="embed-theme-grid"
                />
                Show grid
              </label>
              <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLabels}
                  onChange={(e) => {
                    setShowLabels(e.target.checked);
                  }}
                  className="rounded"
                  data-testid="embed-theme-labels"
                />
                Show labels
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
