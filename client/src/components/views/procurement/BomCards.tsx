import { memo } from 'react';
import { ShoppingCart, Copy, Trash2, CheckCircle2, AlertCircle, XCircle, Zap } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { LifecycleBadge } from '@/components/ui/LifecycleBadge';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import { getSupplierSearchUrl } from '@/lib/constants';
import type { useToast } from '@/hooks/use-toast';
import type { EnrichedBomItem } from './types';

export interface BomCardsProps {
  filteredBom: EnrichedBomItem[];
  deleteBomItem: (id: number | string) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

interface BomCardItemProps {
  item: EnrichedBomItem;
  deleteBomItem: (id: number | string) => void;
  toast: ReturnType<typeof useToast>['toast'];
}

const BomCardItem = memo(function BomCardItem({ item, deleteBomItem, toast }: BomCardItemProps) {
  return (
    <div className="border border-border bg-card/80 backdrop-blur p-3 space-y-2" data-testid={`card-bom-${item.id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {item._isEsd && (
            <StyledTooltip content="ESD Sensitive — Handle with anti-static precautions. Use ESD wrist strap and grounded work surface." side="right">
              <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`esd-badge-card-${item.id}`} />
            </StyledTooltip>
          )}
          <div className="min-w-0">
            <div className="font-mono font-medium text-foreground text-xs truncate">{item.partNumber}</div>
            <div className="text-muted-foreground text-xs truncate">{item.manufacturer}</div>
          </div>
        </div>
        <span className={cn('shrink-0 inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border uppercase tracking-wide',
          item.status === 'In Stock'
            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            : item.status === 'Low Stock'
              ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20',
        )}>
          {item.status === 'In Stock' && <CheckCircle2 className="w-3 h-3" />}
          {item.status === 'Low Stock' && <AlertCircle className="w-3 h-3" />}
          {item.status === 'Out of Stock' && <XCircle className="w-3 h-3" />}
          {item.status}
        </span>
      </div>
      {item.description && <div className="text-muted-foreground text-xs truncate">{item.description}</div>}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-muted-foreground">
          <span>Qty: <span className="font-mono text-foreground">{item.quantity}</span></span>
          <span>@ <span className="font-mono text-foreground">${(Math.round(Number(item.unitPrice) * 100) / 100).toFixed(2)}</span></span>
          <span>{item.supplier}</span>
        </div>
        <span className="font-mono font-bold text-foreground">${(Math.round(Number(item.totalPrice) * 100) / 100).toFixed(2)}</span>
      </div>
      <div className="flex items-center gap-1 pt-1 border-t border-border">
        <button
          aria-label="Add to cart"
          className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-primary hover:bg-primary/10 transition-colors"
          onClick={() => {
            const baseUrl = getSupplierSearchUrl(item.supplier);
            if (!baseUrl) { return; }
            window.open(baseUrl + encodeURIComponent(item.partNumber), '_blank', 'noopener,noreferrer');
          }}
          data-testid={`card-button-cart-${item.id}`}
        >
          <ShoppingCart className="w-4 h-4" />
        </button>
        <button
          aria-label="Copy part number"
          className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-muted-foreground hover:bg-muted/30 transition-colors"
          onClick={() => { copyToClipboard(item.partNumber); toast({ title: 'Copied', description: 'Part number copied.' }); }}
          data-testid={`card-button-copy-${item.id}`}
        >
          <Copy className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <ConfirmDialog
          trigger={
            <button aria-label="Delete item" className="min-w-[44px] min-h-[44px] p-2.5 flex items-center justify-center text-destructive hover:bg-destructive/10 transition-colors" data-testid={`card-button-delete-${item.id}`}>
              <Trash2 className="w-4 h-4" />
            </button>
          }
          title="Remove BOM Item"
          description={`Remove "${item.partNumber}" from the Bill of Materials?`}
          confirmLabel="Remove"
          variant="destructive"
          onConfirm={() => deleteBomItem(item.id)}
        />
      </div>
    </div>
  );
});

export function BomCards({ filteredBom, deleteBomItem, toast }: BomCardsProps) {
  return (
    <div className="lg:hidden space-y-2" data-testid="bom-cards">
      {filteredBom.map((item) => (
        <BomCardItem key={item.id} item={item} deleteBomItem={deleteBomItem} toast={toast} />
      ))}
    </div>
  );
}
