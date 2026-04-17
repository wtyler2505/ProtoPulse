import { Search, X } from 'lucide-react';

interface ChatSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
}

export default function ChatSearchBar({ value, onChange, visible }: ChatSearchBarProps) {
  if (!visible) return null;

  return (
    <div className="px-3 py-2 border-b border-border bg-card/20 flex items-center gap-2 shrink-0">
      <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <input
        data-testid="chat-search-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search messages..."
        aria-label="Search messages"
        className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50"
        autoFocus
      />
      {value && (
        <button type="button" data-testid="chat-search-clear" onClick={() => onChange('')} aria-label="Clear search" className="text-muted-foreground hover:text-foreground">
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
