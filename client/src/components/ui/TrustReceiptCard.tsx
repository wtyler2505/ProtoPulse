import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import type { TrustReceipt, TrustReceiptStatus } from '@/lib/feature-maturity';
import { cn } from '@/lib/utils';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Wrench,
} from 'lucide-react';

const STATUS_META: Record<TrustReceiptStatus, {
  className: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  ready: {
    className: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-50 [&>svg]:text-emerald-400',
    icon: CheckCircle2,
    label: 'Ready',
  },
  setup_required: {
    className: 'border-amber-500/30 bg-amber-500/5 text-amber-50 [&>svg]:text-amber-300',
    icon: Wrench,
    label: 'Setup required',
  },
  caution: {
    className: 'border-sky-500/30 bg-sky-500/5 text-sky-50 [&>svg]:text-sky-300',
    icon: AlertTriangle,
    label: 'Use with care',
  },
  experimental: {
    className: 'border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-50 [&>svg]:text-fuchsia-300',
    icon: FlaskConical,
    label: 'Experimental',
  },
};

interface TrustReceiptCardProps {
  receipt: TrustReceipt;
  className?: string;
  'data-testid'?: string;
}

export default function TrustReceiptCard({
  receipt,
  className,
  'data-testid': dataTestId,
}: TrustReceiptCardProps) {
  const meta = STATUS_META[receipt.status];
  const Icon = meta.icon;

  return (
    <Alert
      data-testid={dataTestId}
      className={cn('border shadow-none backdrop-blur-sm', meta.className, className)}
    >
      <Icon className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <span>{receipt.title}</span>
        {receipt.label && (
          <span className="rounded-full border border-current/20 px-1.5 py-0.5 text-[10px] font-medium tracking-wide">
            {receipt.label}
          </span>
        )}
        <span className="text-[10px] font-medium uppercase tracking-wide opacity-80">{meta.label}</span>
      </AlertTitle>
      <AlertDescription className="space-y-2 text-xs">
        <p>{receipt.summary}</p>
        {receipt.facts && receipt.facts.length > 0 && (
          <dl className="grid gap-2 sm:grid-cols-2">
            {receipt.facts.map((fact, index) => (
              <div
                key={`${fact.label}-${fact.value}-${index}`}
                className="rounded-md border border-current/10 bg-background/30 px-2 py-1.5"
              >
                <dt className="text-[10px] uppercase tracking-wide opacity-70">{fact.label}</dt>
                <dd className="mt-0.5 text-foreground">{fact.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {receipt.warnings && receipt.warnings.length > 0 && (
          <ul className="space-y-1 text-muted-foreground">
            {receipt.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>- {warning}</li>
            ))}
          </ul>
        )}
        {receipt.nextStep && (
          <p className="font-medium text-foreground/90">Next step: {receipt.nextStep}</p>
        )}
      </AlertDescription>
    </Alert>
  );
}
