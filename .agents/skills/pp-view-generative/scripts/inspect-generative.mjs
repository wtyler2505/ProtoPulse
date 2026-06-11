#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-generative';
const SOURCE_FILES = [
  "client/src/components/views/GenerativeDesignView.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/GenerativeDesignView.test.tsx",
  "client/src/lib/generative-design/__tests__/generative-adopt.test.ts"
];

export async function inspectGenerative(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatGenerativeInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Generative', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectGenerative();
  console.log(formatGenerativeInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
