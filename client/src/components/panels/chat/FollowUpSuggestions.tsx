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
    <div className="px-3 py-1.5 flex gap-1.5 overflow-x-auto no-scrollbar shrink-0">
      {suggestions.map(suggestion => (
        <button
          key={suggestion}
          onClick={() => onSuggest(suggestion)}
          data-testid={`followup-${suggestion.toLowerCase().replace(/\s+/g, '-')}`}
          className="whitespace-nowrap px-2.5 py-1 bg-muted/40 border border-border text-[11px] text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors flex items-center gap-1 shrink-0 rounded-sm"
        >
          <ArrowRight className="w-2.5 h-2.5" />
          {suggestion}
        </button>
      ))}
    </div>
  );
}
