import { useState, useMemo, useCallback } from 'react';
import {
  CircuitBoard,
  ExternalLink,
  Plus,
  Trash2,
  Clock,
  ChevronDown,
  ChevronRight,
  X,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjectId } from '@/lib/project-context';
import {
  usePcbOrderTracker,
  PCB_STATUS_PIPELINE,
  PCB_STATUS_LABELS,
  PCB_STATUS_COLORS,
} from '@/lib/pcb-order-tracker';
import type { PcbOrder, PcbOrderStatus, CreatePcbOrderInput } from '@/lib/pcb-order-tracker';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPipeline({ currentStatus }: { currentStatus: PcbOrderStatus }) {
  const currentIdx = PCB_STATUS_PIPELINE.indexOf(currentStatus);

  return (
    <div className="flex items-center gap-1" data-testid="status-pipeline">
      {PCB_STATUS_PIPELINE.map((status, idx) => {
        const isComplete = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        return (
          <div key={status} className="flex items-center gap-1">
            <div
              className={cn(
                'w-3 h-3 rounded-full border-2 flex items-center justify-center transition-colors',
                isComplete && 'bg-emerald-500 border-emerald-500',
                isCurrent && 'border-primary bg-primary/20',
                !isComplete && !isCurrent && 'border-muted-foreground/30 bg-transparent',
              )}
              title={PCB_STATUS_LABELS[status]}
              data-testid={`pipeline-dot-${status}`}
            >
              {isComplete && <Check className="w-2 h-2 text-white" />}
              {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
            </div>
            {idx < PCB_STATUS_PIPELINE.length - 1 && (
              <div
                className={cn(
                  'w-4 h-0.5',
                  idx < currentIdx ? 'bg-emerald-500' : 'bg-muted-foreground/20',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function DeliveryCountdown({ order, getDaysUntilDelivery }: { order: PcbOrder; getDaysUntilDelivery: (o: PcbOrder) => number | null }) {
  const days = getDaysUntilDelivery(order);
  if (days === null) {
    return null;
  }

  const isOverdue = days < 0;
  const isClose = days >= 0 && days <= 3;

  return (
    <div
      className={cn(
        'flex items-center gap-1 text-[10px] font-mono',
        isOverdue && 'text-red-400',
        isClose && !isOverdue && 'text-amber-400',
        !isOverdue && !isClose && 'text-muted-foreground',
      )}
      data-testid="delivery-countdown"
    >
      <Clock className="w-3 h-3" />
      {isOverdue
        ? `${Math.abs(days)}d overdue`
        : days === 0
          ? 'Due today'
          : `${days}d remaining`}
    </div>
  );
}

function StatusHistory({ order }: { order: PcbOrder }) {
  const [expanded, setExpanded] = useState(false);

  if (order.statusHistory.length <= 1) {
    return null;
  }

  return (
    <div className="mt-2" data-testid={`history-${order.id}`}>
      <button
        type="button"
        onClick={() => { setExpanded((v) => !v); }}
        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
        data-testid={`history-toggle-${order.id}`}
      >
        {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        History ({order.statusHistory.length} events)
      </button>
      {expanded && (
        <div className="ml-2 mt-1 border-l border-border pl-3 space-y-1.5">
          {order.statusHistory.map((entry, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px]" data-testid={`history-entry-${i}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1 shrink-0" />
              <div>
                <span className="text-foreground font-medium">{PCB_STATUS_LABELS[entry.status]}</span>
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

const NEXT_STATUS: Partial<Record<PcbOrderStatus, PcbOrderStatus>> = {
  gerbers_received: 'in_review',
  in_review: 'in_production',
  in_production: 'testing',
  testing: 'shipped',
  shipped: 'delivered',
};

const NEXT_STATUS_LABELS: Partial<Record<PcbOrderStatus, string>> = {
  gerbers_received: 'Mark In Review',
  in_review: 'Mark In Production',
  in_production: 'Mark Testing',
  testing: 'Mark Shipped',
  shipped: 'Mark Delivered',
};

function OrderCard({
  order,
  onAdvance,
  onDelete,
  getDaysUntilDelivery,
}: {
  order: PcbOrder;
  onAdvance: (id: string) => void;
  onDelete: (id: string) => void;
  getDaysUntilDelivery: (o: PcbOrder) => number | null;
}) {
  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div
      className="border border-border bg-card/80 backdrop-blur p-3 space-y-3"
      data-testid={`pcb-order-card-${order.id}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground truncate" data-testid="pcb-order-name">
              {order.boardName ?? order.orderId}
            </span>
            <Badge
              variant="outline"
              className={cn('text-[10px] font-mono', PCB_STATUS_COLORS[order.status])}
              data-testid={`pcb-status-badge-${order.status}`}
            >
              {PCB_STATUS_LABELS[order.status]}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
            <span data-testid="pcb-order-fab">{order.fabHouse}</span>
            <span data-testid="pcb-order-id">Order: {order.orderId}</span>
            {order.quantity != null && <span>Qty: {order.quantity}</span>}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {order.trackingUrl && (
            <a
              href={order.trackingUrl}
              target="_blank"
              rel="noopener,noreferrer"
              className="p-1 text-muted-foreground hover:text-primary"
              data-testid="pcb-tracking-link"
              aria-label="Open tracking URL"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
          <button
            type="button"
            onClick={() => { onDelete(order.id); }}
            className="p-1 text-muted-foreground hover:text-destructive"
            data-testid={`delete-pcb-order-${order.id}`}
            aria-label="Delete order"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Pipeline visualization */}
      <div className="flex items-center justify-between gap-3">
        <StatusPipeline currentStatus={order.status} />
        <DeliveryCountdown order={order} getDaysUntilDelivery={getDaysUntilDelivery} />
      </div>

      {/* Actions */}
      {nextStatus && (
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2"
            onClick={() => { onAdvance(order.id); }}
            data-testid={`advance-pcb-order-${order.id}`}
          >
            {NEXT_STATUS_LABELS[order.status]}
          </Button>
        </div>
      )}

      <StatusHistory order={order} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Add Order Form
// ---------------------------------------------------------------------------

interface NewPcbOrderValues {
  fabHouse: string;
  orderId: string;
  boardName: string;
  quantity: number;
  trackingUrl: string;
  estimatedDeliveryDays: number;
}

const DEFAULT_NEW_PCB_ORDER: NewPcbOrderValues = {
  fabHouse: 'JLCPCB',
  orderId: '',
  boardName: '',
  quantity: 5,
  trackingUrl: '',
  estimatedDeliveryDays: 7,
};

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------

export function PcbOrderTrackerPanel() {
  const projectId = useProjectId();
  const {
    orders,
    activeOrders,
    completedOrders,
    createOrder,
    updateStatus,
    deleteOrder,
    getDaysUntilDelivery,
  } = usePcbOrderTracker(projectId);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newOrder, setNewOrder] = useState<NewPcbOrderValues>({ ...DEFAULT_NEW_PCB_ORDER });

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => b.updatedAt - a.updatedAt),
    [orders],
  );

  const handleAdd = useCallback(() => {
    if (!newOrder.orderId.trim() || !newOrder.fabHouse.trim()) {
      return;
    }
    const input: CreatePcbOrderInput = {
      fabHouse: newOrder.fabHouse.trim(),
      orderId: newOrder.orderId.trim(),
      boardName: newOrder.boardName.trim() || undefined,
      quantity: Math.max(1, newOrder.quantity),
      trackingUrl: newOrder.trackingUrl.trim() || undefined,
      estimatedDelivery: newOrder.estimatedDeliveryDays > 0
        ? Date.now() + newOrder.estimatedDeliveryDays * 24 * 60 * 60 * 1000
        : undefined,
    };
    createOrder(input);
    setNewOrder({ ...DEFAULT_NEW_PCB_ORDER });
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

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4" data-testid="pcb-order-tracker-panel">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-total-pcb-orders">
          <div className="flex items-center gap-1.5 mb-1">
            <CircuitBoard className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Orders</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{orders.length}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-active-pcb-orders">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">In Progress</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{activeOrders.length}</div>
        </div>
        <div className="border border-border bg-card/80 backdrop-blur p-3" data-testid="stat-completed-pcb-orders">
          <div className="flex items-center gap-1.5 mb-1">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Delivered</span>
          </div>
          <div className="text-lg font-mono font-bold text-foreground">{completedOrders.length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() => { setShowAddForm(true); }}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          data-testid="btn-add-pcb-order"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Track PCB Order
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {sortedOrders.length} order{sortedOrders.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Add order form */}
      {showAddForm && (
        <div className="border border-primary/30 bg-card/90 backdrop-blur p-4 space-y-3" data-testid="add-pcb-order-form">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground">Track New PCB Order</h4>
            <button
              type="button"
              onClick={() => { setShowAddForm(false); }}
              className="p-1 text-muted-foreground hover:text-foreground"
              data-testid="close-pcb-add-form"
              aria-label="Close add form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="pcb-fab-house">
                Fab House
              </label>
              <select
                id="pcb-fab-house"
                value={newOrder.fabHouse}
                onChange={(e) => { setNewOrder((v) => ({ ...v, fabHouse: e.target.value })); }}
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-fab-house"
              >
                <option value="JLCPCB">JLCPCB</option>
                <option value="PCBWay">PCBWay</option>
                <option value="OSHPark">OSHPark</option>
                <option value="PCBgogo">PCBgogo</option>
                <option value="SeeedStudio">SeeedStudio</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="pcb-order-id">
                Order ID
              </label>
              <input
                id="pcb-order-id"
                type="text"
                value={newOrder.orderId}
                onChange={(e) => { setNewOrder((v) => ({ ...v, orderId: e.target.value })); }}
                placeholder="W202603150001"
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-pcb-order-id"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="pcb-board-name">
                Board Name (optional)
              </label>
              <input
                id="pcb-board-name"
                type="text"
                value={newOrder.boardName}
                onChange={(e) => { setNewOrder((v) => ({ ...v, boardName: e.target.value })); }}
                placeholder="Main Controller Rev B"
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-pcb-board-name"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="pcb-quantity">
                Quantity
              </label>
              <input
                id="pcb-quantity"
                type="number"
                min={1}
                value={newOrder.quantity}
                onChange={(e) => { setNewOrder((v) => ({ ...v, quantity: Math.max(1, Number(e.target.value)) })); }}
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-pcb-quantity"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="pcb-tracking-url">
                Tracking URL (optional)
              </label>
              <input
                id="pcb-tracking-url"
                type="text"
                value={newOrder.trackingUrl}
                onChange={(e) => { setNewOrder((v) => ({ ...v, trackingUrl: e.target.value })); }}
                placeholder="https://..."
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-pcb-tracking-url"
              />
            </div>
            <div>
              <label className="block text-[10px] text-muted-foreground uppercase tracking-wider mb-1" htmlFor="pcb-delivery-days">
                Est. Delivery (days)
              </label>
              <input
                id="pcb-delivery-days"
                type="number"
                min={0}
                value={newOrder.estimatedDeliveryDays}
                onChange={(e) => { setNewOrder((v) => ({ ...v, estimatedDeliveryDays: Math.max(0, Number(e.target.value)) })); }}
                className="w-full border border-border bg-card/80 px-2 py-1.5 text-sm text-foreground"
                data-testid="input-pcb-delivery-days"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setShowAddForm(false); setNewOrder({ ...DEFAULT_NEW_PCB_ORDER }); }}
              data-testid="btn-cancel-pcb-add"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!newOrder.orderId.trim() || !newOrder.fabHouse.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="btn-confirm-pcb-add"
            >
              Start Tracking
            </Button>
          </div>
        </div>
      )}

      {/* Order list */}
      <div className="space-y-2" data-testid="pcb-order-list">
        {sortedOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            onAdvance={handleAdvance}
            onDelete={deleteOrder}
            getDaysUntilDelivery={getDaysUntilDelivery}
          />
        ))}
      </div>

      {/* Empty state */}
      {orders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground" data-testid="empty-pcb-orders">
          <CircuitBoard className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm font-medium">No PCB orders being tracked</p>
          <p className="text-xs mt-1">
            Track your PCB fabrication orders through the manufacturing pipeline.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="mt-3"
            onClick={() => { setShowAddForm(true); }}
            data-testid="btn-add-first-pcb-order"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Track Your First Order
          </Button>
        </div>
      )}
    </div>
  );
}
