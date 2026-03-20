const fs = require('fs');

let code = fs.readFileSync('client/src/components/views/ValidationView.tsx', 'utf8');

const newParams = `  // Build DesignState for gateway from real architecture + BOM data`;

const injectParams = `  const complianceNodes = useMemo(() => nodes.map(n => ({
    nodeId: String(n.id),
    label: typeof n.data?.label === 'string' ? n.data.label : String(n.id),
    nodeType: n.type ?? 'default',
    data: n.data as Record<string, unknown> | null,
  })), [nodes]);

  const complianceBom = useMemo(() => bom.map(b => ({
    id: b.id,
    partNumber: b.partNumber,
    manufacturer: b.manufacturer,
    description: b.description,
    quantity: b.quantity,
    unitPrice: String(b.unitPrice),
    totalPrice: String(b.totalPrice),
    supplier: b.supplier ?? 'Unknown',
    status: b.status,
  })), [bom]);

  // Build DesignState for gateway from real architecture + BOM data`;

code = code.replace(newParams, injectParams);

const newHandler = `  const handleRunGateway = useCallback(() => {`;

const injectHandler = `  const handleRunValidation = useCallback(() => {
    runValidation();
    const result = runStandardsCheck(complianceNodes, complianceBom, { maxVoltage: 24, maxCurrent: 2 }, selectedDomains);
    setComplianceResult(result);
    toast({ title: 'Validation Running', description: 'Design rule and compliance checks initiated.' });
  }, [runValidation, runStandardsCheck, complianceNodes, complianceBom, selectedDomains, toast]);

  const handleRunGateway = useCallback(() => {`;

code = code.replace(newHandler, injectHandler);

code = code.replace(
  /onClick=\{\(\) => \{ runValidation\(\); toast\(\{ title: 'Validation Running', description: 'Design rule checks initiated.' \}\); \}\}/g,
  `onClick={handleRunValidation}`
);

code = code.replace(
  /onAction=\{\(\) => \{ runValidation\(\); toast\(\{ title: 'Validation Running', description: 'Design rule checks initiated.' \}\); \}\}/g,
  `onAction={handleRunValidation}`
);

const newRenderRow = `    if (ercIssues.length > 0) {
      const sortedErc = [...ercIssues].sort(bySeverity);
      result.push({ type: 'erc_header' as const, count: sortedErc.length });
      for (const issue of sortedErc) {
        result.push({ type: 'erc' as const, issue });
      }
    }`;

const injectRenderRow = `    if (ercIssues.length > 0) {
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
    }`;

code = code.replace(newRenderRow, injectRenderRow);

fs.writeFileSync('client/src/components/views/ValidationView.tsx', code);
