import { Ban, Bot, CircleHelp, Lightbulb, MapPin, PackageCheck, ShieldCheck, Sparkles, Wand2 } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VaultHoverCard } from '@/components/ui/vault-hover-card';
import type { BreadboardSelectionActionId } from '@/lib/breadboard-ai-prompts';
import type { BreadboardLayoutQualityResult } from '@/lib/breadboard-layout-quality';
import type {
  BreadboardPinRole,
  BreadboardPinMapEntry,
  BreadboardSelectedPartModel,
  BreadboardTrustTier,
} from '@/lib/breadboard-part-inspector';
import { cn } from '@/lib/utils';

type ValueOption = { value: number | string; label: string; hex?: string };

type SelectableFamily = 'resistor' | 'capacitor' | 'inductor' | 'led';

export interface BreadboardCoachActionItem {
  id: string;
  detail: string;
  label: string;
  status: 'pending' | 'staged' | 'advisory';
  tone: 'power' | 'ground' | 'support' | 'control' | 'communication' | 'analog';
}

interface BreadboardPartInspectorProps {
  canApplyCoachPlan: boolean;
  coachActionCount: number;
  coachActions: BreadboardCoachActionItem[];
  coachPlanVisible: boolean;
  layoutQuality: BreadboardLayoutQualityResult | null;
  model: BreadboardSelectedPartModel;
  onApplyCoachPlan: () => void;
  valueEditor:
    | {
        currentLabel: string;
        family: SelectableFamily;
        values: ValueOption[];
      }
    | null;
  onHoverPin: (pinId: string | null) => void;
  onSelectionAiAction: (actionId: BreadboardSelectionActionId) => void;
  onToggleCoachPlan: () => void;
  onValueChange: (value: number | string) => void;
}

function fitBadgeClass(fit: BreadboardSelectedPartModel['fit']): string {
  switch (fit) {
    case 'native':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
    case 'requires_jumpers':
      return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200';
    case 'breakout_required':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'not_breadboard_friendly':
    default:
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  }
}

function fitBadgeLabel(fit: BreadboardSelectedPartModel['fit']): string {
  switch (fit) {
    case 'native':
      return 'Native fit';
    case 'requires_jumpers':
      return 'Needs jumpers';
    case 'breakout_required':
      return 'Breakout required';
    case 'not_breadboard_friendly':
    default:
      return 'Bench-hostile';
  }
}

function qualityBadgeClass(quality: BreadboardSelectedPartModel['modelQuality']): string {
  switch (quality) {
    case 'verified':
      return 'border-violet-400/30 bg-violet-400/10 text-violet-200';
    case 'basic':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
    case 'community':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'ai_drafted':
    default:
      return 'border-border/70 bg-background/60 text-muted-foreground';
  }
}

function qualityBadgeLabel(quality: BreadboardSelectedPartModel['modelQuality']): string {
  switch (quality) {
    case 'verified':
      return 'Verified';
    case 'basic':
      return 'Pin-mapped';
    case 'community':
      return 'Community';
    case 'ai_drafted':
    default:
      return 'Draft';
  }
}

function pinMapBadgeClass(confidence: BreadboardSelectedPartModel['pinMapConfidence']): string {
  switch (confidence) {
    case 'exact':
      return 'border-primary/30 bg-primary/12 text-primary';
    case 'mixed':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'heuristic':
    default:
      return 'border-border/70 bg-background/60 text-muted-foreground';
  }
}

function pinMapBadgeLabel(confidence: BreadboardSelectedPartModel['pinMapConfidence']): string {
  switch (confidence) {
    case 'exact':
      return 'Connector-defined';
    case 'mixed':
      return 'Mixed map';
    case 'heuristic':
    default:
      return 'Heuristic map';
  }
}

/**
 * Returns the visual properties for a trust-tier badge.
 *
 * Each tier uses three redundant channels per WCAG 2.2 SC 1.4.1:
 *   color class + icon + text label — never color alone.
 *
 * Tiers (audit #173):
 *   verified-exact   → emerald  + ShieldCheck
 *   connector-defined → sky      + PackageCheck
 *   heuristic         → amber    + CircleHelp
 *   stash-absent      → rose     + Ban
 */
