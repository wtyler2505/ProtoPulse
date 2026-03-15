/**
 * MilestonePanel — BL-0314
 *
 * Achievement card grid showing progression from beginner to fab-ready.
 * Locked milestones are greyed out with lock icon; unlocked milestones
 * show the achievement icon with unlock timestamp. A progress bar at the
 * top shows overall completion.
 */

import { useMemo } from 'react';
import {
  Zap,
  Activity,
  CircuitBoard,
  Download,
  ShieldCheck,
  ClipboardList,
  ShoppingBag,
  Trophy,
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useMilestones } from '@/lib/progress-milestones';
import type { MilestoneId } from '@/lib/progress-milestones';

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Zap,
  Activity,
  CircuitBoard,
  Download,
  ShieldCheck,
  ClipboardList,
  ShoppingBag,
  Trophy,
};

function getMilestoneIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] ?? Zap;
}

// ---------------------------------------------------------------------------
// MilestoneCard
// ---------------------------------------------------------------------------

interface MilestoneCardProps {
  name: string;
  description: string;
  icon: string;
  reward: string;
  unlocked: boolean;
  unlockedAt?: number;
  isNext: boolean;
}

function MilestoneCard({ name, description, icon, reward, unlocked, unlockedAt, isNext }: MilestoneCardProps) {
  const Icon = getMilestoneIcon(icon);

  const formattedDate = useMemo(() => {
    if (!unlockedAt) { return null; }
    return new Date(unlockedAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }, [unlockedAt]);

  return (
    <div
      data-testid={`milestone-card-${name.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        'relative rounded-lg border p-4 transition-all duration-300',
        unlocked
          ? 'border-primary/50 bg-primary/5 shadow-[0_0_12px_rgba(0,240,255,0.1)]'
          : isNext
            ? 'border-border/60 bg-card/50 ring-1 ring-primary/20'
            : 'border-border/30 bg-card/20 opacity-60',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
            unlocked
              ? 'bg-primary/20 text-primary'
              : 'bg-muted/40 text-muted-foreground',
          )}
          data-testid={unlocked ? 'milestone-icon-unlocked' : 'milestone-icon-locked'}
        >
          {unlocked ? (
            <Icon className="h-5 w-5" />
          ) : (
            <Lock className="h-4 w-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'text-sm font-semibold leading-tight',
              unlocked ? 'text-foreground' : 'text-muted-foreground',
            )}
          >
            {name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
            {unlocked ? reward : description}
          </p>
          {unlocked && formattedDate && (
            <p className="mt-1.5 text-[10px] text-muted-foreground/70" data-testid="milestone-date">
              Unlocked {formattedDate}
            </p>
          )}
          {isNext && !unlocked && (
            <p className="mt-1.5 text-[10px] text-primary/80 font-medium" data-testid="milestone-next-badge">
              Up next
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MilestonePanel
// ---------------------------------------------------------------------------

export default function MilestonePanel() {
  const { milestones, unlocked, next, progress, unlockedCount, totalCount } = useMilestones();

  const unlockMap = useMemo(() => {
    const map = new Map<MilestoneId, number>();
    for (const u of unlocked) {
      map.set(u.milestoneId, u.unlockedAt);
    }
    return map;
  }, [unlocked]);

  const progressPercent = Math.round(progress * 100);

  return (
    <div className="flex h-full flex-col overflow-hidden" data-testid="milestone-panel">
      {/* Header */}
      <div className="shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-foreground">Progress Milestones</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {unlockedCount} of {totalCount} milestones unlocked
            </p>
          </div>
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary"
            data-testid="milestone-trophy-icon"
          >
            <Trophy className="h-4 w-4" />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3" data-testid="milestone-progress-bar">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Progress</span>
            <span data-testid="milestone-progress-percent">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted/30 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
              style={{ width: `${String(progressPercent)}%` }}
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Milestone progress: ${String(progressPercent)}%`}
            />
          </div>
        </div>
      </div>

      {/* Milestone grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid gap-3" data-testid="milestone-grid">
          {milestones.map((m) => {
            const isUnlocked = unlockMap.has(m.id);
            const isNext = next?.id === m.id;
            return (
              <MilestoneCard
                key={m.id}
                name={m.name}
                description={m.description}
                icon={m.icon}
                reward={m.reward}
                unlocked={isUnlocked}
                unlockedAt={unlockMap.get(m.id)}
                isNext={isNext}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
