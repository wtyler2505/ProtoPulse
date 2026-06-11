#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-component-editor';
const SOURCE_FILES = [
  "client/src/components/views/ComponentEditorView.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/ComponentEditorAutoSave.test.tsx"
];

export async function inspectComponentEditor(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatComponentEditorInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Component Editor', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectComponentEditor();
  console.log(formatComponentEditorInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
