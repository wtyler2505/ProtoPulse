import { Component, useState, useMemo, useCallback, useRef, memo } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useValidation } from '@/lib/contexts/validation-context';
import { useOutput } from '@/lib/contexts/output-context';
import { useProjectMeta } from '@/lib/contexts/project-meta-context';
import { useProjectId } from '@/lib/contexts/project-id-context';
import type { ViewMode } from '@/lib/project-context';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, AlertCircle, CheckCircle2, ChevronRight, XCircle, ShieldCheck, Shield, ShieldOff, Factory, Code2, Play, Trash2, Plus, ToggleLeft, ToggleRight, HelpCircle, Wrench } from 'lucide-react';
import { StyledTooltip } from '@/components/ui/styled-tooltip';
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from '@/components/ui/context-menu';
import { copyToClipboard } from '@/lib/clipboard';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/EmptyState';
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
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useComponentParts } from '@/lib/component-editor/hooks';
import { validatePart } from '@/lib/component-editor/validation';
import { runDRC } from '@/lib/component-editor/drc';
import type { PartState, PartMeta, ViewData, PartViews, DRCRule } from '@shared/component-types';
import { useCircuitDesigns, useCircuitInstances, useCircuitNets } from '@/lib/circuit-editor/hooks';
import { runERC, type ERCInput } from '@/lib/circuit-editor/erc-engine';
import { DEFAULT_ERC_RULES, DEFAULT_CIRCUIT_SETTINGS } from '@shared/circuit-types';
import type { CircuitSettings } from '@shared/circuit-types';
import type { ComponentPart } from '@shared/schema';
import { DRC_EXPLANATIONS } from '@shared/drc-engine';
import { DrcPresetSelector } from '@/components/views/DrcPresetSelector';
import { applyPreset, DRC_PRESETS } from '@/lib/drc-presets';
import type { DrcPresetId } from '@/lib/drc-presets';
import { useDesignGateway } from '@/lib/design-gateway';
import type { DesignState } from '@/lib/design-gateway';
import { useStandardsCompliance } from '@/lib/standards-compliance';
import type { ComplianceFinding } from '@/lib/standards-compliance';
import { useDfmChecker, bomToDfmInput } from '@/lib/dfm-checker';
import { mapDfmViolationToHighlight } from '@/lib/dfm-pcb-bridge';
import { useDrcScripts, BUILTIN_TEMPLATES } from '@/lib/drc-scripting';
import type { DfmCheckResult } from '@/lib/dfm-checker';
import type { DrcScript } from '@/lib/drc-scripting';
import type { ScriptDesignData } from '@/lib/drc-scripting';
import { ReviewResolutionControls } from '@/components/views/ReviewResolutionControls';
import { useArchitecture } from '@/lib/contexts/architecture-context';
import { useBom } from '@/lib/contexts/bom-context';
import { validateBomCompleteness } from '@/lib/bom-validation';
import type { BomCompletionIssue } from '@/lib/bom-validation';
import { useDrcSuppression } from '@/lib/drc-suppression';
import { DrcSuppressionDialog } from '@/components/views/DrcSuppressionDialog';
import type { DrcSuppressionTarget } from '@/components/views/DrcSuppressionDialog';
import { RemediationWizardDialog } from '@/components/views/RemediationWizardDialog';
import { getRecipe, hasRecipe } from '@/lib/remediation-wizard';
import type { RemediationRecipe } from '@/lib/remediation-wizard';
import { ManufacturerRuleCompare } from '@/components/views/ManufacturerRuleCompare';

/** Brief explanations for validation rule categories (UX-043: "why this rule matters" tooltips).
 *  DRC_EXPLANATIONS (from shared/drc-engine) provides detailed beginner-friendly text for every
 *  DRC/ERC ruleType. This local map covers high-level validation *categories* used by the
 *  architecture-level validator that don't map 1:1 to DRC rule types.
 */
const RULE_CATEGORY_EXPLANATIONS: Record<string, string> = {
  connectivity: 'Ensures all nodes are properly connected and no signals are left floating',
  power: 'Verifies power rails, decoupling, and voltage compatibility across the design',
  naming: 'Checks for consistent and unambiguous naming of nets, nodes, and components',
  completeness: 'Validates that the design has all required elements before fabrication',
  clearance: 'Ensures minimum spacing between traces, pads, and copper features',
  annular_ring: 'Checks pad ring width around drill holes meets manufacturing minimums',
  drill: 'Validates drill hole sizes are within fabrication capabilities',
  trace_width: 'Ensures traces can carry required current without overheating',
  silkscreen: 'Checks silkscreen text and graphics meet readability requirements',
  solder_mask: 'Validates solder mask openings and bridges for reliable soldering',
  board_edge: 'Ensures components and copper maintain safe distance from board edges',
  via: 'Checks via sizes and spacing meet manufacturing and signal integrity requirements',
  courtyard: 'Detects component courtyard overlaps that would prevent physical assembly',
  unconnected_pin: 'Flags pins that should be connected but are not wired to any net',
  power_pin_conflict: 'Detects conflicting power connections that could damage components',
  duplicate_refdes: 'Catches duplicate reference designators that cause BOM and assembly errors',
  missing_value: 'Ensures all components have required values (resistance, capacitance, etc.)',
  esd: 'Flags ESD-sensitive components that may need protection circuitry',
};

/** Look up explanation for a ruleType — prefers the detailed DRC_EXPLANATIONS, falls back to
 *  the category-level map, and finally a generic fallback string. */
