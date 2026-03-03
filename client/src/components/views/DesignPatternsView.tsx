/**
 * DesignPatternsView — Curated library of circuit design patterns for makers and learners.
 *
 * Card grid grouped by category with search, category filter, and difficulty filter.
 * Clicking a card expands it to show full educational content: whyItWorks, components,
 * connections, tips, and common mistakes.
 */

import { useMemo, useState } from 'react';
import {
  Search,
  Cpu,
  Zap,
  Radio,
  Wifi,
  Shield,
  Cog,
  CircuitBoard,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Lightbulb,
  Link,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getAllPatterns, getPatternsByCategory, getPatternsByDifficulty, searchPatterns } from '@/lib/design-patterns';

import type { PatternCategory, PatternDifficulty, DesignPattern } from '@/lib/design-patterns';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<PatternCategory, string> = {
  power: 'Power',
  signal: 'Signal',
  communication: 'Communication',
  protection: 'Protection',
  motor: 'Motor',
  sensor: 'Sensor',
  digital: 'Digital',
};

const CATEGORY_ICONS: Record<PatternCategory, typeof Zap> = {
  power: Zap,
  signal: Radio,
  communication: Wifi,
  protection: Shield,
  motor: Cog,
  sensor: Cpu,
  digital: CircuitBoard,
};

