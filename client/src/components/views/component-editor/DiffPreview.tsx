import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, Square, Circle, Type, Spline, Layers, MapPin, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PartDiff, ShapeDiff, ConnectorDiff, MetaDiff } from '@/lib/component-editor/types';

interface DiffPreviewProps {
  diff: PartDiff;
  acceptedShapeIds: Set<string>;
  acceptedConnectorIds: Set<string>;
  acceptedMetaFields: Set<string>;
  onToggleShape: (shapeId: string) => void;
  onToggleConnector: (connectorId: string) => void;
  onToggleMeta: (field: string) => void;
  onAcceptAll: () => void;
  onRejectAll: () => void;
}

const DIFF_TYPE_STYLES = {
  added: { label: 'Added', text: 'text-emerald-500', bg: 'bg-emerald-500/10' },
  removed: { label: 'Removed', text: 'text-destructive', bg: 'bg-destructive/10' },
  modified: { label: 'Modified', text: 'text-yellow-500', bg: 'bg-yellow-500/10' },
} as const;

const SHAPE_ICONS: Record<string, typeof Square> = {
  rect: Square,
  circle: Circle,
  text: Type,
  path: Spline,
  group: Layers,
};

function buildSummaryText(diff: PartDiff): string {
  const { summary } = diff;
  const shapeParts: string[] = [];
  if (summary.shapesAdded > 0) shapeParts.push(`${summary.shapesAdded} added`);
  if (summary.shapesModified > 0) shapeParts.push(`${summary.shapesModified} modified`);
  if (summary.shapesRemoved > 0) shapeParts.push(`${summary.shapesRemoved} removed`);

  const connectorTotal = summary.connectorsAdded + summary.connectorsRemoved + summary.connectorsModified;
  const parts: string[] = [];
  if (shapeParts.length > 0) parts.push(`Shapes: ${shapeParts.join(', ')}`);
  if (connectorTotal > 0) parts.push(`${connectorTotal} connector${connectorTotal !== 1 ? 's' : ''} changed`);
  if (summary.metaFieldsChanged > 0) parts.push(`${summary.metaFieldsChanged} metadata field${summary.metaFieldsChanged !== 1 ? 's' : ''} changed`);

  return parts.join(' | ');
}

