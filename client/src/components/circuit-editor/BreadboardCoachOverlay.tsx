/**
 * BreadboardCoachOverlay — SVG overlay rendering for the breadboard coach plan.
 * Renders corridor hints, hookup paths, bridge paths, staged/pending suggestions,
 * and pin anchor highlights.
 *
 * Pure extraction from BreadboardView.tsx — no behavior changes.
 */

import type { BreadboardCoachPlan, CoachRemediation } from '@/lib/breadboard-coach-plan';
import type { BreadboardPinRole, BreadboardSelectedPartModel } from '@/lib/breadboard-part-inspector';
import {
  coordToPixel,
  type ColumnLetter,
  type PixelPos,
} from '@/lib/circuit-editor/breadboard-model';
import { CapacitorSvg, ResistorSvg } from './breadboard-components';
import type { BreadboardCoachSuggestion } from '@/lib/breadboard-coach-plan';
import {
  getCoachToneColor,
  getCoachHookupColor,
  type ResolvedCoachHookup,
  type ResolvedCoachBridge,
  type ResolvedCoachSuggestion,
  type StagedCoachSuggestion,
} from './useBreadboardCoachPlan';

// ---------------------------------------------------------------------------
// getPinRoleColor — maps pin roles to visual color tokens
// ---------------------------------------------------------------------------

export function getPinRoleColor(role: BreadboardPinRole): string {
  switch (role) {
    case 'power':
      return '#fb7185';
    case 'ground':
      return '#38bdf8';
    case 'clock':
      return '#a78bfa';
    case 'control':
      return '#f59e0b';
    case 'communication':
      return '#22d3ee';
    case 'analog':
      return '#a3e635';
    case 'passive':
      return '#34d399';
    case 'signal':
    default:
      return '#e2e8f0';
  }
}

// ---------------------------------------------------------------------------
// CoachSuggestionOverlay — individual suggestion ghost / staged indicator
// ---------------------------------------------------------------------------

