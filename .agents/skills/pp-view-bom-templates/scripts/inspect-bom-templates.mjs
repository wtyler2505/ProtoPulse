#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-bom-templates';
const SOURCE_FILES = [
  "client/src/components/views/BomTemplatesPanel.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/BomTemplatesPanel.test.tsx"
];

export async function inspectBomTemplates(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatBomTemplatesInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse BOM Templates', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectBomTemplates();
  console.log(formatBomTemplatesInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
