import { AlertTriangle, Gauge } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { DesignDecayRecommendation } from '@/lib/design-decay';

interface DesignDecayCardProps {
  recommendation: DesignDecayRecommendation;
}

function toLabel(speed: DesignDecayRecommendation['consequenceSpeed']): string {
  if (speed === 'session') {
    return 'Session';
  }
  if (speed === 'multi-session') {
    return 'Multi-Session';
  }
  return 'Slow';
}

export default function DesignDecayCard({ recommendation }: DesignDecayCardProps) {
  const speedLabel = toLabel(recommendation.consequenceSpeed);
  return (
    <div
      className="border-b border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5"
      data-testid="design-decay-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Gauge className="h-3.5 w-3.5 text-amber-200" />
            <span className="text-[11px] font-medium text-amber-100">Design Decay Priority</span>
            <Badge variant="outline" className="border-amber-300/50 text-amber-100 text-[9px]">
              {speedLabel}
            </Badge>
          </div>
          <p className="text-[11px] text-amber-50" data-testid="design-decay-message">
            {recommendation.violation.message}
          </p>
          <p className="text-[11px] text-amber-100/90" data-testid="design-decay-action">
            Next: {recommendation.action}
          </p>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-amber-200/90">
          <AlertTriangle className="h-3 w-3" />
          <span data-testid="design-decay-score">Score {String(recommendation.score)}</span>
        </div>
      </div>
    </div>
  );
}
