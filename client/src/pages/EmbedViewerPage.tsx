import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, Loader2, AlertCircle } from 'lucide-react';

import { EmbedManager } from '@/lib/embed-viewer';

import type { EmbedCircuitData, EmbedTheme } from '@/lib/embed-viewer';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmbedViewerPageProps {
  /** Route param — base64url-encoded circuit data */
  dataParam?: string;
  /** Route param — server short code */
  codeParam?: string;
}

type LoadingState = 'loading' | 'ready' | 'error';

function EmbedFlowViewer({
  data,
  theme,
}: {
  data: EmbedCircuitData;
  theme: EmbedTheme;
}) {
  const nodeCount = data.nodes.length;
  const netCount = data.nets.length;
  const wireCount = data.wires.length;

  return (
    <div
      className="h-full w-full p-3"
      data-testid="embed-flow-canvas"
    >
      <div
        className="h-full w-full rounded border border-border/70 bg-card/70 p-3"
        style={{
          backgroundImage: theme.showGrid
            ? `linear-gradient(${theme.dark ? '#20232b' : '#e5e7eb'} 1px, transparent 1px), linear-gradient(90deg, ${theme.dark ? '#20232b' : '#e5e7eb'} 1px, transparent 1px)`
            : undefined,
          backgroundSize: theme.showGrid ? '20px 20px' : undefined,
        }}
      >
        <div className="grid grid-cols-3 gap-2 text-xs" data-testid="embed-flow-summary">
          <div className="rounded border border-border/60 bg-background/70 px-2 py-1">
            <div className="text-muted-foreground">Nodes</div>
            <div className="font-medium">{nodeCount}</div>
          </div>
          <div className="rounded border border-border/60 bg-background/70 px-2 py-1">
            <div className="text-muted-foreground">Nets</div>
            <div className="font-medium">{netCount}</div>
          </div>
          <div className="rounded border border-border/60 bg-background/70 px-2 py-1">
            <div className="text-muted-foreground">Wires</div>
            <div className="font-medium">{wireCount}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function EmbedViewerPage({ dataParam, codeParam }: EmbedViewerPageProps) {
  const [state, setState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [circuitData, setCircuitData] = useState<EmbedCircuitData | null>(null);

  const manager = useMemo(() => new EmbedManager(), []);

  // Parse theme from URL search params
  const theme = useMemo<EmbedTheme>(() => {
    const params = new URLSearchParams(window.location.search);
    return manager.resolveTheme(manager.parseThemeFromParams(params));
  }, [manager]);

  const loadData = useCallback(async () => {
    try {
      setState('loading');
      setError(null);

      let data: EmbedCircuitData;

      if (codeParam) {
        // Server short URL — fetch from API
        const encodedData = await manager.fetchShortUrl(codeParam);
        data = await manager.decode(encodedData);
      } else if (dataParam) {
        // Client-encoded data in URL
        data = await manager.decode(dataParam);
      } else {
        throw new Error('No circuit data provided');
      }

      setCircuitData(data);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load circuit data');
      setState('error');
    }
  }, [dataParam, codeParam, manager]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Build "Open in ProtoPulse" link
  const editorUrl = useMemo(() => {
    const origin = window.location.origin;
    return `${origin}/projects/1`;
  }, []);

  // Determine background based on theme
  const bgColor = theme.dark ? '#0a0a0f' : '#f8f9fa';
  const textColor = theme.dark ? '#e2e8f0' : '#1a202c';

  // Loading state
  if (state === 'loading') {
    return (
      <div
        className="w-full h-screen flex flex-col items-center justify-center gap-3"
        style={{ backgroundColor: bgColor, color: textColor }}
        data-testid="embed-loading"
      >
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.accentColor }} />
        <p className="text-sm opacity-70">Loading schematic...</p>
      </div>
    );
  }

  // Error state
  if (state === 'error') {
    return (
      <div
        className="w-full h-screen flex flex-col items-center justify-center gap-3 px-6"
        style={{ backgroundColor: bgColor, color: textColor }}
        data-testid="embed-error"
      >
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm font-medium">Failed to load schematic</p>
        <p className="text-xs opacity-60 max-w-md text-center">{error}</p>
        <a
          href={editorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 text-xs underline opacity-70 hover:opacity-100 transition-opacity"
          data-testid="embed-error-link"
        >
          Open ProtoPulse
        </a>
      </div>
    );
  }

  // Ready state — render the schematic
  return (
    <div
      className="w-full h-screen relative"
      style={{ backgroundColor: bgColor, color: textColor }}
      data-testid="embed-viewer"
    >
      {circuitData ? <EmbedFlowViewer data={circuitData} theme={theme} /> : null}

      {/* Watermark */}
      <div
        className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-1 rounded text-[10px] opacity-50 hover:opacity-90 transition-opacity"
        style={{ backgroundColor: theme.dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }}
        data-testid="embed-watermark"
      >
        <span>Powered by</span>
        <a
          href={editorUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold underline"
          style={{ color: theme.accentColor }}
        >
          ProtoPulse
        </a>
      </div>

      {/* Open in editor button */}
      <a
        href={editorUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-2 right-2 flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
        style={{
          backgroundColor: theme.accentColor,
          color: '#000',
        }}
        data-testid="embed-open-editor"
      >
        <ExternalLink className="w-3 h-3" />
        Open in ProtoPulse
      </a>

      {/* Circuit title */}
      {circuitData?.metadata?.name && (
        <div
          className="absolute top-2 left-2 px-3 py-1.5 rounded-md text-xs font-medium"
          style={{ backgroundColor: theme.dark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)' }}
          data-testid="embed-title"
        >
          {circuitData.metadata.name}
        </div>
      )}
    </div>
  );
}
