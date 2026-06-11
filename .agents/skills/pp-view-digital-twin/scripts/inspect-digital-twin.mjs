#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-digital-twin';
const SOURCE_FILES = [
  "client/src/components/views/DigitalTwinView.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/DigitalTwinView.test.tsx"
];

export async function inspectDigitalTwin(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatDigitalTwinInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Digital Twin', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectDigitalTwin();
  console.log(formatDigitalTwinInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
