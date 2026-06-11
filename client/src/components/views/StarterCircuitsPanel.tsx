/**
 * StarterCircuitsPanel — Browsable gallery of pre-built starter circuits with complete
 * Arduino code for instant beginner gratification. Supports category, difficulty, and
 * text search filters.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useProjectMeta } from '@/lib/project-context';
import { queueStarterCircuitLaunch } from '@/lib/starter-circuit-launch';
import {
  getRadialAiDeliveryVerb,
  getRadialAiPromptDelivery,
  runRadialAiCommand,
  type RadialAiPromptSection,
} from '@/lib/radial-ai-commands';
import { RADIAL_COMMAND_EVENT, type RadialCommandEventDetail } from '@/lib/radial-menu-actions';
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
import { getAllStarterCircuits, STARTER_CATEGORIES, STARTER_DIFFICULTIES } from '@shared/starter-circuits';
import type { StarterCircuit, StarterCategory, StarterDifficulty } from '@shared/starter-circuits';

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

function formatStarterComponent(component: StarterCircuit['components'][number]): string {
  return `${String(component.quantity)}x ${component.name}${component.value ? ` (${component.value})` : ''}`;
}

function buildStarterPartsText(circuit: StarterCircuit): string {
  return [`${circuit.name} parts`, ...circuit.components.map(formatStarterComponent)].join('\n');
}

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
  const { setActiveView } = useProjectMeta();

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

  const handleCopyParts = useCallback(async (circuit: StarterCircuit) => {
    try {
      await navigator.clipboard.writeText(buildStarterPartsText(circuit));
    } catch {
      // Clipboard API may fail in non-secure contexts; fall back silently
    }
  }, []);

  const { toast } = useToast();

  const handleOpenCircuit = useCallback(
    (circuit: StarterCircuit) => {
      queueStarterCircuitLaunch({
        id: circuit.id,
        name: circuit.name,
        arduinoCode: circuit.arduinoCode,
      });
      setActiveView('arduino');
      toast({
        title: `"${circuit.name}" opened`,
        description: 'Queued the starter sketch and switched to the Arduino workbench.',
      });
    },
    [setActiveView, toast],
  );

  const findRadialCircuit = useCallback(
    (targetId?: string | null): StarterCircuit | null => {
      if (targetId) {
        return allCircuits.find((circuit) => circuit.id === targetId) ?? null;
      }
      return filteredCircuits[0] ?? allCircuits[0] ?? null;
    },
    [allCircuits, filteredCircuits],
  );

  const handleAiStarterLearn = useCallback(
    (detail: RadialCommandEventDetail): void => {
      const selected = findRadialCircuit(detail.context.targetId);
      if (!selected) {
        toast({
          title: 'No starter circuit selected',
          description: 'Right-click a starter circuit card first.',
          variant: 'destructive',
        });
        return;
      }

      const delivery = getRadialAiPromptDelivery(detail);
      const deliveryVerb = getRadialAiDeliveryVerb(delivery);
      const codePreview = selected.arduinoCode.split('\n').slice(0, 40);
      const sections: RadialAiPromptSection[] = [
        {
          title: 'Components needed',
          lines: selected.components.slice(0, 12).map(formatStarterComponent),
        },
        {
          title: 'What Tyler will learn',
          lines: selected.learningObjectives.slice(0, 10),
        },
        {
          title: 'Arduino code preview',
          lines: codePreview.length > 0 ? codePreview : ['No code preview available.'],
        },
        {
          title: 'Gallery state',
          lines: [
            `Visible starter cards: ${String(filteredCircuits.length)} of ${String(allCircuits.length)}`,
            `Search filter: ${searchQuery.trim() || 'none'}`,
            `Category filter: ${selectedCategory}`,
            `Difficulty filter: ${selectedDifficulty}`,
            `Expanded starter: ${expandedId ?? 'none'}`,
          ],
        },
      ].filter((section) => section.lines.length > 0);

      runRadialAiCommand({
        intent: 'starter_learn',
        intro:
          'Explain this starter circuit like a patient electronics mentor. Focus on why each part is there, the safest wiring order, what the code does, and what Tyler should observe first on the bench.',
        summary: `Starter circuit learning prompt: ${selected.name}, ${selected.difficulty}, ${CATEGORY_LABELS[selected.category]}, ${BOARD_LABELS[selected.boardType] ?? selected.boardType}.`,
        historyLabel: `Starter learn: ${selected.name}`,
        context: detail.context,
        delivery,
        targetDetails: [
          `Selected starter: ${selected.name}`,
          `Description: ${selected.description}`,
          `Board: ${BOARD_LABELS[selected.boardType] ?? selected.boardType}`,
          `Tags: ${selected.tags.slice(0, 10).join(', ') || 'none'}`,
        ],
        sections,
        finalInstruction:
          'Give Tyler a concise learning guide: the circuit idea, exact first wiring step, one common beginner mistake, and one safe variation to try after it works.',
      });
      toast({
        title: `AI Starter ${deliveryVerb}`,
        description:
          delivery === 'send-now'
            ? `Sent ${selected.name} learning prompt to AI chat.`
            : `Drafted ${selected.name} learning prompt in AI chat.`,
      });
    },
    [
      allCircuits.length,
      expandedId,
      filteredCircuits.length,
      findRadialCircuit,
      searchQuery,
      selectedCategory,
      selectedDifficulty,
      toast,
    ],
  );

  useEffect(() => {
    const handleCommandEvent = (event: Event) => {
      const detail = (event as CustomEvent<RadialCommandEventDetail>).detail;
      if (!detail || detail.source !== 'radial-menu' || detail.context.view !== 'starter_circuits') {
        return;
      }

      const selected = findRadialCircuit(detail.context.targetId);
      switch (detail.commandId) {
        case 'ai_starter_learn':
          handleAiStarterLearn(detail);
          detail.handled = true;
          return;
        case 'starter_show_difficulty':
          if (selected) {
            setSearchQuery('');
            setSelectedCategory('all');
            setSelectedDifficulty(selected.difficulty);
            toast({
              title: `${selected.difficulty.charAt(0).toUpperCase()}${selected.difficulty.slice(1)} Starters`,
              description: `Filtered starter circuits to ${selected.name}'s difficulty level.`,
            });
          } else {
            toast({
              title: 'No starter circuit selected',
              description: 'Right-click a starter circuit card first.',
              variant: 'destructive',
            });
          }
          detail.handled = true;
          return;
        case 'starter_show_category':
          if (selected) {
            setSearchQuery('');
            setSelectedCategory(selected.category);
            setSelectedDifficulty('all');
            toast({
              title: `${CATEGORY_LABELS[selected.category]} Starters`,
              description: `Filtered starter circuits to ${selected.name}'s category.`,
            });
          } else {
            toast({
              title: 'No starter circuit selected',
              description: 'Right-click a starter circuit card first.',
              variant: 'destructive',
            });
          }
          detail.handled = true;
          return;
        case 'starter_toggle_details':
          if (selected) {
            handleToggleExpand(selected.id);
            toast({
              title: expandedId === selected.id ? 'Starter Details Collapsed' : 'Starter Details Opened',
              description: `${selected.name} details are ${expandedId === selected.id ? 'collapsed' : 'expanded'}.`,
            });
          } else {
            toast({
              title: 'No starter circuit selected',
              description: 'Right-click a starter circuit card first.',
              variant: 'destructive',
            });
          }
          detail.handled = true;
          return;
        case 'starter_filter_beginner':
          setSearchQuery('');
          setSelectedDifficulty('beginner');
          toast({
            title: 'Beginner Starters',
            description: 'Filtered starter circuits to beginner-friendly builds.',
          });
          detail.handled = true;
          return;
        case 'starter_filter_sensors':
          setSearchQuery('');
          setSelectedCategory('sensors');
          toast({
            title: 'Sensor Starters',
            description: 'Filtered starter circuits to sensor builds.',
          });
          detail.handled = true;
          return;
        case 'starter_filter_motors':
          setSearchQuery('');
          setSelectedCategory('motors');
          toast({
            title: 'Motor Starters',
            description: 'Filtered starter circuits to motor builds.',
          });
          detail.handled = true;
          return;
        case 'starter_filter_displays':
          setSearchQuery('');
          setSelectedCategory('displays');
          toast({
            title: 'Display Starters',
            description: 'Filtered starter circuits to display builds.',
          });
          detail.handled = true;
          return;
        case 'starter_reset_filters':
          setSearchQuery('');
          setSelectedCategory('all');
          setSelectedDifficulty('all');
          toast({
            title: 'Starter Filters Reset',
            description: 'Showing every starter circuit again.',
          });
          detail.handled = true;
          return;
        case 'open_starter_circuit':
          if (selected) {
            handleOpenCircuit(selected);
          } else {
            toast({
              title: 'No starter circuit selected',
              description: 'Right-click a starter circuit card first.',
              variant: 'destructive',
            });
          }
          detail.handled = true;
          return;
        case 'copy_starter_parts':
          if (selected) {
            void handleCopyParts(selected);
            toast({
              title: 'Starter parts copied',
              description: `Copied ${selected.name} parts list from the radial menu.`,
            });
          } else {
            toast({
              title: 'No starter circuit selected',
              description: 'Right-click a starter circuit card first.',
              variant: 'destructive',
            });
          }
          detail.handled = true;
          return;
        case 'copy_starter_code':
          if (selected) {
            void handleCopyCode(selected);
            toast({
              title: 'Starter code copied',
              description: `Copied ${selected.name} code from the radial menu.`,
            });
          } else {
            toast({
              title: 'No starter circuit selected',
              description: 'Right-click a starter circuit card first.',
              variant: 'destructive',
            });
          }
          detail.handled = true;
          return;
        default:
          return;
      }
    };

    window.addEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
    return () => window.removeEventListener(RADIAL_COMMAND_EVENT, handleCommandEvent);
  }, [
    expandedId,
    findRadialCircuit,
    handleAiStarterLearn,
    handleCopyCode,
    handleCopyParts,
    handleOpenCircuit,
    handleToggleExpand,
    toast,
  ]);

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
        <p className="mb-4 text-xs text-muted-foreground">
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
            className="h-8.5 pl-9 text-xs"
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
                className="h-7 px-2.5 text-xs gap-1.5"
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
          <div
            data-testid="starter-circuits-empty"
            className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2"
          >
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
      data-starter-circuit-id={circuit.id}
      data-starter-circuit-label={circuit.name}
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
            <CardDescription className="text-xs mt-1 line-clamp-2">{circuit.description}</CardDescription>
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
            className={cn('h-5 px-2 py-0.5 text-[11px]', DIFFICULTY_COLORS[circuit.difficulty])}
            data-testid={`starter-difficulty-${circuit.id}`}
          >
            {circuit.difficulty}
          </Badge>
          <Badge variant="outline" className="h-5 px-2 py-0.5 text-[11px]">
            {CATEGORY_LABELS[circuit.category]}
          </Badge>
          <Badge variant="outline" className="h-5 px-2 py-0.5 text-[11px]">
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
                className="h-7 px-2.5 text-[11px] gap-1.5"
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
              className="max-h-48 overflow-x-auto overflow-y-auto rounded border border-border bg-muted/50 p-3 text-[11px] font-mono leading-relaxed text-foreground/80"
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
