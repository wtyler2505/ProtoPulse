import { Badge } from '@/components/ui/badge';
import { getFeatureMaturityLabel, type FeatureMaturity } from '@/lib/feature-maturity';
import { cn } from '@/lib/utils';

const MATURITY_STYLES: Record<FeatureMaturity, string> = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400',
  setup_required: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  experimental: 'border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-300',
  advanced: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
};

interface FeatureMaturityBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  maturity: FeatureMaturity;
  label?: string;
}

export default function FeatureMaturityBadge({
  maturity,
  label,
  className,
  ...props
}: FeatureMaturityBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[9px] px-1.5 py-0 uppercase tracking-wide', MATURITY_STYLES[maturity], className)}
      {...props}
    >
      {label ?? getFeatureMaturityLabel(maturity)}
    </Badge>
  );
}
