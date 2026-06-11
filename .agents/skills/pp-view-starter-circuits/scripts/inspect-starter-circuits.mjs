#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-starter-circuits';
const SOURCE_FILES = [
  "client/src/components/views/StarterCircuitsPanel.tsx"
];
const TEST_FILES = [];

export async function inspectStarterCircuits(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatStarterCircuitsInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Starter Circuits', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectStarterCircuits();
  console.log(formatStarterCircuitsInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
