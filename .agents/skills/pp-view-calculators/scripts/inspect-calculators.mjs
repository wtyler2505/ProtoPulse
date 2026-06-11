#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-calculators';
const SOURCE_FILES = [
  "client/src/components/views/CalculatorsView.tsx"
];
const TEST_FILES = [];

export async function inspectCalculators(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatCalculatorsInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Calculators', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectCalculators();
  console.log(formatCalculatorsInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
