/**
 * VaultBrowserView — explore the Ars Contexta knowledge vault directly in the UI.
 *
 * Three-pane layout:
 *   - Left: topic maps (MOCs) — click to filter the middle pane to that MOC's linked notes
 *   - Middle: matching notes (from search) or linked notes of the selected MOC
 *   - Right: full note body for the selected slug, rendered as markdown, with
 *     clickable topic chips and linked-note chips
 *
 * Data flows through `useVaultSearch`, `useVaultMocs`, and `useVaultNote`
 * (client/src/hooks/useVaultSearch.ts). The server-side endpoints require
 * `q.min(1)` so there is no "list all notes" path — the default state (no
 * search, no MOC selected) shows an instructional empty state instead of a
 * full note dump.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpenText,
  Search,
  Network,
  FileText,
  Tag,
  Link2,
  Loader2,
  BookOpen,
  AlertCircle,
  Layers,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  useVaultSearch,
  useVaultNote,
  useVaultMocs,
  type VaultSearchHit,
  type VaultMocListing,
} from '@/hooks/useVaultSearch';
import { MarkdownContent } from '@/components/panels/chat/MessageBubble';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a slug like "eda-fundamentals-overview" into a display title. */
function slugToTitle(slug: string): string {
  return slug
    .split(/[-_/]/)
    .filter(Boolean)
    .map((part) => (part.length > 0 ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

// ---------------------------------------------------------------------------
// Debounced search input
// ---------------------------------------------------------------------------

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = setTimeout(() => { setDebounced(value); }, delayMs);
    return () => { clearTimeout(id); };
  }, [value, delayMs]);
  return debounced;
}

// ---------------------------------------------------------------------------
// Note type badge
// ---------------------------------------------------------------------------

const TYPE_STYLES: Record<string, string> = {
  moc: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  atomic: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  part: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  tension: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  observation: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
  reference: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
};

const NoteTypeBadge = memo(function NoteTypeBadge({ type }: { type: string }) {
  const style = TYPE_STYLES[type] ?? 'bg-muted/40 text-muted-foreground border-border/50';
  return (
    <Badge
      data-testid={`vault-note-type-${type}`}
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0 h-4 font-mono uppercase tracking-wider', style)}
    >
      {type}
    </Badge>
  );
});

// ---------------------------------------------------------------------------
// MOC list item
// ---------------------------------------------------------------------------

interface MocItemProps {
  moc: VaultMocListing;
  isSelected: boolean;
  onSelect: (slug: string) => void;
}

