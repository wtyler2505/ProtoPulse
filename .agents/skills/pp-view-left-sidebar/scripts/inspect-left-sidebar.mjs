#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-left-sidebar';

const SOURCE_FILES = [
  'client/src/components/layout/Sidebar.tsx',
  'client/src/components/layout/sidebar/SidebarHeader.tsx',
  'client/src/components/layout/sidebar/ProjectSettingsPanel.tsx',
  'client/src/components/layout/sidebar/ProjectExplorer.tsx',
  'client/src/components/layout/sidebar/ComponentTree.tsx',
  'client/src/components/layout/sidebar/HistoryList.tsx',
  'client/src/components/layout/sidebar/CoachPanel.tsx',
  'client/src/components/layout/sidebar/sidebar-constants.ts',
];

const TEST_FILES = [
  'client/src/components/layout/__tests__/Sidebar.test.tsx',
  'client/src/components/layout/sidebar/__tests__/CoachPanel.test.tsx',
  'client/src/components/layout/sidebar/__tests__/sidebar-constants.test.ts',
];

export async function inspectLeftSidebar(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatLeftSidebarInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Left Sidebar', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectLeftSidebar();
  console.log(formatLeftSidebarInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
