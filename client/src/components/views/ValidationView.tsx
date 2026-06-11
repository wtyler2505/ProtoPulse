import { useState, useMemo, useCallback } from 'react';
import { useValidation } from '@/lib/contexts/validation-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectMeta } from '@/lib/project-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, AlertCircle, CheckCircle2, XCircle, ShieldOff, Code2 } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { validatePart } from '@/lib/component-editor/validation';
import { runDRC } from '@/lib/component-editor/drc';
import type { DRCRule } from '@shared/component-types';
import { useCircuitDesigns, useCircuitInstances, useCircuitNets } from '@/lib/circuit-editor/hooks';
import { runERC } from '@/lib/circuit-editor/erc-engine';
import type { ERCInput } from '@/lib/circuit-editor/erc-engine';
import { DEFAULT_ERC_RULES, DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { CircuitSettings } from '@shared/circuit-types';
import type { ComponentPart } from '@shared/schema';
import { DrcPresetSelector } from '@/components/views/DrcPresetSelector';
import DesignDecayCard from '@/components/circuit-editor/DesignDecayCard';
import JustInTimeSkillCard from '@/components/circuit-editor/JustInTimeSkillCard';
import JitRunHistoryPanel from '@/components/circuit-editor/JitRunHistoryPanel';
import { applyPreset, DRC_PRESETS } from '@/lib/drc-presets';
import type { DrcPresetId } from '@/lib/drc-presets';
import { useDesignGateway } from '@/lib/design-gateway';
import type { DesignState } from '@/lib/design-gateway';
import { useStandardsCompliance } from '@/lib/standards-compliance';
import { useDfmChecker, bomToDfmInput } from '@/lib/dfm-checker';
import { useDrcScripts } from '@/lib/drc-scripting';
import type { DfmCheckResult } from '@/lib/dfm-checker';
import type { ScriptDesignData } from '@/lib/drc-scripting';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { validateBomCompleteness } from '@/lib/bom-validation';
import { useDrcSuppression } from '@/lib/drc-suppression';
import { DrcSuppressionDialog } from '@/components/views/DrcSuppressionDialog';
import type { DrcSuppressionTarget } from '@/components/views/DrcSuppressionDialog';
import { RemediationWizardDialog } from '@/components/views/RemediationWizardDialog';
import { getRecipe } from '@/lib/remediation-wizard';
import type { RemediationRecipe } from '@/lib/remediation-wizard';
import { ManufacturerRuleCompare } from '@/components/views/ManufacturerRuleCompare';
import SchemaViewerPanel from '@/components/views/SchemaViewerPanel';
import { getTopDesignDecayRecommendation } from '@/lib/design-decay';
import { getTopJustInTimeSkill } from '@/lib/just-in-time-skills';
import { runExportPrecheck } from '@/lib/export-precheck';
import type { PrecheckResult, PrecheckStatus } from '@/lib/export-precheck';
import type { ProjectExportData } from '@/lib/export-validation';
import { buildValidationSafetyGateData } from '@/lib/validation-safety-gates';
import { TrustBadge, type TrustBadgeKind } from '@/components/ui/TrustBadge';

import { toPartState } from './validation/validation-helpers';
import { ValidationErrorBoundary } from './validation/ValidationErrorBoundary';
import { DesignGatewaySection } from './validation/DesignGatewaySection';
import { DfmCheckSection } from './validation/DfmCheckSection';
import { BomCompletenessSection } from './validation/BomCompletenessSection';
import { CustomRulesDialog, ScriptResultsSection } from './validation/CustomRulesDialog';
import { VirtualizedIssueList, ActivityIcon } from './validation/VirtualizedIssueList';

export default function ValidationView() {
  return (
    <ValidationErrorBoundary>
      <ValidationViewContent />
    </ValidationErrorBoundary>
  );
}

const VALIDATION_SAFETY_GATE_NAMES = [
  'AI-Generated Circuit Provenance',
  'Exact-Part Verification',
  'Verified Mechanical Models',
  'Breadboard Health',
  'Lifecycle Risk',
  'Inventory Confidence',
] as const;

function safetyGateId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function safetyGateKind(status: PrecheckStatus): TrustBadgeKind {
  if (status === 'pass') {
    return 'verified';
  }
  if (status === 'fail') {
    return 'unverified';
  }
  return 'estimated';
}

function safetyGateLabel(status: PrecheckStatus): string {
  if (status === 'pass') {
    return 'PASS';
  }
  if (status === 'fail') {
    return 'BLOCKED';
  }
  return 'WARN';
}

function SafetyGateIcon({ status }: { status: PrecheckStatus }) {
  if (status === 'pass') {
    return <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />;
  }
  if (status === 'fail') {
    return <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" />;
  }
  return <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-yellow-500" />;
}

function ValidationSafetyGateSection({ checks }: { checks: readonly PrecheckResult[] }) {
  const blockerCount = checks.filter((check) => check.status === 'fail').length;
  const warningCount = checks.filter((check) => check.status === 'warn').length;
  const summaryKind: TrustBadgeKind = blockerCount > 0 ? 'unverified' : warningCount > 0 ? 'estimated' : 'verified';
  const summaryLabel = blockerCount > 0 ? 'BLOCKED' : warningCount > 0 ? 'REVIEW' : 'CLEAR';
  const summaryText = blockerCount > 0
    ? `${blockerCount} blocked safety gate${blockerCount === 1 ? '' : 's'} must be resolved before release.`
    : warningCount > 0
      ? `${warningCount} safety gate${warningCount === 1 ? '' : 's'} need review before release.`
      : 'All visible release safety gates are clear.';

  return (
    <section
      data-testid="validation-safety-gates"
      className="mb-2.5 w-full max-w-5xl border border-border bg-card/40 px-3 py-2.5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Safety Gates</h3>
            <TrustBadge kind={summaryKind} label={summaryLabel} />
          </div>
          <p data-testid="validation-safety-gate-summary" className="mt-1 text-xs text-muted-foreground">
            {summaryText}
          </p>
        </div>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-2">
        {checks.map((check) => (
          <div
            key={check.name}
            data-testid={`validation-safety-gate-${safetyGateId(check.name)}`}
            className="min-w-0 border border-border/70 bg-background/40 px-2.5 py-2"
          >
            <div className="flex min-w-0 items-start gap-2">
              <SafetyGateIcon status={check.status} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">{check.name}</span>
                  <TrustBadge kind={safetyGateKind(check.status)} label={safetyGateLabel(check.status)} />
                </div>
                <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{check.message}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ValidationViewContent() {
  const { issues, runValidation, deleteValidationIssue } = useValidation();
  const { addOutputLog } = useOutput();
  const { setActiveView } = useProjectMeta();
  const { focusNode, nodes: archNodes } = useArchitecture();
  const { toast } = useToast();
  const [pendingDismissId, setPendingDismissId] = useState<number | string | null>(null);
  const projectId = useProjectId();

  // Standards Compliance (BL-0581)
  const { runCheck: runStandardsCheck, selectedDomains, setSelectedDomains, availableDomains } = useStandardsCompliance();
  const [complianceResult, setComplianceResult] = useState<ReturnType<typeof runStandardsCheck> | null>(null);

  // DRC Suppression (BL-0252)
  const { suppressions, suppress, isSuppressed, activeCount: suppressionCount } = useDrcSuppression(projectId);
  const [suppressTarget, setSuppressTarget] = useState<DrcSuppressionTarget | null>(null);
  const [suppressDialogOpen, setSuppressDialogOpen] = useState(false);

  const handleOpenSuppress = useCallback((target: DrcSuppressionTarget) => {
    setSuppressTarget(target);
    setSuppressDialogOpen(true);
  }, []);

  // Remediation Wizard (BL-0253)
  const [wizardRecipe, setWizardRecipe] = useState<RemediationRecipe | null>(null);
  const [wizardViolationMessage, setWizardViolationMessage] = useState('');
  const [wizardViolationId, setWizardViolationId] = useState('');

  const handleOpenWizard = useCallback((ruleType: string, violationMessage: string, violationId: string) => {
    const recipe = getRecipe(ruleType);
    if (recipe) {
      setWizardRecipe(recipe);
      setWizardViolationMessage(violationMessage);
      setWizardViolationId(violationId);
    }
  }, []);

  const handleCloseWizard = useCallback(() => {
    setWizardRecipe(null);
    setWizardViolationMessage('');
    setWizardViolationId('');
  }, []);

  const handleSuppress = useCallback((input: Parameters<typeof suppress>[0]) => {
    suppress(input);
    toast({ title: 'Violation Suppressed', description: `"${suppressTarget?.ruleId}" suppressed. It will be hidden from the validation list.` });
  }, [suppress, toast, suppressTarget]);
  const { data: componentParts } = useComponentParts(projectId);

  // Real project data for validation checks
  const { nodes, edges } = useArchitecture();
  const { bom } = useBom();

  const complianceNodes = useMemo(() => nodes.map(n => ({
    nodeId: String(n.id),
    label: typeof n.data?.label === 'string' ? n.data.label : String(n.id),
    nodeType: n.type ?? 'default',
    data: n.data as Record<string, unknown> | null,
  })), [nodes]);

  const complianceBom = useMemo(() => bom.map(b => ({
    id: Number(b.id),
    partNumber: b.partNumber,
    manufacturer: b.manufacturer,
    description: b.description,
    quantity: b.quantity,
    unitPrice: String(b.unitPrice),
    totalPrice: String(b.totalPrice),
    supplier: b.supplier ?? 'Unknown',
    status: b.status,
  })), [bom]);

  // Build DesignState for gateway from real architecture + BOM data
  const gatewayDesignState = useMemo((): DesignState => ({
    nodes: nodes.map((n) => ({
      id: String(n.id),
      label: typeof n.data?.label === 'string' ? n.data.label : String(n.id),
      type: n.type ?? 'default',
      properties: (n.data && typeof n.data === 'object' ? Object.fromEntries(
        Object.entries(n.data as Record<string, unknown>).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v as string])
      ) : {}) as Record<string, string>,
    })),
    edges: edges.map((e) => ({
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
      label: typeof e.label === 'string' ? e.label : undefined,
      signalType: typeof e.data?.signalType === 'string' ? e.data.signalType : undefined,
      voltage: typeof e.data?.voltage === 'string' ? e.data.voltage : undefined,
    })),
    bomItems: bom.map((b) => ({
      id: String(b.id),
      partNumber: b.partNumber,
      description: b.description,
      quantity: b.quantity,
    })),
  }), [nodes, edges, bom]);

  // Build ScriptDesignData for custom DRC scripts from real data
  const scriptDesignData = useMemo((): ScriptDesignData => ({
    nodes: nodes.map((n) => ({
      id: String(n.id),
      label: typeof n.data?.label === 'string' ? n.data.label : String(n.id),
      type: n.type ?? 'default',
      x: n.position?.x ?? 0,
      y: n.position?.y ?? 0,
      width: typeof (n as { measured?: { width?: unknown } }).measured?.width === 'number'
        ? (n as { measured?: { width?: number } }).measured!.width!
        : (typeof (n as { width?: unknown }).width === 'number' ? (n as { width?: number }).width! : 150),
      height: typeof (n as { measured?: { height?: unknown } }).measured?.height === 'number'
        ? (n as { measured?: { height?: number } }).measured!.height!
        : (typeof (n as { height?: unknown }).height === 'number' ? (n as { height?: number }).height! : 50),
      properties: (n.data && typeof n.data === 'object' ? Object.fromEntries(
        Object.entries(n.data as Record<string, unknown>).filter(([, v]) => typeof v === 'string').map(([k, v]) => [k, v as string])
      ) : {}) as Record<string, string>,
    })),
    edges: edges.map((e) => ({
      source: String(e.source),
      target: String(e.target),
      label: typeof e.label === 'string' ? e.label : undefined,
    })),
    bomItems: bom.map((b) => ({
      name: b.description || b.partNumber,
      category: b.supplier ?? 'Unknown',
      value: b.partNumber,
      quantity: b.quantity,
    })),
  }), [nodes, edges, bom]);

  // BOM Completeness Validation
  const bomCompletionIssues = useMemo(() => {
    if (bom.length === 0) { return []; }
    return validateBomCompleteness(bom.map((b) => ({
      id: b.id,
      partNumber: b.partNumber,
      manufacturer: b.manufacturer,
      description: b.description,
      quantity: b.quantity,
      unitPrice: b.unitPrice,
    })));
  }, [bom]);

  const bomWarningCount = bomCompletionIssues.filter((i) => i.severity === 'warning').length;
  const bomInfoCount = bomCompletionIssues.filter((i) => i.severity === 'info').length;

  // Design Gateway
  const { violations: gatewayViolations, validate: runGateway, enableRule: enableGatewayRule, disableRule: disableGatewayRule, rules: gatewayRules } = useDesignGateway();

  // DFM Checker
  const { runCheckAgainstFab, availableFabs, history: dfmHistory, clearHistory: clearDfmHistory, exportReport: exportDfmReport } = useDfmChecker();
  const [selectedFab, setSelectedFab] = useState('');
  const [dfmResult, setDfmResult] = useState<DfmCheckResult | null>(null);

  // Custom DRC Scripts
  const { scripts, results: scriptResults, runScript, runAllEnabled, addScript, updateScript, deleteScript } = useDrcScripts();
  const [customRulesOpen, setCustomRulesOpen] = useState(false);

  const handleRunValidation = useCallback(() => {
    runValidation();
    const result = runStandardsCheck(complianceNodes, complianceBom, { maxVoltage: 24, maxCurrent: 2 }, selectedDomains);
    setComplianceResult(result);
    toast({ title: 'Validation Running', description: 'Design rule and compliance checks initiated.' });
  }, [runValidation, runStandardsCheck, complianceNodes, complianceBom, selectedDomains, toast]);

  const handleRunGateway = useCallback(() => {
    runGateway(gatewayDesignState);
    toast({ title: 'Design Gateway', description: 'Proactive design checks completed.' });
  }, [runGateway, gatewayDesignState, toast]);

  const handleRunDfm = useCallback(() => {
    if (!selectedFab) {
      toast({ title: 'Select a Fab', description: 'Choose a fab house before running DFM check.', variant: 'destructive' });
      return;
    }
    const dummyDesign = {
      traces: [],
      drills: [],
      vias: [],
      pads: [],
      board: { width: 100, height: 100, thickness: 1.6, layerCount: 2 },
      silkscreen: [],
      solderMask: [],
      copperWeight: '1oz',
      surfaceFinish: 'HASL',
    };
    const result = runCheckAgainstFab(dummyDesign, selectedFab);
    setDfmResult(result);
    toast({ title: 'DFM Check Complete', description: result.passed ? 'All checks passed!' : `Found ${result.violations.length} violation(s).` });
  }, [selectedFab, runCheckAgainstFab, toast]);

  const handleRunDfmFromBom = useCallback(() => {
    if (!selectedFab) {
      toast({ title: 'Select a Fab', description: 'Choose a fab house before running DFM check.', variant: 'destructive' });
      return;
    }
    if (!bom || bom.length === 0) {
      toast({ title: 'No BOM Data', description: 'Add components to your BOM before running a DFM check from BOM.', variant: 'destructive' });
      return;
    }
    const bomItems = bom.map((item) => ({
      partNumber: item.partNumber,
      description: item.description,
      manufacturer: item.manufacturer,
      quantity: item.quantity,
    }));
    const designData = bomToDfmInput(bomItems);
    const result = runCheckAgainstFab(designData, selectedFab);
    setDfmResult(result);
    toast({ title: 'DFM Check from BOM', description: result.passed ? 'All checks passed!' : `Found ${result.violations.length} violation(s).` });
  }, [selectedFab, bom, runCheckAgainstFab, toast]);

  const componentIssues = useMemo(() => {
    if (!componentParts || componentParts.length === 0) { return []; }
    return componentParts.flatMap((part) => {
      const partState = toPartState(part);
      const partName = partState.meta.title || `Part #${part.id}`;
      return validatePart(partState).map((issue) => ({
        id: issue.id,
        severity: issue.severity,
        message: issue.message,
        suggestion: issue.suggestion,
        componentId: partName,
      }));
    });
  }, [componentParts]);

  // DRC preset state (BL-0250)
  const [activePreset, setActivePreset] = useState<DrcPresetId>('general');
  const [drcRules, setDrcRules] = useState(() => applyPreset('general'));

  const handlePresetApply = useCallback((presetId: DrcPresetId, rules: DRCRule[]) => {
    setActivePreset(presetId);
    setDrcRules(rules);
    toast({ title: 'DRC Preset Applied', description: `Switched to "${DRC_PRESETS.find((p) => p.id === presetId)?.name ?? presetId}" rules.` });
  }, [toast]);

  // Manufacturer rule comparison apply (BL-0251)
  const handleApplyManufacturerRules = useCallback((rules: DRCRule[]) => {
    setDrcRules(rules);
    toast({ title: 'Manufacturer Rules Applied', description: 'DRC rules updated to match the selected manufacturer\'s design capabilities.' });
  }, [toast]);

  // DRC violations from component part geometry
  const drcIssues = useMemo(() => {
    if (!componentParts || componentParts.length === 0) { return []; }
    const views = ['breadboard', 'schematic', 'pcb'] as const;
    return componentParts.flatMap((part) => {
      const partState = toPartState(part);
      const partName = partState.meta.title || `Part #${part.id}`;
      return views.flatMap((view) => {
        if (!partState.views[view]?.shapes?.length) { return []; }
        return runDRC(partState, drcRules, view).map((v) => ({
          id: v.id,
          severity: v.severity,
          message: v.message,
          ruleType: v.ruleType,
          view,
          componentId: partName,
        }));
      });
    });
  }, [componentParts, drcRules]);

  // ERC violations from circuit schematics
  const { data: circuits } = useCircuitDesigns(projectId);
  const firstCircuitId = circuits?.[0]?.id ?? 0;
  const { data: circuitInstances } = useCircuitInstances(firstCircuitId);
  const { data: circuitNets } = useCircuitNets(firstCircuitId);

  const ercViolations = useMemo(() => {
    if (!circuitInstances || circuitInstances.length === 0 || !componentParts) { return []; }

    const partsMap = new Map<number, ComponentPart>();
    componentParts.forEach((p: ComponentPart) => partsMap.set(p.id, p));

    const circuitSettings: CircuitSettings = {
      ...DEFAULT_CIRCUIT_SETTINGS,
      ...(circuits?.[0]?.settings as Partial<CircuitSettings> | null),
    };

    const input: ERCInput = {
      instances: circuitInstances,
      nets: circuitNets ?? [],
      partsMap,
      settings: circuitSettings,
      rules: DEFAULT_ERC_RULES,
    };

    return runERC(input);
  }, [circuitInstances, circuitNets, componentParts, circuits]);

  const validationSafetyGateData = useMemo(
    () =>
      buildValidationSafetyGateData({
        circuitInstances: circuitInstances ?? [],
        componentParts: componentParts ?? [],
        bomItems: bom,
      }),
    [circuitInstances, componentParts, bom],
  );

  const validationSafetyProjectData = useMemo((): ProjectExportData => ({
    projectName: 'Current project',
    hasSession: true,
    architectureNodeCount: nodes.length,
    hasCircuitInstances: (circuitInstances?.length ?? 0) > 0,
    hasPcbLayout: (circuitInstances ?? []).some((instance) => instance.pcbX != null && instance.pcbY != null),
    bomItemCount: bom.length,
    bomItemsWithPartNumber: bom.filter((item) => item.partNumber.trim().length > 0).length,
    hasCircuitSource: (circuitInstances ?? []).some((instance) => /^[VI]/i.test(instance.referenceDesignator)),
    hasCircuitComponent: (circuitInstances?.length ?? 0) > 0,
    hasBoardProfile: true,
    bomItemsWithFailureData: 0,
    ...validationSafetyGateData,
  }), [nodes.length, circuitInstances, bom, validationSafetyGateData]);

  const safetyGateChecks = useMemo(() => {
    const names = new Set<string>(VALIDATION_SAFETY_GATE_NAMES);
    const checksByName = new Map<string, PrecheckResult>();
    for (const format of ['fab-package', 'step']) {
      for (const check of runExportPrecheck(format, validationSafetyProjectData).checks) {
        if (names.has(check.name) && !checksByName.has(check.name)) {
          checksByName.set(check.name, check);
        }
      }
    }
    return VALIDATION_SAFETY_GATE_NAMES.map((name) => checksByName.get(name)).filter((check): check is PrecheckResult => Boolean(check));
  }, [validationSafetyProjectData]);

  // Severity filter state (BL-0058)
  const [severityFilter, setSeverityFilter] = useState<Record<string, boolean>>({ error: true, warning: true, info: true });

  const toggleSeverity = useCallback((sev: string) => {
    setSeverityFilter((prev) => ({ ...prev, [sev]: !prev[sev] }));
  }, []);

  // Filter all issue arrays by severity + suppression (BL-0252)
  const filteredIssues = useMemo(() => issues.filter((i) => severityFilter[i.severity] !== false && !isSuppressed('arch', String(i.id))), [issues, severityFilter, isSuppressed, suppressions]);
  const filteredComponentIssues = useMemo(() => componentIssues.filter((i) => severityFilter[i.severity] !== false && !isSuppressed('comp', i.id)), [componentIssues, severityFilter, isSuppressed, suppressions]);
  const filteredDrcIssues = useMemo(() => drcIssues.filter((i) => severityFilter[i.severity] !== false && !isSuppressed(i.ruleType, i.id)), [drcIssues, severityFilter, isSuppressed, suppressions]);
  const filteredErcViolations = useMemo(() => ercViolations.filter((v) => severityFilter[v.severity] !== false && !isSuppressed(v.ruleType, v.id)), [ercViolations, severityFilter, isSuppressed, suppressions]);
  const safetyGateIssues = useMemo(
    () => safetyGateChecks.filter((check) => check.status !== 'pass'),
    [safetyGateChecks],
  );
  const filteredSafetyGateIssues = useMemo(
    () => safetyGateIssues.filter((check) => severityFilter[check.status === 'fail' ? 'error' : 'warning'] !== false),
    [safetyGateIssues, severityFilter],
  );
  const topDecayRecommendation = useMemo(() => getTopDesignDecayRecommendation(filteredErcViolations), [filteredErcViolations]);
  const topSkillRecommendation = useMemo(() => getTopJustInTimeSkill(filteredErcViolations), [filteredErcViolations]);

  const totalIssues = issues.length + componentIssues.length + drcIssues.length + ercViolations.length + safetyGateIssues.length;
  const filteredTotal = filteredIssues.length + filteredComponentIssues.length + filteredDrcIssues.length + filteredErcViolations.length + filteredSafetyGateIssues.length;

  // Count by severity across all issue types
  const severityCounts = useMemo(() => {
    const all = [
      ...issues.map((i) => i.severity),
      ...componentIssues.map((i) => i.severity),
      ...drcIssues.map((i) => i.severity),
      ...ercViolations.map((v) => v.severity),
      ...safetyGateIssues.map((check) => check.status === 'fail' ? 'error' : 'warning'),
    ];
    return { error: all.filter((s) => s === 'error').length, warning: all.filter((s) => s === 'warning').length, info: all.filter((s) => s === 'info').length };
  }, [issues, componentIssues, drcIssues, ercViolations, safetyGateIssues]);

  const getIcon = (severity: string) => {
    switch (severity) {
      case 'error': return <XCircle className="w-5 h-5 text-destructive" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'info': return <AlertCircle className="w-5 h-5 text-primary" />;
      default: return null;
    }
  };

  // BL-0232: Focus architecture node when clicking a validation issue row
  const handleIssueFocus = useCallback((componentId: string | undefined) => {
    if (!componentId) {
      setActiveView('architecture');
      return;
    }
    const nodeById = archNodes.find((n) => String(n.id) === componentId);
    if (nodeById) {
      focusNode(String(nodeById.id));
      return;
    }
    const nodeByLabel = archNodes.find((n) => {
      const label = (n.data as Record<string, unknown> | undefined)?.label;
      return typeof label === 'string' && label === componentId;
    });
    if (nodeByLabel) {
      focusNode(String(nodeByLabel.id));
      return;
    }
    setActiveView('architecture');
  }, [archNodes, focusNode, setActiveView]);

  return (
    <div className="flex h-full flex-col items-center bg-background/50 p-3 md:p-4">
      <div className="mb-2.5 flex w-full max-w-5xl flex-col justify-between gap-2.5 md:mb-3 md:flex-row md:items-center">
        <div>
          <h2 className="flex items-center gap-1.5 text-base font-display font-bold md:text-lg">
             <ActivityIcon />
             System Validation
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filteredTotal === totalIssues
              ? `Found ${totalIssues} potential issues in your design.`
              : `Showing ${filteredTotal} of ${totalIssues} issues.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button data-testid="open-custom-rules" variant="outline" size="sm" className="h-8.5 px-3 text-xs" onClick={() => { setCustomRulesOpen(true); }}>
            <Code2 className="w-3 h-3 mr-1" />
            Custom Rules
          </Button>
          <StyledTooltip content="Run design rule validation checks" side="bottom">
              <button
                data-testid="run-drc-checks"
                onClick={handleRunValidation}
                className="h-8.5 rounded-sm px-3.5 text-xs bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-[0_0_12px_rgba(6,182,212,0.3)] hover:shadow-[0_0_18px_rgba(6,182,212,0.45)] focus-ring"
              >
                Run DRC Checks
              </button>
          </StyledTooltip>
        </div>
      </div>

      {/* DRC Preset Selector (BL-0250) */}
      <div className="mb-2.5 w-full max-w-5xl border border-border bg-card/30 px-3 py-1.5 backdrop-blur-sm" data-testid="drc-preset-bar">
        <DrcPresetSelector activePreset={activePreset} onApply={handlePresetApply} />
      </div>
      {topDecayRecommendation ? (
        <div className="mb-2 w-full max-w-5xl">
          <DesignDecayCard recommendation={topDecayRecommendation} />
        </div>
      ) : null}
      {topSkillRecommendation ? (
        <div className="mb-2 w-full max-w-5xl">
          <JustInTimeSkillCard recommendation={topSkillRecommendation} />
        </div>
      ) : null}
      <div className="mb-2.5 w-full max-w-5xl">
        <JitRunHistoryPanel />
      </div>
      <ValidationSafetyGateSection checks={safetyGateChecks} />

      <div className="flex min-h-[18rem] w-full max-w-5xl flex-1 flex-col overflow-hidden border border-border bg-card/40 shadow-lg backdrop-blur-xl md:min-h-[20rem]">
        {/* Severity filter bar (BL-0058) */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/5 px-2.5 py-1.5" data-testid="severity-filter-bar">
          <span className="mr-1 text-[11px] font-semibold text-muted-foreground">Filter:</span>
          <button
            data-testid="filter-error"
            onClick={() => { toggleSeverity('error'); }}
            className={cn(
              'flex h-7 items-center gap-1.5 border px-2.5 text-xs font-medium transition-colors',
              severityFilter.error
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border bg-transparent text-muted-foreground/50',
            )}
          >
            <XCircle className="w-3.5 h-3.5" />
            Errors ({severityCounts.error})
          </button>
          <button
            data-testid="filter-warning"
            onClick={() => { toggleSeverity('warning'); }}
            className={cn(
              'flex h-7 items-center gap-1.5 border px-2.5 text-xs font-medium transition-colors',
              severityFilter.warning
                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500'
                : 'border-border bg-transparent text-muted-foreground/50',
            )}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Warnings ({severityCounts.warning})
          </button>
          <button
            data-testid="filter-info"
            onClick={() => { toggleSeverity('info'); }}
            className={cn(
              'flex h-7 items-center gap-1.5 border px-2.5 text-xs font-medium transition-colors',
              severityFilter.info
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-transparent text-muted-foreground/50',
            )}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            Info ({severityCounts.info})
          </button>
        </div>

        <div className="hidden items-center gap-4 border-b border-border bg-muted/10 px-3 py-2.5 text-[11px] font-semibold text-muted-foreground backdrop-blur md:flex">
           <div className="w-8 text-center">Sev</div>
           <div className="flex-1">Description</div>
           <div className="w-32">Component</div>
           <div className="w-32">Action</div>
        </div>

        <VirtualizedIssueList
          issues={filteredIssues}
          componentIssues={filteredComponentIssues}
          drcIssues={filteredDrcIssues}
          ercIssues={filteredErcViolations.map((v) => ({ id: v.id, severity: v.severity, message: v.message, ruleType: v.ruleType }))}
          safetyGateIssues={filteredSafetyGateIssues}
          complianceResult={complianceResult}
          hasComponentParts={!!componentParts && componentParts.length > 0}
          getIcon={getIcon}
          deleteValidationIssue={deleteValidationIssue}
          addOutputLog={addOutputLog}
          setActiveView={setActiveView}
          setPendingDismissId={setPendingDismissId}
          runValidation={handleRunValidation}
          toast={toast}
          onIssueFocus={handleIssueFocus}
          onSuppress={handleOpenSuppress}
          onFix={handleOpenWizard}
        />
      </div>

      {/* Remediation Wizard Dialog (BL-0253) */}
      <RemediationWizardDialog
        recipe={wizardRecipe}
        violationMessage={wizardViolationMessage}
        violationId={wizardViolationId}
        onClose={handleCloseWizard}
        onNavigate={setActiveView}
      />

      {/* Design Gateway + DFM sections side by side */}
      <div className="mt-2.5 grid w-full max-w-5xl grid-cols-1 gap-2.5 md:grid-cols-2">
        <DesignGatewaySection
          gatewayRules={gatewayRules}
          gatewayViolations={gatewayViolations}
          enableGatewayRule={enableGatewayRule}
          disableGatewayRule={disableGatewayRule}
          onRun={handleRunGateway}
        />
        <DfmCheckSection
          selectedFab={selectedFab}
          setSelectedFab={setSelectedFab}
          availableFabs={availableFabs}
          dfmResult={dfmResult}
          dfmHistory={dfmHistory}
          clearDfmHistory={clearDfmHistory}
          onRunDfm={handleRunDfm}
          onRunDfmFromBom={handleRunDfmFromBom}
          setActiveView={setActiveView}
        />
      </div>
      <div className="mt-2.5 w-full max-w-5xl">
        <SchemaViewerPanel />
      </div>

      {/* Manufacturer Rule Compare (BL-0251) */}
      <div className="mt-2.5 w-full max-w-5xl">
        <ManufacturerRuleCompare currentRules={drcRules} onApplyRules={handleApplyManufacturerRules} />
      </div>

      {/* Custom DRC Scripts results */}
      <ScriptResultsSection scriptResults={scriptResults} scripts={scripts} />

      {/* BOM Completeness (BL-0580) */}
      <BomCompletenessSection
        bomLength={bom.length}
        bomCompletionIssues={bomCompletionIssues}
        bomWarningCount={bomWarningCount}
        bomInfoCount={bomInfoCount}
      />

      {/* Dismiss confirmation dialog */}
      <AlertDialog open={pendingDismissId !== null} onOpenChange={(open) => { if (!open) { setPendingDismissId(null); } }}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Dismiss Validation Issue</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this validation issue without resolving the underlying problem. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (pendingDismissId !== null) { deleteValidationIssue(pendingDismissId); setPendingDismissId(null); toast({ title: 'Issue Dismissed', description: 'Validation issue has been dismissed.' }); } }}
              className={cn(buttonVariants({ variant: 'destructive' }))}
            >
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Custom Rules Dialog */}
      <CustomRulesDialog
        open={customRulesOpen}
        onOpenChange={setCustomRulesOpen}
        scripts={scripts}
        scriptResults={scriptResults}
        scriptDesignData={scriptDesignData}
        runScript={runScript}
        runAllEnabled={runAllEnabled}
        addScript={addScript}
        updateScript={updateScript}
        deleteScript={deleteScript}
        toast={toast}
      />

      {/* DRC Suppression Dialog (BL-0252) */}
      <DrcSuppressionDialog
        open={suppressDialogOpen}
        onOpenChange={setSuppressDialogOpen}
        target={suppressTarget}
        onSuppress={handleSuppress}
      />

      {/* Suppression count indicator */}
      {suppressionCount > 0 && (
        <div data-testid="suppression-count" className="w-full max-w-5xl mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <ShieldOff className="w-3.5 h-3.5 text-yellow-500" />
          <span>{suppressionCount} suppressed violation{suppressionCount !== 1 ? 's' : ''} hidden</span>
        </div>
      )}
    </div>
  );
}
