/**
 * DesignPatternsView — Curated library of circuit design patterns for makers and learners,
 * plus a "My Snippets" tab for managing reusable design fragments.
 *
 * Tab 1 "Patterns": Card grid grouped by category with search, category filter, and difficulty filter.
 * Tab 2 "My Snippets": Snippet library with create/edit/delete, search, category filter.
 *
 * Clicking a pattern card expands it to show full educational content: whyItWorks, components,
 * connections, tips, and common mistakes.
 */

import { useMemo, useState, useCallback, useEffect } from 'react';

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
  Plus,
  Pencil,
  Trash2,
  Copy,
  Layers,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/input';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { getAllPatterns, getPatternsByCategory, getPatternsByDifficulty, searchPatterns } from '@/lib/design-patterns';
import type { PatternCategory, PatternDifficulty, DesignPattern } from '@/lib/design-patterns';
import { useDesignSnippets } from '@/lib/design-reuse';
import type { SnippetCategory, DesignSnippet, CreateSnippetInput } from '@/lib/design-reuse';
import { cn } from '@/lib/utils';

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

const SNIPPET_CATEGORY_LABELS: Record<SnippetCategory, string> = {
  power: 'Power',
  sensor: 'Sensor',
  communication: 'Communication',
  'motor-control': 'Motor Control',
  filtering: 'Filtering',
  protection: 'Protection',
  digital: 'Digital',
  analog: 'Analog',
  custom: 'Custom',
};

const SNIPPET_CATEGORY_COLORS: Record<SnippetCategory, string> = {
  power: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  sensor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  communication: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'motor-control': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  filtering: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  protection: 'bg-red-500/20 text-red-400 border-red-500/30',
  digital: 'bg-green-500/20 text-green-400 border-green-500/30',
  analog: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  custom: 'bg-muted text-muted-foreground border-muted',
};

