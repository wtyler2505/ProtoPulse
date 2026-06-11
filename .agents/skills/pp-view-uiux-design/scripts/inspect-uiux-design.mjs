#!/usr/bin/env node
import process from 'node:process';
import {
  formatPageSkillInspectionReport,
  inspectPageSkillPack,
} from '../../../../scripts/page-skills/inspect-pack.mjs';

const SKILL_DIR = '.agents/skills/pp-view-uiux-design';

const SOURCE_FILES = [
  'DESIGN.md',
  'client/src/index.css',
  'client/src/pages/ProjectWorkspace.tsx',
  'client/src/pages/workspace/WorkspaceHeader.tsx',
  'client/src/pages/workspace/MobileNav.tsx',
  'client/src/pages/workspace/ViewRenderer.tsx',
  'client/src/components/ui/button.tsx',
  'client/src/components/ui/dropdown-menu.tsx',
  'client/src/components/ui/scroll-area.tsx',
  'scripts/design/check-token-drift.mjs',
];

const TEST_FILES = [
  'client/src/__tests__/a11y.test.tsx',
  'client/src/pages/workspace/__tests__/WorkspaceHeader.test.tsx',
  'client/src/pages/workspace/__tests__/workspace-reducer.test.ts',
  'client/src/components/ui/__tests__/button.test.tsx',
  'client/src/components/ui/__tests__/button.a11y.test.tsx',
  'scripts/__tests__/design-token-drift.test.ts',
];

export async function inspectUiuxDesign(rootDir = process.cwd()) {
  return inspectPageSkillPack({
    rootDir,
    skillDir: SKILL_DIR,
    sourceFiles: SOURCE_FILES,
    testFiles: TEST_FILES,
  });
}

export function formatUiuxDesignInspectionReport(report) {
  return formatPageSkillInspectionReport('ProtoPulse UI/UX + DESIGN', report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await inspectUiuxDesign();
  console.log(formatUiuxDesignInspectionReport(report));
  if (!report.ok) {
    process.exitCode = 1;
  }
}