function getRuleExplanation(ruleType: string, fallbackPrefix: string): string {
  return DRC_EXPLANATIONS[ruleType] ?? RULE_CATEGORY_EXPLANATIONS[ruleType] ?? `${fallbackPrefix} rule: ${ruleType}`;
}

/** Safely build a PartState from a ComponentPart DB row, providing defaults for nullable JSON fields. */
function toPartState(part: ComponentPart): PartState {
  const defaultMeta: PartMeta = { title: '', tags: [], mountingType: '', properties: [] };
  const defaultViewData: ViewData = { shapes: [] };
  const defaultViews: PartViews = {
    breadboard: defaultViewData,
    schematic: defaultViewData,
    pcb: defaultViewData,
  };
  return {
    meta: part.meta ? { ...defaultMeta, ...(part.meta as PartMeta) } : defaultMeta,
    connectors: Array.isArray(part.connectors) ? (part.connectors as PartState['connectors']) : [],
    buses: Array.isArray(part.buses) ? (part.buses as PartState['buses']) : [],
    views: part.views ? { ...defaultViews, ...(part.views as PartViews) } : defaultViews,
    constraints: Array.isArray(part.constraints) ? (part.constraints as PartState['constraints']) : undefined,
  };
}

interface ValidationBoundaryProps {
  children: ReactNode;
}

