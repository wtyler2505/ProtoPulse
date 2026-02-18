import { useComponentEditor } from '@/lib/component-editor/ComponentEditorProvider';
import { useMemo } from 'react';

function formatRelativeTime(timestamp: number): string {
  const diff = Math.floor((Date.now() - timestamp) / 1000);
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function HistoryPanel() {
  const { state, dispatch } = useComponentEditor();
  const { past, future } = state;

  const totalCount = past.length + future.length;

  const entries = useMemo(() => {
    const items: Array<{
      type: 'past' | 'current' | 'future';
      label: string;
      timestamp: number;
      index: number;
    }> = [];

    past.forEach((entry, i) => {
      items.push({ type: 'past', label: entry.label, timestamp: entry.timestamp, index: i });
    });

    const currentLabel = past.length > 0 ? past[past.length - 1].label : 'Current State';
    items.push({
      type: 'current',
      label: currentLabel,
      timestamp: Date.now(),
      index: past.length,
    });

    future.forEach((entry, i) => {
      items.push({ type: 'future', label: entry.label, timestamp: entry.timestamp, index: past.length + 1 + i });
    });

    return items;
  }, [past, future]);

  const handleClick = (index: number) => {
    if (index === past.length) return;
    dispatch({ type: 'JUMP_TO_HISTORY', payload: { index } });
  };

  return (
    <div
      className="w-56 border-l border-border bg-card flex flex-col"
      data-testid="history-panel"
    >
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">History</span>
        {totalCount > 0 && (
          <span
            className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground"
            data-testid="text-history-count"
          >
            {totalCount}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto" data-testid="history-list">
        {totalCount === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground" data-testid="text-no-history">
            No history
          </div>
        ) : (
          <div className="py-1">
            {entries.map((entry, i) => (
              <button
                key={`${entry.type}-${i}`}
                data-testid={`history-entry-${entry.type}-${i}`}
                onClick={() => handleClick(entry.index)}
                className={`w-full text-left px-3 flex items-center gap-2 transition-colors ${
                  entry.type === 'current'
                    ? 'bg-[#00F0FF]/10 border-l-2 border-[#00F0FF]'
                    : entry.type === 'future'
                      ? 'opacity-40 border-l-2 border-dotted border-muted-foreground/30 hover:opacity-60 cursor-pointer'
                      : 'opacity-60 hover:opacity-90 hover:bg-muted/50 cursor-pointer'
                }`}
                style={{ height: '28px' }}
                disabled={entry.type === 'current'}
              >
                <div className="flex-1 min-w-0 flex items-center gap-1.5">
                  <span
                    className={`text-[11px] truncate ${
                      entry.type === 'current' ? 'text-[#00F0FF] font-medium' : 'text-foreground/80'
                    }`}
                  >
                    {entry.label}
                  </span>
                  {entry.type === 'current' && (
                    <span
                      className="text-[9px] px-1 py-px rounded bg-[#00F0FF]/20 text-[#00F0FF] font-medium shrink-0"
                      data-testid="badge-current"
                    >
                      Current
                    </span>
                  )}
                </div>
                {entry.type !== 'current' && (
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
