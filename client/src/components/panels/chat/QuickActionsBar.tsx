import { useRef, useState, useEffect, useCallback, memo } from 'react';
import { Zap, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { quickActionDescriptions } from './constants';

interface QuickActionsBarProps {
  onAction: (action: string) => void;
  isVisible: boolean;
  isGenerating: boolean;
}

function QuickActionsBar({ onAction, isVisible, isGenerating }: QuickActionsBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [isVisible, isGenerating, updateScrollState]);

  if (!isVisible || isGenerating) return null;

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 150, behavior: 'smooth' });
  };

  return (
    <div data-testid="quick-actions-bar" className="mt-2 relative">
      {/* Left fade gradient */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-card/40 to-transparent z-10 pointer-events-none transition-opacity",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto no-scrollbar pr-7"
      >
        {Object.entries(quickActionDescriptions).map(([action, desc]) => (
          <StyledTooltip key={action} content={desc} side="top">
              <button
                onClick={() => onAction(action)}
                data-testid={`quick-action-${action.toLowerCase().replace(/\s+/g, '-')}`}
                className="whitespace-nowrap px-2.5 py-1 bg-muted/30 border border-border text-[11px] text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1 shrink-0"
              >
                <Zap className="w-2.5 h-2.5" />
                {action}
              </button>
          </StyledTooltip>
        ))}
      </div>
      {/* Right fade gradient + scroll arrow */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-card/40 to-transparent z-10 flex items-center justify-end transition-opacity",
          canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <button
          onClick={scrollRight}
          data-testid="quick-actions-scroll-right"
          aria-label="Scroll for more actions"
          className="w-5 h-5 flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export default memo(QuickActionsBar);