function trustTierBadge(tier: BreadboardTrustTier): {
  className: string;
  label: string;
  Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
} {
  switch (tier) {
    case 'verified-exact':
      return {
        className: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
        label: 'Verified exact',
        Icon: ShieldCheck,
      };
    case 'connector-defined':
      return {
        className: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
        label: 'Connector defined',
        Icon: PackageCheck,
      };
    case 'heuristic':
      return {
        className: 'border-amber-400/30 bg-amber-400/10 text-amber-100',
        label: 'Heuristic',
        Icon: CircleHelp,
      };
    case 'stash-absent':
      return {
        className: 'border-rose-500/30 bg-rose-500/10 text-rose-200',
        label: 'Stash absent',
        Icon: Ban,
      };
  }
}

function sideLabel(pin: BreadboardPinMapEntry): string {
  if (pin.side === 'rail') {
    return 'rail';
  }
  return pin.side;
}

function pinRoleBadgeClass(role: BreadboardPinRole): string {
  switch (role) {
    case 'power':
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
    case 'ground':
      return 'border-sky-400/30 bg-sky-400/10 text-sky-200';
    case 'clock':
      return 'border-violet-400/30 bg-violet-400/10 text-violet-200';
    case 'control':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'communication':
      return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200';
    case 'analog':
      return 'border-lime-400/30 bg-lime-400/10 text-lime-200';
    case 'passive':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200';
    case 'signal':
    default:
      return 'border-border/70 bg-background/60 text-muted-foreground';
  }
}

function pinRoleLabel(role: BreadboardPinRole): string {
  switch (role) {
    case 'power':
      return 'Power';
    case 'ground':
      return 'Ground';
    case 'clock':
      return 'Clock';
    case 'control':
      return 'Control';
    case 'communication':
      return 'Comms';
    case 'analog':
      return 'Analog';
    case 'passive':
      return 'Passive';
    case 'signal':
    default:
      return 'Signal';
  }
}

function coachToneClass(tone: BreadboardCoachActionItem['tone']): string {
  switch (tone) {
    case 'power':
      return 'border-rose-400/25 bg-rose-400/8';
    case 'ground':
      return 'border-sky-400/25 bg-sky-400/8';
    case 'control':
      return 'border-amber-400/25 bg-amber-400/8';
    case 'communication':
      return 'border-cyan-400/25 bg-cyan-400/8';
    case 'analog':
      return 'border-lime-400/25 bg-lime-400/8';
    case 'support':
    default:
      return 'border-primary/20 bg-primary/8';
  }
}

function coachStatusClass(status: BreadboardCoachActionItem['status']): string {
  switch (status) {
    case 'staged':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
    case 'advisory':
      return 'border-border/70 bg-background/60 text-muted-foreground';
    case 'pending':
    default:
      return 'border-primary/20 bg-primary/10 text-primary';
  }
}

function coachStatusLabel(status: BreadboardCoachActionItem['status']): string {
  switch (status) {
    case 'staged':
      return 'Staged';
    case 'advisory':
      return 'Lane';
    case 'pending':
    default:
      return 'Pending';
  }
}

function layoutBandClass(band: BreadboardLayoutQualityResult['band']): string {
  switch (band) {
    case 'dialed_in':
      return 'border-emerald-400/30 bg-emerald-400/12 text-emerald-200';
    case 'solid':
      return 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200';
    case 'developing':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-200';
    case 'fragile':
    default:
      return 'border-rose-400/30 bg-rose-400/10 text-rose-200';
  }
}

