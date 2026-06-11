#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-my-parts';
const SOURCE_FILES = [
  "client/src/components/views/PersonalInventoryPanel.tsx"
];
const TEST_FILES = [];

export async function inspectMyParts(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatMyPartsInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse My Parts', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectMyParts();
  console.log(formatMyPartsInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
