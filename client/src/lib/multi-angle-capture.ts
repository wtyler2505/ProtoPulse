/**
 * Multi-Angle Capture Engine for Component Identification
 *
 * When the AI-powered component identification returns a low-confidence result,
 * this module suggests additional photo angles to capture for improved accuracy.
 * Different component types benefit from different viewing angles — ICs need
 * markings/top views, connectors need side/pin views, passives need value
 * markings, etc.
 *
 * Core workflow:
 *   1. AI identifies a component with confidence < 0.7
 *   2. suggestAdditionalAngles() recommends which angles to photograph next
 *   3. User captures additional images via MultiAngleCaptureDialog
 *   4. mergeMultiAngleResults() combines multiple identification results
 *      into a single, higher-confidence composite result
 *
 * Usage:
 *   const suggestions = suggestAdditionalAngles(result, 'ic');
 *   // ... user captures additional photos ...
 *   const merged = mergeMultiAngleResults(results);
 */

import type { ComponentIdResult } from '@/components/panels/CameraComponentId';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The set of meaningful angles for photographing electronic components. */
export type PhotoAngle = 'top' | 'side' | 'bottom' | 'markings' | 'pins';

/** A request for the user to capture a photo from a specific angle. */
export interface PhotoAngleRequest {
  /** Which angle to photograph. */
  angle: PhotoAngle;
  /** Human-readable instruction for the user. */
  instruction: string;
  /** Why this angle would help identification. */
  reason: string;
  /** Priority: lower = more important. */
  priority: number;
}

/** An identification result paired with the angle it was captured from. */
export interface AngleResult {
  /** The angle the photo was taken from. */
  angle: PhotoAngle;
  /** The base64 image data URL. */
  imageData: string;
  /** The identification result from the AI, or null if not yet analyzed. */
  result: ComponentIdResult | null;
}

/** Normalized component category for angle recommendation logic. */
export type ComponentCategory =
  | 'ic'
  | 'passive'
  | 'connector'
  | 'electromechanical'
  | 'discrete'
  | 'module'
  | 'unknown';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Confidence threshold below which multi-angle capture is recommended. */
export const LOW_CONFIDENCE_THRESHOLD = 0.7;

/** Human-readable labels for each photo angle. */
export const ANGLE_LABELS: Record<PhotoAngle, string> = {
  top: 'Top View',
  side: 'Side View',
  bottom: 'Bottom View',
  markings: 'Markings / Labels',
  pins: 'Pin / Lead View',
};

/** Descriptions explaining what each angle reveals. */
export const ANGLE_DESCRIPTIONS: Record<PhotoAngle, string> = {
  top: 'Shows the component body, package outline, and top markings.',
  side: 'Reveals the package height, form factor, and pin/lead style.',
  bottom: 'Exposes solder pads, thermal pads, and bottom markings.',
  markings: 'Close-up of text markings, part numbers, date codes, and logos.',
  pins: 'Detailed view of pin count, pitch, and lead configuration.',
};

/**
 * Per-category angle recommendations. Priority is lower = more important.
 * Each category lists the angles most useful for identification, with
 * tailored instructions and reasons.
 */