const MocItem = memo(function MocItem({ moc, isSelected, onSelect }: MocItemProps) {
  return (
    <button
      type="button"
      data-testid={`vault-moc-${moc.slug}`}
      onClick={() => { onSelect(moc.slug); }}
      className={cn(
        'w-full text-left px-3 py-2 border-l-2 transition-colors group',
        isSelected
          ? 'bg-primary/10 border-l-primary'
          : 'border-l-transparent hover:bg-muted/40 hover:border-l-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'text-xs font-medium leading-tight line-clamp-2',
            isSelected ? 'text-primary' : 'text-foreground',
          )}
        >
          {moc.title}
        </span>
        <Badge
          variant="secondary"
          className="text-[9px] px-1 py-0 h-4 shrink-0 font-mono"
        >
          {moc.linkCount}
        </Badge>
      </div>
      {moc.description && (
        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 leading-snug">
          {moc.description}
        </p>
      )}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Note list item (used for both search hits and MOC-linked notes)
// ---------------------------------------------------------------------------

interface NoteListItemProps {
  slug: string;
  title: string;
  description: string;
  type: string;
  isSelected: boolean;
  onSelect: (slug: string) => void;
}

const NoteListItem = memo(function NoteListItem({
  slug,
  title,
  description,
  type,
  isSelected,
  onSelect,
}: NoteListItemProps) {
  return (
    <button
      type="button"
      data-testid={`vault-note-item-${slug}`}
      onClick={() => { onSelect(slug); }}
      className={cn(
        'w-full text-left px-3 py-2 border-l-2 transition-colors',
        isSelected
          ? 'bg-primary/10 border-l-primary'
          : 'border-l-transparent hover:bg-muted/40 hover:border-l-primary/40',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span
          className={cn(
            'text-xs font-semibold leading-tight line-clamp-2',
            isSelected ? 'text-primary' : 'text-foreground',
          )}
        >
          {title}
        </span>
        <NoteTypeBadge type={type} />
      </div>
      {description && (
        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
          {description}
        </p>
      )}
    </button>
  );
});

// ---------------------------------------------------------------------------
// Left pane — MOC list
// ---------------------------------------------------------------------------

interface MocPaneProps {
  selectedMocSlug: string | null;
  onSelectMoc: (slug: string | null) => void;
}

const MocPane = memo(function MocPane({ selectedMocSlug, onSelectMoc }: MocPaneProps) {
  const { data, isLoading, error } = useVaultMocs();

  return (
    <Card data-testid="vault-moc-pane" className="flex flex-col h-full bg-card/40 border-border/50">
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <Network className="w-3.5 h-3.5" />
          Topic Maps
          {data && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono ml-auto">
              {data.count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <Separator className="bg-border/40" />
      <ScrollArea className="flex-1">
        <div className="py-1">
          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading topic maps…
            </div>
          )}
          {error && (
            <div className="flex items-start gap-2 text-xs text-destructive px-3 py-4">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Failed to load MOCs: {error instanceof Error ? error.message : String(error)}</span>
            </div>
          )}
          {data && data.mocs.length === 0 && (
            <div className="text-xs text-muted-foreground px-3 py-4">
              No topic maps found in the vault.
            </div>
          )}
          {selectedMocSlug && (
            <div className="px-3 pb-2">
              <Button
                data-testid="vault-moc-clear"
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] px-2 w-full justify-start"
                onClick={() => { onSelectMoc(null); }}
              >
                Clear topic filter
              </Button>
            </div>
          )}
          {data?.mocs.map((moc) => (
            <MocItem
              key={moc.slug}
              moc={moc}
              isSelected={moc.slug === selectedMocSlug}
              onSelect={(slug) => { onSelectMoc(slug === selectedMocSlug ? null : slug); }}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Middle pane — search hits OR MOC-linked notes OR empty state
// ---------------------------------------------------------------------------

interface NoteListPaneProps {
  searchQuery: string;
  selectedMocSlug: string | null;
  selectedNoteSlug: string | null;
  onSelectNote: (slug: string) => void;
}

const NoteListPane = memo(function NoteListPane({
  searchQuery,
  selectedMocSlug,
  selectedNoteSlug,
  onSelectNote,
}: NoteListPaneProps) {
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const searchResult = useVaultSearch(debouncedQuery, 25);
  const mocDetail = useVaultNote(selectedMocSlug);

  const searchActive = debouncedQuery.trim().length >= 3;

  // When a MOC is selected AND no search is active, show the MOC's linked notes.
  // When a search is active, search wins regardless of MOC.
  // When neither, show the empty instructional state.
  const body = useMemo(() => {
    if (searchActive) {
      if (searchResult.isLoading) {
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Searching vault…
          </div>
        );
      }
      if (searchResult.error) {
        return (
          <div className="flex items-start gap-2 text-xs text-destructive px-3 py-4">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Search failed: {searchResult.error instanceof Error ? searchResult.error.message : String(searchResult.error)}</span>
          </div>
        );
      }
      const hits = searchResult.data?.results ?? [];
      if (hits.length === 0) {
        return (
          <div
            data-testid="vault-note-list-empty-search"
            className="flex flex-col items-center justify-center py-10 px-4 text-center text-xs text-muted-foreground"
          >
            <Search className="w-6 h-6 mb-2 opacity-60" />
            <p>No notes matched "{debouncedQuery}".</p>
            <p className="mt-1 opacity-70">Try a different keyword or pick a topic map on the left.</p>
          </div>
        );
      }
      return hits.map((hit: VaultSearchHit) => (
        <NoteListItem
          key={hit.slug}
          slug={hit.slug}
          title={hit.title}
          description={hit.description}
          type={hit.type}
          isSelected={hit.slug === selectedNoteSlug}
          onSelect={onSelectNote}
        />
      ));
    }

    if (selectedMocSlug) {
      if (mocDetail.isLoading) {
        return (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading topic map…
          </div>
        );
      }
      if (mocDetail.error) {
        return (
          <div className="flex items-start gap-2 text-xs text-destructive px-3 py-4">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            <span>Failed to load MOC: {mocDetail.error instanceof Error ? mocDetail.error.message : String(mocDetail.error)}</span>
          </div>
        );
      }
      const links = mocDetail.data?.links ?? [];
      if (links.length === 0) {
        return (
          <div
            data-testid="vault-note-list-empty-moc"
            className="flex flex-col items-center justify-center py-10 px-4 text-center text-xs text-muted-foreground"
          >
            <Layers className="w-6 h-6 mb-2 opacity-60" />
            <p>This topic map has no linked notes yet.</p>
          </div>
        );
      }
      return links.map((linkSlug) => (
        <NoteListItem
          key={linkSlug}
          slug={linkSlug}
          title={slugToTitle(linkSlug)}
          description=""
          type="linked"
          isSelected={linkSlug === selectedNoteSlug}
          onSelect={onSelectNote}
        />
      ));
    }

    return (
      <div
        data-testid="vault-note-list-empty-idle"
        className="flex flex-col items-center justify-center py-10 px-4 text-center text-xs text-muted-foreground"
      >
        <BookOpenText className="w-6 h-6 mb-2 opacity-60" />
        <p>Search the vault or pick a topic map.</p>
        <p className="mt-1 opacity-70">
          Type at least 3 characters to search, or click a topic on the left to browse its linked notes.
        </p>
      </div>
    );
  }, [searchActive, searchResult, debouncedQuery, selectedMocSlug, mocDetail, selectedNoteSlug, onSelectNote]);

  const headerCount = (() => {
    if (searchActive && searchResult.data) { return searchResult.data.count; }
    if (selectedMocSlug && mocDetail.data) { return mocDetail.data.links.length; }
    return null;
  })();

  const headerLabel = (() => {
    if (searchActive) { return `Results for "${debouncedQuery}"`; }
    if (selectedMocSlug && mocDetail.data) { return mocDetail.data.title; }
    if (selectedMocSlug) { return 'Topic map'; }
    return 'Notes';
  })();

  return (
    <Card data-testid="vault-note-list-pane" className="flex flex-col h-full bg-card/40 border-border/50">
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span className="truncate">{headerLabel}</span>
          {headerCount !== null && (
            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono ml-auto shrink-0">
              {headerCount}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <Separator className="bg-border/40" />
      <ScrollArea className="flex-1">
        <div className="py-1">{body}</div>
      </ScrollArea>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// Right pane — full note detail
// ---------------------------------------------------------------------------

interface NoteDetailPaneProps {
  slug: string | null;
  onSelectNote: (slug: string) => void;
}

const NoteDetailPane = memo(function NoteDetailPane({ slug, onSelectNote }: NoteDetailPaneProps) {
  const { data, isLoading, error } = useVaultNote(slug);

  return (
    <Card data-testid="vault-note-detail-pane" className="flex flex-col h-full bg-card/40 border-border/50">
      <CardHeader className="pb-2 px-3 pt-3">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Note Detail
        </CardTitle>
      </CardHeader>
      <Separator className="bg-border/40" />
      <ScrollArea className="flex-1">
        <div className="p-4">
          {!slug && (
            <div
              data-testid="vault-note-detail-empty"
              className="flex flex-col items-center justify-center py-12 text-center text-xs text-muted-foreground"
            >
              <BookOpen className="w-6 h-6 mb-2 opacity-60" />
              <p>Select a note to read its full body.</p>
            </div>
          )}
          {slug && isLoading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading note…
            </div>
          )}
          {slug && error && (
            <div className="flex items-start gap-2 text-xs text-destructive py-4">
              <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Failed to load note: {error instanceof Error ? error.message : String(error)}</span>
            </div>
          )}
          {slug && data && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <h3 data-testid="vault-note-title" className="text-base font-bold leading-tight flex-1">
                    {data.title}
                  </h3>
                  <NoteTypeBadge type={data.type} />
                </div>
                {data.description && (
                  <p className="text-xs italic text-muted-foreground leading-relaxed">
                    {data.description}
                  </p>
                )}
                <div className="text-[10px] font-mono text-muted-foreground/60">
                  {data.slug}
                </div>
              </div>

              {data.topics.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1 mb-1">
                    <Tag className="w-3 h-3" />
                    Topics ({data.topics.length})
                  </div>
                  <div data-testid="vault-note-topics" className="flex flex-wrap gap-1">
                    {data.topics.map((t) => (
                      <Badge
                        key={t}
                        variant="outline"
                        className="text-[10px] px-1.5 py-0 h-4 bg-muted/30 text-muted-foreground border-border/50"
                      >
                        #{t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="bg-border/40" />

              <div data-testid="vault-note-body" className="text-sm leading-relaxed">
                <MarkdownContent content={data.body.trim()} />
              </div>

              {data.links.length > 0 && (
                <>
                  <Separator className="bg-border/40" />
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold flex items-center gap-1 mb-1.5">
                      <Link2 className="w-3 h-3" />
                      Linked Notes ({data.links.length})
                    </div>
                    <div data-testid="vault-note-links" className="flex flex-wrap gap-1">
                      {data.links.map((linkSlug) => (
                        <button
                          type="button"
                          key={linkSlug}
                          data-testid={`vault-note-link-${linkSlug}`}
                          onClick={() => { onSelectNote(linkSlug); }}
                          className="text-[10px] px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary/80 hover:bg-primary/20 hover:text-primary transition-colors border border-primary/20"
                          title={linkSlug}
                        >
                          {slugToTitle(linkSlug)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
});

// ---------------------------------------------------------------------------
// VaultBrowserView
// ---------------------------------------------------------------------------

export default function VaultBrowserView() {
  const [query, setQuery] = useState('');
  const [selectedMocSlug, setSelectedMocSlug] = useState<string | null>(null);
  const [selectedNoteSlug, setSelectedNoteSlug] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSelectMoc = useCallback((slug: string | null) => {
    setSelectedMocSlug(slug);
    // Reset note selection when the filter context changes.
    setSelectedNoteSlug(null);
  }, []);

  const handleSelectNote = useCallback((slug: string) => {
    setSelectedNoteSlug(slug);
  }, []);

  const handleQueryChange = useCallback((next: string) => {
    setQuery(next);
    // When typing a new query, clear the selected note so the detail pane
    // doesn't linger on an unrelated result.
    if (next.trim().length === 0) {
      setSelectedNoteSlug(null);
    }
  }, []);

  return (
    <div
      data-testid="vault-browser-view"
      className="flex flex-col h-full gap-3 p-4"
    >
      {/* Header */}
      <div className="flex items-center gap-2 shrink-0">
        <BookOpenText className="w-5 h-5 text-primary" />
        <h2
          data-testid="vault-browser-title"
          className="text-lg font-semibold"
        >
          Knowledge Vault
        </h2>
        <Badge variant="secondary" className="text-[10px] font-mono">
          Ars Contexta
        </Badge>
      </div>

      {/* Search bar */}
      <div data-testid="vault-browser-search-wrapper" className="relative shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          data-testid="vault-browser-search"
          placeholder="Search the vault (min 3 chars)…"
          value={query}
          onChange={(e) => { handleQueryChange(e.target.value); }}
          className="pl-8 h-9"
        />
      </div>

      {/* Three-pane grid */}
      <div
        data-testid="vault-browser-panes"
        className="grid grid-cols-1 md:grid-cols-[minmax(220px,18%)_minmax(260px,28%)_1fr] gap-3 flex-1 min-h-0"
      >
        <MocPane
          selectedMocSlug={selectedMocSlug}
          onSelectMoc={handleSelectMoc}
        />
        <NoteListPane
          searchQuery={query}
          selectedMocSlug={selectedMocSlug}
          selectedNoteSlug={selectedNoteSlug}
          onSelectNote={handleSelectNote}
        />
        <NoteDetailPane
          slug={selectedNoteSlug}
          onSelectNote={handleSelectNote}
        />
      </div>
    </div>
  );
}
