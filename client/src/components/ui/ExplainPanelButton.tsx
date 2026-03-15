import { memo, useCallback } from 'react';
import { HelpCircle, ArrowRight } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { getPanelExplanation } from '@/lib/panel-explainer';
import type { ViewMode } from '@/lib/project-context';
import type { PanelExplanation } from '@/lib/panel-explainer';

interface ExplainPanelButtonProps {
  /** The current active view to explain. */
  view: ViewMode;
  /** Callback to navigate to a related view. */
  onNavigate?: (view: ViewMode) => void;
  /** Additional CSS classes for the trigger button. */
  className?: string;
}

function ExplainPanelButtonInner({ view, onNavigate, className }: ExplainPanelButtonProps) {
  const explanation = getPanelExplanation(view);

  const handleNavigate = useCallback(
    (targetView: ViewMode) => {
      onNavigate?.(targetView);
    },
    [onNavigate],
  );

  if (!explanation) {
    return null;
  }

  return (
    <Popover>
      <StyledTooltip content="Explain this panel" side="bottom">
        <PopoverTrigger asChild>
          <button
            data-testid="explain-panel-button"
            className={
              className ??
              'p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            }
            aria-label="Explain this panel"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </PopoverTrigger>
      </StyledTooltip>
      <PopoverContent
        className="w-80 p-0 bg-card border-border shadow-xl"
        align="end"
        sideOffset={8}
      >
        <ExplainPanelContent explanation={explanation} onNavigate={handleNavigate} />
      </PopoverContent>
    </Popover>
  );
}

const ExplainPanelButton = memo(ExplainPanelButtonInner);
ExplainPanelButton.displayName = 'ExplainPanelButton';
export default ExplainPanelButton;

interface ExplainPanelContentProps {
  explanation: PanelExplanation;
  onNavigate?: (view: ViewMode) => void;
}

function ExplainPanelContent({ explanation, onNavigate }: ExplainPanelContentProps) {
  return (
    <div data-testid="explain-panel-popover">
      {/* Header */}
      <div className="px-4 pt-4 pb-2 border-b border-border/50">
        <h3
          data-testid="explain-panel-title"
          className="text-sm font-semibold text-foreground"
        >
          {explanation.title}
        </h3>
        <p
          data-testid="explain-panel-description"
          className="text-xs text-muted-foreground mt-1 leading-relaxed"
        >
          {explanation.description}
        </p>
      </div>

      {/* Tips */}
      {explanation.tips.length > 0 && (
        <div className="px-4 py-3 border-b border-border/50">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Tips
          </h4>
          <ul data-testid="explain-panel-tips" className="space-y-1">
            {explanation.tips.map((tip, idx) => (
              <li
                key={idx}
                className="text-xs text-muted-foreground flex items-start gap-1.5"
              >
                <span className="text-primary mt-px shrink-0">&#x2022;</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Related Views */}
      {explanation.relatedViews.length > 0 && (
        <div className="px-4 py-3">
          <h4 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
            Related
          </h4>
          <div data-testid="explain-panel-related" className="flex flex-wrap gap-1.5">
            {explanation.relatedViews.map((rv) => (
              <button
                key={rv.view}
                data-testid={`explain-panel-related-${rv.view}`}
                onClick={() => onNavigate?.(rv.view)}
                className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                {rv.label}
                <ArrowRight className="w-3 h-3" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
