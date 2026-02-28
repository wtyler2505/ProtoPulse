import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useOutput } from '@/lib/contexts/output-context';
import { Search, Trash2, Copy, ClipboardCheck } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { copyToClipboard } from '@/lib/clipboard';
import { useToast } from '@/hooks/use-toast';
import { COPY_FEEDBACK_DURATION } from '@/components/panels/chat/constants';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function OutputView() {
  const { outputLog, clearOutputLog } = useOutput();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const prevLogLength = useRef(outputLog.length);

  const indexedFilteredLog = useMemo(() => {
    return outputLog
      .map((log, index) => ({ log, index }))
      .filter(({ log }) =>
        !searchTerm || log.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [outputLog, searchTerm]);

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
    <div className="h-full w-full bg-background/80 backdrop-blur p-4 font-mono text-xs md:text-sm text-foreground/80 overflow-hidden flex flex-col">
      <div className="mb-2 pb-2 border-b border-white/10 flex flex-col gap-2 text-muted-foreground bg-white/5 backdrop-blur -mx-4 -mt-4 px-4 pt-4 pb-2">
        <div className="flex justify-between items-center">
          <span>CONSOLE OUTPUT</span>
          <div className="flex items-center gap-2">
            <StyledTooltip content={copiedAll ? 'Copied!' : 'Copy all logs'} side="bottom">
              <button
                data-testid="button-copy-all-logs"
                className="p-1 hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors"
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
                    className="p-1 hover:bg-white/10 text-muted-foreground hover:text-destructive transition-colors"
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
            <span className="text-[10px]">{outputLog.length} entries</span>
            <span>BASH / LINUX</span>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Filter logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            data-testid="input-search-logs"
            className="w-full pl-8 pr-3 py-1 bg-white/5 border border-white/10 text-xs text-foreground/80 focus:outline-none focus:border-primary/50 transition-colors font-mono placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div ref={parentRef} className="flex-1 overflow-auto">
        <div
          style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const { log, index: originalIndex } = indexedFilteredLog[virtualRow.index];
            return (
              <div
                key={`log-${originalIndex}`}
                data-testid={`log-entry-${originalIndex}`}
                className="break-all hover:bg-white/10 px-1 cursor-pointer transition-colors group"
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
                <span className="text-muted-foreground mr-2">[{String(originalIndex).padStart(3, '0')}]</span>
                {log}
                {copiedIndex === originalIndex && (
                  <span className="ml-2 text-primary text-[10px]">copied!</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="animate-pulse">_</div>
      </div>
    </div>
  );
}
