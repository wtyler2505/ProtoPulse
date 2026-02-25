import { ArrowRight } from 'lucide-react';

interface FollowUpSuggestionsProps {
  suggestions: string[];
  onSuggest: (suggestion: string) => void;
  isGenerating: boolean;
  hasPendingActions: boolean;
}

export default function FollowUpSuggestions({
  suggestions,
  onSuggest,
  isGenerating,
  hasPendingActions,
}: FollowUpSuggestionsProps) {
  if (isGenerating || suggestions.length === 0 || hasPendingActions) return null;

  return (
    <div className="px-4 py-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
      {suggestions.map(suggestion => (
        <button
          key={suggestion}
          onClick={() => onSuggest(suggestion)}
          data-testid={`followup-${suggestion.toLowerCase().replace(/\s+/g, '-')}`}
          className="whitespace-nowrap px-3 py-1.5 bg-muted/40 border border-border text-xs text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <ArrowRight className="w-3 h-3" />
          {suggestion}
        </button>
      ))}
    </div>
  );
}