// ---------------------------------------------------------------------------
// Sub-components (Patterns tab)
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
    <InteractiveCard
      data-testid={`pattern-card-${pattern.id}`}
      aria-label={`${expanded ? 'Collapse' : 'Expand'} design pattern: ${pattern.name}`}
      aria-expanded={expanded}
      onClick={() => { setExpanded((prev) => !prev); }}
      className="rounded-xl"
    >
    <Card
      className="bg-card/60 backdrop-blur-xl border-border hover:border-[var(--color-editor-accent)]/30 transition-colors cursor-pointer"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <CategoryIcon className="w-4 h-4 text-[var(--color-editor-accent)] shrink-0" />
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
            <h4 className="text-xs font-semibold text-[var(--color-editor-accent)] uppercase tracking-wider mb-1.5">
              Why It Works
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {pattern.whyItWorks}
            </p>
          </div>

          {/* Components */}
          <div>
            <h4 className="text-xs font-semibold text-[var(--color-editor-accent)] uppercase tracking-wider mb-1.5">
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
                      <span className="text-[10px] font-mono text-[var(--color-editor-accent)]">{c.value}</span>
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
            <h4 className="text-xs font-semibold text-[var(--color-editor-accent)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
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
            <h4 className="text-xs font-semibold text-[var(--color-editor-accent)] uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              Tips
            </h4>
            <ul className="space-y-1">
              {pattern.tips.map((tip) => (
                <li
                  key={tip.slice(0, 40)}
                  data-testid={`pattern-tip-${pattern.id}`}
                  className="text-[10px] text-muted-foreground leading-relaxed pl-3 relative before:content-[''] before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-[var(--color-editor-accent)]/50"
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
    </InteractiveCard>
  );
}

// ---------------------------------------------------------------------------
// Patterns Tab Content
// ---------------------------------------------------------------------------

function PatternsTabContent() {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<PatternCategory | 'all'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<PatternDifficulty | 'all'>('all');

  const filteredPatterns = useMemo(() => {
    let result: DesignPattern[];

    if (searchQuery.trim()) {
      result = searchPatterns(searchQuery.trim());
    } else {
      result = getAllPatterns();
    }

    if (categoryFilter !== 'all') {
      const categoryIds = new Set(getPatternsByCategory(categoryFilter).map((p) => p.id));
      result = result.filter((p) => categoryIds.has(p.id));
    }

    if (difficultyFilter !== 'all') {
      const difficultyIds = new Set(getPatternsByDifficulty(difficultyFilter).map((p) => p.id));
      result = result.filter((p) => difficultyIds.has(p.id));
    }

    return result;
  }, [searchQuery, categoryFilter, difficultyFilter]);

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
    <div className="space-y-6">
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
        <div data-testid="design-patterns-empty" className="py-12">
          <EmptyState
            icon={Search}
            title="No patterns match your filters."
            description="Try a different search term or clear filters."
          />
        </div>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedPatterns.entries()).map(([category, patterns]) => {
            const CategoryIcon = CATEGORY_ICONS[category];
            return (
              <div key={category} data-testid={`pattern-group-${category}`}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <CategoryIcon className="w-4 h-4 text-[var(--color-editor-accent)]" />
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
  );
}

// ---------------------------------------------------------------------------
// Snippet Card
// ---------------------------------------------------------------------------

function SnippetCard({
  snippet,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  snippet: DesignSnippet;
  onEdit: (snippet: DesignSnippet) => void;
  onDelete: (id: string) => void;
  onDuplicate: (snippet: DesignSnippet) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isBuiltin = snippet.id.startsWith('builtin-');

  return (
    <Card
      data-testid={`snippet-card-${snippet.id}`}
      className="bg-card/60 backdrop-blur-xl border-border hover:border-[var(--color-editor-accent)]/30 transition-colors cursor-pointer"
      onClick={() => { setExpanded((prev) => !prev); }}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Layers className="w-4 h-4 text-[var(--color-editor-accent)] shrink-0" />
            {snippet.name}
          </CardTitle>
          <div className="flex items-center gap-1.5 shrink-0">
            <Badge
              variant="outline"
              className={cn('text-[10px] capitalize', SNIPPET_CATEGORY_COLORS[snippet.category])}
            >
              {SNIPPET_CATEGORY_LABELS[snippet.category]}
            </Badge>
            {expanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </div>
        </div>
        <CardDescription className="text-xs leading-relaxed mt-1">
          {snippet.description || 'No description.'}
        </CardDescription>
      </CardHeader>

      {expanded && (
        <CardContent
          data-testid={`snippet-detail-${snippet.id}`}
          className="space-y-3 pt-0"
          onClick={(e) => { e.stopPropagation(); }}
        >
          {/* Stats */}
          <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span data-testid={`snippet-nodes-${snippet.id}`}>
              {snippet.nodes.length} node{snippet.nodes.length !== 1 ? 's' : ''}
            </span>
            <span data-testid={`snippet-edges-${snippet.id}`}>
              {snippet.edges.length} edge{snippet.edges.length !== 1 ? 's' : ''}
            </span>
            <span data-testid={`snippet-wires-${snippet.id}`}>
              {snippet.wires.length} wire{snippet.wires.length !== 1 ? 's' : ''}
            </span>
            {snippet.metadata.usageCount > 0 && (
              <span>Used {snippet.metadata.usageCount}x</span>
            )}
          </div>

          {/* Nodes list */}
          {snippet.nodes.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-[var(--color-editor-accent)] uppercase tracking-wider mb-1">
                Nodes
              </h4>
              <div className="space-y-1">
                {snippet.nodes.map((node) => (
                  <div
                    key={node.id}
                    className="rounded bg-muted/30 px-2 py-1 text-[10px]"
                    data-testid={`snippet-node-${snippet.id}-${node.id}`}
                  >
                    <span className="font-medium text-foreground">{node.label}</span>
                    <span className="text-muted-foreground ml-1.5">({node.type})</span>
                    {(() => {
                      const value = node.properties.value;
                      const displayValue = typeof value === 'string' || typeof value === 'number'
                        ? String(value)
                        : null;

                      if (displayValue === null) {
                        return null;
                      }

                      return <span className="font-mono text-[var(--color-editor-accent)] ml-1.5">{displayValue}</span>;
                    })()}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {snippet.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {snippet.tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[9px] px-1.5 py-0 border-border/50 text-muted-foreground"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-1.5 pt-1 border-t border-border/50">
            {!isBuiltin && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => { onEdit(snippet); }}
                  data-testid={`snippet-edit-${snippet.id}`}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
                <ConfirmDialog
                  trigger={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
                      data-testid={`snippet-delete-${snippet.id}`}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Delete
                    </Button>
                  }
                  title="Delete Snippet"
                  description={`Are you sure you want to delete "${snippet.name}"? This action cannot be undone.`}
                  confirmLabel="Delete"
                  variant="destructive"
                  onConfirm={() => { onDelete(snippet.id); }}
                />
              </>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => { onDuplicate(snippet); }}
              data-testid={`snippet-duplicate-${snippet.id}`}
            >
              <Copy className="h-3 w-3 mr-1" />
              Duplicate
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Create/Edit Snippet Dialog
// ---------------------------------------------------------------------------

function SnippetFormDialog({
  open,
  onOpenChange,
  editSnippet,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editSnippet: DesignSnippet | null;
  onSave: (input: CreateSnippetInput, editId?: string) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<SnippetCategory>('custom');
  const [tagsInput, setTagsInput] = useState('');

  // Populate form when editing
  const resetForm = useCallback((snippet: DesignSnippet | null) => {
    if (snippet) {
      setName(snippet.name);
      setDescription(snippet.description);
      setCategory(snippet.category);
      setTagsInput(snippet.tags.join(', '));
    } else {
      setName('');
      setDescription('');
      setCategory('custom');
      setTagsInput('');
    }
  }, []);

  // Keep the form in sync with the active dialog mode without mutating state during render.
  useEffect(() => {
    if (open) {
      resetForm(editSnippet);
    }
  }, [editSnippet, open, resetForm]);

  const handleOpenChange = useCallback((v: boolean) => {
    onOpenChange(v);
  }, [onOpenChange]);

  const handleSubmit = useCallback(() => {
    if (!name.trim()) {
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const input: CreateSnippetInput = {
      name: name.trim(),
      description: description.trim(),
      category,
      tags,
    };

    // If editing, preserve nodes/edges/wires from the existing snippet
    if (editSnippet) {
      input.nodes = editSnippet.nodes;
      input.edges = editSnippet.edges;
      input.wires = editSnippet.wires;
    }

    onSave(input, editSnippet?.id);
    handleOpenChange(false);
  }, [name, description, category, tagsInput, editSnippet, onSave, handleOpenChange]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md" data-testid="snippet-form-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Layers className="h-4 w-4 text-[var(--color-editor-accent)]" />
            {editSnippet ? 'Edit Snippet' : 'Create Snippet'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {editSnippet
              ? 'Update the snippet metadata. Nodes and edges are preserved.'
              : 'Create a new reusable design snippet.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Name</Label>
            <Input
              value={name}
              onChange={(e) => { setName(e.target.value); }}
              placeholder="e.g., H-Bridge Motor Driver"
              className="mt-1"
              data-testid="snippet-form-name"
            />
          </div>

          <div>
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => { setDescription(e.target.value); }}
              placeholder="Brief description of the snippet..."
              className="mt-1"
              data-testid="snippet-form-description"
            />
          </div>

          <div>
            <Label className="text-xs">Category</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v as SnippetCategory); }}>
              <SelectTrigger className="mt-1" data-testid="snippet-form-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SNIPPET_CATEGORY_LABELS) as SnippetCategory[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {SNIPPET_CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input
              value={tagsInput}
              onChange={(e) => { setTagsInput(e.target.value); }}
              placeholder="e.g., motor, h-bridge, pwm"
              className="mt-1"
              data-testid="snippet-form-tags"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { onOpenChange(false); }}
            data-testid="snippet-form-cancel"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!name.trim()}
            data-testid="snippet-form-save"
          >
            {editSnippet ? 'Save Changes' : 'Create Snippet'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// My Snippets Tab Content
// ---------------------------------------------------------------------------

function MySnippetsTabContent() {
  const {
    snippets,
    addSnippet,
    removeSnippet,
    updateSnippet,
    search: searchSnippets,
    getByCategory,
  } = useDesignSnippets();

  const [snippetSearch, setSnippetSearch] = useState('');
  const [snippetCategoryFilter, setSnippetCategoryFilter] = useState<SnippetCategory | 'all'>('all');
  const [formOpen, setFormOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<DesignSnippet | null>(null);

  const filteredSnippets = useMemo(() => {
    let result: DesignSnippet[];

    if (snippetSearch.trim()) {
      result = searchSnippets(snippetSearch.trim());
    } else {
      result = snippets;
    }

    if (snippetCategoryFilter !== 'all') {
      const categorySnippets = new Set(getByCategory(snippetCategoryFilter).map((s) => s.id));
      result = result.filter((s) => categorySnippets.has(s.id));
    }

    return result;
  }, [snippets, snippetSearch, snippetCategoryFilter, searchSnippets, getByCategory]);

  const handleCreateNew = useCallback(() => {
    setEditingSnippet(null);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((snippet: DesignSnippet) => {
    setEditingSnippet(snippet);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    removeSnippet(id);
  }, [removeSnippet]);

  const handleDuplicate = useCallback((snippet: DesignSnippet) => {
    addSnippet({
      name: `${snippet.name} (Copy)`,
      description: snippet.description,
      category: snippet.category,
      tags: [...snippet.tags],
      nodes: snippet.nodes,
      edges: snippet.edges,
      wires: snippet.wires,
    });
  }, [addSnippet]);

  const handleSave = useCallback((input: CreateSnippetInput, editId?: string) => {
    if (editId) {
      updateSnippet(editId, input);
    } else {
      addSnippet(input);
    }
  }, [addSnippet, updateSnippet]);

  return (
    <div className="space-y-6">
      {/* Filters and Create button */}
      <div className="flex flex-col sm:flex-row gap-3" data-testid="snippets-filters">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="snippets-search"
            placeholder="Search snippets..."
            value={snippetSearch}
            onChange={(e) => { setSnippetSearch(e.target.value); }}
            className="pl-8"
          />
        </div>
        <Select
          value={snippetCategoryFilter}
          onValueChange={(v) => { setSnippetCategoryFilter(v as SnippetCategory | 'all'); }}
        >
          <SelectTrigger data-testid="snippets-category-filter" className="w-full sm:w-[160px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {(Object.keys(SNIPPET_CATEGORY_LABELS) as SnippetCategory[]).map((cat) => (
              <SelectItem key={cat} value={cat}>
                {SNIPPET_CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          onClick={handleCreateNew}
          data-testid="snippets-create-btn"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create
        </Button>
      </div>

      {/* Results count */}
      <div className="text-xs text-muted-foreground">
        Showing {filteredSnippets.length} of {snippets.length} snippets
      </div>

      {/* Snippets grid */}
      {filteredSnippets.length === 0 ? (
        <div data-testid="snippets-empty" className="py-12">
          <EmptyState
            icon={Layers}
            title="No snippets match your filters."
            description="Create a new snippet or try different search terms."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3" data-testid="snippets-grid">
          {filteredSnippets.map((snippet) => (
            <SnippetCard
              key={snippet.id}
              snippet={snippet}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <SnippetFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editSnippet={editingSnippet}
        onSave={handleSave}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main View
// ---------------------------------------------------------------------------

export default function DesignPatternsView() {
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

        {/* Tabs: Patterns | My Snippets */}
        <Tabs defaultValue="patterns" data-testid="design-patterns-tabs">
          <TabsList data-testid="design-patterns-tabslist">
            <TabsTrigger value="patterns" data-testid="tab-patterns">
              Patterns
            </TabsTrigger>
            <TabsTrigger value="snippets" data-testid="tab-snippets">
              My Snippets
            </TabsTrigger>
          </TabsList>

          <TabsContent value="patterns" data-testid="tab-content-patterns">
            <PatternsTabContent />
          </TabsContent>

          <TabsContent value="snippets" data-testid="tab-content-snippets">
            <MySnippetsTabContent />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
