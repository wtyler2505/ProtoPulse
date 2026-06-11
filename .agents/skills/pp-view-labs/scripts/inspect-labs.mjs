#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-labs';
const SOURCE_FILES = [
  "client/src/components/panels/LabTemplatePanel.tsx"
];
const TEST_FILES = [];

export async function inspectLabs(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatLabsInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Labs', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectLabs();
  console.log(formatLabsInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
