#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-pcb';
const SOURCE_FILES = [
  "client/src/components/circuit-editor/PCBLayoutView.tsx"
];
const TEST_FILES = [];

export async function inspectPcb(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatPcbInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse PCB', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectPcb();
  console.log(formatPcbInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
