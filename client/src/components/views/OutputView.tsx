import { useState, useMemo, useCallback } from 'react';
import { useProject } from '@/lib/project-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Trash2, Copy, ClipboardCheck } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { copyToClipboard } from '@/lib/clipboard';
import { useToast } from '@/hooks/use-toast';
import { COPY_FEEDBACK_DURATION } from '@/components/panels/chat/constants';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function OutputView() {
  const { outputLog, clearOutputLog } = useProject();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const indexedFilteredLog = useMemo(() => {
    return outputLog
      .map((log, index) => ({ log, index }))
      .filter(({ log }) =>
        !searchTerm || log.toLowerCase().includes(searchTerm.toLowerCase())
      );
  }, [outputLog, searchTerm]);

  const displayLog = indexedFilteredLog.slice(-500);
  const truncatedCount = indexedFilteredLog.length - displayLog.length;

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
      <ScrollArea className="flex-1">
        {truncatedCount > 0 && (
          <div className="mb-2 px-1 text-yellow-500/80 text-[10px]">
            [{truncatedCount} older entries hidden — showing last 500]
          </div>
        )}
        {displayLog.map(({ log, index: originalIndex }) => (
          <StyledTooltip key={`log-${originalIndex}`} content="Click to copy" side="right">
            <div
              data-testid={`log-entry-${originalIndex}`}
              className="mb-1 break-all hover:bg-white/10 px-1 cursor-pointer transition-colors group"
              onClick={() => handleCopyEntry(log, originalIndex)}
            >
              <span className="text-muted-foreground mr-2">[{String(originalIndex).padStart(3, '0')}]</span>
              {log}
              {copiedIndex === originalIndex && (
                <span className="ml-2 text-primary text-[10px]">copied!</span>
              )}
            </div>
          </StyledTooltip>
        ))}
        <div className="animate-pulse">_</div>
      </ScrollArea>
    </div>
  );
}
