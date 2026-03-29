/**
 * Standards Compliance — Engine
 *
 * Singleton compliance engine: manages domains, rules, check execution,
 * history, report generation, JSON export/import, and localStorage persistence.
 */

import type {
  CheckContext,
  ClearanceCreepageResult,
  ComplianceBomItem,
  ComplianceCheckResult,
  ComplianceDomain,
  ComplianceFinding,
  ComplianceNode,
  ComplianceRule,
  ComponentRating,
  DesignParameters,
  DeratingFactors,
  Listener,
  MaterialGroup,
  PollutionDegree,
  SerializedPersistedData,
  SerializedRule,
} from './compliance-types';
import {
  calculateClearanceCreepage,
  DERATING_FACTORS,
  deratingCheck,
  MAX_HISTORY,
  nextFindingId,
  STORAGE_KEY,
} from './compliance-constants';
import { BUILTIN_RULES } from './index';

export class StandardsComplianceEngine {
  private static instance: StandardsComplianceEngine | null = null;

  private selectedDomains: ComplianceDomain[] = [];
  private customRules: ComplianceRule[] = [];
  private history: ComplianceCheckResult[] = [];
  private listeners = new Set<Listener>();

  constructor() {
    this.load();
  }

  static getInstance(): StandardsComplianceEngine {
    if (!StandardsComplianceEngine.instance) {
      StandardsComplianceEngine.instance = new StandardsComplianceEngine();
    }
    return StandardsComplianceEngine.instance;
  }

  static resetForTesting(): void {
    StandardsComplianceEngine.instance = null;
  }

