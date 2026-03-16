import { useState, useMemo, useCallback, memo } from 'react';
import { useDesignTroubleshooter } from '@/lib/design-troubleshooter';
import type { DesignMistake, MistakeCategory, MistakeSeverity, SearchResult } from '@/lib/design-troubleshooter';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Search,
  AlertTriangle,
  AlertCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Shield,
  Wrench,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Zap,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SEVERITY_CONFIG: Record<MistakeSeverity, { label: string; className: string; icon: typeof XCircle }> = {
  critical: { label: 'Critical', className: 'bg-destructive/20 text-destructive border-destructive/50', icon: XCircle },
  major: { label: 'Major', className: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50', icon: AlertTriangle },
  minor: { label: 'Minor', className: 'bg-primary/20 text-primary border-primary/50', icon: AlertCircle },
};

const CATEGORY_LABELS: Record<MistakeCategory, string> = {
  power: 'Power',
  signal: 'Signal',
  protection: 'Protection',
  communication: 'Communication',
  analog: 'Analog',
  digital: 'Digital',
  passive: 'Passive',
};

const DIFFICULTY_CONFIG: Record<string, { label: string; className: string }> = {
  beginner: { label: 'Beginner', className: 'bg-emerald-500/20 text-emerald-500' },
  intermediate: { label: 'Intermediate', className: 'bg-yellow-500/20 text-yellow-500' },
  advanced: { label: 'Advanced', className: 'bg-orange-500/20 text-orange-500' },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const MistakeCard = memo(function MistakeCard({
  mistake,
  matchedSymptoms,
  onClick,
}: {
  mistake: DesignMistake;
  matchedSymptoms?: string[];
  onClick: () => void;
}) {
  const sevConfig = SEVERITY_CONFIG[mistake.severity];
  const SevIcon = sevConfig.icon;

  return (
    <button
      data-testid={`troubleshoot-card-${mistake.id}`}
      onClick={onClick}
      className="w-full text-left p-3 border border-border bg-card/40 hover:bg-card/60 transition-colors group"
    >
      <div className="flex items-start gap-2">
        <SevIcon className={cn('w-4 h-4 mt-0.5 shrink-0', sevConfig.className.split(' ').find((c) => c.startsWith('text-')))} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{mistake.title}</span>
            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sevConfig.className)}>
              {sevConfig.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/30">
              {CATEGORY_LABELS[mistake.category]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{mistake.cause}</p>
          {matchedSymptoms && matchedSymptoms.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {matchedSymptoms.slice(0, 2).map((s, i) => (
                <span key={i} className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5">
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 mt-0.5" />
      </div>
    </button>
  );
});

function MistakeDetail({
  mistake,
  onBack,
  onNavigate,
}: {
  mistake: DesignMistake;
  onBack: () => void;
  onNavigate: (id: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    symptoms: true,
    cause: true,
    fix: true,
    prevention: false,
  });
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const { getRelated } = useDesignTroubleshooter();

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  }, []);

  const toggleStep = useCallback((stepNum: number) => {
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepNum)) {
        next.delete(stepNum);
      } else {
        next.add(stepNum);
      }
      return next;
    });
  }, []);

  const related = useMemo(() => getRelated(mistake.id), [getRelated, mistake.id]);
  const sevConfig = SEVERITY_CONFIG[mistake.severity];
  const diffConfig = DIFFICULTY_CONFIG[mistake.difficulty];
  const SevIcon = sevConfig.icon;

  return (
    <div className="flex flex-col h-full" data-testid={`troubleshoot-detail-${mistake.id}`}>
      {/* Header */}
      <div className="p-3 border-b border-border bg-card/30">
        <button
          data-testid="troubleshoot-back"
          onClick={onBack}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to list
        </button>
        <div className="flex items-start gap-2">
          <SevIcon className={cn('w-5 h-5 mt-0.5 shrink-0', sevConfig.className.split(' ').find((c) => c.startsWith('text-')))} />
          <div>
            <h3 className="font-semibold text-base text-foreground">{mistake.title}</h3>
            <div className="flex items-center gap-1.5 mt-1">
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', sevConfig.className)}>
                {sevConfig.label}
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted/30">
                {CATEGORY_LABELS[mistake.category]}
              </Badge>
              {diffConfig && (
                <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', diffConfig.className)}>
                  {diffConfig.label}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Symptoms */}
        <CollapsibleSection
          title="Symptoms"
          icon={<AlertTriangle className="w-4 h-4 text-yellow-500" />}
          expanded={expandedSections.symptoms}
          onToggle={() => { toggleSection('symptoms'); }}
          testId="section-symptoms"
        >
          <ul className="space-y-1.5">
            {mistake.symptoms.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Zap className="w-3 h-3 text-yellow-500 mt-0.5 shrink-0" />
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Root Cause */}
        <CollapsibleSection
          title="Root Cause"
          icon={<BookOpen className="w-4 h-4 text-primary" />}
          expanded={expandedSections.cause}
          onToggle={() => { toggleSection('cause'); }}
          testId="section-cause"
        >
          <p className="text-xs text-foreground font-medium mb-2">{mistake.cause}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{mistake.explanation}</p>
        </CollapsibleSection>

        {/* Step-by-step fix */}
        <CollapsibleSection
          title={`Fix (${completedSteps.size}/${mistake.fixSteps.length} steps)`}
          icon={<Wrench className="w-4 h-4 text-emerald-500" />}
          expanded={expandedSections.fix}
          onToggle={() => { toggleSection('fix'); }}
          testId="section-fix"
        >
          <div className="space-y-2">
            {mistake.fixSteps.map((fs) => (
              <div
                key={fs.step}
                data-testid={`fix-step-${fs.step}`}
                className={cn(
                  'p-2 border transition-colors',
                  completedSteps.has(fs.step)
                    ? 'border-emerald-500/30 bg-emerald-500/5'
                    : 'border-border bg-card/20',
                )}
              >
                <button
                  className="flex items-start gap-2 w-full text-left"
                  onClick={() => { toggleStep(fs.step); }}
                  data-testid={`toggle-step-${fs.step}`}
                >
                  <div className={cn(
                    'w-5 h-5 shrink-0 flex items-center justify-center border text-[10px] font-bold mt-0.5 transition-colors',
                    completedSteps.has(fs.step)
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-border text-muted-foreground',
                  )}>
                    {completedSteps.has(fs.step) ? <CheckCircle2 className="w-3 h-3" /> : fs.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      'text-xs font-medium',
                      completedSteps.has(fs.step) ? 'text-emerald-500 line-through' : 'text-foreground',
                    )}>
                      {fs.instruction}
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{fs.detail}</p>
                  </div>
                </button>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Prevention */}
        <CollapsibleSection
          title="Prevention Tips"
          icon={<Shield className="w-4 h-4 text-blue-500" />}
          expanded={expandedSections.prevention}
          onToggle={() => { toggleSection('prevention'); }}
          testId="section-prevention"
        >
          <ul className="space-y-1.5">
            {mistake.preventionTips.map((tip, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Lightbulb className="w-3 h-3 text-blue-500 mt-0.5 shrink-0" />
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>

        {/* Related mistakes */}
        {related.length > 0 && (
          <div className="pt-2 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Related Issues</h4>
            <div className="space-y-1">
              {related.map((rel) => (
                <button
                  key={rel.id}
                  data-testid={`related-${rel.id}`}
                  onClick={() => { onNavigate(rel.id); }}
                  className="w-full text-left px-2 py-1.5 text-xs text-foreground hover:bg-card/60 transition-colors flex items-center gap-2 border border-transparent hover:border-border"
                >
                  <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  {rel.title}
                  <Badge variant="outline" className={cn('text-[9px] px-1 py-0 ml-auto', SEVERITY_CONFIG[rel.severity].className)}>
                    {rel.severity}
                  </Badge>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  testId,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  testId: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border bg-card/20" data-testid={testId}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-2 hover:bg-card/40 transition-colors"
        data-testid={`toggle-${testId}`}
        aria-expanded={expanded}
      >
        {icon}
        <span className="text-xs font-semibold text-foreground flex-1 text-left">{title}</span>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-2 pb-2">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

function DesignTroubleshooterPanel() {
  const { searchBySymptom, getAllMistakes, getByCategory, getCategories } = useDesignTroubleshooter();
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<MistakeCategory | 'all'>('all');
  const [selectedMistakeId, setSelectedMistakeId] = useState<string | null>(null);
  const { getMistake } = useDesignTroubleshooter();

  const categories = useMemo(() => getCategories(), [getCategories]);

  const results = useMemo(() => {
    if (query.trim()) {
      const searchResults = searchBySymptom(query);
      if (selectedCategory !== 'all') {
        return searchResults.filter((r) => r.mistake.category === selectedCategory);
      }
      return searchResults;
    }
    // No query — show all, optionally filtered by category
    const all = selectedCategory === 'all' ? getAllMistakes() : getByCategory(selectedCategory);
    return all.map((m): SearchResult => ({ mistake: m, score: 0, matchedSymptoms: [] }));
  }, [query, selectedCategory, searchBySymptom, getAllMistakes, getByCategory]);

  const selectedMistake = useMemo(
    () => (selectedMistakeId ? getMistake(selectedMistakeId) : undefined),
    [selectedMistakeId, getMistake],
  );

  const handleNavigate = useCallback((id: string) => {
    setSelectedMistakeId(id);
  }, []);

  // If a mistake is selected, show detail view
  if (selectedMistake) {
    return (
      <MistakeDetail
        mistake={selectedMistake}
        onBack={() => { setSelectedMistakeId(null); }}
        onNavigate={handleNavigate}
      />
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="troubleshoot-panel">
      {/* Header */}
      <div className="p-3 border-b border-border bg-card/30">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-2">
          <Wrench className="w-4 h-4 text-primary" />
          Design Troubleshooter
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Describe your symptoms to find common circuit mistakes and step-by-step fixes.
        </p>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            data-testid="troubleshoot-search"
            placeholder="e.g. circuit resets randomly, LED too bright..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            className="pl-8 h-8 text-xs bg-background/50"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-center gap-1 mt-2 flex-wrap">
          <Button
            data-testid="filter-all"
            variant={selectedCategory === 'all' ? 'default' : 'outline'}
            size="sm"
            className="h-6 text-[10px] px-2"
            onClick={() => { setSelectedCategory('all'); }}
          >
            All
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              data-testid={`filter-${cat}`}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => { setSelectedCategory(cat); }}
            >
              {CATEGORY_LABELS[cat]}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1" data-testid="troubleshoot-results">
        {results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="w-8 h-8 text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground">No matching issues found.</p>
            <p className="text-[10px] text-muted-foreground/70 mt-1">Try different keywords or clear filters.</p>
          </div>
        ) : (
          <>
            <p className="text-[10px] text-muted-foreground px-1 py-1">
              {results.length} {results.length === 1 ? 'issue' : 'issues'} found
            </p>
            {results.map((r) => (
              <MistakeCard
                key={r.mistake.id}
                mistake={r.mistake}
                matchedSymptoms={r.matchedSymptoms}
                onClick={() => { setSelectedMistakeId(r.mistake.id); }}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default DesignTroubleshooterPanel;
