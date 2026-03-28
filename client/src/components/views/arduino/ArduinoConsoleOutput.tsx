import { useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Download,
  Square,
  BookOpen,
  Ban,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History as HistoryIcon } from 'lucide-react';
import type { ArduinoJob } from '@shared/schema';
import type { LinkedError } from '@/lib/arduino/error-knowledge-linker';

interface ArduinoConsoleOutputProps {
  jobs: ArduinoJob[];
  consoleLogs: string[];
  autoScroll: boolean;
  translatedErrors: LinkedError[];
  onCancelJob: (jobId: number) => void;
  onDownloadArtifact: (jobId: number) => void;
}

export default function ArduinoConsoleOutput({
  jobs,
  consoleLogs,
  autoScroll,
  translatedErrors,
  onCancelJob,
  onDownloadArtifact,
}: ArduinoConsoleOutputProps) {
  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [jobs, autoScroll]);

  return (
    <ScrollArea className="h-full p-3 font-mono text-[11px] leading-tight text-zinc-400">
      <div className="space-y-1">
        {consoleLogs.map((line, i) => (
          <div key={i} className="text-[10px] text-zinc-300">{line}</div>
        ))}
        {jobs.slice(0, 5).map(job => (
          <div key={job.id} className="border-l-2 border-border pl-2 py-1 mb-2 bg-white/5 rounded-r-sm">
            <div className="flex items-center gap-2 mb-1">
              <HistoryIcon className="w-3 h-3 text-muted-foreground" />
              <span className="font-bold text-[9px] uppercase">{job.jobType}</span>
              <span className="text-[9px] opacity-50">{new Date(job.createdAt).toLocaleTimeString()}</span>
              <div className="flex-1" />
              {job.status === 'completed' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
              {job.status === 'failed' && <XCircle className="w-3 h-3 text-destructive" />}
              {job.status === 'cancelled' && <Ban className="w-3 h-3 text-amber-500" />}
              {(job.status === 'running' || job.status === 'pending') && <Loader2 className="w-3 h-3 animate-spin text-primary" />}

              {/* Per-job action buttons */}
              {(job.status === 'running' || job.status === 'pending') && (
                <button
                  className="text-[9px] text-destructive hover:text-destructive/80 px-1"
                  onClick={() => onCancelJob(job.id)}
                  data-testid={`button-cancel-job-${job.id}`}
                  title="Cancel this job"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                </button>
              )}
              {job.status === 'completed' && job.jobType === 'compile' && (
                <button
                  className="text-[9px] text-primary hover:text-primary/80 px-1"
                  onClick={() => onDownloadArtifact(job.id)}
                  data-testid={`button-download-artifact-${job.id}`}
                  title="Download compiled binary"
                >
                  <Download className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <p className={cn(
              'text-[10px]',
              job.status === 'failed' ? 'text-destructive' : job.status === 'completed' ? 'text-emerald-400' : job.status === 'cancelled' ? 'text-amber-400' : 'text-primary',
            )}>
              {job.summary}
            </p>
            {job.log && (
              <pre className="mt-1 text-[9px] opacity-60 overflow-x-auto whitespace-pre-wrap max-h-24 font-mono leading-relaxed border-t border-white/5 pt-1">
                {job.log}
              </pre>
            )}
          </div>
        ))}
        {/* Translated errors -- shown when a compile job failed */}
        {translatedErrors.length > 0 && (
          <div className="border-l-2 border-destructive/50 pl-2 py-1.5 mb-2 bg-destructive/5 rounded-r-sm" data-testid="translated-errors-panel">
            <div className="flex items-center gap-1.5 mb-1.5">
              <AlertCircle className="w-3 h-3 text-destructive" />
              <span className="text-[9px] font-bold uppercase tracking-wider text-destructive">
                {translatedErrors.length} Issue{translatedErrors.length !== 1 ? 's' : ''} Explained
              </span>
            </div>
            <div className="space-y-1.5">
              {translatedErrors.map((t, i) => (
                <div
                  key={i}
                  className="bg-white/5 rounded px-2 py-1.5 text-[10px]"
                  data-testid={`translated-error-${i}`}
                >
                  <div className="flex items-start gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn(
                        'h-3.5 px-1 text-[7px] shrink-0 mt-0.5',
                        t.severity === 'error' && 'border-destructive/30 text-destructive bg-destructive/10',
                        t.severity === 'warning' && 'border-amber-500/30 text-amber-500 bg-amber-500/10',
                        t.severity === 'note' && 'border-blue-500/30 text-blue-500 bg-blue-500/10',
                      )}
                    >
                      {t.severity}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-foreground/90">{t.translated}</p>
                      <p className="text-primary/80 mt-0.5">{t.suggestion}</p>
                      {t.file && t.lineNumber && (
                        <span className="text-[8px] text-muted-foreground mt-0.5 block font-mono">
                          {t.file}:{t.lineNumber}
                        </span>
                      )}
                      {t.knowledgeLinks.length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap" data-testid={`knowledge-links-${i}`}>
                          <BookOpen className="w-2.5 h-2.5 text-cyan-400 shrink-0" />
                          {t.knowledgeLinks
                            .filter((kl) => kl.relevance === 'primary')
                            .slice(0, 3)
                            .map((kl) => (
                              <button
                                key={kl.articleId}
                                type="button"
                                className="text-[8px] text-cyan-400 hover:text-cyan-300 underline underline-offset-2 decoration-cyan-400/30 hover:decoration-cyan-300/50 transition-colors"
                                data-testid={`knowledge-link-${kl.articleId}`}
                                onClick={() => {
                                  window.dispatchEvent(
                                    new CustomEvent('protopulse:navigate-knowledge', {
                                      detail: { articleId: kl.articleId },
                                    }),
                                  );
                                }}
                              >
                                Learn: {kl.title}
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {jobs.length === 0 && consoleLogs.length === 0 && (
          <p className="opacity-30 italic">No output yet. Run Verify or Upload to see logs.</p>
        )}
        <div ref={consoleEndRef} />
      </div>
    </ScrollArea>
  );
}