const CATEGORY_ANGLE_CONFIGS: Record<ComponentCategory, PhotoAngleRequest[]> = {
  ic: [
    {
      angle: 'markings',
      instruction: 'Capture a close-up of the text markings on the top of the IC. Include the full part number, manufacturer logo, and date code.',
      reason: 'IC part numbers printed on the package are the most reliable way to identify the exact chip.',
      priority: 1,
    },
    {
      angle: 'top',
      instruction: 'Photograph the IC from directly above, showing the full package outline and pin 1 indicator.',
      reason: 'The package shape and pin 1 marker help determine the package type (QFP, QFN, SOIC, DIP, etc.).',
      priority: 2,
    },
    {
      angle: 'pins',
      instruction: 'Capture the pins/leads from the side at a slight angle, showing the pin count and pitch.',
      reason: 'Pin count and pitch narrow down the specific package variant.',
      priority: 3,
    },
    {
      angle: 'side',
      instruction: 'Take a side profile showing the package height and lead style.',
      reason: 'Package height distinguishes between standard and low-profile variants.',
      priority: 4,
    },
    {
      angle: 'bottom',
      instruction: 'If accessible, photograph the bottom for exposed pads or additional markings.',
      reason: 'Some ICs have thermal pads or secondary markings on the underside.',
      priority: 5,
    },
  ],
  passive: [
    {
      angle: 'markings',
      instruction: 'Capture the value markings — color bands for resistors, printed values for capacitors, or inductance codes.',
      reason: 'Value markings are essential for identifying passive component ratings.',
      priority: 1,
    },
    {
      angle: 'top',
      instruction: 'Photograph the component from above showing its full body.',
      reason: 'Body size helps determine the power rating and package size code (0402, 0603, 0805, etc.).',
      priority: 2,
    },
    {
      angle: 'side',
      instruction: 'Capture a side view showing the component height and terminal style.',
      reason: 'Height and terminal shape distinguish between different passive types and series.',
      priority: 3,
    },
  ],
  connector: [
    {
      angle: 'pins',
      instruction: 'Photograph the pin/contact side showing pin count, arrangement, and pitch.',
      reason: 'Pin configuration is the primary identifier for connector types.',
      priority: 1,
    },
    {
      angle: 'side',
      instruction: 'Capture a side profile showing the connector height and mating mechanism.',
      reason: 'Profile shape identifies the connector family (JST, Molex, header, etc.).',
      priority: 2,
    },
    {
      angle: 'top',
      instruction: 'Photograph from above showing the housing shape and any keying features.',
      reason: 'Housing shape and keying help narrow the specific connector series.',
      priority: 3,
    },
    {
      angle: 'markings',
      instruction: 'Look for any part numbers or manufacturer logos molded into the housing.',
      reason: 'Molded markings directly identify the manufacturer and part series.',
      priority: 4,
    },
  ],
  electromechanical: [
    {
      angle: 'top',
      instruction: 'Photograph from above showing the full component footprint.',
      reason: 'Overall shape identifies the component type (relay, switch, potentiometer, etc.).',
      priority: 1,
    },
    {
      angle: 'side',
      instruction: 'Capture a side profile showing the mechanism and actuator.',
      reason: 'The mechanical profile reveals the operating mechanism and mounting style.',
      priority: 2,
    },
    {
      angle: 'markings',
      instruction: 'Look for part numbers, ratings, or certification marks.',
      reason: 'Electromechanical components often have voltage/current ratings printed on them.',
      priority: 3,
    },
    {
      angle: 'pins',
      instruction: 'Photograph the terminal/pin side showing the contact arrangement.',
      reason: 'Terminal layout determines the circuit configuration (SPST, DPDT, etc.).',
      priority: 4,
    },
    {
      angle: 'bottom',
      instruction: 'If accessible, photograph the bottom showing the mounting footprint.',
      reason: 'Mounting footprint helps match the exact part for PCB layout.',
      priority: 5,
    },
  ],
  discrete: [
    {
      angle: 'markings',
      instruction: 'Capture any markings — SMD codes, color bands, or printed text on the body.',
      reason: 'Discrete semiconductors use SMD marking codes that identify the exact part.',
      priority: 1,
    },
    {
      angle: 'side',
      instruction: 'Photograph the component in profile showing the package shape and lead configuration.',
      reason: 'Package shape (SOT-23, TO-220, DO-214, etc.) narrows the component family.',
      priority: 2,
    },
    {
      angle: 'pins',
      instruction: 'Capture the leads/pins showing count and arrangement.',
      reason: 'Pin count distinguishes between diodes (2-pin), transistors (3-pin), and MOSFETs (3+ pin).',
      priority: 3,
    },
    {
      angle: 'top',
      instruction: 'Photograph from above showing the full component body.',
      reason: 'Top view reveals the package dimensions and any polarity markings.',
      priority: 4,
    },
  ],
  module: [
    {
      angle: 'top',
      instruction: 'Photograph from above showing the full module layout and any visible sub-components.',
      reason: 'Module layout and visible ICs help identify the module type and capabilities.',
      priority: 1,
    },
    {
      angle: 'markings',
      instruction: 'Capture all text labels, part numbers, FCC IDs, or certification marks.',
      reason: 'Module markings and FCC IDs can be looked up to identify the exact module.',
      priority: 2,
    },
    {
      angle: 'pins',
      instruction: 'Photograph the pin header or castellated edge connections.',
      reason: 'Pin count and arrangement identify the module pinout and interface.',
      priority: 3,
    },
    {
      angle: 'side',
      instruction: 'Capture a side profile showing the module height and any shielding.',
      reason: 'Profile reveals whether the module has RF shielding, heatsinks, or stacked components.',
      priority: 4,
    },
    {
      angle: 'bottom',
      instruction: 'If accessible, photograph the bottom for antenna traces or additional components.',
      reason: 'Bottom components and antenna patterns help identify wireless modules.',
      priority: 5,
    },
  ],
  unknown: [
    {
      angle: 'top',
      instruction: 'Photograph the component from directly above showing the full body.',
      reason: 'A clear top view is the best starting point for identifying any unknown component.',
      priority: 1,
    },
    {
      angle: 'markings',
      instruction: 'Capture any visible text, numbers, symbols, or color codes on the component.',
      reason: 'Any readable markings dramatically improve identification accuracy.',
      priority: 2,
    },
    {
      angle: 'side',
      instruction: 'Take a side profile showing the component height and form factor.',
      reason: 'Side profile helps classify the component type and package family.',
      priority: 3,
    },
    {
      angle: 'pins',
      instruction: 'Photograph the pins, leads, or terminals.',
      reason: 'Pin/lead configuration helps distinguish between component families.',
      priority: 4,
    },
    {
      angle: 'bottom',
      instruction: 'If accessible, photograph the bottom of the component.',
      reason: 'Bottom view may reveal hidden markings, pads, or thermal features.',
      priority: 5,
    },
  ],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a confidence level string from ComponentIdResult to a numeric score.
 * 'high' = 0.9, 'medium' = 0.6, 'low' = 0.3
 */
export function confidenceToNumeric(confidence: ComponentIdResult['confidence']): number {
  switch (confidence) {
    case 'high':
      return 0.9;
    case 'medium':
      return 0.6;
    case 'low':
      return 0.3;
  }
}

/**
 * Map a numeric confidence score to the closest ComponentIdResult confidence level.
 */
export function numericToConfidence(score: number): ComponentIdResult['confidence'] {
  if (score >= 0.75) {
    return 'high';
  }
  if (score >= 0.45) {
    return 'medium';
  }
  return 'low';
}

/**
 * Normalize a free-form component type string into a ComponentCategory
 * for angle recommendation lookup.
 */
export function categorizeComponentType(componentType: string): ComponentCategory {
  const lower = componentType.toLowerCase();

  // IC / microcontroller / processor / FPGA / memory
  if (
    lower.includes('ic') ||
    lower.includes('microcontroller') ||
    lower.includes('mcu') ||
    lower.includes('processor') ||
    lower.includes('cpu') ||
    lower.includes('fpga') ||
    lower.includes('memory') ||
    lower.includes('eeprom') ||
    lower.includes('flash') ||
    lower.includes('op-amp') ||
    lower.includes('opamp') ||
    lower.includes('amplifier') ||
    lower.includes('regulator') ||
    lower.includes('driver') ||
    lower.includes('sensor') ||
    lower.includes('adc') ||
    lower.includes('dac') ||
    lower.includes('timer') ||
    lower.includes('uart') ||
    lower.includes('spi') ||
    lower.includes('i2c') ||
    lower.includes('chip')
  ) {
    return 'ic';
  }

  // Passive components
  if (
    lower.includes('resistor') ||
    lower.includes('capacitor') ||
    lower.includes('inductor') ||
    lower.includes('ferrite') ||
    lower.includes('fuse') ||
    lower.includes('thermistor') ||
    lower.includes('varistor') ||
    lower.includes('crystal') ||
    lower.includes('oscillator')
  ) {
    return 'passive';
  }

  // Connectors
  if (
    lower.includes('connector') ||
    lower.includes('header') ||
    lower.includes('socket') ||
    lower.includes('jack') ||
    lower.includes('plug') ||
    lower.includes('terminal') ||
    lower.includes('usb') ||
    lower.includes('hdmi') ||
    lower.includes('rj45') ||
    lower.includes('barrel')
  ) {
    return 'connector';
  }

  // Electromechanical
  if (
    lower.includes('relay') ||
    lower.includes('switch') ||
    lower.includes('button') ||
    lower.includes('potentiometer') ||
    lower.includes('encoder') ||
    lower.includes('motor') ||
    lower.includes('buzzer') ||
    lower.includes('speaker') ||
    lower.includes('solenoid')
  ) {
    return 'electromechanical';
  }

  // Discrete semiconductors
  if (
    lower.includes('diode') ||
    lower.includes('led') ||
    lower.includes('transistor') ||
    lower.includes('mosfet') ||
    lower.includes('bjt') ||
    lower.includes('scr') ||
    lower.includes('triac') ||
    lower.includes('zener') ||
    lower.includes('schottky') ||
    lower.includes('rectifier')
  ) {
    return 'discrete';
  }

  // Modules
  if (
    lower.includes('module') ||
    lower.includes('board') ||
    lower.includes('breakout') ||
    lower.includes('shield') ||
    lower.includes('hat') ||
    lower.includes('arduino') ||
    lower.includes('esp32') ||
    lower.includes('esp8266') ||
    lower.includes('raspberry')
  ) {
    return 'module';
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Determine whether a component identification result should trigger
 * a multi-angle capture prompt.
 *
 * Returns true when confidence is below LOW_CONFIDENCE_THRESHOLD.
 */
export function shouldRequestMultiAngle(result: ComponentIdResult): boolean {
  return confidenceToNumeric(result.confidence) < LOW_CONFIDENCE_THRESHOLD;
}

/**
 * Suggest additional photo angles based on the initial identification result
 * and component category. Filters out the angle that was already captured
 * (if known) and returns sorted by priority.
 *
 * @param result - The initial AI identification result
 * @param componentType - Free-form component type string (from result or user input)
 * @param alreadyCapturedAngles - Angles the user has already photographed
 * @returns Sorted array of PhotoAngleRequest suggestions
 */
export function suggestAdditionalAngles(
  result: ComponentIdResult,
  componentType?: string,
  alreadyCapturedAngles: PhotoAngle[] = [],
): PhotoAngleRequest[] {
  const category = categorizeComponentType(
    componentType ?? result.componentType,
  );
  const configs = CATEGORY_ANGLE_CONFIGS[category];
  const confidence = confidenceToNumeric(result.confidence);

  // Filter out already-captured angles
  const remaining = configs.filter(
    (c) => !alreadyCapturedAngles.includes(c.angle),
  );

  // If confidence is very low, return more suggestions (up to all remaining)
  // If confidence is medium-low, return fewer
  const maxSuggestions = confidence <= 0.3 ? remaining.length : Math.min(3, remaining.length);

  return remaining
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxSuggestions);
}

/**
 * Merge multiple identification results from different angles into a single
 * composite result. Uses a weighted confidence approach where higher-confidence
 * results have more influence on the final merged output.
 *
 * Strategy:
 * - componentType: highest-confidence result's type
 * - packageType: highest-confidence result's package
 * - partNumber: first non-null from highest to lowest confidence
 * - manufacturer: first non-null from highest to lowest confidence
 * - pinCount: most common non-null value, or highest-confidence
 * - confidence: boosted composite (cannot exceed 'high')
 * - description: concatenated unique descriptions
 * - specifications: union of all unique specs
 * - suggestedBom: from highest-confidence result that has one
 * - notes: concatenated unique notes
 *
 * @param results - Array of AngleResult objects with non-null results
 * @returns A merged ComponentIdResult, or null if no valid results provided
 */
export function mergeMultiAngleResults(
  results: AngleResult[],
): ComponentIdResult | null {
  // Filter to only results that have identification data
  const validResults = results.filter(
    (r): r is AngleResult & { result: ComponentIdResult } => r.result !== null,
  );

  if (validResults.length === 0) {
    return null;
  }

  if (validResults.length === 1) {
    return { ...validResults[0].result };
  }

  // Sort by confidence descending
  const sorted = [...validResults].sort(
    (a, b) =>
      confidenceToNumeric(b.result.confidence) -
      confidenceToNumeric(a.result.confidence),
  );

  const best = sorted[0].result;

  // Merge partNumber: first non-null from sorted
  const partNumber =
    sorted.find((r) => r.result.partNumber !== null)?.result.partNumber ?? null;

  // Merge manufacturer: first non-null from sorted
  const manufacturer =
    sorted.find((r) => r.result.manufacturer !== null)?.result.manufacturer ?? null;

  // Merge pinCount: most common non-null, fallback to best
  const pinCounts = sorted
    .map((r) => r.result.pinCount)
    .filter((p): p is number => p !== null);
  let mergedPinCount: number | null = best.pinCount;
  if (pinCounts.length > 0) {
    const freq = new Map<number, number>();
    for (const pc of pinCounts) {
      freq.set(pc, (freq.get(pc) ?? 0) + 1);
    }
    let maxFreq = 0;
    for (const [pc, count] of Array.from(freq.entries())) {
      if (count > maxFreq) {
        maxFreq = count;
        mergedPinCount = pc;
      }
    }
  }

  // Merge specifications: union of unique specs
  const allSpecs = new Set<string>();
  for (const r of sorted) {
    for (const spec of r.result.specifications) {
      allSpecs.add(spec);
    }
  }

  // Merge descriptions: unique non-empty descriptions joined
  const uniqueDescriptions = new Set<string>();
  for (const r of sorted) {
    if (r.result.description.trim()) {
      uniqueDescriptions.add(r.result.description.trim());
    }
  }
  const mergedDescription = Array.from(uniqueDescriptions).join(' | ');

  // Merge notes: unique non-empty notes joined
  const uniqueNotes = new Set<string>();
  for (const r of sorted) {
    if (r.result.notes?.trim()) {
      uniqueNotes.add(r.result.notes.trim());
    }
  }
  const mergedNotes = uniqueNotes.size > 0
    ? Array.from(uniqueNotes).join(' | ')
    : null;

  // Merge suggestedBom: from best result that has one
  const suggestedBom =
    sorted.find((r) => r.result.suggestedBom !== null)?.result.suggestedBom ?? null;

  // Compute boosted confidence: base confidence + boost from additional angles
  // Each additional result adds a diminishing boost
  const baseConfidence = confidenceToNumeric(best.confidence);
  let boost = 0;
  for (let i = 1; i < sorted.length; i++) {
    const additionalConfidence = confidenceToNumeric(sorted[i].result.confidence);
    // Each additional result contributes a diminishing fraction
    boost += additionalConfidence * (0.15 / i);
  }
  const finalScore = Math.min(0.95, baseConfidence + boost);

  return {
    componentType: best.componentType,
    packageType: best.packageType,
    partNumber,
    manufacturer,
    pinCount: mergedPinCount,
    confidence: numericToConfidence(finalScore),
    description: mergedDescription,
    specifications: Array.from(allSpecs),
    suggestedBom,
    notes: mergedNotes,
  };
}

/**
 * Get all possible photo angles for display purposes.
 */
export function getAllAngles(): PhotoAngle[] {
  return ['top', 'side', 'bottom', 'markings', 'pins'];
}

/**
 * Get the label and description for a specific angle.
 */
export function getAngleInfo(angle: PhotoAngle): { label: string; description: string } {
  return {
    label: ANGLE_LABELS[angle],
    description: ANGLE_DESCRIPTIONS[angle],
  };
}