export function CoachSuggestionOverlay({
  suggestion,
  status,
}: {
  suggestion: Pick<BreadboardCoachSuggestion, 'id' | 'label' | 'priority' | 'type' | 'value'> & {
    pixel: PixelPos;
    targetPixels: PixelPos[];
  };
  status: 'pending' | 'staged';
}) {
  const isCapacitor = suggestion.type === 'capacitor';
  const strokeColor = suggestion.priority === 'critical' ? '#fb7185' : '#22d3ee';
  const textColor = suggestion.priority === 'critical' ? '#fecdd3' : '#cffafe';
  const subhead = status === 'pending'
    ? suggestion.priority === 'critical'
      ? 'critical coach move'
      : 'recommended support move'
    : 'staged support';

  return (
    <g data-testid={`breadboard-coach-suggestion-${suggestion.id}`}>
      {suggestion.targetPixels.map((targetPixel, index) => (
        <line
          key={`${suggestion.id}-target-${index}`}
          x1={suggestion.pixel.x}
          y1={suggestion.pixel.y}
          x2={targetPixel.x}
          y2={targetPixel.y}
          stroke={strokeColor}
          strokeWidth={status === 'pending' ? 0.9 : 0.85}
          strokeDasharray={status === 'pending' ? '2 2' : undefined}
          opacity={status === 'pending' ? 0.7 : 0.45}
        />
      ))}

      {status === 'pending' ? (
        <g opacity={0.45}>
          {isCapacitor ? (
            <CapacitorSvg cx={suggestion.pixel.x} cy={suggestion.pixel.y} farads={Number(suggestion.value)} />
          ) : (
            <ResistorSvg cx={suggestion.pixel.x} cy={suggestion.pixel.y} ohms={Number(suggestion.value)} />
          )}
        </g>
      ) : (
        <g opacity={0.74}>
          <circle cx={suggestion.pixel.x} cy={suggestion.pixel.y} r={9} fill={`${strokeColor}16`} />
          <circle cx={suggestion.pixel.x} cy={suggestion.pixel.y} r={11} fill="none" stroke={strokeColor} strokeWidth={0.9} />
        </g>
      )}

      <rect
        x={suggestion.pixel.x + 10}
        y={suggestion.pixel.y - 15}
        width={56}
        height={18}
        rx={4}
        fill={status === 'pending' ? 'rgba(4,8,15,0.88)' : 'rgba(4,8,15,0.76)'}
        stroke={strokeColor}
        strokeWidth={0.75}
      />
      <text
        x={suggestion.pixel.x + 14}
        y={suggestion.pixel.y - 8}
        fill={textColor}
        fontSize={4.4}
        fontFamily="monospace"
      >
        {suggestion.label}
      </text>
      <text
        x={suggestion.pixel.x + 14}
        y={suggestion.pixel.y - 2}
        fill={status === 'pending' ? '#cbd5e1' : textColor}
        fontSize={3.8}
        fontFamily="monospace"
        opacity={status === 'pending' ? 0.9 : 0.82}
      >
        {subhead}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// BreadboardCoachPlanOverlay — full coach plan SVG group
// ---------------------------------------------------------------------------

interface BreadboardCoachPlanOverlayProps {
  coachPlan: BreadboardCoachPlan;
  preparedCoachHookups: ResolvedCoachHookup[];
  preparedCoachBridges: ResolvedCoachBridge[];
  stagedCoachSuggestions: StagedCoachSuggestion[];
  resolvedCoachSuggestions: ResolvedCoachSuggestion[];
  onApplyRemediation?: (suggestionId: string, remediation: CoachRemediation) => void;
}

export function BreadboardCoachPlanOverlay({
  coachPlan,
  preparedCoachHookups,
  preparedCoachBridges,
  stagedCoachSuggestions,
  resolvedCoachSuggestions,
  onApplyRemediation,
}: BreadboardCoachPlanOverlayProps) {
  return (
    <g data-testid="breadboard-coach-plan-overlay" pointerEvents="none">
      {coachPlan.corridorHints.map((hint) => {
        const startCol: ColumnLetter = hint.side === 'left' ? 'a' : 'h';
        const endCol: ColumnLetter = hint.side === 'left' ? 'd' : 'j';
        const startPx = coordToPixel({ type: 'terminal', col: startCol, row: hint.rows[0] });
        const endPx = coordToPixel({ type: 'terminal', col: endCol, row: hint.rows[1] });
        const toneColor = getCoachToneColor(hint.tone);
        return (
          <g key={hint.id} data-testid={`breadboard-coach-corridor-${hint.id}`}>
            <rect
              x={Math.min(startPx.x, endPx.x) - 8}
              y={Math.min(startPx.y, endPx.y) - 6}
              width={Math.abs(endPx.x - startPx.x) + 16}
              height={Math.abs(endPx.y - startPx.y) + 12}
              rx={8}
              fill={`${toneColor}12`}
              stroke={toneColor}
              strokeWidth={0.8}
              strokeDasharray="3 2"
              opacity={0.72}
            />
            <text
              x={Math.min(startPx.x, endPx.x)}
              y={Math.min(startPx.y, endPx.y) - 10}
              fill={toneColor}
              fontSize={5}
              fontFamily="monospace"
            >
              {hint.label}
            </text>
          </g>
        );
      })}

      {preparedCoachHookups.map((hookup) => {
        const color = getCoachHookupColor(hookup.netType);
        const polylinePoints = hookup.path.map((point) => `${point.x},${point.y}`).join(' ');
        const labelX = Math.min(hookup.railPixel.x, hookup.targetPixel.x) + 8;
        const labelY = hookup.targetPixel.y - 11;
        const isPending = !hookup.isRouted;

        return (
          <g key={hookup.id} data-testid={`breadboard-coach-hookup-${hookup.id}`}>
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={isPending ? 1.15 : 1}
              strokeDasharray={isPending ? '3 2' : undefined}
              opacity={isPending ? 0.82 : 0.52}
            />
            <circle cx={hookup.railPixel.x} cy={hookup.railPixel.y} r={2.2} fill={color} opacity={isPending ? 0.9 : 0.58} />
            <rect
              x={labelX}
              y={labelY - 6}
              width={38}
              height={14}
              rx={4}
              fill={isPending ? 'rgba(4,8,15,0.9)' : 'rgba(4,8,15,0.72)'}
              stroke={color}
              strokeWidth={0.75}
            />
            <text x={labelX + 4} y={labelY} fill={color} fontSize={4.2} fontFamily="monospace">
              {hookup.netName} rail
            </text>
          </g>
        );
      })}

      {preparedCoachBridges.map((bridge) => {
        const color = getCoachHookupColor(bridge.netType);
        const polylinePoints = bridge.path.map((point) => `${point.x},${point.y}`).join(' ');
        const labelX = Math.min(bridge.fromPixel.x, bridge.toPixel.x) + 28;
        const labelY = bridge.fromPixel.y - 11;
        const isPending = !bridge.isRouted;

        return (
          <g key={bridge.id} data-testid={`breadboard-coach-bridge-${bridge.id}`}>
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={isPending ? 1.1 : 1}
              strokeDasharray={isPending ? '4 2' : undefined}
              opacity={isPending ? 0.78 : 0.5}
            />
            <circle cx={bridge.fromPixel.x} cy={bridge.fromPixel.y} r={2.1} fill={color} opacity={isPending ? 0.88 : 0.56} />
            <circle cx={bridge.toPixel.x} cy={bridge.toPixel.y} r={2.1} fill={color} opacity={isPending ? 0.88 : 0.56} />
            <rect
              x={labelX}
              y={labelY - 6}
              width={46}
              height={14}
              rx={4}
              fill={isPending ? 'rgba(4,8,15,0.9)' : 'rgba(4,8,15,0.72)'}
              stroke={color}
              strokeWidth={0.75}
            />
            <text x={labelX + 4} y={labelY} fill={color} fontSize={4.1} fontFamily="monospace">
              {bridge.netName} bridge
            </text>
          </g>
        );
      })}

      {stagedCoachSuggestions.map((suggestion) => (
        <CoachSuggestionOverlay
          key={`staged-${suggestion.id}-${suggestion.instanceId}`}
          suggestion={suggestion}
          status="staged"
        />
      ))}

      {resolvedCoachSuggestions.map((suggestion) => (
        <CoachSuggestionOverlay key={`pending-${suggestion.id}`} suggestion={suggestion} status="pending" />
      ))}

      {/* Apply buttons — separate group with pointer events enabled */}
      {onApplyRemediation && (
        <g data-testid="coach-apply-buttons" pointerEvents="all">
          {coachPlan.suggestions
            .filter((s) => s.remediation)
            .map((suggestion) => {
              const resolved = resolvedCoachSuggestions.find((r) => r.id === suggestion.id);
              if (!resolved) {
                return null;
              }
              const btnX = resolved.pixel.x + 10;
              const btnY = resolved.pixel.y + 6;
              return (
                <g
                  key={`apply-${suggestion.id}`}
                  data-testid={`coach-apply-${suggestion.id}`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    onApplyRemediation(suggestion.id, suggestion.remediation!);
                  }}
                >
                  <rect
                    x={btnX}
                    y={btnY}
                    width={36}
                    height={12}
                    rx={3}
                    fill="rgba(0,240,255,0.15)"
                    stroke="#00F0FF"
                    strokeWidth={0.75}
                  />
                  <text
                    x={btnX + 18}
                    y={btnY + 8}
                    fill="#00F0FF"
                    fontSize={5}
                    fontFamily="monospace"
                    textAnchor="middle"
                  >
                    Apply
                  </text>
                </g>
              );
            })}
        </g>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// BreadboardPinAnchorOverlay — pin anchor circles for selected instance
// ---------------------------------------------------------------------------

interface BreadboardPinAnchorOverlayProps {
  selectedInstanceModel: BreadboardSelectedPartModel;
  hoveredInspectorPinId: string | null;
  coachPlanVisible: boolean;
  coachPlan: BreadboardCoachPlan | null;
}

export function BreadboardPinAnchorOverlay({
  selectedInstanceModel,
  hoveredInspectorPinId,
  coachPlanVisible,
  coachPlan,
}: BreadboardPinAnchorOverlayProps) {
  if (selectedInstanceModel.pins.length === 0) {
    return null;
  }

  return (
    <g data-testid="breadboard-pin-anchor-overlay" pointerEvents="none">
      {selectedInstanceModel.pins.map((pin) => {
        const roleColor = getPinRoleColor(pin.role);
        const isHovered = hoveredInspectorPinId === pin.id;
        const isCoachTarget = coachPlanVisible && Boolean(coachPlan?.highlightedPinIds.includes(pin.id));
        return (
          <g key={pin.id} data-testid={`breadboard-pin-anchor-${pin.id}`}>
            <circle
              cx={pin.pixel.x}
              cy={pin.pixel.y}
              r={isHovered ? 6.2 : isCoachTarget ? 5.2 : pin.isCritical ? 4.6 : 4}
              fill={`${roleColor}20`}
              stroke={roleColor}
              strokeWidth={isCoachTarget ? 1.45 : pin.isCritical ? 1.25 : 0.9}
              strokeDasharray={pin.confidence === 'heuristic' ? '1.2 1.2' : undefined}
              opacity={isHovered ? 1 : 0.9}
            />
            <circle
              cx={pin.pixel.x}
              cy={pin.pixel.y}
              r={pin.confidence === 'exact' ? 2.1 : 1.7}
              fill={roleColor}
              opacity={pin.confidence === 'exact' ? 0.95 : 0.72}
            />
            {pin.isCritical && (
              <circle
                cx={pin.pixel.x}
                cy={pin.pixel.y}
                r={0.8}
                fill="#f8fafc"
                opacity={0.95}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}
