#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-alternates';
const SOURCE_FILES = [
  "client/src/components/views/PartAlternatesBrowserView.tsx"
];
const TEST_FILES = [];

export async function inspectAlternates(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatAlternatesInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Alternates', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectAlternates();
  console.log(formatAlternatesInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
