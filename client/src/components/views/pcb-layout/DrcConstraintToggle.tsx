/**
 * DrcConstraintToggle — Toolbar button to show/hide the DRC constraint overlay.
 * Uses Eye/EyeOff icons to indicate visibility state.
 */

import { memo } from 'react';
import { Eye, EyeOff } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DrcConstraintToggleProps {
  visible: boolean;
  onToggle: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DrcConstraintToggle = memo(function DrcConstraintToggle({
  visible,
  onToggle,
}: DrcConstraintToggleProps) {
  const Icon = visible ? Eye : EyeOff;

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium border rounded transition-colors ${
        visible
          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 hover:bg-amber-500/30'
          : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
      }`}
      title={visible ? 'Hide DRC zones' : 'Show DRC zones'}
      data-testid="drc-constraint-toggle"
    >
      <Icon className="w-3.5 h-3.5" />
      <span>DRC Zones</span>
    </button>
  );
});

export { DrcConstraintToggle };
