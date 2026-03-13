/**
 * Electrical Rule Check (ERC) Engine
 *
 * Analyzes circuit schematic data for electrical rule violations.
 * Pure function — takes data in, returns violations out.
 * Net-based analysis (not shape/geometry-based like DRC).
 */

import type {
  ERCViolation,
  ERCRule,
  ERCRuleType,
  ERCSeverity,
  NoConnectMarker,
  CircuitSettings,
} from '@shared/circuit-types';
import type { CircuitInstanceRow, CircuitNetRow, ComponentPart } from '@shared/schema';
import type { Connector, PartMeta } from '@shared/component-types';

// ---------------------------------------------------------------------------
// Pin electrical type classification
// ---------------------------------------------------------------------------

export type PinElectricalType =
  | 'input'
  | 'output'
  | 'bidirectional'
  | 'power-in'
  | 'power-out'
  | 'passive'
  | 'no-connect';

/** Heuristic: infer electrical type from pin name and part family. */
export function classifyPin(
  pinName: string,
  partFamily: string,
): PinElectricalType {
  const name = pinName.toLowerCase();
  const family = partFamily.toLowerCase();

  // Power pins
  if (/^(vcc|vdd|vin|v\+|vsup|vpwr|vbat)$/i.test(name)) return 'power-in';
  if (/^(vout|vreg)$/i.test(name)) return 'power-out';
  if (/^(gnd|vss|vee|v-|agnd|dgnd|pgnd)$/i.test(name)) return 'power-in';

  // Passive components — all pins are passive
  if (/^(resistor|capacitor|inductor|ferrite|thermistor|varistor|potentiometer)$/.test(family)) {
    return 'passive';
  }

  // Crystal/oscillator — passive
  if (/^(crystal|oscillator)$/.test(family)) return 'passive';

  // Connector pins are bidirectional
  if (/^(connector|header)$/.test(family)) return 'bidirectional';

  // Diode/LED — anode is passive, cathode is passive
  if (/^(diode|led)$/.test(family)) return 'passive';

  // Transistor/MOSFET — gate is input, source/drain are bidirectional
  if (/^(transistor|mosfet|bjt|jfet)$/.test(family)) {
    if (/gate|base/i.test(name)) return 'input';
    return 'bidirectional';
  }

  // IC-level heuristics by pin name patterns
  if (/^(clk|clock|sck|scl)$/i.test(name)) return 'input';
  if (/^(mosi|sda|sdi|din|rx|rxd)$/i.test(name)) return 'input';
  if (/^(miso|sdo|dout|tx|txd)$/i.test(name)) return 'output';
  if (/^(cs|ss|ce|en|enable|reset|rst|nrst)$/i.test(name)) return 'input';
  if (/^(int|irq|alert)$/i.test(name)) return 'output';
  if (/^(gpio|io|d\d+|p\d+|a\d+)$/i.test(name)) return 'bidirectional';

  // Default for ICs: bidirectional (conservative — avoids false positives)
  if (/^(microcontroller|ic|opamp|regulator|sensor|module)$/.test(family)) {
    return 'bidirectional';
  }

  return 'bidirectional';
}

// ---------------------------------------------------------------------------
// ERC input data
// ---------------------------------------------------------------------------

export interface ERCInput {
  instances: CircuitInstanceRow[];
  nets: CircuitNetRow[];
  partsMap: Map<number, ComponentPart>;
  settings: CircuitSettings;
  rules: ERCRule[];
}

interface PinInfo {
  instanceId: number;
  pin: string;
  pinName: string;
  electricalType: PinElectricalType;
  partFamily: string;
  position: { x: number; y: number };
}

interface NetSegmentJSON {
  fromInstanceId: number;
  fromPin: string;
  toInstanceId: number;
  toPin: string;
}

// ---------------------------------------------------------------------------
// ERC Engine
// ---------------------------------------------------------------------------

