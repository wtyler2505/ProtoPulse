import { memo, useState } from 'react';
import { Database, Search, Info, ExternalLink, AlertCircle, ChevronRight, ChevronDown, BookOpen, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolSource, ConfidenceScore } from '@/lib/project-context';
import ConfidenceBadge from '@/components/ui/ConfidenceBadge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useVaultNote } from '@/hooks/useVaultSearch';

interface AnswerSourcePanelProps {
  sources: ToolSource[];
  confidence?: ConfidenceScore;
  className?: string;
}

function getSourceIcon(type: string) {
  switch (type) {
    case 'bom_item': return Database;
    case 'node':
    case 'edge':
    case 'net':
    case 'sheet': return Search;
    case 'knowledge_base': return BookOpen;
    default: return Info;
  }
}

/**
 * Displays the full body of a vault note when a knowledge_base source is clicked.
 * Uses the /api/vault/note/:slug endpoint via useVaultNote hook.
 */
function VaultNoteDialog({ slug, open, onOpenChange }: { slug: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, error } = useVaultNote(open ? slug : null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <BookOpen className="w-4 h-4" />
            {data?.title ?? slug}
          </DialogTitle>
          {data?.description && (
            <DialogDescription className="text-xs italic">{data.description}</DialogDescription>
          )}
        </DialogHeader>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading vault note…
          </div>
        )}
        {error && (
          <div className="text-sm text-destructive py-4">
            Failed to load note: {error instanceof Error ? error.message : String(error)}
          </div>
        )}
        {data && (
          <div className="space-y-3 text-sm">
            {data.topics.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.topics.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/50 text-muted-foreground">
                    #{t}
                  </span>
                ))}
              </div>
            )}
            <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed bg-muted/20 p-3 rounded-sm border border-border/30">
              {data.body.trim()}
            </pre>
            {data.links.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">
                  Linked Notes ({data.links.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {data.links.slice(0, 20).map((link) => (
                    <span key={link} className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary/80">
                      {link}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const AnswerSourcePanel = ({ sources, confidence, className }: AnswerSourcePanelProps) => {
  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);
  const [openVaultSlug, setOpenVaultSlug] = useState<string | null>(null);

  if (sources.length === 0 && !confidence) return null;

  return (
    <div className={cn("mt-3 pt-3 border-t border-border/40 space-y-3", className)}>
      {sources.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold px-1">
            <Database className="w-3 h-3" />
            Design Sources ({sources.length})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {sources.map((source, idx) => {
              const Icon = getSourceIcon(source.type);
              const isVault = source.type === 'knowledge_base';
              const vaultSlug = isVault && typeof source.id === 'string' ? source.id : null;
              const baseClass = "flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border/50 rounded-sm text-[10px] text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors group";
              const clickableClass = vaultSlug ? "cursor-pointer hover:bg-muted/50" : "cursor-default";
              return (
                <button
                  type="button"
                  key={`${source.type}-${idx}`}
                  className={cn(baseClass, clickableClass)}
                  onClick={vaultSlug ? () => setOpenVaultSlug(vaultSlug) : undefined}
                  disabled={!vaultSlug}
                  aria-label={vaultSlug ? `Open vault note: ${source.label}` : source.label}
                >
                  <Icon className="w-2.5 h-2.5 opacity-70 group-hover:text-primary" />
                  <span>{source.label}</span>
                </button>
              );
            })}
          </div>
          {openVaultSlug && (
            <VaultNoteDialog
              slug={openVaultSlug}
              open={Boolean(openVaultSlug)}
              onOpenChange={(next) => { if (!next) setOpenVaultSlug(null); }}
            />
          )}
        </div>
      )}

      {confidence && (
        <div className="space-y-1.5 bg-muted/20 p-2 rounded-sm border border-border/30">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
              <AlertCircle className="w-3 h-3" />
              AI Confidence
            </div>
            <ConfidenceBadge confidence={confidence} className="scale-90 origin-right" />
          </div>
          
          <button 
            onClick={() => setShowConfidenceDetails(!showConfidenceDetails)}
            className="flex items-center gap-1 text-[9px] text-primary/70 hover:text-primary transition-colors mt-1 font-medium"
          >
            {showConfidenceDetails ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronRight className="w-2.5 h-2.5" />}
            {showConfidenceDetails ? 'Hide details' : 'Why this score?'}
          </button>

          {showConfidenceDetails && (
            <div className="pt-1.5 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                "{confidence.explanation}"
              </p>
              <div className="space-y-1">
                {confidence.factors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-[9px] text-muted-foreground/80">
                    <div className="w-1 h-1 rounded-full bg-primary/40 mt-1 shrink-0" />
                    <span>{factor}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default memo(AnswerSourcePanel);
