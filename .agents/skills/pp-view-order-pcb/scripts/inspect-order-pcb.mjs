#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-order-pcb';
const SOURCE_FILES = [
  "client/src/components/views/PcbOrderingView.tsx"
];
const TEST_FILES = [];

export async function inspectOrderPcb(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatOrderPcbInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Order PCB', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectOrderPcb();
  console.log(formatOrderPcbInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
