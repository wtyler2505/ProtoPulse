import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, PieChart, MemoryStick } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MemorySymbol {
  address: string;
  size: number;
  type: string;
  name: string;
}

interface MemoryAnalyzerProps {
  projectId: number;
  jobId: number | null;
}

export default function MemoryAnalyzerPanel({ projectId, jobId }: MemoryAnalyzerProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/projects', projectId, 'arduino/jobs', jobId, 'memory'],
    queryFn: async () => {
      if (!jobId) return null;
      const res = await apiRequest('GET', `/api/projects/${projectId}/arduino/jobs/${jobId}/memory`);
      if (!res.ok) throw new Error('Failed to fetch memory data');
      return await res.json() as { symbols: MemorySymbol[] };
    },
    enabled: !!jobId,
  });

  if (!jobId) return null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4 text-xs text-muted-foreground gap-2 border-t border-border">
        <Loader2 className="w-4 h-4 animate-spin" /> Analyzing compiled memory map...
      </div>
    );
  }

  if (error || !data || !data.symbols) {
    return (
      <div className="p-2 text-xs text-red-400 bg-red-400/10 border-t border-border">
        Memory analysis unavailable. Ensure compilation succeeded.
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  };

  return (
    <div className="border-t border-border flex flex-col max-h-[300px] bg-muted/5">
      <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/20 text-xs font-bold uppercase tracking-wider text-muted-foreground">
        <PieChart className="w-3 h-3" /> Per-File Memory Breakdown (Top 100)
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-muted-foreground/70 border-b border-border/50">
                <th className="pb-1 font-medium">Symbol / File</th>
                <th className="pb-1 font-medium text-right">Size</th>
                <th className="pb-1 font-medium text-center">Type</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {data.symbols.map((sym, i) => (
                <tr key={i} className="border-b border-border/10 hover:bg-muted/30 transition-colors">
                  <td className="py-1.5 pr-2 truncate max-w-[200px]" title={sym.name}>
                    {sym.name}
                  </td>
                  <td className="py-1.5 text-right text-emerald-400">
                    {formatSize(sym.size)}
                  </td>
                  <td className="py-1.5 text-center text-muted-foreground/60">
                    {sym.type}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>
    </div>
  );
}