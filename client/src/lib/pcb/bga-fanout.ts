/**
 * BGA Fanout and Escape Routing Engine
 *
 * Generates fanout patterns for Ball Grid Array packages, including:
 *   - Dog-bone fanout (standard via-in-pad with short trace)
 *   - Via-in-pad (direct via under BGA ball)
 *   - Escape channel routing (trace between ball rows)
 *   - BGA-specific DRC rules (pitch vs via, anti-pad, solder mask bridge)
 *   - Pattern recommendation based on BGA pitch and fab capabilities
 *   - 5+ BGA presets for common packages
 *
 * All dimensions are in millimeters. Coordinates assume BGA center at origin.
 *
 * References:
 *   - IPC-7095: Design and Assembly Process Implementation for BGAs
 *   - IPC-7093: Design and Assembly Process Implementation for
 *     Bottom Termination Components
 *   - Cadence: "BGA Fanout Strategies"
 *
 * Usage:
 *   const result = generateFanout(preset, rules);
 *   const drc = checkBgaDrc(result, rules);
 */

import type { ViaType } from './via-model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FanoutPattern = 'dog-bone' | 'via-in-pad' | 'escape-channel';

export interface BgaPreset {
  name: string;
  pitch: number; // mm (ball pitch)
  ballDiameter: number; // mm
  rows: number; // number of rows (square grid assumed)
  cols: number; // number of columns
  ballCount: number; // total balls (may be less than rows*cols for depopulated)
  depopulatedCenter?: number; // number of rows/cols depopulated in center
  description: string;
}

export interface BgaFanoutRules {
  /** Minimum via drill diameter (mm). */
  minViaDrill: number;
  /** Minimum via annular ring (mm). */
  minAnnularRing: number;
  /** Minimum trace width (mm). */
  minTraceWidth: number;
  /** Minimum trace-to-trace clearance (mm). */
  minClearance: number;
  /** Minimum solder mask bridge width (mm). */
  minSolderMaskBridge: number;
  /** Minimum anti-pad diameter (mm). Typically via outer + 2*clearance. */
  minAntiPad: number;
  /** Whether via-in-pad is allowed by fab. */
  allowViaInPad: boolean;
  /** Whether micro vias (laser drilled) are available. */
  allowMicroVia: boolean;
  /** Maximum via aspect ratio (depth:diameter). */
  maxViaAspectRatio: number;
  /** Board thickness in mm (for aspect ratio check). */
  boardThickness: number;
  /** Number of routing layers available. */
  routingLayers: number;
}

export interface FanoutVia {
  id: string;
  position: { x: number; y: number };
  drillDiameter: number;
  outerDiameter: number;
  type: ViaType;
  netId: string;
  padRow: number;
  padCol: number;
}

export interface FanoutTrace {
  id: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  width: number;
  layer: string;
  netId: string;
}

export interface FanoutResult {
  pattern: FanoutPattern;
  vias: FanoutVia[];
  traces: FanoutTrace[];
  escapedBalls: number;
  totalBalls: number;
  escapeRate: number; // 0-1
  layersUsed: number;
  warnings: string[];
}

export type BgaDrcViolationType =
  | 'pitch_vs_via'
  | 'anti_pad_overlap'
  | 'solder_mask_bridge'
  | 'via_aspect_ratio'
  | 'trace_clearance'
  | 'drill_to_pad';

export interface BgaDrcViolation {
  type: BgaDrcViolationType;
  severity: 'error' | 'warning';
  message: string;
  position: { x: number; y: number };
  actual: number;
  required: number;
}

export interface BgaDrcResult {
  pass: boolean;
  violations: BgaDrcViolation[];
  summary: string;
}

export interface PatternRecommendation {
  recommended: FanoutPattern;
  alternatives: FanoutPattern[];
  reason: string;
  feasibility: Record<FanoutPattern, boolean>;
}

// ---------------------------------------------------------------------------
// BGA Presets
// ---------------------------------------------------------------------------

