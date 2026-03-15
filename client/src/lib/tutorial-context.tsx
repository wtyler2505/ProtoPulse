import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { getTutorialById } from '@/lib/tutorials';
import { getTutorialTarget, highlightElement } from '@/lib/tutorial-navigation';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import type { Tutorial, TutorialStep } from '@/lib/tutorials';

const STORAGE_KEY = 'protopulse-completed-tutorials';

function loadCompletedTutorials(): string[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')) {
        return parsed;
      }
    }
  } catch {
    // Corrupted storage — start fresh
  }
  return [];
}

function saveCompletedTutorials(ids: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

interface TutorialContextValue {
  activeTutorial: Tutorial | null;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  isActive: boolean;
  progress: { current: number; total: number };
  completedTutorials: string[];
  startTutorial: (tutorialId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipTutorial: () => void;
  endTutorial: () => void;
  resetProgress: () => void;
}

const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const { setActiveView } = useProjectMeta();
  const [activeTutorial, setActiveTutorial] = useState<Tutorial | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedTutorials, setCompletedTutorials] = useState<string[]>(loadCompletedTutorials);

  const currentStep = activeTutorial?.steps[currentStepIndex] ?? null;
  const isActive = activeTutorial !== null;

  const progress = useMemo(
    () => ({
      current: currentStepIndex + 1,
      total: activeTutorial?.steps.length ?? 0,
    }),
    [currentStepIndex, activeTutorial],
  );

  // Navigate to target view and highlight target element when step changes
  const highlightCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // Clean up previous highlight
    if (highlightCleanupRef.current) {
      highlightCleanupRef.current();
      highlightCleanupRef.current = null;
    }

    if (!currentStep) {
      return;
    }

    const target = getTutorialTarget(currentStep);
    if (!target) {
      return;
    }

    // Navigate to the target view
    setActiveView(target.view);

    // Highlight the target element after a brief delay to allow view to render
    if (target.elementSelector) {
      const timer = window.setTimeout(() => {
        highlightCleanupRef.current = highlightElement(
          target.elementSelector!,
          target.highlightDuration,
        );
      }, 100);

      return () => {
        window.clearTimeout(timer);
        if (highlightCleanupRef.current) {
          highlightCleanupRef.current();
          highlightCleanupRef.current = null;
        }
      };
    }
  }, [currentStep, setActiveView]);

  const startTutorial = useCallback((tutorialId: string) => {
    const tutorial = getTutorialById(tutorialId);
    if (tutorial) {
      setActiveTutorial(tutorial);
      setCurrentStepIndex(0);
    }
  }, []);

  const nextStep = useCallback(() => {
    if (!activeTutorial) {
      return;
    }
    if (currentStepIndex < activeTutorial.steps.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [activeTutorial, currentStepIndex]);

  const prevStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [currentStepIndex]);

  const skipTutorial = useCallback(() => {
    setActiveTutorial(null);
    setCurrentStepIndex(0);
  }, []);

  const endTutorial = useCallback(() => {
    if (activeTutorial) {
      const tutorialId = activeTutorial.id;
      setCompletedTutorials((prev) => {
        if (prev.includes(tutorialId)) {
          return prev;
        }
        const next = [...prev, tutorialId];
        saveCompletedTutorials(next);
        return next;
      });
    }
    setActiveTutorial(null);
    setCurrentStepIndex(0);
  }, [activeTutorial]);

  const resetProgress = useCallback(() => {
    setCompletedTutorials([]);
    saveCompletedTutorials([]);
  }, []);

  const value = useMemo<TutorialContextValue>(
    () => ({
      activeTutorial,
      currentStep,
      currentStepIndex,
      isActive,
      progress,
      completedTutorials,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      endTutorial,
      resetProgress,
    }),
    [
      activeTutorial,
      currentStep,
      currentStepIndex,
      isActive,
      progress,
      completedTutorials,
      startTutorial,
      nextStep,
      prevStep,
      skipTutorial,
      endTutorial,
      resetProgress,
    ],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial(): TutorialContextValue {
  const context = useContext(TutorialContext);
  if (context === undefined) {
    throw new Error('useTutorial must be used within a TutorialProvider');
  }
  return context;
}
