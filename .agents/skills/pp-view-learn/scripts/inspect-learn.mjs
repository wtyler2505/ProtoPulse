#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-learn';
const SOURCE_FILES = [
  "client/src/components/views/KnowledgeView.tsx"
];
const TEST_FILES = [];

export async function inspectLearn(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatLearnInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Learn', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectLearn();
  console.log(formatLearnInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
