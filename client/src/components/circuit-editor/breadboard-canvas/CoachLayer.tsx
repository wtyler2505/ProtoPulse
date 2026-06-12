/**
 * CoachLayer — SVG layer composing the bench-coach overlays: the selected-part
 * pin anchor overlay and the staged coach plan overlay.
 *
 * Extracted verbatim from breadboard-canvas/index.tsx (audit #32, W1.12b).
 * Purely presentational: all state stays in BreadboardCanvas.
 */

import { BreadboardCoachPlanOverlay, BreadboardPinAnchorOverlay } from '../BreadboardCoachOverlay';
import type { BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import type { BreadboardCoachPlan } from '@/lib/breadboard-coach-plan';
import type {
  ResolvedCoachBridge,
  ResolvedCoachHookup,
  ResolvedCoachSuggestion,
  StagedCoachSuggestion,
} from '../useBreadboardCoachPlan';

export interface CoachLayerProps {
  selectedInstanceModel: BreadboardSelectedPartModel | null;
  hoveredInspectorPinId: string | null;
  coachPlanVisible: boolean;
  coachPlan: BreadboardCoachPlan | null;
  preparedCoachHookups: ResolvedCoachHookup[];
  preparedCoachBridges: ResolvedCoachBridge[];
  stagedCoachSuggestions: StagedCoachSuggestion[];
  resolvedCoachSuggestions: ResolvedCoachSuggestion[];
  onApplyRemediation: (suggestionId: string) => void;
}

export function CoachLayer({
  selectedInstanceModel,
  hoveredInspectorPinId,
  coachPlanVisible,
  coachPlan,
  preparedCoachHookups,
  preparedCoachBridges,
  stagedCoachSuggestions,
  resolvedCoachSuggestions,
  onApplyRemediation,
}: CoachLayerProps) {
  return (
    <>
      {selectedInstanceModel && (
        <BreadboardPinAnchorOverlay
          selectedInstanceModel={selectedInstanceModel}
          hoveredInspectorPinId={hoveredInspectorPinId}
          coachPlanVisible={coachPlanVisible}
          coachPlan={coachPlan}
        />
      )}

      {coachPlanVisible && coachPlan && (
        <BreadboardCoachPlanOverlay
          coachPlan={coachPlan}
          preparedCoachHookups={preparedCoachHookups}
          preparedCoachBridges={preparedCoachBridges}
          stagedCoachSuggestions={stagedCoachSuggestions}
          resolvedCoachSuggestions={resolvedCoachSuggestions}
          onApplyRemediation={(suggestionId) => onApplyRemediation(suggestionId)}
        />
      )}
    </>
  );
}
