/**
 * Simulation Auto-Detection (BL-0620)
 *
 * Analyzes circuit instances to automatically determine the most appropriate
 * simulation analysis type based on the components present in the circuit.
 *
 * Detection heuristic:
 *   1. If AC sources are present (VAC, sine waves) → AC analysis
 *   2. If transient/pulse sources are present → Transient analysis
 *   3. Otherwise → DC operating point
 */

export type AnalysisType = 'dcop' | 'transient' | 'ac' | 'dcsweep';

export type SimulationType = 'dc' | 'ac' | 'transient' | 'mixed';

export interface AutoDetectResult {
  /** The recommended analysis type. */
  recommended: AnalysisType;
  /** Human-readable reason for the recommendation. */
  reason: string;
  /** Whether AC sources were detected. */
  hasACSources: boolean;
  /** Whether transient/pulse sources were detected. */
  hasTransientSources: boolean;
  /** Whether DC sources were detected. */
  hasDCSources: boolean;
}

/** Result of higher-level simulation type detection with confidence scoring. */
export interface SimulationTypeResult {
  /** The detected simulation type category. */
  type: SimulationType;
  /** Confidence level from 0.0 to 1.0. */
  confidence: number;
  /** Human-readable reason for the detection. */
  reason: string;
}

/** Minimal shape of a circuit instance for auto-detection. */
export interface CircuitInstanceForDetection {
  referenceDesignator: string;
  componentType: string;
  properties?: Record<string, unknown> | null;
}

/** Minimal shape of a circuit net for detection (optional enrichment). */
export interface CircuitNetForDetection {
  name: string;
  connectedPins?: string[];
}

/**
 * Extract all component type strings from a circuit instance, checking both
 * top-level componentType and properties.componentType. Returns both so
 * detection can match against either.
 */
function getComponentTypes(instance: CircuitInstanceForDetection): string[] {
  const types: string[] = [];
  if (instance.componentType) {
    types.push(instance.componentType);
  }
  if (instance.properties && typeof instance.properties === 'object') {
    const fromProps = String((instance.properties as Record<string, unknown>).componentType ?? '');
    if (fromProps) {
      types.push(fromProps);
    }
  }
  return types;
}

/**
 * Extract source characteristics from instance properties.
 */
function getSourceType(instance: CircuitInstanceForDetection): string {
  if (!instance.properties || typeof instance.properties !== 'object') {
    return '';
  }
  const props = instance.properties as Record<string, unknown>;
  return String(props.sourceType ?? props.waveform ?? props.signalType ?? '');
}

/**
 * Check whether a component is frequency-dependent (capacitor, inductor, transformer).
 */
function isFrequencyDependent(instance: CircuitInstanceForDetection): boolean {
  const refDes = instance.referenceDesignator.toUpperCase();
  const compTypes = getComponentTypes(instance).map((t) => t.toLowerCase());
  const compTypesJoined = compTypes.join(' ');

  return (
    /^[CLK]/.test(refDes) ||
    /capacitor|inductor|transformer|coil|choke|ferrite/.test(compTypesJoined)
  );
}

/**
 * Check whether a component implies time-varying behavior (switch, relay, PWM).
 */
function isTimeVarying(instance: CircuitInstanceForDetection): boolean {
  const compTypes = getComponentTypes(instance).map((t) => t.toLowerCase());
  const compTypesJoined = compTypes.join(' ');

  return /switch|relay|pwm|timer|oscillator|555/.test(compTypesJoined);
}

/**
 * Detect the most appropriate analysis type from circuit instances.
 */
export function autoDetectAnalysisType(
  instances: CircuitInstanceForDetection[],
): AutoDetectResult {
  let hasACSources = false;
  let hasTransientSources = false;
  let hasDCSources = false;

  for (const inst of instances) {
    const refDes = inst.referenceDesignator.toUpperCase();
    const compTypes = getComponentTypes(inst).map((t) => t.toLowerCase());
    const compTypesJoined = compTypes.join(' ');
    const sourceType = getSourceType(inst).toLowerCase();

    // Check if this is a source component
    const isSource =
      /^[VI]/.test(refDes) ||
      compTypes.some((ct) =>
        /voltage.source|current.source|dc.source|ac.source|signal.source|function.generator/.test(ct),
      );

    if (!isSource) {
      continue;
    }

    // Classify the source type — check ALL component type strings
    const isAC =
      /ac|sine|sinusoidal/.test(compTypesJoined) ||
      /ac|sine|sinusoidal/.test(sourceType) ||
      /^vac|^iac/.test(refDes);

    const isTransient =
      /pulse|pwl|square|triangle|sawtooth|step|ramp|exponential/.test(compTypesJoined) ||
      /pulse|pwl|square|triangle|sawtooth|step|ramp|exponential/.test(sourceType);

    if (isAC) {
      hasACSources = true;
    } else if (isTransient) {
      hasTransientSources = true;
    } else {
      hasDCSources = true;
    }
  }

  // Priority: AC > Transient > DC
  if (hasACSources) {
    return {
      recommended: 'ac',
      reason: 'AC sources detected — frequency-domain analysis recommended',
      hasACSources,
      hasTransientSources,
      hasDCSources,
    };
  }

  if (hasTransientSources) {
    return {
      recommended: 'transient',
      reason: 'Pulse/time-varying sources detected — transient analysis recommended',
      hasACSources,
      hasTransientSources,
      hasDCSources,
    };
  }

  return {
    recommended: 'dcop',
    reason: hasDCSources
      ? 'Only DC sources detected — DC operating point analysis recommended'
      : 'No sources detected — defaulting to DC operating point',
    hasACSources,
    hasTransientSources,
    hasDCSources,
  };
}