export const BGA_PRESETS: Record<string, BgaPreset> = {
  'BGA-256-1.0': {
    name: 'BGA-256 (1.0mm pitch)',
    pitch: 1.0,
    ballDiameter: 0.5,
    rows: 16,
    cols: 16,
    ballCount: 256,
    description: 'Standard 1.0mm pitch BGA, 256 balls. Common for FPGAs and SoCs.',
  },
  'BGA-484-1.0': {
    name: 'BGA-484 (1.0mm pitch)',
    pitch: 1.0,
    ballDiameter: 0.5,
    rows: 22,
    cols: 22,
    ballCount: 484,
    description: 'Large 1.0mm pitch BGA, 484 balls. Used for mid-range FPGAs.',
  },
  'BGA-144-0.8': {
    name: 'BGA-144 (0.8mm pitch)',
    pitch: 0.8,
    ballDiameter: 0.4,
    rows: 12,
    cols: 12,
    ballCount: 144,
    description: 'Fine-pitch BGA, 144 balls. Common for MCUs and small FPGAs.',
  },
  'BGA-100-0.65': {
    name: 'BGA-100 (0.65mm pitch)',
    pitch: 0.65,
    ballDiameter: 0.35,
    rows: 10,
    cols: 10,
    ballCount: 100,
    description: 'Fine-pitch BGA, 100 balls. Requires micro-via or via-in-pad.',
  },
  'BGA-676-1.0': {
    name: 'BGA-676 (1.0mm pitch)',
    pitch: 1.0,
    ballDiameter: 0.5,
    rows: 26,
    cols: 26,
    ballCount: 676,
    description: 'Large BGA, 676 balls. High-pin-count FPGAs and processors.',
  },
  'BGA-324-0.5': {
    name: 'BGA-324 (0.5mm pitch)',
    pitch: 0.5,
    ballDiameter: 0.25,
    rows: 18,
    cols: 18,
    ballCount: 324,
    description: 'Ultra-fine-pitch BGA, 324 balls. Requires HDI technology.',
  },
};

// ---------------------------------------------------------------------------
// Default rules
// ---------------------------------------------------------------------------

export const DEFAULT_BGA_RULES: BgaFanoutRules = {
  minViaDrill: 0.3,
  minAnnularRing: 0.125,
  minTraceWidth: 0.127,
  minClearance: 0.127,
  minSolderMaskBridge: 0.075,
  minAntiPad: 0.7,
  allowViaInPad: false,
  allowMicroVia: false,
  maxViaAspectRatio: 8,
  boardThickness: 1.6,
  routingLayers: 4,
};

// ---------------------------------------------------------------------------
// Pattern recommendation
// ---------------------------------------------------------------------------

/**
 * Recommend the best fanout pattern based on BGA pitch and fab capabilities.
 */
export function recommendPattern(
  preset: BgaPreset,
  rules: BgaFanoutRules,
): PatternRecommendation {
  const viaOuter = rules.minViaDrill + 2 * rules.minAnnularRing;
  const antiPadNeeded = Math.max(rules.minAntiPad, viaOuter + 2 * rules.minClearance);

  // Can a dog-bone via fit between pads?
  // Dog-bone via is placed diagonally at pitch * sqrt(2) / 2 from pad center.
  // The diagonal center-to-center distance between four balls is pitch * sqrt(2).
  // Available space at the diagonal: pitch * sqrt(2) - ballDiameter
  const spaceBetweenBalls = preset.pitch - preset.ballDiameter;
  const diagonalSpace = preset.pitch * Math.SQRT2 - preset.ballDiameter;
  const dogBoneViaFits = viaOuter + 2 * rules.minClearance < diagonalSpace;

  // Can via-in-pad fit under the ball?
  const viaInPadFits = rules.allowViaInPad && viaOuter <= preset.ballDiameter;

  // Can escape channel route between balls?
  // Need trace + 2*clearance to fit in the space between ball rows
  const escapeChannelFits =
    rules.minTraceWidth + 2 * rules.minClearance < spaceBetweenBalls;

  // For micro-via: smaller drill available
  const microViaFeasible = rules.allowMicroVia && preset.pitch >= 0.4;

  const feasibility: Record<FanoutPattern, boolean> = {
    'dog-bone': dogBoneViaFits || microViaFeasible,
    'via-in-pad': viaInPadFits,
    'escape-channel': escapeChannelFits,
  };

  let recommended: FanoutPattern;
  let reason: string;
  const alternatives: FanoutPattern[] = [];

  if (preset.pitch >= 1.0 && dogBoneViaFits) {
    recommended = 'dog-bone';
    reason = `At ${preset.pitch}mm pitch, standard dog-bone fanout fits comfortably (${spaceBetweenBalls.toFixed(2)}mm between balls, via outer ${viaOuter.toFixed(2)}mm).`;
    if (escapeChannelFits) {
      alternatives.push('escape-channel');
    }
    if (viaInPadFits) {
      alternatives.push('via-in-pad');
    }
  } else if (viaInPadFits) {
    recommended = 'via-in-pad';
    reason = `Fine pitch ${preset.pitch}mm requires via-in-pad. Via outer ${viaOuter.toFixed(2)}mm fits under ${preset.ballDiameter}mm ball.`;
    if (escapeChannelFits) {
      alternatives.push('escape-channel');
    }
  } else if (escapeChannelFits) {
    recommended = 'escape-channel';
    reason = `Limited via capability at ${preset.pitch}mm pitch. Escape channels route between ball rows.`;
    if (microViaFeasible) {
      alternatives.push('dog-bone');
    }
  } else if (microViaFeasible) {
    recommended = 'dog-bone';
    reason = `Micro-via required for ${preset.pitch}mm pitch. Standard vias too large for dog-bone at this pitch.`;
  } else {
    recommended = 'escape-channel';
    reason = `Very tight pitch (${preset.pitch}mm). Only escape channel routing is feasible. Consider HDI technology for better results.`;
  }

  return { recommended, alternatives, reason, feasibility };
}

