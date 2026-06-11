import { Button } from '@/components/ui/button';
import { useJitRunHistory } from '@/lib/use-jit-run-history';

export default function JitRunHistoryPanel() {
  const { items, loading, refresh } = useJitRunHistory(3);

  return (
    <div className="border-b border-border/60 bg-card/40 px-2.5 py-1.5" data-testid="jit-history-panel">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-muted-foreground">Recent JIT Runs</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-5 px-1.5 text-[10px]"
          data-testid="jit-history-refresh"
          onClick={() => void refresh()}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>
      <div className="mt-0.5 space-y-0.5 text-[11px] text-muted-foreground" data-testid="jit-history-list">
        {items.length === 0 ? (
          <p>No JIT runs yet.</p>
        ) : (
          items.map((item) => (
            <p key={item.runId}>
              {item.command} — {item.status}
            </p>
          ))
        )}
      </div>
    </div>
  );
}
