#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-supply-chain';
const SOURCE_FILES = [
  "client/src/components/views/SupplyChainAlertsPanel.tsx"
];
const TEST_FILES = [];
TEST_FILES.push(
  "client/src/components/views/__tests__/SupplyChainAlertsPanel.test.tsx"
);

export async function inspectSupplyChain(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatSupplyChainInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Supply Chain', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectSupplyChain();
  console.log(formatSupplyChainInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
