/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions --
 * Phase 3 <InteractiveCard> primitive migration will replace `role="button"` on
 * `<div>` elements with real `<button>` elements, at which point these disables
 * can be removed. See docs/superpowers/plans/2026-04-18-e2e-walkthrough/03-a11y-systemic.md
 * Phase 3. Tracked as part of E2E-552 / Plan 03 Phase 4.
 */
/**
 * KnowledgeView — Electronics knowledge hub for beginners and intermediates.
 * Search, browse by category/difficulty, read articles with related topic links.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  Search,
  ArrowLeft,
  Tag,
  GraduationCap,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InteractiveCard } from '@/components/ui/interactive-card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { VaultHoverCard } from '@/components/ui/vault-hover-card';
import { cn } from '@/lib/utils';
import { useKnowledgeBase } from '@/lib/electronics-knowledge';
import type { KnowledgeArticle, ArticleCategory, DifficultyLevel } from '@/lib/electronics-knowledge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ArticleCategory, { label: string; icon: string }> = {
  'passive-components': { label: 'Passive Components', icon: 'R' },
  'active-components': { label: 'Active Components', icon: 'Q' },
  power: { label: 'Power', icon: 'V' },
  communication: { label: 'Communication', icon: 'C' },
  pcb: { label: 'PCB', icon: 'P' },
  techniques: { label: 'Techniques', icon: 'T' },
};

const DIFFICULTY_CONFIG: Record<DifficultyLevel, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  intermediate: { label: 'Intermediate', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  advanced: { label: 'Advanced', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const ALL_CATEGORIES: ArticleCategory[] = [
  'passive-components',
  'active-components',
  'power',
  'communication',
  'pcb',
  'techniques',
];

const ALL_DIFFICULTIES: DifficultyLevel[] = ['beginner', 'intermediate', 'advanced'];

// ---------------------------------------------------------------------------
// DifficultyBadge
// ---------------------------------------------------------------------------

const DifficultyBadge = memo(function DifficultyBadge({ level }: { level: DifficultyLevel }) {
  const config = DIFFICULTY_CONFIG[level];
  return (
    <Badge
      data-testid={`difficulty-badge-${level}`}
      variant="outline"
      className={cn('text-xs', config.color)}
    >
      <GraduationCap className="w-3 h-3 mr-1" />
      {config.label}
    </Badge>
  );
});

// ---------------------------------------------------------------------------
// ArticleCard
// ---------------------------------------------------------------------------

interface ArticleCardProps {
  article: KnowledgeArticle;
  onClick: (id: string) => void;
}

const ArticleCard = memo(function ArticleCard({ article, onClick }: ArticleCardProps) {
  const categoryInfo = CATEGORY_LABELS[article.category];
  const firstLine = article.content.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? '';

  return (
    <InteractiveCard
      data-testid={`article-card-${article.id}`}
      aria-label={`Open article: ${article.title}`}
      onClick={() => { onClick(article.id); }}
      className="rounded-xl"
    >
    <Card
      className="bg-card/60 border-border/50 hover:border-primary/30 transition-colors cursor-pointer"
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-sm font-semibold leading-tight">{article.title}</CardTitle>
          <DifficultyBadge level={article.difficulty} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Badge data-testid={`article-category-${article.id}`} variant="secondary" className="text-xs">
            <Layers className="w-3 h-3 mr-1" />
            {categoryInfo.label}
          </Badge>
        </div>
        <p data-testid={`article-preview-${article.id}`} className="text-xs text-muted-foreground line-clamp-2">
          {firstLine}
        </p>
        {article.tags.length > 0 && (
          <div data-testid={`article-tags-${article.id}`} className="flex flex-wrap gap-1">
            {article.tags.slice(0, 4).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0 text-muted-foreground">
                {tag}
              </Badge>
            ))}
            {article.tags.length > 4 && (
              <span className="text-xs text-muted-foreground">+{article.tags.length - 4}</span>
            )}
          </div>
        )}
        {/* TODO(plan-13-wave-1): swap `topic={article.category}` for `slug={article.vaultMoc}` once the data layer adds a vaultMoc field per article. Plan 13 declares a CI assertion requiring this. */}
        <div
          className="pt-1.5 border-t border-border/30"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <VaultHoverCard topic={article.category}>
            <span
              data-testid={`article-vault-${article.id}`}
              aria-label="About this category in the Vault"
              className="inline-flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary cursor-help transition-colors"
            >
              <BookOpen className="w-3 h-3" />
              Explore in Vault
            </span>
          </VaultHoverCard>
        </div>
      </CardContent>
    </Card>
    </InteractiveCard>
  );
});

