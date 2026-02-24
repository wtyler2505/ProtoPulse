import { forwardRef } from 'react';
import {
  Search, X, ArrowUpDown, Component,
} from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  label: string;
  icon: typeof Component;
}

interface AssetSearchProps {
  search: string;
  setSearch: (v: string) => void;
  sortBy: 'name' | 'category' | 'recent';
  cycleSortBy: () => void;
  sortLabel: string;
  categories: Category[];
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  getCategoryCount: (catId: string) => { filtered: number; total: number };
  showLabels: boolean;
  onClose?: () => void;
}

const AssetSearch = forwardRef<HTMLInputElement, AssetSearchProps>(({
  search,
  setSearch,
  sortBy,
  cycleSortBy,
  sortLabel,
  categories,
  activeCategory,
  setActiveCategory,
  getCategoryCount,
  showLabels,
  onClose,
}, ref) => {
  return (
    <>
      <div className="p-3 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-display font-bold text-sm flex items-center gap-2">
            <Component className="w-4 h-4 text-primary" />
            Asset Library
          </h3>
          <div className="flex items-center gap-1">
            {onClose && (
              <StyledTooltip content="Close asset library" side="bottom">
                  <button
                    data-testid="asset-manager-close"
                    className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    onClick={onClose}
                  >
                    <X className="w-4 h-4" />
                  </button>
              </StyledTooltip>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              ref={ref}
              className="w-full pl-8 pr-2 py-1.5 bg-muted/50 border border-border text-xs focus:outline-none focus:border-primary transition-colors"
              placeholder="Search parts... ( / )"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="asset-search"
            />
          </div>
          <StyledTooltip content={`Sort: ${sortBy === 'name' ? 'Alphabetical' : sortBy === 'category' ? 'By Category' : 'Recently Used'}`} side="bottom">
              <button
                onClick={cycleSortBy}
                className="p-1.5 bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors flex items-center gap-1"
                data-testid="asset-sort"
              >
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span className="text-[8px]">{sortLabel}</span>
              </button>
          </StyledTooltip>
        </div>
      </div>
      <div className="flex gap-1 p-2 overflow-x-auto no-scrollbar border-b border-border bg-muted/10">
        {categories.map(cat => {
          const counts = getCategoryCount(cat.id);
          return (
            <StyledTooltip key={cat.id} content={`${cat.label} (${search ? `${counts.filtered}/${counts.total}` : counts.total})`} side="bottom">
                <button
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "relative p-1.5 transition-colors flex flex-col items-center",
                    showLabels && "px-2 py-2",
                    activeCategory === cat.id ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-muted'
                  )}
                  data-testid={`asset-category-${cat.id}`}
                  title={cat.label}
                >
                  <cat.icon className="w-4 h-4" />
                  {showLabels && <span className="text-[8px] mt-0.5">{cat.label.length > 8 ? cat.label.slice(0, 7) + '…' : cat.label}</span>}
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 flex items-center justify-center text-[9px] bg-[#21212199] text-[#dbdbdb]">
                    {search ? counts.filtered : counts.total}
                  </span>
                </button>
            </StyledTooltip>
          );
        })}
      </div>
    </>
  );
});

AssetSearch.displayName = 'AssetSearch';

export default AssetSearch;
