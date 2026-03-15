/**
 * AlternatePartsPopover — BL-0540
 *
 * Shows a floating badge on schematic instance nodes indicating how many
 * alternate parts are available.  Hovering the badge opens a popover with
 * a price/stock comparison table sourced from the AlternatePartsEngine.
 */

import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { InstanceAlternateInfo } from '@/lib/schematic-alternates';
import {
  equivalenceLevelLabel,
  equivalenceLevelColor,
  confidenceColor,
  statusColor,
  formatPrice,
} from '@/lib/schematic-alternates';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AlternatePartsPopoverProps {
  info: InstanceAlternateInfo;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AlternatePartsPopover({ info, className }: AlternatePartsPopoverProps) {
  const [open, setOpen] = useState(false);

  if (info.alternateCount === 0 || !info.result) {
    return null;
  }

  const { result } = info;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid={`alt-parts-badge-${String(info.instanceId)}`}
          aria-label={`${String(info.alternateCount)} alternates available for ${info.referenceDesignator}`}
          className={cn(
            'absolute -top-2 -right-2 z-10 cursor-pointer',
            className,
          )}
          onMouseEnter={() => { setOpen(true); }}
          onMouseLeave={() => { setOpen(false); }}
          onFocus={() => { setOpen(true); }}
          onBlur={() => { setOpen(false); }}
        >
          <Badge
            variant="secondary"
            className="px-1.5 py-0 text-[10px] leading-4 bg-cyan-900/80 text-cyan-300 border-cyan-700/50 hover:bg-cyan-800/90"
          >
            {info.alternateCount} alt{info.alternateCount !== 1 ? 's' : ''}
          </Badge>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="w-[360px] p-0 bg-card/95 backdrop-blur-xl border-border"
        onMouseEnter={() => { setOpen(true); }}
        onMouseLeave={() => { setOpen(false); }}
        onOpenAutoFocus={(e) => { e.preventDefault(); }}
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Alternates for {info.referenceDesignator}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {info.partNumber}
            </span>
          </div>
          {result.originalPart.manufacturer && (
            <span className="text-[10px] text-muted-foreground">
              {result.originalPart.manufacturer}
            </span>
          )}
        </div>

        {/* Table */}
        <div className="max-h-[280px] overflow-y-auto" data-testid={`alt-parts-table-${String(info.instanceId)}`}>
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-card/95 backdrop-blur-sm">
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left px-3 py-1.5 font-medium">Part</th>
                <th className="text-left px-2 py-1.5 font-medium">Match</th>
                <th className="text-right px-2 py-1.5 font-medium">Price</th>
                <th className="text-center px-2 py-1.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {result.alternates.map((alt) => (
                <tr
                  key={alt.part.id}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  data-testid={`alt-row-${alt.part.partNumber}`}
                >
                  <td className="px-3 py-1.5">
                    <div className="font-medium text-foreground truncate max-w-[120px]" title={alt.part.partNumber}>
                      {alt.part.partNumber}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate max-w-[120px]" title={alt.part.manufacturer}>
                      {alt.part.manufacturer}
                    </div>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className={cn('font-medium', equivalenceLevelColor(alt.equivalenceLevel))}>
                      {equivalenceLevelLabel(alt.equivalenceLevel)}
                    </div>
                    <div className={cn('text-[10px]', confidenceColor(alt.confidence))}>
                      {alt.confidence} conf.
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">
                    <span className={cn(
                      alt.part.unitPrice !== undefined && result.originalPart.unitPrice !== undefined
                        ? alt.part.unitPrice < result.originalPart.unitPrice
                          ? 'text-green-400'
                          : alt.part.unitPrice > result.originalPart.unitPrice
                            ? 'text-red-400'
                            : 'text-foreground'
                        : 'text-muted-foreground',
                    )}>
                      {formatPrice(alt.part.unitPrice)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={cn('text-[10px] capitalize', statusColor(alt.part.status))}>
                      {alt.part.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer with original part price for comparison */}
        {result.originalPart.unitPrice !== undefined && (
          <div className="px-3 py-1.5 border-t border-border flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Original price:
            </span>
            <span className="text-[11px] font-mono text-foreground">
              {formatPrice(result.originalPart.unitPrice)}
            </span>
          </div>
        )}

        {/* Warnings */}
        {result.warnings.length > 0 && (
          <div className="px-3 py-1.5 border-t border-border">
            {result.warnings.map((w, i) => (
              <div key={i} className="text-[10px] text-yellow-400">
                {w}
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
