import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ARDUINO_EXAMPLES,
  ARDUINO_EXAMPLE_CATEGORIES,
} from '@shared/arduino-examples';
import type { ArduinoExample, ArduinoExampleCategory } from '@shared/arduino-examples';
import { Search, BookOpen, ChevronRight, Code, Tag } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ExamplesBrowserProps {
  onLoadExample: (code: string, title: string) => void;
  className?: string;
}

const DIFFICULTY_COLORS: Record<ArduinoExample['difficulty'], string> = {
  beginner: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5',
  intermediate: 'border-amber-500/30 text-amber-500 bg-amber-500/5',
  advanced: 'border-rose-500/30 text-rose-500 bg-rose-500/5',
};

export default function ExamplesBrowser({ onLoadExample, className }: ExamplesBrowserProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ArduinoExampleCategory | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredExamples = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return ARDUINO_EXAMPLES.filter((ex) => {
      if (selectedCategory !== 'all' && ex.category !== selectedCategory) {
        return false;
      }
      if (!query) return true;
      return (
        ex.title.toLowerCase().includes(query) ||
        ex.description.toLowerCase().includes(query) ||
        ex.tags.some((t) => t.includes(query))
      );
    });
  }, [searchQuery, selectedCategory]);

  const groupedExamples = useMemo(() => {
    const groups = new Map<string, ArduinoExample[]>();
    for (const ex of filteredExamples) {
      const key = selectedCategory === 'all' ? ex.category : ex.category;
      const arr = groups.get(key) ?? [];
      arr.push(ex);
      groups.set(key, arr);
    }
    return groups;
  }, [filteredExamples, selectedCategory]);

  const handleToggle = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleLoad = useCallback(
    (ex: ArduinoExample) => {
      onLoadExample(ex.code, ex.title);
    },
    [onLoadExample],
  );

  return (
    <div className={cn('flex flex-col h-full bg-card/30', className)} data-testid="examples-browser">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Arduino Examples
          </span>
          <Badge variant="outline" className="ml-auto text-[8px] h-3.5 px-1.5">
            {filteredExamples.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
          <Input
            placeholder="Search examples..."
            className="pl-7 h-8 text-[11px] bg-background/50 border-border/50"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-examples-search"
          />
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedCategory('all')}
            data-testid="filter-category-all"
            className={cn(
              'px-2 py-0.5 rounded text-[9px] font-medium transition-colors',
              selectedCategory === 'all'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            All
          </button>
          {ARDUINO_EXAMPLE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              data-testid={`filter-category-${cat.toLowerCase()}`}
              className={cn(
                'px-2 py-0.5 rounded text-[9px] font-medium transition-colors',
                selectedCategory === cat
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Examples list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
          {filteredExamples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-40">
              <BookOpen className="w-8 h-8 mb-2" />
              <span className="text-[10px]">
                {searchQuery ? 'No matching examples' : 'No examples available'}
              </span>
            </div>
          ) : (
            Array.from(groupedExamples.entries()).map(([category, examples]) => (
              <div key={category}>
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-1">
                  {category}
                </span>
                <div className="mt-1 space-y-0.5">
                  {examples.map((ex) => {
                    const isExpanded = expandedId === ex.id;
                    return (
                      <div
                        key={ex.id}
                        className={cn(
                          'rounded border transition-colors',
                          isExpanded
                            ? 'border-primary/20 bg-primary/5'
                            : 'border-transparent hover:bg-muted/30',
                        )}
                        data-testid={`example-item-${ex.id}`}
                      >
                        {/* Summary row */}
                        <button
                          className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
                          onClick={() => handleToggle(ex.id)}
                          data-testid={`example-toggle-${ex.id}`}
                        >
                          <ChevronRight
                            className={cn(
                              'w-3 h-3 text-muted-foreground transition-transform shrink-0',
                              isExpanded && 'rotate-90',
                            )}
                          />
                          <Code className="w-3 h-3 text-primary/70 shrink-0" />
                          <span className="text-xs font-medium truncate flex-1">{ex.title}</span>
                          <Badge
                            variant="outline"
                            className={cn('text-[8px] h-3.5 px-1', DIFFICULTY_COLORS[ex.difficulty])}
                          >
                            {ex.difficulty}
                          </Badge>
                        </button>

                        {/* Expanded detail */}
                        {isExpanded && (
                          <div className="px-3 pb-2 space-y-2">
                            <p className="text-[10px] text-muted-foreground leading-relaxed">
                              {ex.description}
                            </p>

                            {/* Tags */}
                            <div className="flex flex-wrap gap-1">
                              {ex.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded"
                                >
                                  <Tag className="w-2 h-2" />
                                  {tag}
                                </span>
                              ))}
                            </div>

                            {/* Code preview */}
                            <pre className="text-[9px] font-mono leading-relaxed bg-black/30 p-2 rounded max-h-32 overflow-auto text-zinc-300 border border-white/5">
                              {ex.code.trim().slice(0, 400)}
                              {ex.code.length > 400 ? '\n...' : ''}
                            </pre>

                            <Button
                              size="sm"
                              className="w-full h-7 text-[10px] gap-1.5"
                              onClick={() => handleLoad(ex)}
                              data-testid={`example-load-${ex.id}`}
                            >
                              <Code className="w-3 h-3" />
                              Load into Editor
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
