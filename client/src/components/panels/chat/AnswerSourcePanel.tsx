import { memo, useState } from 'react';
import { Database, Search, Info, ExternalLink, AlertCircle, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolSource, ConfidenceScore } from '@/lib/project-context';
import ConfidenceBadge from '@/components/ui/ConfidenceBadge';

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
    case 'knowledge_base': return Info;
    default: return Info;
  }
}

const AnswerSourcePanel = ({ sources, confidence, className }: AnswerSourcePanelProps) => {
  const [showConfidenceDetails, setShowConfidenceDetails] = useState(false);

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
              return (
                <div 
                  key={`${source.type}-${idx}`}
                  className="flex items-center gap-1.5 px-2 py-1 bg-muted/30 border border-border/50 rounded-sm text-[10px] text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors cursor-default group"
                >
                  <Icon className="w-2.5 h-2.5 opacity-70 group-hover:text-primary" />
                  <span>{source.label}</span>
                </div>
              );
            })}
          </div>
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
