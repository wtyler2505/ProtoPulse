/**
 * PDF Design Report Generator
 *
 * Generates a structured PDF design report from project data using pdfkit.
 * Pure function library. No Express routes, no side effects.
 */

import PDFDocument from 'pdfkit';
import type {
  ArchNodeData,
  ArchEdgeData,
  BomItemData,
  ValidationIssueData,
} from './types';
import { sanitizeFilename } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const COLORS = {
  primary: '#00BCD4',
  text: '#1a1a1a',
  muted: '#666666',
  border: '#cccccc',
  headerBg: '#f5f5f5',
  error: '#d32f2f',
  warning: '#f57c00',
  info: '#1976d2',
  success: '#388e3c',
  white: '#ffffff',
} as const;

const FONTS = {
  title: 20,
  h1: 16,
  h2: 13,
  body: 10,
  small: 8,
  tableHeader: 9,
  tableBody: 8,
} as const;

const PAGE = {
  margin: 50,
  width: 612, // Letter size
  height: 792,
} as const;

const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncate(s: string, maxLen: number): string {
  if (s.length <= maxLen) { return s; }
  return s.slice(0, maxLen - 1) + '\u2026';
}

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'error': return COLORS.error;
    case 'warning': return COLORS.warning;
    case 'info': return COLORS.info;
    default: return COLORS.muted;
  }
}

// ---------------------------------------------------------------------------
// Table drawing helper
// ---------------------------------------------------------------------------

interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

function drawTable(
  doc: InstanceType<typeof PDFDocument>,
  columns: TableColumn[],
  rows: string[][],
  options?: { maxRows?: number },
): void {
  const maxRows = options?.maxRows ?? rows.length;
  const rowHeight = 16;
  const headerHeight = 18;

  // Header row
  let x = PAGE.margin;
  doc.rect(x, doc.y, CONTENT_WIDTH, headerHeight).fill(COLORS.headerBg);
  const headerY = doc.y + 4;
  for (const col of columns) {
    doc
      .font('Helvetica-Bold')
      .fontSize(FONTS.tableHeader)
      .fillColor(COLORS.text)
      .text(col.header, x + 4, headerY, {
        width: col.width - 8,
        align: col.align ?? 'left',
        lineBreak: false,
      });
    x += col.width;
  }
  doc.y += headerHeight;

  // Data rows
  const displayRows = rows.slice(0, maxRows);
  for (const row of displayRows) {
    // Check if we need a new page
    if (doc.y + rowHeight > PAGE.height - PAGE.margin - 30) {
      doc.addPage();
    }

    // Alternating row background
    const rowIndex = displayRows.indexOf(row);
    if (rowIndex % 2 === 1) {
      doc.rect(PAGE.margin, doc.y, CONTENT_WIDTH, rowHeight).fill('#fafafa');
    }

    // Bottom border
    doc
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .moveTo(PAGE.margin, doc.y + rowHeight)
      .lineTo(PAGE.margin + CONTENT_WIDTH, doc.y + rowHeight)
      .stroke();

    x = PAGE.margin;
    const cellY = doc.y + 3;
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const cellText = row[i] ?? '';
      doc
        .font('Helvetica')
        .fontSize(FONTS.tableBody)
        .fillColor(COLORS.text)
        .text(truncate(cellText, 50), x + 4, cellY, {
          width: col.width - 8,
          align: col.align ?? 'left',
          lineBreak: false,
        });
      x += col.width;
    }
    doc.y += rowHeight;
  }

  if (rows.length > maxRows) {
    doc.y += 4;
    doc
      .font('Helvetica-Oblique')
      .fontSize(FONTS.small)
      .fillColor(COLORS.muted)
      .text(`\u2026 and ${rows.length - maxRows} more row(s)`, PAGE.margin);
    doc.y += 8;
  }

  doc.y += 10;
}

// ---------------------------------------------------------------------------
// Section heading
// ---------------------------------------------------------------------------

function sectionHeading(doc: InstanceType<typeof PDFDocument>, title: string): void {
  if (doc.y > PAGE.height - PAGE.margin - 60) {
    doc.addPage();
  }
  doc.y += 8;
  doc
    .strokeColor(COLORS.primary)
    .lineWidth(2)
    .moveTo(PAGE.margin, doc.y)
    .lineTo(PAGE.margin + CONTENT_WIDTH, doc.y)
    .stroke();
  doc.y += 8;
  doc
    .font('Helvetica-Bold')
    .fontSize(FONTS.h1)
    .fillColor(COLORS.primary)
    .text(title, PAGE.margin);
  doc.y += 6;
}

