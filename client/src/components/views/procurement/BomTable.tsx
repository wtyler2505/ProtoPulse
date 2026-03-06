import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowUpDown, GripVertical, Pencil, Check, X, ShoppingCart, Trash2, Shield, Zap, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import { getSupplierSearchUrl } from '@/lib/constants';
import type { useToast } from '@/hooks/use-toast';
import type { BomItem } from '@/lib/project-context';
import type { EnrichedBomItem, EditValues } from './types';

const BOM_ROW_HEIGHT = 48;

export interface BomTableProps {
  filteredBom: EnrichedBomItem[];
  editingId: number | null;
  editValues: EditValues;
  setEditValues: React.Dispatch<React.SetStateAction<EditValues>>;
  handleEditKeyDown: (e: React.KeyboardEvent) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  startEdit: (item: BomItem) => void;
  deleteBomItem: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  toast: ReturnType<typeof useToast>['toast'];
  highlightedItemId: number | null;
  handleHighlightItem: (id: number) => void;
  onAssessDamage: (item: BomItem) => void;
}

export function BomTable({
  filteredBom, editingId, editValues, setEditValues, handleEditKeyDown, saveEdit, cancelEdit, startEdit, deleteBomItem, addOutputLog, toast, highlightedItemId, handleHighlightItem, onAssessDamage,
}: BomTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: filteredBom.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => BOM_ROW_HEIGHT,
    overscan: 10,
  });

  return (
    <div className="hidden lg:block border border-border overflow-hidden bg-card/80 backdrop-blur shadow-sm">
      <table aria-label="Bill of Materials" className="w-full text-sm text-left min-w-[800px]" data-testid="table-bom">
        <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
          <tr>
            <th className="w-8 px-1 py-3"><StyledTooltip content="Drag to reorder" side="right"><ArrowUpDown className="w-3 h-3 mx-auto" /></StyledTooltip></th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Part Number</th>
            <th className="px-4 py-3">Manufacturer</th>
            <th className="px-4 py-3 w-64">Description</th>
            <th className="px-4 py-3">Supplier</th>
            <th className="px-4 py-3 text-right">Stock</th>
            <th className="px-4 py-3 text-right">Qty</th>
            <th className="px-4 py-3 text-right">Unit Price</th>
            <th className="px-4 py-3 text-right">Total</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
      </table>
      <div ref={parentRef} className="overflow-auto max-h-[calc(100vh-20rem)]" style={{ contain: 'strict' }}>
        <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
          <table className="w-full text-sm text-left min-w-[800px]" style={{ position: 'absolute', top: 0, left: 0, width: '100%' }}>
            <SortableContext items={filteredBom.map(item => Number(item.id))} strategy={verticalListSortingStrategy}>
              <tbody className="divide-y divide-border" style={{ transform: `translateY(${virtualizer.getVirtualItems()[0]?.start ?? 0}px)` }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const item = filteredBom[virtualRow.index];
                  return (
                    <SortableBomRow key={item.id} item={item} editingId={editingId} editValues={editValues} setEditValues={setEditValues} handleEditKeyDown={handleEditKeyDown} saveEdit={saveEdit} cancelEdit={cancelEdit} startEdit={startEdit} deleteBomItem={deleteBomItem} addOutputLog={addOutputLog} toast={toast} highlighted={highlightedItemId === Number(item.id)} onHighlight={handleHighlightItem} onAssessDamage={onAssessDamage} />
                  );
                })}
              </tbody>
            </SortableContext>
          </table>
        </div>
      </div>
    </div>
  );
}

