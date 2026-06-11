#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-history';
const SOURCE_FILES = [
  "client/src/components/views/DesignHistoryView.tsx"
];
const TEST_FILES = [];

export async function inspectHistory(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatHistoryInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse History', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectHistory();
  console.log(formatHistoryInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
