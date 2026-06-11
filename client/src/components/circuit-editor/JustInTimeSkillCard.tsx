import { useState } from 'react';
import { TerminalSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { copyToClipboard } from '@/lib/clipboard';
import type { JustInTimeSkillRecommendation } from '@/lib/just-in-time-skills';
import { useJitRunHistory } from '@/lib/use-jit-run-history';

interface JustInTimeSkillCardProps {
  recommendation: JustInTimeSkillRecommendation;
}

export default function JustInTimeSkillCard({ recommendation }: JustInTimeSkillCardProps) {
  const [copied, setCopied] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const { items: recentRuns, loading: isRefreshing, refresh } = useJitRunHistory(3);

  const refreshLatestRunStatus = async () => {
    try {
      const latestItems = await refresh();
      const latest = latestItems.find((item) => item.command === recommendation.command);
      if (latest?.status) {
        setRunStatus(latest.status);
        setRunMessage(latest.message ?? null);
      }
    } catch {
      // Keep card UX stable if status lookup fails.
    }
  };

  const handleCopy = async () => {
    const ok = await copyToClipboard(recommendation.command);
    setCopied(ok);
    if (ok) {
      window.setTimeout(() => setCopied(false), 1200);
    }
  };

  const handleRun = () => {
    setRunStatus('queued');
    setRunMessage(`Waiting for command status: ${recommendation.command}`);
    window.dispatchEvent(new CustomEvent('protopulse:jit-skill-run', {
      detail: {
        command: recommendation.command,
        ruleType: recommendation.ruleType,
        violationId: recommendation.violationId,
      },
    }));
    [500, 1500, 3000, 5000].forEach((delayMs) => {
      window.setTimeout(() => { void refreshLatestRunStatus(); }, delayMs);
    });
  };

  return (
    <div
      className="border-b border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1.5"
      data-testid="jit-skill-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TerminalSquare className="h-3.5 w-3.5 text-cyan-200" />
            <span className="text-[11px] font-medium text-cyan-100">Just-in-Time Skill</span>
            <Badge variant="outline" className="border-cyan-300/50 text-cyan-100 text-[9px]">
              Suggested
            </Badge>
          </div>
          <p className="text-[11px] text-cyan-50" data-testid="jit-skill-title">{recommendation.title}</p>
          <p className="text-[11px] text-cyan-100/90" data-testid="jit-skill-description">{recommendation.description}</p>
          {runStatus ? (
            <p className="text-[11px] text-cyan-100/85" data-testid="jit-skill-run-status">
              Status: {runStatus}{runMessage ? ` — ${runMessage}` : ''}
            </p>
          ) : null}
          {recentRuns.length > 0 ? (
            <div className="text-[11px] text-cyan-100/80 space-y-0.5" data-testid="jit-recent-runs">
              <p className="text-cyan-200/90">Recent runs:</p>
              {recentRuns.map((run, index) => (
                <p key={`${run.command ?? 'unknown'}-${run.completedAt ?? run.createdAt ?? index}`}>
                  {run.command ?? 'unknown'} — {run.status ?? 'unknown'}
                </p>
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-col items-end gap-2">
          <code
            className="text-[10px] px-1.5 py-0.5 bg-background/60 border border-cyan-300/30 text-cyan-100"
            data-testid="jit-skill-command"
          >
            {recommendation.command}
          </code>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              data-testid="jit-skill-copy"
              onClick={() => void handleCopy()}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              data-testid="jit-skill-run"
              onClick={handleRun}
            >
              Run
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-5 px-1.5 text-[10px]"
              data-testid="jit-skill-refresh"
              onClick={() => void refreshLatestRunStatus()}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
