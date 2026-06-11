// @ts-nocheck
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatBreadboardInspectionReport,
  inspectBreadboardView,
} from '../../.agents/skills/pp-view-breadboard/scripts/inspect-breadboard-view.mjs';
import {
  formatLeftSidebarInspectionReport,
  inspectLeftSidebar,
} from '../../.agents/skills/pp-view-left-sidebar/scripts/inspect-left-sidebar.mjs';
import {
  formatUiuxDesignInspectionReport,
  inspectUiuxDesign,
} from '../../.agents/skills/pp-view-uiux-design/scripts/inspect-uiux-design.mjs';

const requiredReferences = [
  '.agents/skills/pp-view-breadboard/references/page-map.md',
  '.agents/skills/pp-view-breadboard/references/testing.md',
  '.agents/skills/pp-view-breadboard/references/ux-contract.md',
  '.agents/skills/pp-view-breadboard/references/gotchas.md',
  '.agents/skills/pp-view-breadboard/references/self-improvement-log.md',
];

const requiredSources = [
  'client/src/components/circuit-editor/BreadboardView.tsx',
  'client/src/components/circuit-editor/breadboard-canvas/index.tsx',
  'client/src/components/circuit-editor/breadboard-view/BreadboardToolbar.tsx',
  'client/src/components/circuit-editor/HardwareInspectionPanel.tsx',
  'client/src/components/circuit-editor/useBreadboardCoachPlan.ts',
  'client/src/lib/circuit-editor/view-sync.ts',
];

const requiredTests = [
  'client/src/components/circuit-editor/__tests__/BreadboardView.test.tsx',
  'client/src/components/circuit-editor/__tests__/HardwareInspectionPanel.test.tsx',
  'client/src/components/circuit-editor/__tests__/BreadboardCoachOverlay.test.tsx',
  'client/src/components/circuit-editor/__tests__/BreadboardPartInspector.trustTier.test.tsx',
  'client/src/components/circuit-editor/breadboard-view/__tests__/BreadboardToolbar.test.tsx',
];

async function writeFixtureFile(rootDir: string, relativePath: string, body = 'test("works", () => {});\n') {
  const absolutePath = path.join(rootDir, relativePath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, body);
}

describe('pp-view-breadboard inspector', () => {
  it('reports a complete Breadboard skill fixture as ok', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'pp-view-breadboard-'));

    for (const file of [...requiredReferences, ...requiredSources, ...requiredTests]) {
      await writeFixtureFile(rootDir, file);
    }

    const report = await inspectBreadboardView(rootDir);
    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(report.totalTests).toBe(requiredTests.length);
    expect(formatBreadboardInspectionReport(report)).toContain('Status: ok');
  });

  it('lists missing files plainly', async () => {
    const rootDir = await mkdtemp(path.join(os.tmpdir(), 'pp-view-breadboard-missing-'));

    const report = await inspectBreadboardView(rootDir);
    const formatted = formatBreadboardInspectionReport(report);

    expect(report.ok).toBe(false);
    expect(report.missing.length).toBeGreaterThan(0);
    expect(formatted).toContain('Status: needs work');
    expect(formatted).toContain('references/page-map.md');
    expect(formatted).toContain('BreadboardView.test.tsx');
  });
});

describe('new page skill pack inspectors', () => {
  it('left-sidebar inspector reports the current repo pack as ok', async () => {
    const report = await inspectLeftSidebar(process.cwd());

    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(formatLeftSidebarInspectionReport(report)).toContain('ProtoPulse Left Sidebar Skill Inspection');
  });

  it('uiux-design inspector reports the current repo pack as ok', async () => {
    const report = await inspectUiuxDesign(process.cwd());

    expect(report.ok).toBe(true);
    expect(report.missing).toEqual([]);
    expect(formatUiuxDesignInspectionReport(report)).toContain('ProtoPulse UI/UX + DESIGN Skill Inspection');
  });
});
