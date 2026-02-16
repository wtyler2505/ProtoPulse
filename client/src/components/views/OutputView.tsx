import { useState } from 'react';
import { useProject } from '@/lib/project-context';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Trash2, Copy, ClipboardCheck } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

export default function OutputView() {
  const { outputLog, clearOutputLog } = useProject();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const filteredLog = outputLog.filter(log =>
    !searchTerm || log.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCopyEntry = (log: string, index: number) => {
    navigator.clipboard.writeText(log);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleCopyAll = () => {
    navigator.clipboard.writeText(outputLog.join('\n'));
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 1500);
  };

  return (
    <div className="h-full w-full bg-black/80 backdrop-blur p-4 font-mono text-xs md:text-sm text-green-500/80 overflow-hidden flex flex-col">
      <div className="mb-2 pb-2 border-b border-white/10 flex flex-col gap-2 text-muted-foreground bg-white/5 backdrop-blur -mx-4 -mt-4 px-4 pt-4 pb-2">
        <div className="flex justify-between items-center">
          <span>CONSOLE OUTPUT</span>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="button-copy-all-logs"
                  className="p-1 hover:bg-white/10 text-muted-foreground hover:text-green-400 transition-colors"
                  onClick={handleCopyAll}
                >
                  {copiedAll ? <ClipboardCheck className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                <p>{copiedAll ? 'Copied!' : 'Copy all logs'}</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-testid="button-clear-logs"
                  className="p-1 hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
                  onClick={clearOutputLog}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                <p>Clear output</p>
              </TooltipContent>
            </Tooltip>
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
            className="w-full pl-8 pr-3 py-1 bg-white/5 border border-white/10 text-xs text-green-500/80 focus:outline-none focus:border-green-500/50 transition-colors font-mono placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <ScrollArea className="flex-1">
        {filteredLog.map((log, i) => {
          const originalIndex = outputLog.indexOf(log);
          return (
            <Tooltip key={i}>
              <TooltipTrigger asChild>
                <div
                  data-testid={`log-entry-${originalIndex}`}
                  className="mb-1 break-all hover:bg-white/10 px-1 cursor-pointer transition-colors group"
                  onClick={() => handleCopyEntry(log, originalIndex)}
                >
                  <span className="text-gray-500 mr-2">[{String(originalIndex).padStart(3, '0')}]</span>
                  {log}
                  {copiedIndex === originalIndex && (
                    <span className="ml-2 text-green-400 text-[10px]">copied!</span>
                  )}
                </div>
              </TooltipTrigger>
              <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="right">
                <p>Click to copy</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
        <div className="animate-pulse">_</div>
      </ScrollArea>
    </div>
  );
}
