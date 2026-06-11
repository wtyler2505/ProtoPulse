#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-part-usage';
const SOURCE_FILES = [
  "client/src/components/views/PartUsageBrowserView.tsx"
];
const TEST_FILES = [];

export async function inspectPartUsage(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatPartUsageInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Part Usage', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectPartUsage();
  console.log(formatPartUsageInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
