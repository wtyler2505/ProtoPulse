import { useState } from 'react';
import { useProject } from '@/lib/project-context';
import { Download, Filter, Search, ShoppingCart, SlidersHorizontal, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';

const supplierUrls: Record<string, string> = {
  'Mouser': 'https://www.mouser.com/Search/Refine?Keyword=',
  'Digi-Key': 'https://www.digikey.com/en/products/result?keywords=',
  'LCSC': 'https://www.lcsc.com/search?q=',
};

const goalDescriptions: Record<string, string> = {
  'Cost': 'Minimize total cost',
  'Power': 'Minimize power consumption',
  'Size': 'Minimize board footprint',
  'Avail': 'Maximize component availability',
};

export default function ProcurementView() {
  const { bom, bomSettings, setBomSettings, addBomItem, deleteBomItem, addOutputLog } = useProject();
  const [showSettings, setShowSettings] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [optimizationGoal, setOptimizationGoal] = useState('Cost');
  const [showSupplierEdit, setShowSupplierEdit] = useState(false);
  const [preferredSuppliers, setPreferredSuppliers] = useState<Record<string, boolean>>({
    'Mouser': true,
    'Digi-Key': true,
    'LCSC': false,
  });

  const filteredBom = bom.filter(item => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      item.partNumber.toLowerCase().includes(term) ||
      item.manufacturer.toLowerCase().includes(term) ||
      item.description.toLowerCase().includes(term) ||
      item.supplier.toLowerCase().includes(term)
    );
  });

  const totalCost = filteredBom.reduce((acc, item) => acc + item.totalPrice, 0);

  const handleExportCSV = () => {
    const headers = ['Part Number', 'Manufacturer', 'Description', 'Quantity', 'Unit Price', 'Total Price', 'Supplier', 'Stock', 'Status'];
    const rows = filteredBom.map(item => [
      item.partNumber, item.manufacturer, item.description, item.quantity,
      item.unitPrice.toFixed(4), item.totalPrice.toFixed(2), item.supplier,
      item.stock, item.status
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bom_export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAddItem = () => {
    addBomItem({
      partNumber: 'NEW-PART',
      manufacturer: 'Unknown',
      description: 'New component',
      quantity: 1,
      unitPrice: 0,
      totalPrice: 0,
      supplier: 'Digi-Key',
      stock: 0,
      status: 'Out of Stock',
    });
  };

  return (
    <div className="h-full flex flex-col bg-background/50" data-testid="procurement-view">
      <div className="p-4 border-b border-border flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/30 backdrop-blur">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search components..." 
              aria-label="Search components"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              data-testid="input-search-bom"
              className="pl-9 pr-4 py-2 bg-muted/30 border border-border text-sm focus:outline-none focus:border-primary w-full sm:w-64 transition-all"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className={showSettings ? "bg-primary/10 border-primary text-primary" : ""}
                onClick={() => setShowSettings(!showSettings)}
                data-testid="button-toggle-settings"
              >
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                Cost Optimisation
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Configure BOM optimization settings</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddItem}
                data-testid="button-add-bom-item"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Add new BOM component</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <div className="flex items-center gap-4 md:gap-6">
          <div className="text-right flex-1 md:flex-none">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimated BOM Cost</div>
            <div className="text-xl font-mono font-bold text-primary flex items-baseline justify-end gap-1" data-testid="text-total-cost">
              ${totalCost.toFixed(2)}
              <span className="text-xs text-muted-foreground font-sans font-normal">/ unit @ 1k qty</span>
            </div>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={handleExportCSV} data-testid="button-export-csv">
                <Download className="w-4 h-4 mr-2" /> Export CSV
              </Button>
            </TooltipTrigger>
            <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
              <p>Download BOM as CSV file</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {showSettings && (
        <div className="bg-muted/10 backdrop-blur-lg border-b border-border p-6 grid grid-cols-1 md:grid-cols-4 gap-8 animate-in slide-in-from-top-2" data-testid="panel-settings">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Production Batch Size</h4>
            <div className="flex items-center gap-4">
              <Slider 
                value={[bomSettings.batchSize]} 
                max={10000} 
                step={100} 
                className="flex-1"
                onValueChange={([v]) => setBomSettings({...bomSettings, batchSize: v})}
                data-testid="slider-batch-size"
              />
              <span className="font-mono text-sm w-16 text-right" data-testid="text-batch-size">{bomSettings.batchSize}</span>
            </div>
          </div>
          
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Max BOM Cost Target</h4>
             <div className="flex items-center gap-4">
              <Slider 
                value={[bomSettings.maxCost]} 
                max={100} 
                step={1} 
                className="flex-1"
                 onValueChange={([v]) => setBomSettings({...bomSettings, maxCost: v})}
                data-testid="slider-max-cost"
              />
              <span className="font-mono text-sm w-16 text-right" data-testid="text-max-cost">${bomSettings.maxCost}</span>
            </div>
          </div>

          <div className="space-y-4">
             <h4 className="text-sm font-medium text-foreground">Sourcing Constraints</h4>
             <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Stock Only</span>
                <Switch checked={bomSettings.inStockOnly} onCheckedChange={(v) => setBomSettings({...bomSettings, inStockOnly: v})} data-testid="switch-in-stock-only" />
             </div>
             <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Preferred Suppliers</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      className="text-xs text-primary cursor-pointer hover:underline"
                      data-testid="link-edit-suppliers"
                      onClick={() => setShowSupplierEdit(!showSupplierEdit)}
                    >Edit List</span>
                  </TooltipTrigger>
                  <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="top">
                    <p>Edit preferred supplier list</p>
                  </TooltipContent>
                </Tooltip>
             </div>
             {showSupplierEdit && (
               <div className="mt-2 space-y-1.5 pl-1 animate-in slide-in-from-top-1" data-testid="panel-supplier-edit">
                 {Object.entries(preferredSuppliers).map(([supplier, checked]) => (
                   <label key={supplier} className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                     <input
                       type="checkbox"
                       checked={checked}
                       onChange={(e) => setPreferredSuppliers(prev => ({ ...prev, [supplier]: e.target.checked }))}
                       className="accent-primary w-3.5 h-3.5"
                       data-testid={`checkbox-supplier-${supplier.toLowerCase().replace(/[^a-z]/g, '-')}`}
                     />
                     {supplier}
                   </label>
                 ))}
               </div>
             )}
          </div>

           <div className="space-y-4">
             <h4 className="text-sm font-medium text-foreground">Optimization Goal</h4>
             <div className="flex gap-2">
                {['Cost', 'Power', 'Size', 'Avail'].map(goal => (
                  <Tooltip key={goal}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setOptimizationGoal(goal)}
                        data-testid={`button-goal-${goal.toLowerCase()}`}
                        className={cn(
                          "px-3 py-1 border border-border text-xs hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors",
                          optimizationGoal === goal && "bg-primary/10 border-primary text-primary"
                        )}
                      >
                        {goal}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="bottom">
                      <p>{goalDescriptions[goal]}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
             </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto p-3 md:p-6">
        <div className="border border-border overflow-hidden bg-card/80 backdrop-blur shadow-sm overflow-x-auto">
          <table className="w-full text-sm text-left min-w-[800px]" data-testid="table-bom">
            <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-[10px] tracking-wider">
              <tr>
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
            <tbody className="divide-y divide-border">
              {filteredBom.map((item) => (
                <ContextMenu key={item.id}>
                  <ContextMenuTrigger asChild>
                    <tr className="hover:bg-muted/30 transition-colors group" data-testid={`row-bom-${item.id}`}>
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 text-[10px] font-medium border uppercase tracking-wide",
                          item.status === 'In Stock' 
                            ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                            : item.status === 'Low Stock'
                            ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        )} data-testid={`status-bom-${item.id}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono font-medium text-foreground text-xs" data-testid={`text-part-number-${item.id}`}>{item.partNumber}</td>
                      <td className="px-4 py-3 text-muted-foreground" data-testid={`text-manufacturer-${item.id}`}>{item.manufacturer}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs truncate" data-testid={`text-description-${item.id}`}>{item.description}</td>
                      <td className="px-4 py-3 text-muted-foreground" data-testid={`text-supplier-${item.id}`}>{item.supplier}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs" data-testid={`text-stock-${item.id}`}>{item.stock.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs" data-testid={`text-quantity-${item.id}`}>{item.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground" data-testid={`text-unit-price-${item.id}`}>${item.unitPrice.toFixed(4)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground" data-testid={`text-total-price-${item.id}`}>${item.totalPrice.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right flex gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="p-1.5 text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                // Encode part number to avoid malformed URLs and open in a safe context【697222849486831†L63-L75】.
                                const url = (supplierUrls[item.supplier] || '') + encodeURIComponent(item.partNumber);
                                window.open(url, '_blank', 'noopener,noreferrer');
                              }}
                              data-testid={`button-cart-${item.id}`}
                            >
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="left">
                            <p>Buy from supplier</p>
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              className="p-1.5 text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deleteBomItem(Number(item.id))}
                              data-testid={`button-delete-${item.id}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-card/90 backdrop-blur border-border text-xs" side="left">
                            <p>Remove from BOM</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                    <ContextMenuItem onSelect={() => { navigator.clipboard.writeText(JSON.stringify(item, null, 2)); addOutputLog('[BOM] Copied details: ' + item.partNumber); }}>Copy Details</ContextMenuItem>
                    <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(item.partNumber + ' ' + item.manufacturer + ' datasheet'), '_blank')}>View Datasheet</ContextMenuItem>
                    <ContextMenuItem onSelect={() => window.open('https://www.google.com/search?q=' + encodeURIComponent(item.partNumber + ' alternative equivalent'), '_blank')}>Find Alternatives</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem
                      onSelect={() => {
                        const url = (supplierUrls[item.supplier] || '') + encodeURIComponent(item.partNumber);
                        window.open(url, '_blank', 'noopener,noreferrer');
                      }}
                    >
                      Buy from {item.supplier}
                    </ContextMenuItem>
                    <ContextMenuItem onSelect={() => navigator.clipboard.writeText(item.partNumber)}>Copy Part Number</ContextMenuItem>
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive" onSelect={() => deleteBomItem(Number(item.id))}>Remove from BOM</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
