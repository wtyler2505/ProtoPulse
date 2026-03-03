import { BookOpen, Check, Clock, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useTutorial } from '@/lib/tutorial-context';
import { TUTORIALS, TUTORIAL_CATEGORIES } from '@/lib/tutorials';
import type { Tutorial } from '@/lib/tutorials';

function TutorialCard({
  tutorial,
  isCompleted,
  onStart,
}: {
  tutorial: Tutorial;
  isCompleted: boolean;
  onStart: () => void;
}) {
  return (
    <button
      data-testid={`tutorial-card-${tutorial.id}`}
      type="button"
      onClick={onStart}
      className={cn(
        'w-full text-left p-3 rounded-lg border transition-colors',
        'hover:border-cyan-400/40 hover:bg-zinc-800/50',
        isCompleted ? 'border-zinc-800 bg-zinc-900/50' : 'border-zinc-700 bg-zinc-900/80',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-zinc-200 truncate">{tutorial.title}</span>
            {isCompleted && (
              <Badge
                data-testid={`tutorial-badge-completed-${tutorial.id}`}
                variant="outline"
                className="shrink-0 text-[10px] px-1.5 py-0 h-5 text-emerald-400 border-emerald-400/30"
              >
                <Check className="h-3 w-3 mr-0.5" />
                Done
              </Badge>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{tutorial.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="flex items-center gap-1 text-[11px] text-zinc-600">
          <Clock className="h-3 w-3" />
          ~{tutorial.estimatedMinutes} min
        </span>
        <span className="text-[11px] text-zinc-600">{tutorial.steps.length} steps</span>
      </div>
    </button>
  );
}

export default function TutorialMenu({ onClose }: { onClose?: () => void }) {
  const { startTutorial, completedTutorials, resetProgress } = useTutorial();

  const handleStart = (tutorialId: string) => {
    startTutorial(tutorialId);
    onClose?.();
  };

  const categoriesWithTutorials = TUTORIAL_CATEGORIES.filter((cat) =>
    TUTORIALS.some((t) => t.category === cat.id),
  );

  return (
    <div data-testid="tutorial-menu" className="w-80">
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-cyan-400" />
          <h2 data-testid="tutorial-menu-title" className="text-sm font-semibold text-zinc-200">
            Interactive Tutorials
          </h2>
        </div>
        {completedTutorials.length > 0 && (
          <Button
            data-testid="tutorial-button-reset"
            variant="ghost"
            size="sm"
            onClick={resetProgress}
            className="h-6 px-2 text-[10px] text-zinc-500 hover:text-zinc-300"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      <div className="px-4 pb-2">
        <p className="text-xs text-zinc-500">
          Step-by-step guides to help you get the most out of ProtoPulse.
        </p>
      </div>

      <Separator className="bg-zinc-800" />

      <ScrollArea className="max-h-[400px]">
        <div className="p-3 space-y-4">
          {categoriesWithTutorials.map((category) => {
            const categoryTutorials = TUTORIALS.filter((t) => t.category === category.id);
            return (
              <div key={category.id} data-testid={`tutorial-category-${category.id}`}>
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 mb-2 px-1">
                  {category.label}
                </h3>
                <div className="space-y-2">
                  {categoryTutorials.map((tutorial) => (
                    <TutorialCard
                      key={tutorial.id}
                      tutorial={tutorial}
                      isCompleted={completedTutorials.includes(tutorial.id)}
                      onStart={() => {
                        handleStart(tutorial.id);
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {completedTutorials.length > 0 && (
        <>
          <Separator className="bg-zinc-800" />
          <div className="px-4 py-2">
            <p data-testid="tutorial-completion-count" className="text-[11px] text-zinc-600">
              {completedTutorials.length} of {TUTORIALS.length} tutorials completed
            </p>
          </div>
        </>
      )}
    </div>
  );
}
