#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-arduino';
const SOURCE_FILES = [
  "client/src/components/views/ArduinoWorkbenchView.tsx"
];
const TEST_FILES = [];

export async function inspectArduino(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatArduinoInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Arduino', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectArduino();
  console.log(formatArduinoInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
