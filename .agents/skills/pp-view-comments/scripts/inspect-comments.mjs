#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-comments';
const SOURCE_FILES = [
  "client/src/components/panels/CommentsPanel.tsx"
];
const TEST_FILES = [];

export async function inspectComments(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatCommentsInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Comments', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectComments();
  console.log(formatCommentsInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
