/**
 * ExampleLibraryPanel (BL-0628) — Bundled circuit+code example library.
 *
 * Unlike the simpler ExamplesBrowser (code-only snippets from arduino-examples.ts),
 * this panel shows complete project examples with wiring notes, expected behavior,
 * component lists, and required libraries. Organized as a category tree with
 * search/filter, code preview with syntax highlighting, and a "Load into Editor"
 * button that sets the Arduino code editor content.
 */

import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  EXAMPLE_CIRCUITS,
  EXAMPLE_CIRCUIT_CATEGORIES,
} from '@shared/arduino-example-circuits';
import type {
  ExampleCircuit,
  ExampleCircuitCategory,
  ExampleCircuitDifficulty,
} from '@shared/arduino-example-circuits';
import {
  Search,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Code,
  Tag,
  Cpu,
  Zap,
  Cable,
  Eye,
  Library,
  Package,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExampleLibraryPanelProps {
  /** Called when the user clicks "Load into Editor". */
  onLoadExample: (code: string, title: string) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIFFICULTY_COLORS: Record<ExampleCircuitDifficulty, string> = {
  beginner: 'border-emerald-500/30 text-emerald-500 bg-emerald-500/5',
  intermediate: 'border-amber-500/30 text-amber-500 bg-amber-500/5',
  advanced: 'border-rose-500/30 text-rose-500 bg-rose-500/5',
};

const CATEGORY_ICONS: Record<ExampleCircuitCategory, typeof Cpu> = {
  Basics: Zap,
  Digital: Cpu,
  Analog: Cable,
  Sensors: Eye,
  Displays: Eye,
  Motors: Zap,
  Communication: Cable,
  IoT: Zap,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ExampleLibraryPanel({
  onLoadExample,
  className,
}: ExampleLibraryPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ExampleCircuitCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<ExampleCircuitDifficulty | 'all'>('all');
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── Filtering ───────────────────────────────────────────────────────────
  const filteredExamples = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return EXAMPLE_CIRCUITS.filter((ex) => {
      if (selectedCategory !== 'all' && ex.category !== selectedCategory) {
        return false;
      }
      if (selectedDifficulty !== 'all' && ex.difficulty !== selectedDifficulty) {
        return false;
      }
      if (!query) {
        return true;
      }
      return (
        ex.title.toLowerCase().includes(query) ||
        ex.description.toLowerCase().includes(query) ||
        ex.tags.some((t) => t.includes(query)) ||
        ex.wiringNotes.some((n) => n.toLowerCase().includes(query))
      );
    });
  }, [searchQuery, selectedCategory, selectedDifficulty]);

  // ── Grouping by category ────────────────────────────────────────────────
  const groupedExamples = useMemo(() => {
    const groups = new Map<ExampleCircuitCategory, ExampleCircuit[]>();
    for (const cat of EXAMPLE_CIRCUIT_CATEGORIES) {
      groups.set(cat, []);
    }
    for (const ex of filteredExamples) {
      const arr = groups.get(ex.category);
      if (arr) {
        arr.push(ex);
      }
    }
    // Remove empty categories
    for (const [cat, arr] of Array.from(groups.entries())) {
      if (arr.length === 0) {
        groups.delete(cat);
      }
    }
    return groups;
  }, [filteredExamples]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleToggleCategory = useCallback((cat: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  }, []);

  const handleToggleExample = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleLoad = useCallback(
    (ex: ExampleCircuit) => {
      onLoadExample(ex.code, ex.title);
    },
    [onLoadExample],
  );

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div
      className={cn('flex flex-col h-full bg-card/30', className)}
      data-testid="example-library-panel"
    >
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <Library className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider text-foreground">
            Example Library
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
            data-testid="input-example-library-search"
          />
        </div>

        {/* Category filter chips */}
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => setSelectedCategory('all')}
            data-testid="filter-example-category-all"
            className={cn(
              'px-2 py-0.5 rounded text-[9px] font-medium transition-colors',
              selectedCategory === 'all'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            All
          </button>
          {EXAMPLE_CIRCUIT_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              data-testid={`filter-example-category-${cat.toLowerCase()}`}
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

        {/* Difficulty filter chips */}
        <div className="flex gap-1">
          <button
            onClick={() => setSelectedDifficulty('all')}
            data-testid="filter-example-difficulty-all"
            className={cn(
              'px-2 py-0.5 rounded text-[9px] font-medium transition-colors',
              selectedDifficulty === 'all'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
            )}
          >
            Any Level
          </button>
          {(['beginner', 'intermediate', 'advanced'] as const).map((diff) => (
            <button
              key={diff}
              onClick={() => setSelectedDifficulty(diff)}
              data-testid={`filter-example-difficulty-${diff}`}
              className={cn(
                'px-2 py-0.5 rounded text-[9px] font-medium transition-colors',
                selectedDifficulty === diff
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {diff.charAt(0).toUpperCase() + diff.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Examples tree */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredExamples.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-40"
              data-testid="example-library-empty"
            >
              <BookOpen className="w-8 h-8 mb-2" />
              <span className="text-[10px]">
                {searchQuery ? 'No matching examples' : 'No examples available'}
              </span>
            </div>
          ) : (
            Array.from(groupedExamples.entries()).map(([category, examples]) => {
              const isCollapsed = collapsedCategories.has(category);
              const CatIcon = CATEGORY_ICONS[category] ?? Cpu;
              return (
                <div key={category} data-testid={`example-library-category-${category.toLowerCase()}`}>
                  {/* Category header */}
                  <button
                    className="w-full flex items-center gap-1.5 px-1 py-1 text-left hover:bg-muted/30 rounded transition-colors"
                    onClick={() => handleToggleCategory(category)}
                    data-testid={`example-library-toggle-${category.toLowerCase()}`}
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                    <CatIcon className="w-3 h-3 text-primary/70 shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-1">
                      {category}
                    </span>
                    <Badge variant="outline" className="text-[7px] h-3 px-1 shrink-0">
                      {examples.length}
                    </Badge>
                  </button>

                  {/* Category items */}
                  {!isCollapsed && (
                    <div className="ml-3 space-y-0.5 mt-0.5">
                      {examples.map((ex) => (
                        <ExampleItem
                          key={ex.id}
                          example={ex}
                          isExpanded={expandedId === ex.id}
                          onToggle={handleToggleExample}
                          onLoad={handleLoad}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExampleItem sub-component
// ---------------------------------------------------------------------------

interface ExampleItemProps {
  example: ExampleCircuit;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  onLoad: (ex: ExampleCircuit) => void;
}

function ExampleItem({ example, isExpanded, onToggle, onLoad }: ExampleItemProps) {
  const ex = example;

  return (
    <div
      className={cn(
        'rounded border transition-colors',
        isExpanded
          ? 'border-primary/20 bg-primary/5'
          : 'border-transparent hover:bg-muted/30',
      )}
      data-testid={`example-library-item-${ex.id}`}
    >
      {/* Summary row */}
      <button
        className="w-full flex items-center gap-2 px-2 py-1.5 text-left"
        onClick={() => onToggle(ex.id)}
        data-testid={`example-library-toggle-item-${ex.id}`}
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
        <div className="px-3 pb-3 space-y-2.5">
          {/* Description */}
          <p className="text-[10px] text-muted-foreground leading-relaxed">{ex.description}</p>

          {/* Wiring Notes */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Cable className="w-3 h-3 text-amber-400" />
              <span className="text-[9px] font-semibold text-amber-400 uppercase tracking-wider">
                Wiring
              </span>
            </div>
            <ul className="space-y-0.5 pl-4" data-testid={`example-library-wiring-${ex.id}`}>
              {ex.wiringNotes.map((note, i) => (
                <li
                  key={i}
                  className="text-[9px] text-muted-foreground list-disc leading-relaxed"
                >
                  {note}
                </li>
              ))}
            </ul>
          </div>

          {/* Expected Behavior */}
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Eye className="w-3 h-3 text-cyan-400" />
              <span className="text-[9px] font-semibold text-cyan-400 uppercase tracking-wider">
                Expected Behavior
              </span>
            </div>
            <p
              className="text-[9px] text-muted-foreground leading-relaxed pl-4"
              data-testid={`example-library-behavior-${ex.id}`}
            >
              {ex.expectedBehavior}
            </p>
          </div>

          {/* Components */}
          {ex.components.length > 0 && (
            <div>
              <div className="flex items-center gap-1 mb-1">
                <Package className="w-3 h-3 text-violet-400" />
                <span className="text-[9px] font-semibold text-violet-400 uppercase tracking-wider">
                  Components
                </span>
              </div>
              <ul className="space-y-0.5 pl-4" data-testid={`example-library-components-${ex.id}`}>
                {ex.components.map((comp, i) => (
                  <li key={i} className="text-[9px] text-muted-foreground list-disc">
                    {comp.quantity}x {comp.name}
                    {comp.value ? ` (${comp.value})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Required Libraries */}
          {ex.requiredLibraries.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-1"
              data-testid={`example-library-libs-${ex.id}`}
            >
              <Library className="w-3 h-3 text-blue-400 shrink-0" />
              <span className="text-[9px] font-semibold text-blue-400 uppercase tracking-wider mr-1">
                Libraries:
              </span>
              {ex.requiredLibraries.map((lib) => (
                <Badge
                  key={lib}
                  variant="outline"
                  className="text-[8px] h-3.5 px-1 border-blue-500/30 text-blue-400 bg-blue-500/5"
                >
                  {lib}
                </Badge>
              ))}
            </div>
          )}

          <Separator className="opacity-30" />

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
          <pre
            className="text-[9px] font-mono leading-relaxed bg-black/30 p-2 rounded max-h-40 overflow-auto text-zinc-300 border border-white/5"
            data-testid={`example-library-code-preview-${ex.id}`}
          >
            {ex.code.trim().slice(0, 500)}
            {ex.code.length > 500 ? '\n...' : ''}
          </pre>

          {/* Load button */}
          <Button
            size="sm"
            className="w-full h-7 text-[10px] gap-1.5"
            onClick={() => onLoad(ex)}
            data-testid={`example-library-load-${ex.id}`}
          >
            <Code className="w-3 h-3" />
            Load into Editor
          </Button>
        </div>
      )}
    </div>
  );
}
