#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-right-sidebar';
const SOURCE_FILES = [
  "client/src/components/panels/ChatPanel.tsx",
  "client/src/components/panels/ActivityFeedPanel.tsx",
  "client/src/pages/ProjectWorkspace.tsx"
];
const TEST_FILES = [
  "client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx"
];

export async function inspectRightSidebar(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatRightSidebarInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse Right Sidebar', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectRightSidebar();
  console.log(formatRightSidebarInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
