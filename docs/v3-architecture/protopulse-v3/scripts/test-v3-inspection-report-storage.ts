import assert from 'node:assert/strict';
import sample from '../examples/sample-architecture.json';
import { VisualInspectionApiResponseSchema } from '../src/api/hardware-inspection-client';
import { runVisualHardwareInspectionDraft } from '../src/ai/flows/visual-hardware-inspection';
import { v3ArchitectureTablesSql } from '../src/db/provenance-ddl';
import type { InsertV3InspectionReport } from '../src/db/schema';

const inspection = runVisualHardwareInspectionDraft(sample.visualHardwareInspectionInput);
const response = VisualInspectionApiResponseSchema.parse({ result: inspection.markdown });
const report = {
  projectId: sample.visualHardwareInspectionInput.projectId,
  reportType: 'visual',
  query: sample.visualHardwareInspectionInput.query,
  imageUrl: sample.visualHardwareInspectionInput.imageUrl,
  markdown: response.result,
  status: inspection.status,
} satisfies InsertV3InspectionReport;

assert.ok(v3ArchitectureTablesSql.includes('v3_inspection_reports'));
assert.match(report.markdown, /^# Hardware Inspection/);
assert.match(report.markdown, /## Missing Facts/);
assert.equal(report.status, 'needs_verification');

console.log(JSON.stringify({
  tableReady: v3ArchitectureTablesSql.includes('v3_inspection_reports'),
  status: report.status,
  markdownHead: report.markdown.split('\n').slice(0, 4),
}, null, 2));
