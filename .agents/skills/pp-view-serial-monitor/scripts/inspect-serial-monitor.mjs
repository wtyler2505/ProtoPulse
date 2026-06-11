#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-serial-monitor';
const SOURCE_FILES = [
  "client/src/components/panels/SerialMonitorPanel.tsx"
];
const TEST_FILES = [];

export async function inspectSerialMonitor(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatSerialMonitorInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Serial Monitor', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectSerialMonitor();
  console.log(formatSerialMonitorInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
