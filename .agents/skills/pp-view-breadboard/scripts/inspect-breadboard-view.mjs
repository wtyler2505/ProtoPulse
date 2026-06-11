#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-breadboard';

const REQUIRED_REFERENCES = [
  'references/page-map.md',
  'references/testing.md',
  'references/ux-contract.md',
  'references/gotchas.md',
  'references/self-improvement-log.md',
];

const REQUIRED_SOURCE_FILES = [
  'client/src/components/circuit-editor/BreadboardView.tsx',
  'client/src/components/circuit-editor/breadboard-canvas/index.tsx',
  'client/src/components/circuit-editor/breadboard-view/BreadboardToolbar.tsx',
  'client/src/components/circuit-editor/HardwareInspectionPanel.tsx',
  'client/src/components/circuit-editor/useBreadboardCoachPlan.ts',
  'client/src/lib/circuit-editor/view-sync.ts',
];

const REQUIRED_TEST_FILES = [
  'client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx',
  'client/src/components/circuit-editor/__tests__/HardwareInspectionPanel.test.tsx',
  'client/src/components/circuit-editor/__tests__/BreadboardCoachOverlay.test.tsx',
  'client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx',
  'client/src/components/circuit-editor/breadboard-view/__tests__/BreadboardToolbar.test.tsx',
];

export async function inspectBreadboardView(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    references: REQUIRED_REFERENCES,
    sourceFiles: REQUIRED_SOURCE_FILES,
    testFiles: REQUIRED_TEST_FILES,
  });
}

export function formatBreadboardInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Breadboard View', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectBreadboardView();
  console.log(formatBreadboardInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