// ---------------------------------------------------------------------------
// ArticleContent — renders article with simple markdown-like formatting
// ---------------------------------------------------------------------------

const ArticleContent = memo(function ArticleContent({ content }: { content: string }) {
  const rendered = useMemo(() => {
    return content.split('\n').map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return <div key={i} className="h-2" />;
      }
      if (trimmed.startsWith('### ')) {
        return <h4 key={i} className="text-sm font-semibold mt-4 mb-1">{trimmed.slice(4)}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={i} className="text-base font-semibold mt-5 mb-2 text-primary">{trimmed.slice(3)}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={i} className="text-lg font-bold mt-2 mb-3">{trimmed.slice(2)}</h2>;
      }
      if (trimmed.startsWith('- ')) {
        const bulletContent = trimmed.slice(2);
        return (
          <div key={i} className="flex gap-2 ml-4 text-sm">
            <span className="text-muted-foreground">-</span>
            <span>{inlineFormat(bulletContent)}</span>
          </div>
        );
      }
      if (trimmed.startsWith('|')) {
        return (
          <div key={i} className="text-xs font-mono text-muted-foreground overflow-x-auto">
            {trimmed}
          </div>
        );
      }
      return <p key={i} className="text-sm leading-relaxed">{inlineFormat(trimmed)}</p>;
    });
  }, [content]);

  return <div data-testid="article-content">{rendered}</div>;
});

