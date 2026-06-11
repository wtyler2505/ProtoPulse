#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-validation';
const SOURCE_FILES = [
  "client/src/components/views/ValidationView.tsx",
  "client/src/lib/export-validation.ts"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/ValidationView.test.tsx",
  "client/src/lib/__tests__/export-validation.test.ts"
];

export async function inspectValidation(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatValidationInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Validation', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectValidation();
  console.log(formatValidationInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
