#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-schematic';
const SOURCE_FILES = [
  "client/src/components/views/SchematicView.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/SchematicView.test.tsx"
];

export async function inspectSchematic(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatSchematicInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Schematic', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectSchematic();
  console.log(formatSchematicInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
