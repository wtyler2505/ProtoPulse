import { Zap } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { quickActionDescriptions } from './constants';

interface QuickActionsBarProps {
  onAction: (action: string) => void;
  isVisible: boolean;
  isGenerating: boolean;
}

export default function QuickActionsBar({ onAction, isVisible, isGenerating }: QuickActionsBarProps) {
  if (!isVisible || isGenerating) return null;

  return (
    <div data-testid="quick-actions-bar" className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar">
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
  );
}