// ---------------------------------------------------------------------------
// Fanout generation
// ---------------------------------------------------------------------------

/**
 * Generate BGA fanout for the given preset and pattern.
 */
export function generateFanout(
  preset: BgaPreset,
  rules: BgaFanoutRules,
  pattern?: FanoutPattern,
): FanoutResult {
  const chosenPattern = pattern ?? recommendPattern(preset, rules).recommended;

  switch (chosenPattern) {
    case 'dog-bone':
      return generateDogBone(preset, rules);
    case 'via-in-pad':
      return generateViaInPad(preset, rules);
    case 'escape-channel':
      return generateEscapeChannel(preset, rules);
  }
}

/**
 * Generate dog-bone fanout.
 * Each ball gets a short trace to a via placed between ball rows.
 */
function generateDogBone(preset: BgaPreset, rules: BgaFanoutRules): FanoutResult {
  const vias: FanoutVia[] = [];
  const traces: FanoutTrace[] = [];
  const warnings: string[] = [];

  const viaOuter = rules.minViaDrill + 2 * rules.minAnnularRing;
  const halfPitch = preset.pitch / 2;

  // For depopulated center, track which balls exist
  const depop = preset.depopulatedCenter ?? 0;
  const centerStart = Math.floor((preset.rows - depop) / 2);
  const centerEnd = centerStart + depop;

  let escapedBalls = 0;
  let totalBalls = 0;

  // Determine how many outer rings can be routed per layer
  // Each ring of balls from outside-in gets routed on successive layers
  const maxRings = Math.floor(rules.routingLayers / 2) + 1;

  for (let row = 0; row < preset.rows; row++) {
    for (let col = 0; col < preset.cols; col++) {
      // Skip depopulated center
      if (
        depop > 0 &&
        row >= centerStart && row < centerEnd &&
        col >= centerStart && col < centerEnd
      ) {
        continue;
      }

      totalBalls++;

      // Ball center position (origin at BGA center)
      const bx = (col - (preset.cols - 1) / 2) * preset.pitch;
      const by = (row - (preset.rows - 1) / 2) * preset.pitch;

      // Ring number (0 = outermost)
      const ring = Math.min(row, col, preset.rows - 1 - row, preset.cols - 1 - col);

      if (ring >= maxRings) {
        // Cannot escape this ball — not enough layers
        continue;
      }

      // Via offset direction: away from center
      const cx = (col - (preset.cols - 1) / 2);
      const cy = (row - (preset.rows - 1) / 2);
      const mag = Math.sqrt(cx * cx + cy * cy);
      let dx = mag > 0 ? (cx / mag) * halfPitch : halfPitch;
      let dy = mag > 0 ? (cy / mag) * halfPitch : 0;

      // Snap to diagonal for corner balls
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
        dx = halfPitch;
        dy = 0;
      }

      const viaX = bx + dx;
      const viaY = by + dy;
      const netId = `ball_${String.fromCharCode(65 + row)}${col + 1}`;
      const layerName = ring <= 0 ? 'F.Cu' : `In${ring}.Cu`;

      const viaType: ViaType = rules.allowMicroVia && preset.pitch < 0.8 ? 'micro' : 'through';

      vias.push({
        id: `via_${row}_${col}`,
        position: { x: viaX, y: viaY },
        drillDiameter: rules.minViaDrill,
        outerDiameter: viaOuter,
        type: viaType,
        netId,
        padRow: row,
        padCol: col,
      });

      traces.push({
        id: `trace_${row}_${col}`,
        from: { x: bx, y: by },
        to: { x: viaX, y: viaY },
        width: rules.minTraceWidth,
        layer: layerName,
        netId,
      });

      escapedBalls++;
    }
  }

  if (escapedBalls < totalBalls) {
    warnings.push(
      `Only ${escapedBalls}/${totalBalls} balls escaped. ${totalBalls - escapedBalls} inner balls need more routing layers.`,
    );
  }

  // Compute layers used
  const maxRingUsed = Math.min(
    Math.floor(Math.max(preset.rows, preset.cols) / 2),
    maxRings - 1,
  );
  const layersUsed = Math.min(rules.routingLayers, (maxRingUsed + 1) * 2);

  return {
    pattern: 'dog-bone',
    vias,
    traces,
    escapedBalls,
    totalBalls,
    escapeRate: totalBalls > 0 ? escapedBalls / totalBalls : 0,
    layersUsed,
    warnings,
  };
}

