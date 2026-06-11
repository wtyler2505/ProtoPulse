#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-3d';
const SOURCE_FILES = [
  "client/src/components/views/BoardViewer3DView.tsx"
];
const TEST_FILES = [
  "client/src/components/views/__tests__/BoardViewer3DView.test.tsx",
  "client/src/lib/__tests__/viewer-3d-bridge.test.ts",
  "e2e/p1-viewer-3d-bridge.spec.ts"
];

export async function inspect3d(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function format3dInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse 3D View', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspect3d();
  console.log(format3dInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
