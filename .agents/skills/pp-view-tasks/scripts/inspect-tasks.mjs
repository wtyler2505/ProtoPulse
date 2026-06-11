#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-tasks';
const SOURCE_FILES = [
  "client/src/components/views/KanbanView.tsx"
];
const TEST_FILES = [];

export async function inspectTasks(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatTasksInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Tasks', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectTasks();
  console.log(formatTasksInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