function subsectionHeading(doc: InstanceType<typeof PDFDocument>, title: string): void {
  if (doc.y > PAGE.height - PAGE.margin - 40) {
    doc.addPage();
  }
  doc.y += 4;
  doc
    .font('Helvetica-Bold')
    .fontSize(FONTS.h2)
    .fillColor(COLORS.text)
    .text(title, PAGE.margin);
  doc.y += 4;
}

// ---------------------------------------------------------------------------
// Stat box
// ---------------------------------------------------------------------------

function drawStatRow(
  doc: InstanceType<typeof PDFDocument>,
  stats: Array<{ label: string; value: string; color?: string }>,
): void {
  const boxWidth = CONTENT_WIDTH / stats.length;
  const boxHeight = 40;
  const startY = doc.y;

  for (let i = 0; i < stats.length; i++) {
    const stat = stats[i];
    const x = PAGE.margin + i * boxWidth;

    // Box border
    doc
      .rect(x + 2, startY, boxWidth - 4, boxHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();

    // Value
    doc
      .font('Helvetica-Bold')
      .fontSize(14)
      .fillColor(stat.color ?? COLORS.primary)
      .text(stat.value, x + 4, startY + 6, {
        width: boxWidth - 8,
        align: 'center',
        lineBreak: false,
      });

    // Label
    doc
      .font('Helvetica')
      .fontSize(FONTS.small)
      .fillColor(COLORS.muted)
      .text(stat.label, x + 4, startY + 24, {
        width: boxWidth - 8,
        align: 'center',
        lineBreak: false,
      });
  }

  doc.y = startY + boxHeight + 10;
}

// ---------------------------------------------------------------------------
// Footer
// ---------------------------------------------------------------------------

function addFooter(doc: InstanceType<typeof PDFDocument>, projectName: string): void {
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc
      .font('Helvetica')
      .fontSize(FONTS.small)
      .fillColor(COLORS.muted)
      .text(
        `${projectName} — Design Report — Page ${i + 1} of ${pages.count}`,
        PAGE.margin,
        PAGE.height - PAGE.margin + 15,
        { width: CONTENT_WIDTH, align: 'center' },
      );
    doc
      .text(
        'Generated by ProtoPulse EDA',
        PAGE.margin,
        PAGE.height - PAGE.margin + 25,
        { width: CONTENT_WIDTH, align: 'center' },
      );
  }
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

export interface PdfReportData {
  projectName: string;
  projectDescription: string;
  nodes: ArchNodeData[];
  edges: ArchEdgeData[];
  bom: BomItemData[];
  issues: ValidationIssueData[];
  circuits: Array<{ name: string; instanceCount: number; netCount: number }>;
}

export interface PdfReportResult {
  buffer: Buffer;
  mimeType: 'application/pdf';
  filename: string;
}

export function generateDesignReportPdf(data: PdfReportData): Promise<PdfReportResult> {
  const { projectName, projectDescription, nodes, edges, bom, issues, circuits } = data;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: {
        top: PAGE.margin,
        bottom: PAGE.margin + 20, // Extra space for footer
        left: PAGE.margin,
        right: PAGE.margin,
      },
      bufferPages: true,
      info: {
        Title: `${projectName} - Design Report`,
        Author: 'ProtoPulse EDA',
        Subject: 'Electronic Design Report',
        Creator: 'ProtoPulse',
      },
    });

    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => {
      const buffer = Buffer.concat(chunks);
      resolve({
        buffer,
        mimeType: 'application/pdf',
        filename: `${sanitizeFilename(projectName)}_Design_Report.pdf`,
      });
    });
    doc.on('error', reject);

    const now = new Date().toISOString().split('T')[0];

    // -----------------------------------------------------------------------
    // Title page header
    // -----------------------------------------------------------------------

    doc.y = PAGE.margin;

    // Top accent bar
    doc
      .rect(PAGE.margin, doc.y, CONTENT_WIDTH, 4)
      .fill(COLORS.primary);
    doc.y += 16;

    doc
      .font('Helvetica-Bold')
      .fontSize(FONTS.title)
      .fillColor(COLORS.text)
      .text(projectName, PAGE.margin);
    doc.y += 2;

    doc
      .font('Helvetica')
      .fontSize(FONTS.body)
      .fillColor(COLORS.muted)
      .text(`Design Report — ${now}`, PAGE.margin);
    doc.y += 8;

    if (projectDescription) {
      doc
        .font('Helvetica')
        .fontSize(FONTS.body)
        .fillColor(COLORS.text)
        .text(projectDescription, PAGE.margin, doc.y, { width: CONTENT_WIDTH });
      doc.y += 8;
    }

    // -----------------------------------------------------------------------
    // Summary stats
    // -----------------------------------------------------------------------

    const totalCost = bom.reduce((sum, item) => sum + parseFloat(item.totalPrice || '0'), 0);
    const errorCount = issues.filter((i) => i.severity === 'error').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    drawStatRow(doc, [
      { label: 'Components', value: String(nodes.length) },
      { label: 'Connections', value: String(edges.length) },
      { label: 'BOM Items', value: String(bom.length) },
      { label: 'Est. Cost', value: `$${totalCost.toFixed(2)}` },
      { label: 'Issues', value: String(issues.length), color: errorCount > 0 ? COLORS.error : COLORS.success },
    ]);

    // -----------------------------------------------------------------------
    // Architecture section
    // -----------------------------------------------------------------------

    sectionHeading(doc, 'Architecture');

    if (nodes.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(FONTS.body)
        .fillColor(COLORS.muted)
        .text('No architecture nodes defined yet.', PAGE.margin);
      doc.y += 10;
    } else {
      subsectionHeading(doc, 'Components');

      const nodeRows = nodes.map((n, i) => [
        String(i + 1),
        n.label,
        n.nodeType,
        `(${n.positionX.toFixed(0)}, ${n.positionY.toFixed(0)})`,
      ]);

      drawTable(doc, [
        { header: '#', width: 30, align: 'right' },
        { header: 'Label', width: 200 },
        { header: 'Type', width: 140 },
        { header: 'Position', width: CONTENT_WIDTH - 370, align: 'center' },
      ], nodeRows, { maxRows: 50 });

      // Unconnected nodes warning
      const unconnected = nodes.filter(
        (n) => !edges.some((e) => e.source === n.nodeId || e.target === n.nodeId),
      );
      if (unconnected.length > 0) {
        doc
          .font('Helvetica')
          .fontSize(FONTS.small)
          .fillColor(COLORS.warning)
          .text(
            `\u26a0 ${unconnected.length} unconnected node(s): ${unconnected.map((n) => n.label).join(', ')}`,
            PAGE.margin,
          );
        doc.y += 8;
      }
    }

    if (edges.length > 0) {
      subsectionHeading(doc, 'Connections');

      const edgeRows = edges.map((e) => {
        const src = nodes.find((n) => n.nodeId === e.source);
        const tgt = nodes.find((n) => n.nodeId === e.target);
        return [
          src?.label ?? e.source,
          tgt?.label ?? e.target,
          e.label ?? '-',
          e.signalType ?? '-',
          e.voltage ?? '-',
        ];
      });

      drawTable(doc, [
        { header: 'Source', width: 120 },
        { header: 'Target', width: 120 },
        { header: 'Label', width: 100 },
        { header: 'Signal', width: 86 },
        { header: 'Voltage', width: CONTENT_WIDTH - 426, align: 'right' },
      ], edgeRows, { maxRows: 50 });
    }

    // -----------------------------------------------------------------------
    // BOM section
    // -----------------------------------------------------------------------

    sectionHeading(doc, 'Bill of Materials');

    if (bom.length === 0) {
      doc
        .font('Helvetica-Oblique')
        .fontSize(FONTS.body)
        .fillColor(COLORS.muted)
        .text('No BOM items added yet.', PAGE.margin);
      doc.y += 10;
    } else {
      const bomRows = bom.map((item) => [
        item.partNumber,
        item.manufacturer,
        String(item.quantity),
        `$${item.unitPrice}`,
        `$${item.totalPrice}`,
        item.status,
      ]);

      drawTable(doc, [
        { header: 'Part Number', width: 110 },
        { header: 'Manufacturer', width: 100 },
        { header: 'Qty', width: 40, align: 'right' },
        { header: 'Unit $', width: 60, align: 'right' },
        { header: 'Total $', width: 70, align: 'right' },
        { header: 'Status', width: CONTENT_WIDTH - 380 },
      ], bomRows, { maxRows: 100 });

      // BOM totals
      const totalQty = bom.reduce((s, i) => s + i.quantity, 0);
      doc
        .font('Helvetica-Bold')
        .fontSize(FONTS.body)
        .fillColor(COLORS.text)
        .text(`Total: ${bom.length} items, ${totalQty} units, $${totalCost.toFixed(2)}`, PAGE.margin);
      doc.y += 10;

      // Out of stock warnings
      const outOfStock = bom.filter((i) => i.status === 'Out of Stock');
      if (outOfStock.length > 0) {
        doc
          .font('Helvetica')
          .fontSize(FONTS.small)
          .fillColor(COLORS.error)
          .text(
            `\u26a0 ${outOfStock.length} component(s) out of stock: ${outOfStock.map((i) => i.partNumber).join(', ')}`,
            PAGE.margin,
          );
        doc.y += 8;
      }
    }

    // -----------------------------------------------------------------------
    // Validation section
    // -----------------------------------------------------------------------

    sectionHeading(doc, 'Validation Status');

    if (issues.length === 0) {
      doc
        .font('Helvetica')
        .fontSize(FONTS.body)
        .fillColor(COLORS.success)
        .text('\u2714 No validation issues found. Design passes all checks.', PAGE.margin);
      doc.y += 10;
    } else {
      drawStatRow(doc, [
        { label: 'Errors', value: String(errorCount), color: errorCount > 0 ? COLORS.error : COLORS.success },
        { label: 'Warnings', value: String(warningCount), color: warningCount > 0 ? COLORS.warning : COLORS.success },
        { label: 'Info', value: String(issues.filter((i) => i.severity === 'info').length), color: COLORS.info },
      ]);

      const issueRows = issues.map((issue) => [
        issue.severity.toUpperCase(),
        issue.message,
        issue.componentId ?? '-',
        issue.suggestion ?? '-',
      ]);

      drawTable(doc, [
        { header: 'Severity', width: 60 },
        { header: 'Message', width: 210 },
        { header: 'Component', width: 100 },
        { header: 'Suggestion', width: CONTENT_WIDTH - 370 },
      ], issueRows, { maxRows: 50 });
    }

    // -----------------------------------------------------------------------
    // Circuit designs section (if any)
    // -----------------------------------------------------------------------

    if (circuits.length > 0) {
      sectionHeading(doc, 'Circuit Designs');

      const circuitRows = circuits.map((c) => [
        c.name,
        String(c.instanceCount),
        String(c.netCount),
      ]);

      drawTable(doc, [
        { header: 'Design', width: 250 },
        { header: 'Instances', width: 130, align: 'right' },
        { header: 'Nets', width: CONTENT_WIDTH - 380, align: 'right' },
      ], circuitRows);
    }

    // -----------------------------------------------------------------------
    // Recommendations section
    // -----------------------------------------------------------------------

    sectionHeading(doc, 'Recommendations');

    const recommendations: string[] = [];

    if (errorCount > 0) {
      recommendations.push(`Resolve ${errorCount} validation error(s) before proceeding to manufacturing.`);
    }
    if (warningCount > 0) {
      recommendations.push(`Review ${warningCount} warning(s) for potential design improvements.`);
    }

    const outOfStock = bom.filter((i) => i.status === 'Out of Stock');
    if (outOfStock.length > 0) {
      recommendations.push(`${outOfStock.length} component(s) out of stock \u2014 find alternatives or place orders.`);
    }

    const unconnected = nodes.filter(
      (n) => !edges.some((e) => e.source === n.nodeId || e.target === n.nodeId),
    );
    if (unconnected.length > 0) {
      recommendations.push(
        `${unconnected.length} unconnected node(s): ${unconnected.map((n) => n.label).join(', ')}. Verify intentional isolation.`,
      );
    }

    if (recommendations.length === 0) {
      recommendations.push('Design looks good. Proceed with detailed schematic capture and layout.');
    }

    for (const rec of recommendations) {
      doc
        .font('Helvetica')
        .fontSize(FONTS.body)
        .fillColor(COLORS.text)
        .text(`\u2022 ${rec}`, PAGE.margin + 10, doc.y, { width: CONTENT_WIDTH - 10 });
      doc.y += 4;
    }

    // -----------------------------------------------------------------------
    // Footer on all pages
    // -----------------------------------------------------------------------

    addFooter(doc, projectName);

    doc.end();
  });
}
