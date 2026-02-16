import { useProject } from '@/lib/project-context';
import { Download, Filter, Search, ShoppingCart } from 'lucide-react';

export default function ProcurementView() {
  const { bom } = useProject();

  const totalCost = bom.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);

  return (
    <div className="h-full flex flex-col bg-background/50">
      <div className="p-4 border-b border-border flex items-center justify-between bg-card/30 backdrop-blur">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search components..." 
              className="pl-9 pr-4 py-2 bg-muted/30 border border-border rounded text-sm focus:outline-none focus:border-primary w-64"
            />
          </div>
          <button className="p-2 text-muted-foreground hover:text-foreground border border-border rounded hover:bg-muted/50">
            <Filter className="w-4 h-4" />
          </button>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-muted-foreground">ESTIMATED TOTAL</div>
            <div className="text-lg font-mono font-bold text-primary">${totalCost.toFixed(2)}</div>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium rounded hover:bg-primary/90 transition-colors">
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground font-medium uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Part Number</th>
                <th className="px-4 py-3">Manufacturer</th>
                <th className="px-4 py-3">Description</th>
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
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${
                      item.status === 'In Stock' 
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' 
                        : item.status === 'Low Stock'
                        ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                        : 'bg-red-500/10 text-red-500 border-red-500/20'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono font-medium text-foreground">{item.partNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.manufacturer}</td>
                  <td className="px-4 py-3 text-muted-foreground max-w-xs truncate">{item.description}</td>
                  <td className="px-4 py-3 text-muted-foreground">{item.supplier}</td>
                  <td className="px-4 py-3 text-right font-mono">{item.stock.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-mono">{item.quantity}</td>
                  <td className="px-4 py-3 text-right font-mono">${item.unitPrice.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">${(item.unitPrice * item.quantity).toFixed(2)}</td>
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