/**
 * Detect the simulation type category with a confidence score.
 *
 * Uses circuit topology analysis to classify:
 * - DC: resistor networks with DC voltage/current sources only
 * - AC: AC sources present or frequency-dependent components dominate
 * - Transient: switches, time-varying elements, PWM sources, pulse waveforms
 * - Mixed: multiple signal types detected (low confidence — user should choose)
 *
 * @param instances - Circuit component instances
 * @param nets - Optional circuit nets for enriched analysis
 */
export function detectSimulationType(
  instances: CircuitInstanceForDetection[],
  nets?: CircuitNetForDetection[],
): SimulationTypeResult {
  if (instances.length === 0) {
    return {
      type: 'dc',
      confidence: 0.5,
      reason: 'Empty circuit — defaulting to DC analysis',
    };
  }

  // Run the existing source detection
  const baseResult = autoDetectAnalysisType(instances);

  // Count frequency-dependent and time-varying components
  let freqDepCount = 0;
  let timeVaryCount = 0;
  let passiveCount = 0;
  let sourceCount = 0;

  for (const inst of instances) {
    const refDes = inst.referenceDesignator.toUpperCase();
    const compTypes = getComponentTypes(inst).map((t) => t.toLowerCase());

    const isSource =
      /^[VI]/.test(refDes) ||
      compTypes.some((ct) =>
        /voltage.source|current.source|dc.source|ac.source|signal.source|function.generator/.test(ct),
      );

    if (isSource) {
      sourceCount++;
    } else {
      passiveCount++;
      if (isFrequencyDependent(inst)) {
        freqDepCount++;
      }
      if (isTimeVarying(inst)) {
        timeVaryCount++;
      }
    }
  }

  // Count how many distinct signal domains are present
  const domains: SimulationType[] = [];
  if (baseResult.hasDCSources) {
    domains.push('dc');
  }
  if (baseResult.hasACSources) {
    domains.push('ac');
  }
  if (baseResult.hasTransientSources || timeVaryCount > 0) {
    domains.push('transient');
  }

  // Net connectivity can refine confidence — more nets = more complex topology
  const netComplexity = nets ? Math.min(nets.length / 10, 1) : 0;

  // Mixed: multiple signal domains present
  if (domains.length > 1) {
    // If one domain clearly dominates, give it moderate confidence
    if (baseResult.hasACSources && !baseResult.hasTransientSources && timeVaryCount === 0) {
      return {
        type: 'ac',
        confidence: 0.6,
        reason: 'AC sources present alongside DC — AC analysis recommended but mixed signals detected',
      };
    }
    if (baseResult.hasTransientSources && !baseResult.hasACSources) {
      return {
        type: 'transient',
        confidence: 0.6,
        reason: 'Transient sources present alongside DC — transient analysis recommended but mixed signals detected',
      };
    }

    return {
      type: 'mixed',
      confidence: 0.4,
      reason: `Multiple signal types detected (${domains.join(', ')}) — choose analysis type manually`,
    };
  }

  // Single domain or no sources — high confidence
  if (baseResult.hasACSources) {
    const confidence = freqDepCount > 0 ? 0.95 : 0.85;
    return {
      type: 'ac',
      confidence: Math.min(confidence + netComplexity * 0.05, 1.0),
      reason: freqDepCount > 0
        ? 'AC sources with frequency-dependent components — AC analysis strongly recommended'
        : 'AC sources detected — frequency-domain analysis recommended',
    };
  }

  if (baseResult.hasTransientSources || timeVaryCount > 0) {
    const hasTransientSource = baseResult.hasTransientSources;
    const confidence = hasTransientSource && timeVaryCount > 0 ? 0.95 : hasTransientSource ? 0.9 : 0.8;
    return {
      type: 'transient',
      confidence: Math.min(confidence + netComplexity * 0.05, 1.0),
      reason: hasTransientSource
        ? 'Pulse/time-varying sources detected — transient analysis recommended'
        : 'Time-varying components (switches/timers) detected — transient analysis recommended',
    };
  }

  // Pure DC or passive-only
  if (baseResult.hasDCSources) {
    // If there are frequency-dependent components with DC sources,
    // it's still DC but lower confidence — user might want AC or transient
    if (freqDepCount > 0) {
      const ratio = freqDepCount / Math.max(passiveCount, 1);
      if (ratio > 0.5) {
        return {
          type: 'dc',
          confidence: 0.65,
          reason: 'DC sources with many reactive components — DC analysis recommended but AC/transient may be relevant',
        };
      }
    }
    return {
      type: 'dc',
      confidence: 0.9,
      reason: 'Only DC sources detected — DC operating point analysis recommended',
    };
  }

  // No sources at all
  return {
    type: 'dc',
    confidence: 0.5,
    reason: 'No sources detected — defaulting to DC operating point',
  };
}
