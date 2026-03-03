import { memo } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DatasheetLinkProps {
  datasheetUrl?: string | null;
  onLookup?: () => void;
  className?: string;
}

/**
 * Displays a datasheet link if available, or a "No datasheet" placeholder
 * with an optional lookup button.
 *
 * - When `datasheetUrl` is set: shows a clickable external link with icon.
 * - When no URL: shows "No datasheet" text and an optional "Find" button.
 */
const DatasheetLink = memo(function DatasheetLink({ datasheetUrl, onLookup, className }: DatasheetLinkProps) {
  if (datasheetUrl) {
    return (
      <a
        href={datasheetUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="datasheet-link"
        className={cn(
          'inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors',
          className,
        )}
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        <span>Datasheet</span>
      </a>
    );
  }

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted-foreground', className)}>
      <span>No datasheet</span>
      {onLookup && (
        <button
          type="button"
          onClick={onLookup}
          data-testid="datasheet-find-button"
          className="inline-flex items-center gap-0.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <Search className="h-3 w-3 shrink-0" />
          <span>Find</span>
        </button>
      )}
    </span>
  );
});

export default DatasheetLink;
