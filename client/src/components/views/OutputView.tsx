/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useOutput } from '@/lib/contexts/output-context';
import { Search, Trash2, Copy, ClipboardCheck } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { copyToClipboard } from '@/lib/clipboard';
import { useToast } from '@/hooks/use-toast';
import { COPY_FEEDBACK_DURATION } from '@/components/panels/chat/constants';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Badge } from '@/components/ui/badge';

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function OutputView() {
  const { outputLog, outputLogEntries, clearOutputLog } = useOutput();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const prevLogLength = useRef(outputLog.length);

  const indexedFilteredLog = useMemo(() => {
    return outputLogEntries
      .map((entry, index) => ({ log: entry.message, timestamp: entry.timestamp, index }))
      .filter(({ log }) =>
        !searchTerm || log.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [outputLogEntries, searchTerm]);

  const virtualizer = useVirtualizer({
    count: indexedFilteredLog.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 24,
    overscan: 20,
  });

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (outputLog.length > prevLogLength.current && indexedFilteredLog.length > 0) {
      virtualizer.scrollToIndex(indexedFilteredLog.length - 1, { align: 'end' });
    }
    prevLogLength.current = outputLog.length;
  }, [outputLog.length, indexedFilteredLog.length, virtualizer]);

  const handleCopyEntry = useCallback((log: string, index: number) => {
    copyToClipboard(log);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), COPY_FEEDBACK_DURATION);
  }, []);

  const handleCopyAll = useCallback(() => {
    copyToClipboard(outputLog.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), COPY_FEEDBACK_DURATION);
    toast({ title: 'Copied', description: 'All log entries copied to clipboard.' });
  }, [outputLog, toast]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background/80 p-2 font-mono text-xs text-foreground/80 backdrop-blur md:text-sm">
      <div className="-mx-2 -mt-2 mb-2 flex flex-col gap-1.5 border-b border-white/10 bg-white/5 px-2 pt-2 pb-2 text-muted-foreground backdrop-blur">
        <div className="flex justify-between items-center">
          <span className="text-xs">CONSOLE OUTPUT</span>
          <div className="flex items-center gap-2">
            <StyledTooltip content={copiedAll ? 'Copied!' : 'Copy all logs'} side="bottom">
              <button
                data-testid="button-copy-all-logs"
                className="p-0.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-primary focus-ring"
                onClick={handleCopyAll}
                aria-label="Copy all logs"
              >
                {copiedAll ? <ClipboardCheck className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </StyledTooltip>
            <ConfirmDialog
              trigger={
                <StyledTooltip content="Clear output" side="bottom">
                  <button
                    data-testid="button-clear-logs"
                    className="p-0.5 text-muted-foreground transition-colors hover:bg-white/10 hover:text-destructive focus-ring"
                    aria-label="Clear logs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </StyledTooltip>
              }
              title="Clear Output Logs"
              description="Clear all output logs? This cannot be undone."
              confirmLabel="Clear"
              onConfirm={clearOutputLog}
              variant="destructive"
            />
            <span className="text-[11px]">{outputLog.length} entries</span>
            <Badge variant="outline" className="pointer-events-none h-5 select-none border-border text-[10px] font-mono text-muted-foreground" data-testid="label-shell-type">SYSTEM LOG</Badge>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter logs..."
            aria-label="Filter logs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-logs"
            className="w-full border border-white/10 bg-white/5 py-1 pl-8 pr-2 text-[11px] font-mono text-foreground/80 placeholder:text-muted-foreground transition-colors focus-visible:border-primary/50 focus-visible:outline-none focus-ring"
          />
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const { log, timestamp, index: originalIndex } = indexedFilteredLog[virtualRow.index];
            return (
              <div
                key={`log-${originalIndex}`}
                data-testid={`log-entry-${originalIndex}`}
                className="group cursor-pointer break-all px-0.5 transition-colors hover:bg-white/10"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => handleCopyEntry(log, originalIndex)}
              >
                <span className="text-muted-foreground/50 mr-1.5 text-[11px]">{formatTimestamp(timestamp)}</span>
                <span className="text-muted-foreground mr-2">[{String(originalIndex).padStart(3, '0')}]</span>
                {log}
                {copiedIndex === originalIndex && (
                  <span className="ml-2 text-primary text-[11px]">copied!</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default memo(OutputView);
