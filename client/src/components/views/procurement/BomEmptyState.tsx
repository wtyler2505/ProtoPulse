import { Package, Plus } from 'lucide-react';

export interface BomEmptyStateProps {
  searchTerm: string;
  onClearSearch: () => void;
  onAddItem: () => void;
}

export function BomEmptyState({ searchTerm, onClearSearch, onAddItem }: BomEmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground" data-testid="empty-state-bom">
      <Package className="w-12 h-12 mb-4 opacity-30" />
      {searchTerm ? (
        <>
          <p className="text-sm font-medium text-foreground">No matching components</p>
          <p className="text-xs mt-1">No BOM items match &quot;{searchTerm}&quot;. Try a different search term.</p>
          <button
            onClick={onClearSearch}
            className="mt-3 px-4 py-1.5 text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
            data-testid="button-clear-search"
          >
            Clear Search
          </button>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-foreground">No items in your Bill of Materials</p>
          <p className="text-xs mt-1 max-w-sm text-center">
            Add your first component manually, or use AI chat to populate the BOM from your architecture.
          </p>
          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={onAddItem}
              className="px-4 py-1.5 text-xs border border-primary bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
              data-testid="button-add-first-item"
            >
              <Plus className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
              Add First Item
            </button>
          </div>
        </>
      )}
    </div>
  );
}
