import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { TensionConflict } from '@/lib/tension-triage';
import { getTopTension, rankTensions } from '@/lib/tension-triage';

interface TensionTriagePanelProps {
  conflicts: TensionConflict[];
}

export default function TensionTriagePanel({ conflicts }: TensionTriagePanelProps) {
  const ranked = rankTensions(conflicts);
  const top = getTopTension(conflicts);

  return (
    <section className="rounded border border-border/70 bg-muted/20 p-3 space-y-2" data-testid="tension-triage-panel">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
        <h4 className="text-xs font-medium text-foreground">Tension Triage</h4>
        <Badge variant="outline" className="text-[10px]">
          {String(conflicts.length)} queued
        </Badge>
      </div>
      {top ? (
        <p className="text-[11px] text-muted-foreground" data-testid="tension-triage-next">
          Next: {top.conflict.title} ({top.consequenceSpeed})
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground" data-testid="tension-triage-empty">
          No active tensions.
        </p>
      )}
      {ranked.length > 0 ? (
        <ul className="text-[11px] text-muted-foreground space-y-1" data-testid="tension-triage-list">
          {ranked.slice(0, 4).map((item) => (
            <li key={item.conflict.id}>
              {item.conflict.title} - {item.consequenceSpeed}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

