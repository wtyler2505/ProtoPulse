import { useState, useMemo, useCallback } from 'react';
import {
  Clock,
  DollarSign,
  ExternalLink,
  Package,
  Plus,
  Trash2,
  Truck,
  ChevronDown,
  ChevronRight,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjectId } from '@/lib/contexts/project-id-context';
import {
  useOrderHistory,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  CATEGORY_LABELS,
} from '@/lib/order-history';
import type {
  OrderCategory,
  OrderHistoryStatus,
  OrderRecord,
} from '@/lib/order-history';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: OrderHistoryStatus }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] font-mono', ORDER_STATUS_COLORS[status])}
      data-testid={`status-badge-${status}`}
    >
      {ORDER_STATUS_LABELS[status]}
    </Badge>
  );
}

function TimelineView({ order }: { order: OrderRecord }) {
  const [expanded, setExpanded] = useState(false);

  if (order.timeline.length <= 1) {
    return null;
  }

  return (
    <div className="mt-2" data-testid={`timeline-${order.id}`}>
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        data-testid={`timeline-toggle-${order.id}`}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        Timeline ({order.timeline.length} events)
      </button>
      {expanded && (
        <div className="ml-2 mt-1 border-l border-border pl-3 space-y-1.5">
          {order.timeline.map((entry, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]" data-testid={`timeline-entry-${i}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
              <div>
                <span className="text-foreground font-medium">{ORDER_STATUS_LABELS[entry.status]}</span>
                <span className="text-muted-foreground ml-1.5">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
                {entry.note && (
                  <span className="text-muted-foreground ml-1.5">— {entry.note}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NEXT_STATUS: Partial<Record<OrderHistoryStatus, OrderHistoryStatus>> = {
  quoted: 'ordered',
  ordered: 'in_production',
  in_production: 'shipped',
  shipped: 'delivered',
};

const NEXT_STATUS_LABELS: Partial<Record<OrderHistoryStatus, string>> = {
  quoted: 'Mark Ordered',
  ordered: 'Mark In Production',
  in_production: 'Mark Shipped',
  shipped: 'Mark Delivered',
};

function OrderCard({
  order,
  onAdvance,
  onCancel,
  onDelete,
}: {
  order: OrderRecord;
  onAdvance: (id: string) => void;
  onCancel: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div
      className="border border-border bg-card/80 backdrop-blur p-3 space-y-2"
      data-testid={`order-card-${order.id}`}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate" data-testid="order-description">
              {order.description}
            </span>
            <StatusBadge status={order.status} />
            <Badge variant="outline" className="text-[10px] text-muted-foreground" data-testid="order-category">
              {CATEGORY_LABELS[order.category]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span data-testid="order-supplier">{order.supplier}</span>
            <span>Qty: {order.quantity}</span>
            <span className="font-mono" data-testid="order-total">
              {order.currency} {order.totalCost.toFixed(2)}
            </span>
            {order.quoteReference && (
              <span>Ref: {order.quoteReference}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener,noreferrer"
              className="p-1 text-muted-foreground hover:text-primary"
              data-testid="order-tracking-link"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => { onDelete(order.id); }}
            className="p-1 text-muted-foreground hover:text-destructive"
            data-testid={`delete-order-${order.id}`}
            aria-label="Delete order"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Tracking info */}
      {order.trackingNumber && (
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground" data-testid="order-tracking-number">
          <Truck className="w-3 h-3" />
          Tracking: {order.trackingNumber}
        </div>
      )}

      {/* Actions */}
      {(nextStatus || order.status !== 'delivered' && order.status !== 'cancelled') && (
        <div className="flex items-center gap-2 pt-1">
          {nextStatus && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 text-[10px] px-2"
              onClick={() => { onAdvance(order.id); }}
              data-testid={`advance-order-${order.id}`}
            >
              {NEXT_STATUS_LABELS[order.status]}
            </Button>
          )}
          {order.status !== 'cancelled' && order.status !== 'delivered' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] px-2 text-destructive hover:text-destructive"
              onClick={() => { onCancel(order.id); }}
              data-testid={`cancel-order-${order.id}`}
            >
              Cancel
            </Button>
          )}
        </div>
      )}

      <TimelineView order={order} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Order Dialog (inline)
// ---------------------------------------------------------------------------

interface NewOrderValues {
  category: OrderCategory;
  supplier: string;
  description: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  quoteReference: string;
}

const DEFAULT_NEW_ORDER: NewOrderValues = {
  category: 'components',
  supplier: '',
  description: '',
  quantity: 1,
  unitCost: 0,
  totalCost: 0,
  quoteReference: '',
};

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function OrderHistoryPanel() {
  const projectId = useProjectId();
  const {
    orders,
    activeOrders,
    totalSpent,
    costByCategory,
    createOrder,
    updateStatus,
    deleteOrder,
  } = useOrderHistory(projectId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newOrder, setNewOrder] = useState<NewOrderValues>({ ...DEFAULT_NEW_ORDER });
  const [filterCategory, setFilterCategory] = useState<OrderCategory | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<OrderHistoryStatus | 'all'>('all');

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (filterCategory !== 'all') {
      result = result.filter((o) => o.category === filterCategory);
    }
    if (filterStatus !== 'all') {
      result = result.filter((o) => o.status === filterStatus);
    }
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  }, [orders, filterCategory, filterStatus]);

  const handleAdd = useCallback(() => {
    if (!newOrder.description.trim() || !newOrder.supplier.trim()) {
      return;
    }
    createOrder({
      category: newOrder.category,
      supplier: newOrder.supplier.trim(),
      description: newOrder.description.trim(),
      quantity: Math.max(1, newOrder.quantity),
      unitCost: Math.max(0, newOrder.unitCost),
      totalCost: Math.max(0, newOrder.totalCost),
      quoteReference: newOrder.quoteReference.trim() || undefined,
    });
    setNewOrder({ ...DEFAULT_NEW_ORDER });
    setShowAddForm(false);
  }, [newOrder, createOrder]);

  const handleAdvance = useCallback(
    (orderId: string) => {
      const order = orders.find((o) => o.id === orderId);
      if (!order) { return; }
      const next = NEXT_STATUS[order.status];
      if (next) {
        updateStatus(orderId, next);
      }
    },
    [orders, updateStatus],
  );

  const handleCancel = useCallback(
    (orderId: string) => {
      updateStatus(orderId, 'cancelled');
    },
    [updateStatus],
  );

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" data-testid="order-history-panel">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-total-orders">
          <div className="flex items-center gap-1.5 mb-1">
            <Package className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Orders</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{orders.length}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-active-orders">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Active</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{activeOrders.length}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-total-spent">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Spent</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">${totalSpent.toFixed(2)}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-cost-breakdown">
          <div className="flex items-center gap-1.5 mb-1">
            <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">By Category</span>
          </div>
          <div className="text-[10px] font-mono text-muted-foreground space-y-0.5">
            <div>PCB: ${costByCategory.pcb.toFixed(2)}</div>
            <div>Parts: ${costByCategory.components.toFixed(2)}</div>
            <div>Assy: ${costByCategory.assembly.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          onClick={() => { setShowAddForm(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="btn-add-order"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Order
        </Button>

        <select
          value={filterCategory}
          onChange={(e) => { setFilterCategory(e.target.value as OrderCategory | 'all'); }}
          className="border border-border bg-card/80 px-2 py-1 text-xs text-foreground"
          data-testid="filter-category"
          aria-label="Filter by category"
        >
          <option value="all">All Categories</option>
          <option value="pcb">PCB Fabrication</option>
          <option value="components">Components</option>
          <option value="assembly">Assembly</option>
        </select>

        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value as OrderHistoryStatus | 'all'); }}
          className="border border-border bg-card/80 px-2 py-1 text-xs text-foreground"
          data-testid="filter-status"
          aria-label="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="quoted">Quoted</option>
          <option value="ordered">Ordered</option>
          <option value="in_production">In Production</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <span className="text-[10px] text-muted-foreground ml-auto">
          {filteredOrders.length} of {orders.length} orders
        </span>
      </div>

      {/* Add order form */}
      {showAddForm && (
        <div className="border border-primary/30 bg-card/90 backdrop-blur p-4 space-y-3" data-testid="add-order-form">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">New Order</h4>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); }}
              className="p-1 text-muted-foreground hover:text-foreground"
              data-testid="close-add-form"
              aria-label="Close add form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="order-description">
                Description
              </label>
              <input
                id="order-description"
                type="text"
                value={newOrder.description}
                onChange={(e) => { setNewOrder((v) => ({ ...v, description: e.target.value })); }}
                placeholder="100x 10uF ceramic caps"
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-description"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="order-supplier">
                Supplier
              </label>
              <input
                id="order-supplier"
                type="text"
                value={newOrder.supplier}
                onChange={(e) => { setNewOrder((v) => ({ ...v, supplier: e.target.value })); }}
                placeholder="Digi-Key"
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-supplier"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="order-category">
                Category
              </label>
              <select
                id="order-category"
                value={newOrder.category}
                onChange={(e) => { setNewOrder((v) => ({ ...v, category: e.target.value as OrderCategory })); }}
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-category"
              >
                <option value="pcb">PCB Fabrication</option>
                <option value="components">Components</option>
                <option value="assembly">Assembly</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="order-quantity">
                Quantity
              </label>
              <input
                id="order-quantity"
                type="number"
                min={1}
                value={newOrder.quantity}
                onChange={(e) => { setNewOrder((v) => ({ ...v, quantity: Math.max(1, Number(e.target.value)) })); }}
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-quantity"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="order-unit-cost">
                Unit Cost ($)
              </label>
              <input
                id="order-unit-cost"
                type="number"
                min={0}
                step={0.01}
                value={newOrder.unitCost}
                onChange={(e) => { setNewOrder((v) => ({ ...v, unitCost: Math.max(0, Number(e.target.value)) })); }}
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-unit-cost"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="order-total-cost">
                Total Cost ($)
              </label>
              <input
                id="order-total-cost"
                type="number"
                min={0}
                step={0.01}
                value={newOrder.totalCost}
                onChange={(e) => { setNewOrder((v) => ({ ...v, totalCost: Math.max(0, Number(e.target.value)) })); }}
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-total-cost"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="order-quote-ref">
                Quote Reference (optional)
              </label>
              <input
                id="order-quote-ref"
                type="text"
                value={newOrder.quoteReference}
                onChange={(e) => { setNewOrder((v) => ({ ...v, quoteReference: e.target.value })); }}
                placeholder="QR-2026-001"
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-quote-ref"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowAddForm(false); setNewOrder({ ...DEFAULT_NEW_ORDER }); }}
              data-testid="btn-cancel-add"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newOrder.description.trim() || !newOrder.supplier.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="btn-confirm-add"
            >
              Add Order
            </Button>
          </div>
        </div>
      )}

      {/* Order list */}
      <div className="space-y-2" data-testid="order-list">
        {filteredOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onAdvance={handleAdvance}
            onCancel={handleCancel}
            onDelete={deleteOrder}
          />
        ))}
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground" data-testid="empty-order-history">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No orders yet</p>
          <p className="text-xs mt-1">
            Track your PCB fabrication, component, and assembly orders here.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => { setShowAddForm(true); }}
            data-testid="btn-add-first-order"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Add Your First Order
          </Button>
        </div>
      )}

      {filteredOrders.length === 0 && orders.length > 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm" data-testid="no-matching-orders">
          No orders match the current filters.
        </div>
      )}
    </div>
  );
}