interface ValidationBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ValidationErrorBoundary extends Component<ValidationBoundaryProps, ValidationBoundaryState> {
  constructor(props: ValidationBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ValidationBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.warn('[ValidationView] Error caught by boundary:', error.message, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV;
      return (
        <div
          data-testid="validation-error-boundary"
          className="flex items-center justify-center h-full w-full bg-background text-muted-foreground p-8"
        >
          <div className="text-center space-y-4 max-w-md">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto" />
            <h3 className="text-base font-semibold text-foreground">
              Something went wrong loading the Validation view
            </h3>
            <p className="text-sm text-muted-foreground">
              The validation engine encountered an unexpected error. This may be caused by
              malformed component data or a missing resource. Try again, or check the browser
              console for details.
            </p>
            {isDev && this.state.error && (
              <pre className="mt-2 p-3 bg-destructive/10 border border-destructive/20 text-destructive text-xs text-left overflow-auto max-h-32 rounded">
                {this.state.error.message}
              </pre>
            )}
            <button
              data-testid="validation-retry-button"
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-2 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors focus-ring"
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function ValidationView() {
  return (
    <ValidationErrorBoundary>
      <ValidationViewContent />
    </ValidationErrorBoundary>
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
      width: typeof n.measured?.width === 'number' ? n.measured.width : (typeof n.width === 'number' ? n.width : 150),
      height: typeof n.measured?.height === 'number' ? n.measured.height : (typeof n.height === 'number' ? n.height : 50),
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
  const bomCompletionIssues = useMemo((): BomCompletionIssue[] => {
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
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [editingScript, setEditingScript] = useState<DrcScript | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptDescription, setScriptDescription] = useState('');
  const [scriptCode, setScriptCode] = useState('');

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

  const handleAddScript = useCallback(() => {
    if (!scriptName.trim()) {
      toast({ title: 'Script Name Required', description: 'Enter a name for the script.', variant: 'destructive' });
      return;
    }
    addScript(scriptName.trim(), scriptDescription.trim(), scriptCode);
    setScriptName('');
    setScriptDescription('');
    setScriptCode('');
    toast({ title: 'Script Added', description: `"${scriptName.trim()}" added to custom rules.` });
  }, [scriptName, scriptDescription, scriptCode, addScript, toast]);

  const handleRunAllScripts = useCallback(async () => {
    const allResults = await runAllEnabled(scriptDesignData);
    const totalViolations = allResults.reduce((sum, r) => sum + r.violations.length, 0);
    toast({ title: 'Scripts Executed', description: `Ran ${allResults.length} script(s), found ${totalViolations} violation(s).` });
  }, [runAllEnabled, scriptDesignData, toast]);

  const handleApplyTemplate = useCallback((templateIdx: string) => {
    const idx = parseInt(templateIdx, 10);
    if (isNaN(idx) || idx < 0 || idx >= BUILTIN_TEMPLATES.length) { return; }
    const tmpl = BUILTIN_TEMPLATES[idx];
    setScriptName(tmpl.name);
    setScriptDescription(tmpl.description);
    setScriptCode(tmpl.code);
    setSelectedTemplate(templateIdx);
  }, []);

  const handleEditScript = useCallback((script: DrcScript) => {
    setEditingScript(script);
    setScriptName(script.name);
    setScriptDescription(script.description);
    setScriptCode(script.code);
  }, []);

  const handleUpdateScript = useCallback(() => {
    if (!editingScript) { return; }
    updateScript(editingScript.id, { name: scriptName.trim(), description: scriptDescription.trim(), code: scriptCode });
    setEditingScript(null);
    setScriptName('');
    setScriptDescription('');
    setScriptCode('');
    toast({ title: 'Script Updated', description: `"${scriptName.trim()}" updated.` });
  }, [editingScript, scriptName, scriptDescription, scriptCode, updateScript, toast]);

  const handleDeleteScript = useCallback((id: string) => {
    deleteScript(id);
    toast({ title: 'Script Deleted', description: 'Custom rule removed.' });
  }, [deleteScript, toast]);

  const componentIssues = useMemo(() => {
    if (!componentParts || componentParts.length === 0) return [];
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
    if (!componentParts || componentParts.length === 0) return [];
    const views = ['breadboard', 'schematic', 'pcb'] as const;
    return componentParts.flatMap((part) => {
      const partState = toPartState(part);
      const partName = partState.meta.title || `Part #${part.id}`;
      return views.flatMap((view) => {
        if (!partState.views[view]?.shapes?.length) return [];
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
    if (!circuitInstances || circuitInstances.length === 0 || !componentParts) return [];

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

  const totalIssues = issues.length + componentIssues.length + drcIssues.length + ercViolations.length;
  const filteredTotal = filteredIssues.length + filteredComponentIssues.length + filteredDrcIssues.length + filteredErcViolations.length;

  // Count by severity across all issue types
  const severityCounts = useMemo(() => {
    const all = [
      ...issues.map((i) => i.severity),
      ...componentIssues.map((i) => i.severity),
      ...drcIssues.map((i) => i.severity),
      ...ercViolations.map((v) => v.severity),
    ];
    return { error: all.filter((s) => s === 'error').length, warning: all.filter((s) => s === 'warning').length, info: all.filter((s) => s === 'info').length };
  }, [issues, componentIssues, drcIssues, ercViolations]);

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
    // componentId may be a node ID directly, or a node label — try both
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
    // Fallback: just switch to architecture view
    setActiveView('architecture');
  }, [archNodes, focusNode, setActiveView]);

  return (
    <div className="h-full p-3 md:p-6 bg-background/50 flex flex-col items-center">
      <div className="w-full max-w-5xl flex flex-col md:flex-row md:items-center justify-between mb-4 md:mb-8 gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold flex items-center gap-3">
             <ActivityIcon />
             System Validation
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {filteredTotal === totalIssues
              ? `Found ${totalIssues} potential issues in your design.`
              : `Showing ${filteredTotal} of ${totalIssues} issues.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button data-testid="open-custom-rules" variant="outline" size="sm" onClick={() => { setCustomRulesOpen(true); }}>
            <Code2 className="w-4 h-4 mr-1" />
            Custom Rules
          </Button>
          <StyledTooltip content="Run design rule validation checks" side="bottom">
              <button
                data-testid="run-drc-checks"
                onClick={handleRunValidation}
                className="px-6 py-2 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:shadow-[0_0_25px_rgba(6,182,212,0.5)] focus-ring"
              >
                Run DRC Checks
              </button>
          </StyledTooltip>
        </div>
      </div>

      {/* DRC Preset Selector (BL-0250) */}
      <div className="w-full max-w-5xl mb-2 px-4 py-2 bg-card/30 border border-border backdrop-blur-sm" data-testid="drc-preset-bar">
        <DrcPresetSelector activePreset={activePreset} onApply={handlePresetApply} />
      </div>

      <div className="w-full max-w-5xl flex-1 overflow-hidden bg-card/40 border border-border backdrop-blur-xl shadow-xl flex flex-col">
        {/* Severity filter bar (BL-0058) */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/5" data-testid="severity-filter-bar">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Filter:</span>
          <button
            data-testid="filter-error"
            onClick={() => { toggleSeverity('error'); }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border transition-colors',
              severityFilter.error
                ? 'border-destructive/50 bg-destructive/10 text-destructive'
                : 'border-border bg-transparent text-muted-foreground/50',
            )}
          >
            <XCircle className="w-3 h-3" />
            Errors ({severityCounts.error})
          </button>
          <button
            data-testid="filter-warning"
            onClick={() => { toggleSeverity('warning'); }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border transition-colors',
              severityFilter.warning
                ? 'border-yellow-500/50 bg-yellow-500/10 text-yellow-500'
                : 'border-border bg-transparent text-muted-foreground/50',
            )}
          >
            <AlertTriangle className="w-3 h-3" />
            Warnings ({severityCounts.warning})
          </button>
          <button
            data-testid="filter-info"
            onClick={() => { toggleSeverity('info'); }}
            className={cn(
              'flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium border transition-colors',
              severityFilter.info
                ? 'border-primary/50 bg-primary/10 text-primary'
                : 'border-border bg-transparent text-muted-foreground/50',
            )}
          >
            <AlertCircle className="w-3 h-3" />
            Info ({severityCounts.info})
          </button>
        </div>

        <div className="hidden md:flex items-center gap-6 p-4 border-b border-border bg-muted/10 backdrop-blur text-xs font-semibold text-muted-foreground uppercase tracking-wider">
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
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {/* Design Gateway */}
        <div data-testid="design-gateway-section" className="bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              Design Gateway
            </h3>
            <Button data-testid="run-gateway" variant="outline" size="sm" className="h-7 text-xs" onClick={handleRunGateway}>
              <Play className="w-3 h-3 mr-1" />
              Run
            </Button>
          </div>

          <div className="space-y-1 max-h-48 overflow-auto">
            {gatewayRules.map((rule) => (
              <div key={rule.id} data-testid={`gateway-rule-${rule.id}`} className="flex items-center justify-between py-1 px-2 hover:bg-muted/20 rounded text-xs">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant={rule.severity === 'error' ? 'destructive' : rule.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px] px-1.5 py-0">
                    {rule.category}
                  </Badge>
                  <StyledTooltip content={getRuleExplanation(rule.category, 'Validation')} side="right">
                    <span className="truncate cursor-help">{rule.name}</span>
                  </StyledTooltip>
                </div>
                <button
                  data-testid={`gateway-toggle-${rule.id}`}
                  onClick={() => { if (rule.enabled) { disableGatewayRule(rule.id); } else { enableGatewayRule(rule.id); } }}
                  className="ml-2 flex-shrink-0"
                  aria-label={`Toggle ${rule.name}`}
                >
                  {rule.enabled ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            ))}
          </div>

          {gatewayViolations.length > 0 && (
            <div data-testid="gateway-violations" className="border-t border-border pt-2 space-y-1 max-h-40 overflow-auto">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {gatewayViolations.length} violation(s)
              </p>
              {gatewayViolations.map((v, i) => (
                <div key={`${v.ruleId}-${i}`} data-testid={`gateway-violation-${i}`} className="flex items-start gap-2 text-xs py-1">
                  <Badge variant={v.severity === 'error' ? 'destructive' : v.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px] px-1 py-0 flex-shrink-0">
                    {v.severity}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{v.message}</p>
                    {v.suggestion && <p className="text-emerald-500/80 text-[10px] mt-0.5">{v.suggestion}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DFM Check */}
        <div data-testid="dfm-check-section" className="bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Factory className="w-4 h-4 text-primary" />
              DFM Check
            </h3>
            <div className="flex items-center gap-1">
              <Button data-testid="run-dfm-from-bom" variant="outline" size="sm" className="h-7 text-xs" onClick={handleRunDfmFromBom}>
                <Factory className="w-3 h-3 mr-1" />
                Check from BOM
              </Button>
              <Button data-testid="run-dfm-check" variant="outline" size="sm" className="h-7 text-xs" onClick={handleRunDfm}>
                <Play className="w-3 h-3 mr-1" />
                Run
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground flex-shrink-0">Fab:</Label>
            <Select value={selectedFab} onValueChange={setSelectedFab}>
              <SelectTrigger data-testid="dfm-fab-select" className="h-7 text-xs flex-1">
                <SelectValue placeholder="Select fab house..." />
              </SelectTrigger>
              <SelectContent>
                {availableFabs.map((fab) => (
                  <SelectItem key={fab} value={fab} className="text-xs">{fab}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {dfmResult && (
            <div data-testid="dfm-results" className="border-t border-border pt-2 space-y-2">
              <div className="flex items-center justify-between">
                <Badge data-testid="dfm-pass-badge" variant={dfmResult.passed ? 'outline' : 'destructive'} className="text-xs">
                  {dfmResult.passed ? 'PASSED' : 'FAILED'}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {dfmResult.summary.errors} error(s), {dfmResult.summary.warnings} warning(s)
                </span>
              </div>
              {dfmResult.violations.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-auto">
                  {dfmResult.violations.map((v) => (
                    <div
                      key={v.id}
                      data-testid={`dfm-violation-${v.id}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        mapDfmViolationToHighlight(v);
                        setActiveView('pcb');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          mapDfmViolationToHighlight(v);
                          setActiveView('pcb');
                        }
                      }}
                      className="flex items-start gap-2 text-xs py-1 cursor-pointer hover:bg-muted/30 rounded px-1 transition-colors"
                    >
                      <Badge variant={v.severity === 'error' ? 'destructive' : v.severity === 'warning' ? 'secondary' : 'outline'} className="text-[10px] px-1 py-0 flex-shrink-0">
                        {v.severity}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <p className="truncate">{v.message}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          {v.category} | actual: {v.actual}{v.unit} / required: {v.required}{v.unit}
                        </p>
                      </div>
                      <span className="text-[9px] text-primary/60 flex-shrink-0 self-center">View on PCB</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {dfmHistory.length > 0 && (
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-[10px] text-muted-foreground">{dfmHistory.length} previous check(s)</span>
              <Button data-testid="clear-dfm-history" variant="ghost" size="sm" className="h-6 text-[10px] text-muted-foreground" onClick={clearDfmHistory}>
                Clear History
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Manufacturer Rule Compare (BL-0251) */}
      <div className="w-full max-w-5xl mt-4">
        <ManufacturerRuleCompare currentRules={drcRules} onApplyRules={handleApplyManufacturerRules} />
      </div>

      {/* Custom DRC Scripts results (below Design Gateway + DFM) */}
      {scriptResults.length > 0 && (
        <div data-testid="script-results-section" className="w-full max-w-5xl mt-4 bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4 text-primary" />
            Custom Rule Results
          </h3>
          <div className="space-y-2 max-h-48 overflow-auto">
            {scriptResults.map((r) => {
              const script = scripts.find((s) => s.id === r.scriptId);
              return (
                <div key={r.scriptId} data-testid={`script-result-${r.scriptId}`} className="border border-border/50 rounded p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium">{script?.name ?? r.scriptId}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={r.passed ? 'outline' : 'destructive'} className="text-[10px]">
                        {r.passed ? 'PASS' : 'FAIL'}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{r.executionTimeMs}ms</span>
                    </div>
                  </div>
                  {r.violations.map((v, vi) => (
                    <div key={`${v.ruleId}-${vi}`} className="text-xs text-muted-foreground pl-2 border-l border-border ml-1 mt-1">
                      <span className={cn('font-mono', v.severity === 'error' ? 'text-destructive' : v.severity === 'warning' ? 'text-yellow-500' : 'text-primary')}>
                        [{v.severity}]
                      </span>{' '}
                      {v.message}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* BOM Completeness section (BL-0580) */}
      <div data-testid="bom-completeness-section" className="w-full max-w-5xl mt-4 bg-card/40 border border-border backdrop-blur-xl shadow-xl p-4">
        <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-primary" />
          BOM Completeness
          {bomCompletionIssues.length > 0 && (
            <span className="text-[10px] text-muted-foreground font-normal ml-auto">
              {bomWarningCount > 0 && <>{bomWarningCount} warning{bomWarningCount !== 1 ? 's' : ''}</>}
              {bomWarningCount > 0 && bomInfoCount > 0 && ', '}
              {bomInfoCount > 0 && <>{bomInfoCount} info item{bomInfoCount !== 1 ? 's' : ''}</>}
            </span>
          )}
        </h3>
        {bom.length === 0 ? (
          <p className="text-xs text-muted-foreground">No BOM data available. Add components to your BOM to see completeness checks.</p>
        ) : bomCompletionIssues.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-green-500">
            <CheckCircle2 className="w-4 h-4" />
            All BOM items are complete — no issues found.
          </div>
        ) : (
          <div className="space-y-1.5 max-h-60 overflow-auto">
            {bomCompletionIssues.map((issue) => (
              <div
                key={issue.id}
                data-testid={`bom-issue-${issue.id}`}
                className="flex items-start gap-2 text-xs py-1 px-2 border border-border/30 rounded hover:bg-muted/10"
              >
                {issue.severity === 'warning' ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                )}
                <span className="flex-1 text-muted-foreground">{issue.message}</span>
                {issue.partNumber && (
                  <Badge variant="outline" className="text-[10px] flex-shrink-0">{issue.partNumber}</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

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
      <Dialog open={customRulesOpen} onOpenChange={setCustomRulesOpen}>
        <DialogContent data-testid="custom-rules-dialog" className="bg-card border-border max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-primary" />
              Custom DRC Rules
            </DialogTitle>
            <DialogDescription>
              Write JavaScript scripts that validate your design against custom rules. Scripts run in a sandboxed environment.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Script list */}
            {scripts.length > 0 && (
              <div data-testid="script-list" className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Your Scripts ({scripts.length})</h4>
                  <Button data-testid="run-all-scripts" variant="outline" size="sm" className="h-7 text-xs" onClick={() => void handleRunAllScripts()}>
                    <Play className="w-3 h-3 mr-1" />
                    Run All Enabled
                  </Button>
                </div>
                {scripts.map((script) => (
                  <div key={script.id} data-testid={`script-item-${script.id}`} className="flex items-center justify-between py-2 px-3 border border-border/50 rounded hover:bg-muted/20">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <button
                        data-testid={`script-toggle-${script.id}`}
                        onClick={() => { updateScript(script.id, { enabled: !script.enabled }); }}
                        className="flex-shrink-0"
                        aria-label={`Toggle ${script.name}`}
                      >
                        {script.enabled ? <ToggleRight className="w-4 h-4 text-primary" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{script.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{script.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <Button
                        data-testid={`script-run-${script.id}`}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => { void runScript(script.id, scriptDesignData).then(() => { toast({ title: 'Script Executed', description: `Ran "${script.name}".` }); }); }}
                      >
                        <Play className="w-3 h-3" />
                      </Button>
                      <Button
                        data-testid={`script-edit-${script.id}`}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => { handleEditScript(script); }}
                      >
                        <Code2 className="w-3 h-3" />
                      </Button>
                      <Button
                        data-testid={`script-delete-${script.id}`}
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                        onClick={() => { handleDeleteScript(script.id); }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Template selector */}
            <div className="space-y-2">
              <Label className="text-xs">Load from Template</Label>
              <Select value={selectedTemplate} onValueChange={handleApplyTemplate}>
                <SelectTrigger data-testid="template-select" className="h-8 text-xs">
                  <SelectValue placeholder="Choose a built-in template..." />
                </SelectTrigger>
                <SelectContent>
                  {BUILTIN_TEMPLATES.map((tmpl, idx) => (
                    <SelectItem key={idx} value={String(idx)} className="text-xs">{tmpl.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Script editor */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Name</Label>
                  <Input data-testid="script-name-input" value={scriptName} onChange={(e) => { setScriptName(e.target.value); }} className="h-7 text-xs" placeholder="Rule name" />
                </div>
                <div>
                  <Label className="text-xs">Description</Label>
                  <Input data-testid="script-description-input" value={scriptDescription} onChange={(e) => { setScriptDescription(e.target.value); }} className="h-7 text-xs" placeholder="What does this rule check?" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Script Code</Label>
                <textarea
                  data-testid="script-code-editor"
                  value={scriptCode}
                  onChange={(e) => { setScriptCode(e.target.value); }}
                  className="w-full h-40 bg-background border border-border rounded p-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="// Available: nodes, edges, bomItems, report(ruleId, message, severity, nodeIds, suggestion), warn(message), hasProperty(nodeId, key)"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            {editingScript ? (
              <>
                <Button data-testid="cancel-edit-script" variant="outline" size="sm" onClick={() => { setEditingScript(null); setScriptName(''); setScriptDescription(''); setScriptCode(''); }}>
                  Cancel
                </Button>
                <Button data-testid="update-script" size="sm" onClick={handleUpdateScript}>
                  Update Script
                </Button>
              </>
            ) : (
              <Button data-testid="add-script" size="sm" onClick={handleAddScript}>
                <Plus className="w-3 h-3 mr-1" />
                Add Script
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

type ArchIssue = { id: number | string; severity: string; message: string; suggestion?: string; componentId?: string };
type CompIssue = { id: string; severity: string; message: string; suggestion?: string; componentId: string };
type ERCIssue = { id: string; severity: string; message: string; ruleType: string };
type DRCIssue = { id: string; severity: string; message: string; ruleType: string; view: string; componentId: string };
type VirtualRow =
  | { type: 'arch'; issue: ArchIssue }
  | { type: 'section_header'; count: number }
  | { type: 'drc_header'; count: number }
  | { type: 'drc_rule_header'; ruleType: string; count: number }
  | { type: 'erc_header'; count: number }
  | { type: 'compliance_header'; count: number }
  | { type: 'comp'; issue: CompIssue }
  | { type: 'drc'; issue: DRCIssue }
  | { type: 'erc'; issue: ERCIssue }
  | { type: 'compliance'; issue: ComplianceFinding };

/** Expandable DRC rule group header with "Why does this matter?" explanation toggle. */
function RuleGroupHeader({ ruleType, count }: { ruleType: string; count: number }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const explanation = DRC_EXPLANATIONS[ruleType];
  return (
    <div data-testid={`drc-rule-group-${ruleType}`} className="border-b border-border/30 bg-muted/10">
      <div className="flex items-center gap-2 px-6 py-2">
        <span className="text-[10px] font-mono text-muted-foreground">{ruleType}</span>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{count}</Badge>
        {explanation && (
          <button
            data-testid={`rule-explanation-toggle-${ruleType}`}
            className="flex items-center gap-1 text-[9px] text-muted-foreground hover:text-foreground transition-colors ml-auto"
            onClick={() => setShowExplanation((v) => !v)}
            aria-label={`${showExplanation ? 'Hide' : 'Show'} explanation for ${ruleType}`}
          >
            <HelpCircle className="w-3 h-3" />
            <span>Why does this matter?</span>
          </button>
        )}
      </div>
      {showExplanation && explanation && (
        <p
          data-testid={`rule-explanation-${ruleType}`}
          className="px-6 pb-2 text-xs text-muted-foreground leading-relaxed"
        >
          {explanation}
        </p>
      )}
    </div>
  );
}

const VirtualizedIssueList = memo(function VirtualizedIssueList({
  issues, componentIssues, drcIssues, ercIssues, complianceResult, hasComponentParts, getIcon,
  deleteValidationIssue, addOutputLog, setActiveView, setPendingDismissId, runValidation, toast,
  onIssueFocus, onSuppress, onFix,
}: {
  issues: ArchIssue[];
  componentIssues: CompIssue[];
  drcIssues: DRCIssue[];
  ercIssues: ERCIssue[];
  complianceResult: { findings: ComplianceFinding[] } | null;
  hasComponentParts: boolean;
  getIcon: (severity: string) => React.ReactNode;
  deleteValidationIssue: (id: number | string) => void;
  addOutputLog: (msg: string) => void;
  setActiveView: (view: ViewMode) => void;
  setPendingDismissId: (id: number | string | null) => void;
  runValidation: () => void;
  toast: ReturnType<typeof useToast>['toast'];
  onIssueFocus?: (componentId: string | undefined) => void;
  onSuppress?: (target: DrcSuppressionTarget) => void;
  onFix?: (ruleType: string, violationMessage: string, violationId: string) => void;
}) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo<VirtualRow[]>(() => {
    // Sort by severity within each group: error > warning > info (UX-041)
    const severityOrder: Record<string, number> = { error: 0, warning: 1, info: 2 };
    const bySeverity = <T extends { severity: string }>(a: T, b: T) =>
      (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);

    const sortedArch = [...issues].sort(bySeverity);
    const result: VirtualRow[] = sortedArch.map((issue) => ({ type: 'arch' as const, issue }));

    if (hasComponentParts && componentIssues.length > 0) {
      const sortedComp = [...componentIssues].sort(bySeverity);
      result.push({ type: 'section_header' as const, count: sortedComp.length });
      for (const issue of sortedComp) {
        result.push({ type: 'comp' as const, issue });
      }
    }
    if (drcIssues.length > 0) {
      const sortedDrc = [...drcIssues].sort(bySeverity);
      result.push({ type: 'drc_header' as const, count: sortedDrc.length });
      // Group by ruleType (BL-0059)
      const byRule = new Map<string, DRCIssue[]>();
      for (const issue of sortedDrc) {
        const group = byRule.get(issue.ruleType);
        if (group) { group.push(issue); } else { byRule.set(issue.ruleType, [issue]); }
      }
      for (const [ruleType, ruleIssues] of Array.from(byRule.entries())) {
        if (byRule.size > 1) {
          result.push({ type: 'drc_rule_header' as const, ruleType, count: ruleIssues.length });
        }
        for (const issue of ruleIssues) {
          result.push({ type: 'drc' as const, issue });
        }
      }
    }
    if (ercIssues.length > 0) {
      const sortedErc = [...ercIssues].sort(bySeverity);
      result.push({ type: 'erc_header' as const, count: sortedErc.length });
      for (const issue of sortedErc) {
        result.push({ type: 'erc' as const, issue });
      }
    }
    if (complianceResult && complianceResult.findings.length > 0) {
      const sortedComp = [...complianceResult.findings].sort((a, b) => {
        const sevOrder: Record<string, number> = { violation: 0, warning: 1, recommendation: 2 };
        return (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
      });
      result.push({ type: 'compliance_header' as const, count: sortedComp.length });
      for (const issue of sortedComp) {
        result.push({ type: 'compliance' as const, issue });
      }
    }
    return result;
  }, [issues, componentIssues, drcIssues, ercIssues, complianceResult, hasComponentParts]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const t = rows[index].type;
      if (t === 'section_header' || t === 'erc_header' || t === 'drc_header') { return 48; }
      if (t === 'drc_rule_header') { return 36; }
      return 72;
    },
    overscan: 10,
  });

  if (issues.length === 0 && componentIssues.length === 0 && drcIssues.length === 0 && ercIssues.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" data-testid="empty-state-validation">
        <EmptyState
          icon={ShieldCheck}
          title="All Systems Nominal"
          description="No design rule violations detected. Run DRC checks to validate your architecture against design rules."
          actionLabel="Run DRC Checks"
          actionTestId="button-run-drc-empty"
          onAction={runValidation}
        />
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];
          return (
            <div
              key={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {row.type === 'section_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Component Part Issues</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'arch' && (
                <ContextMenu>
                  <ContextMenuTrigger asChild>
                    <div data-testid={`row-issue-${row.issue.id}`} onClick={() => { if (row.issue.componentId) { onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture'); } }} className={cn("flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group", row.issue.componentId ? "cursor-pointer" : "cursor-default")} role={row.issue.componentId ? "button" : undefined} tabIndex={row.issue.componentId ? 0 : undefined} onKeyDown={row.issue.componentId ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture'); } } : undefined}>
                      <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                        {getIcon(row.issue.severity)}
                        <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                        {row.issue.suggestion && (
                          <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-emerald-500/80">Suggestion: {row.issue.suggestion}</span>
                          </div>
                        )}
                        <ReviewResolutionControls issueId={String(row.issue.id)} />
                      </div>
                      <div className="md:w-32 text-xs font-mono text-primary bg-primary/10 px-2 py-1 self-start text-center">
                        {row.issue.componentId || 'GLOBAL'}
                      </div>
                      <div className="md:w-32">
                        <StyledTooltip content="Mark this issue as resolved" side="left">
                          <button data-testid={`button-resolve-${row.issue.id}`} aria-label={`Mark resolved: ${row.issue.message}`} onClick={(e) => { e.stopPropagation(); deleteValidationIssue(row.issue.id); addOutputLog(`[RESOLVED] Marked resolved: ${row.issue.message}`); }} className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full">
                            Mark Resolved
                          </button>
                        </StyledTooltip>
                      </div>
                    </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="bg-card/90 backdrop-blur-xl border-border min-w-[180px]">
                    <ContextMenuItem onSelect={() => { deleteValidationIssue(row.issue.id); addOutputLog(`[RESOLVED] Marked resolved: ${row.issue.message}`); }}>Mark Resolved</ContextMenuItem>
                    <ContextMenuItem onSelect={() => { onIssueFocus ? onIssueFocus(row.issue.componentId) : setActiveView('architecture'); }}>View in Architecture</ContextMenuItem>
                    <ContextMenuItem onSelect={() => copyToClipboard(row.issue.message)}>Copy Issue Details</ContextMenuItem>
                    {onSuppress && (
                      <ContextMenuItem onSelect={() => { onSuppress({ ruleId: 'arch', instanceId: String(row.issue.id), message: row.issue.message, severity: row.issue.severity }); }}>
                        <ShieldOff className="w-3.5 h-3.5 mr-1.5 text-yellow-500" />
                        Suppress
                      </ContextMenuItem>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem className="text-destructive" onSelect={() => setPendingDismissId(row.issue.id)}>Dismiss Issue</ContextMenuItem>
                  </ContextMenuContent>
                </ContextMenu>
              )}
              {row.type === 'comp' && (
                <div data-testid={`row-component-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('component_editor')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('component_editor'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    {row.issue.suggestion && (
                      <div className="mt-1.5 text-xs text-muted-foreground flex items-start gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                        <span className="text-emerald-500/80">Suggestion: {row.issue.suggestion}</span>
                      </div>
                    )}
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-primary bg-primary/10 px-2 py-1 self-start text-center">
                    {row.issue.componentId}
                  </div>
                  <div className="md:w-32">
                    <button
                      data-testid={`button-view-component-${row.issue.id}`}
                      aria-label={`View in editor: ${row.issue.message}`}
                      onClick={(e) => { e.stopPropagation(); setActiveView('component_editor'); }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
                  </div>
                </div>
              )}
              {row.type === 'drc_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Design Rule Check (DRC)</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'drc_rule_header' && (
                <RuleGroupHeader ruleType={row.ruleType} count={row.count} />
              )}
              {row.type === 'drc' && (
                <div data-testid={`row-drc-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('component_editor')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('component_editor'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <StyledTooltip content={getRuleExplanation(row.issue.ruleType, 'DRC')} side="bottom">
                      <div className="mt-1 text-[10px] text-muted-foreground font-mono cursor-help inline-block">{row.issue.ruleType} ({row.issue.view})</div>
                    </StyledTooltip>
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-rose-500 bg-rose-500/10 px-2 py-1 self-start text-center">
                    {row.issue.componentId}
                  </div>
                  <div className="md:w-32 flex flex-col gap-1">
                    <button
                      data-testid={`button-view-drc-${row.issue.id}`}
                      aria-label={`View in editor: ${row.issue.message}`}
                      onClick={(e) => { e.stopPropagation(); setActiveView('component_editor'); }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
                    {onSuppress && (
                      <button
                        data-testid={`button-suppress-drc-${row.issue.id}`}
                        aria-label={`Suppress: ${row.issue.message}`}
                        onClick={(e) => { e.stopPropagation(); onSuppress({ ruleId: row.issue.ruleType, instanceId: row.issue.id, message: row.issue.message, severity: row.issue.severity }); }}
                        className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-yellow-500/50 bg-background hover:bg-yellow-600 hover:text-white hover:border-yellow-600 px-3 py-1.5 w-full flex items-center justify-center gap-1"
                      >
                        <ShieldOff className="w-3 h-3" />
                        Suppress
                      </button>
                    )}
                    {onFix && hasRecipe(row.issue.ruleType) && (
                      <button
                        data-testid={`button-fix-drc-${row.issue.id}`}
                        aria-label={`Fix: ${row.issue.message}`}
                        onClick={(e) => { e.stopPropagation(); onFix(row.issue.ruleType, row.issue.message, row.issue.id); }}
                        className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-emerald-500/50 bg-background hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-3 py-1.5 w-full flex items-center justify-center gap-1"
                      >
                        <Wrench className="w-3 h-3" />
                        Fix
                      </button>
                    )}
                  </div>
                </div>
              )}
              {row.type === 'erc_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Electrical Rule Check (ERC)</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'erc' && (
                <div data-testid={`row-erc-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => setActiveView('schematic')} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActiveView('schematic'); } }} className="flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group cursor-pointer">
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity)}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <StyledTooltip content={getRuleExplanation(row.issue.ruleType, 'ERC')} side="bottom">
                      <div className="mt-1 text-[10px] text-muted-foreground font-mono cursor-help inline-block">{row.issue.ruleType}</div>
                    </StyledTooltip>
                    <ReviewResolutionControls issueId={String(row.issue.id)} />
                  </div>
                  <div className="md:w-32 text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-1 self-start text-center">
                    ERC
                  </div>
                  <div className="md:w-32 flex flex-col gap-1">
                    <button
                      data-testid={`button-view-erc-${row.issue.id}`}
                      aria-label={`View in schematic: ${row.issue.message}`}
                      onClick={(e) => { e.stopPropagation(); setActiveView('schematic'); }}
                      className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                    >
                      View
                    </button>
                    {onSuppress && (
                      <button
                        data-testid={`button-suppress-erc-${row.issue.id}`}
                        aria-label={`Suppress: ${row.issue.message}`}
                        onClick={(e) => { e.stopPropagation(); onSuppress({ ruleId: row.issue.ruleType, instanceId: row.issue.id, message: row.issue.message, severity: row.issue.severity }); }}
                        className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-yellow-500/50 bg-background hover:bg-yellow-600 hover:text-white hover:border-yellow-600 px-3 py-1.5 w-full flex items-center justify-center gap-1"
                      >
                        <ShieldOff className="w-3 h-3" />
                        Suppress
                      </button>
                    )}
                    {onFix && hasRecipe(row.issue.ruleType) && (
                      <button
                        data-testid={`button-fix-erc-${row.issue.id}`}
                        aria-label={`Fix: ${row.issue.message}`}
                        onClick={(e) => { e.stopPropagation(); onFix(row.issue.ruleType, row.issue.message, row.issue.id); }}
                        className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-emerald-500/50 bg-background hover:bg-emerald-600 hover:text-white hover:border-emerald-600 px-3 py-1.5 w-full flex items-center justify-center gap-1"
                      >
                        <Wrench className="w-3 h-3" />
                        Fix
                      </button>
                    )}
                  </div>
                </div>
              )}
              {row.type === 'compliance_header' && (
                <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/20 backdrop-blur">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Standards Compliance</h3>
                  <span className="text-xs text-muted-foreground">({row.count})</span>
                </div>
              )}
              {row.type === 'compliance' && (
                <div data-testid={`row-compliance-issue-${row.issue.id}`} role="button" tabIndex={0} onClick={() => { if (row.issue.componentId) onIssueFocus?.(row.issue.componentId); }} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (row.issue.componentId) onIssueFocus?.(row.issue.componentId); } }} className={cn("flex flex-col md:flex-row md:items-start gap-2 md:gap-6 p-3 md:p-4 border-b border-border/50 hover:bg-muted/30 transition-colors group", row.issue.componentId ? "cursor-pointer" : "cursor-default")}>
                  <div className="flex items-center gap-2 md:w-8 md:justify-center md:mt-0.5">
                    {getIcon(row.issue.severity === 'violation' ? 'error' : row.issue.severity === 'warning' ? 'warning' : 'info')}
                    <span className="text-xs font-medium uppercase md:hidden">{row.issue.severity}</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-foreground text-sm">{row.issue.message}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="text-[10px] text-muted-foreground font-mono inline-block bg-muted px-1.5 py-0.5 rounded">{row.issue.standardRef}</div>
                      <div className="text-[10px] text-muted-foreground capitalize">{row.issue.domain}</div>
                      {row.issue.componentLabel && (
                        <div className="text-[10px] text-muted-foreground/80 ml-2">Target: {row.issue.componentLabel}</div>
                      )}
                    </div>
                    {row.issue.remediation && (
                      <p className="mt-2 text-xs text-muted-foreground/80 bg-background/50 border border-border/30 p-2 rounded-md">
                        <span className="font-semibold text-foreground/70 mr-1">Fix:</span>
                        {row.issue.remediation}
                      </p>
                    )}
                  </div>
                  <div className="md:w-32 flex flex-col gap-1">
                    {row.issue.componentId && (
                      <button
                        data-testid={`button-view-compliance-${row.issue.id}`}
                        aria-label={`View component: ${row.issue.message}`}
                        onClick={(e) => { e.stopPropagation(); onIssueFocus?.(row.issue.componentId); }}
                        className="md:opacity-0 group-hover:opacity-100 transition-opacity text-xs border border-border bg-background hover:bg-primary hover:text-primary-foreground hover:border-primary px-3 py-1.5 w-full"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

function ActivityIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-primary">
      <path d="M22 12H18L15 21L9 3L6 12H2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