function SortableBomRow({ item, editingId, editValues, setEditValues, handleEditKeyDown, saveEdit, cancelEdit, startEdit, deleteBomItem, addOutputLog, toast, highlighted, onHighlight, onAssessDamage }: {
  item: EnrichedBomItem;
  editingId: number | null;
  editValues: EditValues;
  setEditValues: React.Dispatch<React.SetStateAction<EditValues>>;
  handleEditKeyDown: (e: React.KeyboardEvent) => void;
  saveEdit: () => void;
  cancelEdit: () => void;
  startEdit: (item: EnrichedBomItem) => void;
  deleteBomItem: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  toast: ReturnType<typeof useToast>['toast'];
  highlighted: boolean;
  onHighlight: (id: number) => void;
  onAssessDamage: (item: BomItem) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: Number(item.id) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const isEditing = editingId === Number(item.id);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <tr
          ref={setNodeRef}
          style={style}
          className={cn(
            'hover:bg-muted/30 transition-colors group cursor-pointer',
            isEditing && 'bg-primary/10 ring-1 ring-inset ring-primary/40',
            highlighted && 'ring-1 ring-inset ring-[#00F0FF]/60 bg-[#00F0FF]/5 animate-pulse',
          )}
          data-testid={`row-bom-${item.id}`}
          data-bom-item-highlight={highlighted ? 'true' : undefined}
          onClick={() => onHighlight(Number(item.id))}
        >
          <td className="w-8 px-1 py-3 text-center">
            {isEditing ? (
              <Pencil className="w-3.5 h-3.5 text-primary mx-auto animate-pulse" data-testid={`edit-indicator-${item.id}`} />
            ) : (
              <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing p-1 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`drag-handle-${item.id}`} aria-label="Drag to reorder">
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            )}
          </td>
          <td className="px-4 py-3">
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium border uppercase tracking-wide',
              item.status === 'In Stock' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : item.status === 'Low Stock' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                  : 'bg-destructive/10 text-destructive border-destructive/20',
            )} data-testid={`status-bom-${item.id}`}>
              {item.status === 'In Stock' && <CheckCircle2 className="w-3 h-3" />}
              {item.status === 'Low Stock' && <AlertCircle className="w-3 h-3" />}
              {item.status === 'Out of Stock' && <XCircle className="w-3 h-3" />}
              {item.status}
            </span>
          </td>
          {isEditing ? (
            <>
              <td className="px-4 py-1"><input data-testid={`edit-part-number-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary" value={editValues.partNumber} onChange={e => setEditValues(v => ({ ...v, partNumber: e.target.value }))} onKeyDown={handleEditKeyDown} autoFocus /></td>
              <td className="px-4 py-1"><input data-testid={`edit-manufacturer-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs focus:outline-none focus:border-primary" value={editValues.manufacturer} onChange={e => setEditValues(v => ({ ...v, manufacturer: e.target.value }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-1"><input data-testid={`edit-description-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs focus:outline-none focus:border-primary" value={editValues.description} onChange={e => setEditValues(v => ({ ...v, description: e.target.value }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-1">
                <select data-testid={`edit-supplier-${item.id}`} className="w-full bg-primary/5 border border-primary/30 px-2 py-1 text-xs focus:outline-none focus:border-primary" value={editValues.supplier} onChange={e => setEditValues(v => ({ ...v, supplier: e.target.value }))} onKeyDown={handleEditKeyDown}>
                  <option value="Digi-Key">Digi-Key</option><option value="Mouser">Mouser</option><option value="LCSC">LCSC</option>
                </select>
              </td>
              <td className="px-4 py-3 text-right font-mono text-xs">{item.stock.toLocaleString()}</td>
              <td className="px-4 py-1"><input data-testid={`edit-quantity-${item.id}`} type="number" min={1} max={999999} className="w-16 bg-primary/5 border border-primary/30 px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-primary" value={editValues.quantity} onChange={e => setEditValues(v => ({ ...v, quantity: parseInt(e.target.value) || 1 }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-1"><input data-testid={`edit-unit-price-${item.id}`} type="number" min={0} max={99999.99} step={0.01} className="w-24 bg-primary/5 border border-primary/30 px-2 py-1 text-xs font-mono text-right focus:outline-none focus:border-primary" value={editValues.unitPrice} onChange={e => setEditValues(v => ({ ...v, unitPrice: parseFloat(e.target.value) || 0 }))} onKeyDown={handleEditKeyDown} /></td>
              <td className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground">${(editValues.quantity * editValues.unitPrice).toFixed(2)}</td>
              <td className="px-4 py-3 text-right flex gap-1">
                <StyledTooltip content="Save changes" side="left"><button aria-label="Save changes" className="p-1.5 text-emerald-500 hover:bg-emerald-500/10 transition-colors" onClick={saveEdit} data-testid={`button-save-${item.id}`}><Check className="w-4 h-4" /></button></StyledTooltip>
                <StyledTooltip content="Cancel editing" side="left"><button aria-label="Cancel editing" className="p-1.5 text-muted-foreground hover:bg-muted/30 transition-colors" onClick={cancelEdit} data-testid={`button-cancel-edit-${item.id}`}><X className="w-4 h-4" /></button></StyledTooltip>
              </td>
            </>
          ) : (
            <>
              <td className="px-4 py-3 font-mono font-medium text-foreground text-xs" data-testid={`text-part-number-${item.id}`}>
                <span className="inline-flex items-center gap-1.5">
                  {item._isEsd && (
                    <StyledTooltip content="ESD Sensitive — Handle with anti-static precautions. Use ESD wrist strap and grounded work surface." side="right">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" data-testid={`esd-badge-${item.id}`} />
                    </StyledTooltip>
                  )}
                  {item.partNumber}
                </span>
              </td>
              <td className="px-4 py-3 text-muted-foreground" data-testid={`text-manufacturer-${item.id}`}>{item.manufacturer}</td>
              <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" data-testid={`text-description-${item.id}`}>{item.description}</td>
              <td className="px-4 py-3 text-muted-foreground" data-testid={`text-supplier-${item.id}`}>{item.supplier}</td>
              <td className="px-4 py-3 text-right font-mono text-xs" data-testid={`text-stock-${item.id}`}>{item.stock.toLocaleString()}</td>
              <td className="px-4 py-3 text-right font-mono text-xs" data-testid={`text-quantity-${item.id}`}>{item.quantity}</td>
              <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground" data-testid={`text-unit-price-${item.id}`}>${Number(item.unitPrice).toFixed(2)}</td>
              <td className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground" data-testid={`text-total-price-${item.id}`}>${Number(item.totalPrice).toFixed(2)}</td>
              <td className="px-4 py-3 text-right flex gap-1">
                <StyledTooltip content="Edit item" side="left"><button aria-label="Edit item" className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/30 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => startEdit(item)} data-testid={`button-edit-${item.id}`}><Pencil className="w-4 h-4" /></button></StyledTooltip>
                <StyledTooltip content="Assess damage" side="left"><button aria-label="Assess damage" className="p-1.5 text-amber-500 hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => onAssessDamage(item)} data-testid={`button-damage-${item.id}`}><Shield className="w-4 h-4" /></button></StyledTooltip>
                <StyledTooltip content="Buy from supplier" side="left">
                  <button aria-label="Add to cart" className="p-1.5 text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { const baseUrl = getSupplierSearchUrl(item.supplier); if (!baseUrl) { return; } window.open(baseUrl + encodeURIComponent(item.partNumber), '_blank', 'noopener,noreferrer'); }} data-testid={`button-cart-${item.id}`}><ShoppingCart className="w-4 h-4" /></button>
                </StyledTooltip>
                <ConfirmDialog
                  trigger={<StyledTooltip content="Remove from BOM" side="left"><button aria-label="Delete item" className="p-1.5 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity" data-testid={`button-delete-${item.id}`}><Trash2 className="w-4 h-4" /></button></StyledTooltip>}
                  title="Remove BOM Item"
                  description={`Are you sure you want to remove "${item.partNumber}" from the Bill of Materials? This action cannot be undone.`}
                  confirmLabel="Remove"
                  variant="destructive"
                  onConfirm={() => deleteBomItem(item.id)}
                />
              </td>
            </>
          )}
        </tr>
      </ContextMenuTrigger>
      <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
        <ContextMenuItem onSelect={() => { copyToClipboard(JSON.stringify(item, null, 2)); addOutputLog('[BOM] Copied details: ' + item.partNumber); }}>Copy Details</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(item.partNumber + ' ' + item.manufacturer + ' datasheet'), '_blank', 'noopener,noreferrer')}>Search Datasheet</ContextMenuItem>
        <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(item.partNumber + ' alternative equivalent'), '_blank', 'noopener,noreferrer')}>Find Alternatives</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onSelect={() => { const baseUrl = getSupplierSearchUrl(item.supplier); if (!baseUrl) { return; } window.open(baseUrl + encodeURIComponent(item.partNumber), '_blank', 'noopener,noreferrer'); }}>Buy from {item.supplier}</ContextMenuItem>
        <ContextMenuItem onSelect={() => copyToClipboard(item.partNumber)}>Copy Part Number</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem className="text-destructive" onSelect={(e) => { e.preventDefault(); if (window.confirm(`Remove "${item.partNumber}" from the BOM?`)) { deleteBomItem(item.id); } }}>Remove from BOM</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
