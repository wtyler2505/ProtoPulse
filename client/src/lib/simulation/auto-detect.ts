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

/** Minimal shape of a circuit instance for auto-detection. */
export interface CircuitInstanceForDetection {
  referenceDesignator: string;
  componentType: string;
  properties?: Record<string, unknown> | null;
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
