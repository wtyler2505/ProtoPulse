#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-inventory';
const SOURCE_FILES = [
  "client/src/components/views/StorageManagerPanel.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/storage-manager.test.tsx"
];

export async function inspectInventory(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatInventoryInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Inventory', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectInventory();
  console.log(formatInventoryInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
