import { useState, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  PlusCircle,
  Link,
  Trash2,
  Edit3,
  ShieldCheck,
  Sparkles,
  Clock,
  RotateCcw,
  Copy,
  History,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { copyToClipboard } from '@/lib/clipboard';
import type { ProjectHistoryItem } from '@/lib/project-context';

interface HistoryListProps {
  history: ProjectHistoryItem[];
  timelineExpanded: boolean;
  setTimelineExpanded: (v: boolean) => void;
  addOutputLog: (msg: string) => void;
}

export default function HistoryList({
  history,
  timelineExpanded,
  setTimelineExpanded,
  addOutputLog,
}: HistoryListProps) {
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'User' | 'AI'>('all');
  const [expandedTimelineItem, setExpandedTimelineItem] = useState<string | null>(null);
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(timer);
  }, []);

  const formatRelativeTime = (isoStr: string): string => {
    const now = new Date();
    const date = new Date(isoStr);
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'just now';
    if (diffMin < 60) return `${diffMin} min ago`;
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatExactTime = (isoStr: string): string => {
    const date = new Date(isoStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' at ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const getActionIcon = (action: string) => {
    if (/Created|New/i.test(action)) return Plus;
    if (/Added|Add/i.test(action)) return PlusCircle;
    if (/Connected|Connect|Edge|Wire/i.test(action)) return Link;
    if (/Removed|Delete|Remove/i.test(action)) return Trash2;
    if (/Updated|Renamed|Changed/i.test(action)) return Edit3;
    if (/Validated|Validation|Check/i.test(action)) return ShieldCheck;
    if (/Generated|Generate/i.test(action)) return Sparkles;
    return Clock;
  };

  const getActionColor = (item: ProjectHistoryItem): string => {
    if (/Added|Created/i.test(item.action)) return '#22c55e';
    if (/Removed|Delete/i.test(item.action)) return '#ef4444';
    if (item.user === 'AI') return '#06b6d4';
    if (/Connected|Wire/i.test(item.action)) return '#3b82f6';
    if (/Updated|Changed/i.test(item.action)) return '#f59e0b';
    return '#71717a';
  };

  const getTimePeriod = (isoStr: string): string => {
    const now = new Date();
    const date = new Date(isoStr);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 86400000);
    const weekStart = new Date(todayStart.getTime() - 6 * 86400000);

    if (date >= todayStart) return 'Today';
    if (date >= yesterdayStart) return 'Yesterday';
    if (date >= weekStart) return 'This Week';
    return 'Older';
  };

  const TIMELINE_LIMIT = 5;
  const sortedHistory = [...history].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const filteredHistory = timelineFilter === 'all' ? sortedHistory : sortedHistory.filter((h) => h.user === timelineFilter);
  const visibleHistory = timelineExpanded ? filteredHistory : filteredHistory.slice(0, TIMELINE_LIMIT);
  const hiddenCount = Math.max(0, filteredHistory.length - TIMELINE_LIMIT);

  const hasRecentActivity = history.some((h) => {
    const diff = Date.now() - new Date(h.timestamp).getTime();
    return diff < 5 * 60 * 1000;
  });

  const groupedVisibleHistory: { period: string; items: ProjectHistoryItem[] }[] = [];
  let lastPeriod = '';
  visibleHistory.forEach((item) => {
    const period = getTimePeriod(item.timestamp);
    if (period !== lastPeriod) {
      groupedVisibleHistory.push({ period, items: [item] });
      lastPeriod = period;
    } else {
      groupedVisibleHistory[groupedVisibleHistory.length - 1].items.push(item);
    }
  });

  return (
    <div className="mb-6">
      <div className="px-4 py-2 mb-2 border-t border-border/50">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <History className="w-3 h-3" />
          Timeline
          <span className="text-[10px] bg-muted/50 px-1.5 py-0.5 ml-1">({filteredHistory.length})</span>
        </span>
      </div>

      <div className="px-4 mb-2 flex items-center gap-1">
        {(['all', 'User', 'AI'] as const).map((filter) => (
          <button
            key={filter}
            data-testid={`timeline-filter-${filter}`}
            className={cn(
              "text-[10px] px-2 py-0.5 border transition-colors",
              timelineFilter === filter
                ? "bg-primary/20 text-primary border-primary/30"
                : "bg-muted/30 text-muted-foreground border-border/50 hover:bg-muted/50"
            )}
            onClick={() => setTimelineFilter(filter)}
          >
            {filter === 'all' ? 'All' : filter}
          </button>
        ))}
      </div>

      <div className="px-4 relative">
        <div className="flex items-center gap-2 mb-3" data-testid="timeline-live-indicator">
          <div className={cn(
            "w-2 h-2 shrink-0",
            hasRecentActivity
              ? "bg-cyan-400 animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.6)]"
              : "bg-muted-foreground/50"
          )} />
          {hasRecentActivity && (
            <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">Live</span>
          )}
        </div>

        {groupedVisibleHistory.map((group, groupIdx) => (
          <div key={group.period}>
            <div className="flex items-center gap-2 mb-2 mt-1">
              <div className="h-px flex-1 bg-border/50" />
              <span className="text-[9px] uppercase tracking-wider text-muted-foreground/70 font-semibold">{group.period}</span>
              <div className="h-px flex-1 bg-border/50" />
            </div>
            <div className="relative space-y-0">
              {group.items.map((item, itemIdx) => {
                const IconComp = getActionIcon(item.action);
                const color = getActionColor(item);
                const isExpanded = expandedTimelineItem === item.id;
                const isLastInGroup = itemIdx === group.items.length - 1;
                return (
                  <div key={item.id} className="relative">
                    {!isLastInGroup && (
                      <div
                        className="absolute left-[5px] top-[18px] bottom-0 w-px z-0"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <div
                      className="relative pl-6 py-1.5 group/item cursor-pointer"
                      onClick={() => setExpandedTimelineItem(isExpanded ? null : item.id)}
                      data-testid={`timeline-item-${item.id}`}
                    >
                      <div className="absolute left-0 top-[6px] z-10 flex items-center justify-center w-3 h-3">
                        <IconComp className="w-3 h-3" style={{ color }} />
                      </div>

                      <button
                        data-testid={`timeline-undo-${item.id}`}
                        className="absolute right-0 top-1.5 opacity-0 group-hover/item:opacity-100 transition-opacity p-0.5 hover:bg-muted/50"
                        onClick={(e) => {
                          e.stopPropagation();
                          addOutputLog('[TIMELINE] Undo requested: ' + item.action);
                        }}
                      >
                        <RotateCcw className="w-[10px] h-[10px] text-muted-foreground" />
                      </button>

                      {isExpanded ? (
                        <div className="border border-border/50 bg-muted/20 p-2 mr-4">
                          <div className="text-xs font-medium text-foreground mb-1">{item.action}</div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "text-[9px] px-1.5 py-0.5 border",
                              item.user === 'AI'
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-muted/50 text-muted-foreground border-border/50"
                            )}>{item.user}</span>
                            <span className="text-[10px] text-muted-foreground">{formatExactTime(item.timestamp)}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1.5">
                            <button
                              className="text-[10px] px-1.5 py-0.5 bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.action);
                                addOutputLog(`[TIMELINE] Copied: ${item.action}`);
                              }}
                            >
                              <Copy className="w-2.5 h-2.5" />
                              Copy
                            </button>
                            <button
                              className="text-[10px] px-1.5 py-0.5 bg-muted/30 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center gap-1"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTimelineItem(null);
                              }}
                            >
                              <X className="w-2.5 h-2.5" />
                              Close
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="text-xs font-medium text-foreground group-hover/item:text-primary transition-colors truncate pr-4">{item.action}</div>
                          <div className="text-[10px] text-muted-foreground flex justify-between pr-4">
                            <span>{item.user}</span>
                            <span>{formatRelativeTime(item.timestamp)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {filteredHistory.length > TIMELINE_LIMIT && (
        <div className="px-4 mt-2">
          <button
            data-testid="timeline-show-more"
            className="text-xs text-primary hover:text-primary/80 transition-colors w-full text-left pl-6 py-1 flex items-center gap-1"
            onClick={() => setTimelineExpanded(!timelineExpanded)}
          >
            {timelineExpanded ? (
              <>
                <ChevronUp className="w-3 h-3" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Show {hiddenCount} more...
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
