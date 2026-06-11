#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-dashboard';
const SOURCE_FILES = [
  "client/src/components/views/DashboardView.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/DashboardView.validation.test.tsx"
];

export async function inspectDashboard(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatDashboardInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Dashboard', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectDashboard();
  console.log(formatDashboardInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
