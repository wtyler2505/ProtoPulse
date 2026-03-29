/**
 * Standards Compliance — React Hook
 *
 * Provides reactive access to the StandardsComplianceEngine singleton.
 */

import { useCallback, useEffect, useState } from 'react';

import type {
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
  MaterialGroup,
  PollutionDegree,
} from './compliance-types';
import { StandardsComplianceEngine } from './compliance-engine';

export function useStandardsCompliance(): {
  runCheck: (
    nodes: ComplianceNode[],
    bomItems: ComplianceBomItem[],
    params: DesignParameters,
    domains?: ComplianceDomain[],
  ) => ComplianceCheckResult;
  availableDomains: ComplianceDomain[];
  selectedDomains: ComplianceDomain[];
  setSelectedDomains: (domains: ComplianceDomain[]) => void;
  builtinRules: ComplianceRule[];
  customRules: ComplianceRule[];
  addCustomRule: (rule: ComplianceRule) => void;
  removeCustomRule: (id: string) => boolean;
  history: ComplianceCheckResult[];
  clearHistory: () => void;
  generateReport: (result: ComplianceCheckResult) => string;
  getDeratingFactors: (domain: ComplianceDomain) => DeratingFactors;
  checkDerating: (componentId: string, rating: ComponentRating, domain: ComplianceDomain) => ComplianceFinding[];
  calculateClearanceCreepage: (voltage: number, pollutionDegree?: PollutionDegree, materialGroup?: MaterialGroup) => ClearanceCreepageResult;
  exportRulesJSON: () => string;
  importRulesJSON: (json: string) => number;
} {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const engine = StandardsComplianceEngine.getInstance();
    const unsubscribe = engine.subscribe(() => {
      setTick((t) => t + 1);
    });
    return unsubscribe;
  }, []);

  const runCheck = useCallback(
    (nodes: ComplianceNode[], bomItems: ComplianceBomItem[], params: DesignParameters, domains?: ComplianceDomain[]) => {
      return StandardsComplianceEngine.getInstance().runCheck(nodes, bomItems, params, domains);
    },
    [],
  );

  const setSelectedDomains = useCallback((domains: ComplianceDomain[]) => {
    StandardsComplianceEngine.getInstance().setSelectedDomains(domains);
  }, []);

  const addCustomRule = useCallback((rule: ComplianceRule) => {
    StandardsComplianceEngine.getInstance().addCustomRule(rule);
  }, []);

  const removeCustomRule = useCallback((id: string) => {
    return StandardsComplianceEngine.getInstance().removeCustomRule(id);
  }, []);

  const clearHistory = useCallback(() => {
    StandardsComplianceEngine.getInstance().clearHistory();
  }, []);

  const generateReport = useCallback((result: ComplianceCheckResult) => {
    return StandardsComplianceEngine.getInstance().generateReport(result);
  }, []);

  const getDeratingFactors = useCallback((domain: ComplianceDomain) => {
    return StandardsComplianceEngine.getInstance().getDeratingFactors(domain);
  }, []);

  const checkDerating = useCallback((componentId: string, rating: ComponentRating, domain: ComplianceDomain) => {
    return StandardsComplianceEngine.getInstance().checkDerating(componentId, rating, domain);
  }, []);

  const calcClearanceCreepage = useCallback(
    (voltage: number, pollutionDegree?: PollutionDegree, materialGroup?: MaterialGroup) => {
      return StandardsComplianceEngine.getInstance().calculateClearanceCreepage(voltage, pollutionDegree, materialGroup);
    },
    [],
  );

  const exportRulesJSON = useCallback(() => {
    return StandardsComplianceEngine.getInstance().exportRulesJSON();
  }, []);

  const importRulesJSON = useCallback((json: string) => {
    return StandardsComplianceEngine.getInstance().importRulesJSON(json);
  }, []);

  const engine = typeof window !== 'undefined' ? StandardsComplianceEngine.getInstance() : null;

  return {
    runCheck,
    availableDomains: engine?.getAvailableDomains() ?? [],
    selectedDomains: engine?.getSelectedDomains() ?? [],
    setSelectedDomains,
    builtinRules: engine?.getBuiltinRules() ?? [],
    customRules: engine?.getCustomRules() ?? [],
    addCustomRule,
    removeCustomRule,
    history: engine?.getCheckHistory() ?? [],
    clearHistory,
    generateReport,
    getDeratingFactors,
    checkDerating,
    calculateClearanceCreepage: calcClearanceCreepage,
    exportRulesJSON,
    importRulesJSON,
  };
}