function describeShapeModification(shapeDiff: ShapeDiff): string {
  if (shapeDiff.type !== 'modified' || !shapeDiff.before || !shapeDiff.after) return '';
  const changes: string[] = [];
  const before = shapeDiff.before;
  const after = shapeDiff.after;
  if (before.x !== after.x || before.y !== after.y) changes.push('position');
  if (before.width !== after.width || before.height !== after.height) changes.push('size');
  if (before.rotation !== after.rotation) changes.push('rotation');
  if (JSON.stringify(before.style) !== JSON.stringify(after.style)) changes.push('style');
  if (before.layer !== after.layer) changes.push('layer');
  return changes.length > 0 ? `Changed: ${changes.join(', ')}` : 'Properties changed';
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '(none)';
  if (typeof value === 'string') return value || '(empty)';
  if (Array.isArray(value)) return `[${value.length} items]`;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

interface CollapsibleSectionProps {
  title: string;
  count: number;
  defaultOpen?: boolean;
  testId: string;
  children: React.ReactNode;
}

function CollapsibleSection({ title, count, defaultOpen = true, testId, children }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div data-testid={testId}>
      <button
        data-testid={`${testId}-toggle`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {title}
        <span className="text-muted-foreground/70 ml-auto">{count}</span>
      </button>
      {open && <div className="px-1 pb-2">{children}</div>}
    </div>
  );
}

function ShapeRow({
  shapeDiff,
  accepted,
  onToggle,
}: {
  shapeDiff: ShapeDiff;
  accepted: boolean;
  onToggle: () => void;
}) {
  const style = DIFF_TYPE_STYLES[shapeDiff.type];
  const shapeType = shapeDiff.after?.type ?? shapeDiff.before?.type ?? 'rect';
  const Icon = SHAPE_ICONS[shapeType] ?? Square;

  return (
    <div
      data-testid={`shape-diff-${shapeDiff.shapeId}`}
      className={cn('flex items-center gap-2 px-2 py-1.5 rounded-md text-xs', style.bg)}
    >
      <Checkbox
        data-testid={`checkbox-shape-${shapeDiff.shapeId}`}
        checked={accepted}
        onCheckedChange={onToggle}
      />
      <Badge className={cn('text-[10px] px-1.5 py-0', style.bg, style.text, 'border-transparent')}>
        {style.label}
      </Badge>
      <Icon className={cn('w-3.5 h-3.5 shrink-0', style.text)} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate text-foreground">
          {shapeType} <span className="text-muted-foreground">{shapeDiff.shapeId.slice(0, 8)}</span>
        </span>
        <span className="text-muted-foreground text-[10px]">{shapeDiff.view}</span>
        {shapeDiff.type === 'modified' && (
          <span className="text-yellow-500/80 text-[10px]">{describeShapeModification(shapeDiff)}</span>
        )}
      </div>
    </div>
  );
}

function ConnectorRow({
  connDiff,
  accepted,
  onToggle,
}: {
  connDiff: ConnectorDiff;
  accepted: boolean;
  onToggle: () => void;
}) {
  const style = DIFF_TYPE_STYLES[connDiff.type];
  const connector = connDiff.after ?? connDiff.before;
  const name = connector?.name ?? connDiff.connectorId;
  const connType = connector?.connectorType ?? 'pad';

  return (
    <div
      data-testid={`connector-diff-${connDiff.connectorId}`}
      className={cn('flex items-center gap-2 px-2 py-1.5 rounded-md text-xs', style.bg)}
    >
      <Checkbox
        data-testid={`checkbox-connector-${connDiff.connectorId}`}
        checked={accepted}
        onCheckedChange={onToggle}
      />
      <Badge className={cn('text-[10px] px-1.5 py-0', style.bg, style.text, 'border-transparent')}>
        {style.label}
      </Badge>
      <MapPin className={cn('w-3.5 h-3.5 shrink-0', style.text)} />
      <div className="flex flex-col min-w-0 flex-1">
        <span className="truncate text-foreground">{name}</span>
        <span className="text-muted-foreground text-[10px]">{connType}</span>
      </div>
    </div>
  );
}

function MetaRow({
  metaDiff,
  accepted,
  onToggle,
}: {
  metaDiff: MetaDiff;
  accepted: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      data-testid={`meta-diff-${metaDiff.field}`}
      className={cn('flex items-center gap-2 px-2 py-1.5 rounded-md text-xs', DIFF_TYPE_STYLES.modified.bg)}
    >
      <Checkbox
        data-testid={`checkbox-meta-${metaDiff.field}`}
        checked={accepted}
        onCheckedChange={onToggle}
      />
      <span className="font-medium text-foreground min-w-0 shrink-0">{metaDiff.field}</span>
      <span className="text-muted-foreground truncate">{formatValue(metaDiff.before)}</span>
      <ArrowRight className="w-3 h-3 shrink-0 text-muted-foreground" />
      <span className="text-yellow-500 truncate">{formatValue(metaDiff.after)}</span>
    </div>
  );
}

export default function DiffPreview({
  diff,
  acceptedShapeIds,
  acceptedConnectorIds,
  acceptedMetaFields,
  onToggleShape,
  onToggleConnector,
  onToggleMeta,
  onAcceptAll,
  onRejectAll,
}: DiffPreviewProps) {
  return (
    <div data-testid="diff-preview" className="flex flex-col gap-2">
      <div
        data-testid="diff-summary"
        className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground"
      >
        {buildSummaryText(diff)}
      </div>

      <div className="flex items-center gap-2">
        <Button
          data-testid="button-accept-all"
          variant="outline"
          size="sm"
          className="text-xs text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
          onClick={onAcceptAll}
        >
          Accept All
        </Button>
        <Button
          data-testid="button-reject-all"
          variant="outline"
          size="sm"
          className="text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
          onClick={onRejectAll}
        >
          Reject All
        </Button>
      </div>

      <ScrollArea className="max-h-[50vh]">
        <div className="flex flex-col gap-1">
          <CollapsibleSection
            title="Shape Changes"
            count={diff.shapes.length}
            testId="section-shapes"
          >
            {diff.shapes.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">(no changes)</p>
            ) : (
              <div className="flex flex-col gap-1">
                {diff.shapes.map(s => (
                  <ShapeRow
                    key={s.shapeId}
                    shapeDiff={s}
                    accepted={acceptedShapeIds.has(s.shapeId)}
                    onToggle={() => onToggleShape(s.shapeId)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Connector Changes"
            count={diff.connectors.length}
            testId="section-connectors"
          >
            {diff.connectors.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">(no changes)</p>
            ) : (
              <div className="flex flex-col gap-1">
                {diff.connectors.map(c => (
                  <ConnectorRow
                    key={c.connectorId}
                    connDiff={c}
                    accepted={acceptedConnectorIds.has(c.connectorId)}
                    onToggle={() => onToggleConnector(c.connectorId)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Metadata Changes"
            count={diff.metaChanges.length}
            testId="section-metadata"
          >
            {diff.metaChanges.length === 0 ? (
              <p className="text-xs text-muted-foreground px-2 py-1">(no changes)</p>
            ) : (
              <div className="flex flex-col gap-1">
                {diff.metaChanges.map(m => (
                  <MetaRow
                    key={m.field}
                    metaDiff={m}
                    accepted={acceptedMetaFields.has(m.field)}
                    onToggle={() => onToggleMeta(m.field)}
                  />
                ))}
              </div>
            )}
          </CollapsibleSection>
        </div>
      </ScrollArea>
    </div>
  );
}
