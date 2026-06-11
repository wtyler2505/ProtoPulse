#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-patterns';
const SOURCE_FILES = [
  "client/src/components/views/DesignPatternsView.tsx"
];
const TEST_FILES = [];

export async function inspectPatterns(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatPatternsInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Patterns', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectPatterns();
  console.log(formatPatternsInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
