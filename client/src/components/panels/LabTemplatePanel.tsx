/**
 * LabTemplatePanel — Browse, start, and track lab assignments
 *
 * Features:
 *  - Browse built-in labs with difficulty badges and time estimates
 *  - Filter by category and difficulty
 *  - Search labs by title, description, or tags
 *  - Start a lab and track step-by-step progress
 *  - View grading criteria and grade completed labs
 *  - Prerequisites display with completion status
 *  - Progress persistence via localStorage
 */

import { useState, useCallback, useMemo } from 'react';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Filter,
  GraduationCap,
  Lightbulb,
  Lock,
  Play,
  RotateCcw,
  Search,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useLabTemplates } from '@/lib/lab-templates';
import type { LabTemplate, LabDifficulty, LabCategory, LabStep, GradeResult } from '@/lib/lab-templates';

// ---------------------------------------------------------------------------
// Difficulty badge colors
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<LabDifficulty, string> = {
  beginner: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  intermediate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  advanced: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const CATEGORY_LABELS: Record<LabCategory, string> = {
  fundamentals: 'Fundamentals',
  analog: 'Analog',
  digital: 'Digital',
  microcontroller: 'Microcontroller',
  pcb: 'PCB',
  power: 'Power',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DifficultyBadge({ difficulty }: { difficulty: LabDifficulty }) {
  return (
    <Badge
      data-testid={`badge-difficulty-${difficulty}`}
      variant="outline"
      className={cn('text-xs capitalize', DIFFICULTY_COLORS[difficulty])}
    >
      {difficulty}
    </Badge>
  );
}

function ProgressBar({ percent, className }: { percent: number; className?: string }) {
  return (
    <div
      data-testid="progress-bar"
      className={cn('w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden', className)}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${percent}% complete`}
    >
      <div
        className={cn(
          'h-full rounded-full transition-all duration-300',
          percent === 100 ? 'bg-emerald-500' : 'bg-cyan-500',
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lab Card (list view)
// ---------------------------------------------------------------------------

function LabCard({
  lab,
  progress,
  onSelect,
}: {
  lab: LabTemplate;
  progress: { completed: number; total: number; percent: number };
  onSelect: () => void;
}) {
  const status = progress.percent === 100 ? 'completed' : progress.completed > 0 ? 'in-progress' : 'not-started';

  return (
    <button
      data-testid={`lab-card-${lab.id}`}
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 rounded-lg border transition-colors',
        'hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500',
        status === 'completed'
          ? 'border-emerald-500/30 bg-emerald-500/5'
          : status === 'in-progress'
            ? 'border-cyan-500/30 bg-cyan-500/5'
            : 'border-border bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-sm text-foreground leading-tight">{lab.title}</h3>
        {status === 'completed' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
      </div>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{lab.description}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <DifficultyBadge difficulty={lab.difficulty} />
        <Badge variant="outline" className="text-xs text-muted-foreground">
          <Clock className="w-3 h-3 mr-1" />
          {lab.estimatedMinutes}m
        </Badge>
        <Badge variant="outline" className="text-xs text-muted-foreground capitalize">
          {CATEGORY_LABELS[lab.category]}
        </Badge>
      </div>
      {progress.total > 0 && (
        <div className="mt-3">
          <ProgressBar percent={progress.percent} />
          <p className="text-xs text-muted-foreground mt-1">
            {progress.completed}/{progress.total} steps
          </p>
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Lab Detail View
// ---------------------------------------------------------------------------

function LabDetailView({
  lab,
  onBack,
  onStartLab,
  onCompleteStep,
  onResetLab,
  onGradeLab,
  progress,
  session,
  prerequisites,
}: {
  lab: LabTemplate;
  onBack: () => void;
  onStartLab: () => void;
  onCompleteStep: (stepId: string) => void;
  onResetLab: () => void;
  onGradeLab: (grades: GradeResult[]) => void;
  progress: { completed: number; total: number; percent: number };
  session: ReturnType<ReturnType<typeof useLabTemplates>['getSession']>;
  prerequisites: { met: boolean; missing: string[] };
}) {
  const [showGrading, setShowGrading] = useState(false);
  const [grades, setGrades] = useState<Record<string, number>>({});

  const isStarted = !!session;
  const isCompleted = session?.status === 'completed' || session?.status === 'graded';
  const isGraded = session?.status === 'graded';

  const handleGrade = useCallback(() => {
    const gradeResults: GradeResult[] = lab.gradingCriteria.map((gc) => ({
      criterionId: gc.id,
      awarded: grades[gc.id] ?? 0,
      maxPoints: gc.points,
    }));
    onGradeLab(gradeResults);
    setShowGrading(false);
  }, [grades, lab.gradingCriteria, onGradeLab]);

  return (
    <div className="flex flex-col h-full" data-testid="lab-detail-view">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <button
          data-testid="button-back-to-labs"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3 transition-colors"
          aria-label="Back to lab list"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Labs
        </button>
        <h2 className="text-lg font-semibold text-foreground mb-1">{lab.title}</h2>
        <p className="text-sm text-muted-foreground mb-3">{lab.description}</p>
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <DifficultyBadge difficulty={lab.difficulty} />
          <Badge variant="outline" className="text-xs text-muted-foreground">
            <Clock className="w-3 h-3 mr-1" />
            {lab.estimatedMinutes} min
          </Badge>
          <Badge variant="outline" className="text-xs text-muted-foreground">
            {lab.steps.length} steps
          </Badge>
        </div>

        {/* Prerequisites */}
        {lab.prerequisites.length > 0 && (
          <div className="mb-3" data-testid="prerequisites-section">
            <p className="text-xs font-medium text-muted-foreground mb-1">Prerequisites:</p>
            <div className="flex flex-wrap gap-1">
              {lab.prerequisites.map((prereqId) => {
                const isMissing = prerequisites.missing.includes(prereqId);
                return (
                  <Badge
                    key={prereqId}
                    variant="outline"
                    className={cn(
                      'text-xs',
                      isMissing
                        ? 'text-red-400 border-red-500/30'
                        : 'text-emerald-400 border-emerald-500/30',
                    )}
                  >
                    {isMissing ? <Lock className="w-3 h-3 mr-1" /> : <Check className="w-3 h-3 mr-1" />}
                    {prereqId}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {/* Progress */}
        {isStarted && (
          <div className="mb-3">
            <ProgressBar percent={progress.percent} />
            <p className="text-xs text-muted-foreground mt-1">
              {progress.completed}/{progress.total} steps completed ({progress.percent}%)
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {!isStarted && (
            <Button
              data-testid="button-start-lab"
              size="sm"
              onClick={onStartLab}
              disabled={!prerequisites.met}
              className="bg-cyan-600 hover:bg-cyan-700 text-white"
            >
              <Play className="w-3.5 h-3.5 mr-1" />
              Start Lab
            </Button>
          )}
          {isCompleted && !isGraded && (
            <Button
              data-testid="button-grade-lab"
              size="sm"
              onClick={() => setShowGrading(true)}
              variant="outline"
              className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
            >
              <Star className="w-3.5 h-3.5 mr-1" />
              Grade Lab
            </Button>
          )}
          {isGraded && session && (
            <Badge
              data-testid="badge-score"
              className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-sm px-3 py-1"
            >
              <Trophy className="w-3.5 h-3.5 mr-1" />
              Score: {session.totalScore}/{session.maxScore}
            </Badge>
          )}
          {isStarted && (
            <Button
              data-testid="button-reset-lab"
              size="sm"
              variant="ghost"
              onClick={onResetLab}
              className="text-muted-foreground hover:text-red-400"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1" />
              Reset
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Objectives */}
          <section data-testid="objectives-section">
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              Objectives
            </h3>
            <ul className="space-y-1.5">
              {lab.objectives.map((obj) => (
                <li key={obj.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <ChevronRight className="w-3 h-3 mt-0.5 text-cyan-500 shrink-0" />
                  {obj.description}
                </li>
              ))}
            </ul>
          </section>

          {/* Steps */}
          <section data-testid="steps-section">
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-cyan-400" />
              Steps
            </h3>
            <div className="space-y-2">
              {lab.steps.map((step) => {
                const stepProgress = session?.stepProgress.find((sp) => sp.stepId === step.id);
                const isStepCompleted = stepProgress?.completed ?? false;

                return (
                  <StepCard
                    key={step.id}
                    step={step}
                    completed={isStepCompleted}
                    active={isStarted && !isCompleted}
                    onComplete={() => onCompleteStep(step.id)}
                  />
                );
              })}
            </div>
          </section>

          {/* Grading Criteria */}
          <section data-testid="grading-section">
            <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <Star className="w-4 h-4 text-amber-400" />
              Grading Criteria ({lab.gradingCriteria.reduce((s, gc) => s + gc.points, 0)} pts total)
            </h3>
            <div className="space-y-2">
              {lab.gradingCriteria.map((gc) => {
                const gradeResult = session?.grades.find((g) => g.criterionId === gc.id);
                return (
                  <div
                    key={gc.id}
                    data-testid={`criterion-${gc.id}`}
                    className="flex items-start justify-between gap-2 p-2 rounded border border-border bg-card/50"
                  >
                    <div className="flex-1">
                      <p className="text-xs text-foreground">{gc.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {gc.type === 'rubric' ? 'Rubric' : 'Pass/Fail'} — {gc.points} pts
                      </p>
                      {gc.rubric && showGrading && (
                        <div className="mt-2 space-y-1">
                          {gc.rubric.map((level) => (
                            <button
                              key={level.points}
                              data-testid={`rubric-option-${gc.id}-${level.points}`}
                              onClick={() => setGrades((prev) => ({ ...prev, [gc.id]: level.points }))}
                              className={cn(
                                'w-full text-left text-xs p-1.5 rounded border transition-colors',
                                grades[gc.id] === level.points
                                  ? 'border-cyan-500 bg-cyan-500/10 text-cyan-300'
                                  : 'border-border hover:bg-accent/30 text-muted-foreground',
                              )}
                            >
                              {level.label} ({level.points} pts)
                            </button>
                          ))}
                        </div>
                      )}
                      {showGrading && gc.type === 'binary' && (
                        <div className="mt-2 flex gap-2">
                          <button
                            data-testid={`grade-pass-${gc.id}`}
                            onClick={() => setGrades((prev) => ({ ...prev, [gc.id]: gc.points }))}
                            className={cn(
                              'text-xs px-2 py-1 rounded border transition-colors',
                              grades[gc.id] === gc.points
                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                                : 'border-border hover:bg-accent/30 text-muted-foreground',
                            )}
                          >
                            Pass ({gc.points} pts)
                          </button>
                          <button
                            data-testid={`grade-fail-${gc.id}`}
                            onClick={() => setGrades((prev) => ({ ...prev, [gc.id]: 0 }))}
                            className={cn(
                              'text-xs px-2 py-1 rounded border transition-colors',
                              grades[gc.id] === 0
                                ? 'border-red-500 bg-red-500/10 text-red-300'
                                : 'border-border hover:bg-accent/30 text-muted-foreground',
                            )}
                          >
                            Fail (0 pts)
                          </button>
                        </div>
                      )}
                    </div>
                    {gradeResult && (
                      <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30 shrink-0">
                        {gradeResult.awarded}/{gradeResult.maxPoints}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            {showGrading && (
              <div className="mt-3 flex gap-2">
                <Button
                  data-testid="button-submit-grades"
                  size="sm"
                  onClick={handleGrade}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Submit Grades
                </Button>
                <Button
                  data-testid="button-cancel-grading"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowGrading(false)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step Card
// ---------------------------------------------------------------------------

function StepCard({
  step,
  completed,
  active,
  onComplete,
}: {
  step: LabStep;
  completed: boolean;
  active: boolean;
  onComplete: () => void;
}) {
  const [showHints, setShowHints] = useState(false);

  return (
    <div
      data-testid={`step-card-${step.id}`}
      className={cn(
        'p-3 rounded-lg border transition-colors',
        completed ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border bg-card/50',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono w-5">{step.order + 1}.</span>
          <h4 className="text-sm font-medium text-foreground">{step.title}</h4>
        </div>
        {completed && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
      </div>
      <p className="text-xs text-muted-foreground mb-2 ml-7">{step.instructions}</p>
      <p className="text-xs text-cyan-400/80 mb-2 ml-7 italic">
        Expected: {step.expectedOutcome}
      </p>

      <div className="flex items-center gap-2 ml-7">
        {active && !completed && (
          <Button
            data-testid={`button-complete-step-${step.id}`}
            size="sm"
            variant="outline"
            onClick={onComplete}
            className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
          >
            <Check className="w-3 h-3 mr-1" />
            Mark Complete
          </Button>
        )}
        {step.hints && step.hints.length > 0 && (
          <Button
            data-testid={`button-hints-${step.id}`}
            size="sm"
            variant="ghost"
            onClick={() => setShowHints(!showHints)}
            className="h-7 text-xs text-muted-foreground hover:text-amber-400"
          >
            <Lightbulb className="w-3 h-3 mr-1" />
            {showHints ? 'Hide' : 'Show'} Hints
          </Button>
        )}
      </div>

      {showHints && step.hints && (
        <div className="mt-2 ml-7 p-2 rounded bg-amber-500/5 border border-amber-500/20">
          <ul className="space-y-1">
            {step.hints.map((hint, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-amber-300/80">
                <Lightbulb className="w-3 h-3 mt-0.5 shrink-0" />
                {hint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export default function LabTemplatePanel() {
  const {
    labs,
    getLab,
    getLabsByCategory,
    getLabsByDifficulty,
    searchLabs,
    startLab,
    getSession,
    completeStep,
    getProgress,
    gradeLab,
    resetLab,
    checkPrerequisites,
  } = useLabTemplates();

  const [selectedLabId, setSelectedLabId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState<LabDifficulty | 'all'>('all');
  const [filterCategory, setFilterCategory] = useState<LabCategory | 'all'>('all');

  const allLabs = labs();

  const filteredLabs = useMemo(() => {
    let result = allLabs;

    if (searchQuery.trim()) {
      result = searchLabs(searchQuery.trim());
    }

    if (filterDifficulty !== 'all') {
      result = result.filter((l) => l.difficulty === filterDifficulty);
    }

    if (filterCategory !== 'all') {
      result = result.filter((l) => l.category === filterCategory);
    }

    return result;
  }, [allLabs, searchQuery, filterDifficulty, filterCategory, searchLabs]);

  const selectedLab = selectedLabId ? getLab(selectedLabId) : null;

  const handleStartLab = useCallback(() => {
    if (selectedLabId) {
      startLab(selectedLabId);
    }
  }, [selectedLabId, startLab]);

  const handleCompleteStep = useCallback(
    (stepId: string) => {
      if (selectedLabId) {
        completeStep(selectedLabId, stepId);
      }
    },
    [selectedLabId, completeStep],
  );

  const handleResetLab = useCallback(() => {
    if (selectedLabId) {
      resetLab(selectedLabId);
    }
  }, [selectedLabId, resetLab]);

  const handleGradeLab = useCallback(
    (grades: GradeResult[]) => {
      if (selectedLabId) {
        gradeLab(selectedLabId, grades);
      }
    },
    [selectedLabId, gradeLab],
  );

  // Lab detail view
  if (selectedLab) {
    return (
      <LabDetailView
        lab={selectedLab}
        onBack={() => setSelectedLabId(null)}
        onStartLab={handleStartLab}
        onCompleteStep={handleCompleteStep}
        onResetLab={handleResetLab}
        onGradeLab={handleGradeLab}
        progress={getProgress(selectedLab.id)}
        session={getSession(selectedLab.id)}
        prerequisites={checkPrerequisites(selectedLab.id)}
      />
    );
  }

  // Lab list view
  return (
    <div className="flex flex-col h-full" data-testid="lab-template-panel">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-2 mb-3">
          <GraduationCap className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-foreground">Lab Templates</h2>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Guided hands-on labs with objectives, step-by-step instructions, and grading criteria.
        </p>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-testid="input-search-labs"
            placeholder="Search labs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
          {searchQuery && (
            <button
              data-testid="button-clear-search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <select
            data-testid="filter-difficulty"
            value={filterDifficulty}
            onChange={(e) => setFilterDifficulty(e.target.value as LabDifficulty | 'all')}
            className="h-7 text-xs rounded border border-border bg-background text-foreground px-2"
            aria-label="Filter by difficulty"
          >
            <option value="all">All Levels</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
          <select
            data-testid="filter-category"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value as LabCategory | 'all')}
            className="h-7 text-xs rounded border border-border bg-background text-foreground px-2"
            aria-label="Filter by category"
          >
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Lab list */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          {filteredLabs.length === 0 ? (
            <div className="text-center py-8" data-testid="empty-state">
              <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm text-muted-foreground">No labs match your filters</p>
            </div>
          ) : (
            filteredLabs.map((lab) => (
              <LabCard
                key={lab.id}
                lab={lab}
                progress={getProgress(lab.id)}
                onSelect={() => setSelectedLabId(lab.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Footer stats */}
      <div className="p-3 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          {filteredLabs.length} of {allLabs.length} labs
        </p>
      </div>
    </div>
  );
}
