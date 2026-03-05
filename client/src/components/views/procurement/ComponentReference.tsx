import { Cpu, ChevronDown, ChevronUp } from 'lucide-react';
import type { PartMeta } from '@shared/component-types';

interface ComponentPart {
  id: number | string;
  meta?: unknown;
}

export interface ComponentReferenceProps {
  showComponentRef: boolean;
  onToggleComponentRef: () => void;
  componentParts: ComponentPart[] | undefined;
  partsLoading: boolean;
}

export function ComponentReference({ showComponentRef, onToggleComponentRef, componentParts, partsLoading }: ComponentReferenceProps) {
  return (
    <div className="mt-4 border border-border bg-card/80 backdrop-blur shadow-sm" data-testid="panel-component-reference">
      <button
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={onToggleComponentRef}
        data-testid="button-toggle-component-ref"
      >
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Component Parts Reference</span>
          {componentParts && componentParts.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 font-mono" data-testid="text-component-count">
              {componentParts.length}
            </span>
          )}
        </div>
        {showComponentRef ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {showComponentRef && (
        <div className="border-t border-border animate-in slide-in-from-top-1" data-testid="panel-component-ref-content">
          {partsLoading ? (
            <div className="px-4 py-8 text-center text-muted-foreground text-sm">Loading component parts...</div>
          ) : !componentParts || componentParts.length === 0 ? (
            <div className="px-4 py-8 text-center text-muted-foreground">
              <Cpu className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No component parts defined</p>
              <p className="text-xs mt-1">Create parts in the Component Editor to see them here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left min-w-[600px]" data-testid="table-component-parts">
                <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Manufacturer</th>
                    <th className="px-4 py-2">MPN</th>
                    <th className="px-4 py-2">Package</th>
                    <th className="px-4 py-2">Mounting</th>
                    <th className="px-4 py-2 w-48">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {componentParts.map((part) => {
                    const meta = (part.meta || {}) as PartMeta;
                    return (
                      <tr key={part.id} className="hover:bg-muted/30 transition-colors" data-testid={`row-component-part-${part.id}`}>
                        <td className="px-4 py-2 font-medium text-foreground text-xs" data-testid={`text-part-title-${part.id}`}>
                          {meta.title || '\u2014'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs" data-testid={`text-part-manufacturer-${part.id}`}>
                          {meta.manufacturer || '\u2014'}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-foreground" data-testid={`text-part-mpn-${part.id}`}>
                          {meta.mpn || '\u2014'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs" data-testid={`text-part-package-${part.id}`}>
                          {meta.packageType || '\u2014'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs" data-testid={`text-part-mounting-${part.id}`}>
                          {meta.mountingType || '\u2014'}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground text-xs max-w-[12rem] truncate" data-testid={`text-part-description-${part.id}`}>
                          {meta.description || '\u2014'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