const DIFFICULTY_COLORS: Record<PatternDifficulty, string> = {
  beginner: 'bg-green-500/20 text-green-400 border-green-500/30',
  intermediate: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  advanced: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function DifficultyBadge({ difficulty }: { difficulty: PatternDifficulty }) {
  return (
    <Badge
      data-testid={`badge-${difficulty}`}
      variant="outline"
      className={cn('text-[10px] capitalize', DIFFICULTY_COLORS[difficulty])}
    >
      {difficulty}
    </Badge>
  );
}

function PatternCard({ pattern }: { pattern: DesignPattern }) {
  const [expanded, setExpanded] = useState(false);
  const CategoryIcon = CATEGORY_ICONS[pattern.category];

  return (
    <Card
      data-testid={`pattern-card-${pattern.id}`}
      className="bg-card/60 backdrop-blur-xl border-border hover:border-[#00F0FF]/30 transition-colors cursor-pointer"
      onClick={() => { setExpanded((prev) => !prev); }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CategoryIcon className="w-4 h-4 text-[#00F0FF] shrink-0" />
            {pattern.name}
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <DifficultyBadge difficulty={pattern.difficulty} />
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <CardDescription className="text-xs leading-relaxed mt-1">
          {pattern.description}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent
          data-testid={`pattern-detail-${pattern.id}`}
          className="space-y-4 pt-0"
          onClick={(e) => { e.stopPropagation(); }}
        >
          {/* Why It Works */}
          <div>
            <h4 className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider mb-1.5">
              Why It Works
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {pattern.whyItWorks}
            </p>
          </div>

          {/* Components */}
          <div>
            <h4 className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider mb-1.5">
              Components
            </h4>
            <div className="space-y-1.5">
              {pattern.components.map((c) => (
                <div
                  key={c.name}
                  data-testid={`pattern-component-${pattern.id}`}
                  className="rounded bg-muted/30 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground">{c.name}</span>
                    {c.value && (
                      <span className="text-[10px] font-mono text-[#00F0FF]">{c.value}</span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.type}</div>
                  {c.notes && (
                    <div className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{c.notes}</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Connections */}
          <div>
            <h4 className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Link className="w-3 h-3" />
              Connections
            </h4>
            <div className="space-y-1.5">
              {pattern.connections.map((conn) => (
                <div
                  key={`${conn.from}-${conn.to}`}
                  data-testid={`pattern-connection-${pattern.id}`}
                  className="rounded bg-muted/30 px-2.5 py-1.5"
                >
                  <div className="flex items-center gap-1.5 text-[10px] font-mono">
                    <span className="text-foreground">{conn.from}</span>
                    <span className="text-muted-foreground">&rarr;</span>
                    <span className="text-foreground">{conn.to}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{conn.description}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Tips */}
          <div>
            <h4 className="text-xs font-semibold text-[#00F0FF] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Tips
            </h4>
            <ul className="space-y-1">
              {pattern.tips.map((tip) => (
                <li
                  key={tip.slice(0, 40)}
                  data-testid={`pattern-tip-${pattern.id}`}
                  className="text-[10px] text-muted-foreground leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-[#00F0FF]/50"
                >
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          {/* Common Mistakes */}
          <div>
            <h4 className="text-xs font-semibold text-destructive uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Common Mistakes
            </h4>
            <ul className="space-y-1">
              {pattern.commonMistakes.map((mistake) => (
                <li
                  key={mistake.slice(0, 40)}
                  data-testid={`pattern-mistake-${pattern.id}`}
                  className="text-[10px] text-muted-foreground leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-destructive/50"
                >
                  {mistake}
                </li>
              ))}
            </ul>
          </div>

          {/* Related Patterns */}
          {pattern.relatedPatterns.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
                Related Patterns
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {pattern.relatedPatterns.map((refId) => (
                  <Badge
                    key={refId}
                    data-testid={`pattern-related-${pattern.id}-${refId}`}
                    variant="secondary"
                    className="text-[10px]"
                  >
                    {refId}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          <div className="flex flex-wrap gap-1">
            {pattern.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className="text-[9px] px-1.5 py-0 border-border/50 text-muted-foreground"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export default function DesignPatternsView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PatternCategory | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<PatternDifficulty | 'all'>('all');

  const filteredPatterns = useMemo(() => {
    let result: DesignPattern[];

    // Start with search or all
    if (searchQuery.trim()) {
      result = searchPatterns(searchQuery.trim());
    } else {
      result = getAllPatterns();
    }

    // Apply category filter
    if (categoryFilter !== 'all') {
      const categoryIds = new Set(getPatternsByCategory(categoryFilter).map((p) => p.id));
      result = result.filter((p) => categoryIds.has(p.id));
    }

    // Apply difficulty filter
    if (difficultyFilter !== 'all') {
      const difficultyIds = new Set(getPatternsByDifficulty(difficultyFilter).map((p) => p.id));
      result = result.filter((p) => difficultyIds.has(p.id));
    }

    return result;
  }, [searchQuery, categoryFilter, difficultyFilter]);

  // Group patterns by category for display
  const groupedPatterns = useMemo(() => {
    const groups = new Map<PatternCategory, DesignPattern[]>();
    for (const p of filteredPatterns) {
      const existing = groups.get(p.category) ?? [];
      existing.push(p);
      groups.set(p.category, existing);
    }
    return groups;
  }, [filteredPatterns]);

  return (
    <div
      data-testid="design-patterns-view"
      className="h-full overflow-auto bg-background/50 p-4 md:p-6"
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div data-testid="design-patterns-header">
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
            Design Patterns
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Curated circuit building blocks — learn the &ldquo;why,&rdquo; not just the &ldquo;what&rdquo;
          </p>
        </div>

        {/* Filters */}
        <div data-testid="design-patterns-filters" className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              data-testid="design-patterns-search"
              placeholder="Search patterns..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); }}
              className="pl-8"
            />
          </div>
          <Select
            value={categoryFilter}
            onValueChange={(v) => { setCategoryFilter(v as PatternCategory | 'all'); }}
          >
            <SelectTrigger data-testid="design-patterns-category-filter" className="w-full sm:w-[160px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {(Object.keys(CATEGORY_LABELS) as PatternCategory[]).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={difficultyFilter}
            onValueChange={(v) => { setDifficultyFilter(v as PatternDifficulty | 'all'); }}
          >
            <SelectTrigger data-testid="design-patterns-difficulty-filter" className="w-full sm:w-[160px]">
              <SelectValue placeholder="Difficulty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Levels</SelectItem>
              <SelectItem value="beginner">Beginner</SelectItem>
              <SelectItem value="intermediate">Intermediate</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results count */}
        <div className="text-xs text-muted-foreground">
          Showing {filteredPatterns.length} of {getAllPatterns().length} patterns
        </div>

        {/* Grouped cards */}
        {filteredPatterns.length === 0 ? (
          <div
            data-testid="design-patterns-empty"
            className="text-center py-12 text-muted-foreground"
          >
            <Search className="w-8 h-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No patterns match your filters.</p>
            <p className="text-xs mt-1">Try a different search term or clear filters.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(groupedPatterns.entries()).map(([category, patterns]) => {
              const CategoryIcon = CATEGORY_ICONS[category];
              return (
                <div key={category} data-testid={`pattern-group-${category}`}>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <CategoryIcon className="w-4 h-4 text-[#00F0FF]" />
                    {CATEGORY_LABELS[category]}
                    <span className="text-xs text-muted-foreground font-normal">
                      ({patterns.length})
                    </span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {patterns.map((pattern) => (
                      <PatternCard key={pattern.id} pattern={pattern} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
