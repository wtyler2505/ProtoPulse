/**
 * Self-Healing Assistant — singleton class for orchestrating scans and
 * approval gates. Split from self-healing.ts.
 */

import { DEFAULT_CONFIG, defaultEnabledChecks } from './config';
import {
  detectFloatingInputs,
  detectMissingDecoupling,
  detectOvercurrent,
  detectReversePolarity,
  detectUnprotectedIo,
  detectVoltageMismatch,
} from './detectors-a';
import {
  detectAdcReference,
  detectBusContention,
  detectEsdExposure,
  detectMissingLevelShifter,
  detectPowerOverload,
  detectThermalRisk,
} from './detectors-b';
import type {
  AnalysisInstance,
  AnalysisNet,
  FixProposal,
  Hazard,
  HazardSeverity,
  HazardType,
  HealingConfig,
  HealingSnapshot,
  Listener,
} from './types';

export class SelfHealingAssistant {
  private listeners: Set<Listener> = new Set();
  private hazards: Hazard[] = [];
  private config: HealingConfig = { ...DEFAULT_CONFIG, enabledChecks: defaultEnabledChecks() };
  private lastScanAt: number | null = null;

  // ── subscribe / getSnapshot ────────────────────────────────────────

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): HealingSnapshot {
    this.expirePendingFixes();
    const activeHazards = this.hazards.filter((h) => !h.dismissed);
    const pendingFixes = activeHazards
      .map((h) => h.fix)
      .filter((f): f is FixProposal => f !== null && f.status === 'pending');

    return {
      hazards: [...this.hazards],
      activeHazards,
      pendingFixes,
      config: { ...this.config, enabledChecks: { ...this.config.enabledChecks } },
      lastScanAt: this.lastScanAt,
    };
  }

  private notify(): void {
    this.listeners.forEach((fn) => {
      fn();
    });
  }

  // ── Configuration ──────────────────────────────────────────────────

  updateConfig(partial: Partial<HealingConfig>): void {
    if (partial.enabledChecks) {
      this.config.enabledChecks = { ...this.config.enabledChecks, ...partial.enabledChecks };
    }
    const { enabledChecks: _, ...rest } = partial;
    this.config = { ...this.config, ...rest, enabledChecks: this.config.enabledChecks };
    this.notify();
  }

  getConfig(): HealingConfig {
    return { ...this.config, enabledChecks: { ...this.config.enabledChecks } };
  }

  // ── Scanning ───────────────────────────────────────────────────────

  /**
   * Run all enabled hazard checks against the given circuit data.
   * Returns all detected hazards.
   */
  scan(
    instances: AnalysisInstance[],
    nets: AnalysisNet[],
  ): Hazard[] {
    const checks = this.config.enabledChecks;
    const allHazards: Hazard[] = [];

    if (checks.voltage_mismatch) {
      allHazards.push(...detectVoltageMismatch(instances, nets));
    }
    if (checks.missing_decoupling) {
      allHazards.push(...detectMissingDecoupling(instances, nets));
    }
    if (checks.unprotected_io) {
      allHazards.push(...detectUnprotectedIo(instances, nets));
    }
    if (checks.floating_input) {
      allHazards.push(...detectFloatingInputs(instances, nets));
    }
    if (checks.reverse_polarity) {
      allHazards.push(...detectReversePolarity(instances, nets));
    }
    if (checks.overcurrent) {
      allHazards.push(...detectOvercurrent(instances, nets, this.config.defaultMaxPinCurrentMa));
    }
    if (checks.esd_exposure) {
      allHazards.push(...detectEsdExposure(instances, nets));
    }
    if (checks.missing_level_shifter) {
      allHazards.push(...detectMissingLevelShifter(instances, nets));
    }
    if (checks.power_overload) {
      allHazards.push(...detectPowerOverload(instances, nets, this.config.defaultMaxRegulatorCurrentMa));
    }
    if (checks.adc_reference) {
      allHazards.push(...detectAdcReference(instances, nets, this.config.defaultAdcRefVoltage));
    }
    if (checks.thermal_risk) {
      allHazards.push(...detectThermalRisk(instances, nets, this.config.thermalThresholdWatts));
    }
    if (checks.bus_contention) {
      allHazards.push(...detectBusContention(instances, nets));
    }

    this.hazards = allHazards;
    this.lastScanAt = Date.now();
    this.notify();
    return [...allHazards];
  }

  // ── Approval gates ─────────────────────────────────────────────────

  /**
   * Approve a fix proposal by ID.
   */
  approveFix(fixId: string): boolean {
    for (const hz of this.hazards) {
      if (hz.fix && hz.fix.id === fixId && hz.fix.status === 'pending') {
        if (Date.now() > hz.fix.expiresAt) {
          hz.fix.status = 'expired';
          this.notify();
          return false;
        }
        hz.fix.status = 'approved';
        this.notify();
        return true;
      }
    }
    return false;
  }

  /**
   * Reject a fix proposal by ID.
   */
  rejectFix(fixId: string): boolean {
    for (const hz of this.hazards) {
      if (hz.fix && hz.fix.id === fixId && hz.fix.status === 'pending') {
        hz.fix.status = 'rejected';
        this.notify();
        return true;
      }
    }
    return false;
  }

  /**
   * Dismiss a hazard (mark as acknowledged / not actionable).
   */
  dismissHazard(hazardId: string): boolean {
    const hz = this.hazards.find((h) => h.id === hazardId);
    if (hz && !hz.dismissed) {
      hz.dismissed = true;
      this.notify();
      return true;
    }
    return false;
  }

  /**
   * Expire pending fixes that have passed their expiry time.
   */
  expirePendingFixes(): number {
    const now = Date.now();
    let expired = 0;
    for (const hz of this.hazards) {
      if (hz.fix && hz.fix.status === 'pending' && now > hz.fix.expiresAt) {
        hz.fix.status = 'expired';
        expired++;
      }
    }
    if (expired > 0) {
      this.notify();
    }
    return expired;
  }

  // ── Queries ────────────────────────────────────────────────────────

  /**
   * Get hazards filtered by type.
   */
  getHazardsByType(type: HazardType): Hazard[] {
    return this.hazards.filter((h) => h.type === type);
  }

  /**
   * Get hazards filtered by severity.
   */
  getHazardsBySeverity(severity: HazardSeverity): Hazard[] {
    return this.hazards.filter((h) => h.severity === severity);
  }

  /**
   * Get hazards affecting a specific reference designator.
   */
  getHazardsForRef(refDes: string): Hazard[] {
    return this.hazards.filter((h) => h.affectedRefs.includes(refDes));
  }

  /**
   * Get all approved fixes.
   */
  getApprovedFixes(): FixProposal[] {
    return this.hazards
      .map((h) => h.fix)
      .filter((f): f is FixProposal => f !== null && f.status === 'approved');
  }

  // ── Reset ──────────────────────────────────────────────────────────

  reset(): void {
    this.hazards = [];
    this.config = { ...DEFAULT_CONFIG, enabledChecks: defaultEnabledChecks() };
    this.lastScanAt = null;
    this.notify();
  }
}

// ---------------------------------------------------------------------------
// Singleton accessor
// ---------------------------------------------------------------------------

let instance: SelfHealingAssistant | null = null;

/** Get the singleton SelfHealingAssistant. */
export function getSelfHealingAssistant(): SelfHealingAssistant {
  if (!instance) {
    instance = new SelfHealingAssistant();
  }
  return instance;
}

/** Reset the singleton (for testing). */
export function resetSelfHealingAssistant(): void {
  instance = null;
}
