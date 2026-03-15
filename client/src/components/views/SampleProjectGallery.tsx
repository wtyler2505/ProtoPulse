import { useState, useCallback, useMemo } from 'react';
import {
  Lightbulb,
  Thermometer,
  Cog,
  Volume2,
  Cloud,
  Clock,
  BookOpen,
  ChevronRight,
  GraduationCap,
  DollarSign,
  Filter,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  SAMPLE_PROJECTS,
  DIFFICULTY_META,
  CATEGORY_META,
  SampleProjectManager,
} from '@/lib/sample-projects';
import type { SampleProject, SampleDifficulty } from '@/lib/sample-projects';

// ---------------------------------------------------------------------------
// Icon map
// ---------------------------------------------------------------------------

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Thermometer,
  Cog,
  Volume2,
  Cloud,
};

function getSampleIcon(iconName: string): React.ComponentType<{ className?: string }> {
  return ICON_MAP[iconName] ?? BookOpen;
}

// ---------------------------------------------------------------------------
// Difficulty badge colors
// ---------------------------------------------------------------------------

const DIFFICULTY_BADGE_CLASSES: Record<SampleDifficulty, string> = {
  beginner: 'bg-green-500/15 text-green-400 border-green-500/30',
  intermediate: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-red-500/15 text-red-400 border-red-500/30',
};

// ---------------------------------------------------------------------------
// SampleCard
// ---------------------------------------------------------------------------

interface SampleCardProps {
  sample: SampleProject;
  onOpen: (sample: SampleProject) => void;
}

function SampleCard({ sample, onOpen }: SampleCardProps) {
  const Icon = getSampleIcon(sample.icon);
  const manager = SampleProjectManager.getInstance();
  const totalCost = manager.computeTotalCost(sample);
  const diffMeta = DIFFICULTY_META[sample.difficulty];
  const catMeta = CATEGORY_META[sample.category];

  return (
    <Card
      className={cn(
        'border-border bg-card cursor-pointer transition-all duration-200',
        'hover:border-[var(--accent-primary,#00F0FF)]/50 hover:shadow-[0_0_12px_rgba(0,240,255,0.1)]',
        'group flex flex-col',
      )}
      data-testid={`sample-card-${sample.id}`}
      onClick={() => {
        onOpen(sample);
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(sample);
        }
      }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[var(--accent-primary,#00F0FF)]/10 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-[var(--accent-primary,#00F0FF)]" />
            </div>
            <CardTitle className="text-sm font-semibold text-foreground group-hover:text-[var(--accent-primary,#00F0FF)] transition-colors">
              {sample.name}
            </CardTitle>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5" />
        </div>
        <CardDescription className="text-xs text-muted-foreground line-clamp-2 mt-1.5">
          {sample.description}
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-0 mt-auto">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3" data-testid={`sample-badges-${sample.id}`}>
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0', DIFFICULTY_BADGE_CLASSES[sample.difficulty])}
            data-testid={`sample-difficulty-${sample.id}`}
          >
            {diffMeta.label}
          </Badge>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 bg-muted/30 text-muted-foreground border-muted-foreground/30"
            data-testid={`sample-category-${sample.id}`}
          >
            {catMeta.label}
          </Badge>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1" data-testid={`sample-time-${sample.id}`}>
            <Clock className="w-3 h-3" />
            {sample.estimatedTime}
          </span>
          <span className="flex items-center gap-1" data-testid={`sample-cost-${sample.id}`}>
            <DollarSign className="w-3 h-3" />
            ${totalCost.toFixed(2)}
          </span>
          <span className="flex items-center gap-1" data-testid={`sample-parts-${sample.id}`}>
            {sample.preloadedData.bomItems.length} parts
          </span>
        </div>

        {/* Workflows preview */}
        <div className="mt-2 flex flex-wrap gap-1" data-testid={`sample-workflows-${sample.id}`}>
          {sample.workflows.slice(0, 3).map((w) => (
            <span
              key={w.name}
              className="text-[10px] text-muted-foreground/70 bg-muted/20 rounded px-1.5 py-0.5"
            >
              {w.name}
            </span>
          ))}
          {sample.workflows.length > 3 ? (
            <span className="text-[10px] text-muted-foreground/50">
              +{sample.workflows.length - 3} more
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SampleProjectGallery
// ---------------------------------------------------------------------------

interface SampleProjectGalleryProps {
  onOpenSample: (sample: SampleProject) => void;
}

export default function SampleProjectGallery({ onOpenSample }: SampleProjectGalleryProps) {
  const [difficultyFilter, setDifficultyFilter] = useState<SampleDifficulty | 'all'>('all');

  const manager = SampleProjectManager.getInstance();
  const difficulties = manager.getAvailableDifficulties();

  const filteredSamples = useMemo(() => {
    if (difficultyFilter === 'all') {
      return SAMPLE_PROJECTS;
    }
    return SAMPLE_PROJECTS.filter((s) => s.difficulty === difficultyFilter);
  }, [difficultyFilter]);

  const handleOpen = useCallback(
    (sample: SampleProject) => {
      onOpenSample(sample);
    },
    [onOpenSample],
  );

  return (
    <div data-testid="sample-project-gallery">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-4 h-4 text-[var(--accent-primary,#00F0FF)]" />
          <h3
            className="text-sm font-medium text-muted-foreground uppercase tracking-wider"
            data-testid="sample-projects-heading"
          >
            Sample Projects
          </h3>
        </div>

        {/* Difficulty filter pills */}
        <div className="flex items-center gap-1" data-testid="sample-difficulty-filter">
          <Filter className="w-3 h-3 text-muted-foreground mr-1" />
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              'h-6 px-2 text-xs',
              difficultyFilter === 'all'
                ? 'text-[var(--accent-primary,#00F0FF)] bg-[var(--accent-primary,#00F0FF)]/10'
                : 'text-muted-foreground',
            )}
            onClick={() => {
              setDifficultyFilter('all');
            }}
            data-testid="sample-filter-all"
          >
            All
          </Button>
          {difficulties.map((d) => (
            <Button
              key={d}
              variant="ghost"
              size="sm"
              className={cn(
                'h-6 px-2 text-xs',
                difficultyFilter === d
                  ? `${DIFFICULTY_META[d].color} bg-current/10`
                  : 'text-muted-foreground',
              )}
              onClick={() => {
                setDifficultyFilter(d);
              }}
              data-testid={`sample-filter-${d}`}
            >
              {DIFFICULTY_META[d].label}
            </Button>
          ))}
        </div>
      </div>

      {/* Card grid */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8"
        data-testid="sample-project-grid"
      >
        {filteredSamples.map((sample) => (
          <SampleCard key={sample.id} sample={sample} onOpen={handleOpen} />
        ))}
      </div>
    </div>
  );
}
