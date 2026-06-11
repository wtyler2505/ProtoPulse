#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-exports';
const SOURCE_FILES = [
  "client/src/components/panels/ExportPanel.tsx"
];
const TEST_FILES = [];

export async function inspectExports(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatExportsInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Exports', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectExports();
  console.log(formatExportsInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
