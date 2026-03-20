const fs = require('fs');

let code = fs.readFileSync('client/src/components/views/ValidationView.tsx', 'utf8');

code = code.replace(
  /const VirtualizedIssueList = memo\(function VirtualizedIssueList\(\{\n  issues, componentIssues, drcIssues, ercIssues, hasComponentParts, getIcon,/,
  `const VirtualizedIssueList = memo(function VirtualizedIssueList({
  issues, componentIssues, drcIssues, ercIssues, complianceResult, hasComponentParts, getIcon,`
);

code = code.replace(
  /  ercIssues: ERCIssue\[\];\n  hasComponentParts: boolean;/,
  `  ercIssues: ERCIssue[];
  complianceResult: { findings: ComplianceFinding[] } | null;
  hasComponentParts: boolean;`
);

code = code.replace(
  /  \}, \[issues, componentIssues, drcIssues, ercIssues, hasComponentParts\]\);/,
  `  }, [issues, componentIssues, drcIssues, ercIssues, complianceResult, hasComponentParts]);`
);

code = code.replace(
  /        <VirtualizedIssueList\n          issues=\{filteredIssues\}\n          componentIssues=\{filteredComponentIssues\}\n          drcIssues=\{filteredDrcIssues\}\n          ercIssues=\{filteredErcViolations\.map\(\(v\) => \(\{ id: v\.id, severity: v\.severity, message: v\.message, ruleType: v\.ruleType \}\)\)\}/,
  `        <VirtualizedIssueList
          issues={filteredIssues}
          componentIssues={filteredComponentIssues}
          drcIssues={filteredDrcIssues}
          ercIssues={filteredErcViolations.map((v) => ({ id: v.id, severity: v.severity, message: v.message, ruleType: v.ruleType }))}
          complianceResult={complianceResult}`
);

fs.writeFileSync('client/src/components/views/ValidationView.tsx', code);
