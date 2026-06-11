#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-project-explorer';
const SOURCE_FILES = [
  "client/src/components/layout/sidebar/ProjectExplorer.tsx"
];
const TEST_FILES = [];

export async function inspectProjectExplorer(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatProjectExplorerInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Project Explorer', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectProjectExplorer();
  console.log(formatProjectExplorerInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
