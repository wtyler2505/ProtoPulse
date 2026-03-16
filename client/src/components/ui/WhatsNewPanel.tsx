import { useState, useEffect, useCallback } from 'react';
import { Gift } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { cn } from '@/lib/utils';
import {
  parseChangelog,
  getLastSeenVersion,
  setLastSeenVersion,
  countUnseenEntries,
  changeTypeBgColor,
} from '@/lib/changelog-panel';
import type { ChangelogVersion } from '@/lib/changelog-panel';

// Inline the changelog content — Vite handles this via ?raw import
import changelogRaw from '../../../../docs/CHANGELOG.md?raw';

export default function WhatsNewPanel() {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<ChangelogVersion[]>([]);
  const [unseenCount, setUnseenCount] = useState(0);

  useEffect(() => {
    const parsed = parseChangelog(changelogRaw);
    setVersions(parsed);
    const lastSeen = getLastSeenVersion();
    setUnseenCount(countUnseenEntries(parsed, lastSeen));
  }, []);

  const handleOpen = useCallback(() => {
    setOpen(true);
    // Mark the latest version as seen
    if (versions.length > 0) {
      setLastSeenVersion(versions[0].version);
      setUnseenCount(0);
    }
  }, [versions]);

  return (
    <>
      <StyledTooltip content="What's new" side="bottom">
        <button
          data-testid="whats-new-button"
          onClick={handleOpen}
          className="p-2 hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors rounded-sm relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="What's new"
        >
          <Gift className="w-4 h-4" />
          {unseenCount > 0 && (
            <span
              data-testid="whats-new-badge"
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold bg-primary text-primary-foreground rounded-full tabular-nums"
            >
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )}
        </button>
      </StyledTooltip>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[400px] sm:max-w-[400px] p-0 flex flex-col">
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-primary" />
              What&apos;s New
            </SheetTitle>
            <SheetDescription>
              Recent changes and updates to ProtoPulse
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="px-6 py-4 space-y-6" data-testid="whats-new-content">
              {versions.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No changelog entries found.
                </p>
              )}

              {versions.map((v) => (
                <div key={v.version} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {v.version === 'Unreleased' ? 'Unreleased' : `v${v.version}`}
                    </h3>
                    {v.date && (
                      <span className="text-xs text-muted-foreground">
                        {v.date}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-1.5">
                    {v.entries.map((entry, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                        <Badge
                          variant="outline"
                          className={cn(
                            'shrink-0 mt-0.5 text-[10px] px-1.5 py-0 h-[18px] font-medium border-0 rounded-sm uppercase',
                            changeTypeBgColor(entry.type),
                          )}
                        >
                          {entry.type}
                        </Badge>
                        <span>{entry.text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}
