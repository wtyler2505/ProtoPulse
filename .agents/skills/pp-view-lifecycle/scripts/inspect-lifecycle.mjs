#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-lifecycle';
const SOURCE_FILES = [
  "client/src/components/views/LifecycleDashboard.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/LifecycleDashboard.test.tsx"
];

export async function inspectLifecycle(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatLifecycleInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Lifecycle', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectLifecycle();
  console.log(formatLifecycleInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
