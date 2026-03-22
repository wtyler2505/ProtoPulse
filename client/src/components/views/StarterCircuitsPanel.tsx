/**
 * StarterCircuitsPanel — Browsable gallery of pre-built starter circuits with complete
 * Arduino code for instant beginner gratification. Supports category, difficulty, and
 * text search filters.
 */

import { useState, useMemo, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { copyToClipboard } from '@/lib/clipboard';
import {
  Search,
  Zap,
  Thermometer,
  Monitor,
  Cog,
  Radio,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Code2,
  BookOpen,
  Package,
  CircuitBoard,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  getAllStarterCircuits,
  STARTER_CATEGORIES,
  STARTER_DIFFICULTIES,
} from '@shared/starter-circuits';
import type {
  StarterCircuit,
  StarterCategory,
  StarterDifficulty,
} from '@shared/starter-circuits';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<StarterCategory, string> = {
  basics: 'Basics',
  sensors: 'Sensors',
  displays: 'Displays',
  motors: 'Motors',
  communication: 'Communication',
};

const CATEGORY_ICONS: Record<StarterCategory, typeof Zap> = {
  basics: Zap,
  sensors: Thermometer,
  displays: Monitor,
  motors: Cog,
  communication: Radio,
};

const DIFFICULTY_COLORS: Record<StarterDifficulty, string> = {
  beginner: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  intermediate: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
};

const BOARD_LABELS: Record<string, string> = {
  uno: 'Arduino Uno',
  nano: 'Arduino Nano',
  mega: 'Arduino Mega',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StarterCircuitsPanel() {
  const allCircuits = useMemo(() => getAllStarterCircuits(), []);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<StarterCategory | 'all'>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<StarterDifficulty | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Filter circuits based on search, category, and difficulty
  const filteredCircuits = useMemo(() => {
    let result = allCircuits;

    if (selectedCategory !== 'all') {
      result = result.filter((c) => c.category === selectedCategory);
    }
    if (selectedDifficulty !== 'all') {
      result = result.filter((c) => c.difficulty === selectedDifficulty);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.tags.some((t) => t.includes(q)),
      );
    }

    return result;
  }, [allCircuits, searchQuery, selectedCategory, selectedDifficulty]);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  const handleCopyCode = useCallback(async (circuit: StarterCircuit) => {
    try {
      await navigator.clipboard.writeText(circuit.arduinoCode);
      setCopiedId(circuit.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard API may fail in non-secure contexts; fall back silently
    }
  }, []);

  const { toast } = useToast();

  const handleOpenCircuit = useCallback((circuit: StarterCircuit) => {
    copyToClipboard(circuit.arduinoCode);
    toast({
      title: `"${circuit.name}" copied`,
      description: 'Arduino code copied to clipboard. Switch to the Arduino tab to paste it into a sketch.',
    });
  }, [toast]);

  return (
    <div data-testid="starter-circuits-panel" className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3 mb-3">
          <CircuitBoard className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Starter Circuits</h2>
          <Badge variant="outline" className="text-xs" data-testid="starter-circuits-count">
            {filteredCircuits.length} / {allCircuits.length}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Pre-built circuits with complete Arduino code. Pick one, wire it up, upload, and see results instantly.
        </p>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-testid="starter-circuits-search"
            placeholder="Search circuits..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          <Button
            data-testid="starter-filter-category-all"
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setSelectedCategory('all')}
          >
            All
          </Button>
          {STARTER_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICONS[cat];
            return (
              <Button
                key={cat}
                data-testid={`starter-filter-category-${cat}`}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5 gap-1"
                onClick={() => setSelectedCategory(cat)}
              >
                <Icon className="w-3 h-3" />
                {CATEGORY_LABELS[cat]}
              </Button>
            );
          })}
        </div>

        {/* Difficulty filters */}
        <div className="flex gap-1.5">
          <Button
            data-testid="starter-filter-difficulty-all"
            variant={selectedDifficulty === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs px-2.5"
            onClick={() => setSelectedDifficulty('all')}
          >
            All Levels
          </Button>
          {STARTER_DIFFICULTIES.map((diff) => (
            <Button
              key={diff}
              data-testid={`starter-filter-difficulty-${diff}`}
              variant={selectedDifficulty === diff ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setSelectedDifficulty(diff)}
            >
              {diff.charAt(0).toUpperCase() + diff.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Circuit cards */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredCircuits.length === 0 ? (
          <div data-testid="starter-circuits-empty" className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
            <Search className="w-8 h-8 opacity-50" />
            <p className="text-sm">No circuits match your filters.</p>
            <Button
              data-testid="starter-circuits-clear-filters"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
                setSelectedDifficulty('all');
              }}
            >
              Clear Filters
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredCircuits.map((circuit) => (
              <StarterCircuitCard
                key={circuit.id}
                circuit={circuit}
                isExpanded={expandedId === circuit.id}
                isCopied={copiedId === circuit.id}
                onToggleExpand={handleToggleExpand}
                onCopyCode={handleCopyCode}
                onOpenCircuit={handleOpenCircuit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Circuit Card
// ---------------------------------------------------------------------------

interface StarterCircuitCardProps {
  circuit: StarterCircuit;
  isExpanded: boolean;
  isCopied: boolean;
  onToggleExpand: (id: string) => void;
  onCopyCode: (circuit: StarterCircuit) => void;
  onOpenCircuit: (circuit: StarterCircuit) => void;
}

function StarterCircuitCard({
  circuit,
  isExpanded,
  isCopied,
  onToggleExpand,
  onCopyCode,
  onOpenCircuit,
}: StarterCircuitCardProps) {
  const CategoryIcon = CATEGORY_ICONS[circuit.category];

  return (
    <Card
      data-testid={`starter-card-${circuit.id}`}
      className={cn(
        'transition-all duration-200 hover:border-primary/40',
        isExpanded && 'border-primary/50 shadow-[0_0_12px_rgba(0,240,255,0.1)]',
      )}
    >
      <CardHeader className="p-4 pb-2 cursor-pointer" onClick={() => onToggleExpand(circuit.id)}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CategoryIcon className="w-4 h-4 text-primary shrink-0" />
              <span className="truncate">{circuit.name}</span>
            </CardTitle>
            <CardDescription className="text-xs mt-1 line-clamp-2">
              {circuit.description}
            </CardDescription>
          </div>
          <button
            data-testid={`starter-expand-${circuit.id}`}
            className="text-muted-foreground hover:text-foreground transition-colors shrink-0 p-0.5"
            aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          <Badge
            variant="outline"
            className={cn('text-[10px] px-1.5 py-0', DIFFICULTY_COLORS[circuit.difficulty])}
            data-testid={`starter-difficulty-${circuit.id}`}
          >
            {circuit.difficulty}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {CATEGORY_LABELS[circuit.category]}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {BOARD_LABELS[circuit.boardType] ?? circuit.boardType}
          </Badge>
        </div>
      </CardHeader>

      {/* Expanded details */}
      {isExpanded && (
        <CardContent className="px-4 pb-4 pt-2 space-y-3" data-testid={`starter-details-${circuit.id}`}>
          {/* Components needed */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <Package className="w-3 h-3" />
              Components Needed
            </h4>
            <ul className="text-xs text-foreground space-y-0.5">
              {circuit.components.map((comp, i) => (
                <li key={i} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                  <span>
                    {comp.quantity}x {comp.name}
                    {comp.value ? ` (${comp.value})` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Learning objectives */}
          <div>
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 mb-1.5">
              <BookOpen className="w-3 h-3" />
              What You Will Learn
            </h4>
            <ul className="text-xs text-foreground space-y-0.5">
              {circuit.learningObjectives.map((obj, i) => (
                <li key={i} className="flex items-start gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 shrink-0 mt-1.5" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Arduino code preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h4 className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Code2 className="w-3 h-3" />
                Arduino Code
              </h4>
              <Button
                data-testid={`starter-copy-${circuit.id}`}
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] px-2 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onCopyCode(circuit);
                }}
              >
                {isCopied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy
                  </>
                )}
              </Button>
            </div>
            <pre
              data-testid={`starter-code-${circuit.id}`}
              className="text-[10px] leading-relaxed bg-muted/50 border border-border rounded p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono text-foreground/80"
            >
              {circuit.arduinoCode}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              data-testid={`starter-open-${circuit.id}`}
              size="sm"
              className="h-7 text-xs flex-1 gap-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onOpenCircuit(circuit);
              }}
            >
              <CircuitBoard className="w-3.5 h-3.5" />
              Open Circuit
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