function inlineFormat(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on **bold** and `code` patterns, producing React elements instead of raw HTML
  const regex = /(\*\*(.+?)\*\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={key++}>{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(<code key={key++} className="bg-muted px-1 rounded text-xs font-mono">{match[3]}</code>);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

// ---------------------------------------------------------------------------
// ArticleDetailView
// ---------------------------------------------------------------------------

interface ArticleDetailProps {
  article: KnowledgeArticle;
  relatedArticles: KnowledgeArticle[];
  onBack: () => void;
  onNavigate: (id: string) => void;
}

const ArticleDetailView = memo(function ArticleDetailView({ article, relatedArticles, onBack, onNavigate }: ArticleDetailProps) {
  const categoryInfo = CATEGORY_LABELS[article.category];

  return (
    <div data-testid="article-detail" className="flex flex-col h-full">
      {/* Breadcrumb */}
      <div data-testid="article-breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
        <Button
          data-testid="article-back"
          variant="ghost"
          size="sm"
          className="h-7 px-2"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <ChevronRight className="w-3 h-3" />
        <span>{categoryInfo.label}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground">{article.title}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl space-y-4">
          {/* Meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <DifficultyBadge level={article.difficulty} />
            <Badge variant="secondary" className="text-xs">
              <Layers className="w-3 h-3 mr-1" />
              {categoryInfo.label}
            </Badge>
          </div>

          {/* Content */}
          <ArticleContent content={article.content} />

          {/* Tags */}
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium">
              <Tag className="w-4 h-4" />
              Tags
            </div>
            <div data-testid="article-detail-tags" className="flex flex-wrap gap-1">
              {article.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
              ))}
            </div>
          </div>

          {/* Related Topics */}
          {relatedArticles.length > 0 && (
            <>
              <Separator />
              <div className="space-y-2">
                <div className="text-sm font-medium">Related Topics</div>
                <div data-testid="article-related" className="flex flex-wrap gap-2">
                  {relatedArticles.map((related) => (
                    <Badge
                      key={related.id}
                      data-testid={`related-${related.id}`}
                      variant="secondary"
                      className="cursor-pointer hover:bg-primary/20 transition-colors"
                      onClick={() => { onNavigate(related.id); }}
                    >
                      {related.title}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
});

// ---------------------------------------------------------------------------
// KnowledgeView
// ---------------------------------------------------------------------------

export default function KnowledgeView() {
  const {
    search,
    getArticle,
    getByCategory,
    getByDifficulty,
    getRelated,
    getAllArticles,
    getCategories,
    articleCount,
  } = useKnowledgeBase();

  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ArticleCategory | '__all__'>('__all__');
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyLevel | '__all__'>('__all__');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const selectedArticle = selectedArticleId ? getArticle(selectedArticleId) : null;
  const relatedArticles = selectedArticleId ? getRelated(selectedArticleId) : [];

  const filteredArticles = useMemo(() => {
    let results: KnowledgeArticle[];

    if (query.trim()) {
      results = search(query);
    } else {
      results = getAllArticles();
    }

    if (categoryFilter !== '__all__') {
      const catArticles = getByCategory(categoryFilter);
      const catIds = new Set(catArticles.map((a) => a.id));
      results = results.filter((a) => catIds.has(a.id));
    }

    if (difficultyFilter !== '__all__') {
      const diffArticles = getByDifficulty(difficultyFilter);
      const diffIds = new Set(diffArticles.map((a) => a.id));
      results = results.filter((a) => diffIds.has(a.id));
    }

    return results;
  }, [query, categoryFilter, difficultyFilter, search, getAllArticles, getByCategory, getByDifficulty]);

  const categories = useMemo(() => getCategories(), [getCategories]);

  const handleArticleClick = useCallback((id: string) => {
    setSelectedArticleId(id);
  }, []);

  const handleBack = useCallback(() => {
    setSelectedArticleId(null);
  }, []);

  // Article detail view
  if (selectedArticle) {
    return (
      <div data-testid="knowledge-view" className="flex flex-col h-full p-4">
        <ArticleDetailView
          article={selectedArticle}
          relatedArticles={relatedArticles}
          onBack={handleBack}
          onNavigate={handleArticleClick}
        />
      </div>
    );
  }

  // Browse view
  return (
    <div data-testid="knowledge-view" className="flex flex-col h-full gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BookMarked className="w-5 h-5 text-primary" />
        <h2 data-testid="knowledge-title" className="text-lg font-semibold">Electronics Knowledge Hub</h2>
        <Badge data-testid="knowledge-count" variant="secondary">{articleCount} articles</Badge>
      </div>

      {/* Search + Filters */}
      <div data-testid="knowledge-filters" className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="knowledge-search"
            placeholder="Search articles..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); }}
            className="pl-8 h-9"
          />
        </div>

        <Select
          value={categoryFilter}
          onValueChange={(v) => { setCategoryFilter(v as ArticleCategory | '__all__'); }}
        >
          <SelectTrigger data-testid="knowledge-category-filter" className="w-44 h-9 text-xs">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All categories</SelectItem>
            {ALL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat].label} ({categories.find((c) => c.category === cat)?.count ?? 0})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={difficultyFilter}
          onValueChange={(v) => { setDifficultyFilter(v as DifficultyLevel | '__all__'); }}
        >
          <SelectTrigger data-testid="knowledge-difficulty-filter" className="w-36 h-9 text-xs">
            <SelectValue placeholder="All levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All levels</SelectItem>
            {ALL_DIFFICULTIES.map((d) => (
              <SelectItem key={d} value={d}>{DIFFICULTY_CONFIG[d].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Article grid */}
      <ScrollArea className="flex-1">
        <div data-testid="knowledge-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} onClick={handleArticleClick} />
          ))}
        </div>
        {filteredArticles.length === 0 && (
          <div data-testid="knowledge-empty" className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Search className="w-8 h-8 mb-2" />
            <p className="text-sm">No articles found matching your search.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