function layoutMetricToneClass(tone: BreadboardLayoutQualityResult['metrics'][number]['tone']): string {
  switch (tone) {
    case 'good':
      return 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200';
    case 'watch':
      return 'border-amber-400/25 bg-amber-400/10 text-amber-100';
    case 'risk':
    default:
      return 'border-rose-400/25 bg-rose-400/10 text-rose-100';
  }
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/45 px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function BreadboardPartInspector({
  canApplyCoachPlan,
  coachActionCount,
  coachActions = [],
  coachPlanVisible,
  layoutQuality,
  model,
  onApplyCoachPlan,
  valueEditor,
  onHoverPin,
  onSelectionAiAction,
  onToggleCoachPlan,
  onValueChange,
}: BreadboardPartInspectorProps) {
  const pendingCoachActionCount = coachActions.filter((action) => action.status === 'pending').length;
  const canReviewCoachPlan = coachActions.length > 0;
  const coachPlanToggleLabel = coachPlanVisible
    ? 'Hide bench plan'
    : coachActionCount > 0
      ? `Preview support plan (${String(coachActionCount)})`
      : 'Show bench plan';

  return (
    <aside
      data-testid="breadboard-part-inspector"
      className="absolute right-3 top-3 z-20 flex w-[330px] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-[24px] border border-border/70 bg-[linear-gradient(180deg,rgba(10,13,19,0.98),rgba(6,8,12,0.98))] shadow-[0_28px_120px_rgba(0,0,0,0.44)] backdrop-blur-xl"
    >
      <div className="border-b border-border/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/90">Bench Inspector</p>
            <h3 className="mt-1 truncate text-lg font-semibold text-foreground">
              {model.refDes} ·{' '}
              <VaultHoverCard topic={model.mpn ?? model.title}>
                <span
                  className="cursor-help underline decoration-dotted decoration-primary/40 underline-offset-4"
                  data-testid="bench-inspector-title-vault-trigger"
                >
                  {model.title}
                </span>
              </VaultHoverCard>
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {model.manufacturer ?? 'Unknown maker'}{model.mpn ? ` · ${model.mpn}` : ''}
            </p>
          </div>
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
            <PackageCheck className="h-4.5 w-4.5" />
          </span>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-[0.12em]', fitBadgeClass(model.fit))}>
            {fitBadgeLabel(model.fit)}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-[0.12em]', qualityBadgeClass(model.modelQuality))}>
            {qualityBadgeLabel(model.modelQuality)}
          </Badge>
          <Badge variant="outline" className={cn('text-[10px] uppercase tracking-[0.12em]', pinMapBadgeClass(model.pinMapConfidence))}>
            {pinMapBadgeLabel(model.pinMapConfidence)}
          </Badge>
          {(() => {
            const { className, label, Icon } = trustTierBadge(model.trustTier);
            return (
              <Badge
                variant="outline"
                className={cn('inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.12em]', className)}
              >
                <Icon className="h-3 w-3 shrink-0" aria-hidden />
                {label}
              </Badge>
            );
          })()}
          <Badge variant="outline" className="border-border/70 bg-background/60 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {model.pinCount} pins
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <StatCard label="On hand" value={String(model.ownedQuantity)} />
          <StatCard label="Missing" value={String(model.missingQuantity)} />
          <StatCard label="Need" value={String(model.requiredQuantity)} />
          <StatCard label="Bench state" value={model.readyNow ? 'Ready now' : 'Needs parts'} />
        </div>
      </div>

      <ScrollArea className="max-h-[calc(100vh-14rem)]">
        <div className="space-y-4 p-4">
          <section className="rounded-2xl border border-border/60 bg-background/45 p-3" data-testid="breadboard-part-inspector-trust">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">Bench trust</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.pinTrustSummary}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{model.fitSummary}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{model.trustSummary}</p>
                <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-primary/85">
                  {model.partFamily} · {model.verificationLevel.replace('-', ' ')}
                </p>
                {!model.authoritativeWiringAllowed && (
                  <div className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/8 px-3 py-2 text-[11px] leading-relaxed text-amber-100">
                    ProtoPulse can plan around this part provisionally, but exact hookup guidance should wait until the part is verified.
                  </div>
                )}
              </div>
            </div>
          </section>

          {model.verifiedBoard && (
            <section className="rounded-2xl border border-cyan-400/25 bg-cyan-400/6 p-3" data-testid="breadboard-part-inspector-verified-board">
              <div className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-cyan-400" />
                <div>
                  <p className="text-xs font-semibold text-cyan-300">Verified Board</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    This part matched a verified board definition with pin-accurate data from official datasheets.
                  </p>
                </div>
              </div>
              {model.boardWarnings && model.boardWarnings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-400/90">Safety Warnings</p>
                  {model.boardWarnings.map((warning, i) => (
                    <p key={i} className="text-[11px] leading-relaxed text-amber-200/80">{warning}</p>
                  ))}
                </div>
              )}
              {model.bootPinWarnings && model.bootPinWarnings.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-orange-400/90">Boot / Strapping Pins</p>
                  {model.bootPinWarnings.map((warning, i) => (
                    <p key={i} className="text-[11px] leading-relaxed text-orange-200/70">{warning}</p>
                  ))}
                </div>
              )}
              {model.adcWifiConflict && model.adcWifiConflictPinIds && model.adcWifiConflictPinIds.length > 0 && (
                <div className="mt-3 rounded-xl border border-red-400/25 bg-red-400/8 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-red-400/90">ADC2 WiFi Conflict</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-red-200/80">
                    Pins {model.adcWifiConflictPinIds.join(', ')} use ADC2 channels that are <strong>unavailable when WiFi is active</strong>. Use ADC1 channels (GPIO 32-39) instead.
                  </p>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-border/60 bg-background/45 p-3" data-testid="breadboard-part-inspector-inventory">
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">Stash status</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.inventorySummary}</p>
                {model.storageLocation && (
                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-primary/85">
                    Stored in {model.storageLocation}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-primary/20 bg-primary/6 p-3" data-testid="breadboard-part-inspector-coach">
            <div className="flex items-start gap-2">
              <Lightbulb className="mt-0.5 h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-semibold text-foreground">Bench coach</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{model.coach.headline}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatCard label="Exact pins" value={String(model.exactPinCount)} />
              <StatCard label="Heuristic pins" value={String(model.heuristicPinCount)} />
              <StatCard label="Critical pins" value={String(model.criticalPinCount)} />
              <StatCard label="Power / Gnd" value={`${String(model.roleCounts.power)} / ${String(model.roleCounts.ground)}`} />
            </div>

            <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
              <p>{model.coach.orientationSummary}</p>
              <p>{model.coach.railStrategy}</p>
            </div>

            {layoutQuality && (
              <div
                className="mt-3 rounded-2xl border border-border/60 bg-[linear-gradient(180deg,rgba(4,8,15,0.86),rgba(7,11,19,0.78))] p-3"
                data-testid="breadboard-part-inspector-layout-quality"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/85">Layout quality</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{layoutQuality.headline}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{layoutQuality.summary}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Score</p>
                    <p className="mt-1 text-2xl font-semibold text-foreground">{layoutQuality.score}</p>
                    <Badge
                      variant="outline"
                      className={cn('mt-2 text-[10px] uppercase tracking-[0.12em]', layoutBandClass(layoutQuality.band))}
                    >
                      {layoutQuality.label}
                    </Badge>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  {layoutQuality.metrics.map((metric) => (
                    <div
                      key={metric.id}
                      data-testid={`breadboard-layout-quality-metric-${metric.id}`}
                      className={cn('rounded-xl border px-3 py-2', layoutMetricToneClass(metric.tone))}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.14em]">{metric.label}</p>
                        <p className="text-sm font-semibold">{metric.score}</p>
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed opacity-90">{metric.detail}</p>
                    </div>
                  ))}
                </div>

                {layoutQuality.strengths.length > 0 && (
                  <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/8 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-200">What is working</p>
                    <div className="mt-2 space-y-1.5">
                      {layoutQuality.strengths.map((item) => (
                        <p key={item} className="text-xs leading-relaxed text-emerald-50/90">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {layoutQuality.risks.length > 0 && (
                  <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/8 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Watch next</p>
                    <div className="mt-2 space-y-1.5">
                      {layoutQuality.risks.map((item) => (
                        <p key={item} className="text-xs leading-relaxed text-amber-50/90">
                          • {item}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {coachActions.length > 0 && (
              <div className="mt-3" data-testid="breadboard-part-inspector-plan">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/85">Bench plan</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] uppercase tracking-[0.12em]',
                      pendingCoachActionCount > 0
                        ? 'border-primary/20 bg-primary/10 text-primary'
                        : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
                    )}
                  >
                    {pendingCoachActionCount > 0 ? `${String(pendingCoachActionCount)} pending` : 'All staged'}
                  </Badge>
                </div>

                <div className="mt-2 space-y-2">
                  {coachActions.map((action, index) => (
                    <div
                      key={action.id}
                      data-testid={`breadboard-coach-action-${action.id}`}
                      className={cn('rounded-xl border px-3 py-2', coachToneClass(action.tone))}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground/92">
                            {String(index + 1)}. {action.label}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{action.detail}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={cn('shrink-0 text-[10px] uppercase tracking-[0.12em]', coachStatusClass(action.status))}
                        >
                          {coachStatusLabel(action.status)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {model.coach.supportParts.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/85">Support parts</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {model.coach.supportParts.map((part) => (
                    <Badge
                      key={part}
                      variant="outline"
                      className="border-primary/20 bg-primary/8 text-[10px] uppercase tracking-[0.12em] text-primary"
                    >
                      {part}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {model.coach.nextMoves.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary/85">Next moves</p>
                <div className="mt-2 space-y-1.5">
                  {model.coach.nextMoves.map((step) => (
                    <p key={step} className="text-xs leading-relaxed text-foreground/90">
                      • {step}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {model.coach.cautions.length > 0 && (
              <div className="mt-3 rounded-xl border border-amber-400/20 bg-amber-400/8 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">Bench cautions</p>
                <div className="mt-2 space-y-1.5">
                  {model.coach.cautions.map((warning) => (
                    <p key={warning} className="text-xs leading-relaxed text-amber-50/90">
                      • {warning}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-3 grid gap-2 sm:grid-cols-2" data-testid="breadboard-part-inspector-coach-actions">
              <Button
                type="button"
                size="sm"
                variant={coachPlanVisible ? 'secondary' : 'outline'}
                data-testid="button-breadboard-coach-preview-plan"
                className="justify-start gap-2"
                disabled={!canReviewCoachPlan}
                onClick={onToggleCoachPlan}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {coachPlanToggleLabel}
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid="button-breadboard-coach-apply-plan"
                className="justify-start gap-2"
                disabled={!canApplyCoachPlan}
                onClick={onApplyCoachPlan}
              >
                <Wand2 className="h-3.5 w-3.5" />
                Apply support plan
              </Button>
            </div>
          </section>

          {valueEditor && (
            <section className="rounded-2xl border border-border/60 bg-background/45 p-3" data-testid="breadboard-part-inspector-value-editor">
              <p className="text-xs font-semibold text-foreground">Quick values</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Change the selected {valueEditor.family} value without leaving the breadboard bench.
              </p>
              <p className="mt-2 text-[11px] font-mono text-primary">{valueEditor.currentLabel}</p>
              <div className="mt-3 max-h-36 overflow-y-auto">
                {valueEditor.family === 'led' ? (
                  <div className="grid grid-cols-3 gap-1.5">
                    {valueEditor.values.map((value) => (
                      <button
                        key={String(value.value)}
                        type="button"
                        data-testid={`breadboard-value-option-${String(value.value)}`}
                        className={cn(
                          'h-7 rounded-md border transition-colors',
                          valueEditor.currentLabel === value.value
                            ? 'border-primary bg-primary/20'
                            : 'border-border hover:border-primary/40',
                        )}
                        style={{ backgroundColor: value.hex ?? '#7c3aed' }}
                        title={value.label}
                        onClick={() => onValueChange(value.value)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {valueEditor.values.map((value) => (
                      <button
                        key={String(value.value)}
                        type="button"
                        data-testid={`breadboard-value-option-${String(value.label)}`}
                        className={cn(
                          'w-full rounded-md px-2 py-1 text-left text-[11px] font-mono transition-colors',
                          valueEditor.currentLabel === value.label
                            ? 'bg-primary/18 text-primary'
                            : 'bg-background/35 text-muted-foreground hover:bg-muted hover:text-foreground',
                        )}
                        onClick={() => onValueChange(value.value)}
                      >
                        {value.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-border/60 bg-background/45 p-3" data-testid="breadboard-part-inspector-pinmap">
            <p className="text-xs font-semibold text-foreground">Pin map</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Hover any pin to spotlight its breadboard hole on the canvas.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <StatCard label="Power pins" value={String(model.roleCounts.power)} />
              <StatCard label="Comms pins" value={String(model.roleCounts.communication)} />
              <StatCard label="Analog pins" value={String(model.roleCounts.analog)} />
              <StatCard label="Passive pins" value={String(model.roleCounts.passive)} />
            </div>
            <div className="mt-3 space-y-1.5">
              {model.pins.map((pin) => (
                <button
                  key={pin.id}
                  type="button"
                  data-testid={`breadboard-part-pin-${pin.id}`}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/35 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/6"
                  onMouseEnter={() => onHoverPin(pin.id)}
                  onMouseLeave={() => onHoverPin(null)}
                  onFocus={() => onHoverPin(pin.id)}
                  onBlur={() => onHoverPin(null)}
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground">{pin.label}</p>
                    {pin.description && (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{pin.description}</p>
                    )}
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn('text-[10px] uppercase tracking-[0.12em]', pinRoleBadgeClass(pin.role))}
                      >
                        {pinRoleLabel(pin.role)}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] uppercase tracking-[0.12em]',
                          pin.confidence === 'exact'
                            ? 'border-primary/25 bg-primary/12 text-primary'
                            : 'border-border/70 bg-background/60 text-muted-foreground',
                        )}
                      >
                        {pin.confidence === 'exact' ? 'Exact' : 'Layout'}
                      </Badge>
                      {pin.isCritical && (
                        <Badge
                          variant="outline"
                          className="border-amber-400/30 bg-amber-400/10 text-[10px] uppercase tracking-[0.12em] text-amber-200"
                        >
                          Critical
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-mono text-primary">{pin.coordLabel}</p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {pin.source === 'connector' ? 'Exact' : 'Layout'} · {sideLabel(pin)}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-primary/20 bg-primary/5 p-3" data-testid="breadboard-part-inspector-ai">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-foreground">Gemini ER on this part</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Selection-aware reasoning for pinout review, layout planning, and plain-English explanations.
                </p>
              </div>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Bot className="h-4 w-4" />
              </span>
            </div>

            <div className="mt-3 grid gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="button-breadboard-ai-explain-selected"
                className="justify-start gap-2"
                onClick={() => onSelectionAiAction('explain_selected_part')}
              >
                <Bot className="h-3.5 w-3.5" />
                Explain selected part
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                data-testid="button-breadboard-ai-audit-pinout"
                className="justify-start gap-2"
                onClick={() => onSelectionAiAction('audit_selected_pinout')}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Audit pinout risk
              </Button>
              <Button
                type="button"
                size="sm"
                data-testid="button-breadboard-ai-layout-around-part"
                className="justify-start gap-2"
                onClick={() => onSelectionAiAction('plan_layout_around_selected_part')}
              >
                <Wand2 className="h-3.5 w-3.5" />
                {model.authoritativeWiringAllowed ? 'Gemini ER: plan around this part' : 'Gemini ER: provisional plan around this part'}
              </Button>
            </div>
          </section>
        </div>
      </ScrollArea>
    </aside>
  );
}
