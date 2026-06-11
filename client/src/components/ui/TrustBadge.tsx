import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type TrustBadgeKind = 'verified' | 'estimated' | 'unverified';

export interface TrustBadgeProps {
  kind: TrustBadgeKind;
  className?: string;
  label?: string;
}

const TRUST_STYLES: Record<TrustBadgeKind, string> = {
  verified: 'text-emerald-500 border-emerald-500/30',
  estimated: 'text-yellow-500 border-yellow-500/30',
  unverified: 'text-amber-500 border-amber-500/30',
};

const TRUST_LABELS: Record<TrustBadgeKind, string> = {
  verified: 'VERIFIED',
  estimated: 'ESTIMATED',
  unverified: 'UNVERIFIED',
};

export function TrustBadge({ kind, className, label }: TrustBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[9px] px-1 py-0 uppercase tracking-wider', TRUST_STYLES[kind], className)}
    >
      {label ?? TRUST_LABELS[kind]}
    </Badge>
  );
}