/**
 * Generate via-in-pad fanout.
 * Each ball has a via directly under it.
 */
function generateViaInPad(preset: BgaPreset, rules: BgaFanoutRules): FanoutResult {
  const vias: FanoutVia[] = [];
  const traces: FanoutTrace[] = [];
  const warnings: string[] = [];

  const viaOuter = rules.minViaDrill + 2 * rules.minAnnularRing;

  if (viaOuter > preset.ballDiameter) {
    warnings.push(
      `Via outer diameter (${viaOuter.toFixed(3)}mm) exceeds ball diameter (${preset.ballDiameter}mm). Via-in-pad may not be feasible.`,
    );
  }

  const depop = preset.depopulatedCenter ?? 0;
  const centerStart = Math.floor((preset.rows - depop) / 2);
  const centerEnd = centerStart + depop;

  let totalBalls = 0;
  let escapedBalls = 0;

  for (let row = 0; row < preset.rows; row++) {
    for (let col = 0; col < preset.cols; col++) {
      if (
        depop > 0 &&
        row >= centerStart && row < centerEnd &&
        col >= centerStart && col < centerEnd
      ) {
        continue;
      }

      totalBalls++;

      const bx = (col - (preset.cols - 1) / 2) * preset.pitch;
      const by = (row - (preset.rows - 1) / 2) * preset.pitch;
      const netId = `ball_${String.fromCharCode(65 + row)}${col + 1}`;

      const viaType: ViaType = rules.allowMicroVia ? 'micro' : 'through';

      vias.push({
        id: `vip_${row}_${col}`,
        position: { x: bx, y: by },
        drillDiameter: rules.minViaDrill,
        outerDiameter: viaOuter,
        type: viaType,
        netId,
        padRow: row,
        padCol: col,
      });

      // Via-in-pad has zero-length trace (via is under the pad)
      // But we still create a trace entry for the escape on inner layers
      const ring = Math.min(row, col, preset.rows - 1 - row, preset.cols - 1 - col);
      const targetLayer = ring === 0 ? 'B.Cu' : `In${Math.min(ring, rules.routingLayers - 1)}.Cu`;

      // Escape trace on the target layer
      const escapeDir = col < preset.cols / 2 ? -1 : 1;
      const escapeX = bx + escapeDir * preset.pitch;

      traces.push({
        id: `escape_${row}_${col}`,
        from: { x: bx, y: by },
        to: { x: escapeX, y: by },
        width: rules.minTraceWidth,
        layer: targetLayer,
        netId,
      });

      escapedBalls++;
    }
  }

  return {
    pattern: 'via-in-pad',
    vias,
    traces,
    escapedBalls,
    totalBalls,
    escapeRate: totalBalls > 0 ? escapedBalls / totalBalls : 1,
    layersUsed: Math.min(rules.routingLayers, Math.ceil(Math.max(preset.rows, preset.cols) / 2) + 1),
    warnings,
  };
}

