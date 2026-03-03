/**
 * Design Report Generator
 *
 * Generates a comprehensive markdown design report from project data.
 * Pure function library. No Express routes, no side effects.
 */

import {
  type ArchNodeData,
  type ArchEdgeData,
  type BomItemData,
  type ValidationIssueData,
  type ExportResult,
  sanitizeFilename,
} from './types';

// ---------------------------------------------------------------------------
// Design Report (Markdown)
// ---------------------------------------------------------------------------

export function generateDesignReportMd(data: {
  projectName: string;
  projectDescription: string;
  nodes: ArchNodeData[];
  edges: ArchEdgeData[];
  bom: BomItemData[];
  issues: ValidationIssueData[];
  circuits: Array<{ name: string; instanceCount: number; netCount: number }>;
}): ExportResult {
  const {
    projectName,
    projectDescription,
    nodes,
    edges,
    bom,
    issues,
    circuits,
  } = data;

  const now = new Date().toISOString().split('T')[0];

  // BOM cost totals
  const totalCost = bom.reduce(
    (sum, item) => sum + parseFloat(item.totalPrice || '0'),
    0,
  );

  // Validation counts
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  const lines: string[] = [
    `# Design Report: ${projectName}`,
    '',
    `**Generated:** ${now}  `,
    `**Generator:** ProtoPulse EDA`,
    '',
    '---',
    '',
    '## Project Overview',
    '',
    projectDescription || '_No description provided._',
    '',
    '---',
    '',
    '## Architecture Summary',
    '',
    `- **Nodes:** ${nodes.length}`,
    `- **Connections:** ${edges.length}`,
    '',
  ];

  if (nodes.length > 0) {
    lines.push('### Components');
    lines.push('');
    lines.push('| # | Label | Type | Position |');
    lines.push('|---|-------|------|----------|');
    nodes.forEach((node, i) => {
      lines.push(
        `| ${i + 1} | ${node.label} | ${node.nodeType} | (${node.positionX.toFixed(0)}, ${node.positionY.toFixed(0)}) |`,
      );
    });
    lines.push('');
  }

  if (edges.length > 0) {
    lines.push('### Connections');
    lines.push('');
    lines.push('| Source | Target | Label | Signal | Voltage |');
    lines.push('|--------|--------|-------|--------|---------|');
    edges.forEach((edge) => {
      const srcNode = nodes.find((n) => n.nodeId === edge.source);
      const tgtNode = nodes.find((n) => n.nodeId === edge.target);
      lines.push(
        `| ${srcNode?.label ?? edge.source} | ${tgtNode?.label ?? edge.target} | ${edge.label ?? '-'} | ${edge.signalType ?? '-'} | ${edge.voltage ?? '-'} |`,
      );
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## BOM Summary');
  lines.push('');
  lines.push(`- **Total Items:** ${bom.length}`);
  lines.push(
    `- **Total Quantity:** ${bom.reduce((s, i) => s + i.quantity, 0)}`,
  );
  lines.push(`- **Total Cost:** $${totalCost.toFixed(2)}`);
  lines.push('');

  if (bom.length > 0) {
    lines.push('| Part Number | Manufacturer | Qty | Unit | Total | Status |');
    lines.push('|-------------|-------------|-----|------|-------|--------|');
    bom.forEach((item) => {
      lines.push(
        `| ${item.partNumber} | ${item.manufacturer} | ${item.quantity} | $${item.unitPrice} | $${item.totalPrice} | ${item.status} |`,
      );
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Validation Status');
  lines.push('');

  if (issues.length === 0) {
    lines.push('No validation issues found.');
  } else {
    lines.push(
      `- **Errors:** ${errorCount}`,
    );
    lines.push(
      `- **Warnings:** ${warningCount}`,
    );
    lines.push(
      `- **Info:** ${infoCount}`,
    );
    lines.push('');
    lines.push('| Severity | Message | Component | Suggestion |');
    lines.push('|----------|---------|-----------|------------|');
    issues.forEach((issue) => {
      lines.push(
        `| ${issue.severity.toUpperCase()} | ${issue.message} | ${issue.componentId ?? '-'} | ${issue.suggestion ?? '-'} |`,
      );
    });
  }
  lines.push('');

  if (circuits.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Circuit Designs');
    lines.push('');
    lines.push('| Name | Instances | Nets |');
    lines.push('|------|-----------|------|');
    circuits.forEach((c) => {
      lines.push(`| ${c.name} | ${c.instanceCount} | ${c.netCount} |`);
    });
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');

  const recommendations: string[] = [];

  if (errorCount > 0) {
    recommendations.push(
      `- **Resolve ${errorCount} validation error(s)** before proceeding to manufacturing.`,
    );
  }
  if (warningCount > 0) {
    recommendations.push(
      `- **Review ${warningCount} warning(s)** for potential design improvements.`,
    );
  }

  const outOfStock = bom.filter((i) => i.status === 'Out of Stock');
  if (outOfStock.length > 0) {
    recommendations.push(
      `- **${outOfStock.length} component(s) out of stock** — find alternatives or place orders.`,
    );
  }

  const noEdgeNodes = nodes.filter(
    (n) =>
      !edges.some((e) => e.source === n.nodeId || e.target === n.nodeId),
  );
  if (noEdgeNodes.length > 0) {
    recommendations.push(
      `- **${noEdgeNodes.length} unconnected node(s):** ${noEdgeNodes.map((n) => n.label).join(', ')}. Verify intentional isolation.`,
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      '- Design looks good. Proceed with detailed schematic capture and layout.',
    );
  }

  lines.push(...recommendations);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*Report generated by ProtoPulse EDA*');
  lines.push('');

  return {
    content: lines.join('\n'),
    encoding: 'utf8',
    mimeType: 'text/markdown',
    filename: `${sanitizeFilename(projectName)}_Design_Report.md`,
  };
}
