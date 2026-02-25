import { Bot, Loader2, StopCircle } from 'lucide-react';
import { MarkdownContent } from './MessageBubble';

interface StreamingIndicatorProps {
  content: string;
  onCancel: () => void;
}

export default function StreamingIndicator({ content, onCancel }: StreamingIndicatorProps) {
  return (
    <div data-testid="streaming-indicator" className="flex gap-3 text-sm">
      <div className="w-8 h-8 flex items-center justify-center shrink-0 border bg-primary/10 text-primary border-primary/20">
        <Bot className="w-4 h-4" />
      </div>
      <div className="flex flex-col gap-1 max-w-[85%]">
        <div className="bg-muted/30 backdrop-blur border border-border text-foreground p-3">
          {content ? (
            <MarkdownContent content={content} />
          ) : (
            <div className="flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin text-primary" />
              <span className="text-xs text-muted-foreground animate-pulse">Analyzing system requirements...</span>
            </div>
          )}
        </div>
        <button
          onClick={onCancel}
          data-testid="cancel-generation"
          className="flex items-center gap-1 text-[10px] text-destructive/70 hover:text-destructive px-1 w-fit transition-colors"
        >
          <StopCircle className="w-3 h-3" />
          Cancel
        </button>
      </div>
    </div>
  );
}