/**
 * Generate escape channel fanout.
 * Traces route between ball rows to escape without vias in the BGA field.
 */
function generateEscapeChannel(preset: BgaPreset, rules: BgaFanoutRules): FanoutResult {
  const vias: FanoutVia[] = [];
  const traces: FanoutTrace[] = [];
  const warnings: string[] = [];

  const spaceBetweenBalls = preset.pitch - preset.ballDiameter;
  const traceAndClearance = rules.minTraceWidth + 2 * rules.minClearance;

  // How many traces can fit between adjacent ball rows?
  const tracesPerChannel = Math.max(0, Math.floor(spaceBetweenBalls / traceAndClearance));

  if (tracesPerChannel === 0) {
    warnings.push(
      `No traces fit between ball rows (${spaceBetweenBalls.toFixed(3)}mm space, need ${traceAndClearance.toFixed(3)}mm). Consider via-in-pad or dog-bone.`,
    );
  }

  const depop = preset.depopulatedCenter ?? 0;
  const centerStart = Math.floor((preset.rows - depop) / 2);
  const centerEnd = centerStart + depop;

  let totalBalls = 0;
  let escapedBalls = 0;

  // Outer rings escape first through channels between rows
  const halfRows = Math.ceil(preset.rows / 2);

  for (let row = 0; row < preset.rows; row++) {
    for (let col = 0; col < preset.cols; col++) {
      if (
        depop > 0 &&
        row >= centerStart && row < centerEnd &&
        col >= centerStart && col < centerEnd
      ) {
        continue;
      }

      totalBalls++;

      const bx = (col - (preset.cols - 1) / 2) * preset.pitch;
      const by = (row - (preset.rows - 1) / 2) * preset.pitch;
      const netId = `ball_${String.fromCharCode(65 + row)}${col + 1}`;

      // Ring from the edge
      const ring = Math.min(row, col, preset.rows - 1 - row, preset.cols - 1 - col);

      // Can this ball's trace channel accommodate it?
      // Each ring needs to pass through (ring) channels
      // Each channel can carry (tracesPerChannel) traces
      const channelCapacity = tracesPerChannel * (ring + 1);
      const ballsInRing = ring < halfRows ? 1 : 0; // simplified

      if (channelCapacity <= 0 && ring > 0) {
        continue;
      }

      // Route trace from ball to the edge of the BGA
      const escapeDir = row < preset.rows / 2 ? -1 : 1;
      const edgeY = escapeDir * ((preset.rows / 2) * preset.pitch + preset.pitch);

      traces.push({
        id: `channel_${row}_${col}`,
        from: { x: bx, y: by },
        to: { x: bx, y: edgeY },
        width: rules.minTraceWidth,
        layer: 'F.Cu',
        netId,
      });

      // Via at the escape point
      const viaOuter = rules.minViaDrill + 2 * rules.minAnnularRing;
      vias.push({
        id: `esc_via_${row}_${col}`,
        position: { x: bx, y: edgeY },
        drillDiameter: rules.minViaDrill,
        outerDiameter: viaOuter,
        type: 'through',
        netId,
        padRow: row,
        padCol: col,
      });

      escapedBalls++;
    }
  }

  if (escapedBalls < totalBalls) {
    warnings.push(
      `Escape channel routing: ${escapedBalls}/${totalBalls} balls escaped. Remaining balls need via-in-pad or additional layers.`,
    );
  }

  return {
    pattern: 'escape-channel',
    vias,
    traces,
    escapedBalls,
    totalBalls,
    escapeRate: totalBalls > 0 ? escapedBalls / totalBalls : 0,
    layersUsed: 2, // escape channel primarily uses top + one inner
    warnings,
  };
}

// ---------------------------------------------------------------------------
// BGA DRC
// ---------------------------------------------------------------------------

