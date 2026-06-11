#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-architecture';
const SOURCE_FILES = [
  "client/src/components/views/ArchitectureView.tsx",
  "client/src/lib/contexts/architecture-context.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/ArchitectureView.test.tsx",
  "client/src/lib/contexts/__tests__/architecture-context.test.tsx"
];

export async function inspectArchitecture(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatArchitectureInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Architecture', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectArchitecture();
  console.log(formatArchitectureInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
