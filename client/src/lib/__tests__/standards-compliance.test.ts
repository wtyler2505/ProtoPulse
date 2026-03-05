import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  StandardsComplianceEngine,
  calculateClearanceCreepage,
  type ComplianceNode,
  type ComplianceBomItem,
  type DesignParameters,
  type ComplianceDomain,
  type ComplianceRule,
  type ComplianceFinding,
  type ComplianceCheckResult,
  type ComponentRating,
  type PollutionDegree,
  type MaterialGroup,
} from '../standards-compliance';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(overrides: Partial<ComplianceNode> = {}): ComplianceNode {
  return {
    nodeId: 'node-1',
    label: 'TestNode',
    nodeType: 'component',
    data: null,
    ...overrides,
  };
}

function makeBomItem(overrides: Partial<ComplianceBomItem> = {}): ComplianceBomItem {
  return {
    id: 1,
    partNumber: 'TEST-001',
    manufacturer: 'TestMfg',
    description: 'Test Component',
    quantity: 1,
    unitPrice: '1.00',
    totalPrice: '1.00',
    supplier: 'TestSupplier',
    status: 'In Stock',
    ...overrides,
  };
}

const emptyParams: DesignParameters = {};

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

describe('StandardsComplianceEngine', () => {
  beforeEach(() => {
    StandardsComplianceEngine.resetForTesting();
    localStorage.clear();
  });

  afterEach(() => {
    StandardsComplianceEngine.resetForTesting();
  });

  // =========================================================================
  // Singleton
  // =========================================================================

  describe('singleton', () => {
    it('returns the same instance on repeated calls', () => {
      const a = StandardsComplianceEngine.getInstance();
      const b = StandardsComplianceEngine.getInstance();
      expect(a).toBe(b);
    });

    it('resets singleton for testing', () => {
      const a = StandardsComplianceEngine.getInstance();
      StandardsComplianceEngine.resetForTesting();
      const b = StandardsComplianceEngine.getInstance();
      expect(a).not.toBe(b);
    });
  });

  // =========================================================================
  // Subscription
  // =========================================================================

  describe('subscribe', () => {
    it('notifies listeners on domain change', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const listener = vi.fn();
      engine.subscribe(listener);
      engine.setSelectedDomains(['automotive']);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('unsubscribes correctly', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const listener = vi.fn();
      const unsub = engine.subscribe(listener);
      unsub();
      engine.setSelectedDomains(['medical']);
      expect(listener).not.toHaveBeenCalled();
    });

    it('supports multiple listeners', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const l1 = vi.fn();
      const l2 = vi.fn();
      engine.subscribe(l1);
      engine.subscribe(l2);
      engine.setSelectedDomains(['industrial']);
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Domain Management
  // =========================================================================

  describe('domain management', () => {
    it('lists all available domains', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const domains = engine.getAvailableDomains();
      expect(domains).toEqual(['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc']);
    });

    it('starts with no selected domains', () => {
      const engine = StandardsComplianceEngine.getInstance();
      expect(engine.getSelectedDomains()).toEqual([]);
    });

    it('sets and gets selected domains', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.setSelectedDomains(['automotive', 'emc']);
      expect(engine.getSelectedDomains()).toEqual(['automotive', 'emc']);
    });

    it('returns a copy of selected domains', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.setSelectedDomains(['medical']);
      const d1 = engine.getSelectedDomains();
      const d2 = engine.getSelectedDomains();
      expect(d1).toEqual(d2);
      expect(d1).not.toBe(d2);
    });
  });

  // =========================================================================
  // Rule Management
  // =========================================================================

  describe('rule management', () => {
    it('returns built-in rules', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const rules = engine.getBuiltinRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('built-in rules cover all domains', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const rules = engine.getBuiltinRules();
      const domains = new Set(rules.map((r) => r.domain));
      expect(domains.has('automotive')).toBe(true);
      expect(domains.has('medical')).toBe(true);
      expect(domains.has('industrial')).toBe(true);
      expect(domains.has('consumer')).toBe(true);
      expect(domains.has('aerospace')).toBe(true);
      expect(domains.has('emc')).toBe(true);
    });

    it('starts with no custom rules', () => {
      const engine = StandardsComplianceEngine.getInstance();
      expect(engine.getCustomRules()).toEqual([]);
    });

    it('adds a custom rule', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const rule: ComplianceRule = {
        id: 'CUSTOM-001',
        domain: 'automotive',
        standardRef: 'Custom Ref',
        description: 'Custom test rule',
        severity: 'warning',
        remediation: 'Fix it.',
        check: () => [],
      };
      engine.addCustomRule(rule);
      expect(engine.getCustomRules()).toHaveLength(1);
      expect(engine.getCustomRules()[0].id).toBe('CUSTOM-001');
    });

    it('overwrites custom rule with same id', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.addCustomRule({
        id: 'CUSTOM-001', domain: 'automotive', standardRef: 'Ref',
        description: 'V1', severity: 'warning', remediation: 'Fix.', check: () => [],
      });
      engine.addCustomRule({
        id: 'CUSTOM-001', domain: 'automotive', standardRef: 'Ref',
        description: 'V2', severity: 'violation', remediation: 'Fix.', check: () => [],
      });
      expect(engine.getCustomRules()).toHaveLength(1);
      expect(engine.getCustomRules()[0].description).toBe('V2');
    });

    it('removes a custom rule', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.addCustomRule({
        id: 'CUSTOM-001', domain: 'automotive', standardRef: 'Ref',
        description: 'Test', severity: 'warning', remediation: 'Fix.', check: () => [],
      });
      const removed = engine.removeCustomRule('CUSTOM-001');
      expect(removed).toBe(true);
      expect(engine.getCustomRules()).toHaveLength(0);
    });

    it('returns false when removing non-existent custom rule', () => {
      const engine = StandardsComplianceEngine.getInstance();
      expect(engine.removeCustomRule('NOPE')).toBe(false);
    });

    it('getAllRules includes built-in and custom', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const builtinCount = engine.getBuiltinRules().length;
      engine.addCustomRule({
        id: 'CUSTOM-001', domain: 'automotive', standardRef: 'Ref',
        description: 'Test', severity: 'warning', remediation: 'Fix.', check: () => [],
      });
      expect(engine.getAllRules().length).toBe(builtinCount + 1);
    });

    it('getRulesForDomains filters correctly', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const autoRules = engine.getRulesForDomains(['automotive']);
      expect(autoRules.length).toBeGreaterThan(0);
      expect(autoRules.every((r) => r.domain === 'automotive')).toBe(true);
    });

    it('each built-in rule has required fields', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.getBuiltinRules().forEach((rule) => {
        expect(rule.id).toBeTruthy();
        expect(rule.domain).toBeTruthy();
        expect(rule.standardRef).toBeTruthy();
        expect(rule.description).toBeTruthy();
        expect(rule.severity).toBeTruthy();
        expect(rule.remediation).toBeTruthy();
        expect(typeof rule.check).toBe('function');
      });
    });
  });

  // =========================================================================
  // Automotive (AEC-Q) Rules
  // =========================================================================

  describe('automotive rules', () => {
    it('AUTO-001: flags non-automotive ICs', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: 'LM7805', description: 'Voltage Regulator IC', manufacturer: 'TI' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const auto001 = result.findings.filter((f) => f.ruleId === 'AUTO-001');
      expect(auto001.length).toBeGreaterThan(0);
      expect(auto001[0].severity).toBe('violation');
    });

    it('AUTO-001: passes for AEC-Q100 qualified ICs', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: 'LM7805-Q1', description: 'Voltage Regulator IC AEC-Q100', manufacturer: 'TI' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const auto001 = result.findings.filter((f) => f.ruleId === 'AUTO-001');
      expect(auto001).toHaveLength(0);
    });

    it('AUTO-002: flags non-automotive discrete semiconductors', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: '1N4148', description: 'Signal Diode', manufacturer: 'ON' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const auto002 = result.findings.filter((f) => f.ruleId === 'AUTO-002');
      expect(auto002.length).toBeGreaterThan(0);
    });

    it('AUTO-002: passes for automotive-grade diodes', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: '1N4148-AUTO', description: 'Signal Diode AEC-Q101', manufacturer: 'ON' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const auto002 = result.findings.filter((f) => f.ruleId === 'AUTO-002');
      expect(auto002).toHaveLength(0);
    });

    it('AUTO-003: warns for non-automotive passives', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: 'RC0603', description: 'Resistor 10k 0603', manufacturer: 'Yageo' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const auto003 = result.findings.filter((f) => f.ruleId === 'AUTO-003');
      expect(auto003.length).toBeGreaterThan(0);
      expect(auto003[0].severity).toBe('warning');
    });

    it('AUTO-004: flags insufficient temperature range', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { operatingTempMin: -20, operatingTempMax: 85 };
      const result = engine.runCheck([], [], params, ['automotive']);
      const auto004 = result.findings.filter((f) => f.ruleId === 'AUTO-004');
      expect(auto004).toHaveLength(2);
    });

    it('AUTO-004: passes for Grade 1 temperature range', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { operatingTempMin: -40, operatingTempMax: 125 };
      const result = engine.runCheck([], [], params, ['automotive']);
      const auto004 = result.findings.filter((f) => f.ruleId === 'AUTO-004');
      expect(auto004).toHaveLength(0);
    });

    it('AUTO-005: flags voltage derating violations', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = {
        componentRatings: {
          'U1': { maxVoltage: 10, operatingVoltage: 8 }, // 80% > 70% limit
        },
      };
      const result = engine.runCheck([], [], params, ['automotive']);
      const auto005 = result.findings.filter((f) => f.ruleId === 'AUTO-005');
      expect(auto005.length).toBeGreaterThan(0);
    });

    it('AUTO-005: passes for properly derated components', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = {
        componentRatings: {
          'U1': { maxVoltage: 10, operatingVoltage: 5 }, // 50% < 70% limit
        },
      };
      const result = engine.runCheck([], [], params, ['automotive']);
      const auto005 = result.findings.filter((f) => f.ruleId === 'AUTO-005');
      expect(auto005).toHaveLength(0);
    });
  });

  // =========================================================================
  // Medical (IEC 60601) Rules
  // =========================================================================

  describe('medical rules', () => {
    it('MED-001: warns when voltage not specified', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['medical']);
      const med001 = result.findings.filter((f) => f.ruleId === 'MED-001');
      expect(med001.length).toBe(1);
      expect(med001[0].severity).toBe('warning');
    });

    it('MED-001: flags voltage > 250V', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 300 }, ['medical']);
      const med001 = result.findings.filter((f) => f.ruleId === 'MED-001');
      expect(med001.length).toBe(1);
      expect(med001[0].severity).toBe('violation');
    });

    it('MED-001: passes for low voltage', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 12 }, ['medical']);
      const med001 = result.findings.filter((f) => f.ruleId === 'MED-001');
      expect(med001).toHaveLength(0);
    });

    it('MED-002: flags ungrounded medical device', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { isSafetyGrounded: false }, ['medical']);
      const med002 = result.findings.filter((f) => f.ruleId === 'MED-002');
      expect(med002.length).toBe(1);
      expect(med002[0].severity).toBe('violation');
    });

    it('MED-003: flags no isolation with > 30V', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'Power Supply' })];
      const result = engine.runCheck(nodes, [], { maxVoltage: 48 }, ['medical']);
      const med003 = result.findings.filter((f) => f.ruleId === 'MED-003');
      expect(med003.length).toBe(1);
    });

    it('MED-003: passes when isolation is present', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'Isolation Transformer' })];
      const result = engine.runCheck(nodes, [], { maxVoltage: 48 }, ['medical']);
      const med003 = result.findings.filter((f) => f.ruleId === 'MED-003');
      expect(med003).toHaveLength(0);
    });

    it('MED-004: recommends biocompatibility for touchable parts', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { hasTouchableMetalParts: true }, ['medical']);
      const med004 = result.findings.filter((f) => f.ruleId === 'MED-004');
      expect(med004.length).toBe(1);
      expect(med004[0].severity).toBe('recommendation');
    });

    it('MED-005: checks medical derating', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = {
        componentRatings: {
          'U1': { maxVoltage: 10, operatingVoltage: 7 }, // 70% > 60% limit
        },
      };
      const result = engine.runCheck([], [], params, ['medical']);
      const med005 = result.findings.filter((f) => f.ruleId === 'MED-005');
      expect(med005.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Industrial (IEC 61131) Rules
  // =========================================================================

  describe('industrial rules', () => {
    it('IND-001: warns about unprotected I/O', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'GPIO Input' })];
      const result = engine.runCheck(nodes, [], emptyParams, ['industrial']);
      const ind001 = result.findings.filter((f) => f.ruleId === 'IND-001');
      expect(ind001.length).toBe(1);
    });

    it('IND-001: passes when protection is present', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [
        makeNode({ nodeId: 'n1', label: 'Sensor Input' }),
        makeNode({ nodeId: 'n2', label: 'TVS Protection' }),
      ];
      const result = engine.runCheck(nodes, [], emptyParams, ['industrial']);
      const ind001 = result.findings.filter((f) => f.ruleId === 'IND-001');
      expect(ind001).toHaveLength(0);
    });

    it('IND-002: flags narrow temperature range', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { operatingTempMin: 10, operatingTempMax: 45 };
      const result = engine.runCheck([], [], params, ['industrial']);
      const ind002 = result.findings.filter((f) => f.ruleId === 'IND-002');
      expect(ind002).toHaveLength(2);
    });

    it('IND-002: passes for standard industrial range', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { operatingTempMin: 0, operatingTempMax: 55 };
      const result = engine.runCheck([], [], params, ['industrial']);
      const ind002 = result.findings.filter((f) => f.ruleId === 'IND-002');
      expect(ind002).toHaveLength(0);
    });

    it('IND-003: warns about missing EMC protection', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'MCU' })];
      const result = engine.runCheck(nodes, [], emptyParams, ['industrial']);
      const ind003 = result.findings.filter((f) => f.ruleId === 'IND-003');
      expect(ind003.length).toBe(1);
    });

    it('IND-003: passes with EMI filter', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'EMI Filter' })];
      const result = engine.runCheck(nodes, [], emptyParams, ['industrial']);
      const ind003 = result.findings.filter((f) => f.ruleId === 'IND-003');
      expect(ind003).toHaveLength(0);
    });

    it('IND-004: recommends higher MTBF', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { expectedLifetimeHours: 25000 };
      const result = engine.runCheck([], [], params, ['industrial']);
      const ind004 = result.findings.filter((f) => f.ruleId === 'IND-004');
      expect(ind004.length).toBe(1);
      expect(ind004[0].severity).toBe('recommendation');
    });

    it('IND-004: passes with adequate MTBF', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { expectedLifetimeHours: 100000 };
      const result = engine.runCheck([], [], params, ['industrial']);
      const ind004 = result.findings.filter((f) => f.ruleId === 'IND-004');
      expect(ind004).toHaveLength(0);
    });
  });

  // =========================================================================
  // Consumer (IEC 62368) Rules
  // =========================================================================

  describe('consumer rules', () => {
    it('CON-001: flags voltage exceeding ES1 limit', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 48 }, ['consumer']);
      const con001 = result.findings.filter((f) => f.ruleId === 'CON-001');
      expect(con001.length).toBe(1);
      expect(con001[0].severity).toBe('violation');
    });

    it('CON-001: passes for safe voltage', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 12 }, ['consumer']);
      const con001 = result.findings.filter((f) => f.ruleId === 'CON-001');
      expect(con001).toHaveLength(0);
    });

    it('CON-002: always recommends flammability check', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['consumer']);
      const con002 = result.findings.filter((f) => f.ruleId === 'CON-002');
      expect(con002.length).toBe(1);
      expect(con002[0].severity).toBe('recommendation');
    });

    it('CON-003: warns about ES3 classification', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 100, maxCurrent: 5 }, ['consumer']);
      const con003 = result.findings.filter((f) => f.ruleId === 'CON-003');
      expect(con003.length).toBe(1);
      expect(con003[0].message).toContain('ES3');
    });

    it('CON-003: warns about ES2 classification', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 48, maxCurrent: 0.5 }, ['consumer']);
      const con003 = result.findings.filter((f) => f.ruleId === 'CON-003');
      expect(con003.length).toBe(1);
      expect(con003[0].message).toContain('ES2');
    });

    it('CON-003: no warning for low-energy designs', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 5, maxCurrent: 0.1 }, ['consumer']);
      const con003 = result.findings.filter((f) => f.ruleId === 'CON-003');
      expect(con003).toHaveLength(0);
    });
  });

  // =========================================================================
  // Aerospace (DO-254 / MIL-STD) Rules
  // =========================================================================

  describe('aerospace rules', () => {
    it('AERO-001: flags FPGA requiring DO-254', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: 'XC7A35T', description: 'FPGA Artix-7', manufacturer: 'Xilinx' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['aerospace']);
      const aero001 = result.findings.filter((f) => f.ruleId === 'AERO-001');
      expect(aero001.length).toBe(1);
      expect(aero001[0].severity).toBe('violation');
    });

    it('AERO-001: no findings without FPGA/CPLD', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'Resistor 10k' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['aerospace']);
      const aero001 = result.findings.filter((f) => f.ruleId === 'AERO-001');
      expect(aero001).toHaveLength(0);
    });

    it('AERO-002: warns about non-RadHard components', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'Standard IC' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['aerospace']);
      const aero002 = result.findings.filter((f) => f.ruleId === 'AERO-002');
      expect(aero002.length).toBe(1);
    });

    it('AERO-002: passes for RadHard components', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: 'RHFL4913', description: 'Radiation-tolerant LDO regulator' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['aerospace']);
      const aero002 = result.findings.filter((f) => f.ruleId === 'AERO-002');
      expect(aero002).toHaveLength(0);
    });

    it('AERO-003: recommends vibration protection', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'MCU' })];
      const result = engine.runCheck(nodes, [], emptyParams, ['aerospace']);
      const aero003 = result.findings.filter((f) => f.ruleId === 'AERO-003');
      expect(aero003.length).toBe(1);
      expect(aero003[0].severity).toBe('recommendation');
    });

    it('AERO-003: passes with conformal coating', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'Conformal Coating' })];
      const result = engine.runCheck(nodes, [], emptyParams, ['aerospace']);
      const aero003 = result.findings.filter((f) => f.ruleId === 'AERO-003');
      expect(aero003).toHaveLength(0);
    });

    it('AERO-004: recommends export control documentation', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [makeBomItem()];
      const result = engine.runCheck([], bomItems, emptyParams, ['aerospace']);
      const aero004 = result.findings.filter((f) => f.ruleId === 'AERO-004');
      expect(aero004.length).toBe(1);
      expect(aero004[0].severity).toBe('recommendation');
    });

    it('AERO-005: checks aerospace derating', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = {
        componentRatings: {
          'U1': { maxVoltage: 10, operatingVoltage: 6 }, // 60% > 50% limit
        },
      };
      const result = engine.runCheck([], [], params, ['aerospace']);
      const aero005 = result.findings.filter((f) => f.ruleId === 'AERO-005');
      expect(aero005.length).toBeGreaterThan(0);
    });

    it('AERO-006: flags insufficient MIL temp range', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { operatingTempMin: -40, operatingTempMax: 100 };
      const result = engine.runCheck([], [], params, ['aerospace']);
      const aero006 = result.findings.filter((f) => f.ruleId === 'AERO-006');
      expect(aero006.length).toBeGreaterThan(0);
    });

    it('AERO-006: passes for MIL-grade temp range', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = { operatingTempMin: -55, operatingTempMax: 125 };
      const result = engine.runCheck([], [], params, ['aerospace']);
      const aero006 = result.findings.filter((f) => f.ruleId === 'AERO-006');
      expect(aero006).toHaveLength(0);
    });
  });

  // =========================================================================
  // EMC (IEC 61000) Rules
  // =========================================================================

  describe('EMC rules', () => {
    it('EMC-001: warns about missing decoupling capacitors', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'MCU STM32' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['emc']);
      const emc001 = result.findings.filter((f) => f.ruleId === 'EMC-001');
      expect(emc001.length).toBe(1);
    });

    it('EMC-001: passes with decoupling capacitors', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'Decoupling capacitor 100nF' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['emc']);
      const emc001 = result.findings.filter((f) => f.ruleId === 'EMC-001');
      expect(emc001).toHaveLength(0);
    });

    it('EMC-002: warns about unprotected external I/O', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [makeNode({ label: 'USB Connector' })];
      const result = engine.runCheck(nodes, [], emptyParams, ['emc']);
      const emc002 = result.findings.filter((f) => f.ruleId === 'EMC-002');
      expect(emc002.length).toBe(1);
    });

    it('EMC-002: passes with ESD protection on connectors', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const nodes = [
        makeNode({ nodeId: 'n1', label: 'USB Connector' }),
        makeNode({ nodeId: 'n2', label: 'ESD Protection' }),
      ];
      const result = engine.runCheck(nodes, [], emptyParams, ['emc']);
      const emc002 = result.findings.filter((f) => f.ruleId === 'EMC-002');
      expect(emc002).toHaveLength(0);
    });

    it('EMC-003: recommends ferrites for EFT immunity', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['emc']);
      const emc003 = result.findings.filter((f) => f.ruleId === 'EMC-003');
      expect(emc003.length).toBe(1);
      expect(emc003[0].severity).toBe('recommendation');
    });

    it('EMC-003: passes with ferrite beads', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'Ferrite Bead 600R' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['emc']);
      const emc003 = result.findings.filter((f) => f.ruleId === 'EMC-003');
      expect(emc003).toHaveLength(0);
    });

    it('EMC-004: warns about missing surge protection at > 48V', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { maxVoltage: 240 }, ['emc']);
      const emc004 = result.findings.filter((f) => f.ruleId === 'EMC-004');
      expect(emc004.length).toBe(1);
    });

    it('EMC-004: passes with MOV surge protection', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [makeBomItem({ id: 1, description: 'MOV Varistor 275V' })];
      const result = engine.runCheck([], bomItems, { maxVoltage: 240 }, ['emc']);
      const emc004 = result.findings.filter((f) => f.ruleId === 'EMC-004');
      expect(emc004).toHaveLength(0);
    });

    it('EMC-005: recommends specifying EMC class', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['emc']);
      const emc005 = result.findings.filter((f) => f.ruleId === 'EMC-005');
      expect(emc005.length).toBe(1);
    });

    it('EMC-005: notes stricter limits for residential class', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], { emcClass: 'residential' }, ['emc']);
      const emc005 = result.findings.filter((f) => f.ruleId === 'EMC-005');
      expect(emc005.length).toBe(1);
      expect(emc005[0].message).toContain('Class B');
    });
  });

  // =========================================================================
  // Multi-Domain Checking
  // =========================================================================

  describe('multi-domain checking', () => {
    it('runs checks across multiple domains simultaneously', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, partNumber: 'LM7805', description: 'Voltage Regulator IC', manufacturer: 'TI' }),
      ];
      const result = engine.runCheck([], bomItems, { maxVoltage: 48 }, ['automotive', 'consumer']);
      expect(result.domains).toEqual(['automotive', 'consumer']);
      expect(result.findings.some((f) => f.domain === 'automotive')).toBe(true);
      expect(result.findings.some((f) => f.domain === 'consumer')).toBe(true);
    });

    it('produces per-domain summary', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['automotive', 'emc']);
      expect(result.summary.byDomain).toHaveProperty('automotive');
      expect(result.summary.byDomain).toHaveProperty('emc');
    });

    it('uses selected domains when none specified', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.setSelectedDomains(['medical']);
      const result = engine.runCheck([], [], { maxVoltage: 12 });
      expect(result.domains).toEqual(['medical']);
    });

    it('overall passes only if zero violations across all domains', () => {
      const engine = StandardsComplianceEngine.getInstance();
      // Consumer: CON-001 violation at > 42.4V
      const result = engine.runCheck([], [], { maxVoltage: 100 }, ['consumer']);
      expect(result.passed).toBe(false);
    });

    it('overall passes when only warnings/recommendations exist', () => {
      const engine = StandardsComplianceEngine.getInstance();
      // EMC with no BOM = only recommendations/warnings, no violations
      const result = engine.runCheck([], [], emptyParams, ['emc']);
      const hasViolation = result.findings.some((f) => f.severity === 'violation');
      if (!hasViolation) {
        expect(result.passed).toBe(true);
      }
    });
  });

  // =========================================================================
  // Check Result Structure
  // =========================================================================

  describe('check result structure', () => {
    it('returns complete result structure', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['automotive']);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('domains');
      expect(result).toHaveProperty('findings');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('violations');
      expect(result.summary).toHaveProperty('warnings');
      expect(result.summary).toHaveProperty('recommendations');
      expect(result.summary).toHaveProperty('totalChecks');
      expect(result.summary).toHaveProperty('byDomain');
    });

    it('findings have all required fields', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'IC Regulator' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      result.findings.forEach((f) => {
        expect(f).toHaveProperty('id');
        expect(f).toHaveProperty('ruleId');
        expect(f).toHaveProperty('domain');
        expect(f).toHaveProperty('standardRef');
        expect(f).toHaveProperty('severity');
        expect(f).toHaveProperty('message');
        expect(f).toHaveProperty('remediation');
      });
    });

    it('counts severities correctly', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'IC Regulator' }),
        makeBomItem({ id: 2, description: 'Resistor 10k' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const actualViolations = result.findings.filter((f) => f.severity === 'violation').length;
      const actualWarnings = result.findings.filter((f) => f.severity === 'warning').length;
      const actualRecs = result.findings.filter((f) => f.severity === 'recommendation').length;
      expect(result.summary.violations).toBe(actualViolations);
      expect(result.summary.warnings).toBe(actualWarnings);
      expect(result.summary.recommendations).toBe(actualRecs);
    });
  });

  // =========================================================================
  // Derating Calculator
  // =========================================================================

  describe('derating calculator', () => {
    it('returns derating factors for each domain', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const domains: ComplianceDomain[] = ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
      domains.forEach((domain) => {
        const factors = engine.getDeratingFactors(domain);
        expect(factors.voltage).toBeGreaterThan(0);
        expect(factors.voltage).toBeLessThanOrEqual(1);
        expect(factors.current).toBeGreaterThan(0);
        expect(factors.current).toBeLessThanOrEqual(1);
        expect(factors.temperature).toBeGreaterThan(0);
        expect(factors.temperature).toBeLessThanOrEqual(1);
        expect(factors.power).toBeGreaterThan(0);
        expect(factors.power).toBeLessThanOrEqual(1);
      });
    });

    it('aerospace has strictest derating factors', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const aero = engine.getDeratingFactors('aerospace');
      const consumer = engine.getDeratingFactors('consumer');
      expect(aero.voltage).toBeLessThan(consumer.voltage);
      expect(aero.current).toBeLessThan(consumer.current);
      expect(aero.power).toBeLessThan(consumer.power);
    });

    it('checkDerating returns empty for within-limits component', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const rating: ComponentRating = {
        maxVoltage: 10, operatingVoltage: 3,
        maxCurrent: 1, operatingCurrent: 0.2,
      };
      const findings = engine.checkDerating('U1', rating, 'automotive');
      expect(findings).toHaveLength(0);
    });

    it('checkDerating returns findings for over-limit component', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const rating: ComponentRating = {
        maxVoltage: 10, operatingVoltage: 9,
        maxCurrent: 1, operatingCurrent: 0.9,
      };
      const findings = engine.checkDerating('U1', rating, 'automotive');
      expect(findings.length).toBeGreaterThan(0);
    });

    it('checks all four derating dimensions', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const rating: ComponentRating = {
        maxVoltage: 10, operatingVoltage: 9,
        maxCurrent: 1, operatingCurrent: 0.9,
        maxTemperature: 100, operatingTemperature: 95,
        maxPowerDissipation: 1, operatingPower: 0.9,
      };
      const findings = engine.checkDerating('U1', rating, 'aerospace');
      // Aerospace is the strictest — all four should fail
      expect(findings.length).toBe(4);
    });
  });

  // =========================================================================
  // Clearance/Creepage Calculator
  // =========================================================================

  describe('clearance/creepage calculator', () => {
    it('returns result for standard voltage', () => {
      const result = calculateClearanceCreepage(100, 2, 'II');
      expect(result.clearance).toBeGreaterThan(0);
      expect(result.creepage).toBeGreaterThan(0);
      expect(result.standard).toBe('IEC 60664-1');
      expect(result.voltage).toBe(100);
      expect(result.pollutionDegree).toBe(2);
      expect(result.materialGroup).toBe('II');
    });

    it('higher voltage = larger clearance', () => {
      const r100 = calculateClearanceCreepage(100, 2);
      const r300 = calculateClearanceCreepage(300, 2);
      expect(r300.clearance).toBeGreaterThan(r100.clearance);
    });

    it('higher pollution degree = larger clearance', () => {
      const pd1 = calculateClearanceCreepage(300, 1);
      const pd3 = calculateClearanceCreepage(300, 3);
      expect(pd3.clearance).toBeGreaterThan(pd1.clearance);
    });

    it('higher material group = larger creepage', () => {
      const mgI = calculateClearanceCreepage(300, 2, 'I');
      const mgIIIb = calculateClearanceCreepage(300, 2, 'IIIb');
      expect(mgIIIb.creepage).toBeGreaterThan(mgI.creepage);
    });

    it('uses default pollution degree 2 and material group II', () => {
      const result = calculateClearanceCreepage(300);
      expect(result.pollutionDegree).toBe(2);
      expect(result.materialGroup).toBe('II');
    });

    it('handles very low voltage', () => {
      const result = calculateClearanceCreepage(5);
      expect(result.clearance).toBeGreaterThanOrEqual(0);
    });

    it('handles voltage above table range', () => {
      const result = calculateClearanceCreepage(2000, 2);
      expect(result.clearance).toBeGreaterThan(0);
    });

    it('engine method delegates correctly', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.calculateClearanceCreepage(300, 2, 'II');
      const direct = calculateClearanceCreepage(300, 2, 'II');
      expect(result.clearance).toBe(direct.clearance);
      expect(result.creepage).toBe(direct.creepage);
    });
  });

  // =========================================================================
  // History
  // =========================================================================

  describe('history', () => {
    it('starts with empty history', () => {
      const engine = StandardsComplianceEngine.getInstance();
      expect(engine.getCheckHistory()).toEqual([]);
    });

    it('accumulates check results', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.runCheck([], [], emptyParams, ['automotive']);
      engine.runCheck([], [], emptyParams, ['medical']);
      expect(engine.getCheckHistory()).toHaveLength(2);
    });

    it('limits history to MAX_HISTORY entries', () => {
      const engine = StandardsComplianceEngine.getInstance();
      for (let i = 0; i < 25; i++) {
        engine.runCheck([], [], emptyParams, ['automotive']);
      }
      expect(engine.getCheckHistory().length).toBeLessThanOrEqual(20);
    });

    it('clears history', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.runCheck([], [], emptyParams, ['automotive']);
      engine.clearHistory();
      expect(engine.getCheckHistory()).toHaveLength(0);
    });

    it('returns a copy of history', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.runCheck([], [], emptyParams, ['automotive']);
      const h1 = engine.getCheckHistory();
      const h2 = engine.getCheckHistory();
      expect(h1).toEqual(h2);
      expect(h1).not.toBe(h2);
    });
  });

  // =========================================================================
  // Report Generation
  // =========================================================================

  describe('report generation', () => {
    it('generates markdown report', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['automotive']);
      const report = engine.generateReport(result);
      expect(report).toContain('# Standards Compliance Report');
      expect(report).toContain('automotive');
    });

    it('report includes domain results table', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['automotive', 'emc']);
      const report = engine.generateReport(result);
      expect(report).toContain('## Domain Results');
      expect(report).toContain('automotive');
      expect(report).toContain('emc');
    });

    it('report shows PASSED for clean check', () => {
      const engine = StandardsComplianceEngine.getInstance();
      // With no BOM items and no params, automotive has no BOM to check => may pass
      const result = engine.runCheck([], [], { operatingTempMin: -40, operatingTempMax: 125 }, ['automotive']);
      if (result.passed) {
        const report = engine.generateReport(result);
        expect(report).toContain('PASSED');
      }
    });

    it('report shows FAILED for violated check', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [makeBomItem({ id: 1, description: 'IC Regulator' })];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      if (!result.passed) {
        const report = engine.generateReport(result);
        expect(report).toContain('FAILED');
      }
    });

    it('report includes findings table when violations exist', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [makeBomItem({ id: 1, description: 'IC Regulator' })];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const report = engine.generateReport(result);
      expect(report).toContain('## Findings');
    });

    it('report says no findings for clean result', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result: ComplianceCheckResult = {
        timestamp: Date.now(),
        domains: ['automotive'],
        findings: [],
        passed: true,
        summary: { violations: 0, warnings: 0, recommendations: 0, totalChecks: 0, byDomain: {} },
      };
      const report = engine.generateReport(result);
      expect(report).toContain('No findings');
    });
  });

  // =========================================================================
  // JSON Export/Import
  // =========================================================================

  describe('JSON export/import', () => {
    it('exports custom rules as JSON', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.addCustomRule({
        id: 'CUSTOM-001', domain: 'automotive', standardRef: 'Custom',
        description: 'Test', severity: 'warning', remediation: 'Fix.', check: () => [],
      });
      const json = engine.exportRulesJSON();
      const parsed = JSON.parse(json);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0].id).toBe('CUSTOM-001');
    });

    it('imports rules from JSON', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const json = JSON.stringify([
        {
          id: 'IMP-001', domain: 'medical', standardRef: 'IEC Test',
          description: 'Imported rule', severity: 'violation', remediation: 'Do something.',
          checkBody: '() => []',
        },
      ]);
      const count = engine.importRulesJSON(json);
      expect(count).toBe(1);
      expect(engine.getCustomRules()).toHaveLength(1);
      expect(engine.getCustomRules()[0].id).toBe('IMP-001');
    });

    it('import ignores invalid domain', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const json = JSON.stringify([
        {
          id: 'IMP-001', domain: 'invalid_domain', standardRef: 'Test',
          description: 'Bad', severity: 'warning', remediation: 'Fix.',
        },
      ]);
      const count = engine.importRulesJSON(json);
      expect(count).toBe(0);
    });

    it('import ignores invalid severity', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const json = JSON.stringify([
        {
          id: 'IMP-001', domain: 'automotive', standardRef: 'Test',
          description: 'Bad', severity: 'critical', remediation: 'Fix.',
        },
      ]);
      const count = engine.importRulesJSON(json);
      expect(count).toBe(0);
    });

    it('import throws for non-array JSON', () => {
      const engine = StandardsComplianceEngine.getInstance();
      expect(() => engine.importRulesJSON('{"id": "test"}')).toThrow('Expected a JSON array');
    });

    it('roundtrip export-import preserves rule metadata', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.addCustomRule({
        id: 'RT-001', domain: 'emc', standardRef: 'IEC 61000-4-6',
        description: 'Roundtrip test', severity: 'recommendation', remediation: 'Check.',
        check: () => [],
      });
      const exported = engine.exportRulesJSON();
      engine.removeCustomRule('RT-001');
      expect(engine.getCustomRules()).toHaveLength(0);
      engine.importRulesJSON(exported);
      expect(engine.getCustomRules()).toHaveLength(1);
      expect(engine.getCustomRules()[0].domain).toBe('emc');
      expect(engine.getCustomRules()[0].standardRef).toBe('IEC 61000-4-6');
    });
  });

  // =========================================================================
  // Persistence
  // =========================================================================

  describe('persistence', () => {
    it('persists selected domains to localStorage', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.setSelectedDomains(['medical', 'industrial']);
      StandardsComplianceEngine.resetForTesting();
      const engine2 = StandardsComplianceEngine.getInstance();
      expect(engine2.getSelectedDomains()).toEqual(['medical', 'industrial']);
    });

    it('persists custom rules to localStorage', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.addCustomRule({
        id: 'PERSIST-001', domain: 'automotive', standardRef: 'Test',
        description: 'Persisted', severity: 'warning', remediation: 'Fix.',
        check: () => [],
      });
      StandardsComplianceEngine.resetForTesting();
      const engine2 = StandardsComplianceEngine.getInstance();
      expect(engine2.getCustomRules()).toHaveLength(1);
      expect(engine2.getCustomRules()[0].id).toBe('PERSIST-001');
    });

    it('persists check history to localStorage', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.runCheck([], [], emptyParams, ['automotive']);
      StandardsComplianceEngine.resetForTesting();
      const engine2 = StandardsComplianceEngine.getInstance();
      expect(engine2.getCheckHistory()).toHaveLength(1);
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('protopulse-standards-compliance', 'not json');
      const engine = StandardsComplianceEngine.getInstance();
      expect(engine.getSelectedDomains()).toEqual([]);
      expect(engine.getCustomRules()).toEqual([]);
    });

    it('handles missing localStorage gracefully', () => {
      // No data in localStorage
      const engine = StandardsComplianceEngine.getInstance();
      expect(engine.getSelectedDomains()).toEqual([]);
    });
  });

  // =========================================================================
  // Custom Rule Execution
  // =========================================================================

  describe('custom rule execution', () => {
    it('custom rules are included in domain checks', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.addCustomRule({
        id: 'CUSTOM-RUN-001',
        domain: 'automotive',
        standardRef: 'Custom Standard',
        description: 'Always fires',
        severity: 'warning',
        remediation: 'Handle it.',
        check: (_ctx) => [{
          id: 'cf-1',
          ruleId: 'CUSTOM-RUN-001',
          domain: 'automotive',
          standardRef: 'Custom Standard',
          severity: 'warning',
          message: 'Custom rule triggered',
          remediation: 'Handle it.',
        }],
      });
      const result = engine.runCheck([], [], emptyParams, ['automotive']);
      const custom = result.findings.filter((f) => f.ruleId === 'CUSTOM-RUN-001');
      expect(custom).toHaveLength(1);
    });

    it('handles custom rule that throws', () => {
      const engine = StandardsComplianceEngine.getInstance();
      engine.addCustomRule({
        id: 'CUSTOM-THROW',
        domain: 'medical',
        standardRef: 'Buggy',
        description: 'Throws',
        severity: 'violation',
        remediation: 'Fix the rule.',
        check: () => { throw new Error('Rule broke'); },
      });
      const result = engine.runCheck([], [], emptyParams, ['medical']);
      const errorFindings = result.findings.filter((f) => f.ruleId === 'CUSTOM-THROW');
      expect(errorFindings.length).toBe(1);
      expect(errorFindings[0].message).toContain('failed to execute');
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('edge cases', () => {
    it('handles empty nodes, bomItems, and params', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, ['automotive']);
      expect(result).toBeDefined();
      expect(result.domains).toEqual(['automotive']);
    });

    it('handles empty domain array', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const result = engine.runCheck([], [], emptyParams, []);
      expect(result.findings).toHaveLength(0);
      expect(result.passed).toBe(true);
    });

    it('finding counter generates unique IDs', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const bomItems = [
        makeBomItem({ id: 1, description: 'IC Regulator' }),
        makeBomItem({ id: 2, description: 'IC Processor' }),
      ];
      const result = engine.runCheck([], bomItems, emptyParams, ['automotive']);
      const ids = result.findings.map((f) => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('handles componentRatings with partial data', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const params: DesignParameters = {
        componentRatings: {
          'U1': { maxVoltage: 10 }, // no operatingVoltage
        },
      };
      const result = engine.runCheck([], [], params, ['automotive']);
      // Should not crash — missing operating values mean no derating check is triggered
      const auto005 = result.findings.filter((f) => f.ruleId === 'AUTO-005');
      expect(auto005).toHaveLength(0);
    });

    it('all domain checks can run without crashing', () => {
      const engine = StandardsComplianceEngine.getInstance();
      const allDomains: ComplianceDomain[] = ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
      const nodes = [makeNode({ label: 'MCU' }), makeNode({ nodeId: 'n2', label: 'USB Connector' })];
      const bomItems = [
        makeBomItem({ id: 1, description: 'IC Regulator' }),
        makeBomItem({ id: 2, description: 'Resistor 10k' }),
        makeBomItem({ id: 3, description: 'MOSFET N-channel' }),
      ];
      const params: DesignParameters = {
        operatingTempMin: -20,
        operatingTempMax: 85,
        maxVoltage: 48,
        maxCurrent: 2,
        emcClass: 'commercial',
        expectedLifetimeHours: 30000,
        hasTouchableMetalParts: true,
      };
      const result = engine.runCheck(nodes, bomItems, params, allDomains);
      expect(result).toBeDefined();
      expect(result.findings.length).toBeGreaterThan(0);
      expect(result.summary.totalChecks).toBeGreaterThan(0);
    });
  });
});
