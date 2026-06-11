#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-vault';
const SOURCE_FILES = [
  "client/src/components/views/VaultBrowserView.tsx"
];
const TEST_FILES = [];

export async function inspectVault(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatVaultInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Vault', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectVault();
  console.log(formatVaultInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