/**
 * Run BGA-specific DRC checks on a fanout result.
 */
export function checkBgaDrc(
  fanout: FanoutResult,
  preset: BgaPreset,
  rules: BgaFanoutRules,
): BgaDrcResult {
  const violations: BgaDrcViolation[] = [];

  const viaOuter = rules.minViaDrill + 2 * rules.minAnnularRing;
  const antiPadNeeded = Math.max(rules.minAntiPad, viaOuter + 2 * rules.minClearance);

  // Check 1: Pitch vs via — can the via + anti-pad fit within the pitch?
  if (antiPadNeeded > preset.pitch) {
    violations.push({
      type: 'pitch_vs_via',
      severity: 'error',
      message: `Anti-pad diameter (${antiPadNeeded.toFixed(3)}mm) exceeds ball pitch (${preset.pitch}mm). Vias will short to adjacent pads.`,
      position: { x: 0, y: 0 },
      actual: antiPadNeeded,
      required: preset.pitch,
    });
  }

  // Check 2: Via aspect ratio
  const aspectRatio = rules.boardThickness / rules.minViaDrill;
  if (aspectRatio > rules.maxViaAspectRatio) {
    violations.push({
      type: 'via_aspect_ratio',
      severity: 'error',
      message: `Via aspect ratio ${aspectRatio.toFixed(1)}:1 exceeds maximum ${rules.maxViaAspectRatio}:1 (${rules.boardThickness}mm board, ${rules.minViaDrill}mm drill).`,
      position: { x: 0, y: 0 },
      actual: aspectRatio,
      required: rules.maxViaAspectRatio,
    });
  }

  // Check 3: Solder mask bridge between adjacent vias/pads
  for (let i = 0; i < fanout.vias.length; i++) {
    const via = fanout.vias[i];

    // Check against all ball pad positions
    for (let row = 0; row < preset.rows; row++) {
      for (let col = 0; col < preset.cols; col++) {
        const bx = (col - (preset.cols - 1) / 2) * preset.pitch;
        const by = (row - (preset.rows - 1) / 2) * preset.pitch;

        // Skip if this is the via's own pad
        if (via.padRow === row && via.padCol === col) {
          continue;
        }

        const dx = via.position.x - bx;
        const dy = via.position.y - by;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Distance from via edge to pad edge
        const edgeDist = dist - viaOuter / 2 - preset.ballDiameter / 2;
        if (edgeDist < rules.minSolderMaskBridge && edgeDist >= 0) {
          violations.push({
            type: 'solder_mask_bridge',
            severity: 'warning',
            message: `Solder mask bridge ${edgeDist.toFixed(3)}mm between via ${via.id} and pad ${String.fromCharCode(65 + row)}${col + 1} is below minimum ${rules.minSolderMaskBridge}mm.`,
            position: via.position,
            actual: edgeDist,
            required: rules.minSolderMaskBridge,
          });
          // Only report first violation per via to avoid flooding
          break;
        }
      }
      // Early exit if we already found a violation for this via
      if (violations.length > 0 && violations[violations.length - 1].message.includes(via.id)) {
        break;
      }
    }
  }

  // Check 4: Anti-pad overlap between adjacent vias
  let antiPadViolationCount = 0;
  for (let i = 0; i < fanout.vias.length && antiPadViolationCount < 20; i++) {
    for (let j = i + 1; j < fanout.vias.length && antiPadViolationCount < 20; j++) {
      const va = fanout.vias[i];
      const vb = fanout.vias[j];

      const dx = va.position.x - vb.position.x;
      const dy = va.position.y - vb.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Anti-pad clearance: center-to-center must be > antiPad
      if (dist < antiPadNeeded && dist > 0) {
        violations.push({
          type: 'anti_pad_overlap',
          severity: 'error',
          message: `Anti-pad overlap between ${va.id} and ${vb.id}: distance ${dist.toFixed(3)}mm < required ${antiPadNeeded.toFixed(3)}mm.`,
          position: {
            x: (va.position.x + vb.position.x) / 2,
            y: (va.position.y + vb.position.y) / 2,
          },
          actual: dist,
          required: antiPadNeeded,
        });
        antiPadViolationCount++;
      }
    }
  }

  // Check 5: Trace clearance to pads
  for (const trace of fanout.traces) {
    for (let row = 0; row < preset.rows; row++) {
      for (let col = 0; col < preset.cols; col++) {
        const bx = (col - (preset.cols - 1) / 2) * preset.pitch;
        const by = (row - (preset.rows - 1) / 2) * preset.pitch;

        // Point-to-segment distance (simplified: midpoint of trace to pad)
        const mx = (trace.from.x + trace.to.x) / 2;
        const my = (trace.from.y + trace.to.y) / 2;
        const dx = mx - bx;
        const dy = my - by;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const clearance = dist - preset.ballDiameter / 2 - trace.width / 2;

        // Skip own pad (trace starts there)
        const isOwnPad =
          Math.abs(trace.from.x - bx) < 0.01 &&
          Math.abs(trace.from.y - by) < 0.01;
        if (isOwnPad) {
          continue;
        }

        if (clearance < rules.minClearance && clearance >= 0 && dist < preset.pitch * 1.5) {
          violations.push({
            type: 'trace_clearance',
            severity: 'warning',
            message: `Trace ${trace.id} clearance to pad ${String.fromCharCode(65 + row)}${col + 1}: ${clearance.toFixed(3)}mm < minimum ${rules.minClearance}mm.`,
            position: { x: mx, y: my },
            actual: clearance,
            required: rules.minClearance,
          });
          break; // one violation per trace is enough
        }
      }
    }
    // Cap trace violations
    if (violations.filter((v) => v.type === 'trace_clearance').length >= 10) {
      break;
    }
  }

  // Check 6: Drill-to-pad clearance
  for (const via of fanout.vias) {
    for (let row = 0; row < preset.rows; row++) {
      for (let col = 0; col < preset.cols; col++) {
        if (via.padRow === row && via.padCol === col) {
          continue;
        }

        const bx = (col - (preset.cols - 1) / 2) * preset.pitch;
        const by = (row - (preset.rows - 1) / 2) * preset.pitch;
        const dx = via.position.x - bx;
        const dy = via.position.y - by;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const drillToPad = dist - rules.minViaDrill / 2 - preset.ballDiameter / 2;

        if (drillToPad < rules.minClearance && drillToPad >= 0 && dist < preset.pitch * 1.5) {
          violations.push({
            type: 'drill_to_pad',
            severity: 'warning',
            message: `Drill-to-pad clearance ${drillToPad.toFixed(3)}mm between ${via.id} and pad ${String.fromCharCode(65 + row)}${col + 1} is below minimum ${rules.minClearance}mm.`,
            position: via.position,
            actual: drillToPad,
            required: rules.minClearance,
          });
          break;
        }
      }
    }
    if (violations.filter((v) => v.type === 'drill_to_pad').length >= 10) {
      break;
    }
  }

  const errorCount = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;

  return {
    pass: errorCount === 0,
    violations,
    summary: errorCount > 0
      ? `FAIL: ${errorCount} error(s), ${warningCount} warning(s)`
      : warningCount > 0
        ? `PASS with ${warningCount} warning(s)`
        : 'PASS: No DRC violations',
  };
}

// ---------------------------------------------------------------------------
// Utility: Ball position helper
// ---------------------------------------------------------------------------

/**
 * Get all ball positions for a BGA preset.
 */
export function getBallPositions(
  preset: BgaPreset,
): Array<{ row: number; col: number; x: number; y: number; name: string }> {
  const positions: Array<{ row: number; col: number; x: number; y: number; name: string }> = [];

  const depop = preset.depopulatedCenter ?? 0;
  const centerStart = Math.floor((preset.rows - depop) / 2);
  const centerEnd = centerStart + depop;

  for (let row = 0; row < preset.rows; row++) {
    for (let col = 0; col < preset.cols; col++) {
      if (
        depop > 0 &&
        row >= centerStart && row < centerEnd &&
        col >= centerStart && col < centerEnd
      ) {
        continue;
      }

      positions.push({
        row,
        col,
        x: (col - (preset.cols - 1) / 2) * preset.pitch,
        y: (row - (preset.rows - 1) / 2) * preset.pitch,
        name: `${String.fromCharCode(65 + row)}${col + 1}`,
      });
    }
  }

  return positions;
}
