#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-circuit-code';
const SOURCE_FILES = [
  "client/src/components/views/CircuitCodeView.tsx",
  "client/src/components/views/circuit-code/CodeEditor.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/CircuitCodeView.test.tsx"
];

export async function inspectCircuitCode(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatCircuitCodeInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Circuit Code', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectCircuitCode();
  console.log(formatCircuitCodeInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
