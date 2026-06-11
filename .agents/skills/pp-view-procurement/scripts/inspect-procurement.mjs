#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-procurement';
const SOURCE_FILES = [
  "client/src/components/views/ProcurementView.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/procurement-sub-components.test.tsx",
  "client/src/lib/__tests__/supplier-api.test.ts"
];

export async function inspectProcurement(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatProcurementInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Procurement', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectProcurement();
  console.log(formatProcurementInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
