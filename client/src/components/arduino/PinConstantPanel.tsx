import { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Cpu,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  generatePinConstants,
  formatAsConstExpressions,
  formatAsDefines,
  getConstantsSummary,
} from '@shared/arduino-pin-generator';
import type {
  BoardType,
  NetInfo,
  InstanceInfo,
  PinGeneratorOptions,
} from '@shared/arduino-pin-generator';
// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PinConstantPanelProps {
  readonly nets: readonly NetInfo[];
  readonly instances: readonly InstanceInfo[];
  readonly className?: string;
  readonly onInsertIntoSketch?: (code: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PinConstantPanel({
  nets,
  instances,
  className,
  onInsertIntoSketch,
}: PinConstantPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [boardType, setBoardType] = useState<BoardType>('uno');
  const [includeComments, setIncludeComments] = useState(true);
  const [groupByCategory, setGroupByCategory] = useState(true);
  const [copied, setCopied] = useState(false);

  const options: PinGeneratorOptions = useMemo(() => ({
    boardType,
    includeComments,
    groupByCategory,
  }), [boardType, includeComments, groupByCategory]);

  const constants = useMemo(
    () => generatePinConstants(nets, instances, options),
    [nets, instances, options],
  );

  const output = useMemo(
    () => formatAsDefines(constants, options),
    [constants, options],
  );

  const summary = useMemo(
    () => getConstantsSummary(constants, nets.length),
    [constants, nets.length],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [output]);

  const handleInsert = useCallback(() => {
    if (onInsertIntoSketch) {
      onInsertIntoSketch(output);
    }
  }, [onInsertIntoSketch, output]);

  return (
    <div
      className={cn('border border-border rounded-lg bg-card/50', className)}
      data-testid="panel-pin-constants"
    >
      {/* Header — always visible */}
      <button
        className="w-full flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
        onClick={() => setCollapsed((prev) => !prev)}
        data-testid="button-pin-constants-toggle"
      >
        <div className="flex items-center gap-2">
          {collapsed
            ? <ChevronRight className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          <Hash className="w-4 h-4 text-primary" />
          <span className="text-xs font-bold uppercase tracking-wider">Pin Constants</span>
          {constants.length > 0 && (
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
              {constants.length}
            </Badge>
          )}
        </div>
        <Cpu className="w-3.5 h-3.5 text-muted-foreground" />
      </button>

      {/* Collapsible body */}
      {!collapsed && (
        <div className="border-t border-border px-3 pb-3">
          {/* Controls row */}
          <div className="flex items-center gap-2 py-2 flex-wrap">
            <Select
              value={boardType}
              onValueChange={(v) => setBoardType(v as BoardType)}
            >
              <SelectTrigger
                className="h-7 text-[10px] w-[130px]"
                data-testid="select-pin-board-type"
              >
                <SelectValue placeholder="Board" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="uno">Arduino Uno</SelectItem>
                <SelectItem value="nano">Arduino Nano</SelectItem>
                <SelectItem value="mega">Arduino Mega</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="rounded border-border"
                data-testid="checkbox-pin-comments"
              />
              Comments
            </label>

            <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={groupByCategory}
                onChange={(e) => setGroupByCategory(e.target.checked)}
                className="rounded border-border"
                data-testid="checkbox-pin-group"
              />
              Group
            </label>
          </div>

          {/* Summary */}
          <div className="text-[10px] text-muted-foreground mb-2" data-testid="text-pin-summary">
            {summary}
          </div>

          {/* Code output */}
          {constants.length > 0 ? (
            <>
              <ScrollArea className="max-h-48 rounded border border-border bg-black/40">
                <pre
                  className="p-2 text-[10px] font-mono text-foreground whitespace-pre overflow-x-auto"
                  data-testid="code-pin-output"
                >
                  {output}
                </pre>
              </ScrollArea>

              {/* Action buttons */}
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-[10px] gap-1"
                  onClick={() => void handleCopy()}
                  data-testid="button-pin-copy"
                >
                  {copied
                    ? <Check className="w-3 h-3 text-green-500" />
                    : <Copy className="w-3 h-3" />}
                  {copied ? 'Copied' : 'Copy to Clipboard'}
                </Button>

                {onInsertIntoSketch && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-7 text-[10px] gap-1"
                    onClick={handleInsert}
                    data-testid="button-pin-insert"
                  >
                    Insert into Sketch
                  </Button>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground opacity-50">
              <Hash className="w-6 h-6 mb-1" />
              <span className="text-[10px]">No pin constants to generate.</span>
              <span className="text-[9px] mt-0.5">Add named nets in the schematic editor.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