  // -----------------------------------------------------------------------
  // Subscription
  // -----------------------------------------------------------------------

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    this.listeners.forEach((l) => {
      l();
    });
  }

  // -----------------------------------------------------------------------
  // Domain Management
  // -----------------------------------------------------------------------

  getAvailableDomains(): ComplianceDomain[] {
    return ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
  }

  getSelectedDomains(): ComplianceDomain[] {
    return [...this.selectedDomains];
  }

  setSelectedDomains(domains: ComplianceDomain[]): void {
    this.selectedDomains = [...domains];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Rule Management
  // -----------------------------------------------------------------------

  getBuiltinRules(): ComplianceRule[] {
    return [...BUILTIN_RULES];
  }

  getCustomRules(): ComplianceRule[] {
    return [...this.customRules];
  }

  getAllRules(): ComplianceRule[] {
    return [...BUILTIN_RULES, ...this.customRules];
  }

  getRulesForDomains(domains: ComplianceDomain[]): ComplianceRule[] {
    const domainSet = new Set(domains);
    return this.getAllRules().filter((r) => domainSet.has(r.domain));
  }

  addCustomRule(rule: ComplianceRule): void {
    // Overwrite if same id exists
    this.customRules = this.customRules.filter((r) => r.id !== rule.id);
    this.customRules.push(rule);
    this.save();
    this.notify();
  }

  removeCustomRule(id: string): boolean {
    const len = this.customRules.length;
    this.customRules = this.customRules.filter((r) => r.id !== id);
    if (this.customRules.length < len) {
      this.save();
      this.notify();
      return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Compliance Checking
  // -----------------------------------------------------------------------

  runCheck(
    nodes: ComplianceNode[],
    bomItems: ComplianceBomItem[],
    params: DesignParameters,
    domains?: ComplianceDomain[],
  ): ComplianceCheckResult {
    const activeDomains = domains ?? this.selectedDomains;
    const rules = this.getRulesForDomains(activeDomains);

    const ctx: CheckContext = { nodes, bomItems, params, domains: activeDomains };
    const allFindings: ComplianceFinding[] = [];
    let totalChecks = 0;

    rules.forEach((rule) => {
      totalChecks++;
      try {
        const findings = rule.check(ctx);
        allFindings.push(...findings);
      } catch {
        allFindings.push({
          id: nextFindingId(),
          ruleId: rule.id,
          domain: rule.domain,
          standardRef: rule.standardRef,
          severity: 'warning',
          message: `Rule ${rule.id} failed to execute`,
          remediation: 'Check custom rule implementation.',
        });
      }
    });

    const violations = allFindings.filter((f) => f.severity === 'violation').length;
    const warnings = allFindings.filter((f) => f.severity === 'warning').length;
    const recommendations = allFindings.filter((f) => f.severity === 'recommendation').length;

    // Build per-domain summary
    const byDomain: Record<string, { violations: number; warnings: number; recommendations: number; passed: boolean }> = {};
    for (const domain of activeDomains) {
      const domainFindings = allFindings.filter((f) => f.domain === domain);
      const dv = domainFindings.filter((f) => f.severity === 'violation').length;
      const dw = domainFindings.filter((f) => f.severity === 'warning').length;
      const dr = domainFindings.filter((f) => f.severity === 'recommendation').length;
      byDomain[domain] = { violations: dv, warnings: dw, recommendations: dr, passed: dv === 0 };
    }

    const result: ComplianceCheckResult = {
      timestamp: Date.now(),
      domains: [...activeDomains],
      findings: allFindings,
      passed: violations === 0,
      summary: {
        violations,
        warnings,
        recommendations,
        totalChecks,
        byDomain,
      },
    };

    this.history.push(result);
    if (this.history.length > MAX_HISTORY) {
      this.history = this.history.slice(-MAX_HISTORY);
    }
    this.save();
    this.notify();

    return result;
  }

  // -----------------------------------------------------------------------
  // Derating Calculator
  // -----------------------------------------------------------------------

  getDeratingFactors(domain: ComplianceDomain): DeratingFactors {
    return { ...DERATING_FACTORS[domain] };
  }

  checkDerating(
    componentId: string,
    rating: ComponentRating,
    domain: ComplianceDomain,
  ): ComplianceFinding[] {
    const ctx: CheckContext = {
      nodes: [],
      bomItems: [],
      params: { componentRatings: { [componentId]: rating } },
      domains: [domain],
    };
    const ruleId = `DERATE-${domain.toUpperCase()}`;
    const findings = deratingCheck(ctx, domain, ruleId, `Derating per ${domain}`);
    return findings.length > 0 ? findings : [];
  }

  // -----------------------------------------------------------------------
  // Clearance/Creepage
  // -----------------------------------------------------------------------

  calculateClearanceCreepage(
    voltage: number,
    pollutionDegree?: PollutionDegree,
    materialGroup?: MaterialGroup,
  ): ClearanceCreepageResult {
    return calculateClearanceCreepage(voltage, pollutionDegree, materialGroup);
  }

  // -----------------------------------------------------------------------
  // History
  // -----------------------------------------------------------------------

  getCheckHistory(): ComplianceCheckResult[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
    this.save();
    this.notify();
  }

  // -----------------------------------------------------------------------
  // Report Generation
  // -----------------------------------------------------------------------

  generateReport(result: ComplianceCheckResult): string {
    const lines: string[] = [];
    lines.push('# Standards Compliance Report');
    lines.push('');
    lines.push(`**Date:** ${new Date(result.timestamp).toISOString()}`);
    lines.push(`**Domains:** ${result.domains.join(', ')}`);
    lines.push(`**Overall Status:** ${result.passed ? 'PASSED' : 'FAILED'}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Rules Checked | ${result.summary.totalChecks} |`);
    lines.push(`| Violations | ${result.summary.violations} |`);
    lines.push(`| Warnings | ${result.summary.warnings} |`);
    lines.push(`| Recommendations | ${result.summary.recommendations} |`);
    lines.push('');

    lines.push('## Domain Results');
    lines.push('');
    lines.push('| Domain | Status | Violations | Warnings | Recommendations |');
    lines.push('|--------|--------|------------|----------|-----------------|');
    for (const domain of result.domains) {
      const d = result.summary.byDomain[domain];
      if (d) {
        lines.push(`| ${domain} | ${d.passed ? 'PASS' : 'FAIL'} | ${d.violations} | ${d.warnings} | ${d.recommendations} |`);
      }
    }
    lines.push('');

    if (result.findings.length > 0) {
      lines.push('## Findings');
      lines.push('');

      // Group by domain
      for (const domain of result.domains) {
        const domainFindings = result.findings.filter((f) => f.domain === domain);
        if (domainFindings.length === 0) {
          continue;
        }
        lines.push(`### ${domain.charAt(0).toUpperCase() + domain.slice(1)}`);
        lines.push('');
        lines.push('| Severity | Rule | Standard | Message | Remediation |');
        lines.push('|----------|------|----------|---------|-------------|');
        domainFindings.forEach((f) => {
          lines.push(`| ${f.severity.toUpperCase()} | ${f.ruleId} | ${f.standardRef} | ${f.message} | ${f.remediation} |`);
        });
        lines.push('');
      }
    } else {
      lines.push('No findings. Design meets all checked standards.');
      lines.push('');
    }

    return lines.join('\n');
  }

  // -----------------------------------------------------------------------
  // JSON Export/Import
  // -----------------------------------------------------------------------

  exportRulesJSON(): string {
    const serialized: SerializedRule[] = this.customRules.map((r) => ({
      id: r.id,
      domain: r.domain,
      standardRef: r.standardRef,
      description: r.description,
      severity: r.severity,
      checkBody: r.check.toString(),
      remediation: r.remediation,
    }));
    return JSON.stringify(serialized, null, 2);
  }

  importRulesJSON(json: string): number {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) {
      throw new Error('Expected a JSON array of rule definitions');
    }
    let imported = 0;
    for (const entry of parsed) {
      if (
        typeof entry === 'object' && entry !== null
        && typeof (entry as SerializedRule).id === 'string'
        && typeof (entry as SerializedRule).domain === 'string'
        && typeof (entry as SerializedRule).standardRef === 'string'
        && typeof (entry as SerializedRule).description === 'string'
        && typeof (entry as SerializedRule).severity === 'string'
        && typeof (entry as SerializedRule).remediation === 'string'
      ) {
        const sr = entry as SerializedRule;
        const validDomains: ComplianceDomain[] = ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
        const validSeverities: ComplianceSeverity[] = ['violation', 'warning', 'recommendation'];
        if (!validDomains.includes(sr.domain as ComplianceDomain)) {
          continue;
        }
        if (!validSeverities.includes(sr.severity as ComplianceSeverity)) {
          continue;
        }

        // Create a simple check that always returns an empty array for imported rules
        // (the check body is preserved as metadata but not executed for safety)
        const rule: ComplianceRule = {
          id: sr.id,
          domain: sr.domain as ComplianceDomain,
          standardRef: sr.standardRef,
          description: sr.description,
          severity: sr.severity as ComplianceSeverity,
          remediation: sr.remediation,
          check: () => [],
        };
        this.customRules = this.customRules.filter((r) => r.id !== rule.id);
        this.customRules.push(rule);
        imported++;
      }
    }

    if (imported > 0) {
      this.save();
      this.notify();
    }
    return imported;
  }

  // -----------------------------------------------------------------------
  // Persistence
  // -----------------------------------------------------------------------

  private save(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const data: SerializedPersistedData = {
        selectedDomains: this.selectedDomains,
        customRules: this.customRules.map((r) => ({
          id: r.id,
          domain: r.domain,
          standardRef: r.standardRef,
          description: r.description,
          severity: r.severity,
          checkBody: r.check.toString(),
          remediation: r.remediation,
        })),
        history: this.history,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage may be unavailable or quota exceeded
    }
  }

  private load(): void {
    try {
      if (typeof window === 'undefined') {
        return;
      }
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return;
      }
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null) {
        return;
      }

      const data = parsed as SerializedPersistedData;

      if (Array.isArray(data.selectedDomains)) {
        const validDomains: ComplianceDomain[] = ['automotive', 'medical', 'industrial', 'consumer', 'aerospace', 'emc'];
        this.selectedDomains = data.selectedDomains.filter((d: unknown) =>
          typeof d === 'string' && validDomains.includes(d as ComplianceDomain),
        ) as ComplianceDomain[];
      }

      if (Array.isArray(data.customRules)) {
        this.customRules = data.customRules
          .filter((sr: unknown): sr is SerializedRule =>
            typeof sr === 'object' && sr !== null
            && typeof (sr as SerializedRule).id === 'string'
            && typeof (sr as SerializedRule).domain === 'string'
          )
          .map((sr) => ({
            id: sr.id,
            domain: sr.domain,
            standardRef: sr.standardRef,
            description: sr.description,
            severity: sr.severity,
            remediation: sr.remediation,
            check: () => [],
          }));
      }

      if (Array.isArray(data.history)) {
        this.history = data.history.filter(
          (r: unknown): r is ComplianceCheckResult =>
            typeof r === 'object'
            && r !== null
            && typeof (r as ComplianceCheckResult).timestamp === 'number'
            && Array.isArray((r as ComplianceCheckResult).findings)
            && Array.isArray((r as ComplianceCheckResult).domains),
        );
        if (this.history.length > MAX_HISTORY) {
          this.history = this.history.slice(-MAX_HISTORY);
        }
      }
    } catch {
      // Corrupt data — keep defaults
    }
  }
}