export function runERC(input: ERCInput): ERCViolation[] {
  const { instances, nets, partsMap, settings, rules } = input;
  const violations: ERCViolation[] = [];

  // Build enabled rules lookup
  const enabledRules = new Map<ERCRuleType, ERCSeverity>();
  for (const rule of rules) {
    if (rule.enabled) enabledRules.set(rule.type, rule.severity);
  }

  // Build pin info map: instanceId:pinId → PinInfo
  // Also build alias map: instanceId:pinName → canonical key
  // Net segments may reference pins by name (e.g. "PB0") or by id (e.g. "pin2")
  const pinInfoMap = new Map<string, PinInfo>();
  const pinAliasMap = new Map<string, string>();
  for (const inst of instances) {
    const part = inst.partId != null ? partsMap.get(inst.partId) : undefined;
    const connectors = (part?.connectors ?? []) as Connector[];
    const meta = (part?.meta ?? {}) as Partial<PartMeta>;
    const family = meta.family || '';

    for (const conn of connectors) {
      const key = `${inst.id}:${conn.id}`;
      pinInfoMap.set(key, {
        instanceId: inst.id,
        pin: conn.id,
        pinName: conn.name,
        electricalType: classifyPin(conn.name, family),
        partFamily: family,
        position: { x: inst.schematicX, y: inst.schematicY },
      });
      // Map name-based key → canonical id-based key
      if (conn.name !== conn.id) {
        pinAliasMap.set(`${inst.id}:${conn.name}`, key);
      }
    }
  }

  // Build net membership: pinKey → netId
  const pinToNet = new Map<string, number>();
  // Build net → pins map
  const netPins = new Map<number, PinInfo[]>();

  // Helper: resolve a segment pin key to the canonical pinInfoMap key.
  // Handles both id-based ("1:pin2") and name-based ("1:PB0") references.
  const resolveKey = (rawKey: string): string =>
    pinInfoMap.has(rawKey) ? rawKey : (pinAliasMap.get(rawKey) ?? rawKey);

  for (const net of nets) {
    const segments = (net.segments ?? []) as NetSegmentJSON[];
    const pinKeySet = new Set<string>();
    const pins: PinInfo[] = [];

    for (const seg of segments) {
      const fromKey = resolveKey(`${seg.fromInstanceId}:${seg.fromPin}`);
      const toKey = resolveKey(`${seg.toInstanceId}:${seg.toPin}`);
      pinToNet.set(fromKey, net.id);
      pinToNet.set(toKey, net.id);

      if (!pinKeySet.has(fromKey)) {
        pinKeySet.add(fromKey);
        const info = pinInfoMap.get(fromKey);
        if (info) pins.push(info);
      }
      if (!pinKeySet.has(toKey)) {
        pinKeySet.add(toKey);
        const info = pinInfoMap.get(toKey);
        if (info) pins.push(info);
      }
    }

    netPins.set(net.id, pins);
  }

  // No-connect markers set (resolve aliases so name-based markers match canonical keys)
  const noConnects = new Set<string>();
  for (const nc of settings.noConnectMarkers ?? []) {
    noConnects.add(resolveKey(`${nc.instanceId}:${nc.pin}`));
  }

  // -----------------------------------------------------------------------
  // Rule: unconnected-pin
  // -----------------------------------------------------------------------
  if (enabledRules.has('unconnected-pin')) {
    const severity = enabledRules.get('unconnected-pin')!;
    Array.from(pinInfoMap.entries()).forEach(([key, info]) => {
      if (noConnects.has(key)) return; // Intentionally unconnected
      if (pinToNet.has(key)) return; // Connected to a net

      violations.push({
        id: `erc-unconnected-${key}`,
        ruleType: 'unconnected-pin',
        severity,
        message: `Pin "${info.pinName}" on instance ${info.instanceId} is not connected`,
        instanceId: info.instanceId,
        pin: info.pin,
        location: info.position,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Rule: no-connect-connected
  // -----------------------------------------------------------------------
  if (enabledRules.has('no-connect-connected')) {
    const severity = enabledRules.get('no-connect-connected')!;
    Array.from(noConnects).forEach((ncKey) => {
      if (!pinToNet.has(ncKey)) return; // Correctly unconnected
      const info = pinInfoMap.get(ncKey);
      if (!info) return;

      violations.push({
        id: `erc-nc-connected-${ncKey}`,
        ruleType: 'no-connect-connected',
        severity,
        message: `Pin "${info.pinName}" is marked no-connect but has a net connection`,
        instanceId: info.instanceId,
        pin: info.pin,
        netId: pinToNet.get(ncKey),
        location: info.position,
      });
    });
  }

  // -----------------------------------------------------------------------
  // Rule: driver-conflict — multiple outputs on the same net
  // -----------------------------------------------------------------------
  if (enabledRules.has('driver-conflict')) {
    const severity = enabledRules.get('driver-conflict')!;
    Array.from(netPins.entries()).forEach(([netId, pins]) => {
      const outputs = pins.filter((p: PinInfo) => p.electricalType === 'output' || p.electricalType === 'power-out');
      if (outputs.length > 1) {
        const net = nets.find((n) => n.id === netId);
        violations.push({
          id: `erc-driver-conflict-${netId}`,
          ruleType: 'driver-conflict',
          severity,
          message: `Net "${net?.name ?? netId}" has ${outputs.length} driving outputs: ${outputs.map((o: PinInfo) => o.pinName).join(', ')}`,
          netId,
          location: outputs[0].position,
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Rule: floating-input — input pin with no driving source on the net
  // -----------------------------------------------------------------------
  if (enabledRules.has('floating-input')) {
    const severity = enabledRules.get('floating-input')!;
    Array.from(netPins.entries()).forEach(([netId, pins]) => {
      const hasDriver = pins.some(
        (p: PinInfo) =>
          p.electricalType === 'output' ||
          p.electricalType === 'power-out' ||
          p.electricalType === 'bidirectional' ||
          p.electricalType === 'passive',
      );
      if (hasDriver) return;

      // Net has only input pins — all are floating
      const inputs = pins.filter((p: PinInfo) => p.electricalType === 'input');
      for (const input of inputs) {
        violations.push({
          id: `erc-floating-${input.instanceId}:${input.pin}`,
          ruleType: 'floating-input',
          severity,
          message: `Input pin "${input.pinName}" has no driving source on the net`,
          instanceId: input.instanceId,
          pin: input.pin,
          netId,
          location: input.position,
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Rule: shorted-power — different power nets connected together
  // -----------------------------------------------------------------------
  if (enabledRules.has('shorted-power')) {
    const severity = enabledRules.get('shorted-power')!;
    Array.from(netPins.entries()).forEach(([netId, pins]) => {
      const powerPins = pins.filter(
        (p: PinInfo) => p.electricalType === 'power-in' || p.electricalType === 'power-out',
      );
      if (powerPins.length < 2) return;

      // Check if power pins come from different power rail names
      const powerNames = Array.from(new Set(powerPins.map((p: PinInfo) => p.pinName.toUpperCase())));
      // If VCC and GND are on the same net, that's a short
      const hasSupply = powerNames.some((n: string) => /^(VCC|VDD|VIN|V\+|VOUT|VREG)$/i.test(n));
      const hasGround = powerNames.some((n: string) => /^(GND|VSS|VEE|V-|AGND|DGND)$/i.test(n));

      if (hasSupply && hasGround) {
        const net = nets.find((n) => n.id === netId);
        violations.push({
          id: `erc-shorted-power-${netId}`,
          ruleType: 'shorted-power',
          severity,
          message: `Supply and ground pins shorted on net "${net?.name ?? netId}"`,
          netId,
          location: powerPins[0].position,
        });
      }
    });
  }

  // -----------------------------------------------------------------------
  // Rule: missing-bypass-cap — IC power pins without nearby capacitor
  // -----------------------------------------------------------------------
  if (enabledRules.has('missing-bypass-cap')) {
    const severity = enabledRules.get('missing-bypass-cap')!;

    // Find all IC-type instances
    const icInstances = instances.filter((inst) => {
      if (inst.partId == null) return false;
      const part = partsMap.get(inst.partId);
      const meta = (part?.meta ?? {}) as Partial<PartMeta>;
      const family = (meta.family || '').toLowerCase();
      return /^(microcontroller|ic|opamp|sensor|module)$/.test(family);
    });

    // Find all capacitor instances
    const capInstances = instances.filter((inst) => {
      if (inst.partId == null) return false;
      const part = partsMap.get(inst.partId);
      const meta = (part?.meta ?? {}) as Partial<PartMeta>;
      return (meta.family || '').toLowerCase() === 'capacitor';
    });

    for (const ic of icInstances) {
      // Check if any of the IC's power pins share a net with a capacitor
      const part = ic.partId != null ? partsMap.get(ic.partId) : undefined;
      const connectors = (part?.connectors ?? []) as Connector[];
      const icMeta = (part?.meta ?? {}) as Partial<PartMeta>;
      const icFamily = icMeta.family || '';
      const powerPins = connectors.filter((c) =>
        classifyPin(c.name, icFamily) === 'power-in',
      );

      for (const pp of powerPins) {
        const pinKey = `${ic.id}:${pp.id}`;
        const netId = pinToNet.get(pinKey);
        if (!netId) continue;

        const pinsOnNet = netPins.get(netId) ?? [];
        const hasCapOnNet = pinsOnNet.some((p) =>
          capInstances.some((cap) => cap.id === p.instanceId),
        );

        if (!hasCapOnNet) {
          violations.push({
            id: `erc-bypass-${pinKey}`,
            ruleType: 'missing-bypass-cap',
            severity,
            message: `Power pin "${pp.name}" on IC instance ${ic.id} has no bypass capacitor on the net`,
            instanceId: ic.id,
            pin: pp.id,
            netId,
            location: { x: ic.schematicX, y: ic.schematicY },
          });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Rule: power-net-unnamed — power/ground nets with generic names
  // -----------------------------------------------------------------------
  if (enabledRules.has('power-net-unnamed')) {
    const severity = enabledRules.get('power-net-unnamed')!;
    for (const net of nets) {
      if (net.netType !== 'power' && net.netType !== 'ground') continue;
      // Check for generic auto-generated names
      if (/^Net_/.test(net.name) || net.name === '' || net.name === 'unnamed') {
        violations.push({
          id: `erc-unnamed-power-${net.id}`,
          ruleType: 'power-net-unnamed',
          severity,
          message: `Power/ground net "${net.name}" should have an explicit name (e.g., VCC, GND)`,
          netId: net.id,
          location: { x: 0, y: 0 },
        });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Incremental ERC — dirty tracking, result caching, partial re-check
// ---------------------------------------------------------------------------

/**
 * Tracks which nets and instances have been modified since the last ERC run.
 * The circuit editor calls invalidation hooks (below) which mark entities dirty.
 */
export class DirtyTracker {
  private dirtyNets = new Set<number>();
  private dirtyInstances = new Set<number>();

  markNetDirty(netId: number): void {
    this.dirtyNets.add(netId);
  }

  markInstanceDirty(instanceId: number): void {
    this.dirtyInstances.add(instanceId);
  }

  markAllDirty(): void {
    // The caller should provide the full set; this just sets the "all dirty" flag.
    // Handled by the incremental runner via the 50% threshold fallback.
    this.dirtyNets.clear();
    this.dirtyInstances.clear();
    // Use a sentinel — the incremental runner checks `isAllDirty`.
    this._allDirty = true;
  }

  getDirtyNets(): ReadonlySet<number> {
    return this.dirtyNets;
  }

  getDirtyInstances(): ReadonlySet<number> {
    return this.dirtyInstances;
  }

  get isAllDirty(): boolean {
    return this._allDirty;
  }

  clearDirty(): void {
    this.dirtyNets.clear();
    this.dirtyInstances.clear();
    this._allDirty = false;
  }

  get dirtyNetCount(): number {
    return this.dirtyNets.size;
  }

  get dirtyInstanceCount(): number {
    return this.dirtyInstances.size;
  }

  private _allDirty = false;
}

/**
 * Caches ERC results keyed by entity ID (net or instance).
 * Keys are prefixed: `net:<id>` or `inst:<id>`.
 */
export class ERCResultCache {
  private cache = new Map<string, ERCViolation[]>();

  setResults(entityKey: string, violations: ERCViolation[]): void {
    this.cache.set(entityKey, violations);
  }

  getResults(entityKey: string): ERCViolation[] | undefined {
    return this.cache.get(entityKey);
  }

  invalidate(entityKey: string): void {
    this.cache.delete(entityKey);
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  getAllCachedResults(): ERCViolation[] {
    const all: ERCViolation[] = [];
    for (const violations of this.cache.values()) {
      for (const v of violations) {
        all.push(v);
      }
    }
    return all;
  }

  get size(): number {
    return this.cache.size;
  }

  has(entityKey: string): boolean {
    return this.cache.has(entityKey);
  }
}

/** Options for incremental ERC. */
export interface IncrementalERCOptions {
  /** Fraction of dirty entities above which a full run is used instead (default 0.5). */
  dirtyThreshold?: number;
}

/**
 * Run ERC incrementally — only re-checks dirty nets/instances and merges with
 * cached results for clean entities.
 *
 * Falls back to a full `runERC()` when:
 *  - `tracker.isAllDirty` is set
 *  - More than `dirtyThreshold` (default 50%) of entities are dirty
 *  - The cache is empty (first run)
 *
 * Returns the merged violation list (same shape as `runERC()`).
 */
export function runIncrementalERC(
  input: ERCInput,
  tracker: DirtyTracker,
  cache: ERCResultCache,
  options?: IncrementalERCOptions,
): ERCViolation[] {
  const threshold = options?.dirtyThreshold ?? 0.5;
  const totalNets = input.nets.length;
  const totalInstances = input.instances.length;
  const totalEntities = totalNets + totalInstances;

  // Fall back to full run when appropriate
  const shouldFallback =
    tracker.isAllDirty ||
    cache.size === 0 ||
    totalEntities === 0 ||
    (tracker.dirtyNetCount + tracker.dirtyInstanceCount) / Math.max(totalEntities, 1) > threshold;

  if (shouldFallback) {
    const violations = runERC(input);
    // Populate the cache from the full run
    cacheFullResults(violations, input, cache);
    tracker.clearDirty();
    return violations;
  }

  // Invalidate cache entries for dirty entities
  for (const netId of tracker.getDirtyNets()) {
    cache.invalidate(`net:${netId}`);
  }
  for (const instId of tracker.getDirtyInstances()) {
    cache.invalidate(`inst:${instId}`);
  }

  // Run a full ERC (the engine is pure-functional, so we always compute fresh)
  // then extract only violations belonging to dirty entities as "fresh" results
  // and keep cached results for clean entities.
  const freshViolations = runERC(input);

  // Partition fresh violations by entity key
  const freshByEntity = new Map<string, ERCViolation[]>();
  for (const v of freshViolations) {
    const keys = violationEntityKeys(v);
    for (const key of keys) {
      const arr = freshByEntity.get(key);
      if (arr) {
        arr.push(v);
      } else {
        freshByEntity.set(key, [v]);
      }
    }
  }

  // Update cache with fresh results for dirty entities
  for (const netId of tracker.getDirtyNets()) {
    const key = `net:${netId}`;
    cache.setResults(key, freshByEntity.get(key) ?? []);
  }
  for (const instId of tracker.getDirtyInstances()) {
    const key = `inst:${instId}`;
    cache.setResults(key, freshByEntity.get(key) ?? []);
  }

  // Also update cache for any entities not yet cached (covers new entities)
  for (const [key, violations] of freshByEntity) {
    if (!cache.has(key)) {
      cache.setResults(key, violations);
    }
  }

  tracker.clearDirty();

  // Return deduplicated merged results from the cache
  return deduplicateViolations(cache.getAllCachedResults());
}

/** Map a violation to entity cache keys (net and/or instance). */
function violationEntityKeys(v: ERCViolation): string[] {
  const keys: string[] = [];
  if (v.netId != null) {
    keys.push(`net:${v.netId}`);
  }
  if (v.instanceId != null) {
    keys.push(`inst:${v.instanceId}`);
  }
  // If neither net nor instance is set (e.g. power-net-unnamed only has netId), ensure at least one key
  if (keys.length === 0 && v.id) {
    keys.push(`misc:${v.id}`);
  }
  return keys;
}

/** Deduplicate violations by `id`. */
function deduplicateViolations(violations: ERCViolation[]): ERCViolation[] {
  const seen = new Set<string>();
  const result: ERCViolation[] = [];
  for (const v of violations) {
    if (!seen.has(v.id)) {
      seen.add(v.id);
      result.push(v);
    }
  }
  return result;
}

/** Populate the cache from a full ERC run, keyed by entity. */
function cacheFullResults(
  violations: ERCViolation[],
  input: ERCInput,
  cache: ERCResultCache,
): void {
  cache.invalidateAll();

  // Initialize empty arrays for all entities
  for (const net of input.nets) {
    cache.setResults(`net:${net.id}`, []);
  }
  for (const inst of input.instances) {
    cache.setResults(`inst:${inst.id}`, []);
  }

  // Assign violations to their entity keys
  for (const v of violations) {
    const keys = violationEntityKeys(v);
    for (const key of keys) {
      const existing = cache.getResults(key) ?? [];
      existing.push(v);
      cache.setResults(key, existing);
    }
  }
}

// ---------------------------------------------------------------------------
// Invalidation hooks — called by the circuit editor on mutations
// ---------------------------------------------------------------------------

/** Call when a new instance is added to the circuit. */
export function onInstanceAdded(tracker: DirtyTracker, instanceId: number): void {
  tracker.markInstanceDirty(instanceId);
}

/** Call when an existing instance is removed from the circuit. */
export function onInstanceRemoved(tracker: DirtyTracker, instanceId: number): void {
  tracker.markInstanceDirty(instanceId);
}

/** Call when an existing instance is modified (part change, property change, etc.). */
export function onInstanceModified(tracker: DirtyTracker, instanceId: number): void {
  tracker.markInstanceDirty(instanceId);
}

/** Call when a wire is added connecting to a net. */
export function onWireAdded(tracker: DirtyTracker, _wireId: number, netId: number): void {
  tracker.markNetDirty(netId);
}

/** Call when a wire is removed from a net. */
export function onWireRemoved(tracker: DirtyTracker, _wireId: number, netId: number): void {
  tracker.markNetDirty(netId);
}
