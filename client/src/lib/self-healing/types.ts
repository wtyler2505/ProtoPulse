/**
 * Self-Healing Assistant — types.
 * Split from self-healing.ts.
 */

export type Listener = () => void;

/** The 12 hazard types the assistant can detect. */
export type HazardType =
  | 'voltage_mismatch'
  | 'missing_decoupling'
  | 'unprotected_io'
  | 'floating_input'
  | 'reverse_polarity'
  | 'overcurrent'
  | 'esd_exposure'
  | 'missing_level_shifter'
  | 'power_overload'
  | 'adc_reference'
  | 'thermal_risk'
  | 'bus_contention';

export type HazardSeverity = 'critical' | 'warning' | 'info';

/** A component addition proposed as part of a fix. */
export interface ProposedComponent {
  /** Component type/value (e.g. "100nF ceramic capacitor"). */
  description: string;
  /** Reference designator suggestion (e.g. "C_bypass_U1"). */
  refDes: string;
  /** Where to place it relative to the hazard source. */
  placement: string;
  /** Connections (net names or pin references). */
  connections: string[];
}

/** A fix proposal for a detected hazard. */
export interface FixProposal {
  /** Unique proposal ID. */
  id: string;
  /** Which hazard this fixes. */
  hazardId: string;
  /** Human-readable description of the fix. */
  description: string;
  /** Components to add. */
  components: ProposedComponent[];
  /** Approval state. */
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  /** Timestamp when the proposal was created (ms). */
  createdAt: number;
  /** Expiry timestamp (ms). */
  expiresAt: number;
}

/** A detected circuit hazard. */
export interface Hazard {
  /** Unique hazard ID. */
  id: string;
  /** Hazard type. */
  type: HazardType;
  /** Severity. */
  severity: HazardSeverity;
  /** Human-readable message. */
  message: string;
  /** Reference designator(s) of affected component(s). */
  affectedRefs: string[];
  /** Net name(s) involved (if applicable). */
  affectedNets: string[];
  /** Associated fix proposal (null if no fix available). */
  fix: FixProposal | null;
  /** Timestamp when detected (ms). */
  detectedAt: number;
  /** Whether the hazard has been dismissed by the user. */
  dismissed: boolean;
}

/** A simplified circuit instance for hazard analysis. */
export interface AnalysisInstance {
  /** Reference designator. */
  refDes: string;
  /** Component label/name. */
  label: string;
  /** Properties bag. */
  properties: Record<string, unknown>;
  /** Connected net names. */
  connectedNets: string[];
}

/** A net from the circuit design for hazard analysis. */
export interface AnalysisNet {
  name: string;
  netType: string;
  voltage?: string | null;
}

/** An architecture node for power budget analysis. */
export interface AnalysisNode {
  /** Node ID. */
  nodeId: string;
  /** Node type (e.g. "microcontroller", "sensor", "power_supply"). */
  nodeType: string;
  /** Node label. */
  label: string;
  /** Node data (may include power, voltage, current fields). */
  data?: Record<string, unknown>;
}

/** Configuration for the self-healing assistant. */
export interface HealingConfig {
  /** Approval gate expiry in ms. Default 300000 (5 minutes). */
  approvalExpiryMs: number;
  /** Enable/disable specific hazard checks. */
  enabledChecks: Record<HazardType, boolean>;
  /** Default max pin current in mA. Default 20. */
  defaultMaxPinCurrentMa: number;
  /** Default ADC reference voltage. Default 3.3. */
  defaultAdcRefVoltage: number;
  /** Default max regulator current in mA. Default 500. */
  defaultMaxRegulatorCurrentMa: number;
  /** Thermal dissipation threshold in watts. Default 0.5. */
  thermalThresholdWatts: number;
}

/** Snapshot for useSyncExternalStore. */
export interface HealingSnapshot {
  /** All detected hazards. */
  hazards: Hazard[];
  /** Active (non-dismissed, non-expired) hazards. */
  activeHazards: Hazard[];
  /** Pending fix proposals. */
  pendingFixes: FixProposal[];
  /** Current config. */
  config: HealingConfig;
  /** Timestamp of last scan. */
  lastScanAt: number | null;
}
