import { useProject } from '@/lib/project-context';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function OutputView() {
  const { outputLog } = useProject();

  return (
    <div className="h-full w-full bg-black/90 p-4 font-mono text-xs md:text-sm text-green-500/80 overflow-hidden flex flex-col">
      <div className="mb-2 pb-2 border-b border-white/10 flex justify-between items-center text-muted-foreground">
        <span>CONSOLE OUTPUT</span>
        <span>BASH / LINUX</span>
      </div>
      <ScrollArea className="flex-1">
        {outputLog.map((log, i) => (
          <div key={i} className="mb-1 break-all hover:bg-white/5 px-1 cursor-text">
            <span className="text-gray-500 mr-2">{new Date().toLocaleTimeString()}</span>
            {log}
          </div>
        ))}
        <div className="animate-pulse">_</div>
      </ScrollArea>
    </div>
  );
}
