/**
 * InspectorPanel — details for the picked scene element (PP3D-5).
 *
 * Pure DOM (no three.js): renders the {@link SelectionDetails} produced by
 * `describeSelection()` as a floating card over the WebGL viewport. Shows
 * refDes/package/value/net/datasheet/supplier per the upgrade plan (§7
 * cross-probe inspector). Renders nothing when there is no selection.
 */

import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { SelectionDetails } from '../model/scene-lookup';

export interface InspectorPanelProps {
  details: SelectionDetails | null;
  onClose: () => void;
}

export function InspectorPanel({ details, onClose }: InspectorPanelProps) {
  if (!details) return null;

  return (
    <div
      data-testid="inspector-panel"
      role="region"
      aria-label={`Inspector: ${details.title}`}
      className="absolute top-3 right-3 w-64 rounded-lg border border-border/60 bg-background/90 backdrop-blur-sm shadow-lg p-3 space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div data-testid="inspector-title" className="text-sm font-semibold truncate">
            {details.title}
          </div>
          <div data-testid="inspector-subtitle" className="text-xs text-muted-foreground truncate">
            {details.subtitle}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          aria-label="Close inspector"
          data-testid="inspector-close"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <dl className="space-y-1">
        {details.fields.map((field) => (
          <div
            key={field.label}
            data-testid={`inspector-field-${field.label.toLowerCase()}`}
            className="flex items-baseline justify-between gap-2 text-xs"
          >
            <dt className="text-muted-foreground shrink-0">{field.label}</dt>
            <dd className="font-mono text-right truncate">
              {field.href ? (
                <a
                  href={field.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {field.value}
                </a>
              ) : (
                field.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default InspectorPanel;
