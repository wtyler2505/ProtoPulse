import { useState } from 'react';
import { useProject } from '@/lib/project-context';
import { Download, Filter, Search, ShoppingCart, SlidersHorizontal, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function ProcurementView() {
  const { bom, bomSettings, setBomSettings } = useProject();
  const [showSettings, setShowSettings] = useState(false);

  const totalCost = bom.reduce((acc, item) => acc + item.totalPrice, 0);

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Toolbar */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/30 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input 
              type="text" 
              placeholder="Search components..." 
              className="pl-9 pr-4 py-2 bg-muted/30 border border-border rounded text-sm focus:outline-none focus:border-primary w-64 transition-all"
            />
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className={showSettings ? "bg-primary/10 border-primary text-primary" : ""}
            onClick={() => setShowSettings(!showSettings)}
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Cost Optimisation
          </Button>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Estimated BOM Cost</div>
            <div className="text-xl font-mono font-bold text-primary flex items-baseline justify-end gap-1">
              ${totalCost.toFixed(2)}
              <span className="text-xs text-muted-foreground font-sans font-normal">/ unit @ 1k qty</span>
            </div>
          </div>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Advanced Settings Panel */}
      {showSettings && (
        <div className="bg-muted/20 border-b border-border p-6 grid grid-cols-1 md:grid-cols-4 gap-8 animate-in slide-in-from-top-2">
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-foreground">Production Batch Size</h4>
            <div className="flex items-center gap-4">
              <Slider 
                value={[bomSettings.batchSize]} 
                max={10000} 
                step={100} 
                className="flex-1"
                onValueChange={([v]) => setBomSettings({...bomSettings, batchSize: v})}
              />
              <span className="font-mono text-sm w-16 text-right">{bomSettings.batchSize}</span>
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
              />
              <span className="font-mono text-sm w-16 text-right">${bomSettings.maxCost}</span>
            </div>
          </div>

          <div className="space-y-4">
             <h4 className="text-sm font-medium text-foreground">Sourcing Constraints</h4>
             <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">In Stock Only</span>
                <Switch checked={bomSettings.inStockOnly} onCheckedChange={(v) => setBomSettings({...bomSettings, inStockOnly: v})} />
             </div>
             <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Preferred Suppliers</span>
                <span className="text-xs text-primary cursor-pointer hover:underline">Edit List</span>
             </div>
          </div>

           <div className="space-y-4">
             <h4 className="text-sm font-medium text-foreground">Optimization Goal</h4>
             <div className="flex gap-2">
                {['Cost', 'Power', 'Size', 'Avail'].map(goal => (
                  <button key={goal} className="px-3 py-1 rounded border border-border text-xs hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors first:bg-primary/10 first:border-primary first:text-primary">
                    {goal}
                  </button>
                ))}
             </div>
          </div>
        </div>
      )}

      {/* Main Table */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border border-border overflow-hidden bg-card shadow-sm">
          <table className="w-full text-sm text-left">
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
              {bom.map((item) => (
                <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border uppercase tracking-wide",
                      item.status === 'In Stock' 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : item.status === 'Low Stock'
                        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        : 'bg-destructive/10 text-destructive border-destructive/20'
                    )}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground text-xs">{item.partNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.manufacturer}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{item.description}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.supplier}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{item.stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">${item.unitPrice.toFixed(4)}</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-bold text-foreground">${item.totalPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1.5 text-primary hover:bg-primary/10 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                      <ShoppingCart className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
